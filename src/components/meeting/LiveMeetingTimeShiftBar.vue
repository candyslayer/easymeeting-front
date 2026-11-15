<template>
  <div
    class="live-timeshift-bar-container"
    :class="{ 'is-rewound': isRewound, 'is-dragging': isDragging }"
  >
    <!-- 左侧控制区：快退按钮 + 时间显示 -->
    <div class="timeshift-left-controls">
      <button
        type="button"
        class="shift-btn text-btn"
        title="快速回溯 30 秒前的讨论"
        @click="seekRelative(-30)"
      >
        <span>-30s</span>
      </button>

      <button
        type="button"
        class="shift-btn text-btn"
        title="快速回溯 10 秒前"
        @click="seekRelative(-10)"
      >
        <span>-10s</span>
      </button>

      <div class="time-display mono">
        <span class="time-cur" :class="{ 'c-warn': isRewound }">
          {{ formatMs(isRewound ? displayTimeMs : durationMs) }}
        </span>
        <span class="time-sep">/</span>
        <span class="time-total">{{ formatMs(durationMs) }}</span>
      </div>
    </div>

    <!-- 中间：核心可拖拽高能时间轴进度条 -->
    <div
      ref="trackRef"
      class="timeshift-track-wrapper"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @touchstart.passive="handleTouchStart"
    >
      <div class="track-bg">
        <!-- 议题色块分布 -->
        <div
          v-for="(topic, idx) in normalizedTopics"
          :key="topic.id || idx"
          class="topic-chunk"
          :style="{
            left: `${topic.leftPercent}%`,
            width: `${topic.widthPercent}%`,
            backgroundColor: getTopicColor(idx)
          }"
          :title="`议题: ${topic.title} (${formatMs(topic.startTimeMs)} - ${formatMs(topic.endTimeMs)})`"
        >
          <span v-if="topic.widthPercent > 6" class="chunk-label ellipsis">
            {{ topic.title }}
          </span>
        </div>

        <!-- 播放/回溯已走过的进度条 -->
        <div
          class="track-fill"
          :class="{ 'rewound-fill': isRewound }"
          :style="{ width: `${displayPercent}%` }"
        ></div>

        <!-- 实时推流端点提示指示器 (最右侧实时红点) -->
        <div class="track-live-edge" title="实时最新进度"></div>

        <!-- 可拖拽游标 Handle -->
        <div
          class="track-handle"
          :class="{ dragging: isDragging, rewound: isRewound }"
          :style="{ left: `${displayPercent}%` }"
          title="按住鼠标拖拽可任意回溯会中画面"
        >
          <div class="handle-core"></div>
        </div>

        <!-- 高能事件图钉 (决策、风险、待办、共识) -->
        <div
          v-for="evt in normalizedEvents"
          :key="evt.id"
          class="event-pin"
          :class="`pin-${evt.eventType?.toLowerCase()}`"
          :style="{ left: `${evt.leftPercent}%` }"
          @click.stop="seekToMs(evt.startTimeMs)"
        >
          <a-tooltip placement="top" :mouse-enter-delay="0.1">
            <template #title>
              <div class="event-pin-tooltip">
                <span class="evt-tag" :style="{ backgroundColor: getEventTagColor(evt.eventType) }">
                  {{ getEventLabel(evt.eventType) }}
                </span>
                <span class="evt-time mono">{{ formatMs(evt.startTimeMs) }}</span>
                <div class="evt-title font-bold">{{ evt.title || evt.content }}</div>
              </div>
            </template>
            <div class="pin-dot"></div>
          </a-tooltip>
        </div>
      </div>

      <!-- 鼠标悬停 / 拖动时的「短额回放播放」浮动预览小窗 -->
      <div
        v-if="hoverVisible || isDragging"
        class="hover-preview-indicator"
        :style="{ left: `${isDragging ? dragPercent : hoverPercent}%` }"
      >
        <div class="hover-preview-card">
          <!-- 核心：短额回放微型视频播放视窗 -->
          <div class="mini-screen-box">
            <canvas ref="hoverCanvasRef" width="200" height="112" class="mini-canvas"></canvas>
            
            <div class="mini-live-tag">
              <span class="red-pulse-dot"></span>
              <span>短额回放</span>
            </div>

            <div class="mini-time-tag mono">
              {{ formatMs(currentHoverTimeMs) }}
            </div>
          </div>

          <!-- 画面附带的实时情报：发言人与字幕 -->
          <div class="hover-info-body">
            <div v-if="hoverSpeaker || hoverSubtitle" class="hover-subtitle-row">
              <span v-if="hoverSpeaker" class="hover-speaker-name">{{ hoverSpeaker }}:</span>
              <span class="hover-subtitle-text ellipsis">{{ hoverSubtitle || '（会中研讨中）' }}</span>
            </div>

            <div v-if="hoverTopic" class="hover-topic-row ellipsis">
              <span class="topic-tag-pill">议题</span>
              <span class="ellipsis">{{ hoverTopic.title }}</span>
            </div>

            <div v-if="hoverEvent" class="hover-event-row ellipsis">
              <span class="evt-badge" :style="{ backgroundColor: getEventTagColor(hoverEvent.eventType) }">
                {{ getEventLabel(hoverEvent.eventType) }}
              </span>
              <span class="ellipsis">{{ hoverEvent.title }}</span>
            </div>
          </div>
        </div>

        <div class="hover-arrow"></div>
        <div class="hover-vertical-line"></div>
      </div>
    </div>

    <!-- 右侧状态与操作区：实时 LIVE / 一键返回实时 -->
    <div class="timeshift-right-controls">
      <!-- 若处于回溯状态，展示醒目的「返回实时直播」按钮 -->
      <button
        v-if="isRewound"
        type="button"
        class="return-live-btn"
        title="点击立即退出回溯，返回最新实时画面"
        @click="returnToLive"
      >
        <span class="live-dot pulse"></span>
        <span class="btn-text">返回实时 (LIVE)</span>
      </button>

      <!-- 若处于正常实时直播状态，展示绿色实时信标 -->
      <div v-else class="live-status-chip" title="当前为主播/参会人实时画面">
        <span class="live-dot green-pulse"></span>
        <span class="mono">实时 LIVE</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatMs } from '@/utils/format'

const props = defineProps({
  // 会议持续时长毫秒
  durationMs: {
    type: Number,
    default: 0
  },
  // 当前回溯播放毫秒（若未回溯则等于 durationMs）
  currentTimeMs: {
    type: Number,
    default: 0
  },
  // 是否正处于时移回溯状态
  isRewound: {
    type: Boolean,
    default: false
  },
  // 议题列表
  topics: {
    type: Array,
    default: () => []
  },
  // 关键事件列表
  events: {
    type: Array,
    default: () => []
  },
  // 实时逐字稿记录
  segments: {
    type: Array,
    default: () => []
  },
  // 当前主画面的视频流 MediaStream
  activeStream: {
    type: Object,
    default: null
  },
  // 当前主讲人信息
  spotlightMember: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['seek', 'return-to-live', 'dragging'])

const trackRef = ref(null)
const hoverCanvasRef = ref(null)

const isDragging = ref(false)
const dragPercent = ref(0)
const dragTimeMs = ref(0)

const hoverVisible = ref(false)
const hoverPercent = ref(0)
const hoverTimeMs = ref(0)

// 缓存的历史帧环形缓冲区，用于提供鼠标悬停时的短额回放播放
// 每个条目：{ timeMs, canvas, dataUrl, speaker, content }
const frameRingBuffer = ref([])
let frameSampleTimer = null
let animationLoopTimer = null
let sampleVideoEl = null

// 有效总时长（保底 30 秒）
const safeDurationMs = computed(() => {
  return Math.max(30000, props.durationMs || 0)
})

// 展示的时间毫秒
const displayTimeMs = computed(() => {
  if (isDragging.value) {
    return dragTimeMs.value
  }
  return props.currentTimeMs || props.durationMs || 0
})

// 当前播放/回溯百分比 (0 - 100)
const displayPercent = computed(() => {
  if (safeDurationMs.value <= 0) return 100
  if (isDragging.value) return dragPercent.value
  if (!props.isRewound) return 100
  const p = (props.currentTimeMs / safeDurationMs.value) * 100
  return Math.min(100, Math.max(0, p))
})

// 悬停所在时间
const currentHoverTimeMs = computed(() => {
  return isDragging.value ? dragTimeMs.value : hoverTimeMs.value
})

// 归一化议题色块
const normalizedTopics = computed(() => {
  if (safeDurationMs.value <= 0) return []
  return props.topics.map((t) => {
    const start = Math.max(0, t.startTimeMs || 0)
    const end = Math.min(safeDurationMs.value, t.endTimeMs || safeDurationMs.value)
    const leftPercent = (start / safeDurationMs.value) * 100
    const widthPercent = Math.max(1, ((end - start) / safeDurationMs.value) * 100)
    return {
      ...t,
      leftPercent,
      widthPercent
    }
  })
})

// 归一化事件图钉
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

// 议题色板
const topicColors = [
  'rgba(22, 119, 255, 0.35)',
  'rgba(19, 194, 194, 0.35)',
  'rgba(82, 196, 26, 0.35)',
  'rgba(250, 140, 22, 0.35)',
  'rgba(114, 46, 209, 0.35)',
  'rgba(235, 47, 150, 0.35)'
]

function getTopicColor(index) {
  return topicColors[index % topicColors.length]
}

function getEventTagColor(type) {
  switch (type) {
    case 'DECISION': return '#52c41a'
    case 'RISK': return '#ff4d4f'
    case 'TODO': return '#fa8c16'
    case 'CONSENSUS': return '#13c2c2'
    case 'KEY_POINT': return '#1677ff'
    default: return '#1677ff'
  }
}

function getEventLabel(type) {
  switch (type) {
    case 'DECISION': return '决策'
    case 'RISK': return '风险'
    case 'TODO': return '待办'
    case 'CONSENSUS': return '共识'
    case 'KEY_POINT': return '观点'
    default: return '看点'
  }
}

// 悬停命中议题
const hoverTopic = computed(() => {
  if (!props.topics || props.topics.length === 0) return null
  const t = currentHoverTimeMs.value
  return props.topics.find((item) => {
    const start = item.startTimeMs || 0
    const end = item.endTimeMs || safeDurationMs.value
    return t >= start && t <= end
  }) || null
})

// 悬停命中最近事件 (15 秒阈值)
const hoverEvent = computed(() => {
  if (!props.events || props.events.length === 0) return null
  const t = currentHoverTimeMs.value
  let closest = null
  let minDiff = 15000
  props.events.forEach((evt) => {
    const diff = Math.abs((evt.startTimeMs || 0) - t)
    if (diff <= minDiff) {
      minDiff = diff
      closest = evt
    }
  })
  return closest
})

// 悬停命中发言人与字幕原话
const hoverSubtitleItem = computed(() => {
  if (!props.segments || props.segments.length === 0) return null
  const t = currentHoverTimeMs.value
  // 优先查找覆盖该时间点的转写段落
  const exact = props.segments.find((s) => {
    const start = s.startTimeMs || 0
    const end = s.endTimeMs || (start + 5000)
    return t >= start && t <= end
  })
  if (exact) return exact

  // 兜底找最临近段落
  let closest = null
  let minDiff = 12000
  props.segments.forEach((s) => {
    const diff = Math.abs((s.startTimeMs || 0) - t)
    if (diff <= minDiff) {
      minDiff = diff
      closest = s
    }
  })
  return closest
})

const hoverSpeaker = computed(() => {
  return hoverSubtitleItem.value?.speakerName || props.spotlightMember?.nickName || ''
})

const hoverSubtitle = computed(() => {
  return hoverSubtitleItem.value?.content || ''
})

// ==========================================
// 核心：定时从 activeStream 抓取真实画面帧，构建短额回放画廊
// ==========================================
function initSampleVideo() {
  if (typeof document === 'undefined') return
  if (!sampleVideoEl) {
    sampleVideoEl = document.createElement('video')
    sampleVideoEl.muted = true
    sampleVideoEl.playsInline = true
    sampleVideoEl.autoplay = true
  }
  if (props.activeStream && props.activeStream.active) {
    try {
      sampleVideoEl.srcObject = props.activeStream
      sampleVideoEl.play().catch(() => {})
    } catch (e) {}
  }
}

watch(
  () => props.activeStream,
  (newStream) => {
    if (newStream) {
      initSampleVideo()
    }
  },
  { immediate: true }
)

// 每隔 1.5 秒抓一帧保存到环形缓冲区
function startFrameSampling() {
  stopFrameSampling()
  frameSampleTimer = setInterval(() => {
    captureCurrentFrame()
  }, 1500)
}

function stopFrameSampling() {
  if (frameSampleTimer) {
    clearInterval(frameSampleTimer)
    frameSampleTimer = null
  }
}

function captureCurrentFrame() {
  if (!sampleVideoEl || sampleVideoEl.readyState < 2) return
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 112
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(sampleVideoEl, 0, 0, canvas.width, canvas.height)

    const nowMs = props.durationMs || 0
    frameRingBuffer.value.push({
      timeMs: nowMs,
      canvas,
      speaker: props.spotlightMember?.nickName || '',
      subtitle: hoverSubtitleItem.value?.content || ''
    })

    // 维持最多 600 帧（可覆盖 15 分钟密集抽样，仅占用极微内存）
    if (frameRingBuffer.value.length > 600) {
      frameRingBuffer.value.shift()
    }
  } catch (e) {}
}

// ==========================================
// 悬停动画播放器：根据鼠标位置短额回放 3~5 帧
// ==========================================
let animFrameIndex = 0
let animCandidateFrames = []

function startHoverMiniPlayback() {
  stopHoverMiniPlayback()
  animFrameIndex = 0
  updateCandidateFrames()

  // 以 4 帧/秒循环播放当前悬停时间点周围的一小段短额切片
  animationLoopTimer = setInterval(() => {
    if (!hoverCanvasRef.value || animCandidateFrames.length === 0) return
    const target = animCandidateFrames[animFrameIndex % animCandidateFrames.length]
    if (target && target.canvas) {
      const destCtx = hoverCanvasRef.value.getContext('2d')
      if (destCtx) {
        destCtx.drawImage(target.canvas, 0, 0, hoverCanvasRef.value.width, hoverCanvasRef.value.height)
      }
    }
    animFrameIndex++
  }, 240)
}

function stopHoverMiniPlayback() {
  if (animationLoopTimer) {
    clearInterval(animationLoopTimer)
    animationLoopTimer = null
  }
}

function updateCandidateFrames() {
  const t = currentHoverTimeMs.value
  const list = frameRingBuffer.value
  if (list.length === 0) {
    animCandidateFrames = []
    renderFallbackFrame()
    return
  }

  // 查找在 t 前后 5 秒以内的所有帧
  const matched = list.filter((f) => Math.abs(f.timeMs - t) <= 6000)
  if (matched.length > 0) {
    animCandidateFrames = matched
  } else {
    // 找距离最近的一帧
    let nearest = list[0]
    let minD = Math.abs(nearest.timeMs - t)
    for (let i = 1; i < list.length; i++) {
      const d = Math.abs(list[i].timeMs - t)
      if (d < minD) {
        minD = d
        nearest = list[i]
      }
    }
    animCandidateFrames = [nearest]
  }

  // 立即绘制第一帧
  if (hoverCanvasRef.value && animCandidateFrames[0]?.canvas) {
    const destCtx = hoverCanvasRef.value.getContext('2d')
    if (destCtx) {
      destCtx.drawImage(animCandidateFrames[0].canvas, 0, 0, hoverCanvasRef.value.width, hoverCanvasRef.value.height)
    }
  }
}

function renderFallbackFrame() {
  if (!hoverCanvasRef.value) return
  const ctx = hoverCanvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#101520'
  ctx.fillRect(0, 0, hoverCanvasRef.value.width, hoverCanvasRef.value.height)

  // 绘制动态渐变脉冲图景
  const grad = ctx.createLinearGradient(0, 0, 200, 112)
  grad.addColorStop(0, '#1677ff')
  grad.addColorStop(1, '#0958d9')
  ctx.fillStyle = grad
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('会中实时画面切片', 100, 50)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '10px sans-serif'
  ctx.fillText(formatMs(currentHoverTimeMs.value), 100, 70)
}

// ==========================================
// 拖拽与点击交互
// ==========================================
function calculatePercentFromEvent(e) {
  if (!trackRef.value) return 0
  const rect = trackRef.value.getBoundingClientRect()
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches?.[0]?.clientX || 0)
  const offsetX = clientX - rect.left
  const percent = Math.min(100, Math.max(0, (offsetX / rect.width) * 100))
  return percent
}

function handleMouseMove(e) {
  if (isDragging.value) return
  const percent = calculatePercentFromEvent(e)
  hoverPercent.value = percent
  hoverTimeMs.value = Math.round((percent / 100) * safeDurationMs.value)
  hoverVisible.value = true
  updateCandidateFrames()
}

function handleMouseLeave() {
  if (!isDragging.value) {
    hoverVisible.value = false
    stopHoverMiniPlayback()
  }
}

function handleMouseDown(e) {
  if (e.button !== 0) return
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
  updateCandidateFrames()
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
  updateCandidateFrames()
  emit('dragging', dragTimeMs.value)
}

function onGlobalTouchMove(e) {
  if (!isDragging.value) return
  const percent = calculatePercentFromEvent(e)
  dragPercent.value = percent
  dragTimeMs.value = Math.round((percent / 100) * safeDurationMs.value)
  updateCandidateFrames()
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

  seekToMs(dragTimeMs.value)
}

function seekToMs(targetMs) {
  const maxMs = props.durationMs || 0
  // 若距离最新时长不足 4 秒，视作回到实时
  if (targetMs >= maxMs - 4000) {
    returnToLive()
  } else {
    emit('seek', Math.max(0, targetMs))
  }
}

function seekRelative(deltaSeconds) {
  const cur = props.isRewound ? (props.currentTimeMs || 0) : (props.durationMs || 0)
  const target = Math.max(0, cur + deltaSeconds * 1000)
  seekToMs(target)
}

function returnToLive() {
  emit('return-to-live')
}

watch(hoverVisible, (visible) => {
  if (visible) {
    startHoverMiniPlayback()
  } else {
    stopHoverMiniPlayback()
  }
})

onMounted(() => {
  initSampleVideo()
  startFrameSampling()
})

onUnmounted(() => {
  stopFrameSampling()
  stopHoverMiniPlayback()
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
  window.removeEventListener('touchmove', onGlobalTouchMove)
  window.removeEventListener('touchend', onGlobalTouchEnd)
  if (sampleVideoEl) {
    sampleVideoEl.srcObject = null
    sampleVideoEl = null
  }
})
</script>

<style scoped>
.live-timeshift-bar-container {
  display: flex;
  align-items: center;
  height: 48px;
  background: rgba(13, 17, 23, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0 16px;
  gap: 14px;
  user-select: none;
  z-index: 10;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.35);
}

.live-timeshift-bar-container.is-rewound {
  background: rgba(22, 27, 34, 0.98);
  border-top: 1.5px solid #ff7875;
}

/* 左侧控制区 */
.timeshift-left-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.shift-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #c9d1d9;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.shift-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  border-color: #58a6ff;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8b949e;
  margin-left: 4px;
}

.time-cur {
  color: #ffffff;
  font-weight: 600;
}

.time-cur.c-warn {
  color: #ff7875;
}

.time-sep {
  color: rgba(255, 255, 255, 0.2);
}

.time-total {
  color: #8b949e;
}

/* 中间进度条轨道 */
.timeshift-track-wrapper {
  position: relative;
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.track-bg {
  position: relative;
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  overflow: visible;
  transition: height 0.15s ease;
}

.timeshift-track-wrapper:hover .track-bg,
.is-dragging .track-bg {
  height: 11px;
}

/* 议题分段色块 */
.topic-chunk {
  position: absolute;
  top: 0;
  height: 100%;
  border-right: 1.5px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.chunk-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 500;
  padding: 0 4px;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

/* 进度填色 */
.track-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #1677ff, #58a6ff);
  border-radius: 4px;
  pointer-events: none;
}

.track-fill.rewound-fill {
  background: linear-gradient(90deg, #ff4d4f, #ff7875);
}

/* 实时最右端信标 */
.track-live-edge {
  position: absolute;
  right: 0;
  top: 50%;
  width: 6px;
  height: 6px;
  background: #ff4d4f;
  border-radius: 50%;
  transform: translate(50%, -50%);
  box-shadow: 0 0 6px #ff4d4f;
  pointer-events: none;
}

/* 可拖拽游标 */
.track-handle {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border: 2px solid #1677ff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  transition: transform 0.1s, box-shadow 0.1s;
}

.track-handle.rewound {
  border-color: #ff4d4f;
}

.handle-core {
  width: 5px;
  height: 5px;
  background: #1677ff;
  border-radius: 50%;
}

.track-handle.rewound .handle-core {
  background: #ff4d4f;
}

.timeshift-track-wrapper:hover .track-handle,
.track-handle.dragging {
  transform: translate(-50%, -50%) scale(1.35);
  box-shadow: 0 0 10px rgba(22, 119, 255, 0.9);
  cursor: grabbing;
}

/* 事件标记图钉 */
.event-pin {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 6;
  cursor: pointer;
  padding: 3px;
}

.pin-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: transform 0.2s;
}

.event-pin:hover .pin-dot {
  transform: scale(1.5);
}

.pin-decision .pin-dot { background-color: #52c41a; }
.pin-risk .pin-dot { background-color: #ff4d4f; }
.pin-todo .pin-dot { background-color: #fa8c16; }
.pin-consensus .pin-dot { background-color: #13c2c2; }
.pin-key_point .pin-dot { background-color: #1677ff; }

/* 悬停「短额回放播放」浮动预览框 */
.hover-preview-indicator {
  position: absolute;
  bottom: 24px;
  transform: translateX(-50%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 25;
}

.hover-preview-card {
  background: rgba(13, 17, 23, 0.98);
  border: 1.5px solid #58a6ff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  width: 204px;
  display: flex;
  flex-direction: column;
}

/* 微型视频短额回放画面视窗 */
.mini-screen-box {
  position: relative;
  width: 200px;
  height: 112px;
  background: #000000;
  margin: 2px;
  border-radius: 6px;
  overflow: hidden;
}

.mini-canvas {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.mini-live-tag {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 77, 79, 0.5);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  color: #ff7875;
  display: flex;
  align-items: center;
  gap: 4px;
}

.red-pulse-dot {
  width: 5px;
  height: 5px;
  background: #ff4d4f;
  border-radius: 50%;
  animation: pulse-ring 1s infinite;
}

.mini-time-tag {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 700;
  color: #58a6ff;
}

.hover-info-body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #161b22;
}

.hover-subtitle-row {
  font-size: 11px;
  color: #f0f6fc;
  line-height: 1.4;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.hover-speaker-name {
  color: #58a6ff;
  font-weight: 600;
  flex-shrink: 0;
}

.hover-subtitle-text {
  color: #c9d1d9;
}

.hover-topic-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #8b949e;
}

.topic-tag-pill {
  background: #1f6feb;
  color: #fff;
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
}

.hover-event-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.evt-badge {
  color: #fff;
  padding: 0 4px;
  border-radius: 2px;
  font-size: 9px;
}

.hover-arrow {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #161b22;
}

.hover-vertical-line {
  width: 1.5px;
  height: 20px;
  background: #58a6ff;
  box-shadow: 0 0 6px #58a6ff;
}

/* 右侧控制区 */
.timeshift-right-controls {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.return-live-btn {
  background: #ff4d4f;
  border: none;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 0 10px rgba(255, 77, 79, 0.6);
  animation: pulse-border 1.5s infinite;
  transition: all 0.2s;
}

.return-live-btn:hover {
  background: #ff7875;
  transform: scale(1.05);
}

.live-status-chip {
  background: rgba(82, 196, 26, 0.15);
  border: 1px solid rgba(82, 196, 26, 0.4);
  color: #73d13d;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.live-dot.green-pulse {
  background: #52c41a;
  animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.8; }
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 6px rgba(255, 77, 79, 0.5); }
  50% { box-shadow: 0 0 14px rgba(255, 77, 79, 0.9); }
}

.event-pin-tooltip {
  max-width: 220px;
  font-size: 12px;
}
.event-pin-tooltip .evt-tag {
  color: #fff;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 10px;
  margin-right: 6px;
}
.event-pin-tooltip .evt-time {
  color: #8b949e;
  font-size: 11px;
}
</style>
