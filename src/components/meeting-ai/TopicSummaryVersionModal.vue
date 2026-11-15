<template>
  <a-modal
    :visible="visible"
    :title="`议题【${topicName}】阶段性总结版本演进与差异追溯`"
    width="900px"
    :footer="null"
    class="topic-version-modal"
    @cancel="handleClose"
  >
    <div class="version-modal-body">
      <a-spin :spinning="loading">
        <div v-if="versions.length === 0" class="empty-versions">
          <a-empty description="暂无历史总结版本记录" />
        </div>

        <div v-else class="version-split-layout">
          <!-- 左侧版本时间轴选择器 -->
          <div class="version-timeline-column">
            <h4 class="column-title">演进版本列表</h4>
            <div class="timeline-items">
              <div
                v-for="ver in versions"
                :key="ver.versionId"
                class="version-card"
                :class="{ active: selectedVersion?.versionId === ver.versionId }"
                @click="selectedVersion = ver"
              >
                <div class="version-top">
                  <a-tag color="blue" class="ver-tag">V{{ ver.versionNumber }}</a-tag>
                  <span class="ver-time">{{ formatTime(ver.createTime) }}</span>
                </div>
                <div class="ver-reason ellipsis" :title="ver.updateReason">
                  {{ ver.updateReason || '常规增量更新' }}
                </div>
                <div class="ver-meta">
                  <span>作者: {{ ver.createdBy || 'AI' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧当前版本详情与演进差异分析 -->
          <div class="version-detail-column" v-if="selectedVersion">
            <!-- 版本概览卡片 -->
            <div class="selected-ver-header">
              <div class="ver-title-row">
                <span class="ver-badge">版本 V{{ selectedVersion.versionNumber }}</span>
                <span class="ver-date">生成于 {{ formatFullTime(selectedVersion.createTime) }}</span>
                <a-tag color="cyan">{{ selectedVersion.status || 'ACTIVE' }}</a-tag>
              </div>
              <p class="ver-reason-desc">
                <strong>演进动因：</strong>{{ selectedVersion.updateReason || '无' }}
              </p>
            </div>

            <!-- 核心三维版本差异对比 (Diff Cards) -->
            <div class="version-diff-section">
              <h4 class="diff-section-title">相对于上一版本的阶段性演进差异</h4>
              <div class="diff-cards-grid">
                <!-- 1. 观点新增 -->
                <div class="diff-card added">
                  <div class="diff-card-head">
                    <span class="diff-icon">➕</span>
                    <span class="diff-name">观点与证据新增 (Added)</span>
                  </div>
                  <div class="diff-card-content">
                    {{ selectedVersion.addedPoints || '本版本无新增观点变化' }}
                  </div>
                </div>

                <!-- 2. 结论修正 -->
                <div class="diff-card modified">
                  <div class="diff-card-head">
                    <span class="diff-icon">🔄</span>
                    <span class="diff-name">结论与认识变化 (Modified)</span>
                  </div>
                  <div class="diff-card-content">
                    {{ selectedVersion.modifiedPoints || '阶段性结论保持稳态，未发生实质修订' }}
                  </div>
                </div>

                <!-- 3. 问题解决 -->
                <div class="diff-card resolved">
                  <div class="diff-card-head">
                    <span class="diff-icon">✅</span>
                    <span class="diff-name">问题排除与解答 (Resolved)</span>
                  </div>
                  <div class="diff-card-content">
                    {{ selectedVersion.resolvedIssues || '尚无已解决的未决问题' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 结构化总结全文 -->
            <div class="version-full-summary">
              <h4 class="summary-section-title">该版本阶段性总结内容</h4>
              <div class="summary-structured-box">
                <div class="summary-block" v-if="selectedVersion.overview">
                  <span class="block-label">【议题概述】</span>
                  <p class="block-text">{{ selectedVersion.overview }}</p>
                </div>
                <div class="summary-block" v-if="selectedVersion.discussionContent">
                  <span class="block-label">【主要讨论重点】</span>
                  <p class="block-text">{{ selectedVersion.discussionContent }}</p>
                </div>
                <div class="summary-block" v-if="selectedVersion.consensus">
                  <span class="block-label">【已形成共识】</span>
                  <p class="block-text">{{ selectedVersion.consensus }}</p>
                </div>
                <div class="summary-block" v-if="selectedVersion.controversies">
                  <span class="block-label">【争议与不同意见】</span>
                  <p class="block-text">{{ selectedVersion.controversies }}</p>
                </div>
                <div class="summary-block" v-if="selectedVersion.interimConclusions">
                  <span class="block-label">【阶段性认识与结论】</span>
                  <p class="block-text highlight-conclusion">{{ selectedVersion.interimConclusions }}</p>
                </div>
                <div class="summary-block" v-if="selectedVersion.openIssues">
                  <span class="block-label">【尚未解决的问题】</span>
                  <p class="block-text open-issues-text">{{ selectedVersion.openIssues }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-spin>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  topicName: {
    type: String,
    default: ''
  },
  versions: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

const selectedVersion = ref(null)

watch(
  () => props.versions,
  (newVersions) => {
    if (newVersions && newVersions.length > 0) {
      selectedVersion.value = newVersions[0]
    } else {
      selectedVersion.value = null
    }
  },
  { immediate: true }
)

function handleClose() {
  emit('update:visible', false)
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function formatFullTime(timeStr) {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString()
}
</script>

<style scoped>
.version-modal-body {
  min-height: 480px;
}

.version-split-layout {
  display: flex;
  gap: 20px;
  height: 520px;
}

.version-timeline-column {
  width: 260px;
  border-right: 1px solid #f0f0f0;
  padding-right: 16px;
  display: flex;
  flex-direction: column;
}

.column-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.timeline-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 6px;
}

.version-card {
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.version-card:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.version-card.active {
  background: #eff6ff;
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
}

.version-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.ver-tag {
  font-weight: 700;
}

.ver-time {
  font-size: 11px;
  color: #9ca3af;
}

.ver-reason {
  font-size: 12.5px;
  color: #1f2937;
  margin-bottom: 4px;
}

.ver-meta {
  font-size: 11px;
  color: #6b7280;
}

.version-detail-column {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selected-ver-header {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
}

.ver-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.ver-badge {
  font-size: 15px;
  font-weight: 700;
  color: #1e40af;
}

.ver-date {
  font-size: 12px;
  color: #64748b;
}

.ver-reason-desc {
  margin: 0;
  font-size: 13px;
  color: #334155;
}

.diff-section-title,
.summary-section-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.diff-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.diff-card {
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
}

.diff-card.added {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.diff-card.modified {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.diff-card.resolved {
  background: #fefce8;
  border-color: #fef08a;
}

.diff-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}

.diff-card.added .diff-card-head {
  color: #166534;
}

.diff-card.modified .diff-card-head {
  color: #1e40af;
}

.diff-card.resolved .diff-card-head {
  color: #854d0e;
}

.diff-card-content {
  font-size: 12.5px;
  line-height: 1.5;
  color: #374151;
}

.summary-structured-box {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-block {
  font-size: 13px;
}

.block-label {
  font-weight: 600;
  color: #1f2937;
  display: block;
  margin-bottom: 2px;
}

.block-text {
  margin: 0;
  color: #4b5563;
  line-height: 1.6;
}

.highlight-conclusion {
  color: #0369a1;
  font-weight: 500;
}

.open-issues-text {
  color: #b45309;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
