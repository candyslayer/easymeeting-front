<template>
  <a-drawer
    :open="open"
    title="决策演进历史全景追踪"
    :width="drawerWidth"
    placement="right"
    @update:open="(val) => emit('update:open', val)"
  >
    <div class="evolution-drawer-content">
      <!-- 顶部信息 -->
      <div class="topic-header-card">
        <div class="topic-meta-row">
          <span class="topic-badge">追踪议题</span>
          <span class="topic-time" v-if="events.length > 0">
            首提于: {{ formatTime(events[events.length - 1]?.eventTime) }}
          </span>
        </div>
        <h4 class="topic-title">{{ topic || currentDecision?.topic || '未命名讨论决策' }}</h4>
        <div class="status-chip-row">
          <span class="meta-label">当前状态:</span>
          <a-tag :color="getStatusColor(currentDecision?.status)">
            {{ getStatusText(currentDecision?.status) }}
          </a-tag>
          <span class="meta-label" v-if="currentDecision?.assigneeName">
            执行人: <strong>{{ currentDecision.assigneeName }}</strong>
          </span>
        </div>
      </div>

      <!-- 演进时间线主体 -->
      <div class="timeline-container">
        <a-spin :spinning="loading">
          <div v-if="events.length === 0" class="empty-events">
            <a-empty description="暂无该决策的演进历史记录" />
          </div>

          <div v-else class="evolution-timeline">
            <div
              v-for="(evt, idx) in sortedEvents"
              :key="evt.id || idx"
              class="timeline-item"
              :class="`type-${evt.eventType?.toLowerCase()}`"
            >
              <!-- 节点左侧图标 & 连接线 -->
              <div class="timeline-axis">
                <div class="axis-icon" :style="{ backgroundColor: getEventIconBg(evt.eventType) }">
                  <component :is="getEventIcon(evt.eventType)" style="color: #fff; font-size: 13px" />
                </div>
                <div v-if="idx < sortedEvents.length - 1" class="axis-line"></div>
              </div>

              <!-- 节点右侧卡片 -->
              <div class="timeline-card">
                <div class="card-top">
                  <div class="event-title-group">
                    <span class="event-type-badge">{{ getEventTypeText(evt.eventType) }}</span>
                    <span class="event-time mono">{{ formatDateTime(evt.eventTime) }}</span>
                  </div>
                  <div class="status-change-badge" v-if="evt.previousStatus && evt.currentStatus && evt.previousStatus !== evt.currentStatus">
                    <span class="st-prev">{{ getStatusText(evt.previousStatus) }}</span>
                    <span class="st-arrow">→</span>
                    <span class="st-curr" :style="{ color: getStatusHexColor(evt.currentStatus) }">
                      {{ getStatusText(evt.currentStatus) }}
                    </span>
                  </div>
                </div>

                <!-- 变更摘要说明 -->
                <p class="change-summary">{{ evt.changeSummary || '讨论过程推进与决策信息更新' }}</p>

                <!-- 演进阶段详细提取 (候选方案、论据与反驳) -->
                <div class="details-collapse" v-if="evt.details">
                  <div class="detail-sec" v-if="evt.details.candidateOptions?.length">
                    <span class="sec-label">💡 讨论候选:</span>
                    <span class="sec-val">{{ formatArray(evt.details.candidateOptions) }}</span>
                  </div>
                  <div class="detail-sec pros" v-if="evt.details.supportReasons?.length">
                    <span class="sec-label">👍 支持立论:</span>
                    <span class="sec-val">{{ formatArray(evt.details.supportReasons) }}</span>
                  </div>
                  <div class="detail-sec cons" v-if="evt.details.opposeReasons?.length">
                    <span class="sec-label">⚠️ 风险/反对:</span>
                    <span class="sec-val">{{ formatArray(evt.details.opposeReasons) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-spin>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { computed } from 'vue'
import {
  BulbOutlined,
  CommentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  BranchesOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  currentDecision: {
    type: Object,
    default: null
  },
  topic: {
    type: String,
    default: ''
  },
  events: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:open'])

const drawerWidth = computed(() => {
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    return '100%'
  }
  return 520
})

// 按时间正序展示演进流程
const sortedEvents = computed(() => {
  if (!props.events || props.events.length === 0) return []
  return [...props.events].map((e) => {
    let details = null
    if (e.detailsJson) {
      try {
        details = typeof e.detailsJson === 'string' ? JSON.parse(e.detailsJson) : e.detailsJson
      } catch (err) {
        details = null
      }
    }
    return { ...e, details }
  }).sort((a, b) => {
    const tA = a.eventTime ? new Date(a.eventTime).getTime() : 0
    const tB = b.eventTime ? new Date(b.eventTime).getTime() : 0
    return tA - tB
  })
})

function formatDateTime(timeVal) {
  if (!timeVal) return '-'
  return dayjs(timeVal).format('HH:mm:ss')
}

function formatTime(timeVal) {
  if (!timeVal) return '-'
  return dayjs(timeVal).format('YYYY-MM-DD HH:mm')
}

function formatArray(arr) {
  if (!arr) return ''
  if (Array.isArray(arr)) return arr.join('； ')
  return String(arr)
}

function getStatusText(status) {
  switch (status) {
    case 'PROPOSED':
    case 'PENDING':
      return '提出方案'
    case 'DISCUSSING':
      return '深入讨论中'
    case 'CONFIRMED':
      return '正式生效'
    case 'DEFERRED':
      return '暂缓决定'
    case 'REJECTED':
      return '已否决'
    case 'CANCELLED':
      return '已取消'
    default:
      return status || '待定'
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'CONFIRMED':
      return 'success'
    case 'DISCUSSING':
      return 'processing'
    case 'PROPOSED':
    case 'PENDING':
      return 'warning'
    case 'DEFERRED':
      return 'purple'
    case 'REJECTED':
      return 'default'
    case 'CANCELLED':
      return 'error'
    default:
      return 'default'
  }
}

function getStatusHexColor(status) {
  switch (status) {
    case 'CONFIRMED':
      return '#52c41a'
    case 'DISCUSSING':
      return '#1677ff'
    case 'PROPOSED':
    case 'PENDING':
      return '#faad14'
    case 'DEFERRED':
      return '#722ed1'
    case 'REJECTED':
      return '#8c8c8c'
    case 'CANCELLED':
      return '#ff4d4f'
    default:
      return '#595959'
  }
}

function getEventTypeText(type) {
  switch (type) {
    case 'CREATED':
      return '提出议题'
    case 'UPDATED':
      return '讨论推进'
    case 'CONFIRMED':
      return '决策定案'
    case 'REJECTED':
      return '方案否决'
    case 'DEFERRED':
      return '暂缓再议'
    case 'CANCELLED':
      return '议题取消'
    default:
      return type || '事件'
  }
}

function getEventIcon(type) {
  switch (type) {
    case 'CREATED':
      return BulbOutlined
    case 'UPDATED':
      return BranchesOutlined
    case 'CONFIRMED':
      return CheckCircleOutlined
    case 'REJECTED':
      return CloseCircleOutlined
    case 'DEFERRED':
      return ClockCircleOutlined
    case 'CANCELLED':
      return StopOutlined
    default:
      return CommentOutlined
  }
}

function getEventIconBg(type) {
  switch (type) {
    case 'CREATED':
      return '#fa8c16'
    case 'UPDATED':
      return '#1677ff'
    case 'CONFIRMED':
      return '#52c41a'
    case 'REJECTED':
      return '#ff4d4f'
    case 'DEFERRED':
      return '#722ed1'
    case 'CANCELLED':
      return '#8c8c8c'
    default:
      return '#1677ff'
  }
}
</script>

<style scoped>
.evolution-drawer-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.topic-header-card {
  background: #f6f8fb;
  border: 1px solid #e1e7f0;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.topic-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topic-badge {
  font-size: 11px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.topic-time {
  font-size: 12px;
  color: #8c8c8c;
}

.topic-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  margin: 0;
  line-height: 1.5;
}

.status-chip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #595959;
}

.meta-label {
  color: #8c8c8c;
}

.timeline-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px 16px 4px;
}

.empty-events {
  padding: 60px 0;
  text-align: center;
}

.evolution-timeline {
  display: flex;
  flex-direction: column;
  gap: 0px;
}

.timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
  min-height: 80px;
}

.timeline-axis {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}

.axis-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  z-index: 2;
}

.axis-line {
  width: 2px;
  flex: 1;
  background: #e5e6eb;
  margin: 4px 0;
}

.timeline-card {
  flex: 1;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.timeline-card:hover {
  border-color: #91caff;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.08);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.event-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-type-badge {
  font-size: 12px;
  font-weight: 600;
  color: #1f2329;
}

.event-time {
  font-size: 11px;
  color: #8c8c8c;
}

.status-change-badge {
  font-size: 11px;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.st-prev {
  color: #8c8c8c;
}

.st-arrow {
  color: #bfbfbf;
}

.st-curr {
  font-weight: 600;
}

.change-summary {
  font-size: 13px;
  color: #333333;
  line-height: 1.5;
  margin: 0;
}

.details-collapse {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.detail-sec {
  display: flex;
  gap: 6px;
  line-height: 1.4;
}

.detail-sec.pros .sec-label {
  color: #389e0d;
}

.detail-sec.cons .sec-label {
  color: #cf1322;
}

.sec-label {
  font-weight: 600;
  flex-shrink: 0;
  color: #595959;
}

.sec-val {
  color: #434343;
  word-break: break-word;
}

@media (max-width: 640px) {
  .timeline-card {
    padding: 10px 12px;
  }
  .card-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
