<template>
  <div class="screen-share-stage" :class="{ 'bar-collapsed': isBarCollapsed }">
    <!-- 顶部悬浮胶囊控制栏 (居中紧凑，顶端预留空间，完全不遮挡屏幕左右两端操作区和主要内容) -->
    <div v-if="!isBarCollapsed" class="floating-capsule-bar">
      <div class="capsule-info">
        <span class="status-pulse-dot"></span>
        <DesktopOutlined class="capsule-icon" />
        <span class="capsule-text">
          {{ isSelf ? '您正在共享屏幕' : `${sharer?.nickName || '参会者'} 正在共享屏幕` }}
        </span>
      </div>

      <div class="capsule-actions">
        <!-- 主讲人快捷切换是否预览镜像画面 -->
        <a-tooltip v-if="isSelf" :title="showSelfPreview ? '收起镜像画面' : '展开镜像预览'">
          <button class="capsule-btn" @click="showSelfPreview = !showSelfPreview">
            <component :is="showSelfPreview ? EyeInvisibleOutlined : EyeOutlined" />
          </button>
        </a-tooltip>

        <a-button
          v-if="isSelf"
          type="primary"
          danger
          size="small"
          class="stop-share-btn"
          @click="emit('stop')"
        >
          <StopOutlined /> 结束共享
        </a-button>

        <a-tooltip :title="isFullscreen ? '退出全屏' : '全屏显示'">
          <button class="capsule-btn" @click="emit('toggleFullscreen')">
            <component :is="isFullscreen ? FullscreenExitOutlined : FullscreenOutlined" />
          </button>
        </a-tooltip>

        <a-tooltip title="收起控制栏 (避免遮挡内容)">
          <button class="capsule-btn" @click="isBarCollapsed = true">
            <UpOutlined />
          </button>
        </a-tooltip>
      </div>
    </div>

    <!-- 控制栏收起时的极简迷你触发条 -->
    <div
      v-else
      class="collapsed-trigger-bar"
      @click="isBarCollapsed = false"
      title="点击展开控制栏"
    >
      <span class="status-pulse-dot"></span>
      <span class="collapsed-text">{{ isSelf ? '正在共享屏幕' : `${sharer?.nickName || '参会者'} 共享中` }}</span>
      <DownOutlined style="font-size: 11px" />
    </div>

    <!-- 1. 主讲人专属：演示就绪指引卡片 (避免主讲人看本窗口时产生无限镜像递归隧道) -->
    <div v-if="isSelf && !showSelfPreview" class="presenter-dashboard">
      <div class="dashboard-card">
        <div class="icon-pulse-wrapper">
          <DesktopOutlined class="dashboard-icon" />
        </div>
        <h2 class="dashboard-title">您正在向全体参会人共享屏幕</h2>
        <p class="dashboard-subtitle">参会者正在实时清晰观看您的共享内容</p>

        <div class="dashboard-tips">
          <div class="tip-item">
            <InfoCircleOutlined class="tip-icon" />
            <span>请切换到您需要演示的软件（如 PPT、Word、VS Code 或指定网页）开始汇报。</span>
          </div>
          <div class="tip-item">
            <CheckCircleOutlined class="tip-icon success" />
            <span>为避免在当前会议窗口内形成无限“镜中镜”递归循环，主讲人视图已自动优化。</span>
          </div>
        </div>

        <div class="dashboard-actions">
          <a-button type="primary" danger size="middle" class="stop-btn" @click="emit('stop')">
            <StopOutlined /> 结束共享
          </a-button>
          <a-button type="default" size="middle" class="preview-btn" @click="showSelfPreview = true">
            <EyeOutlined /> 查看实时镜像画面
          </a-button>
        </div>
      </div>
    </div>

    <!-- 2. 真实屏幕共享视频展示容器 (远端观众模式 或 主讲人主动展开镜像时) -->
    <div v-else class="screen-video-container">
      <video
        ref="videoEl"
        autoplay
        playsinline
        muted
        class="screen-video-element"
      ></video>

      <!-- 主讲人查看镜像时的辅助提示浮条 -->
      <div v-if="isSelf" class="mirror-hint-bar">
        <InfoCircleOutlined style="color: #faad14" />
        <span>提示：若共享的是当前会议窗口，出现多层画中画为正常光学递归，切换到其他软件即可正常演示。</span>
        <a-button type="link" size="small" style="color: #1677ff; padding: 0 4px" @click="showSelfPreview = false">
          收起镜像
        </a-button>
      </div>

      <!-- 当暂未收到视频流或加载时的遮罩 -->
      <div v-if="!hasStreamTracks" class="screen-empty-tip">
        <a-spin size="large" />
        <span style="margin-top: 12px; font-size: 13px; color: rgba(255, 255, 255, 0.7)">
          正在载入屏幕画面...
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  DesktopOutlined,
  StopOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  UpOutlined,
  DownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons-vue'

const props = defineProps({
  stream: {
    type: Object,
    default: null
  },
  sharer: {
    type: Object,
    default: null
  },
  isSelf: {
    type: Boolean,
    default: false
  },
  isFullscreen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['stop', 'toggleFullscreen'])

const videoEl = ref(null)
const isBarCollapsed = ref(false)
const showSelfPreview = ref(false)

const hasStreamTracks = computed(() => {
  if (!props.stream) return false
  const tracks = props.stream.getVideoTracks?.() || []
  return tracks.length > 0 && tracks.some((t) => t.readyState !== 'ended')
})

function setupVideoStream() {
  const el = videoEl.value
  if (!el) return

  const stream = props.stream
  if (stream) {
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    // 强制静音，规避各主流浏览器自动播放安全策略 (Autoplay Policy)
    el.muted = true
    el.defaultMuted = true

    // 监听视频元数据就绪后触发播放
    el.onloadedmetadata = () => {
      el.play().catch((err) => {
        console.warn('屏幕共享流 onloadedmetadata 播放提示:', err)
      })
    }

    // 立即执行一次 play
    el.play().catch((err) => {
      console.warn('屏幕共享流立即播放受限，等待元数据就绪:', err)
    })
  } else {
    el.srcObject = null
  }
}

watch(
  [() => props.stream, showSelfPreview],
  () => {
    nextTick(() => {
      setupVideoStream()
    })
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => {
    setupVideoStream()
  })
})

onUnmounted(() => {
  if (videoEl.value) {
    videoEl.value.srcObject = null
  }
})
</script>

<style scoped>
.screen-share-stage {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #000000;
  overflow: hidden;
  border-radius: 8px;
}

/* 顶部悬浮胶囊栏：居中紧凑，不遮挡屏幕左右两端操作区 */
.floating-capsule-bar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  height: 38px;
  max-width: 90%;
  background: rgba(22, 23, 30, 0.94);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 19px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  z-index: 20;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  user-select: none;
  transition: all 0.25s ease;
}

.capsule-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
}

.status-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 6px #52c41a;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0% {
    transform: scale(0.95);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.8;
  }
}

.capsule-icon {
  font-size: 15px;
  color: #1677ff;
}

.capsule-text {
  color: #ffffff;
  white-space: nowrap;
}

.capsule-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stop-share-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 13px;
}

.capsule-btn {
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.85);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.capsule-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #1677ff;
}

/* 控制栏收起时的极简迷你悬浮条 */
.collapsed-trigger-bar {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 22px;
  padding: 0 12px;
  background: rgba(18, 19, 25, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  border-radius: 0 0 10px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  z-index: 20;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.collapsed-trigger-bar:hover {
  background: rgba(22, 119, 255, 0.9);
  color: #ffffff;
}

.collapsed-text {
  white-space: nowrap;
}

/* 主讲人专属演示卡片 */
.presenter-dashboard {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 24px 24px;
  background: radial-gradient(circle at center, #181b26 0%, #0c0d12 100%);
}

.dashboard-card {
  max-width: 540px;
  width: 100%;
  background: rgba(26, 28, 38, 0.88);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 36px 32px;
  text-align: center;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.icon-pulse-wrapper {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(22, 119, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  position: relative;
}

.icon-pulse-wrapper::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(22, 119, 255, 0.4);
  animation: ripple 2.2s infinite ease-out;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

.dashboard-icon {
  font-size: 38px;
  color: #1677ff;
}

.dashboard-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
}

.dashboard-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 22px;
}

.dashboard-tips {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px 16px;
  width: 100%;
  margin-bottom: 26px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
}

.tip-icon {
  font-size: 15px;
  color: #1677ff;
  margin-top: 2px;
  flex-shrink: 0;
}

.tip-icon.success {
  color: #52c41a;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.preview-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.preview-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: #1677ff;
  color: #1677ff;
}

/* 屏幕视频展示容器：预留顶部边距，使默认状态下顶栏完全不遮挡屏幕内容 */
.screen-video-container {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  position: relative;
  overflow: hidden;
  padding: 48px 10px 10px 10px;
  transition: padding 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 当顶栏收起时，取消顶部预留留白，使画面最大化撑满 */
.screen-share-stage.bar-collapsed .screen-video-container {
  padding: 8px 10px 10px 10px;
}

.screen-video-element {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000000;
}

/* 镜像画面底部提示条 */
.mirror-hint-bar {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(18, 19, 26, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

.screen-empty-tip {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 5;
}
</style>
