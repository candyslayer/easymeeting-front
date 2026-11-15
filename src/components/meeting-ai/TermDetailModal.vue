<template>
  <a-modal
    :visible="visible"
    :title="null"
    :footer="null"
    width="680px"
    class="term-detail-modal"
    @cancel="handleClose"
  >
    <div v-if="term" class="term-modal-content">
      <!-- 头部：术语名称与领域标识 -->
      <div class="term-header">
        <div class="title-row">
          <h2 class="term-title">{{ term.surface || term.termText || term.canonicalName || '专业术语' }}</h2>
          <a-tag v-if="term.detectedDomain || term.domain" color="blue" class="domain-tag">
            {{ term.detectedDomain || term.domain }}
          </a-tag>
          <a-tag v-if="term.standardName && term.standardName !== term.surface" color="purple">
            标准名: {{ term.standardName }}
          </a-tag>
          <a-tag v-if="term.ambiguityStatus === 'CONFLICT_DUAL'" color="orange">
            存在口径冲突
          </a-tag>
        </div>
        <div v-if="term.standardEn" class="term-en mono">
          {{ term.standardEn }}
        </div>
      </div>

      <!-- 三层专业释义卡片 -->
      <div class="explanation-layers">
        <!-- 第 1 层：通俗释义 -->
        <div class="layer-card layer-layman">
          <div class="layer-title">
            <span class="layer-badge layman-badge">1</span>
            <span class="layer-name">通俗易懂解释（非技术人员视角）</span>
          </div>
          <p class="layer-text">
            {{ term.laymanExplanation || term.explanation || '暂无通俗释义' }}
          </p>
        </div>

        <!-- 第 2 层：行业标准与专业定义 -->
        <div class="layer-card layer-technical">
          <div class="layer-title">
            <span class="layer-badge tech-badge">2</span>
            <span class="layer-name">行业专业定义与技术规范</span>
          </div>
          <p class="layer-text">
            {{ term.technicalDefinition || term.standardDefinition || '暂无专业规范定义' }}
          </p>
        </div>

        <!-- 第 3 层：企业内部口径对比 -->
        <div class="layer-card layer-enterprise" :class="{ conflict: term.ambiguityStatus === 'CONFLICT_DUAL' }">
          <div class="layer-title">
            <span class="layer-badge ent-badge">3</span>
            <span class="layer-name">企业内部口径与业务标准对比</span>
          </div>
          <div v-if="term.enterpriseDefinition" class="layer-text">
            <p>{{ term.enterpriseDefinition }}</p>
            <div v-if="term.conflictDetails" class="conflict-alert">
              <span class="alert-icon">⚠️</span>
              <span><strong>统计口径差异提示：</strong>{{ term.conflictDetails }}</span>
            </div>
          </div>
          <p v-else class="layer-text text-muted">
            当前术语与通用行业定义一致，暂无特殊企业定制口径。
          </p>
        </div>
      </div>

      <!-- 会议上下文与证据溯源 -->
      <div v-if="term.contextSnippet || (term.evidence && term.evidence.length > 0)" class="term-context-section">
        <h4 class="section-title">会中原始发言与证据上下文</h4>
        <div class="context-quote">
          <p>{{ term.contextSnippet || term.evidence?.[0]?.quoteText }}</p>
          <div class="quote-meta" v-if="term.speakerName || term.startTimeMs">
            <span v-if="term.speakerName">发言人: <strong>{{ term.speakerName }}</strong></span>
            <span v-if="term.startTimeMs" class="mono">时间: {{ formatMs(term.startTimeMs) }}</span>
            <a-button
              v-if="term.startTimeMs"
              type="link"
              size="small"
              class="jump-seek-btn"
              @click="handleSeek(term.startTimeMs)"
            >
              定位播放
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  term: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'seek-audio'])

function handleClose() {
  emit('update:visible', false)
}

function handleSeek(startTimeMs) {
  emit('seek-audio', startTimeMs)
  handleClose()
}

function formatMs(ms) {
  if (!ms) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
</script>

<style scoped>
.term-modal-content {
  padding: 8px 0;
}

.term-header {
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 14px;
  margin-bottom: 16px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.term-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.term-en {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.explanation-layers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layer-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  background: #f9fafb;
}

.layer-layman {
  border-left: 4px solid #10b981;
}

.layer-technical {
  border-left: 4px solid #3b82f6;
}

.layer-enterprise {
  border-left: 4px solid #8b5cf6;
}

.layer-enterprise.conflict {
  border-left: 4px solid #f59e0b;
  background: #fffbeb;
}

.layer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.layer-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}

.layman-badge {
  background: #10b981;
}

.tech-badge {
  background: #3b82f6;
}

.ent-badge {
  background: #8b5cf6;
}

.layer-name {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.layer-text {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: #1f2937;
}

.text-muted {
  color: #9ca3af;
  font-style: italic;
}

.conflict-alert {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef3c7;
  border-radius: 6px;
  font-size: 12.5px;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 6px;
}

.term-context-section {
  margin-top: 18px;
  border-top: 1px solid #f0f0f0;
  padding-top: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #374151;
}

.context-quote {
  background: #f3f4f6;
  border-left: 3px solid #6b7280;
  padding: 10px 14px;
  border-radius: 0 6px 6px 0;
  font-size: 13px;
  color: #374151;
}

.quote-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
