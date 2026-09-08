<template>
  <k-layout>
    <viewer
      class="ll-layout"
      :logs="store.logs"
      :loaded="store.logs !== undefined"
    />
  </k-layout>
</template>

<script setup lang="ts">
import { store } from '@koishijs/client'
import Viewer from './viewer.vue'
</script>
