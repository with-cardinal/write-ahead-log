import fs from "fs/promises";
import path from "path";
import { fingerprint32 } from "farmhash";

const WRITE_THESHOLD = 32768;
//const LOG_LIMIT = 4194304;

export class WriteAheadLog {
  private dirPath: string;
  private name: string;
  private _byteLength = 0;
  private _pendingLength = 0;
  private _logNum = 0;
  private _handle: fs.FileHandle;

  private pendingWrites: Buffer[] = [];

  static async init(dirPath: string, name: string): Promise<WriteAheadLog> {
    const logNum = 0;

    const handle = await fs.open(
      path.join(dirPath, `${name}-${logNum}.log`),
      "wx"
    );
    return new WriteAheadLog(dirPath, name, logNum, handle);
  }

  constructor(
    dirPath: string,
    name: string,
    logNum: number,
    handle: fs.FileHandle
  ) {
    this.dirPath = dirPath;
    this.name = name;
    this._logNum = logNum;
    this._handle = handle;
  }

  get byteLength(): number {
    return this._byteLength;
  }

  get path(): string {
    return path.join(this.dirPath, `${this.name}-${this._logNum}.log`);
  }

  get logNum(): number {
    return this._logNum;
  }

  async append(msg: Buffer): Promise<void> {
    const msgWithLength = Buffer.alloc(msg.byteLength + 8);
    msgWithLength.writeUIntLE(msg.byteLength, 2, 6);
    msg.copy(msgWithLength, 8);

    const fp = fingerprint32(msgWithLength);
    const outBuf = Buffer.alloc(msgWithLength.byteLength + 4);
    outBuf.writeUInt32LE(fp, 0);
    msgWithLength.copy(outBuf, 12);

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
    await this._handle.write(buf);
    this.pendingWrites = [];
    this._pendingLength = 0;
  }

  async close(): Promise<void> {
    await this.flush();
    await this._handle.close();
  }

  async crash(): Promise<void> {
    await this._handle.close();
  }
}
