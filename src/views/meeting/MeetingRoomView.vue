<template>
  <div class="meeting-room-view dark-theme">
    <!-- 顶部状态栏 -->
    <header class="room-top-bar">
      <div class="bar-left">
        <span class="meeting-topic ellipsis">{{ meetingStore.meetingInfo?.meetingName || 'EasyMeeting 会议室' }}</span>
        <div class="meeting-no-chip" @click="handleCopyMeetingNo">
          <span>会议号: {{ formatMeetingNo(meetingStore.meetingInfo?.meetingNo) }}</span>
          <CopyOutlined class="chip-copy" />
        </div>
      </div>

      <div class="bar-center">
        <!-- 实时计时器 -->
        <div class="timer-pill">
          <ClockCircleOutlined />
          <span>{{ formatDuration(meetingStore.durationSeconds) }}</span>
        </div>
      </div>

      <div class="bar-right">
        <!-- 网络与连接状态指示灯 -->
        <div class="conn-status-chip">
          <span
            class="status-dot"
            :class="{
              online: isWsConnected,
              reconnecting: isWsReconnecting,
              offline: !isWsConnected && !isWsReconnecting
            }"
          ></span>
          <span class="status-text">
            {{ isWsConnected ? '信令已连接' : isWsReconnecting ? '正在重连信令...' : '未连接' }}
          </span>
        </div>

        <a-button type="text" size="small" class="top-tool-btn" @click="inviteModalOpen = true">
          <ShareAltOutlined /> 邀请
        </a-button>

        <a-button type="text" size="small" class="top-tool-btn" @click="deviceModalOpen = true">
          <SettingOutlined /> 设备
        </a-button>
      </div>
    </header>

    <!-- 中间核心视频网格舞台工作区 -->
    <main class="room-video-stage" ref="stageContainerRef">
      <!-- 加载中遮罩状态 -->
      <div v-if="joiningMeeting" class="stage-overlay">
        <a-spin size="large" />
        <span class="overlay-text">{{ loadingTip }}</span>
      </div>

      <!-- 模式 A：屏幕共享模式 (主要内容显示屏幕共享，右下角小边框显示摄像头画面) -->
      <div v-else-if="isAnyScreenSharing" class="screen-share-stage-wrapper">
        <ScreenSharePlayer
          :stream="activeScreenStream"
          :sharer="activeScreenSharer"
          :is-self="isScreenSharing"
          :is-fullscreen="isStageFullscreen"
          @stop="handleToggleScreenShare"
          @toggle-fullscreen="toggleStageFullscreen"
        />

        <!-- 右下角小边框：摄像头画中画 (PIP) 浮窗 -->
        <div
          class="pip-camera-box"
          :class="{ minimized: isPipMinimized }"
        >
          <!-- 悬浮窗标题栏 -->
          <div class="pip-header">
            <div class="pip-title ellipsis">
              <CameraOutlined style="font-size: 13px" />
              <span class="ellipsis">{{ pipMemberMeta?.nickName || '摄像头' }}</span>
              <span v-if="pipMemberIsSelf" class="pip-tag">(我)</span>
            </div>
            <div class="pip-controls">
              <!-- 多成员画面切换 -->
              <a-dropdown v-if="availablePipMembers.length > 1" placement="bottomRight">
                <a-button type="text" size="small" class="pip-icon-btn" title="切换参会人摄像头">
                  <SwapOutlined />
                </a-button>
                <template #overlay>
                  <a-menu @click="handleSelectPipMember">
                    <a-menu-item
                      v-for="m in availablePipMembers"
                      :key="m.userId"
                      :class="{ 'ant-dropdown-menu-item-selected': currentPipUserId === m.userId }"
                    >
                      <span>{{ m.nickName }} {{ m.userId === authStore.userId ? '(我)' : '' }}</span>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>

              <!-- 最小化/展开 -->
              <a-button
                type="text"
                size="small"
                class="pip-icon-btn"
                :title="isPipMinimized ? '展开摄像头' : '最小化'"
                @click="isPipMinimized = !isPipMinimized"
              >
                <component :is="isPipMinimized ? UpOutlined : DownOutlined" />
              </a-button>
            </div>
          </div>

          <!-- 悬浮窗摄像头画面主体 -->
          <div v-show="!isPipMinimized" class="pip-body">
            <VideoTile
              :member="pipMemberMeta"
              :stream="pipStream"
              :is-self="pipMemberIsSelf"
              :is-host="pipMemberMeta?.userId === meetingStore.meetingInfo?.createUserId"
              :is-pip="true"
            />
          </div>
        </div>
      </div>

      <!-- 模式 B：标准多方视频网格布局 (无屏幕共享时) -->
      <div
        v-else
        class="video-grid"
        :class="gridClass"
      >
        <!-- 1. 本地参会者画面 -->
        <VideoTile
          :member="localMemberMeta"
          :stream="localStream"
          :is-self="true"
          :is-host="meetingStore.isHost"
        />

        <!-- 2. 远端各参会者画面 -->
        <VideoTile
          v-for="member in meetingStore.remoteMemberList"
          :key="member.userId"
          :member="member"
          :stream="rtcRemoteStreams[member.userId]"
          :is-self="false"
          :is-host="member.userId === meetingStore.meetingInfo?.createUserId"
        />
      </div>
    </main>

    <!-- 底部控制工具栏 -->
    <MeetingToolbar
      :is-audio-active="isAudioActive"
      :is-video-active="isVideoActive"
      :is-screen-sharing="isScreenSharing"
      :member-count="meetingStore.memberList.length"
      :unread-chat-count="unreadChatCount"
      :is-participants-open="participantsOpen"
      :is-chat-open="chatOpen"
      :is-host="meetingStore.isHost"
      @toggle-audio="handleToggleAudio"
      @toggle-video="handleToggleVideo"
      @toggle-screen-share="handleToggleScreenShare"
      @toggle-participants="participantsOpen = !participantsOpen"
      @toggle-chat="chatOpen = !chatOpen"
      @open-invite="inviteModalOpen = true"
      @open-settings="deviceModalOpen = true"
      @exit-meeting="handleExitMeeting"
      @finish-meeting="handleFinishMeeting"
    />

    <!-- 右侧抽屉：参会人员 -->
    <ParticipantDrawer
      v-model:open="participantsOpen"
      :members="meetingStore.memberList"
      :current-user-id="authStore.userId"
      :host-user-id="meetingStore.meetingInfo?.createUserId || ''"
      :meeting-id="meetingId"
    />

    <!-- 右侧抽屉：会议聊天与共享 -->
    <ChatDrawer
      v-model:open="chatOpen"
      :messages="meetingStore.chatMessages"
      :members="meetingStore.memberList"
      :current-user-id="authStore.userId"
      :meeting-id="meetingId"
    />

    <!-- 音视频设备快速设置弹窗 -->
    <DeviceTestModal v-model:open="deviceModalOpen" />

    <!-- 邀请成员弹窗 -->
    <InviteModal
      v-model:open="inviteModalOpen"
      :meeting-info="meetingStore.meetingInfo"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ClockCircleOutlined,
  CopyOutlined,
  SettingOutlined,
  ShareAltOutlined,
  DesktopOutlined,
  StopOutlined,
  CameraOutlined,
  SwapOutlined,
  UpOutlined,
  DownOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMeetingStore } from '@/stores/meeting'
import { useMediaDevices } from '@/composables/useMediaDevices'
import { useWebSocket } from '@/composables/useWebSocket'
import { useWebRTC } from '@/composables/useWebRTC'
import {
  getCurrentMeeting,
  jionMeeting,
  getMeetingMemberList,
  exitMeeting,
  finishMeeting,
  updateMemberMediaState,
  loadChatMessage
} from '@/api/meeting'
import { formatMeetingNo, formatDuration, copyText } from '@/utils/format'
import VideoTile from '@/components/meeting/VideoTile.vue'
import ScreenSharePlayer from '@/components/meeting/ScreenSharePlayer.vue'
import MeetingToolbar from '@/components/meeting/MeetingToolbar.vue'
import ParticipantDrawer from '@/components/meeting/ParticipantDrawer.vue'
import ChatDrawer from '@/components/meeting/ChatDrawer.vue'
import DeviceTestModal from '@/components/common/DeviceTestModal.vue'
import InviteModal from '@/components/common/InviteModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const meetingStore = useMeetingStore()

const meetingId = computed(() => route.params.id)

const joiningMeeting = ref(true)
const loadingTip = ref('正在接入会议系统...')
const participantsOpen = ref(false)
const chatOpen = ref(false)
const deviceModalOpen = ref(false)
const inviteModalOpen = ref(false)
const unreadChatCount = ref(0)

// 屏幕共享与画中画 (PIP) 状态控制
const stageContainerRef = ref(null)
const isStageFullscreen = ref(false)
const isPipMinimized = ref(false)
const selectedPipUserId = ref(null)

// 1. 初始化媒体设备管理
const {
  localStream,
  screenStream,
  isAudioActive,
  isVideoActive,
  isScreenSharing,
  initLocalStream,
  toggleAudio,
  toggleVideo,
  startScreenShare,
  stopScreenShare,
  stopAllTracks
} = useMediaDevices()

// 2. 初始化 WebSocket 信令长连接
const {
  isConnected: isWsConnected,
  isReconnecting: isWsReconnecting,
  connect: connectWs,
  disconnect: disconnectWs,
  send: sendWs,
  on: onWs
} = useWebSocket()

// 3. 初始化 WebRTC P2P Mesh 协商控制器
const {
  remoteStreams: rtcRemoteStreams,
  peerConnections,
  initiateOffer,
  handleSignal,
  replaceTrackForAllPeers,
  closePeer,
  closeAllPeers
} = useWebRTC({ send: sendWs }, localStream)

// 组装当前用户自身在列表中的显示元信息
const localMemberMeta = computed(() => {
  return {
    userId: authStore.userId,
    nickName: authStore.nickName,
    openAudio: isAudioActive.value,
    openVideo: isVideoActive.value,
    screenShare: isScreenSharing.value
  }
})

// 是否有任意参会人在共享屏幕 (本地开启共享 或 远端成员开启共享)
const isAnyScreenSharing = computed(() => {
  return isScreenSharing.value || !!meetingStore.screenSharer
})

// 共享屏幕发起者元信息
const activeScreenSharer = computed(() => {
  if (isScreenSharing.value) {
    return localMemberMeta.value
  }
  return meetingStore.screenSharer
})

// 屏幕共享视频流：若自己共享取 screenStream，若远端成员共享取 WebRTC 远端流
const activeScreenStream = computed(() => {
  if (isScreenSharing.value) {
    return screenStream.value
  }
  const sharer = meetingStore.screenSharer
  if (sharer && rtcRemoteStreams[sharer.userId]) {
    return rtcRemoteStreams[sharer.userId]
  }
  return null
})

// 画中画 (PIP) 摄像头可选成员 (包含自身及所有远端成员)
const availablePipMembers = computed(() => {
  return [
    localMemberMeta.value,
    ...meetingStore.remoteMemberList
  ]
})

// 当前在 PIP 小边框中显示的参会者 ID (默认显示自己)
const currentPipUserId = computed(() => {
  if (selectedPipUserId.value) {
    const exists = availablePipMembers.value.some((m) => m.userId === selectedPipUserId.value)
    if (exists) return selectedPipUserId.value
  }
  return authStore.userId
})

const pipMemberIsSelf = computed(() => {
  return currentPipUserId.value === authStore.userId
})

const pipMemberMeta = computed(() => {
  if (pipMemberIsSelf.value) {
    return localMemberMeta.value
  }
  return meetingStore.remoteMemberList.find((m) => m.userId === currentPipUserId.value) || null
})

const pipStream = computed(() => {
  if (pipMemberIsSelf.value) {
    return localStream.value
  }
  return rtcRemoteStreams[currentPipUserId.value] || null
})

function handleSelectPipMember({ key }) {
  selectedPipUserId.value = key
}

function toggleStageFullscreen() {
  if (!stageContainerRef.value) return
  if (!document.fullscreenElement) {
    stageContainerRef.value.requestFullscreen?.().catch((err) => {
      console.warn('全屏请求失败:', err)
    })
  } else {
    document.exitFullscreen?.().catch((err) => {
      console.warn('退出全屏失败:', err)
    })
  }
}

function handleFullscreenChange() {
  isStageFullscreen.value = !!document.fullscreenElement
}

// 根据参会人数动态计算网格布局类名
const gridClass = computed(() => {
  const total = 1 + meetingStore.remoteMemberList.length
  if (isScreenSharing.value || meetingStore.screenSharer) {
    return 'layout-stage-focus'
  }
  if (total === 1) return 'grid-1'
  if (total === 2) return 'grid-2'
  if (total <= 4) return 'grid-4'
  if (total <= 6) return 'grid-6'
  return 'grid-many'
})

async function initMeetingRoom() {
  joiningMeeting.value = true
  loadingTip.value = '正在核验会议信息...'

  try {
    // 步骤 1：核验当前会议合法性并注入 Store
    let current = await getCurrentMeeting()
    if (!current || current.meetingId !== meetingId.value) {
      console.warn('获取当前会议为空或不匹配，尝试按 ID 继续')
      current = { meetingId: meetingId.value, meetingName: 'EasyMeeting 视频会议' }
    }
    meetingStore.setMeetingInfo(current)

    // 步骤 2：请求本地摄像头与麦克风设备权限并初始化本地流
    loadingTip.value = '正在初始化音视频输入设备...'
    const initialVideoPref = sessionStorage.getItem('initial_video_open') !== '0'
    const initialAudioPref = sessionStorage.getItem('initial_audio_open') !== '0'

    try {
      await initLocalStream({
        audio: initialAudioPref,
        video: initialVideoPref
      })
    } catch (e) {
      console.warn('本地音视频设备获取不完整，降级入会:', e)
    }

    // 步骤 3：在入会前预先注册好全部 WebSocket 信令监听（防止漏掉先发过来的 Offer 或成员加入通知）
    setupWebSocketListeners()

    // 步骤 4：建立与后端的 WebSocket 信令通道并等待握手成功
    loadingTip.value = '正在连接 Netty WebSocket 信令服务器...'
    await connectWs(authStore.token)

    // 步骤 5：调用后端正式入会接口 /meeting/jionMeeting 广播给全员
    loadingTip.value = '正在加入会议房间...'
    await jionMeeting(isVideoActive.value)

    // 步骤 6：加载房间内已有的成员列表和历史聊天记录
    await refreshMemberList()
    loadChatHistory()

    // 步骤 7：对房间内已有远端成员进行对等连接探测与双向保活
    syncPeersWithExistingMembers()

    joiningMeeting.value = false
    message.success('已成功加入会议！')
  } catch (err) {
    message.error(err.message || '入会失败')
    setTimeout(() => {
      router.push('/')
    }, 1500)
  }
}

async function refreshMemberList() {
  try {
    const list = await getMeetingMemberList(meetingId.value)
    if (list) {
      meetingStore.setMemberList(list)
    }
  } catch (e) {
    console.error('获取成员列表失败:', e)
  }
}

async function loadChatHistory() {
  try {
    const history = await loadChatMessage(meetingId.value)
    if (history) {
      meetingStore.setChatHistory(history)
    }
  } catch (e) {
    console.error('加载聊天历史失败:', e)
  }
}

function setupWebSocketListeners() {
  // 1. ADD_METING_ROOM (messageType=1): 房间内有新成员加入
  onWs(1, (data) => {
    const newMember = data.meesageContent?.newMember
    if (newMember && newMember.userId !== authStore.userId) {
      console.log('检测到新成员加入，作为 Offerer 发起 WebRTC 握手:', newMember.userId)
      message.info(`${newMember.nickName || '新成员'} 加入了会议`)
      // 主动为该新加入成员发起 Offer
      initiateOffer(newMember.userId)
    }
  })

  // 2. PEER (messageType=2): WebRTC 信令透传 (Offer, Answer, Candidate)
  onWs(2, (data) => {
    handleSignal(data)
  })

  // 3. EXIT_MEETING_ROOM (messageType=3): 成员离开
  onWs(3, (data) => {
    const leftUserId = data.userId || data.meesageContent
    if (leftUserId) {
      closePeer(leftUserId)
    }
  })

  // 4. CHAT_TEXT_MESSAGE (5) / CHAT_MEDIA_MESSAGE (6): 新聊天消息提示
  onWs(5, () => {
    if (!chatOpen.value) {
      unreadChatCount.value++
    }
  })
  onWs(6, () => {
    if (!chatOpen.value) {
      unreadChatCount.value++
    }
  })
}

// 针对房间已有远端成员进行对等连接保活与协商补偿
function syncPeersWithExistingMembers() {
  setTimeout(() => {
    if (!meetingStore.remoteMemberList || meetingStore.remoteMemberList.length === 0) return
    meetingStore.remoteMemberList.forEach((member) => {
      if (member.userId && !peerConnections.has(member.userId)) {
        console.log('检测到尚未建立 WebRTC 连接的房间已有成员，主动发起协商:', member.userId)
        initiateOffer(member.userId)
      }
    })
  }, 1200)
}

// 麦克风开关
async function handleToggleAudio() {
  const nextState = toggleAudio()
  try {
    await updateMemberMediaState({
      meetingId: meetingId.value,
      openAudio: nextState
    })
    // 同时通过 WebSocket 发送同步
    sendWs({
      messageType: 11,
      openAudio: nextState
    })
  } catch (e) {
    console.warn('同步音频状态提示:', e)
  }
}

// 摄像头开关
async function handleToggleVideo() {
  const nextState = toggleVideo()
  try {
    await updateMemberMediaState({
      meetingId: meetingId.value,
      openVideo: nextState
    })
    sendWs({
      messageType: 11,
      openVideo: nextState
    })
  } catch (e) {
    console.warn('同步视频状态提示:', e)
  }
}

// 屏幕共享开关
async function handleToggleScreenShare() {
  if (isScreenSharing.value) {
    // 停止共享
    stopScreenShare()
    meetingStore.updateMemberMedia(authStore.userId, { screenShare: false })
    await revertVideoTrack()
  } else {
    // 开启共享
    try {
      const stream = await startScreenShare(async () => {
        // 用户点击浏览器原生停止共享按钮时的回调
        meetingStore.updateMemberMedia(authStore.userId, { screenShare: false })
        await revertVideoTrack()
      })

      const screenTrack = stream.getVideoTracks()[0]
      if (screenTrack) {
        // 更新本地 store 状态
        meetingStore.updateMemberMedia(authStore.userId, { screenShare: true })

        // 将所有对端 PeerConnection 中的视频轨道无缝替换为屏幕共享轨道
        await replaceTrackForAllPeers(screenTrack, 'video')

        // 通知服务端更新状态
        await updateMemberMediaState({
          meetingId: meetingId.value,
          screenShare: true
        })
        sendWs({
          messageType: 11,
          screenShare: true
        })
      }
    } catch (e) {
      console.warn('开启屏幕共享取消或失败:', e)
    }
  }
}

// 恢复摄像头视频轨道
async function revertVideoTrack() {
  meetingStore.updateMemberMedia(authStore.userId, { screenShare: false })
  const camTrack = localStream.value?.getVideoTracks()[0] || null
  if (camTrack) {
    await replaceTrackForAllPeers(camTrack, 'video')
  }
  try {
    await updateMemberMediaState({
      meetingId: meetingId.value,
      screenShare: false
    })
    sendWs({
      messageType: 11,
      screenShare: false
    })
  } catch (e) {}
}

// 参会人主动离开会议
function handleExitMeeting() {
  Modal.confirm({
    title: '离开会议',
    content: '确定要离开当前会议吗？',
    okText: '确认离开',
    cancelText: '取消',
    onOk: async () => {
      try {
        await exitMeeting(meetingId.value)
      } catch (e) {}
      leaveAndCleanUp()
    }
  })
}

// 主持人解散全员会议
function handleFinishMeeting() {
  Modal.confirm({
    title: '解散并结束会议',
    content: '结束会议后，房间内的所有参会成员将被强制移出。确认解散？',
    okText: '确认结束全员会议',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await finishMeeting(meetingId.value)
      } catch (e) {}
      leaveAndCleanUp()
    }
  })
}

function leaveAndCleanUp() {
  stopAllTracks()
  closeAllPeers()
  disconnectWs()
  meetingStore.resetMeeting()
  router.push('/')
}

async function handleCopyMeetingNo() {
  const no = meetingStore.meetingInfo?.meetingNo
  if (no) {
    const success = await copyText(no)
    if (success) {
      message.success('会议号已复制')
    }
  }
}

onMounted(() => {
  initMeetingRoom()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  stopAllTracks()
  closeAllPeers()
  disconnectWs()
  meetingStore.resetMeeting()
})
</script>

<style scoped>
.meeting-room-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-dark-meeting);
  color: #ffffff;
  overflow: hidden;
  position: relative;
}

/* 顶部状态栏 */
.room-top-bar {
  height: 52px;
  background-color: #1a1a20;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 10;
  user-select: none;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 40%;
}

.meeting-topic {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.meeting-no-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.1);
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  color: rgba(255, 255, 255, 0.85);
}

.meeting-no-chip:hover {
  background: rgba(255, 255, 255, 0.2);
}

.chip-copy {
  font-size: 11px;
}

.bar-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 12px;
  border-radius: 12px;
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conn-status-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.online {
  background: #52c41a;
  box-shadow: 0 0 6px #52c41a;
}

.status-dot.reconnecting {
  background: #faad14;
  box-shadow: 0 0 6px #faad14;
}

.status-dot.offline {
  background: #ff4d4f;
}

.top-tool-btn {
  color: rgba(255, 255, 255, 0.85);
}

.top-tool-btn:hover {
  color: #1677ff;
}

/* 核心视频舞台 */
.room-video-stage {
  flex: 1;
  padding: 16px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.stage-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.overlay-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

/* 响应式视频网格布局规则 */
.video-grid {
  width: 100%;
  height: 100%;
  display: grid;
  gap: 12px;
}

.video-grid.grid-1 {
  grid-template-columns: 1fr;
  max-width: 1080px;
  max-height: 720px;
  margin: auto;
}

.video-grid.grid-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 1200px;
  max-height: 600px;
  margin: auto;
}

.video-grid.grid-4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.video-grid.grid-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.video-grid.grid-many {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

/* 屏幕共享舞台外层包装 */
.screen-share-stage-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  overflow: hidden;
  border-radius: 8px;
}

/* 右下角小边框画中画 (PIP) 浮窗 */
.pip-camera-box {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 280px;
  height: 180px;
  background: #1e1f26;
  border: 2px solid #1677ff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 30;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.pip-camera-box.minimized {
  height: 38px;
  width: 200px;
  border-color: rgba(255, 255, 255, 0.2);
}

.pip-header {
  height: 36px;
  min-height: 36px;
  background: rgba(18, 19, 24, 0.95);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  user-select: none;
}

.pip-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  max-width: 160px;
}

.pip-tag {
  color: #1677ff;
  font-weight: 500;
}

.pip-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pip-icon-btn {
  color: rgba(255, 255, 255, 0.7);
  padding: 2px 4px;
  height: 24px;
}

.pip-icon-btn:hover {
  color: #ffffff;
}

.pip-body {
  flex: 1;
  position: relative;
  width: 100%;
  height: calc(100% - 36px);
  background: #000000;
  overflow: hidden;
}
</style>

