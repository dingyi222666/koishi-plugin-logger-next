/**
 * ANSI SGR 解析（纯函数，无框架依赖）。
 *
 * 服务端 logger target `colors: 3`，`%C` 等富上色以 ANSI 序列留在
 * `Logger.Record.content` 里。这里把它切成「文本 + 样式」runs，由视图层渲染成
 * 带样式的节点——不引 ansi_up、不 innerHTML，天然没有 XSS 面。
 */

/** VS Code Dark+ 同款 16 色（固定深色控制台上的可读集，0-7 基色 / 8-15 亮色）。 */
export const ANSI16 = [
    '#666666',
    '#cd3131',
    '#0dbc79',
    '#e5e510',
    '#2472c8',
    '#bc3fbc',
    '#11a8cd',
    '#e5e5e5',
    '#666666',
    '#f14c4c',
    '#23d18b',
    '#f5f543',
    '#3b8eea',
    '#d670d6',
    '#29b8db',
    '#ffffff',
] as const

/** ANSI 256 色序号 → hex（标准 6×6×6 立方 + 灰阶公式，不背 240 项查值表）。 */
export function ansi256ToHex(code: number): string {
    if (code < 16) return ANSI16[code] ?? '#e5e5e5'
    if (code < 232) {
        const n = code - 16
        const level = (value: number): number =>
            value === 0 ? 0 : 55 + value * 40
        const hex = (value: number): string =>
            value.toString(16).padStart(2, '0')
        return `#${hex(level(Math.floor(n / 36)))}${hex(level(Math.floor((n % 36) / 6)))}${hex(level(n % 6))}`
    }
    const gray = (8 + (code - 232) * 10).toString(16).padStart(2, '0')
    return `#${gray}${gray}${gray}`
}

/** 一段带 SGR 样式的文本（字段为 undefined = 未启用，渲染时可跳过）。 */
export interface AnsiRun {
    text: string
    color?: string | undefined
    bold?: boolean | undefined
    italic?: boolean | undefined
    underline?: boolean | undefined
}

/** CSI 序列：`ESC [ 参数 字母`。捕获参数与终结字母，供 split 切分。 */
const CSI = /\x1B\[([0-9;]*)([A-Za-z])/

/** 把 content 切成带样式的 runs（非 SGR 的 CSI 序列剥掉；截断的序列收尾剥掉）。 */
export function parseAnsi(raw: string): AnsiRun[] {
    // 文件截断可能把序列切一半：去掉尾巴上不完整的 ESC[
    const content = raw.replace(/\x1B\[[0-9;]*$/u, '')
    // split 带捕获组：[文本, 参数, 字母, 文本, 参数, 字母, …]
    const parts = content.split(CSI)
    const runs: AnsiRun[] = []
    let style: AnsiRun = { text: '' }
    for (let index = 0; index < parts.length; index += 3) {
        const text = parts[index] ?? ''
        if (text !== '') runs.push({ ...style, text })
        const letter = parts[index + 2]
        if (letter === undefined) break
        if (letter !== 'm') continue // 非 SGR（光标移动等）：丢弃，不影响样式
        const params = (parts[index + 1] ?? '').split(';')
        for (let cursor = 0; cursor < params.length; cursor++) {
            const code = params[cursor] === '' ? 0 : Number(params[cursor])
            if (code === 0) style = { text: '' }
            else if (code === 1) style = { ...style, bold: true }
            else if (code === 3) style = { ...style, italic: true }
            else if (code === 4) style = { ...style, underline: true }
            else if (code === 22 || code === 23 || code === 24) {
                style = { ...style, bold: false, italic: false, underline: false }
            } else if (code === 39) style = { ...style, color: undefined }
            else if (code >= 30 && code <= 37)
                style = { ...style, color: ANSI16[code - 30] }
            else if (code >= 90 && code <= 97)
                style = { ...style, color: ANSI16[code - 90 + 8] }
            else if (code === 38 && params[cursor + 1] === '5') {
                style = {
                    ...style,
                    color: ansi256ToHex(Number(params[cursor + 2] ?? 0)),
                }
                cursor += 2
            } else if (code === 38 && params[cursor + 1] === '2') {
                // 24-bit RGB（防御性支持）
                const rgb = params.slice(cursor + 2, cursor + 5)
                if (rgb.length === 3)
                    style = { ...style, color: `rgb(${rgb.join(',')})` }
                cursor += 4
            }
            // 背景色等其余 SGR 码：忽略
        }
    }
    return runs
}

/** 剥掉全部 ANSI 序列（过滤 / 折叠 / 复制用：用户看到的是文本，不是转义码）。 */
export function ansiPlain(content: string): string {
    return content
        .replace(/\x1B\[[0-9;]*[A-Za-z]/gu, '')
        .replace(/\x1B\[[0-9;]*$/u, '')
}

/** 把一段文本按 pattern 切成 命中 / 未命中 段（高亮用）。 */
export function highlightSegments(
    text: string,
    pattern: RegExp
): Array<{ text: string; hit: boolean }> {
    const global = new RegExp(
        pattern.source,
        pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    )
    const segments: Array<{ text: string; hit: boolean }> = []
    let last = 0
    for (const match of text.matchAll(global)) {
        if (match.index > last)
            segments.push({ text: text.slice(last, match.index), hit: false })
        const length = match[0].length
        if (length > 0)
            segments.push({
                text: text.slice(match.index, match.index + length),
                hit: true,
            })
        last = match.index + length
    }
    if (last < text.length)
        segments.push({ text: text.slice(last), hit: false })
    return segments
}
