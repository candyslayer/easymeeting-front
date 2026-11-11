<template>
  <a-drawer
    :open="open"
    title="EasyMeeting 实时 AI 助手"
    placement="right"
    :width="drawerWidth"
    :body-style="{ padding: '0px', display: 'flex', flexDirection: 'column', height: '100%' }"
    @update:open="(val) => emit('update:open', val)"
  >
    <!-- 顶部工作空间快捷跳转入口 -->
    <div class="drawer-top-banner">
      <div class="banner-text">
        <RobotOutlined style="color: #1677ff; font-size: 16px" />
        <span>Spring AI 多 Agent 会议助手</span>
      </div>
      <div class="banner-actions">
        <a-button type="link" size="small" @click="openWorkspaceModal">
          <FullscreenOutlined /> 全屏工作台
        </a-button>
        <a-button type="link" size="small" @click="openInExternalTab">
          <ExportOutlined /> 新窗口
        </a-button>
      </div>
    </div>

    <!-- 标签页导航：实时转写 / Agent 控制台 / 会议纪要 / 核心议题 / 决策 / 待办 / 问答 -->
    <div class="drawer-tabs-header">
      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'realtime' }"
        @click="activeTab = 'realtime'"
      >
        <AudioOutlined />
        <span>实时转写</span>
        <span v-if="realtimeSegments.length > 0" class="badge-dot"></span>
      </button>

      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'agents' }"
        @click="activeTab = 'agents'"
      >
        <ClusterOutlined />
        <span>Agent 控制台</span>
        <span v-if="aiStore.isAnalyzing" class="badge-dot pulse"></span>
      </button>

      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'minutes' }"
        @click="activeTab = 'minutes'"
      >
        <FileTextOutlined />
        <span>会议纪要</span>
      </button>

      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'topics' }"
        @click="activeTab = 'topics'"
      >
        <OrderedListOutlined />
        <span>核心议题</span>
      </button>

      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'decisions' }"
        @click="activeTab = 'decisions'"
      >
        <CheckCircleOutlined />
        <span>会议决策</span>
        <span v-if="aiStore.decisions.length > 0" class="badge-dot"></span>
      </button>

      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'actionItems' }"
        @click="activeTab = 'actionItems'"
      >
        <UnorderedListOutlined />
        <span>待办事项</span>
      </button>

      <button
        class="d-tab-btn"
        :class="{ active: activeTab === 'qa' }"
        @click="activeTab = 'qa'"
      >
        <QuestionCircleOutlined />
        <span>智能问答</span>
      </button>
    </div>

    <!-- 抽屉主体内容区 -->
    <div class="drawer-content-body">
      <!-- 1. 实时转写面板 -->
      <div v-show="activeTab === 'realtime'" class="tab-panel realtime-panel">
        <div class="realtime-control-bar">
          <div class="status-indicator">
            <span
              class="pulse-dot"
              :class="{ recording: isSessionActive }"
            ></span>
            <span class="status-text">
              {{ isSessionActive ? '本机实时转写中 (16kHz PCM/WebM)' : '实时转写已就绪' }}
            </span>
          </div>

          <!-- 启动 / 停止本机音频分片转写 -->
          <a-button
            :type="isSessionActive ? 'primary' : 'default'"
            :danger="isSessionActive"
            size="small"
            :loading="startingSession"
            @click="toggleRealtimeSession"
          >
            <component :is="isSessionActive ? PoweroffOutlined : PlayCircleOutlined" />
            {{ isSessionActive ? '停止转写' : '开启转写' }}
          </a-button>
        </div>

        <div class="realtime-segments-list" ref="segmentsBoxRef">
          <div v-if="realtimeSegments.length === 0" class="realtime-empty">
            <a-empty description="暂无实时转写内容。点击上方「开启转写」或等待其他发言人语音转写流。" />
          </div>

          <div v-else class="live-timeline">
            <div
              v-for="(seg, idx) in realtimeSegments"
              :key="seg.segmentId || idx"
              class="live-timeline-item"
              :class="{
                'is-first': idx === 0,
                'is-last': idx === realtimeSegments.length - 1,
                'is-focused': focusedLiveKey === getLiveSegKey(seg, idx)
              }"
              :style="getLiveItemVars(seg)"
              @click="handleLiveTap(seg, idx)"
            >
              <!-- 左侧时间轴竖线与圆点 -->
              <div class="live-axis" aria-hidden="true">
                <span class="live-axis-top"></span>
                <span class="live-axis-dot"></span>
                <span class="live-axis-bottom"></span>
              </div>

              <!-- 用户头像 -->
              <div class="live-avatar-col">
                <a-avatar
                  :size="30"
                  :src="getLiveAvatarSrc(seg)"
                  :load-error="() => handleLiveAvatarError(seg)"
                  class="live-avatar"
                  :style="{ background: getSpeakerTheme(seg.speakerName || '参会发言人').gradient }"
                >
                  {{ getSpeakerInitial(seg.speakerName || '参会发言人') }}
                </a-avatar>
              </div>

              <!-- 气泡对话框 -->
              <div class="live-speech-bubble">
                <div class="live-bubble-inner">
                  <div class="live-seg-head">
                    <span class="speaker">
                      <span class="speaker-dot"></span>
                      <span class="font-bold">{{ seg.speakerName || '参会发言人' }}</span>
                    </span>
                    <span class="time-pill mono">{{ formatTranscriptMs(seg.startTimeMs) }}</span>
                  </div>
                  <p class="live-seg-text">{{ seg.currentText || seg.text || seg.originalText }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 会议纪要预览面板 -->
      <div v-show="activeTab === 'minutes'" class="tab-panel minutes-preview-panel">
        <div class="minutes-toolbar">
          <span class="min-status">
            状态: <a-tag :color="aiStore.minutesStatusColor">{{ aiStore.minutesStatusLabel }}</a-tag>
          </span>
          <a-button size="small" :loading="aiStore.isAnalyzing" @click="handleTriggerAnalysis">
            <SyncOutlined :spin="aiStore.isAnalyzing" /> 生成/更新纪要
          </a-button>
        </div>

        <div class="minutes-preview-content">
          <div v-if="!aiStore.minutes" class="minutes-empty">
            <a-empty description="会议尚未生成纪要，可点击上方按钮触发多 Agent 流水线" />
          </div>
          <div v-else class="minutes-card-inner">
            <h4 class="m-title">{{ aiStore.minutes.title }}</h4>
            <div class="m-section">
              <span class="sec-label">概述:</span>
              <p class="sec-p">{{ aiStore.minutes.summary }}</p>
            </div>
            <div class="m-section" v-if="aiStore.minutes.conclusions">
              <span class="sec-label">结论:</span>
              <p class="sec-p">{{ aiStore.minutes.conclusions }}</p>
            </div>
            <div class="m-section" v-if="aiStore.agendaTopics.length > 0">
              <span class="sec-label">提炼议题 ({{ aiStore.agendaTopics.length }} 项):</span>
              <ul class="topics-ul">
                <li v-for="(t, i) in aiStore.agendaTopics" :key="i">
                  <strong>{{ t.title }}:</strong> {{ t.discussionSummary }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Agent 控制台与流水线审计 -->
      <div v-show="activeTab === 'agents'" class="tab-panel agents-drawer-panel">
        <AgentExecutionPanel :meeting-id="meetingId" />
      </div>

      <!-- 4. 核心议题面板 -->
      <div v-show="activeTab === 'topics'" class="tab-panel topics-drawer-panel">
        <TopicsPanel :meeting-id="meetingId" />
      </div>

      <!-- 5. 会议决策管理 -->
      <div v-show="activeTab === 'decisions'" class="tab-panel decisions-drawer-panel">
        <DecisionsPanel :meeting-id="meetingId" />
      </div>

      <!-- 6. 待办事项跟踪 -->
      <div v-show="activeTab === 'actionItems'" class="tab-panel actions-drawer-panel">
        <ActionItemsPanel :meeting-id="meetingId" />
      </div>

      <!-- 7. 抽屉内智能问答面板 -->
      <div v-show="activeTab === 'qa'" class="tab-panel qa-drawer-panel">
        <div class="qa-messages-box" ref="qaBoxRef">
          <div v-if="qaList.length === 0" class="qa-empty-hint">
            <CommentOutlined style="font-size: 24px; color: #1677ff; margin-bottom: 6px" />
            <p>在会议进行中向 AI 提问已讨论的事实，回答将自动附带证据引言。</p>
          </div>

          <div
            v-for="(item, i) in qaList"
            :key="i"
            class="qa-bubble-row"
            :class="{ 'is-user': item.role === 'user' }"
          >
            <div class="qa-bubble">
              <div v-if="item.loading" class="qa-loading">
                <a-spin size="small" /> 正在查询转写事实...
              </div>
              <div v-else-if="item.error" class="qa-error">
                {{ item.error }}
              </div>
              <div v-else>
                <p class="qa-text">{{ item.text }}</p>
                <div v-if="item.evidenceList && item.evidenceList.length > 0" class="qa-evi-mini">
                  <span class="evi-h">引自: {{ item.evidenceList[0].speakerName }}</span>
                  <span class="evi-q">"{{ item.evidenceList[0].quoteText }}"</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="qa-input-bar">
          <a-input-search
            v-model:value="qaInputText"
            placeholder="提问会议内容..."
            enter-button="发送"
            :loading="asking"
            @search="handleSendQa"
          />
        </div>
      </div>
    </div>
  </a-drawer>

  <!-- 全屏内置 Agent 智能工作台弹窗（保持当前会议连接，不退出会议） -->
  <MeetingAiWorkspaceModal
    v-model:open="workspaceModalOpen"
    :meeting-id="meetingId"
    :initial-tab="activeTab"
  />
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import {
  RobotOutlined,
  ExportOutlined,
  FullscreenOutlined,
  AudioOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  SyncOutlined,
  CommentOutlined,
  ClusterOutlined,
  OrderedListOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined
} from '@ant-design/icons-vue'
import MeetingAiWorkspaceModal from '@/components/meeting-ai/MeetingAiWorkspaceModal.vue'
import AgentExecutionPanel from '@/components/meeting-ai/AgentExecutionPanel.vue'
import TopicsPanel from '@/components/meeting-ai/TopicsPanel.vue'
import DecisionsPanel from '@/components/meeting-ai/DecisionsPanel.vue'
import ActionItemsPanel from '@/components/meeting-ai/ActionItemsPanel.vue'
import {
  createRealtimeSession,
  streamAudioChunk,
  closeRealtimeSession,
  askMeetingQa,
  getTranscriptSegments
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useMeetingStore } from '@/stores/meeting'
import {
  getSpeakerTheme,
  getSpeakerInitial,
  formatTranscriptMs,
  resolveSpeakerAvatarUrl
} from '@/utils/transcript'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  meetingId: {
    type: String,
    required: true
  },
  localStream: {
    type: Object,
    default: null
  },
  remoteStreams: {
    type: Object,
    default: () => ({})
  },
  onWs: {
    type: Function,
    default: null
  },
  isHost: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:open'])

const router = useRouter()
const aiStore = useMeetingAiStore()
const meetingStore = useMeetingStore()

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onDrawerWindowResize() {
  windowWidth.value = window.innerWidth
}

const drawerWidth = computed(() => {
  if (windowWidth.value < 640) {
    return '100%'
  }
  return 480
})

const avatarVersion = Date.now()
const failedLiveAvatarUrls = reactive(new Set())
const focusedLiveKey = ref(null)

function getLiveSegKey(seg, idx) {
  return seg?.segmentId || `idx-${idx}`
}

function getLiveItemVars(seg) {
  const theme = getSpeakerTheme(seg?.speakerName || '参会发言人')
  return {
    '--speaker-color': theme.color,
    '--speaker-tint-border': theme.tintBorder,
    '--speaker-glow': theme.glow
  }
}

function getLiveAvatarSrc(seg) {
  const url = resolveSpeakerAvatarUrl(seg, meetingStore.memberList, avatarVersion)
  if (!url || failedLiveAvatarUrls.has(url)) return undefined
  return url
}

function handleLiveAvatarError(seg) {
  const url = resolveSpeakerAvatarUrl(seg, meetingStore.memberList, avatarVersion)
  if (url) failedLiveAvatarUrls.add(url)
  return true
}

function handleLiveTap(seg, idx) {
  if (typeof window !== 'undefined') {
    const selectedText = window.getSelection?.()?.toString()
    if (selectedText) return
  }
  if (windowWidth.value <= 768 || (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches)) {
    const key = getLiveSegKey(seg, idx)
    focusedLiveKey.value = focusedLiveKey.value === key ? null : key
  }
}

const activeTab = ref('realtime') // 'realtime' | 'agents' | 'minutes' | 'topics' | 'decisions' | 'actionItems' | 'qa'
const workspaceModalOpen = ref(false)

function openWorkspaceModal() {
  workspaceModalOpen.value = true
}

function openInExternalTab() {
  const routeUrl = router.resolve(`/meeting/ai/${props.meetingId}`)
  const fullUrl = window.location.origin + routeUrl.href
  const newWin = window.open(fullUrl, '_blank', 'noopener,noreferrer')
  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    workspaceModalOpen.value = true
    message.info('当前浏览器阻止了新窗口弹出，已为您在当前会议内开启全屏工作台')
  } else {
    message.success('已在新标签页打开独立工作台，当前视频会议保持连接')
  }
}

// 实时转写状态
const isSessionActive = ref(false)
const startingSession = ref(false)
const currentSessionId = ref('')
const chunkIndex = ref(0)
const hasAutoStarted = ref(false)
const userManuallyStopped = ref(false)
let mediaRecorder = null
let audioContextInstance = null
let mixerDestination = null
const connectedSourceNodes = new Map()
const realtimeSegments = ref([])
const segmentsBoxRef = ref(null)

// 动态将一条音频流接入混音器
function connectStreamToMixer(stream, audioCtx, destination) {
  if (!stream || !audioCtx || !destination) return
  if (typeof stream.getAudioTracks !== 'function') return
  const audioTracks = stream.getAudioTracks()
  if (!audioTracks || audioTracks.length === 0) return

  const streamId = stream.id || String(Math.random())
  if (connectedSourceNodes.has(streamId)) return

  try {
    const sourceNode = audioCtx.createMediaStreamSource(stream)
    sourceNode.connect(destination)
    connectedSourceNodes.set(streamId, sourceNode)
  } catch (err) {
    console.warn('连接音频流到混音器失败', streamId, err)
  }
}

// 清理所有混音源节点
function disconnectAllMixerSources() {
  connectedSourceNodes.forEach((node) => {
    try {
      node.disconnect()
    } catch (e) {}
  })
  connectedSourceNodes.clear()
}

// 启动 MediaRecorder 录制并周期推送分片
function startRecording(stream) {
  if (!stream) return
  if (mediaRecorder && mediaRecorder.state !== 'inactive') return

  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    mediaRecorder = new MediaRecorder(stream, { mimeType })

    mediaRecorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0 && isSessionActive.value) {
        chunkIndex.value++
        const currentIdx = chunkIndex.value
        try {
          const formData = new FormData()
          formData.append('sessionId', currentSessionId.value)
          formData.append('chunkIndex', currentIdx)
          formData.append('audioData', e.data, `chunk_${currentIdx}.webm`)
          formData.append('isLastChunk', false)

          const seg = await streamAudioChunk(formData)
          if (seg && seg.originalText) {
            appendOrUpdateSegment(seg)
          }
        } catch (err) {
          console.warn('分片推送转写异常', err)
        }
      }
    }

    // 每 3000ms 切分一个音频块
    mediaRecorder.start(3000)
  } catch (e) {
    console.warn('初始化音频 MediaRecorder 失败，转写将依靠信令广播', e)
  }
}

// 自动检测并启动实时转写会话（如弹窗勾选或后端会议配置已开启）
async function autoStartTranscriptionIfNeeded() {
  if (userManuallyStopped.value || hasAutoStarted.value || isSessionActive.value || startingSession.value) {
    return
  }

  const isEnabledInStorage = sessionStorage.getItem('initial_transcription_enabled') === '1'
  const isEnabledInStore = Boolean(aiStore.isTranscriptionEnabled)

  if (!isEnabledInStorage && !isEnabledInStore) {
    return
  }

  if (!props.meetingId) {
    return
  }

  hasAutoStarted.value = true
  console.log('💡 弹窗或会议配置中已开启实时转写，自动触发开启转写会话...')
  await startRealtimeSession(true)
}

// 监听本地麦克风音频流的变化，动态接入混音器并适时触发自动开启转写
watch(
  () => props.localStream,
  (newLocal) => {
    if (newLocal) {
      if (!isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
        autoStartTranscriptionIfNeeded()
      } else if (isSessionActive.value) {
        if (audioContextInstance && mixerDestination) {
          connectStreamToMixer(newLocal, audioContextInstance, mixerDestination)
        } else if (!mediaRecorder) {
          const audioTracks = newLocal.getAudioTracks()
          if (audioTracks && audioTracks.length > 0) {
            startRecording(new MediaStream([audioTracks[0]]))
          }
        }
      }
    }
  }
)

// 监听房间远端成员音频流的变化，动态接入新参会者的发言
watch(
  () => props.remoteStreams,
  (newRemote) => {
    if (isSessionActive.value && audioContextInstance && mixerDestination && newRemote) {
      Object.values(newRemote).forEach((rStream) => {
        connectStreamToMixer(rStream, audioContextInstance, mixerDestination)
      })
    }
  },
  { deep: true }
)

// 监听转写配置开关变化
watch(
  () => aiStore.isTranscriptionEnabled,
  (enabled) => {
    if (enabled && !isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
      autoStartTranscriptionIfNeeded()
    }
  }
)

// 监听抽屉打开事件，确保就绪状态可自动转为开启中
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && !isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
      autoStartTranscriptionIfNeeded()
    }
  }
)

// 监听 meetingId 变化
watch(
  () => props.meetingId,
  (newMeetingId) => {
    if (newMeetingId) {
      initDrawerData()
      aiStore.fetchFeatureStatus(newMeetingId).then(() => {
        autoStartTranscriptionIfNeeded()
      })
    }
  }
)

// 问答
const qaList = ref([])
const qaInputText = ref('')
const asking = ref(false)
const qaBoxRef = ref(null)

// 开启 / 停止实时转写
async function toggleRealtimeSession() {
  if (isSessionActive.value) {
    stopRealtimeSession()
  } else {
    userManuallyStopped.value = false
    startRealtimeSession(false)
  }
}

async function startRealtimeSession(isAuto = false) {
  if (!props.meetingId || startingSession.value || isSessionActive.value) return

  startingSession.value = true
  try {
    // 1. 使用 Web Audio API 进行全场声音混音（本地麦克风 + 房间内所有远端参会者的音频）
    let audioStream = null
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      try {
        disconnectAllMixerSources()
        audioContextInstance = new AudioContextClass()
        if (audioContextInstance.state === 'suspended') {
          await audioContextInstance.resume()
        }
        mixerDestination = audioContextInstance.createMediaStreamDestination()

        // 1.1 接入本地麦克风流
        if (props.localStream) {
          connectStreamToMixer(props.localStream, audioContextInstance, mixerDestination)
        }
        // 1.2 接入当前已有的所有远端参会者音频流
        if (props.remoteStreams) {
          Object.values(props.remoteStreams).forEach((rStream) => {
            connectStreamToMixer(rStream, audioContextInstance, mixerDestination)
          })
        }

        if (mixerDestination.stream && mixerDestination.stream.getAudioTracks().length > 0) {
          audioStream = mixerDestination.stream
        }
      } catch (err) {
        console.warn('初始化 Web Audio 混音器失败，降级使用本地麦克风', err)
      }
    }

    // 2. 降级方案：若混音器不可用，直接使用本地麦克风（不使用 clone() 避免 Chromium 静音 Bug）
    if (!audioStream && props.localStream && typeof props.localStream.getAudioTracks === 'function') {
      const audioTracks = props.localStream.getAudioTracks()
      if (audioTracks && audioTracks.length > 0) {
        audioStream = new MediaStream([audioTracks[0]])
      }
    }

    // 3. 调用后端创建实时转写会话
    const session = await createRealtimeSession({
      meetingId: props.meetingId,
      sampleRate: 16000,
      audioFormat: 'webm'
    })

    currentSessionId.value = session.sessionId
    chunkIndex.value = 0
    isSessionActive.value = true

    // 4. 启动 MediaRecorder 周期分片推送
    if (audioStream) {
      startRecording(audioStream)
    }

    if (isAuto) {
      message.success('已自动开启全场实时语音转写')
    } else {
      message.success('实时转写会话已建立')
    }
  } catch (err) {
    message.error(err.message || '开启实时转写失败')
    isSessionActive.value = false
    disconnectAllMixerSources()
    if (audioContextInstance) {
      try {
        audioContextInstance.close()
      } catch (e) {}
      audioContextInstance = null
    }
    mixerDestination = null
  } finally {
    startingSession.value = false
  }
}

async function stopRealtimeSession() {
  // 先将状态置为 false，避免 stop() 触发的最后一段碎片再并发发起网络请求
  userManuallyStopped.value = true
  isSessionActive.value = false

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop()
    } catch (e) {}
    mediaRecorder = null
  }

  // 释放混音器资源
  disconnectAllMixerSources()
  if (audioContextInstance) {
    try {
      audioContextInstance.close()
    } catch (e) {}
    audioContextInstance = null
  }
  mixerDestination = null

  const sid = currentSessionId.value
  currentSessionId.value = ''

  if (sid) {
    try {
      await closeRealtimeSession({ sessionId: sid })
    } catch (e) {}
  }

  message.info('实时转写会话已关闭')
}

function appendOrUpdateSegment(seg) {
  if (!seg) return
  const existingIdx = realtimeSegments.value.findIndex((s) => s.segmentId === seg.segmentId)
  if (existingIdx !== -1) {
    realtimeSegments.value[existingIdx] = seg
  } else {
    realtimeSegments.value.push(seg)
  }

  nextTick(() => {
    if (segmentsBoxRef.value) {
      segmentsBoxRef.value.scrollTop = segmentsBoxRef.value.scrollHeight
    }
  })
}

// 问答
async function handleSendQa() {
  const text = qaInputText.value.trim()
  if (!text || asking.value) return

  qaList.value.push({ role: 'user', text })
  qaInputText.value = ''

  const aiIdx = qaList.value.length
  qaList.value.push({
    role: 'ai',
    text: '',
    loading: true,
    error: null,
    evidenceList: []
  })

  asking.value = true
  try {
    const res = await askMeetingQa({
      meetingId: props.meetingId,
      question: text
    })
    qaList.value[aiIdx].loading = false
    qaList.value[aiIdx].text = res?.answer || '无回答'
    qaList.value[aiIdx].evidenceList = res?.evidenceList || []
  } catch (err) {
    qaList.value[aiIdx].loading = false
    qaList.value[aiIdx].error = err.message || '问答失败'
  } finally {
    asking.value = false
    nextTick(() => {
      if (qaBoxRef.value) {
        qaBoxRef.value.scrollTop = qaBoxRef.value.scrollHeight
      }
    })
  }
}

function handleTriggerAnalysis() {
  aiStore.triggerAnalysis(props.meetingId, true)
}

// 初始化加载已存转写与纪要
async function initDrawerData() {
  if (!props.meetingId) return
  aiStore.loadMinutes(props.meetingId)
  try {
    const res = await getTranscriptSegments({
      meetingId: props.meetingId,
      pageNo: 1,
      pageSize: 30
    })
    if (res && res.list) {
      realtimeSegments.value = res.list
    }
  } catch (e) {}
}

let unbindWsTranscript = null
let unbindWsDecision = null
let unbindWsMinutes = null

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onDrawerWindowResize)
  }
  if (props.meetingId) {
    aiStore.initMeeting(props.meetingId)
  }
  initDrawerData()
  if (props.meetingId) {
    try {
      await aiStore.fetchFeatureStatus(props.meetingId)
    } catch (e) {}
  }

  // 立即检查并尝试自动开启实时转写
  autoStartTranscriptionIfNeeded()

  // 延时 1.2 秒再次检查（针对本地设备流获取略微延迟的场景进行兜底启动）
  setTimeout(() => {
    if (!isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
      autoStartTranscriptionIfNeeded()
    }
  }, 1200)

  // 页面全局交互时恢复 AudioContext 状态，避免受浏览器音频自动播放策略挂起
  const resumeAudioCtx = () => {
    if (audioContextInstance && audioContextInstance.state === 'suspended') {
      audioContextInstance.resume().catch(() => {})
    }
  }
  window.addEventListener('click', resumeAudioCtx, { once: true })

  // 注册 WebSocket 增量转写、实时决策与纪要生成全员广播监听
  if (typeof props.onWs === 'function') {
    unbindWsTranscript = props.onWs(20, (data) => {
      const seg = data.meesageContent || data
      if (seg) {
        appendOrUpdateSegment(seg)
      }
    })

    unbindWsDecision = props.onWs(30, (data) => {
      const eventDto = data.meesageContent || data
      if (eventDto) {
        aiStore.handleDecisionEvent(eventDto)
      }
    })

    unbindWsMinutes = props.onWs(22, async (data) => {
      console.log('💡 收到会议纪要与多 Agent 流水线分析完成广播 (type 22):', data)
      const targetId = props.meetingId || data?.meetingId || data?.meesageContent?.meetingId
      if (targetId) {
        await Promise.allSettled([
          aiStore.loadMinutes(targetId),
          aiStore.loadDecisions(targetId),
          aiStore.loadActionItems(targetId)
        ])
      }
    })
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onDrawerWindowResize)
  }
  if (isSessionActive.value) {
    stopRealtimeSession()
  }
  if (typeof unbindWsTranscript === 'function') {
    unbindWsTranscript()
  }
  if (typeof unbindWsDecision === 'function') {
    unbindWsDecision()
  }
  if (typeof unbindWsMinutes === 'function') {
    unbindWsMinutes()
  }
})
</script>

<style scoped>
.drawer-top-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #f0f7ff;
  border-bottom: 1px solid #d6e4ff;
}

.banner-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.drawer-tabs-header {
  display: flex;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-bottom: 1px solid var(--border-color);
  background: #fafafa;
}

.drawer-tabs-header::-webkit-scrollbar {
  display: none;
}

.d-tab-btn {
  flex: 0 0 auto;
  padding: 10px 12px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  position: relative;
  transition: all 0.2s;
}

.d-tab-btn.active {
  color: #1677ff;
  font-weight: 600;
  border-bottom: 2px solid #1677ff;
  background: #ffffff;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #52c41a;
}

.badge-dot.pulse {
  background: #1677ff;
  animation: pulse-badge-dot 1.5s infinite ease-in-out;
}

@keyframes pulse-badge-dot {
  0% { transform: scale(0.85); opacity: 0.6; }
  50% { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(0.85); opacity: 0.6; }
}

.drawer-content-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-panel {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.realtime-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d9d9d9;
}

.pulse-dot.recording {
  background: #52c41a;
  box-shadow: 0 0 6px #52c41a;
}

.realtime-segments-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 18px 18px 12px;
  background: linear-gradient(180deg, #f8fafd 0%, #f3f6fb 100%);
}

.realtime-empty {
  padding: 40px 0;
  text-align: center;
}

.live-timeline {
  display: flex;
  flex-direction: column;
}

.live-timeline-item {
  position: relative;
  display: flex;
  align-items: stretch;
  padding-bottom: 12px;
  transition: opacity 0.22s ease;
  z-index: 1;
}

.live-timeline-item.is-last {
  padding-bottom: 4px;
}

.live-timeline-item.is-focused {
  z-index: 10;
}

.live-axis {
  width: 16px;
  flex-shrink: 0;
  margin-right: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.live-axis-top,
.live-axis-bottom {
  width: 2px;
  background: #dce3ee;
}

.live-axis-top {
  height: 11px;
  flex-shrink: 0;
}

.live-axis-bottom {
  flex: 1;
  min-height: 12px;
}

.live-timeline-item.is-first .live-axis-top,
.live-timeline-item.is-last .live-axis-bottom {
  opacity: 0;
}

.live-axis-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ffffff;
  border: 2.5px solid var(--speaker-color, #1677ff);
  flex-shrink: 0;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.22s ease,
    box-shadow 0.28s ease;
}

.live-avatar-col {
  flex-shrink: 0;
  padding-top: 1px;
  margin-right: 9px;
}

.live-avatar {
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.1), 0 0 0 1.5px #ffffff;
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.28s ease;
}

.live-speech-bubble {
  --bubble-bg: #ffffff;
  --bubble-border: #e5ebf3;
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  border-radius: 5px 12px 12px 12px;
  padding: 9px 12px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  transform: translate3d(0, 0, 0) scale(1);
  transform-origin: left center;
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.28s ease,
    border-color 0.22s ease;
}

.live-speech-bubble::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 12px;
  width: 8px;
  height: 8px;
  background: var(--bubble-bg);
  border-left: 1px solid var(--bubble-border);
  border-bottom: 1px solid var(--bubble-border);
  border-bottom-left-radius: 2px;
  transform: rotate(45deg);
  transition: border-color 0.22s ease;
  z-index: 1;
}

.live-bubble-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.live-seg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.speaker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-main, #1f2329);
}

.speaker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--speaker-color, #1677ff);
}

.time-pill {
  font-size: 10.5px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #1677ff;
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  padding: 1px 6px;
  border-radius: 999px;
}

.live-seg-text {
  font-size: 13px;
  color: var(--text-main, #1f2329);
  line-height: 1.55;
  margin: 0;
  word-break: break-word;
}

@media (hover: hover) {
  .live-timeline:hover .live-timeline-item:not(:hover):not(.is-focused) {
    opacity: 0.84;
  }

  .live-timeline-item:hover {
    z-index: 12;
    opacity: 1;
  }

  .live-timeline-item:hover .live-axis-dot {
    background: var(--speaker-color, #1677ff);
    border-color: #ffffff;
    transform: scale(1.42);
    box-shadow: 0 0 0 4px var(--speaker-glow, rgba(22, 119, 255, 0.22));
  }

  .live-timeline-item:hover .live-avatar {
    transform: translateY(-2px) scale(1.1);
    box-shadow:
      0 6px 14px var(--speaker-glow, rgba(22, 119, 255, 0.22)),
      0 0 0 2px #ffffff,
      0 0 0 3.5px var(--speaker-tint-border, #91caff);
  }

  .live-timeline-item:hover .live-speech-bubble {
    --bubble-border: var(--speaker-tint-border, #69b1ff);
    transform: translate3d(4px, -3px, 0) scale(1.015);
    box-shadow:
      0 12px 24px -8px rgba(15, 23, 42, 0.14),
      0 6px 12px -4px var(--speaker-glow, rgba(22, 119, 255, 0.22));
  }
}

.live-timeline-item.is-focused .live-axis-dot {
  background: var(--speaker-color, #1677ff);
  border-color: #ffffff;
  transform: scale(1.36);
  box-shadow: 0 0 0 4px var(--speaker-glow, rgba(22, 119, 255, 0.22));
}

.live-timeline-item.is-focused .live-speech-bubble {
  --bubble-border: var(--speaker-tint-border, #69b1ff);
  transform: translate3d(3px, -2px, 0) scale(1.012);
  box-shadow:
    0 10px 20px -6px rgba(15, 23, 42, 0.14),
    0 4px 10px -4px var(--speaker-glow, rgba(22, 119, 255, 0.22));
}

.minutes-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.min-status {
  font-size: 12px;
}

.minutes-preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.minutes-empty {
  padding: 40px 0;
  text-align: center;
}

.minutes-card-inner {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.m-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.m-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sec-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.sec-p {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  color: var(--text-main);
}

.topics-ul {
  padding-left: 18px;
  margin: 0;
  font-size: 12px;
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.qa-messages-box {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fafafa;
}

.qa-empty-hint {
  padding: 40px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.qa-bubble-row {
  display: flex;
}

.qa-bubble-row.is-user {
  justify-content: flex-end;
}

.qa-bubble {
  max-width: 85%;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
}

.qa-bubble-row.is-user .qa-bubble {
  background: #1677ff;
  color: #ffffff;
  border-color: #1677ff;
}

.qa-text {
  margin: 0;
}

.qa-loading {
  font-size: 12px;
  color: var(--text-secondary);
}

.qa-error {
  color: #ff4d4f;
  font-size: 12px;
}

.qa-evi-mini {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed #e8e8e8;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.evi-h {
  color: #1677ff;
  font-weight: 600;
}

.evi-q {
  font-style: italic;
}

.qa-input-bar {
  padding: 10px 14px;
  background: #ffffff;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 640px) {
  .drawer-top-banner {
    padding: 8px 12px;
  }
  .banner-text {
    font-size: 12px;
  }
  .d-tab-btn {
    padding: 8px 0;
    font-size: 12px;
  }
  .realtime-control-bar {
    padding: 8px 12px;
  }
  .realtime-segments-list {
    padding: 12px 14px 16px 8px;
  }
  .live-speech-bubble {
    padding: 8px 10px;
  }
  .live-timeline-item:active .live-speech-bubble {
    transform: translate3d(2px, -2px, 0) scale(1.008);
  }
  .minutes-preview-content {
    padding: 12px;
  }
  .qa-messages-box {
    padding: 10px;
  }
  .qa-bubble {
    max-width: 92%;
  }
}
</style>

