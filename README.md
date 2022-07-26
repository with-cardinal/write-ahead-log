# write-ahead-log

A generalized write ahead log implementation.

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

#### `init(logDir: string, name: string) : Promise<[WriteAheadLog, LogCursor | undefined]>`

Constructs a new write ahead log targeting `logDir`, which will generate log 
files with names like `{name}-{logNum}.wal`. Returns the new write ahead log 
and a `LogCursor` that allows iteration of any pending operations on the last 
log.

#### `byteLength`

Returns the length of bytes written to the current log file.

#### `path`

Returns the filename for the current log file with relative path.

#### `logNum`

Returns the current log number.

#### `append(msg: Buffer) : Promise<void>`

Append `msg` to the log.

#### `flush() : Promise<void>`

Flush log to disk. Logs are flushed automatically every 32kib, but it's 
important to flush on transaction commits to ensure the transaction reaches 
disk.

#### `close() : Promise<string>`

Flushes any buffered data and closes the log.

### `LogCursor`

#### `next() : Promise<Buffer | undefined>`

Read the next log entry.

## License

MIT. See LICENSE for details.