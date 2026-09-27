<template>
  <div class="ll-row" :class="rowClass">
    <span class="ll-time">{{ time }}</span>
    <span class="ll-main">
      <span class="ll-level" :style="{ color: meta.color }">{{
        meta.letter
      }}</span>
      <span class="ll-name" :style="{ color: nameColor(entry.name) }">{{
        entry.name
      }}</span>
      <span class="ll-content" :class="{ 'is-wrap': wrap }">
        <AnsiText :content="displayContent" :pattern="pattern" />
      </span>
      <!-- 超长日志收起：在内容下方另起一行的展开/收起提示 -->
      <el-button
        v-if="collapse"
        link
        class="ll-more"
        @mousedown.stop
        @click.stop="$emit('toggle')"
      >
        <span class="ll-fold-arrow">{{ collapse.expanded ? '▾' : '▸' }}</span>
        <span>{{
          collapse.expanded ? '收起' : `展开剩余 ${collapse.hidden} 行`
        }}</span>
      </el-button>
    </span>
    <!-- 原版 logger 同款：跳到产生这条日志的插件 -->
    <router-link
      v-if="link !== null"
      class="ll-link"
      :to="link"
      :title="`前往插件：${paths[0]}`"
      @mousedown.stop
      @click.stop
    >
      <k-icon name="arrow-right" />
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Logger } from 'koishi'
import { store } from '@koishijs/client'
import { ElButton } from 'element-plus'
import AnsiText from './AnsiText.vue'
import { formatTime, LEVEL_META, nameColor } from './format'

const props = defineProps<{
    entry: Logger.Record
    wrap: boolean
    pattern?: RegExp | undefined
    current?: boolean
    selected?: boolean
    collapse?: { lines: number; hidden: number; expanded: boolean } | null
}>()

defineEmits<{ toggle: [] }>()

const meta = computed(() => LEVEL_META[props.entry.type] ?? LEVEL_META.info)
const time = computed(() => formatTime(props.entry.timestamp))
const rowClass = computed(() => ({
    'is-error': props.entry.type === 'error',
    'is-warn': props.entry.type === 'warn',
    'is-selected': props.selected === true,
    'is-current': props.current === true,
}))

/** 收起态只渲染前 N 个逻辑行（在 \n 边界截断，不会切断 ANSI 序列）。 */
const displayContent = computed((): string => {
    const collapse = props.collapse
    const content = props.entry.content
    if (!collapse || collapse.expanded) return content
    let index = -1
    for (let line = 0; line < collapse.lines; line++) {
        const next = content.indexOf('\n', index + 1)
        if (next === -1) return content
        index = next
    }
    return content.slice(0, index)
})

/** 服务端写入的 `meta.paths`（产生这条日志的插件路径链）。 */
const paths = computed(
    (): string[] => (props.entry.meta as any)?.paths ?? []
)

/** 原版 logger 同款：有插件路径且 console 已加载 config / packages 时才给箭头。 */
const link = computed((): string | null => {
    const list = paths.value
    const clientStore = store as any
    if (!list.length || !clientStore.config || !clientStore.packages) return null
    return '/plugins/' + list[0].replace(/\./, '/')
})
</script>
