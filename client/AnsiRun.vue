<template>
  <template v-if="plain">{{ run.text }}</template>
  <template v-else>
    <template v-for="(segment, index) in segments" :key="index">
      <mark v-if="segment.hit" class="ll-hit" :style="style">{{
        segment.text
      }}</mark>
      <span v-else :style="style">{{ segment.text }}</span>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { highlightSegments } from './ansi'
import type { AnsiRun } from './ansi'

const props = defineProps<{
    run: AnsiRun
    pattern?: RegExp | undefined
}>()

const hasStyle = computed(
    () =>
        props.run.color !== undefined ||
        props.run.bold === true ||
        props.run.italic === true ||
        props.run.underline === true
)

/** 无高亮 pattern 且无 SGR 样式：直接输出纯文本节点，省 DOM。 */
const plain = computed(() => props.pattern === undefined && !hasStyle.value)

const segments = computed(() =>
    props.pattern !== undefined
        ? highlightSegments(props.run.text, props.pattern)
        : [{ text: props.run.text, hit: false }]
)

const style = computed(() => ({
    color: props.run.color,
    fontWeight: props.run.bold === true ? 600 : undefined,
    fontStyle: props.run.italic === true ? 'italic' : undefined,
    textDecoration: props.run.underline === true ? 'underline' : undefined,
}))
</script>
