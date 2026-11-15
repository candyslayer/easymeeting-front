<template>
  <div class="replay-timeline-panel">
    <!-- 头部工具栏 -->
    <div class="timeline-header">
      <div class="header-left">
        <h3 class="panel-title">
          <OrderedListOutlined style="color: #1677ff" /> 会议议题时间轴
        </h3>
        <span class="topic-count-pill">共 {{ topics.length }} 个议题</span>
      </div>

      <div class="header-right">
        <a-button
          type="primary"
          ghost
          size="small"
          :loading="isAnalyzing"
          @click="$emit('reanalyze')"
        >
          <RobotOutlined /> 重新提炼
        </a-button>
      </div>
    </div>

    <!-- 议题列表主体 -->
    <div class="timeline-body" ref="timelineBodyRef">
      <!-- 空状态 -->
      <div v-if="topics.length === 0" class="empty-box">
        <a-empty description="暂未生成结构化议题时间轴">
          <template #extra>
            <p class="empty-hint">
              系统将结合语义边界与参会发言，通过 AI Agent 自动切分议题并提取关键决策、风险与待办。
            </p>
            <a-button
              type="primary"
              :loading="isAnalyzing"
              @click="$emit('reanalyze')"
            >
              <RobotOutlined /> 启动 AI 议题切分与分析
            </a-button>
          </template>
        </a-empty>
      </div>

      <!-- 议题时间轴列表 -->
      <div v-else class="topic-timeline-list">
        <div
          v-for="(topic, idx) in topics"
          :key="topic.id || idx"
          :id="`topic-card-${topic.id}`"
          class="topic-card"
          :class="{ 'is-active': topic.id === activeTopicId }"
        >
          <!-- 议题头部：时间区间 + 标题 + 状态标识 -->
          <div class="topic-card-head">
            <div class="topic-time-badge mono" @click="handleJump(topic.startTimeMs)">
              <CaretRightOutlined class="play-icon" />
              <span>{{ formatMs(topic.startTimeMs) }} - {{ formatMs(topic.endTimeMs) }}</span>
            </div>

            <div class="topic-title-wrap">
              <span class="topic-index">#{{ topic.sortOrder || idx + 1 }}</span>
              <h4 class="topic-title" :title="topic.title">{{ topic.title }}</h4>
            </div>

            <div class="topic-actions">
              <a-tag v-if="topic.source === 'MANUAL_ADJUST'" color="orange" size="small">
                人工微调
              </a-tag>
              <a-tag v-else color="blue" size="small">
                AI 识别
              </a-tag>

              <a-button
                type="text"
                size="small"
                class="edit-btn"
                @click="$emit('edit-topic', topic)"
                title="调整时间轴与摘要"
              >
                <EditOutlined />
              </a-button>
            </div>
          </div>

          <!-- 议题摘要 -->
          <div class="topic-summary-box">
            <p class="summary-text">{{ topic.summary || '暂无议题摘要' }}</p>
          </div>

          <!-- 内部事件列表 (决策、风险、待办、观点、问题) -->
          <div v-if="topic.events && topic.events.length > 0" class="topic-events-section">
            <div class="events-label">议题内部关键事件:</div>
            <div class="events-list">
              <div
                v-for="evt in topic.events"
                :key="evt.id"
                class="event-item"
                :class="[getEventClass(evt.eventType), { 'is-active-event': evt.id === activeEventId }]"
                @click="handleJump(evt.startTimeMs)"
              >
                <!-- 事件类型标识与时间戳 -->
                <div class="event-item-top">
                  <span class="event-tag" :style="{ backgroundColor: getEventTagColor(evt.eventType) }">
                    <component :is="getEventIcon(evt.eventType)" />
                    {{ getEventLabel(evt.eventType) }}
                  </span>
                  <span class="event-time mono">{{ formatMs(evt.startTimeMs) }}</span>
                  <span v-if="evt.speaker" class="event-speaker">发言人: {{ evt.speaker }}</span>
                </div>

                <!-- 事件内容 -->
                <div class="event-content">
                  <strong v-if="evt.title" class="event-title">{{ evt.title }}: </strong>
                  <span>{{ evt.content }}</span>
                </div>

                <!-- 证据溯源展示 (若存在) -->
                <div v-if="evt.evidence" class="event-evidence">
                  <span class="evidence-quote-mark">“</span>
                  <span class="evidence-text">{{ evt.evidence }}</span>
                  <span class="evidence-quote-mark">”</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 证据溯源与转写引用 -->
          <div v-if="topic.segmentIds && topic.segmentIds.length > 0" class="topic-evidence-footer">
            <span class="footer-label">原始转写片段:</span>
            <div class="segment-tags-wrap">
              <span
                v-for="segId in topic.segmentIds"
                :key="segId"
                class="segment-badge"
              >
                #{{ segId }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import {
  OrderedListOutlined,
  RobotOutlined,
  CaretRightOutlined,
  EditOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import { formatMs } from '@/utils/format'

const props = defineProps({
  topics: {
    type: Array,
    default: () => []
  },
  activeTopicId: {
    type: [String, Number],
    default: null
  },
  activeEventId: {
    type: [String, Number],
    default: null
  },
  currentTimeMs: {
    type: Number,
    default: 0
  },
  isAnalyzing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['seek', 'edit-topic', 'reanalyze'])

const timelineBodyRef = ref(null)

// 监听活动议题切换，自动温和滚动对应卡片入屏
watch(
  () => props.activeTopicId,
  (newId) => {
    if (!newId) return
    nextTick(() => {
      const el = document.getElementById(`topic-card-${newId}`)
      if (el && timelineBodyRef.value) {
        const container = timelineBodyRef.value
        const elTop = el.offsetTop - container.offsetTop
        const elBottom = elTop + el.offsetHeight
        const viewTop = container.scrollTop
        const viewBottom = viewTop + container.offsetHeight

        if (elTop < viewTop || elBottom > viewBottom) {
          container.scrollTo({
            top: Math.max(0, elTop - 40),
            behavior: 'smooth'
          })
        }
      }
    })
  }
)

function handleJump(ms) {
  if (ms == null || isNaN(ms)) return
  emit('seek', ms)
}

function getEventClass(type) {
  switch (type) {
    case 'DECISION':
      return 'evt-decision'
    case 'RISK':
      return 'evt-risk'
    case 'TODO':
      return 'evt-todo'
    case 'KEY_POINT':
      return 'evt-keypoint'
    case 'QUESTION':
      return 'evt-question'
    default:
      return 'evt-default'
  }
}

function getEventTagColor(type) {
  switch (type) {
    case 'DECISION':
      return '#52c41a'
    case 'RISK':
      return '#ff4d4f'
    case 'TODO':
      return '#fa8c16'
    case 'KEY_POINT':
      return '#1677ff'
    case 'QUESTION':
      return '#722ed1'
    default:
      return '#1677ff'
  }
}

function getEventLabel(type) {
  switch (type) {
    case 'DECISION':
      return '决议'
    case 'RISK':
      return '风险'
    case 'TODO':
      return '待办'
    case 'KEY_POINT':
      return '关键观点'
    case 'QUESTION':
      return '待解决'
    default:
      return '事件'
  }
}

function getEventIcon(type) {
  switch (type) {
    case 'DECISION':
      return CheckCircleOutlined
    case 'RISK':
      return WarningOutlined
    case 'TODO':
      return ClockCircleOutlined
    case 'KEY_POINT':
      return MessageOutlined
    case 'QUESTION':
      return QuestionCircleOutlined
    default:
      return MessageOutlined
  }
}
</script>

<style scoped>
.replay-timeline-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-card, 8px);
  overflow: hidden;
  border: 1px solid #f0f0f0;
}

.timeline-header {
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  display: flex;
  align-items: center;
  gap: 6px;
}

.topic-count-pill {
  font-size: 12px;
  background: #e6f4ff;
  color: #1677ff;
  padding: 1px 8px;
  border-radius: 10px;
}

.timeline-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-box {
  padding: 40px 16px;
  text-align: center;
}

.empty-hint {
  font-size: 13px;
  color: #8c8c8c;
  margin-top: 8px;
  margin-bottom: 16px;
  max-width: 320px;
}

/* 议题卡片 */
.topic-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.topic-card {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
  background: #ffffff;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.topic-card:hover {
  border-color: #91caff;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.08);
}

.topic-card.is-active {
  border-color: #1677ff;
  background: #f8fbff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}

.topic-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.topic-time-badge {
  background: #1677ff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.topic-time-badge:hover {
  background: #0958d9;
}

.play-icon {
  font-size: 11px;
}

.topic-title-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.topic-index {
  color: #8c8c8c;
  font-size: 12px;
  font-weight: 600;
}

.topic-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topic-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-btn {
  color: #8c8c8c;
}
.edit-btn:hover {
  color: #1677ff;
}

/* 议题摘要 */
.topic-summary-box {
  margin-bottom: 10px;
}

.summary-text {
  font-size: 13px;
  color: #595959;
  line-height: 1.6;
  margin: 0;
}

/* 议题内部事件 */
.topic-events-section {
  border-top: 1px dashed #e8e8e8;
  padding-top: 10px;
  margin-top: 10px;
}

.events-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  font-weight: 500;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-item {
  border-radius: 6px;
  padding: 8px 10px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.event-item:hover {
  background: #f0f5ff;
  border-color: #d6e4ff;
}

.event-item.is-active-event {
  border-color: #1677ff;
  background: #e6f4ff;
  box-shadow: 0 0 6px rgba(22, 119, 255, 0.2);
}

.event-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.event-tag {
  color: #ffffff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.event-time {
  font-size: 11px;
  color: #1677ff;
  font-weight: 600;
}

.event-speaker {
  font-size: 11px;
  color: #8c8c8c;
  margin-left: auto;
}

.event-content {
  font-size: 12px;
  color: #262626;
  line-height: 1.5;
}

.event-title {
  color: #1f1f1f;
}

.event-evidence {
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.02);
  border-left: 2px solid #d9d9d9;
  border-radius: 2px;
  font-size: 11px;
  color: #595959;
}

.evidence-quote-mark {
  color: #bfbfbf;
  font-family: serif;
  font-size: 14px;
}

.evidence-text {
  font-style: italic;
}

/* 底部片段 */
.topic-evidence-footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #8c8c8c;
}

.footer-label {
  white-space: nowrap;
}

.segment-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.segment-badge {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 10px;
  color: #595959;
}
</style>
