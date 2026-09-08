<template>
  <div class="ll-row" :class="rowClass">
    <span class="ll-time">{{ time }}</span>
    <span class="ll-level" :style="{ color: meta.color }">{{ meta.letter }}</span>
    <span class="ll-name" :style="{ color: nameColor(entry.name) }">{{
      entry.name
    }}</span>
    <span class="ll-content" :class="{ 'is-wrap': wrap }">
      <AnsiRun
        v-for="(run, index) in runs"
        :key="index"
        :run="run"
        :pattern="pattern"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Logger } from 'koishi'
import AnsiRun from './AnsiRun.vue'
import { parseAnsi } from './ansi'
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
const runs = computed(() => parseAnsi(props.entry.content))
const rowClass = computed(() => ({
    'is-error': props.entry.type === 'error',
    'is-warn': props.entry.type === 'warn',
    'is-selected': props.selected === true,
    'is-current': props.current === true,
}))
</script>
