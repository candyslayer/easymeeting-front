<template>
  <div
    ref="playerContainerRef"
    class="replay-player-wrapper"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <!-- 上半部：媒体画面展示区 (视频 / 音频可视化 / 状态遮罩) -->
    <div class="media-display-screen" @click="togglePlay">
      <!-- 1. 正在转码处理中状态提示 -->
      <div v-if="isTranscoding" class="screen-overlay processing-overlay" @click.stop>
        <a-spin size="large" />
        <h3 class="overlay-title">录像正在进行 HLS 切片与转码处理</h3>
        <p class="overlay-desc">
          系统正在后台进行高画质切片，切片完成后将自动就绪。您可直接在下方拖动时间轴预先浏览各议题与决议。
        </p>
        <div class="overlay-actions">
          <a-button type="primary" ghost @click="$emit('refresh-status')">
            <ReloadOutlined /> 检查转码进度
          </a-button>
        </div>
      </div>

      <!-- 2. 转码失败状态提示 -->
      <div v-else-if="isFailed" class="screen-overlay error-overlay" @click.stop>
        <CloseCircleOutlined style="font-size: 44px; color: #ff4d4f" />
        <h3 class="overlay-title">视频切片转码异常</h3>
        <p class="overlay-desc">{{ errorMessage || 'FFmpeg 处理视频分片时发生未知异常' }}</p>
        <div class="overlay-actions">
          <a-button type="primary" danger @click="$emit('retry-transcode')">
            <ReloadOutlined /> 重新转码
          </a-button>
        </div>
      </div>

      <!-- 3. 无播放源或尚未绑定录像文件 -->
      <div v-else-if="!resolvedUrl" class="screen-overlay empty-overlay" @click.stop>
        <div class="empty-icon-wrap">
          <VideoCameraOutlined style="font-size: 44px; color: rgba(255, 255, 255, 0.45)" />
        </div>
        <h3 class="overlay-title">暂未加载音视频录像流</h3>
        <p class="overlay-desc">
          您可通过顶部「上传会议录像」上传视频，或直接在下方<strong>拖动时间轴游标</strong>回溯各议题与决策事件。
        </p>
      </div>

      <!-- 4. 音频模式可视化卡片 (当媒体源为音频文件时) -->
      <div v-else-if="isAudioSource" class="screen-overlay audio-visualizer-overlay">
        <div class="soundwave-avatar" :class="{ playing: isPlaying }">
          <SoundOutlined style="font-size: 36px; color: #1677ff" />
        </div>
        <h4 class="audio-mode-title">{{ mediaTitle || '会议录音智能回放中' }}</h4>
        <div class="sound-wave-bars">
          <span v-for="n in 12" :key="n" class="wave-bar" :class="{ active: isPlaying }"></span>
        </div>
        <p class="audio-tip">音频流已接入，下方拖动条已同步绑定各议题与决策时间戳</p>
      </div>

      <!-- 5. 视频画面元素 (常规视频模式) -->
      <video
        ref="videoRef"
        v-show="resolvedUrl && !isTranscoding && !isFailed && !isAudioSource"
        class="video-element"
        playsinline
        webkit-playsinline
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @waiting="isBuffering = true"
        @canplay="isBuffering = false"
        @ended="handleEnded"
        @error="handleMediaError"
      ></video>

      <!-- 隐藏的音频元素 (若以纯音频播放) -->
      <audio
        ref="audioRef"
        v-if="isAudioSource && resolvedUrl"
        :src="resolvedUrl"
        preload="auto"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @timeupdate="handleAudioTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @ended="handleEnded"
        @error="handleMediaError"
      ></audio>

      <!-- 顶部当前议题浮层指示 -->
      <div v-if="currentTopicTitle" class="current-topic-banner ellipsis">
        <span class="banner-tag">当前议题</span>
        <span class="banner-title ellipsis">{{ currentTopicTitle }}</span>
      </div>

      <!-- 画面中央大播放按钮 (暂停状态) -->
      <div
        v-if="resolvedUrl && !isPlaying && !isBuffering && !isTranscoding && !isFailed"
        class="center-play-btn"
        @click.stop="togglePlay"
      >
        <CaretRightOutlined />
      </div>

      <!-- 缓冲转圈 -->
      <div v-if="isBuffering && resolvedUrl" class="buffering-spinner">
        <a-spin size="large" />
      </div>
    </div>

    <!-- 下半部：永久固定的高能控制栏与议题拖动条 (绝对不隐藏) -->
    <div class="player-controls-docked">
      <!-- 智能议题时间轴与事件高亮拖动条 -->
      <div class="progress-bar-wrapper">
        <ReplayProgressBar
          :playback-url="resolvedUrl"
          :duration-ms="effectiveDurationMs"
          :current-time-ms="currentTimeMs"
          :topics="topics"
          :events="events"
          :active-topic-id="activeTopicId"
          :active-event-id="activeEventId"
          @seek="handleProgressBarSeek"
          @dragging="handleProgressBarDragging"
        />
      </div>

      <!-- 播放操作按钮工具行 -->
      <div class="controls-toolbar">
        <!-- 左侧：播放/暂停、快退10秒、快进10秒、时间显示 -->
        <div class="controls-left">
          <button
            class="ctrl-btn play-pause-btn"
            @click="togglePlay"
            :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'"
          >
            <PauseOutlined v-if="isPlaying" />
            <CaretRightOutlined v-else />
          </button>

          <button class="ctrl-btn text-btn" @click="seekRelative(-10)" title="后退 10 秒">
            <span class="btn-text">-10s</span>
          </button>

          <button class="ctrl-btn text-btn" @click="seekRelative(10)" title="快进 10 秒">
            <span class="btn-text">+10s</span>
          </button>

          <div class="time-display mono">
            <span class="time-cur">{{ formatMs(currentTimeMs) }}</span>
            <span class="time-sep">/</span>
            <span class="time-total">{{ formatMs(effectiveDurationMs) }}</span>
          </div>
        </div>

        <!-- 右侧：倍速、音量、全屏 -->
        <div class="controls-right">
          <!-- 快捷提示 -->
          <span class="scrubber-hint-text">
            💡 拖动上方滑块或点击时间轴色块快速跳转
          </span>

          <!-- 倍速选择 -->
          <a-dropdown :trigger="['click']" placement="top">
            <button class="ctrl-btn rate-btn" title="播放倍速">
              {{ playbackRate }}x
            </button>
            <template #overlay>
              <a-menu @click="handleRateChange" :selected-keys="[String(playbackRate)]">
                <a-menu-item key="0.75">0.75x</a-menu-item>
                <a-menu-item key="1.0">1.0x (正常)</a-menu-item>
                <a-menu-item key="1.25">1.25x</a-menu-item>
                <a-menu-item key="1.5">1.5x</a-menu-item>
                <a-menu-item key="2.0">2.0x</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <!-- 音量控制 -->
          <div class="volume-box">
            <button class="ctrl-btn" @click="toggleMute">
              <SoundOutlined v-if="!isMuted && volume > 0" />
              <span v-else class="muted-icon">🔇</span>
            </button>
            <div class="volume-slider-wrap">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="isMuted ? 0 : volume"
                class="volume-range"
                @input="handleVolumeInput"
              />
            </div>
          </div>

          <!-- 全屏切换 -->
          <button class="ctrl-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏播放'">
            <FullscreenExitOutlined v-if="isFullscreen" />
            <FullscreenOutlined v-else />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Hls from 'hls.js'
import {
  CaretRightOutlined,
  PauseOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from '@ant-design/icons-vue'
import { formatMs } from '@/utils/format'
import { resolvePlaybackUrl } from '@/api/meetingReplay'
import ReplayProgressBar from './ReplayProgressBar.vue'

const props = defineProps({
  playbackUrl: {
    type: String,
    default: ''
  },
  durationMs: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'READY'
  },
  errorMessage: {
    type: String,
    default: ''
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
  },
  seekTargetMs: {
    type: Number,
    default: null
  },
  mediaTitle: {
    type: String,
    default: ''
  },
  mediaType: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['timeupdate', 'seek', 'refresh-status', 'retry-transcode'])

const playerContainerRef = ref(null)
const videoRef = ref(null)
const audioRef = ref(null)
let hlsInstance = null

const isPlaying = ref(false)
const isBuffering = ref(false)
const currentTimeMs = ref(0)
const mediaDurationMs = ref(0)
const playbackRate = ref(1.0)
const volume = ref(1.0)
const isMuted = ref(false)
const isFullscreen = ref(false)

const isTranscoding = computed(() => props.status === 'PROCESSING' || props.status === 'UPLOADED')
const isFailed = computed(() => props.status === 'FAILED')

const resolvedUrl = computed(() => {
  return resolvePlaybackUrl(props.playbackUrl)
})

// 判断当前源是否为纯音频
const isAudioSource = computed(() => {
  if (props.mediaType === 'AUDIO') return true
  const url = (resolvedUrl.value || '').toLowerCase()
  return (
    url.includes('.mp3') ||
    url.includes('.wav') ||
    url.includes('.m4a') ||
    url.includes('.aac') ||
    url.includes('.webm') ||
    url.includes('.ogg') ||
    url.includes('.flac') ||
    url.includes('/recording/download/')
  )
})

// 计算有效总时长
const effectiveDurationMs = computed(() => {
  if (props.durationMs > 0) return props.durationMs
  if (mediaDurationMs.value > 0) return mediaDurationMs.value
  if (props.topics?.length > 0) {
    const maxEnd = Math.max(...props.topics.map((t) => t.endTimeMs || 0))
    if (maxEnd > 0) return maxEnd
  }
  return 60000 // 兜底 1 分钟
})

const currentTopicTitle = computed(() => {
  if (!props.activeTopicId || !props.topics?.length) return ''
  const t = props.topics.find((item) => item.id === props.activeTopicId)
  if (!t) return ''
  return `议题 ${t.sortOrder || ''}: ${t.title} (${formatMs(t.startTimeMs)} - ${formatMs(t.endTimeMs)})`
})

// 监听播放源变化
watch(
  () => resolvedUrl.value,
  (newUrl) => {
    if (newUrl) {
      nextTick(() => {
        loadMediaSource(newUrl)
      })
    } else {
      destroyHls()
    }
  },
  { immediate: true }
)

// 监听外部跳转指令
watch(
  () => props.seekTargetMs,
  (targetMs) => {
    if (targetMs != null && !isNaN(targetMs)) {
      seekTo(targetMs)
    }
  }
)

function getActiveMediaElement() {
  if (isAudioSource.value) {
    return audioRef.value
  }
  if (resolvedUrl.value && !isAudioSource.value) {
    return videoRef.value
  }
  return null
}

function loadMediaSource(url) {
  destroyHls()

  if (isAudioSource.value) {
    const audio = audioRef.value
    if (audio) {
      audio.src = url
    }
    return
  }

  const video = videoRef.value
  if (!video) return

  const isHls = url.includes('.m3u8')

  if (isHls && Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      fragLoadingTimeOut: 20000
    })
    hlsInstance.loadSource(url)
    hlsInstance.attachMedia(video)
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      // 就绪
    })
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsInstance.startLoad()
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError()
            break
          default:
            destroyHls()
            break
        }
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url
  } else {
    video.src = url
  }
}

function destroyHls() {
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
}

let virtualTimer = null

function clearVirtualTimer() {
  if (virtualTimer) {
    clearInterval(virtualTimer)
    virtualTimer = null
  }
}

watch(isPlaying, (val) => {
  const media = getActiveMediaElement()
  const isMediaActuallyPlaying = media && !media.paused && !media.error
  if (val && (!media || !isMediaActuallyPlaying)) {
    clearVirtualTimer()
    virtualTimer = setInterval(() => {
      if (currentTimeMs.value >= effectiveDurationMs.value) {
        isPlaying.value = false
        currentTimeMs.value = 0
        clearVirtualTimer()
        return
      }
      currentTimeMs.value += Math.round(500 * playbackRate.value)
      emit('timeupdate', currentTimeMs.value)
    }, 500)
  } else {
    clearVirtualTimer()
  }
})

function togglePlay() {
  const media = getActiveMediaElement()
  if (!media || !resolvedUrl.value) {
    // 若暂无真实音视频，虚拟模拟播放与时间流逝
    isPlaying.value = !isPlaying.value
    return
  }
  if (media.paused) {
    media.play().then(() => {
      isPlaying.value = true
    }).catch((err) => {
      console.warn('播放失败，切换为时间轴模拟播放:', err)
      isPlaying.value = true
    })
  } else {
    media.pause()
    isPlaying.value = false
  }
}

function handleMediaError(e) {
  console.warn('音视频加载失败:', e)
  isBuffering.value = false
}

function handleTimeUpdate() {
  const video = videoRef.value
  if (!video) return
  const ms = Math.round(video.currentTime * 1000)
  currentTimeMs.value = ms
  emit('timeupdate', ms)
}

function handleAudioTimeUpdate() {
  const audio = audioRef.value
  if (!audio) return
  const ms = Math.round(audio.currentTime * 1000)
  currentTimeMs.value = ms
  emit('timeupdate', ms)
}

function handleLoadedMetadata() {
  const media = getActiveMediaElement()
  if (!media) return
  if (media.duration && !isNaN(media.duration) && media.duration !== Infinity) {
    mediaDurationMs.value = Math.round(media.duration * 1000)
  }
}

function handleEnded() {
  isPlaying.value = false
}

function seekTo(targetMs) {
  const media = getActiveMediaElement()
  const sec = Math.max(0, targetMs / 1000)
  if (media) {
    media.currentTime = sec
  }
  currentTimeMs.value = Math.round(targetMs)
  emit('timeupdate', currentTimeMs.value)
}

function seekRelative(seconds) {
  const media = getActiveMediaElement()
  const currentSec = media ? media.currentTime : (currentTimeMs.value / 1000)
  const target = Math.max(0, currentSec + seconds)
  handleProgressBarSeek(Math.round(target * 1000))
}

function handleProgressBarSeek(targetMs) {
  seekTo(targetMs)
  emit('seek', targetMs)
}

function handleProgressBarDragging(targetMs) {
  currentTimeMs.value = Math.round(targetMs)
  emit('timeupdate', currentTimeMs.value)
}

function handleRateChange({ key }) {
  const rate = parseFloat(key)
  playbackRate.value = rate
  const media = getActiveMediaElement()
  if (media) {
    media.playbackRate = rate
  }
}

function toggleMute() {
  const media = getActiveMediaElement()
  isMuted.value = !isMuted.value
  if (media) {
    media.muted = isMuted.value
  }
}

function handleVolumeInput(e) {
  const val = parseFloat(e.target.value)
  volume.value = val
  const media = getActiveMediaElement()
  if (media) {
    media.volume = val
    if (val === 0) {
      isMuted.value = true
      media.muted = true
    } else {
      isMuted.value = false
      media.muted = false
    }
  }
}

function toggleFullscreen() {
  const container = playerContainerRef.value
  if (!container) return

  if (!document.fullscreenElement) {
    container.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch((err) => console.warn('全屏请求失败', err))
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch((err) => console.warn('退出全屏失败', err))
  }
}

function handleFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

function handleKeydown(e) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    seekRelative(-5)
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    seekRelative(5)
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  destroyHls()
  clearVirtualTimer()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  seekTo,
  togglePlay
})
</script>

<style scoped>
.replay-player-wrapper {
  position: relative;
  width: 100%;
  background-color: #0d121f;
  border-radius: var(--border-radius-card, 8px);
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.replay-player-wrapper.is-fullscreen {
  border-radius: 0;
  width: 100vw;
  height: 100vh;
}

/* 上半部：媒体展示区 */
.media-display-screen {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: #000;
}

/* 屏幕遮罩通用 */
.screen-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
  color: #ffffff;
  z-index: 5;
  width: 100%;
  height: 100%;
}

.overlay-title {
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
  margin-top: 14px;
  margin-bottom: 6px;
}

.overlay-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  max-width: 480px;
  margin-bottom: 16px;
  line-height: 1.6;
}

.overlay-desc strong {
  color: #4096ff;
}

/* 音频可视化模式 */
.audio-visualizer-overlay {
  background: radial-gradient(circle at center, #17223b 0%, #0d121f 100%);
}

.soundwave-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(22, 119, 255, 0.15);
  border: 2px solid #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  transition: transform 0.3s;
}

.soundwave-avatar.playing {
  animation: pulse-ring 2s infinite ease-out;
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.7);
  }
  70% {
    box-shadow: 0 0 0 16px rgba(22, 119, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(22, 119, 255, 0);
  }
}

.audio-mode-title {
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.sound-wave-bars {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  margin-bottom: 10px;
}

.wave-bar {
  width: 4px;
  height: 6px;
  background: #1677ff;
  border-radius: 2px;
  transition: height 0.2s;
}

.wave-bar.active {
  animation: wave-anim 1s infinite alternate ease-in-out;
}

.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }
.wave-bar:nth-child(6) { animation-delay: 0.5s; }
.wave-bar:nth-child(7) { animation-delay: 0.6s; }
.wave-bar:nth-child(8) { animation-delay: 0.7s; }
.wave-bar:nth-child(9) { animation-delay: 0.8s; }
.wave-bar:nth-child(10) { animation-delay: 0.9s; }
.wave-bar:nth-child(11) { animation-delay: 1.0s; }
.wave-bar:nth-child(12) { animation-delay: 1.1s; }

@keyframes wave-anim {
  0% { height: 4px; }
  100% { height: 22px; }
}

.audio-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 顶部当前议题标语 */
.current-topic-banner {
  position: absolute;
  top: 14px;
  left: 14px;
  max-width: 80%;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 13px;
  z-index: 6;
  pointer-events: none;
}

.banner-tag {
  background: #1677ff;
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.banner-title {
  font-weight: 500;
}

/* 居中大播放按钮 */
.center-play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(22, 119, 255, 0.85);
  backdrop-filter: blur(4px);
  color: #ffffff;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s, background-color 0.2s;
  z-index: 7;
}

.center-play-btn:hover {
  transform: translate(-50%, -50%) scale(1.1);
  background: #1677ff;
}

.buffering-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 8;
}

/* 下半部：永久固定底部的控制栏与拖动条 */
.player-controls-docked {
  width: 100%;
  background: #141b2d;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
}

.progress-bar-wrapper {
  width: 100%;
}

.controls-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background-color 0.2s;
}

.ctrl-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
}

.play-pause-btn {
  font-size: 20px;
  color: #1677ff;
}

.play-pause-btn:hover {
  color: #4096ff;
}

.btn-text {
  font-size: 12px;
  font-weight: 600;
}

.rate-btn {
  font-size: 13px;
  font-weight: 600;
  min-width: 44px;
}

.time-display {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: 4px;
}

.time-cur {
  color: #ffffff;
  font-weight: 600;
}

.time-sep {
  color: rgba(255, 255, 255, 0.35);
}

.time-total {
  color: rgba(255, 255, 255, 0.65);
}

.scrubber-hint-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin-right: 8px;
}

.volume-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.muted-icon {
  font-size: 14px;
}

.volume-slider-wrap {
  width: 60px;
  display: flex;
  align-items: center;
}

.volume-range {
  width: 100%;
  height: 4px;
  cursor: pointer;
  accent-color: #1677ff;
}
</style>
