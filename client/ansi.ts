/**
 * ANSI 处理：渲染交给 ansi_up（与官方 logger / `simple-logs.vue` 同款），
 * 剥离留给过滤 / 折叠 / 复制。
 */
import AnsiUp from 'ansi_up'

// ansi_up 在不同打包环境下的导出形态不一致（官方 logger 同款兜底）
const converter = new ((AnsiUp as any)['default'] || AnsiUp)()

/** ANSI content → HTML（ansi_up；`escape_html` 默认开启，无 XSS 面）。 */
export function ansiToHtml(content: string): string {
    return converter.ansi_to_html(content)
}

/** 剥掉全部 ANSI 序列（用户看到的是文本，不是转义码）。 */
export function ansiPlain(content: string): string {
    return content
        .replace(/\x1B\[[0-9;]*[A-Za-z]/gu, '')
        .replace(/\x1B\[[0-9;]*$/u, '')
}

/** 在 ansi_up 产出的 HTML 上只给文本节点包高亮 mark（不碰标签 / 属性）。 */
export function highlightHtml(
    html: string,
    pattern: RegExp | undefined
): string {
    if (pattern === undefined) return html
    const global = new RegExp(
        pattern.source,
        pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    )
    return html
        .split(/(<[^>]*>)/g)
        .map((part) => {
            if (part === '' || part.startsWith('<')) return part
            return part.replace(global, (match) =>
                match === '' ? match : `<mark class="ll-hit">${match}</mark>`
            )
        })
        .join('')
}
