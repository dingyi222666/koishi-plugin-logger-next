import { FileHandle, open, readFile } from 'fs/promises';
import { Dict, Logger } from 'koishi';
import { Buffer } from 'buffer';

export class FileWriter
{
  public data: Logger.Record[];
  public task: Promise<FileHandle>;
  public size: number;

  private temp: Logger.Record[] = [];

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
    this.task = this.task.then(async (handle) =>
    {
      const content = Buffer.from(this.temp.map((record) => JSON.stringify(record) + '\n').join(''));
      this.data.push(...this.temp);
      this.temp = [];
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
    this.temp.push(record);
    this.flush();
  }

  async close()
  {
    const handle = await this.task;
    await handle.close();
  }
}

/** 按「日期新→旧、分段大→小」回溯日志文件，取最新 limit 条，按时间正序返回。 */
export async function readLogs(root: string, files: Dict<number[]>, limit: number)
{
  const output: Logger.Record[] = [];
  const dates = Object.keys(files).sort().reverse();
  for (const date of dates)
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
        if (output.length >= limit) break;
        try
        {
          output.push(JSON.parse(line));
        } catch { }
      }
      if (output.length >= limit) return output.reverse();
    }
  }
  return output.reverse();
}
