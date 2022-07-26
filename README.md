# write-ahead-log

A generalized write ahead log implementation.

## Installation

```
npm install @withcardinal/write-ahead-log
```

## Usage

A single class, WriteAheadLog is exposed.

```javascript
const log = new WriteAheadLog(
  ".",
  "log",
  4194304,
  (valid, msg) => recover(msg)
);
```

Logs are appended to with `append`:

```javascript
await log.append(msg: Buffer);
```

Appends are buffered until 32kib of log data are appended or `flush` is called.
It's important to call `flush` any time a transaction is committed so that it's stored to disk.

```javascript
await wal.flush();
```

Be sure to close the write-ahead-log during any graceful shutdown of your service:

```javascript
await wal.close();
```

## API Documentation

### `WriteAheadLog`

#### `init(logDir: string, name: string, logLimit: number, recoveryCallback: RecoveryCallback) : Promise<WriteAheadLog]>`

Constructs a new write ahead log targeting `logDir`, which will generate log 
files with names like `{name}-{logNum}.wal`. Returns the new write ahead log 
and calls `cb` if there are any records to recover from prior logs. An interval
is created in the background to flush outstanding log entries every 3 seconds.

##### Parameters

- `logDir` - the directory to store logs in
- `name` - the filename pattern to use when writing logs. Files will be written as `{name}-{num}.wal` within `logDir`
- `logLimit` - the target number of bytes for each log file. This isn't a hard limit, but only one record will be written that exceeds log limit before rotating.
- `recoveryCallback` - a callback of the form `(valid: boolean, msg?: Buffer) => void` that is called for each recovered statement from the log. The `valid` argument is true when no corruption was detected within the record, or false if it was determined to be corrupt. `msg` is passed only if the `valid` flag is `true`.

#### `path`

Returns the filename for the current log file with relative path.

#### `append(msg: Buffer) : Promise<void>`

Append `msg` to the log.

##### Parameters

- `msg` - the message to add to the log

#### `flush() : Promise<void>`

Flush log to disk. Logs are flushed automatically every 32kib, but it's 
important to flush on transaction commits to ensure the transaction reaches 
disk.

#### `close() : Promise<void>`

Flushes any buffered data and closes the log.

#### `crash() : Promise<void>`

Simulates a crash by closing the log without flushing any pending writes. 
Useful for testing.

## License

MIT. See LICENSE for details.