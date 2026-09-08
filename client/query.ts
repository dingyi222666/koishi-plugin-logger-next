/**
 * Logcat 式 query 语言（developer.android.com/studio/debug/logcat）。
 *
 * `name:foo` / `message:bar` / `level:info`（该级别及更严重）/ `age:5m`；
 * `-` 否定、`key~:re` 正则、同 key 多词 OR、其余 AND、引号短语；裸词匹配消息内容。
 * 另含输入补全（key 左、说明右）与 query 语法高亮 token。
 */
import { ansiPlain } from './ansi'
import type { Logger } from 'koishi'
import type { LogLevel } from './format'

type QueryKey = 'name' | 'message' | 'level' | 'age'

export interface QueryTerm {
    key: QueryKey | 'text'
    negated: boolean
    regex: boolean
    value: string
}

const SEVERITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    success: 2,
    warn: 3,
    error: 4,
}

/** Logcat 级别词 + 缩写 → 我们的级别。 */
const LEVEL_WORDS: Record<string, LogLevel> = {
    verbose: 'debug',
    v: 'debug',
    debug: 'debug',
    d: 'debug',
    info: 'info',
    i: 'info',
    success: 'success',
    s: 'success',
    warn: 'warn',
    warning: 'warn',
    w: 'warn',
    error: 'error',
    e: 'error',
    assert: 'error',
    a: 'error',
}

const AGE_UNITS: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
}

function normalizeKey(word: string): QueryKey | null {
    switch (word.toLowerCase()) {
        case 'name':
        case 'tag': // Logcat 习惯别名
            return 'name'
        case 'message':
        case 'msg':
            return 'message'
        case 'level':
            return 'level'
        case 'age':
            return 'age'
        default:
            return null
    }
}

/** 按空白切词，双引号短语算一个词。 */
function tokenizeQuery(input: string): string[] {
    return [...input.matchAll(/"([^"]*)"|(\S+)/gu)].map(
        (match) => match[1] ?? match[2]!
    )
}

function parseTerm(token: string): QueryTerm {
    const match = token.match(/^(-?)([a-zA-Z]+)(~?):(.+)$/u)
    if (match !== null) {
        const key = normalizeKey(match[2]!)
        if (key !== null) {
            return {
                key,
                negated: match[1] === '-',
                regex: match[3] === '~',
                value: match[4]!,
            }
        }
    }
    return { key: 'text', negated: false, regex: false, value: token }
}

export function parseQuery(input: string): QueryTerm[] {
    return tokenizeQuery(input).map(parseTerm)
}

export interface QueryFilter {
    /** 全部条目都要过的判定（同 key 正词 OR、其余 AND、否定项不得命中）。 */
    matches(entry: Logger.Record): boolean
    /** 正向词合成的高亮 pattern（无正向词 = undefined）。 */
    highlight: RegExp | undefined
    /** 有解析不了的正向词（如非法正则）→ 输入框红框提示。 */
    invalid: boolean
}

const escapeRegExp = (text: string): string =>
    text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function termMatches(
    term: QueryTerm,
    entry: Logger.Record,
    now: number,
    caseSensitive: boolean
): boolean {
    if (term.key === 'level') {
        const target = LEVEL_WORDS[term.value.toLowerCase()]
        if (target === undefined) return true // 无法解析的级别：不参与过滤
        return SEVERITY[entry.type] >= SEVERITY[target]
    }
    if (term.key === 'age') {
        const match = term.value.match(/^(\d+)([smhd])$/u)
        if (match === null) return true
        return entry.timestamp >= now - Number(match[1]!) * AGE_UNITS[match[2]!]!
    }
    const haystack = term.key === 'name' ? entry.name : ansiPlain(entry.content)
    if (term.regex) {
        try {
            return new RegExp(term.value, caseSensitive ? '' : 'i').test(
                haystack
            )
        } catch {
            return false
        }
    }
    return caseSensitive
        ? haystack.includes(term.value)
        : haystack.toLowerCase().includes(term.value.toLowerCase())
}

export function compileQuery(
    input: string,
    caseSensitive: boolean
): QueryFilter {
    const terms = parseQuery(input)
    const now = Date.now()
    const positive = new Map<QueryKey, QueryTerm[]>()
    const plain: QueryTerm[] = []
    const negated: QueryTerm[] = []
    let invalid = false
    for (const term of terms) {
        if (term.regex) {
            try {
                new RegExp(term.value, caseSensitive ? '' : 'i')
            } catch {
                invalid = true
            }
        }
        if (term.key === 'text') {
            if (!term.negated) plain.push(term)
            continue
        }
        if (term.negated) {
            negated.push(term)
        } else {
            const group = positive.get(term.key) ?? []
            group.push(term)
            positive.set(term.key, group)
        }
    }
    const highlightParts = [...positive.values()]
        .flat()
        .concat(plain)
        .filter((term) => term.key !== 'level' && term.key !== 'age')
        .map((term) => (term.regex ? term.value : escapeRegExp(term.value)))
    let highlight: RegExp | undefined
    if (highlightParts.length > 0) {
        try {
            highlight = new RegExp(
                highlightParts.join('|'),
                caseSensitive ? '' : 'i'
            )
        } catch {
            highlight = undefined
        }
    }
    return {
        invalid,
        highlight,
        matches(entry: Logger.Record): boolean {
            if (
                negated.some((term) =>
                    termMatches(term, entry, now, caseSensitive)
                )
            )
                return false
            for (const term of plain) {
                if (!termMatches(term, entry, now, caseSensitive)) return false
            }
            // 同 key 的正向词是 OR（Logcat 隐式规则），不同 key 之间 AND
            for (const group of positive.values()) {
                if (
                    !group.some((term) =>
                        termMatches(term, entry, now, caseSensitive)
                    )
                )
                    return false
            }
            return true
        },
    }
}

// ── query 补全（Logcat：key 左、说明右）─────────────────────

export interface Suggestion {
    /** 接受后替换输入框最后一个词的内容。 */
    insert: string
    desc: string
}

const KEY_SUGGESTIONS: Suggestion[] = [
    { insert: 'name:', desc: 'Logger 名包含字符串' },
    { insert: 'message:', desc: '消息内容包含字符串' },
    { insert: 'level:', desc: '该级别及更严重（debug/info/warn/error）' },
    { insert: 'age:', desc: '最近时间段（如 30s / 5m / 3h / 1d）' },
    { insert: '-name:', desc: '排除 logger 名' },
    { insert: '-message:', desc: '排除消息内容' },
    { insert: '-level:', desc: '排除该级别及更严重' },
]

const LEVEL_SUGGESTIONS: Suggestion[] = [
    { insert: 'debug', desc: 'DEBUG 及更严重（全部）' },
    { insert: 'info', desc: 'INFO 及更严重' },
    { insert: 'warn', desc: 'WARN 及更严重' },
    { insert: 'error', desc: '仅 ERROR' },
]

/** 依据输入的最后一个词给出补全（key 前缀 → key 表；key:值 → 值表）。 */
export function buildSuggestions(
    input: string,
    names: readonly string[]
): Suggestion[] {
    const lastToken = /(?:^|\s)(\S*)$/u.exec(input)?.[1] ?? ''
    if (lastToken === '') return input === '' ? KEY_SUGGESTIONS : []
    if (!lastToken.includes(':')) {
        const needle = lastToken.toLowerCase()
        return KEY_SUGGESTIONS.filter((item) =>
            item.insert.toLowerCase().startsWith(needle)
        )
    }
    const match = lastToken.match(/^(-?)([a-zA-Z]+)(~?):(.*)$/u)
    if (match === null) return []
    const key = normalizeKey(match[2]!)
    const prefix = `${match[1]}${match[2]}${match[3]}:`
    const typed = match[4]!.toLowerCase()
    if (key === 'name') {
        return names
            .filter((name) => name.toLowerCase().includes(typed))
            .slice(0, 8)
            .map((name) => ({ insert: `${prefix}${name} `, desc: name }))
    }
    if (key === 'level') {
        return LEVEL_SUGGESTIONS.filter((item) =>
            item.insert.startsWith(typed)
        )
    }
    return []
}

export function applySuggestion(
    input: string,
    suggestion: Suggestion
): string {
    const lastToken = /(?:^|\s)(\S*)$/u.exec(input)?.[1] ?? ''
    const head = input.slice(0, input.length - lastToken.length)
    return `${head}${suggestion.insert}`
}

// ── query 语法高亮（Logcat 查询栏同款观感）─────────────────

export interface QueryToken {
    text: string
    cls?: string
}

export function highlightQueryTokens(input: string): QueryToken[] {
    const tokens: QueryToken[] = []
    for (const match of input.matchAll(/"([^"]*)"|(\S+)|(\s+)/gu)) {
        if (match[3] !== undefined) {
            tokens.push({ text: match[3] })
            continue
        }
        const token = match[1] !== undefined ? `"${match[1]}"` : match[2]!
        const term = token.match(/^(-?)([a-zA-Z]+)(~?):(.*)$/s)
        if (term === null || normalizeKey(term[2]!) === null) {
            tokens.push({
                text: token,
                cls: match[1] !== undefined ? 'll-q-phrase' : undefined,
            })
            continue
        }
        if (term[1] !== '') tokens.push({ text: term[1], cls: 'll-q-neg' })
        tokens.push({ text: term[2]! + term[3]!, cls: 'll-q-key' })
        tokens.push({ text: ':', cls: 'll-q-colon' })
        tokens.push({ text: term[4]! })
    }
    return tokens
}
