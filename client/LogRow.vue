<template>
  <div class="ll-row" :class="rowClass">
    <!-- 折叠装订线：多行日志在时间戳左侧给一个可点的折叠箭头（IDE 折叠同款） -->
    <span class="ll-gutter">
      <span
        v-if="foldable"
        class="ll-caret"
        :class="{ 'is-open': folded !== true }"
        title="折叠 / 展开"
        @mousedown.stop
        @click.stop="$emit('toggle')"
        >▶</span
      >
    </span>
    <span class="ll-time">{{ time }}</span>
    <span class="ll-main">
      <span class="ll-level" :style="{ color: meta.color }">{{
        meta.letter
      }}</span>
      <span class="ll-name" :style="{ color: nameColor(entry.name) }">{{
        entry.name
      }}</span>
      <span class="ll-content" :class="{ 'is-wrap': wrap }"
        ><AnsiText :content="firstLine" :pattern="pattern" /><button
          v-if="foldable"
          class="ll-ellipsis"
          title="折叠 / 展开"
          @mousedown.stop
          @click.stop="$emit('toggle')"
        >
          … {{ restLines }} 行
        </button><span
          v-if="foldable"
          class="ll-rest"
          :class="{ 'is-folded': folded === true }"
          ><span class="ll-rest-inner"
            ><AnsiText :content="restContent" :pattern="pattern" /></span
        ></span></span>
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
    foldable?: boolean
    folded?: boolean
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

/** 首行（首个 \n 之前）：折叠态也始终显示，作为收起后的一行。 */
const firstLine = computed((): string => {
    const nl = props.entry.content.indexOf('\n')
    return nl === -1 ? props.entry.content : props.entry.content.slice(0, nl)
})

/** 首行之后的内容（折叠时用 grid 行高动画收起的部分）。 */
const restContent = computed((): string => {
    const nl = props.entry.content.indexOf('\n')
    return nl === -1 ? '' : props.entry.content.slice(nl + 1)
})

/** 收起的行数（首行之后），仅给占位文案用。 */
const restLines = computed(
    () => props.entry.content.split('\n').length - 1
)

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
