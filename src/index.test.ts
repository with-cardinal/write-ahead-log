import fs from "fs/promises";
import { WriteAheadLog } from ".";
import path from "path";

let testDir: string;

beforeAll(async () => {
  testDir = await fs.mkdtemp("tmp/test");
});

afterAll(async () => {
  await fs.rm(testDir, { recursive: true });
});

test("init", async () => {
  const wal = await WriteAheadLog.init(
    testDir,
    "init",
    4194304,
    async () => undefined
  );
  await wal.append(Buffer.from("hello world"));
  const statResult = await fs.stat(wal.path);
  await wal.close();

  expect(statResult).toBeTruthy();
});

test("rotate", async () => {
  let counter = 0;

  const wal = await WriteAheadLog.init(
    testDir,
    "rotate",
    4194304,
    async () => undefined
  );
  wal.onRotate = async () => {
    counter++;
  };

  const msg = "w".repeat(1000);

  for (let i = 0; i < 10000; i++) {
    await wal.append(Buffer.from(msg));
  }
  await wal.close();

  expect(counter).toBe(2);
});

test("recover", async () => {
  const wal = await WriteAheadLog.init(
    testDir,
    "recover",
    4194304,
    async () => undefined
  );

  // write enough data to go past log 0
  const msg = "w".repeat(1000);
  for (let i = 0; i < 10000; i++) {
    await wal.append(Buffer.from(msg));
  }
  await wal.crash();

  const beforeHandle = await fs.open(path.join(testDir, "recover-0.wal"), "w");
  await beforeHandle.close();

  let counter = 0;
  const cb = async () => {
    counter++;
  };

  const recovered = await WriteAheadLog.init(testDir, "recover", 4194304, cb);
  expect(counter).toBe(1815);
  await recovered.close();
});
