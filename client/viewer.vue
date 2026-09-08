<template>
  <div class="ll-root">
    <!-- 过滤栏：来源 + Logcat 式 query（语法高亮 + 补全）+ 折叠 + 动作 -->
    <div class="ll-toolbar">
      <el-select
        v-model="source"
        class="ll-source"
        placeholder="全部来源"
        @change="withFilterReset"
      >
        <el-option :value="''" :label="`全部来源（${total}）`" />
        <el-option
          v-for="item in sources"
          :key="item.name"
          :value="item.name"
          :label="`${item.name}（${item.count}）`"
        />
      </el-select>

      <div class="ll-query-wrap">
        <el-input
          v-model="query"
          class="ll-query"
          :class="{ 'is-invalid': queryFilter.invalid }"
          placeholder="过滤：name:foo level:info -message:bar age:5m"
          spellcheck="false"
          @input="onQueryInput"
          @focus="onQueryFocus"
          @blur="suggestOpen = false"
          @keydown="onQueryKeydown"
        >
          <template #suffix>
            <el-button
              link
              class="ll-aa"
              :type="caseSensitive ? 'primary' : 'info'"
              title="区分大小写"
              @mousedown.prevent
              @click="toggleCase"
            >
              Aa
            </el-button>
          </template>
        </el-input>
        <!-- 文字透明 + 覆盖层上色：query 语法高亮 -->
        <div class="ll-query-overlay" aria-hidden="true">
          <span
            v-for="(token, index) in queryTokens"
            :key="index"
            :class="token.cls"
            >{{ token.text }}</span
          >
        </div>
        <div
          v-if="suggestOpen && suggestions.length > 0"
          class="ll-suggest"
          @mousedown.prevent
        >
          <el-button
            v-for="(item, index) in suggestions"
            :key="`${item.insert}:${index}`"
            link
            class="ll-suggest-item"
            :class="{ 'is-active': index === suggestIndex }"
            @click="acceptSuggestion(item)"
          >
            <span class="ll-suggest-key">{{ item.insert }}</span>
            <span class="ll-suggest-desc">{{ item.desc }}</span>
          </el-button>
        </div>
      </div>

      <el-input
        v-if="foldEnabled"
        v-model="foldText"
        class="ll-fold-input"
        :class="{ 'is-invalid': invalidFold && foldPattern === undefined }"
        placeholder="折叠包含…的行"
        spellcheck="false"
        @input="withFilterReset"
      />

      <div class="ll-actions">
        <el-tooltip content="折叠包含某模式的行" placement="bottom">
          <el-button
            text
            :type="foldEnabled ? 'primary' : 'info'"
            :icon="Fold"
            @click="toggleFoldEnabled"
          />
        </el-tooltip>
        <el-tooltip
          :content="follow ? '已跟随最新' : '滚动到最新并跟随'"
          placement="bottom"
        >
          <el-button
            text
            :type="follow ? 'primary' : 'info'"
            :icon="Bottom"
            @click="scrollToEnd"
          />
        </el-tooltip>
        <el-tooltip content="自动换行" placement="bottom">
          <el-button
            text
            :type="wrap ? 'primary' : 'info'"
            :icon="Sort"
            @click="toggleWrap"
          />
        </el-tooltip>
        <el-tooltip content="清空视图" placement="bottom">
          <el-button text type="info" :icon="Delete" @click="clearView" />
        </el-tooltip>
      </div>
    </div>

    <!-- 控制台：全宽铺满（虚拟滚动，只渲染视口内的行） -->
    <div class="ll-body">
      <div
        ref="scrollEl"
        class="ll-console"
        :class="{ 'is-nowrap': !wrap }"
        @scroll="onScroll"
      >
        <p v-if="!loaded" class="ll-empty">正在加载日志缓冲…</p>
        <p v-else-if="rows.length === 0" class="ll-empty">
          {{
            queryFilter.invalid ? 'query 里有无效的正则。' : '没有匹配的日志。'
          }}
        </p>
        <div
          v-else
          class="ll-vlist"
          :style="wrap ? undefined : { minWidth: `${maxRowWidth}px` }"
        >
          <div
            v-if="padTop > 0"
            class="ll-pad"
            :style="{ height: `${padTop}px` }"
          />
          <template v-for="(row, index) in visibleRows" :key="row.key">
            <LogRow
              v-if="row.kind === 'line'"
              :data-row-key="row.key"
              :data-row-index="windowRange.start + index"
              :data-match="row.match"
              :entry="row.entry"
              :wrap="wrap"
              :pattern="queryFilter.highlight"
              :current="
                queryFilter.highlight !== undefined && cursor === row.match
              "
              :selected="rowSelection.has(rowKey(row.entry))"
              @mousedown="onRowMouseDown(row.entry, $event)"
              @contextmenu="onRowContextMenu(row.entry, $event)"
            />
            <el-button
              v-else
              link
              class="ll-fold"
              :data-row-key="row.key"
              :data-row-index="windowRange.start + index"
              @click="toggleFold(row.key)"
            >
              <span class="ll-fold-arrow">{{
                row.expanded ? '▾' : '▸'
              }}</span>
              <span v-if="row.expanded">已展开 {{ row.count }} 行</span>
              <span v-else
                >已折叠 {{ row.count }} 行 · 自 {{ row.time }} ·
                {{ row.name }}</span
              >
            </el-button>
          </template>
          <div
            v-if="padBottom > 0"
            class="ll-pad"
            :style="{ height: `${padBottom}px` }"
          />
        </div>
      </div>
      <el-button
        v-if="!follow"
        type="primary"
        round
        class="ll-float"
        :icon="Bottom"
        @click="scrollToEnd"
      >
        {{ newCount > 0 ? `${newCount} 条新日志` : '滚动到底部' }}
      </el-button>
    </div>

    <!-- 行右键菜单 -->
    <div
      v-if="menu !== null"
      class="ll-menu"
      :style="menuStyle"
      @mousedown.stop
      @contextmenu.prevent
    >
      <el-button
        v-for="item in menuItems"
        :key="item.label"
        link
        class="ll-menu-item"
        :class="{ 'is-disabled': item.disabled }"
        :disabled="item.disabled"
        @click="runMenu(item)"
      >
        {{ item.label }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Logger } from 'koishi'
import { ElButton, ElInput, ElOption, ElSelect, ElTooltip } from 'element-plus'
import { Bottom, Delete, Fold, Sort } from '@element-plus/icons-vue'
import LogRow from './LogRow.vue'
import { ansiPlain } from './ansi'
import { buildFeed } from './feed'
import { formatTime, LEVEL_META } from './format'
import { VirtualLayout } from './virtual'
import {
    applySuggestion,
    buildSuggestions,
    compileQuery,
    highlightQueryTokens,
} from './query'
import type { Suggestion } from './query'

const props = withDefaults(
    defineProps<{
        logs?: Logger.Record[] | undefined
        loaded?: boolean
    }>(),
    { loaded: true }
)

interface LineItem {
    kind: 'line'
    key: string
    entry: Logger.Record
    match: number
}

interface FoldItem {
    kind: 'fold'
    key: string
    items: Logger.Record[]
    expanded: boolean
    lines: LineItem[]
}

type ViewItem = LineItem | FoldItem

const rowKey = (entry: Logger.Record): string =>
    `${entry.timestamp}:${entry.id}`

// ── 数据：store.logs → 去重 / 截断后的 feed ──────────────────
const entries = computed(() => buildFeed(props.logs))

/** 「清空视图」的本地水位：只隐藏已看到的，服务端缓冲与 store 不动。 */
const cleared = ref<{ ts: number; id: number } | null>(null)
const visible = computed(() => {
    const cut = cleared.value
    if (cut === null) return entries.value
    return entries.value.filter(
        (entry) =>
            entry.timestamp > cut.ts ||
            (entry.timestamp === cut.ts && entry.id > cut.id)
    )
})

// ── 过滤状态 ────────────────────────────────────────────────
const source = ref('')
// 默认不过滤：打开即显示当前日志文件的全部记录（含之前的）
const query = ref('')
const caseSensitive = ref(false)
const wrap = ref(true)

const foldEnabled = ref(false)
const foldText = ref('')
const expandedFolds = ref<Set<string>>(new Set())

const cursor = ref(0)
const rowSelection = ref<Set<string>>(new Set())
const anchorKey = ref<string | null>(null)
const menu = ref<{
    x: number
    y: number
    selectionText: string
} | null>(null)

const suggestOpen = ref(false)
const suggestIndex = ref(0)

const scrollEl = ref<HTMLElement>()

const follow = ref(true)
const newCount = ref(0)
let resetCount = false
let prevLength = 0

// ── 派生 ────────────────────────────────────────────────────
const total = computed(() => visible.value.length)

/** 来源计数：visible 尾部追加时增量更新（清空视图 / 重连时整份重算）。 */
let sourceCounts = new Map<string, number>()
let sourceInput: readonly Logger.Record[] | undefined
let sourceProcessed = 0

const sources = computed((): Array<{ name: string; count: number }> => {
    const list = visible.value
    if (sourceInput !== list || list.length < sourceProcessed) {
        sourceCounts = new Map()
        sourceInput = list
        sourceProcessed = 0
    }
    for (let i = sourceProcessed; i < list.length; i++) {
        const name = list[i]!.name
        sourceCounts.set(name, (sourceCounts.get(name) ?? 0) + 1)
    }
    sourceProcessed = list.length
    return [...sourceCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count }))
})

const queryFilter = computed(() =>
    compileQuery(query.value, caseSensitive.value)
)

const queryTokens = computed(() => highlightQueryTokens(query.value))

const suggestions = computed(() =>
    buildSuggestions(
        query.value,
        sources.value.map((item) => item.name)
    )
)

const invalidFold = computed(() => foldEnabled.value && foldText.value !== '')

const foldPattern = computed((): RegExp | undefined => {
    if (!foldEnabled.value || foldText.value === '') return undefined
    try {
        return new RegExp(foldText.value, caseSensitive.value ? '' : 'i')
    } catch {
        return undefined
    }
})

const filtered = computed(() =>
    visible.value.filter(
        (entry) =>
            (source.value === '' || entry.name === source.value) &&
            queryFilter.value.matches(entry)
    )
)

/** 折叠分组（Fold Lines Like This）：连续命中折叠 pattern 的 ≥2 行折成一组。 */
const display = computed(
    (): Array<Omit<LineItem, 'match'> | Omit<FoldItem, 'expanded' | 'lines'>> => {
        const pattern = foldPattern.value
        if (pattern === undefined) {
            return filtered.value.map((entry) => ({
                kind: 'line' as const,
                key: rowKey(entry),
                entry,
            }))
        }
        const items: Array<
            Omit<LineItem, 'match'> | Omit<FoldItem, 'expanded' | 'lines'>
        > = []
        let group: Logger.Record[] = []
        const flush = (): void => {
            if (group.length === 0) return
            if (group.length === 1) {
                items.push({
                    kind: 'line',
                    key: rowKey(group[0]!),
                    entry: group[0]!,
                })
            } else {
                items.push({
                    kind: 'fold',
                    key: `fold:${rowKey(group[0]!)}`,
                    items: group,
                })
            }
            group = []
        }
        for (const entry of filtered.value) {
            if (
                pattern.test(ansiPlain(entry.content)) ||
                pattern.test(entry.name)
            ) {
                group.push(entry)
                continue
            }
            flush()
            items.push({ kind: 'line', key: rowKey(entry), entry })
        }
        flush()
        return items
    }
)

/** 渲染列表：分配命中导航用的序号（收起的折叠组不可跳转）。 */
const viewItems = computed((): ViewItem[] => {
    let match = 0
    const items: ViewItem[] = []
    for (const item of display.value) {
        if (item.kind === 'line') {
            items.push({ ...item, match: match++ })
            continue
        }
        const expanded = expandedFolds.value.has(item.key)
        const lines: LineItem[] = expanded
            ? item.items.map((entry) => ({
                  kind: 'line' as const,
                  key: rowKey(entry),
                  entry,
                  match: match++,
              }))
            : []
        items.push({ ...item, expanded, lines })
    }
    return items
})

/** 渲染出来的可跳转行数。 */
const lineCount = computed(() =>
    viewItems.value.reduce(
        (total, item) =>
            total + (item.kind === 'line' ? 1 : item.lines.length),
        0
    )
)

/** 渲染中的行（展开的折叠组展开计算），范围选择 / 菜单拷贝按这个顺序。 */
const lineEntries = computed(() =>
    viewItems.value.flatMap((item) =>
        item.kind === 'line'
            ? [item.entry]
            : item.lines.map((line) => line.entry)
    )
)

// ── 虚拟滚动：只渲染视口内的行（可变行高，Fenwick 树维护偏移）──
interface LineRow {
    kind: 'line'
    key: string
    match: number
    entry: Logger.Record
}

interface FoldRow {
    kind: 'fold'
    key: string
    expanded: boolean
    count: number
    time: string
    name: string
}

type Row = LineRow | FoldRow

/** 未测量行高的估算值（= 一行 20px 行高）。 */
const ROW_ESTIMATE = 20
/** 视口上下额外多渲染几行，滚动时不留白。 */
const OVERSCAN = 6

/** 扁平化后的渲染行：折叠组头 +（展开时的）组内行。 */
const rows = computed((): Row[] => {
    const list: Row[] = []
    for (const item of viewItems.value) {
        if (item.kind === 'line') {
            list.push({
                kind: 'line',
                key: item.key,
                match: item.match,
                entry: item.entry,
            })
            continue
        }
        const first = item.items[0]!
        list.push({
            kind: 'fold',
            key: item.key,
            expanded: item.expanded,
            count: item.items.length,
            time: formatTime(first.timestamp),
            name: first.name,
        })
        for (const line of item.lines) {
            list.push({
                kind: 'line',
                key: line.key,
                match: line.match,
                entry: line.entry,
            })
        }
    }
    return list
})

/** 已实测的行高（key → px），rows 重建时保留。 */
const heightsByKey = new Map<string, number>()
/** Fenwick 布局：O(log n) 前缀和 / 点更新。 */
const layout = new VirtualLayout()
/** 布局版本：布局原地变更后驱动 windowRange 重算。 */
const layoutVersion = ref(0)

/** 关闭换行时行内容的最大宽度（粘性最大值），保证横向滚动范围稳定。 */
const maxRowWidth = ref(0)

const scrollTop = ref(0)
const viewportHeight = ref(0)

/** 重建逐行高度与 Fenwick 树（rows 变化时调用）。 */
function rebuildLayout(): void {
    const list = rows.value
    const heights = new Array<number>(list.length)
    for (let i = 0; i < list.length; i++)
        heights[i] = heightsByKey.get(list[i]!.key) ?? ROW_ESTIMATE
    layout.rebuild(heights)
    layoutVersion.value++
}

const windowRange = computed(() => {
    void layoutVersion.value
    return layout.range(scrollTop.value, viewportHeight.value, OVERSCAN)
})

const visibleRows = computed(() =>
    rows.value.slice(windowRange.value.start, windowRange.value.end)
)

const padTop = computed(() => {
    void layoutVersion.value
    return layout.prefix(windowRange.value.start)
})

const padBottom = computed(() => {
    void layoutVersion.value
    return layout.totalHeight - layout.prefix(windowRange.value.end)
})

/** 命中序号 → rows 下标：只在跳转时构建，rows 没变则复用。 */
let matchIndexCache: { rows: Row[]; map: Map<number, number> } | undefined

function rowIndexForMatch(match: number): number | undefined {
    const list = rows.value
    if (matchIndexCache === undefined || matchIndexCache.rows !== list) {
        const map = new Map<number, number>()
        list.forEach((row, index) => {
            if (row.kind === 'line') map.set(row.match, index)
        })
        matchIndexCache = { rows: list, map }
    }
    return matchIndexCache.map.get(match)
}

/** 测量窗口内每行的实际高度，更新布局，并做滚动锚定。 */
function measureRendered(): void {
    const el = scrollEl.value
    if (el === null || el === undefined) return
    const nodes = el.querySelectorAll<HTMLElement>('[data-row-key]')
    if (nodes.length === 0) return
    const anchorIndex = layout.find(el.scrollTop)
    const anchorOffset = layout.prefix(anchorIndex)
    let changed = false
    for (const node of nodes) {
        const key = node.dataset.rowKey
        const index = Number(node.dataset.rowIndex)
        if (key === undefined || !Number.isInteger(index)) continue
        if (index < 0 || index >= layout.length) continue
        const rect = node.getBoundingClientRect()
        if (rect.height <= 0) continue
        if (!wrap.value && rect.width > maxRowWidth.value)
            maxRowWidth.value = rect.width
        const current = layout.height(index)
        if (Math.abs(current - rect.height) < 0.5) continue
        layout.setHeight(index, rect.height)
        heightsByKey.set(key, rect.height)
        changed = true
    }
    if (!changed) return
    layoutVersion.value++
    const delta = layout.prefix(anchorIndex) - anchorOffset
    if (delta === 0 && !follow.value) return
    void nextTick(() => {
        const current = scrollEl.value
        if (current === null || current === undefined) return
        current.scrollTop = follow.value
            ? current.scrollHeight
            : scrollTop.value + delta
        scrollTop.value = current.scrollTop
    })
}

watch(
    rows,
    () => {
        if (heightsByKey.size > rows.value.length) {
            const keys = new Set(rows.value.map((row) => row.key))
            for (const key of heightsByKey.keys()) {
                if (!keys.has(key)) heightsByKey.delete(key)
            }
        }
        rebuildLayout()
    },
    { immediate: true }
)

watch([windowRange, rows], () => measureRendered(), { flush: 'post' })

const menuStyle = computed(() => ({
    left: `${Math.min(menu.value?.x ?? 0, window.innerWidth - 240)}px`,
    top: `${Math.min(
        menu.value?.y ?? 0,
        window.innerHeight - menuItems.value.length * 28 - 16
    )}px`,
}))

interface MenuItem {
    label: string
    disabled: boolean
    action: () => void
}

const menuItems = computed((): MenuItem[] => {
    const selected = lineEntries.value.filter((entry) =>
        rowSelection.value.has(rowKey(entry))
    )
    const hasRows = selected.length > 0
    return [
        {
            label: '复制内容',
            disabled: !hasRows,
            action: () =>
                copy(
                    selected.map((entry) => ansiPlain(entry.content)).join('\n')
                ),
        },
        {
            label: '复制选中文本',
            disabled: (menu.value?.selectionText ?? '') === '',
            action: () => copy(menu.value?.selectionText ?? ''),
        },
        {
            label: '复制整行',
            disabled: !hasRows,
            action: () =>
                copy(
                    selected
                        .map(
                            (entry) =>
                                `${formatTime(entry.timestamp)} ${
                                    LEVEL_META[entry.type].letter
                                } ${entry.name} ${ansiPlain(entry.content)}`
                        )
                        .join('\n')
                ),
        },
        {
            label: '清空视图',
            disabled: false,
            action: () => clearView(),
        },
    ]
})

// ── 滚动模型（JetBrains 控制台同款）：贴底才跟随，上翻即停，回底恢复 ──
watch(
    () => filtered.value.length,
    (length) => {
        const delta = length - prevLength
        prevLength = length
        const el = scrollEl.value
        if (el === null || el === undefined) return
        if (resetCount) {
            // 过滤条件变了：长度差不算「新日志」
            resetCount = false
            newCount.value = 0
        } else if (follow.value) {
            el.scrollTop = el.scrollHeight
            scrollTop.value = el.scrollTop
        } else if (delta > 0) {
            newCount.value += delta
        }
    },
    { flush: 'post' }
)

function onScroll(): void {
    const el = scrollEl.value
    if (el === null || el === undefined) return
    scrollTop.value = el.scrollTop
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32
    if (atBottom !== follow.value) follow.value = atBottom
    if (atBottom && newCount.value > 0) newCount.value = 0
}

function scrollToEnd(): void {
    follow.value = true
    newCount.value = 0
    const el = scrollEl.value
    if (el === null || el === undefined) return
    el.scrollTop = el.scrollHeight
    scrollTop.value = el.scrollTop
}

// ── 命中导航（控制台搜索同款）：Enter / Shift+Enter 在命中行间前后跳转 ──
function navigate(step: 1 | -1): void {
    if (queryFilter.value.highlight === undefined || lineCount.value === 0)
        return
    const next =
        (((cursor.value + step) % lineCount.value) + lineCount.value) %
        lineCount.value
    cursor.value = next
    const rowIndex = rowIndexForMatch(next)
    const el = scrollEl.value
    if (rowIndex === undefined || el === null || el === undefined) return
    const top = layout.prefix(rowIndex)
    const height = layout.height(rowIndex)
    if (top < el.scrollTop || top + height > el.scrollTop + el.clientHeight) {
        el.scrollTop = Math.max(0, top - (el.clientHeight - height) / 2)
        scrollTop.value = el.scrollTop
    }
}

/** 改过滤条件时同步置位 resetCount（长度变化不计为新日志）。 */
function withFilterReset(): void {
    resetCount = true
    cursor.value = 0
}

function toggleCase(): void {
    withFilterReset()
    caseSensitive.value = !caseSensitive.value
}

function toggleWrap(): void {
    wrap.value = !wrap.value
    heightsByKey.clear()
    maxRowWidth.value = 0
    rebuildLayout()
    void nextTick(measureRendered)
}

function toggleFoldEnabled(): void {
    withFilterReset()
    foldEnabled.value = !foldEnabled.value
}

function toggleFold(key: string): void {
    resetCount = true
    const next = new Set(expandedFolds.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedFolds.value = next
}

function clearView(): void {
    const last = entries.value[entries.value.length - 1]
    cleared.value = last
        ? { ts: last.timestamp, id: last.id }
        : { ts: Date.now(), id: Number.MAX_SAFE_INTEGER }
    rowSelection.value = new Set()
    anchorKey.value = null
    withFilterReset()
}

// ── query 输入 / 补全 ───────────────────────────────────────
function onQueryInput(): void {
    withFilterReset()
    suggestOpen.value = true
    suggestIndex.value = 0
}

function onQueryFocus(): void {
    suggestOpen.value = true
    suggestIndex.value = 0
}

function onQueryKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === ' ') {
        event.preventDefault()
        suggestOpen.value = true
        return
    }
    if (suggestOpen.value && suggestions.value.length > 0) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            suggestIndex.value =
                (suggestIndex.value + step + suggestions.value.length) %
                suggestions.value.length
            return
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            acceptSuggestion(
                suggestions.value[suggestIndex.value] ?? suggestions.value[0]!
            )
            return
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            suggestOpen.value = false
            return
        }
    }
    if (event.key === 'Enter') {
        event.preventDefault()
        navigate(event.shiftKey ? -1 : 1)
    }
}

function acceptSuggestion(suggestion: Suggestion): void {
    withFilterReset()
    query.value = applySuggestion(query.value, suggestion)
    suggestOpen.value = false
    suggestIndex.value = 0
}

// ── 行选择 + 右键菜单（多选复制）────────────────────────────
function onRowMouseDown(entry: Logger.Record, event: MouseEvent): void {
    const key = rowKey(entry)
    if (event.metaKey || event.ctrlKey) {
        event.preventDefault()
        const next = new Set(rowSelection.value)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        rowSelection.value = next
        anchorKey.value = key
        return
    }
    if (event.shiftKey) {
        event.preventDefault()
        const keys = lineEntries.value.map(rowKey)
        const anchor =
            anchorKey.value !== null && keys.includes(anchorKey.value)
                ? anchorKey.value
                : keys[0]
        if (anchor === undefined) return
        const from = keys.indexOf(anchor)
        const to = keys.indexOf(key)
        rowSelection.value = new Set(
            keys.slice(Math.min(from, to), Math.max(from, to) + 1)
        )
        return
    }
    if (rowSelection.value.size > 0) rowSelection.value = new Set()
    anchorKey.value = key
}

function onRowContextMenu(entry: Logger.Record, event: MouseEvent): void {
    event.preventDefault()
    const key = rowKey(entry)
    if (!rowSelection.value.has(key)) {
        rowSelection.value = new Set([key])
        anchorKey.value = key
    }
    menu.value = {
        x: event.clientX,
        y: event.clientY,
        selectionText: window.getSelection()?.toString() ?? '',
    }
}

function runMenu(item: MenuItem): void {
    item.action()
    menu.value = null
}

function copy(text: string): void {
    void navigator.clipboard?.writeText(text).catch(() => {})
}

function closeMenu(): void {
    menu.value = null
}

function onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') closeMenu()
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
    window.addEventListener('mousedown', closeMenu)
    window.addEventListener('keydown', onMenuKeydown)
    const el = scrollEl.value
    if (el !== null && el !== undefined) {
        viewportHeight.value = el.clientHeight
        resizeObserver = new ResizeObserver(() => {
            viewportHeight.value = el.clientHeight
        })
        resizeObserver.observe(el)
        if (follow.value) el.scrollTop = el.scrollHeight
        scrollTop.value = el.scrollTop
    }
    void nextTick(measureRendered)
})

onBeforeUnmount(() => {
    window.removeEventListener('mousedown', closeMenu)
    window.removeEventListener('keydown', onMenuKeydown)
    resizeObserver?.disconnect()
})
</script>
