<template>
  <div
    ref="trackRef"
    class="replay-progress-bar-container"
    :class="{ 'is-dragging': isDragging }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @touchstart.passive="handleTouchStart"
  >
    <!-- 时间轴底轨 -->
    <div class="progress-track">
      <!-- 议题色块分布层 -->
      <div
        v-for="(topic, idx) in normalizedTopics"
        :key="topic.id || idx"
        class="topic-segment"
        :class="{ active: topic.id === activeTopicId }"
        :style="{
          left: `${topic.leftPercent}%`,
          width: `${topic.widthPercent}%`,
          backgroundColor: getTopicColor(idx)
        }"
        :title="`议题 ${topic.sortOrder || idx + 1}: ${topic.title} (${formatMs(topic.startTimeMs)} - ${formatMs(topic.endTimeMs)})`"
      >
        <span v-if="topic.widthPercent > 5" class="topic-label ellipsis">
          {{ topic.title }}
        </span>
      </div>

      <!-- 播放/拖动进度高亮条 -->
      <div
        class="progress-fill"
        :style="{ width: `${displayPercent}%` }"
      ></div>

      <!-- 播放可拖动游标 Handle -->
      <div
        class="progress-handle"
        :class="{ dragging: isDragging }"
        :style="{ left: `${displayPercent}%` }"
        title="按住鼠标拖动可快速回溯或快进"
      >
        <div class="handle-inner"></div>
      </div>

      <!-- 议题内部事件高亮图钉 Pin -->
      <div
        v-for="evt in normalizedEvents"
        :key="evt.id"
        class="event-pin"
        :class="[getEventClass(evt.eventType), { active: evt.id === activeEventId }]"
        :style="{ left: `${evt.leftPercent}%` }"
        @click.stop="handlePinClick(evt)"
      >
        <a-tooltip placement="top" :mouse-enter-delay="0.1">
          <template #title>
            <div class="event-tooltip">
              <span class="evt-type-tag" :style="{ backgroundColor: getEventTagColor(evt.eventType) }">
                {{ getEventLabel(evt.eventType) }}
              </span>
              <span class="evt-time mono">{{ formatMs(evt.startTimeMs) }}</span>
              <div class="evt-title font-bold">{{ evt.title }}</div>
              <div v-if="evt.speaker" class="evt-speaker">发言人: {{ evt.speaker }}</div>
            </div>
          </template>
          <div class="pin-dot"></div>
        </a-tooltip>
      </div>
    </div>

    <!-- 鼠标悬停 / 拖动时的时间与高能看点预览卡片 (Douyu/Huya 体验) -->
    <div
      v-if="hoverVisible || isDragging"
      class="hover-indicator"
      :style="{ left: `${isDragging ? dragPercent : hoverPercent}%` }"
    >
      <div class="hover-preview-card">
        <!-- 短额视频回放小窗 -->
        <div v-if="isVideoUrl" class="mini-hover-video-box">
          <video
            ref="hoverMiniVideoRef"
            :src="playbackUrl"
            muted
            playsinline
            class="mini-hover-video"
          ></video>
          <div class="mini-video-badge">
            <span class="red-dot"></span>
            <span>短额回放</span>
          </div>
        </div>

        <div class="preview-time mono">
          {{ formatMs(currentHoverTimeMs) }}
        </div>
        <div v-if="hoverTopic" class="preview-topic-title ellipsis">
          <span class="topic-tag">议题 {{ hoverTopic.sortOrder || '' }}</span>
          <span class="topic-name ellipsis">{{ hoverTopic.title }}</span>
        </div>
        <div v-if="hoverEvent" class="preview-event-row ellipsis">
          <span class="preview-evt-badge" :style="{ backgroundColor: getEventTagColor(hoverEvent.eventType) }">
            {{ getEventLabel(hoverEvent.eventType) }}
          </span>
          <span class="preview-evt-text ellipsis">{{ hoverEvent.title }}</span>
        </div>
      </div>
      <div class="hover-pin-arrow"></div>
      <div class="hover-line"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatMs } from '@/utils/format'

const props = defineProps({
  playbackUrl: {
    type: String,
    default: ''
  },
  durationMs: {
    type: Number,
    default: 0
  },
  currentTimeMs: {
    type: Number,
    default: 0
  },
  topics: {
    type: Array,
    default: () => []
  },
  events: {
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
  }
})

const emit = defineEmits(['seek', 'dragging'])

const trackRef = ref(null)
const hoverMiniVideoRef = ref(null)
const isDragging = ref(false)
const dragPercent = ref(0)
const dragTimeMs = ref(0)
const hoverVisible = ref(false)
const hoverPercent = ref(0)
const hoverTimeMs = ref(0)

const isVideoUrl = computed(() => {
  if (!props.playbackUrl) return false
  const url = props.playbackUrl.toLowerCase()
  return (
    url.includes('.m3u8') ||
    url.includes('.mp4') ||
    url.includes('.mkv') ||
    url.includes('.mov')
  )
})

// 有效总时长 (若外部未传递或为 0，尝试从议题或事件中计算最大结束时间)
const safeDurationMs = computed(() => {
  if (props.durationMs && props.durationMs > 0) {
    return props.durationMs
  }
  if (props.topics && props.topics.length > 0) {
    const maxEnd = Math.max(...props.topics.map((t) => t.endTimeMs || 0))
    if (maxEnd > 0) return maxEnd
  }
  if (props.events && props.events.length > 0) {
    const maxEnd = Math.max(...props.events.map((e) => e.startTimeMs || 0))
    if (maxEnd > 0) return maxEnd + 60000
  }
  return 60000 // 兜底 1 分钟
})

const currentHoverTimeMs = computed(() => {
  return isDragging.value ? dragTimeMs.value : hoverTimeMs.value
})

const hoverTopic = computed(() => {
  if (!props.topics || props.topics.length === 0) return null
  const t = currentHoverTimeMs.value
  return props.topics.find((topic) => {
    const start = topic.startTimeMs || 0
    const end = topic.endTimeMs || safeDurationMs.value
    return t >= start && t <= end
  }) || null
})

const hoverEvent = computed(() => {
  if (!props.events || props.events.length === 0) return null
  const t = currentHoverTimeMs.value
  let closest = null
  let minDiff = 15000 // 15秒内最近事件
  props.events.forEach((evt) => {
    const diff = Math.abs((evt.startTimeMs || 0) - t)
    if (diff <= minDiff) {
      minDiff = diff
      closest = evt
    }
  })
  return closest
})

// 当前播放进度百分比 (0 - 100)
const naturalPercent = computed(() => {
  if (safeDurationMs.value <= 0) return 0
  const p = (props.currentTimeMs / safeDurationMs.value) * 100
  return Math.min(100, Math.max(0, p))
})

// 展示的进度百分比（拖拽中优先展示拖动位置）
const displayPercent = computed(() => {
  if (isDragging.value) {
    return dragPercent.value
  }
  return naturalPercent.value
})

// 议题色块分布
const normalizedTopics = computed(() => {
  if (safeDurationMs.value <= 0) return []
  return props.topics.map((t) => {
    const start = Math.max(0, t.startTimeMs || 0)
    const end = Math.min(safeDurationMs.value, t.endTimeMs || safeDurationMs.value)
    const leftPercent = (start / safeDurationMs.value) * 100
    const widthPercent = Math.max(0.6, ((end - start) / safeDurationMs.value) * 100)
    return {
      ...t,
      leftPercent,
      widthPercent
    }
  })
})

// 事件点分布
const normalizedEvents = computed(() => {
  if (safeDurationMs.value <= 0) return []
  return props.events.map((e) => {
    const leftPercent = Math.min(100, Math.max(0, ((e.startTimeMs || 0) / safeDurationMs.value) * 100))
    return {
      ...e,
      leftPercent
    }
  })
})

watch(
  () => currentHoverTimeMs.value,
  (timeMs) => {
    if (hoverVisible.value && hoverMiniVideoRef.value && props.playbackUrl) {
      try {
        const sec = Math.max(0, timeMs / 1000)
        hoverMiniVideoRef.value.currentTime = sec
        hoverMiniVideoRef.value.play().catch(() => {})
      } catch (e) {}
    }
  }
)
const topicColors = [
  'rgba(22, 119, 255, 0.32)',
  'rgba(19, 194, 194, 0.32)',
  'rgba(82, 196, 26, 0.32)',
  'rgba(250, 140, 22, 0.32)',
  'rgba(114, 46, 209, 0.32)',
  'rgba(235, 47, 150, 0.32)'
]

function getTopicColor(index) {
  return topicColors[index % topicColors.length]
}

function getEventClass(type) {
  switch (type) {
    case 'DECISION':
      return 'pin-decision'
    case 'RISK':
      return 'pin-risk'
    case 'TODO':
      return 'pin-todo'
    case 'KEY_POINT':
      return 'pin-keypoint'
    case 'QUESTION':
      return 'pin-question'
    default:
      return 'pin-default'
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
      return '决策'
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

function calculatePercentFromEvent(e) {
  if (!trackRef.value) return 0
  const rect = trackRef.value.getBoundingClientRect()
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches?.[0]?.clientX || 0)
  const offsetX = clientX - rect.left
  const percent = Math.min(100, Math.max(0, (offsetX / rect.width) * 100))
  return percent
}

// 鼠标悬停
function handleMouseMove(e) {
  if (isDragging.value) return
  const percent = calculatePercentFromEvent(e)
  hoverPercent.value = percent
  hoverTimeMs.value = Math.round((percent / 100) * safeDurationMs.value)
  hoverVisible.value = true
}

function handleMouseLeave() {
  if (!isDragging.value) {
    hoverVisible.value = false
  }
}

// 鼠标按下：开始拖动或定位
function handleMouseDown(e) {
  if (e.button !== 0) return // 仅响应鼠标左键
  e.preventDefault()
  startDrag(e)
}

function handleTouchStart(e) {
  startDrag(e)
}

function startDrag(e) {
  isDragging.value = true
  const percent = calculatePercentFromEvent(e)
  dragPercent.value = percent
  dragTimeMs.value = Math.round((percent / 100) * safeDurationMs.value)
  emit('dragging', dragTimeMs.value)

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
  window.addEventListener('touchmove', onGlobalTouchMove)
  window.addEventListener('touchend', onGlobalTouchEnd)
}

function onGlobalMouseMove(e) {
  if (!isDragging.value) return
  const percent = calculatePercentFromEvent(e)
  dragPercent.value = percent
  dragTimeMs.value = Math.round((percent / 100) * safeDurationMs.value)
  emit('dragging', dragTimeMs.value)
}

function onGlobalTouchMove(e) {
  if (!isDragging.value) return
  const percent = calculatePercentFromEvent(e)
  dragPercent.value = percent
  dragTimeMs.value = Math.round((percent / 100) * safeDurationMs.value)
  emit('dragging', dragTimeMs.value)
}

function onGlobalMouseUp(e) {
  if (!isDragging.value) return
  stopDrag()
}

function onGlobalTouchEnd(e) {
  if (!isDragging.value) return
  stopDrag()
}

function stopDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
  window.removeEventListener('touchmove', onGlobalTouchMove)
  window.removeEventListener('touchend', onGlobalTouchEnd)

  // 释放时触发最终 Seek 跳转
  emit('seek', dragTimeMs.value)
}

function handlePinClick(evt) {
  emit('seek', evt.startTimeMs)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
  window.removeEventListener('touchmove', onGlobalTouchMove)
  window.removeEventListener('touchend', onGlobalTouchEnd)
})
</script>

<style scoped>
.replay-progress-bar-container {
  position: relative;
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 8px 0;
}

.replay-progress-bar-container.is-dragging {
  cursor: grabbing;
}

.progress-track {
  position: relative;
  width: 100%;
  height: 14px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 7px;
  overflow: visible;
  backdrop-filter: blur(6px);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: height 0.15s ease;
}

.replay-progress-bar-container:hover .progress-track,
.replay-progress-bar-container.is-dragging .progress-track {
  height: 16px;
}

/* 议题色块分布 */
.topic-segment {
  position: absolute;
  top: 0;
  height: 100%;
  border-right: 1.5px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: background-color 0.2s;
  pointer-events: none;
}

.topic-segment.active {
  box-shadow: 0 0 10px rgba(22, 119, 255, 0.9);
  border-top: 1.5px solid #1677ff;
  border-bottom: 1.5px solid #1677ff;
}

.topic-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
  padding: 0 4px;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

/* 播放进度填色 */
.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #1677ff, #4096ff);
  border-radius: 7px;
  pointer-events: none;
  opacity: 0.9;
}

/* 播放游标 Handle (支持拖拽) */
.progress-handle {
  position: absolute;
  top: 50%;
  width: 18px;
  height: 18px;
  background: #ffffff;
  border: 2.5px solid #1677ff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: transform 0.1s, box-shadow 0.1s;
  cursor: grab;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.handle-inner {
  width: 6px;
  height: 6px;
  background: #1677ff;
  border-radius: 50%;
}

.progress-handle:hover,
.progress-handle.dragging {
  transform: translate(-50%, -50%) scale(1.3);
  box-shadow: 0 0 12px rgba(22, 119, 255, 0.8);
  cursor: grabbing;
}

/* 事件标记图钉 */
.event-pin {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 7;
  cursor: pointer;
  padding: 4px;
}

.pin-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s, box-shadow 0.2s;
}

.event-pin:hover .pin-dot,
.event-pin.active .pin-dot {
  transform: scale(1.6);
  box-shadow: 0 0 8px currentColor;
}

.pin-decision .pin-dot {
  background-color: #52c41a;
}
.pin-risk .pin-dot {
  background-color: #ff4d4f;
}
.pin-todo .pin-dot {
  background-color: #fa8c16;
}
.pin-keypoint .pin-dot {
  background-color: #1677ff;
}
.pin-question .pin-dot {
  background-color: #722ed1;
}
.pin-default .pin-dot {
  background-color: #8c8c8c;
}

/* 悬停/拖拽时间指示器 (放映厅浮动高能卡片) */
.hover-indicator {
  position: absolute;
  bottom: 28px;
  transform: translateX(-50%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 20;
}

.hover-preview-card {
  background: rgba(13, 17, 23, 0.95);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border-radius: 6px;
  padding: 6px 10px;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(88, 166, 255, 0.35);
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 140px;
  max-width: 260px;
}

.mini-hover-video-box {
  position: relative;
  width: 100%;
  height: 90px;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.mini-hover-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-video-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 77, 79, 0.5);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 9px;
  color: #ff7875;
  display: flex;
  align-items: center;
  gap: 3px;
}

.red-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ff4d4f;
}

.preview-time {
  font-size: 12px;
  font-weight: 700;
  color: #58a6ff;
}

.preview-topic-title {
  font-size: 11px;
  color: #e6edf3;
  display: flex;
  align-items: center;
  gap: 4px;
}

.topic-tag {
  background: #1f6feb;
  color: #fff;
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
}

.preview-event-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #ff7875;
}

.preview-evt-badge {
  color: #ffffff;
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
}

.preview-evt-text {
  flex: 1;
}

.hover-pin-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid rgba(13, 17, 23, 0.95);
}

.hover-line {
  width: 1.5px;
  height: 28px;
  background: #58a6ff;
  box-shadow: 0 0 4px #58a6ff;
}

/* Tooltip 弹窗内容 */
.event-tooltip {
  max-width: 240px;
  font-size: 12px;
}
.evt-type-tag {
  display: inline-block;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  margin-right: 6px;
}
.evt-time {
  color: #bae0ff;
  font-size: 11px;
}
.evt-title {
  margin-top: 4px;
  color: #ffffff;
}
.evt-speaker {
  margin-top: 2px;
  font-size: 11px;
  color: #d9d9d9;
}
</style>
