<template>
  <div class="not-found-page">
    <a-result
      status="404"
      title="404"
      sub-title="抱歉，您访问的会议页面或路径不存在。"
    >
      <template #extra>
        <a-button type="primary" size="large" @click="router.push('/')">
          返回会议首页
        </a-button>
      </template>
    </a-result>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.not-found-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-body);
}
</style>

