# write-ahead-log

A generalized write ahead log implementation. It's based on [LevelDB's write 
ahead log](https://github.com/google/leveldb/blob/main/doc/log_format.md).

## Installation

```
npm install @withcardinal/write-ahead-log
```

## Usage

A single class, WriteAheadLog is exposed.

```
const log = new WriteAheadLog(logDir: string);
```

Logs are appended to with `append`:

```
await log.append(msg: Buffer);
```

As you append to the log you can track the byteLength of the log with `byteLength`, and then `rotate` the log once it has reached a target length. Resolving the log will start appending to a new log file.

```
if (log.byteLength > 4194304) {
  const oldFile = await log.rotate();
  await fs.rm(oldFile);
}
```

## API Documentation

### `WriteAheadLog`

#### `constructor(logDir: string, name: string)`

Constructs a new write ahead log targeting `logDir`. Will generate log files with names like `{name}-{logNum}.wal`

#### `byteLength`

Returns the length of bytes written to the current log file.

#### `path`

Returns the filename for the current log file with relative path.

#### `logNum`

Returns the current log number.

#### `recover() : Promise<LogCursor>`

Returns a `LogCursor` for recovering the current log.

#### `append(msg: Buffer) : Promise<void>`

Append `msg` to the log.

#### `rotate() : Promise<string>`

Rotates the log and returns the name of the file that was just rotated from.

### `LogCursor`

#### `next() : Promise<Buffer | undefined>`

Read the next log entry.

## License

MIT. See LICENSE for details.