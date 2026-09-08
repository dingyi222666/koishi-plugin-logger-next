# koishi-plugin-logger-logs

把 Koishi 运行日志写入本地文件，并在控制台提供全屏日志查看器。

## 特性

- **日志落盘**：`data/logs/YYYY-MM-DD-N.log`（JSON Lines，按大小 / 天数轮转清理）
- **控制台「日志」页**：实时增量 + 历史回补，按 `boot`/`id` 去重
- **Logcat 式过滤 query**：`name:` / `message:` / `level:` / `age:`，`-` 否定、
  `key~:` 正则、引号短语，同 key OR / 跨 key AND，裸词匹配消息内容
- **输入即出的补全**：Ctrl+Space 打开，↑↓ 选择，Enter / Tab 接受
- **ANSI SGR 解析渲染**：自研解析器，不 `innerHTML`、无 XSS 面
- **级别 chips、来源筛选、大小写开关、折叠相同模式的行**
- **JetBrains 控制台式滚动**：贴底跟随、上翻停靠、新日志计数、一键回底
- **命中导航**：Enter / Shift+Enter 在命中行间跳转
- **多选复制**：Cmd/Ctrl+点击多选、Shift+范围选、右键菜单复制

## 配置

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `root` | string | `data/logs` | 存放输出日志的本地目录 |
| `maxAge` | number | `30` | 日志文件保存的最大天数（天） |
| `maxSize` | number | `102400` | 单个日志文件的最大大小（字节） |
| `levels` | dict | — | 指定模块的输出等级（`debug` 键映射到 base 等级） |

## 开发

```bash
yarn build   # tsc + esbuild（lib/）+ vite（client/ → dist/）
```

- 服务端（`src/`）：Koishi 插件，`Logger.targets` 落盘 + `DataService<Logger.Record[]>('logs')`
- 客户端（`client/`）：Vue 3 + `@koishijs/client`，`/logs` 页读取 `store.logs`
