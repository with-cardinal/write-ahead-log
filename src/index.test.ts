import { mkdtemp, rm, stat } from "fs/promises";
import { WriteAheadLog } from ".";

describe("on empty directory", () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await mkdtemp("tmp/test");
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true });
  });

  test("init", async () => {
    const wal = await WriteAheadLog.init(testDir, "from-empty");
    await wal.append(Buffer.from("hello world"));
    await wal.close();

    const statResult = await stat(wal.path);
    expect(statResult).toBeTruthy();
  });
});
