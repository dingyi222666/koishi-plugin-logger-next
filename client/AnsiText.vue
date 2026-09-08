<template>
  <span class="ll-ansi" v-html="html"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ansiToHtml, highlightHtml } from './ansi'

const props = defineProps<{
    content: string
    pattern?: RegExp | undefined
}>()

const html = computed(() =>
    highlightHtml(ansiToHtml(props.content), props.pattern)
)
</script>
