<template>
  <div class="ll-row" :class="rowClass">
    <span class="ll-time">{{ time }}</span>
    <span class="ll-level" :style="{ color: meta.color }">{{ meta.letter }}</span>
    <span class="ll-name" :style="{ color: nameColor(entry.name) }">{{
      entry.name
    }}</span>
    <span class="ll-content" :class="{ 'is-wrap': wrap }">
      <AnsiText :content="entry.content" :pattern="pattern" />
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
import AnsiText from './AnsiText.vue'
import { formatTime, LEVEL_META, nameColor } from './format'

const props = defineProps<{
    entry: Logger.Record
    wrap: boolean
    pattern?: RegExp | undefined
    current?: boolean
    selected?: boolean
}>()

const meta = computed(() => LEVEL_META[props.entry.type] ?? LEVEL_META.info)
const time = computed(() => formatTime(props.entry.timestamp))
const rowClass = computed(() => ({
    'is-error': props.entry.type === 'error',
    'is-warn': props.entry.type === 'warn',
    'is-selected': props.selected === true,
    'is-current': props.current === true,
}))

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
