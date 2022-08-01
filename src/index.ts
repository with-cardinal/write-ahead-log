import fs from "fs/promises";
import path from "path";
import { fingerprint32 } from "farmhash";

const WRITE_THESHOLD = 32768;
const FLUSH_INTERVAL = 3000;

export type RecoveryCallback = (valid: boolean, msg?: Buffer) => Promise<void>;
export type RotateCallback = () => Promise<void>;

function logPath(dir: string, name: string, num: number): string {
  return path.join(dir, `${name}-${num}.wal`);
}

async function recover(
  dirPath: string,
  name: string,
  cb: RecoveryCallback
): Promise<void> {
  const logs: [string, number][] = [];
  const pattern = new RegExp(`${name}-([0-9]+)\\.wal$`);
  const dir = await fs.opendir(dirPath);
  for await (const entry of dir) {
    if (entry.isFile()) {
      const match = entry.name.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (!isNaN(num)) {
          logs.push([entry.name, num]);
        }
      }
    }
  }

  // sort the logs in reverse
  const sortedLogs = logs.sort((a, b) => b[1] - a[1]);

  if (sortedLogs.length === 0) {
    return;
  }

  const lastLog = sortedLogs[0];
  const toRecover = logPath(dirPath, name, lastLog[1]);
  const handle = await fs.open(toRecover, "r");
  const logSize = (await handle.stat()).size;

  let corruptRecords = 0;
  let offset = 0;
  while (offset < logSize) {
    const fpBuf = Buffer.alloc(4);
    await handle.read(fpBuf, 0, 4);
    const fp = fpBuf.readUInt32BE(0);

    const sizeBuf = Buffer.alloc(8);
    await handle.read(sizeBuf, 0, 8);
    const size = sizeBuf.readUIntBE(2, 6);

    const msg = Buffer.alloc(size);
    await handle.read(msg, 0, size);

    const toCheck = Buffer.concat([sizeBuf, msg]);
    if (fingerprint32(toCheck) === fp) {
      await cb(true, msg);
    } else {
      corruptRecords++;
      await cb(false);
    }

    offset += msg.byteLength + 12;
  }
  await handle.close();

  if (corruptRecords > 0) {
    await fs.rename(toRecover, toRecover + `-corrupt-${new Date().getTime()}`);
  } else {
    await fs.rm(toRecover);
  }

  // remove older logs
  for (const log of sortedLogs.slice(1)) {
    await fs.rm(logPath(dirPath, name, log[1]));
  }
}

export class WriteAheadLog {
  private dirPath: string;
  private name: string;
  private _byteLength = 0;
  private _pendingLength = 0;
  private _logNum = 0;
  private _handle: fs.FileHandle;
  private _onRotate?: RotateCallback;
  private _logLimit: number;

  private pendingWrites: Buffer[] = [];

  private _interval: NodeJS.Timeout;

  static async init(
    dirPath: string,
    name: string,
    logLimit: number,
    cb: RecoveryCallback
  ): Promise<WriteAheadLog> {
    await recover(dirPath, name, cb);

    const logNum = 0;
    const handle = await fs.open(logPath(dirPath, name, logNum), "wx");

    return new WriteAheadLog(dirPath, name, logNum, logLimit, handle);
  }

  constructor(
    dirPath: string,
    name: string,
    logNum: number,
    logLimit: number,
    handle: fs.FileHandle
  ) {
    this.dirPath = dirPath;
    this.name = name;
    this._logNum = logNum;
    this._handle = handle;
    this._logLimit = logLimit;

    this._interval = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL);
  }

  get path(): string {
    return logPath(this.dirPath, this.name, this._logNum);
  }

  set onRotate(cb: RotateCallback) {
    this._onRotate = cb;
  }

  async append(msg: Buffer): Promise<void> {
    const msgWithLength = Buffer.alloc(msg.byteLength + 8);
    msgWithLength.writeUIntBE(msg.byteLength, 2, 6);
    msg.copy(msgWithLength, 8);

    const fp = fingerprint32(msgWithLength);
    const outBuf = Buffer.alloc(msgWithLength.byteLength + 4);
    outBuf.writeUInt32BE(fp, 0);
    msgWithLength.copy(outBuf, 4);

    this.pendingWrites.push(outBuf);
    this._pendingLength += outBuf.byteLength;
    this._byteLength += outBuf.byteLength;

    if (this._pendingLength > WRITE_THESHOLD) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.pendingWrites.length === 0) {
      return;
    }

    const buf = Buffer.concat(this.pendingWrites);

    if (
      this._byteLength > 0 &&
      this._byteLength + buf.byteLength > this._logLimit
    ) {
      await this.rotate();
    }

    await this._handle.write(buf);
    this.pendingWrites = [];
    this._pendingLength = 0;
  }

  private async rotate(): Promise<void> {
    const prevPath = this.path;

    await this._handle.close();
    this._logNum = this._logNum + 1;
    this._handle = await fs.open(
      logPath(this.dirPath, this.name, this._logNum),
      "wx"
    );
    this._byteLength = this._pendingLength;
    await this._onRotate?.();
    await fs.unlink(prevPath);
  }

  async close(): Promise<void> {
    clearInterval(this._interval);
    await this.flush();
    await this._handle.close();
    await fs.unlink(this.path);
  }

  async crash(): Promise<void> {
    clearInterval(this._interval);
    await this._handle.close();
  }
}
