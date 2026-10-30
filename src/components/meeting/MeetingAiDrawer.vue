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
      <a-button type="link" size="small" @click="openFullWorkspace">
        打开完整工作台 <ExportOutlined />
      </a-button>
    </div>

    <!-- 标签页导航：实时转写 / 会议纪要 / 快捷问答 -->
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
        :class="{ active: activeTab === 'minutes' }"
        @click="activeTab = 'minutes'"
      >
        <FileTextOutlined />
        <span>会议纪要</span>
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

          <div
            v-for="(seg, idx) in realtimeSegments"
            :key="seg.segmentId || idx"
            class="live-seg-card"
          >
            <div class="live-seg-head">
              <span class="speaker font-bold">{{ seg.speakerName || '参会发言人' }}</span>
              <span class="time mono">{{ formatMs(seg.startTimeMs) }}</span>
            </div>
            <p class="live-seg-text">{{ seg.currentText || seg.text || seg.originalText }}</p>
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

      <!-- 3. 抽屉内智能问答面板 -->
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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import {
  RobotOutlined,
  ExportOutlined,
  AudioOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  SyncOutlined,
  CommentOutlined
} from '@ant-design/icons-vue'
import {
  createRealtimeSession,
  streamAudioChunk,
  closeRealtimeSession,
  askMeetingQa,
  getTranscriptSegments
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'

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

const drawerWidth = computed(() => {
  if (typeof window !== 'undefined' && window.innerWidth < 640) {
    return '100%'
  }
  return 420
})

const activeTab = ref('realtime') // 'realtime' | 'minutes' | 'qa'

// 实时转写状态
const isSessionActive = ref(false)
const startingSession = ref(false)
const currentSessionId = ref('')
const chunkIndex = ref(0)
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

// 问答
const qaList = ref([])
const qaInputText = ref('')
const asking = ref(false)
const qaBoxRef = ref(null)

function formatMs(ms) {
  if (!ms && ms !== 0) return '00:00'
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function openFullWorkspace() {
  const url = router.resolve(`/meeting/ai/${props.meetingId}`).href
  window.open(url, '_blank')
}

// 开启 / 停止实时转写
async function toggleRealtimeSession() {
  if (isSessionActive.value) {
    stopRealtimeSession()
  } else {
    startRealtimeSession()
  }
}

async function startRealtimeSession() {
  if (!props.meetingId) return

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
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

        mediaRecorder = new MediaRecorder(audioStream, { mimeType })

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

    message.success('实时转写会话已建立')
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

let unbindWs = null

onMounted(() => {
  initDrawerData()

  // 注册 WebSocket 增量转写消息监听 (messageType 20)
  if (typeof props.onWs === 'function') {
    unbindWs = props.onWs(20, (data) => {
      const seg = data.meesageContent || data
      if (seg) {
        appendOrUpdateSegment(seg)
      }
    })
  }
})

onUnmounted(() => {
  if (isSessionActive.value) {
    stopRealtimeSession()
  }
  if (typeof unbindWs === 'function') {
    unbindWs()
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

.drawer-tabs-header {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: #fafafa;
}

.d-tab-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
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
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fafafa;
}

.realtime-empty {
  padding: 40px 0;
  text-align: center;
}

.live-seg-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.live-seg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.speaker {
  color: #1677ff;
}

.time {
  color: var(--text-tertiary);
}

.live-seg-text {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
  margin: 0;
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
    padding: 10px 12px;
  }
  .live-seg-card {
    padding: 8px 10px;
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

