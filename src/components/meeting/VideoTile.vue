<template>
  <div
    class="video-tile"
    :class="{
      'is-self': isSelf,
      'is-screenshare': isScreenShare,
      'no-video': !hasVideo,
      'pip-mode': isPip
    }"
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

    <!-- 摄像头关闭时的占位头像画面 -->
    <div v-show="!hasVideo" class="avatar-fallback">
      <div class="avatar-circle" :style="{ backgroundColor: avatarBgColor }">
        {{ displayName?.slice(0, 1) || '会' }}
      </div>
      <span class="fallback-name">{{ displayName }}</span>
      <span v-if="!isAudioOpen" class="mic-muted-tip">
        <AudioMutedOutlined style="color: #ff4d4f" /> 麦克风已静音
      </span>
    </div>

    <!-- 底部成员标识牌与状态栏 -->
    <div class="tile-bottom-bar">
      <div class="user-identity ellipsis">
        <!-- 麦克风状态图标 -->
        <component
          :is="isAudioOpen ? AudioOutlined : AudioMutedOutlined"
          class="mic-icon"
          :class="{ muted: !isAudioOpen }"
        />
        <span class="user-name ellipsis">
          {{ displayName }}
          <span v-if="isHost" class="host-tag">主持人</span>
          <span v-if="isSelf" class="self-tag">(我)</span>
        </span>
      </div>

      <!-- 共享状态标识 -->
      <div v-if="isScreenShare" class="screen-share-tag">
        <DesktopOutlined /> 屏幕共享中
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  AudioOutlined,
  AudioMutedOutlined,
  DesktopOutlined
} from '@ant-design/icons-vue'

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
  }
})

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

// 是否真正有视频画面并且启用
const hasVideo = computed(() => {
  if (props.member?.openVideo === false) {
    return false
  }
  return hasActiveVideoTrack.value
})

const avatarBgColor = computed(() => {
  const colors = ['#1677ff', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96']
  const str = props.member?.userId || props.member?.nickName || 'a'
  const index = Math.abs(str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length
  return colors[index]
})

function attachStream() {
  const el = videoEl.value
  if (!el) return

  const stream = props.stream
  if (stream) {
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    // 自动播放音频和视频流
    el.play?.().catch((err) => {
      console.warn('视频元素自动播放提示 (受浏览器策略影响):', err)
    })

    // 绑定音视频轨道状态变动监听
    try {
      const tracks = stream.getTracks ? stream.getTracks() : []
      tracks.forEach((track) => {
        track.onunmute = () => updateTrackState()
        track.onmute = () => updateTrackState()
        track.onended = () => updateTrackState()
      })
      if (stream.onaddtrack !== undefined) {
        stream.onaddtrack = () => {
          attachStream()
        }
      }
    } catch (e) {}
  } else {
    el.srcObject = null
  }
  updateTrackState()
}

watch(
  [() => props.stream, () => props.member?.openVideo],
  () => {
    attachStream()
  },
  { immediate: true }
)

onMounted(() => {
  attachStream()
})
</script>

<style scoped>
.video-tile {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-dark-surface);
  border-radius: var(--border-radius-base);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.video-tile:hover {
  border-color: rgba(22, 119, 255, 0.5);
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: #0d0d11;
}

.video-element.mirror {
  transform: scaleX(-1);
}

.video-element.hidden {
  display: none;
}

.avatar-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ffffff;
  z-index: 1;
}

.avatar-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.fallback-name {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

.mic-muted-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 4px;
}

.tile-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.7) 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 2;
  pointer-events: none;
}

.user-identity {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 80%;
}

.mic-icon {
  font-size: 14px;
  color: #52c41a;
}

.mic-icon.muted {
  color: #ff4d4f;
}

.user-name {
  font-size: 13px;
  color: #ffffff;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.host-tag {
  background: #fa8c16;
  color: #ffffff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: middle;
}

.self-tag {
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  margin-left: 2px;
}

.screen-share-tag {
  font-size: 11px;
  background: rgba(22, 119, 255, 0.8);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 画中画小边框模式特殊紧凑样式 */
.video-tile.pip-mode {
  border-radius: 0;
  border: none;
}

.video-tile.pip-mode .avatar-circle {
  width: 44px;
  height: 44px;
  font-size: 18px;
}

.video-tile.pip-mode .avatar-fallback {
  gap: 6px;
}

.video-tile.pip-mode .fallback-name {
  font-size: 12px;
}

.video-tile.pip-mode .mic-muted-tip {
  font-size: 10px;
}

.video-tile.pip-mode .tile-bottom-bar {
  padding: 4px 8px;
}

.video-tile.pip-mode .user-name {
  font-size: 11px;
}

.video-tile.pip-mode .mic-icon {
  font-size: 12px;
}
</style>

