<template>
  <div
    class="live-timeshift-bar-container"
    :class="{ 'is-rewound': isRewound, 'is-dragging': isDragging }"
  >
    <!-- 左侧控制区：回到开头 + 快退按钮 + 时间显示 -->
    <div class="timeshift-left-controls">
      <!-- 回到开头按钮 -->
      <button
        type="button"
        class="shift-btn jump-start-btn"
        title="回溯到会议开头 (00:00)"
        @click="seekToStart"
      >
        <span class="btn-icon">⏮</span>
        <span>回到开头</span>
      </button>

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
        <!-- 议题分段色块分布（每个议题拥有完全独立的色彩、高能时间端与微光分割线） -->
        <div
          v-for="(topic, idx) in normalizedTopics"
          :key="topic.id || idx"
          class="topic-chunk"
          :class="{
            'is-active-chunk': isCurrentTopic(topic),
            'is-past-chunk': displayTimeMs >= topic.endTimeMs
          }"
          :style="{
            left: `${topic.leftPercent}%`,
            width: `${topic.widthPercent}%`,
            backgroundColor: topic.palette.bgUnplayed,
            borderColor: topic.palette.border
          }"
          @click.stop="seekToMs(topic.startTimeMs)"
        >
          <!-- 议题内部已播放进度高亮（使用该议题专属的饱满主题色渐变） -->
          <div
            v-if="getTopicPlayedPercent(topic) > 0"
            class="topic-chunk-played"
            :style="{
              width: `${getTopicPlayedPercent(topic)}%`,
              background: topic.palette.bg
            }"
          ></div>

          <a-tooltip placement="top" :mouse-enter-delay="0.15">
            <template #title>
              <div class="topic-tooltip-content">
                <div class="topic-tt-header">
                  <span class="topic-tt-badge" :style="{ backgroundColor: topic.palette.badgeBg }">
                    议题 {{ idx + 1 }}
                  </span>
                  <span class="topic-tt-title font-bold">{{ topic.title }}</span>
                </div>
                <div class="topic-tt-timeband" :style="{ color: topic.palette.border }">
                  <span class="tt-icon">⏱</span>
                  <span class="tt-range mono">{{ topic.timeBandStr }}</span>
                  <span class="tt-dur">(持续 {{ topic.durationStr }})</span>
                </div>
                <div v-if="topic.summary || topic.content" class="topic-tt-summary">
                  {{ topic.summary || topic.content }}
                </div>
                <div class="topic-tt-action">
                  <span>👉 点击跳转至该议题开头 ({{ formatMs(topic.startTimeMs) }})</span>
                </div>
              </div>
            </template>

            <div class="chunk-inner">
              <span class="chunk-badge" :style="{ backgroundColor: topic.palette.badgeBg }">
                #{{ idx + 1 }}
              </span>
              <span v-if="topic.widthPercent > 5" class="chunk-title ellipsis">
                {{ topic.title }}
              </span>
              <!-- 明确标识时间端 [00:00 - 08:30] -->
              <span v-if="topic.widthPercent > 10" class="chunk-timeband mono">
                {{ topic.timeBandStr }}
              </span>
            </div>
          </a-tooltip>
        </div>

        <!-- 底部发光行进底线 (细微高光，不遮盖各议题分段主题色) -->
        <div
          class="track-progress-underline"
          :style="{ width: `${displayPercent}%` }"
        ></div>

        <!-- 回溯落后指示条 (仅在时移回溯时在底部提示落后区间) -->
        <div
          v-if="isRewound"
          class="rewind-lag-track"
          :style="{
            left: `${displayPercent}%`,
            width: `${Math.max(0, 100 - displayPercent)}%`
          }"
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

      <!-- 鼠标悬停 / 拖动时的「15 秒短视频播放」浮动预览小窗 -->
      <div
        v-if="hoverVisible || isDragging"
        class="hover-preview-indicator"
        :style="{ left: `${isDragging ? dragPercent : hoverPercent}%` }"
      >
        <div class="hover-preview-card">
          <!-- 顶部状态栏：15s 视频回放与时刻区间 -->
          <div class="clip-top-bar">
            <div class="clip-badge">
              <span class="clip-play-dot pulse"></span>
              <span class="clip-mode-text">15s 视频速览</span>
            </div>
            <div class="clip-range-pill mono">
              {{ formatMs(clipStartMs) }} - {{ formatMs(clipEndMs) }}
            </div>
          </div>

          <!-- 核心：15 秒微型视频播放视窗 -->
          <div class="mini-screen-box">
            <canvas ref="hoverCanvasRef" width="240" height="135" class="mini-canvas"></canvas>

            <!-- 15秒循环播放进度条 -->
            <div class="clip-15s-scrubber">
              <div class="clip-15s-fill" :style="{ width: `${clipProgressPercent}%` }"></div>
            </div>

            <!-- 当前播放时刻与 15s 进度角标 -->
            <div class="mini-time-tag mono">
              <span class="cur-t">{{ formatMs(currentClipPlaybackTimeMs) }}</span>
              <span class="t-sep">/</span>
              <span class="sec-delta">+{{ (clipElapsedMs / 1000).toFixed(1) }}s</span>
            </div>
          </div>

          <!-- 画面附带的情报：随 15s 播放动态变化的发言人与字幕 -->
          <div class="hover-info-body">
            <div v-if="hoverSpeaker || hoverSubtitle" class="hover-subtitle-row">
              <span v-if="hoverSpeaker" class="hover-speaker-name">{{ hoverSpeaker }}:</span>
              <span class="hover-subtitle-text ellipsis">{{ hoverSubtitle || '（会中研讨中）' }}</span>
            </div>

            <div v-if="hoverTopic" class="hover-topic-row ellipsis">
              <span class="topic-tag-pill" :style="{ backgroundColor: hoverTopic.palette?.badgeBg || '#1677ff' }">
                议题 {{ hoverTopicIndex + 1 }}
              </span>
              <span class="ellipsis topic-name-span">{{ hoverTopic.title }}</span>
              <span class="topic-span-range mono" :style="{ color: hoverTopic.palette?.border || '#8b949e' }">
                {{ hoverTopic.timeBandStr }}
              </span>
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
  },
  // 共享的时移帧缓冲区
  frameBuffer: {
    type: Array,
    default: () => []
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

// 15 秒视频切片播放状态
const clipElapsedMs = ref(0)
const clipProgressPercent = computed(() => {
  const dur = clipWindowDurationMs.value
  if (dur <= 0) return 0
  return Math.min(100, Math.max(0, (clipElapsedMs.value / dur) * 100))
})

// 缓存的历史视频帧环形缓冲区（分层保全策略：开头的帧永不丢弃，确保随时能回溯到会议开头）
// 每个条目：{ timeMs, canvas, isAnchor, speaker, subtitle }
const frameRingBuffer = ref([])
let frameSampleTimer = null
let clipPlaybackTimer = null
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
  return props.currentTimeMs ?? props.durationMs ?? 0
})

// 当前播放/回溯百分比 (0 - 100)
const displayPercent = computed(() => {
  if (safeDurationMs.value <= 0) return 100
  if (isDragging.value) return dragPercent.value
  if (!props.isRewound) return 100
  const p = ((props.currentTimeMs ?? 0) / safeDurationMs.value) * 100
  return Math.min(100, Math.max(0, p))
})

// 悬停所在时间
const currentHoverTimeMs = computed(() => {
  return isDragging.value ? dragTimeMs.value : hoverTimeMs.value
})

// 15 秒短视频窗口区间：从当前悬停时刻开始算起 15 秒内
const clipStartMs = computed(() => {
  const t = currentHoverTimeMs.value
  const total = safeDurationMs.value
  // 若距离尾部不足 5 秒且总时长大于 15 秒，向左平移保证 15 秒视窗
  if (total > 15000 && t > total - 5000) {
    return Math.max(0, total - 15000)
  }
  return Math.max(0, t)
})

const clipEndMs = computed(() => {
  const start = clipStartMs.value
  const total = safeDurationMs.value
  return Math.min(total, start + 15000)
})

const clipWindowDurationMs = computed(() => {
  return Math.max(1000, clipEndMs.value - clipStartMs.value)
})

// 15 秒内正在播放的当前绝对时刻
const currentClipPlaybackTimeMs = computed(() => {
  return clipStartMs.value + clipElapsedMs.value
})

// 格式化持续时长字符串，如 "8分30秒" 或 "45秒"
function formatDurationStr(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}分${seconds > 0 ? `${seconds}秒` : ''}`
  }
  return `${seconds}秒`
}

// 8 套高辨识度专属议题主题色彩体系 (高饱和度、高对比度、科技质感)
const TOPIC_PALETTES = [
  {
    name: 'tech-blue',
    color: '#1677ff',
    bg: 'linear-gradient(180deg, #1677ff 0%, #0958d9 100%)',
    bgUnplayed: 'rgba(22, 119, 255, 0.32)',
    border: '#69b1ff',
    badgeBg: '#1677ff'
  },
  {
    name: 'emerald-green',
    color: '#52c41a',
    bg: 'linear-gradient(180deg, #52c41a 0%, #237804 100%)',
    bgUnplayed: 'rgba(82, 196, 26, 0.32)',
    border: '#95de64',
    badgeBg: '#52c41a'
  },
  {
    name: 'amber-orange',
    color: '#fa8c16',
    bg: 'linear-gradient(180deg, #fa8c16 0%, #ad4e00 100%)',
    bgUnplayed: 'rgba(250, 140, 22, 0.32)',
    border: '#ffc069',
    badgeBg: '#fa8c16'
  },
  {
    name: 'royal-purple',
    color: '#722ed1',
    bg: 'linear-gradient(180deg, #722ed1 0%, #391085 100%)',
    bgUnplayed: 'rgba(114, 46, 209, 0.32)',
    border: '#b37feb',
    badgeBg: '#722ed1'
  },
  {
    name: 'luminous-cyan',
    color: '#13c2c2',
    bg: 'linear-gradient(180deg, #13c2c2 0%, #006d75 100%)',
    bgUnplayed: 'rgba(19, 194, 194, 0.32)',
    border: '#5cdbd3',
    badgeBg: '#13c2c2'
  },
  {
    name: 'rose-magenta',
    color: '#eb2f96',
    bg: 'linear-gradient(180deg, #eb2f96 0%, #9e105c 100%)',
    bgUnplayed: 'rgba(235, 47, 150, 0.32)',
    border: '#ff85c0',
    badgeBg: '#eb2f96'
  },
  {
    name: 'solar-gold',
    color: '#faad14',
    bg: 'linear-gradient(180deg, #faad14 0%, #ad6800 100%)',
    bgUnplayed: 'rgba(250, 173, 20, 0.32)',
    border: '#ffd666',
    badgeBg: '#faad14'
  },
  {
    name: 'coral-red',
    color: '#ff4d4f',
    bg: 'linear-gradient(180deg, #ff4d4f 0%, #a8071a 100%)',
    bgUnplayed: 'rgba(255, 77, 79, 0.32)',
    border: '#ff7875',
    badgeBg: '#ff4d4f'
  }
]

function getTopicPalette(index) {
  return TOPIC_PALETTES[index % TOPIC_PALETTES.length]
}

function getTopicColor(index) {
  return getTopicPalette(index).color
}

function getTopicBadgeColor(index) {
  return getTopicPalette(index).badgeBg
}

// 归一化议题分段：保证明确标识时间端 [startTime - endTime] 与持续时长，赋予专属色谱
const normalizedTopics = computed(() => {
  const duration = safeDurationMs.value
  if (duration <= 0) return []

  let rawList = (props.topics && props.topics.length > 0) ? [...props.topics] : []
  // 兜底若暂无议题，默认提供初始会议主线议题
  if (rawList.length === 0) {
    rawList = [
      {
        id: 'initial_live_topic',
        title: '会中研讨主线',
        startTimeMs: 0,
        endTimeMs: duration
      }
    ]
  }

  const count = rawList.length

  return rawList.map((t, idx) => {
    const title = t.title || t.topicName || t.name || `议题 ${idx + 1}`
    let start = t.startTimeMs
    let end = t.endTimeMs

    if (start === undefined || start === null) {
      start = Math.round((idx / count) * duration)
    }
    if (end === undefined || end === null || end <= start) {
      if (idx < count - 1 && rawList[idx + 1].startTimeMs) {
        end = rawList[idx + 1].startTimeMs
      } else {
        end = Math.min(duration, Math.round(((idx + 1) / count) * duration))
      }
    }

    start = Math.max(0, Math.min(duration, start))
    end = Math.max(start + 1000, Math.min(duration, end))

    const leftPercent = (start / duration) * 100
    const widthPercent = Math.max(2, ((end - start) / duration) * 100)
    const durMs = end - start
    const palette = getTopicPalette(idx)

    return {
      ...t,
      title,
      startTimeMs: start,
      endTimeMs: end,
      leftPercent,
      widthPercent,
      timeBandStr: `[${formatMs(start)} - ${formatMs(end)}]`,
      durationStr: formatDurationStr(durMs),
      palette
    }
  })
})

function isCurrentTopic(topic) {
  const cur = displayTimeMs.value
  return cur >= topic.startTimeMs && cur <= topic.endTimeMs
}

function getTopicPlayedPercent(topic) {
  const cur = displayTimeMs.value
  if (cur <= topic.startTimeMs) return 0
  if (cur >= topic.endTimeMs) return 100
  const dur = topic.endTimeMs - topic.startTimeMs
  if (dur <= 0) return 100
  return Math.min(100, Math.max(0, ((cur - topic.startTimeMs) / dur) * 100))
}

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
  if (!normalizedTopics.value || normalizedTopics.value.length === 0) return null
  const t = currentClipPlaybackTimeMs.value
  return normalizedTopics.value.find((item) => {
    return t >= item.startTimeMs && t <= item.endTimeMs
  }) || null
})

const hoverTopicIndex = computed(() => {
  if (!hoverTopic.value || !normalizedTopics.value) return 0
  return normalizedTopics.value.findIndex((t) => t === hoverTopic.value || t.id === hoverTopic.value.id)
})

// 悬停命中最近事件
const hoverEvent = computed(() => {
  if (!props.events || props.events.length === 0) return null
  const t = currentClipPlaybackTimeMs.value
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

// 悬停命中发言人与字幕原话 (随 15 秒视频动态播放实时刷新)
const hoverSubtitleItem = computed(() => {
  if (!props.segments || props.segments.length === 0) return null
  const t = currentClipPlaybackTimeMs.value
  const exact = props.segments.find((s) => {
    const start = s.startTimeMs || 0
    const end = s.endTimeMs || (start + 5000)
    return t >= start && t <= end
  })
  if (exact) return exact

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
// 核心：定时从 activeStream / DOM 抓取真实视频帧
// 分层保全机制：确保从 00:00 开头到最新的视频帧均有采样
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

// 高精度毫秒时间戳基准，消除秒级整跳
let barBasePerfTime = performance.now() - (props.durationMs || 0)
function getBarPreciseMs() {
  const dur = props.durationMs || 0
  const curPerf = performance.now()
  const expected = curPerf - dur
  if (Math.abs(expected - barBasePerfTime) > 1500) {
    barBasePerfTime = expected
  }
  return Math.max(0, Math.round(curPerf - barBasePerfTime))
}

// 每隔 50ms 抓一帧保存到环形缓冲区 (20 FPS 超高清平滑帧率)
function startFrameSampling() {
  stopFrameSampling()
  frameSampleTimer = setInterval(() => {
    captureCurrentFrame()
  }, 50)
}

function stopFrameSampling() {
  if (frameSampleTimer) {
    clearInterval(frameSampleTimer)
    frameSampleTimer = null
  }
}

function captureCurrentFrame() {
  // 优先从 sampleVideoEl 抓取，若不可用则从 DOM 中正在播放的视频元素获取
  let sourceEl = sampleVideoEl
  if (!sourceEl || sourceEl.readyState < 2) {
    if (typeof document !== 'undefined') {
      const vids = document.querySelectorAll('.primary-spotlight-stage video, .video-tile video, .meeting-grid video')
      for (const v of vids) {
        if (v && v.readyState >= 2 && !v.paused) {
          sourceEl = v
          break
        }
      }
    }
  }

  if (!sourceEl || sourceEl.readyState < 2) return

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 135
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(sourceEl, 0, 0, canvas.width, canvas.height)

    const nowMs = getBarPreciseMs()
    // 会议前 90 秒的帧打上 isAnchor 标记，永久保存在缓冲区，保证回溯会议开头时随时能播放
    const isAnchor = nowMs <= 90000

    frameRingBuffer.value.push({
      timeMs: nowMs,
      canvas,
      isAnchor,
      speaker: props.spotlightMember?.nickName || '',
      subtitle: hoverSubtitleItem.value?.content || ''
    })

    // 智能精简策略：当帧总数超过 3000 帧时，不直接丢弃开头帧，而是抽取中间高密度非关键帧进行降采样
    if (frameRingBuffer.value.length > 3000) {
      pruneBufferKeepStart()
    }
  } catch (e) {}
}

// 保全会议开头的智能精简算法
function pruneBufferKeepStart() {
  const list = frameRingBuffer.value
  const nowMs = getBarPreciseMs()
  const recentThresholdMs = Math.max(0, nowMs - 120000) // 最近 2 分钟

  // 筛选出可精简的中间段：既非开头前 90 秒 Anchor，也非最近 2 分钟高密度的帧
  const newList = []
  let dropToggle = false

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.isAnchor || item.timeMs <= 90000 || item.timeMs >= recentThresholdMs) {
      newList.push(item)
    } else {
      // 中间段隔帧保留一帧
      if (dropToggle) {
        newList.push(item)
      }
      dropToggle = !dropToggle
    }
  }

  frameRingBuffer.value = newList
}

// ==========================================
// 15 秒微型视频播放引擎：基于 requestAnimationFrame 驱动 60Hz 循环播放
// ==========================================
let clipRafId = null
let lastClipTimestamp = 0

function start15sClipPlayback() {
  stop15sClipPlayback()
  clipElapsedMs.value = 0
  lastClipTimestamp = 0

  // 立即绘制起始帧
  renderCurrentClipFrame()

  function clipStep(timestamp) {
    if (!hoverVisible.value && !isDragging.value) return
    if (!lastClipTimestamp) lastClipTimestamp = timestamp
    const delta = timestamp - lastClipTimestamp
    lastClipTimestamp = timestamp

    const dur = clipWindowDurationMs.value
    const step = Math.min(100, Math.max(10, delta))
    clipElapsedMs.value = (clipElapsedMs.value + step) % dur
    renderCurrentClipFrame()
    clipRafId = requestAnimationFrame(clipStep)
  }

  clipRafId = requestAnimationFrame(clipStep)
}

function stop15sClipPlayback() {
  if (clipRafId) {
    cancelAnimationFrame(clipRafId)
    clipRafId = null
  }
  if (clipPlaybackTimer) {
    clearInterval(clipPlaybackTimer)
    clipPlaybackTimer = null
  }
  lastClipTimestamp = 0
}

// 二分查找最近帧
function findClosestFrameInBar(list, targetTimeMs) {
  if (!list || list.length === 0) return null
  let low = 0
  let high = list.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (list[mid].timeMs === targetTimeMs) {
      return list[mid]
    } else if (list[mid].timeMs < targetTimeMs) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  let best = null
  let minDiff = Infinity
  for (const idx of [high, low]) {
    if (idx >= 0 && idx < list.length) {
      const diff = Math.abs(list[idx].timeMs - targetTimeMs)
      if (diff < minDiff) {
        minDiff = diff
        best = list[idx]
      }
    }
  }
  return best || list[0]
}

// 绘制 15 秒内当前时刻对应的真实视频帧
function renderCurrentClipFrame() {
  if (!hoverCanvasRef.value) return
  const destCanvas = hoverCanvasRef.value
  const destCtx = destCanvas.getContext('2d')
  if (!destCtx) return

  const targetTimeMs = currentClipPlaybackTimeMs.value
  const list = (props.frameBuffer && props.frameBuffer.length > 0) ? props.frameBuffer : frameRingBuffer.value

  if (list.length === 0) {
    renderFallbackFrame(destCtx, destCanvas.width, destCanvas.height, targetTimeMs)
    return
  }

  const best = findClosestFrameInBar(list, targetTimeMs)

  if (best && (best.canvas || best.bitmap)) {
    destCtx.drawImage(best.bitmap || best.canvas, 0, 0, destCanvas.width, destCanvas.height)
  } else {
    renderFallbackFrame(destCtx, destCanvas.width, destCanvas.height, targetTimeMs)
  }
}

// 视频流初始化前或暂无视频帧时的现代感保底画面
function renderFallbackFrame(ctx, width, height, timeMs) {
  ctx.fillStyle = '#0f141c'
  ctx.fillRect(0, 0, width, height)

  // 绘制科技感微型网格与渐变光晕
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#1677ff')
  grad.addColorStop(1, '#0958d9')
  ctx.fillStyle = grad
  ctx.fillRect(0, height - 3, (clipProgressPercent.value / 100) * width, 3)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('15s 视频回放切片', width / 2, 54)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
  ctx.font = '11px monospace'
  ctx.fillText(`${formatMs(timeMs)} (+${(clipElapsedMs.value / 1000).toFixed(1)}s)`, width / 2, 76)

  ctx.fillStyle = 'rgba(88, 166, 255, 0.85)'
  ctx.font = '10px sans-serif'
  ctx.fillText('会中讨论画面采集中...', width / 2, 98)
}

// ==========================================
// 拖拽、快退、回到开头与点击交互
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
}

function handleMouseLeave() {
  if (!isDragging.value) {
    hoverVisible.value = false
    stop15sClipPlayback()
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

function onGlobalMouseUp() {
  if (!isDragging.value) return
  stopDrag()
}

function onGlobalTouchEnd() {
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
  if (targetMs >= maxMs - 4000 && maxMs > 4000) {
    returnToLive()
  } else {
    emit('seek', Math.max(0, targetMs))
  }
}

// 直接回溯到会议开头 00:00 录像
function seekToStart() {
  emit('seek', 0)
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
    start15sClipPlayback()
  } else {
    stop15sClipPlayback()
  }
})

// 悬停时间点发生跳变时重新定位 15 秒播放窗口
watch(currentHoverTimeMs, () => {
  if (hoverVisible.value) {
    clipElapsedMs.value = 0
    renderCurrentClipFrame()
  }
})

onMounted(() => {
  initSampleVideo()
  startFrameSampling()
})

onUnmounted(() => {
  stopFrameSampling()
  stop15sClipPlayback()
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
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.shift-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  border-color: #58a6ff;
}

/* 回到开头按钮专属高亮微光 */
.jump-start-btn {
  background: rgba(22, 119, 255, 0.16);
  border-color: rgba(22, 119, 255, 0.4);
  color: #58a6ff;
}

.jump-start-btn:hover {
  background: rgba(22, 119, 255, 0.3);
  border-color: #1677ff;
  color: #ffffff;
  box-shadow: 0 0 8px rgba(22, 119, 255, 0.5);
}

.btn-icon {
  font-size: 10px;
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
  height: 38px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.track-bg {
  position: relative;
  width: 100%;
  height: 10px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 5px;
  overflow: visible;
  transition: height 0.15s ease;
}

.timeshift-track-wrapper:hover .track-bg,
.is-dragging .track-bg {
  height: 14px;
}

/* 议题分段色块 */
.topic-chunk {
  position: absolute;
  top: 0;
  height: 100%;
  border-right: 2px solid rgba(255, 255, 255, 0.45);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.15s, filter 0.15s;
}

.topic-chunk:hover {
  filter: brightness(1.25);
  z-index: 5;
}

.topic-chunk.is-active-chunk {
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.8), 0 0 8px rgba(255, 255, 255, 0.4);
}

.topic-chunk-played {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  pointer-events: none;
  transition: width 0.05s linear;
}

.chunk-badge {
  font-size: 9px;
  color: #ffffff;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 2px;
  line-height: 13px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.chunk-inner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  white-space: nowrap;
  pointer-events: none;
}

.chunk-index {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.95);
  opacity: 0.85;
}

.chunk-title {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.chunk-timeband {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.45);
  padding: 0 4px;
  border-radius: 2px;
}

/* 议题提示框 */
.topic-tooltip-content {
  max-width: 260px;
  padding: 2px;
}

.topic-tt-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.topic-tt-badge {
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

.topic-tt-title {
  color: #ffffff;
  font-size: 12px;
}

.topic-tt-timeband {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #58a6ff;
  margin-bottom: 4px;
}

.topic-tt-timeband .tt-dur {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
}

.topic-tt-summary {
  font-size: 11px;
  color: #c9d1d9;
  line-height: 1.4;
  margin-bottom: 6px;
  background: rgba(255, 255, 255, 0.06);
  padding: 4px 6px;
  border-radius: 4px;
}

.topic-tt-action {
  font-size: 10px;
  color: #7ee787;
  font-weight: 500;
}

/* 进度发光底线 (细微高光，不遮盖各议题分段独立主题色) */
.track-progress-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2.5px;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.9);
  border-radius: 1px;
  pointer-events: none;
  z-index: 6;
}

/* 回溯落后指示条 (仅在时移回溯时在底部提示落后区间) */
.rewind-lag-track {
  position: absolute;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, #ff4d4f, #ff7875);
  box-shadow: 0 0 8px rgba(255, 77, 79, 0.85);
  pointer-events: none;
  z-index: 6;
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
  z-index: 7;
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
  z-index: 10;
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

/* 悬停「15 秒短视频播放」浮动预览框 */
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
  width: 244px;
  display: flex;
  flex-direction: column;
}

/* 顶部 15s 切片栏 */
.clip-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.clip-badge {
  display: flex;
  align-items: center;
  gap: 5px;
}

.clip-play-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
}

.clip-mode-text {
  font-size: 10px;
  font-weight: 700;
  color: #ff7875;
  letter-spacing: 0.3px;
}

.clip-range-pill {
  font-size: 10px;
  color: #58a6ff;
  background: rgba(88, 166, 255, 0.12);
  padding: 1px 6px;
  border-radius: 10px;
}

/* 微型视频 15s 播放视窗 (16:9) */
.mini-screen-box {
  position: relative;
  width: 240px;
  height: 135px;
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

/* 15 秒短片进度底轨 */
.clip-15s-scrubber {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
}

.clip-15s-fill {
  height: 100%;
  background: linear-gradient(90deg, #1677ff, #52c41a);
  transition: width 0.08s linear;
}

.mini-time-tag {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.mini-time-tag .cur-t {
  color: #58a6ff;
}

.mini-time-tag .sec-delta {
  color: #7ee787;
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
  flex-shrink: 0;
}

.topic-name-span {
  max-width: 120px;
}

.topic-span-range {
  font-size: 9px;
  color: #8b949e;
  margin-left: auto;
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
