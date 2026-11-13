<template>
  <div
    class="video-tile"
    :class="{
      'is-self': isSelf,
      'is-screenshare': isScreenShare,
      'no-video': !hasVideo,
      'pip-mode': isPip,
      'compact-mode': compact,
      'spotlight-mode': spotlight,
      'is-speaking': isSpeaking,
      'is-pinned': isPinned
    }"
    @click="emit('select', member)"
  >
    <!-- 真实视频画面流 -->
    <video
      ref="videoEl"
      autoplay
      playsinline
      :muted="isSelf"
      class="video-element"
      :class="{ hidden: !hasVideo, mirror: isSelf && !isScreenShare }"
    ></video>

    <!-- 摄像头关闭/无信号状态提示（非 PiP / 非 Spotlight） -->
    <div v-if="!hasVideo && !isPip && !spotlight" class="no-video-top-row">
      <span v-if="member?.openVideo !== false" class="no-video-badge">无视频信号</span>
      <span v-else-if="!compact" class="no-video-badge">摄像头已关闭</span>
      <span v-else></span>
      <MeetingIcon name="videocam_off" :size="14" class="no-video-icon" />
    </div>

    <!-- 摄像头关闭时的占位脉冲头像画面 -->
    <div v-show="!hasVideo" class="avatar-fallback">
      <div class="avatar-pulse-wrap" :class="{ speaking: isSpeaking || (isAudioOpen && compact) }">
        <div
          class="avatar-circle"
          :style="{ backgroundColor: isSelf ? '#006ef2' : avatarBgColor }"
        >
          {{ displayName?.slice(0, 1) || '会' }}
        </div>
        <span v-if="isSpeaking" class="avatar-ping-ring"></span>
      </div>

      <!-- 语音激活波纹指示条 -->
      <div v-if="isAudioOpen && !isPip" class="voice-bars" :class="{ active: isSpeaking }">
        <span class="voice-bar b1"></span>
        <span class="voice-bar b2"></span>
        <span class="voice-bar b3"></span>
      </div>

      <span v-if="!compact && !isPip" class="fallback-name">{{ displayName }}</span>
      <span v-if="!isAudioOpen && !compact && !isPip" class="mic-muted-tip">
        <MeetingIcon name="mic_off" :size="13" class="muted-tip-icon" />
        <span>麦克风已静音</span>
      </span>
    </div>

    <!-- 有视频画面时的顶部渐隐遮罩 -->
    <div v-if="hasVideo && !spotlight" class="video-bottom-gradient"></div>

    <!-- 举手状态角标 -->
    <div v-if="isHandRaised && !isPip" class="hand-raised-badge">
      <MeetingIcon name="pan_tool" :size="12" />
      <span>举手中</span>
    </div>

    <!-- 底部成员标识牌与状态栏（非 Spotlight 独立管理） -->
    <div v-if="!spotlight" class="tile-bottom-bar">
      <div class="user-identity ellipsis">
        <span class="user-name ellipsis">
          {{ displayName }}<span v-if="isSelf" class="self-tag"> (我)</span>
        </span>
        <MeetingIcon
          :name="isAudioOpen ? 'mic' : 'mic_off'"
          :size="14"
          class="mic-icon"
          :class="{ muted: !isAudioOpen }"
        />
      </div>

      <div class="tile-right-tags">
        <span v-if="isHost && !isPip" class="host-tag">主持人</span>
        <span v-if="isScreenShare" class="screen-share-tag">
          <MeetingIcon name="screen_share" :size="12" />
          <span v-if="!compact && !isPip">共享中</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import MeetingIcon from '@/components/meeting/MeetingIcon.vue'

const props = defineProps({
  member: {
    type: Object,
    required: true
  },
  stream: {
    type: Object,
    default: null
  },
  isSelf: {
    type: Boolean,
    default: false
  },
  isHost: {
    type: Boolean,
    default: false
  },
  isPip: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  },
  spotlight: {
    type: Boolean,
    default: false
  },
  isSpeaking: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isHandRaised: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

const videoEl = ref(null)
const hasActiveVideoTrack = ref(false)

const displayName = computed(() => {
  return props.member?.nickName || props.member?.userName || '参会者'
})

const isAudioOpen = computed(() => {
  return props.member?.openAudio !== false
})

const isScreenShare = computed(() => {
  return !!props.member?.screenShare
})

function checkHasVideo() {
  if (props.member?.openVideo === false) {
    return false
  }
  if (!props.stream) {
    return false
  }
  try {
    const videoTracks = props.stream.getVideoTracks ? props.stream.getVideoTracks() : []
    return videoTracks.length > 0 && videoTracks.some((t) => t.enabled && t.readyState !== 'ended')
  } catch (e) {
    return false
  }
}

function updateTrackState() {
  hasActiveVideoTrack.value = checkHasVideo()
}

const hasVideo = computed(() => {
  if (props.member?.openVideo === false) {
    return false
  }
  return hasActiveVideoTrack.value
})

const avatarBgColor = computed(() => {
  const colors = ['#006ef2', '#722ed1', '#0ea5e9', '#10b981', '#d97706', '#db2777']
  const str = props.member?.userId || props.member?.nickName || 'a'
  const index = Math.abs(str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length
  return colors[index]
})

let cleanupListeners = () => {}

function bindStreamListeners(stream) {
  cleanupListeners()
  if (!stream) return

  const onTrackChange = () => updateTrackState()
  const onAddTrack = () => attachStream()
  const tracks = stream.getTracks ? stream.getTracks() : []

  tracks.forEach((track) => {
    track.addEventListener('unmute', onTrackChange)
    track.addEventListener('mute', onTrackChange)
    track.addEventListener('ended', onTrackChange)
  })
  stream.addEventListener?.('addtrack', onAddTrack)
  stream.addEventListener?.('removetrack', onTrackChange)

  cleanupListeners = () => {
    tracks.forEach((track) => {
      track.removeEventListener('unmute', onTrackChange)
      track.removeEventListener('mute', onTrackChange)
      track.removeEventListener('ended', onTrackChange)
    })
    stream.removeEventListener?.('addtrack', onAddTrack)
    stream.removeEventListener?.('removetrack', onTrackChange)
  }
}

function attachStream() {
  const el = videoEl.value
  if (!el) return

  const stream = props.stream
  if (stream) {
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    el.play?.().catch((err) => {
      console.warn('视频元素自动播放提示 (受浏览器策略影响):', err)
    })
    bindStreamListeners(stream)
  } else {
    cleanupListeners()
    el.srcObject = null
  }
  updateTrackState()
}

watch(
  [() => props.stream, () => props.member?.openVideo],
  () => {
    attachStream()
  },
  { immediate: true, flush: 'post' }
)

watch(hasVideo, (visible) => {
  if (!visible) return
  nextTick(() => {
    const el = videoEl.value
    if (el && props.stream) {
      if (el.srcObject !== props.stream) {
        el.srcObject = props.stream
      }
      el.play?.().catch(() => {})
    }
  })
})

onMounted(() => {
  attachStream()
})

onUnmounted(() => {
  cleanupListeners()
})
</script>

<style scoped>
.video-tile {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(226, 226, 226, 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(193, 198, 215, 0.12);
  transition: border-color 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease;
  cursor: pointer;
}

.video-tile:hover {
  border-color: rgba(175, 198, 255, 0.45);
}

.video-tile.is-speaking {
  box-shadow: inset 0 0 0 2px #88fd54;
  border-color: #88fd54;
}

.video-tile.is-pinned:not(.spotlight-mode) {
  border-color: #006ef2;
  box-shadow: 0 0 0 1px rgba(0, 110, 242, 0.4);
}

.video-tile.spotlight-mode {
  border-radius: 12px;
  cursor: default;
  border: none;
  background: #23252a;
}

.video-tile.spotlight-mode.is-speaking {
  box-shadow: inset 0 0 0 2px #88fd54;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: #1c1d22;
}

.video-element.mirror {
  transform: scaleX(-1);
}

.video-element.hidden {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.no-video-top-row {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 3;
  pointer-events: none;
}

.no-video-badge {
  font-size: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(226, 226, 226, 0.16);
  color: #c1c6d7;
}

.no-video-icon {
  color: #f87171;
}

.avatar-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #f1f1f1;
  z-index: 1;
}

.avatar-pulse-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-circle {
  position: relative;
  z-index: 2;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  color: #fefcff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}

.compact-mode .avatar-circle {
  width: 44px;
  height: 44px;
  font-size: 16px;
}

.spotlight-mode .avatar-circle {
  width: 92px;
  height: 92px;
  font-size: 34px;
}

.avatar-ping-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: rgba(136, 253, 84, 0.25);
  animation: tile-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  z-index: 1;
}

@keyframes tile-ping {
  0% { transform: scale(0.92); opacity: 0.75; }
  75%, 100% { transform: scale(1.35); opacity: 0; }
}

.voice-bars {
  display: flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 12px;
}

.voice-bar {
  width: 3px;
  height: 4px;
  border-radius: 999px;
  background: rgba(136, 253, 84, 0.45);
  transition: height 0.2s ease, background-color 0.2s ease;
}

.voice-bars.active .voice-bar {
  background: #88fd54;
  animation: voice-wave 0.9s infinite ease-in-out;
}

.voice-bars.active .voice-bar.b2 {
  animation-delay: 0.15s;
}

.voice-bars.active .voice-bar.b3 {
  animation-delay: 0.3s;
}

@keyframes voice-wave {
  0%, 100% { height: 4px; }
  50% { height: 12px; }
}

.fallback-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(241, 241, 241, 0.9);
}

.mic-muted-tip {
  font-size: 11.5px;
  color: #c1c6d7;
  display: flex;
  align-items: center;
  gap: 4px;
}

.muted-tip-icon {
  color: #f87171;
}

.video-bottom-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 58%, rgba(16, 17, 20, 0.85) 100%);
  pointer-events: none;
  z-index: 1;
}

.hand-raised-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 4;
  background: #9d6a00;
  color: #fffbff;
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
}

.tile-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  z-index: 3;
  pointer-events: none;
}

.user-identity {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.mic-icon {
  color: #88fd54;
}

.mic-icon.muted {
  color: #f87171;
}

.user-name {
  font-size: 12px;
  color: #f1f1f1;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
}

.self-tag {
  color: #c1c6d7;
  font-size: 11px;
}

.tile-right-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.local-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  background: #006ef2;
  color: #fefcff;
}

.host-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(157, 106, 0, 0.9);
  color: #fffbff;
}

.screen-share-tag {
  font-size: 10.5px;
  background: rgba(0, 110, 242, 0.88);
  color: #fefcff;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

/* 画中画小边框模式特殊紧凑样式 */
.video-tile.pip-mode {
  border-radius: 0;
  border: none;
  cursor: default;
}

.video-tile.pip-mode .avatar-circle {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.video-tile.pip-mode .tile-bottom-bar {
  padding: 4px 8px;
}

.video-tile.pip-mode .user-name {
  font-size: 11px;
}

@media (max-width: 768px) {
  .avatar-circle {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }

  .spotlight-mode .avatar-circle {
    width: 68px;
    height: 68px;
    font-size: 26px;
  }

  .tile-bottom-bar {
    padding: 5px 8px;
  }

  .user-name {
    font-size: 11px;
  }
}
</style>
