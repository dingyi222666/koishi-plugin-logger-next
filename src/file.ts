import { FileHandle, open, readFile } from 'fs/promises';
import { Dict, Logger } from 'koishi';
import { Buffer } from 'buffer';

export class FileWriter
{
  public data: Logger.Record[];
  public task: Promise<FileHandle>;
  public size: number;

  private temp: Logger.Record[] = [];
  private closing = false;

  constructor(public date: string, public path: string)
  {
    this.task = open(path, 'a+').then(async (handle) =>
    {
      const buffer = await handle.readFile();
      this.data = this.parse(new TextDecoder().decode(buffer));
      this.size = buffer.byteLength;
      return handle;
    });
    this.task.then(() => this.flush());
  }

  flush()
  {
    if (!this.temp.length) return;
    const batch = this.temp;
    this.temp = [];
    this.task = this.task.then(async (handle) =>
    {
      const content = Buffer.from(batch.map((record) => JSON.stringify(record) + '\n').join(''));
      this.data.push(...batch);
      await handle.write(content);
      this.size += content.byteLength;
      return handle;
    });
  }

  parse(text: string)
  {
    return text.split('\n').map((line) =>
    {
      try
      {
        return JSON.parse(line);
      } catch { }
    }).filter(Boolean);
  }

  async read()
  {
    await this.task;
    return this.data;
  }

  write(record: Logger.Record)
  {
    if (this.closing) return;
    this.temp.push(record);
    this.flush();
  }

  async close()
  {
    // 等缓冲落盘再关句柄，否则 close 抢在 flush 前会 EBADF 丢记录。
    this.closing = true;
    let handle: FileHandle;
    do
    {
      this.flush();
      handle = await this.task;
    } while (this.temp.length > 0);
    await handle.close();
  }
}

export interface LogCursor
{
  timestamp: number;
  id: number;
}

/**
 * 按「日期新→旧、分段大→小」回溯，返回按时间正序的记录。
 *
 * - `limit`：本次最多返回条数（不传 = 全部）。
 * - `before`：游标，只取早于它的记录（增量回拉用；不传 = 从最新开始）。
 * - `depth`：从最新一条起最多回溯多少条，超过的不再下发（总深度上限，对应 maxLines）。
 */
export async function readLogs(
  root: string,
  files: Dict<number[]>,
  limit = Infinity,
  before?: LogCursor,
  depth = Infinity,
)
{
  const output: Logger.Record[] = [];
  let seen = 0;
  const dates = Object.keys(files).sort().reverse();
  outer: for (const date of dates)
  {
    for (const index of [...files[date]!].sort((a, b) => b - a))
    {
      let text: string;
      try
      {
        text = await readFile(`${root}/${date}-${index}.log`, 'utf-8');
      } catch { continue; }
      const lines = text.trimEnd().split('\n').reverse();
      for (const line of lines)
      {
        if (seen >= depth || output.length >= limit) break outer;
        try
        {
          const record = JSON.parse(line) as Logger.Record;
          seen++;
          if (
            !before ||
            record.timestamp < before.timestamp ||
            (record.timestamp === before.timestamp && record.id < before.id)
          )
            output.push(record);
        } catch { }
      }
    }
  }
  return output.reverse();
}
