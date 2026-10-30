<template>
  <div class="meeting-qa-panel">
    <!-- 头部栏 -->
    <div class="panel-header">
      <div class="header-left">
        <div class="ai-avatar-icon">
          <RobotOutlined />
        </div>
        <div>
          <h3 class="panel-title">会议智能知识问答</h3>
          <span class="panel-subtitle">基于 Spring AI 检索会议事实上下文，精准溯源发言证据</span>
        </div>
      </div>

      <div class="header-right">
        <a-button size="small" @click="fetchHistory">
          <HistoryOutlined /> 问答历史
        </a-button>
        <a-button size="small" @click="clearMessages">
          <ClearOutlined /> 清屏
        </a-button>
      </div>
    </div>

    <!-- 问答消息滚动区域 -->
    <div class="messages-container" ref="messagesScrollRef">
      <!-- 欢迎与快捷提问提示 -->
      <div v-if="messages.length === 0" class="welcome-box">
        <div class="welcome-icon">
          <CommentOutlined style="font-size: 32px; color: #1677ff" />
        </div>
        <h4 class="welcome-title">欢迎使用会议智能问答助手</h4>
        <p class="welcome-desc">
          您可以针对当前会议中的讨论细节、议题共识、任务分工或具体发言进行提问，AI 助手将检索转写证据进行事实性回答。
        </p>

        <!-- 推荐快捷问题 chips -->
        <div class="quick-questions">
          <span class="quick-title">推荐提问:</span>
          <div class="chips-wrapper">
            <button
              v-for="(q, idx) in suggestedQuestions"
              :key="idx"
              class="question-chip"
              @click="handleQuickAsk(q)"
            >
              {{ q }}
            </button>
          </div>
        </div>
      </div>

      <!-- 消息气泡列表 -->
      <div v-else class="messages-list">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="message-row"
          :class="{ 'is-user': msg.role === 'user', 'is-ai': msg.role === 'ai' }"
        >
          <!-- 头像 -->
          <div class="msg-avatar">
            <a-avatar
              v-if="msg.role === 'user'"
              :size="34"
              style="background-color: #1677ff"
            >
              {{ authStore.nickName?.slice(0, 1) || '我' }}
            </a-avatar>
            <div v-else class="ai-avatar-badge">
              <RobotOutlined />
            </div>
          </div>

          <!-- 气泡内容 -->
          <div class="msg-content-wrapper">
            <div class="msg-sender-name">
              {{ msg.role === 'user' ? (authStore.nickName || '我') : 'EasyMeeting AI 助手' }}
              <span class="msg-time">{{ msg.time }}</span>
            </div>

            <!-- 用户提问气泡 -->
            <div v-if="msg.role === 'user'" class="user-bubble">
              {{ msg.text }}
            </div>

            <!-- AI 回答卡片 -->
            <div v-else class="ai-bubble">
              <!-- 加载中动画 -->
              <div v-if="msg.loading" class="ai-loading">
                <a-spin size="small" />
                <span class="loading-text">正在检索会议转写片段与 Agent 分析记忆...</span>
              </div>

              <!-- 错误提示 -->
              <div v-else-if="msg.error" class="ai-error-box">
                <CloseCircleOutlined style="color: #ff4d4f" />
                <span>{{ msg.error }}</span>
              </div>

              <!-- 正常回答 -->
              <div v-else class="ai-answer-body">
                <div class="answer-text">
                  {{ msg.text }}
                </div>

                <!-- 无证据说明 -->
                <div v-if="msg.hasEvidence === false" class="no-evidence-alert">
                  <InfoCircleOutlined /> 会议记录中未检索到与该问题直接相关的明确发言证据，请以参会人实际记录为准。
                </div>

                <!-- 证据链溯源卡片 -->
                <div v-if="msg.evidenceList && msg.evidenceList.length > 0" class="evidence-section">
                  <div class="evidence-header">
                    <CheckCircleOutlined style="color: #52c41a" />
                    <span>引用证据来源 (共 {{ msg.evidenceList.length }} 处):</span>
                    <span v-if="msg.confidence" class="confidence-badge">
                      置信度: {{ (msg.confidence * 100).toFixed(0) }}%
                    </span>
                  </div>

                  <div class="evidence-cards">
                    <div
                      v-for="(evi, eviIdx) in msg.evidenceList"
                      :key="eviIdx"
                      class="evidence-card"
                      @click="jumpToEvidence(evi)"
                    >
                      <div class="evi-meta">
                        <span class="evi-speaker font-semibold">{{ evi.speakerName || '参会者' }}</span>
                        <span class="evi-time mono">{{ formatMs(evi.startTimeMs) }} - {{ formatMs(evi.endTimeMs) }}</span>
                        <span class="evi-jump-hint"><RightCircleOutlined /> 跳转定位</span>
                      </div>
                      <p class="evi-quote">"{{ evi.quoteText }}"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部输入框 -->
    <div class="input-container">
      <div class="input-inner">
        <a-textarea
          v-model:value="inputText"
          placeholder="问问 AI 助手：例如「这场会议确定了什么方案？」(Enter 发送，Shift + Enter 换行)"
          :auto-size="{ minRows: 2, maxRows: 5 }"
          :disabled="isAsking"
          @keydown="handleKeyDown"
        />
        <div class="input-actions">
          <span class="char-hint">支持对单场会议细节提问</span>
          <a-button
            type="primary"
            :loading="isAsking"
            :disabled="!inputText.trim()"
            @click="sendQuestion"
          >
            <SendOutlined /> 发送提问
          </a-button>
        </div>
      </div>
    </div>

    <!-- 问答历史弹窗 -->
    <a-modal
      v-model:open="historyModalVisible"
      title="会议问答历史记录"
      :footer="null"
      :width="modalWidth(640)"
    >
      <a-spin :spinning="loadingHistory">
        <div v-if="historyRecords.length === 0" style="padding: 30px 0; text-align: center">
          <a-empty description="暂无历史问答记录" />
        </div>
        <div v-else class="history-list">
          <div
            v-for="rec in historyRecords"
            :key="rec.qaId"
            class="history-qa-item"
          >
            <div class="history-q">
              <strong>问:</strong> {{ rec.question }}
            </div>
            <div class="history-a">
              <strong>答:</strong> {{ rec.answer }}
            </div>
            <div class="history-time">
              <span>{{ rec.createTime }}</span>
              <a-tag v-if="rec.hasEvidence === 1" color="green" size="small">有证据支撑</a-tag>
            </div>
          </div>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  RobotOutlined,
  CommentOutlined,
  HistoryOutlined,
  ClearOutlined,
  SendOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  RightCircleOutlined
} from '@ant-design/icons-vue'
import { askMeetingQa, getQaHistory } from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const aiStore = useMeetingAiStore()
const authStore = useAuthStore()

const inputText = ref('')
const isAsking = ref(false)
const messages = ref([])
const messagesScrollRef = ref(null)

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onWindowResize() {
  windowWidth.value = window.innerWidth
}
function modalWidth(defaultWidth) {
  return windowWidth.value < 640 ? '94vw' : `${defaultWidth}px`
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize)
  }
})

// 历史记录
const historyModalVisible = ref(false)
const loadingHistory = ref(false)
const historyRecords = ref([])

const suggestedQuestions = [
  '这场会议主要讨论了哪些议题？',
  '会议最终达成了哪些决策？',
  '谁负责后续行动项的推进？',
  '本次会议有没有未解决的待定事项？'
]

function formatMs(ms) {
  if (!ms && ms !== 0) return '00:00'
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesScrollRef.value) {
      messagesScrollRef.value.scrollTop = messagesScrollRef.value.scrollHeight
    }
  })
}

function handleQuickAsk(q) {
  inputText.value = q
  sendQuestion()
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendQuestion()
  }
}

async function sendQuestion() {
  const text = inputText.value.trim()
  if (!text || isAsking.value) return

  const nowTime = dayjs().format('HH:mm:ss')

  // 1. 添加用户消息
  messages.value.push({
    role: 'user',
    text,
    time: nowTime
  })

  inputText.value = ''
  scrollToBottom()

  // 2. 占位 AI 消息 (loading 状态)
  const aiMsgIndex = messages.value.length
  messages.value.push({
    role: 'ai',
    text: '',
    time: nowTime,
    loading: true,
    error: null,
    hasEvidence: true,
    evidenceList: [],
    confidence: 1.0
  })
  scrollToBottom()

  isAsking.value = true

  try {
    const res = await askMeetingQa({
      meetingId: props.meetingId,
      question: text
    })

    if (res) {
      messages.value[aiMsgIndex].loading = false
      messages.value[aiMsgIndex].text = res.answer || '已处理提问'
      messages.value[aiMsgIndex].hasEvidence = res.hasEvidence
      messages.value[aiMsgIndex].evidenceList = res.evidenceList || []
      messages.value[aiMsgIndex].confidence = res.confidence ?? 1.0
    }
  } catch (err) {
    messages.value[aiMsgIndex].loading = false
    messages.value[aiMsgIndex].error = err.message || '问答服务调用异常，请稍后重试'
  } finally {
    isAsking.value = false
    scrollToBottom()
  }
}

function clearMessages() {
  messages.value = []
}

function jumpToEvidence(evi) {
  if (evi && evi.segmentId) {
    aiStore.jumpToSegment(evi.segmentId, evi.startTimeMs)
  }
}

async function fetchHistory() {
  historyModalVisible.value = true
  loadingHistory.value = true
  historyRecords.value = []
  try {
    const res = await getQaHistory({
      meetingId: props.meetingId,
      pageNo: 1,
      pageSize: 20
    })
    historyRecords.value = res?.list || []
  } catch (err) {
    message.error(err.message || '获取问答历史失败')
  } finally {
    loadingHistory.value = false
  }
}

watch(
  () => props.meetingId,
  () => {
    clearMessages()
  }
)
</script>

<style scoped>
.meeting-qa-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-card);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  background: #fafafa;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1677ff 0%, #36cfc9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 20px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--text-main);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fdfdfd;
}

.welcome-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.welcome-icon {
  margin-bottom: 12px;
}

.welcome-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 8px 0;
}

.welcome-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 24px 0;
}

.quick-questions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.quick-title {
  font-size: 12px;
  color: var(--text-tertiary);
}

.chips-wrapper {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.question-chip {
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 12px;
  color: #1677ff;
  cursor: pointer;
  transition: all 0.2s;
}

.question-chip:hover {
  border-color: #1677ff;
  background: #f0f7ff;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 860px;
  margin: 0 auto;
}

.message-row {
  display: flex;
  gap: 12px;
}

.message-row.is-user {
  flex-direction: row-reverse;
}

.ai-avatar-badge {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 17px;
}

.msg-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 80%;
}

.message-row.is-user .msg-content-wrapper {
  align-items: flex-end;
}

.msg-sender-name {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.msg-time {
  font-size: 11px;
}

.user-bubble {
  background: #1677ff;
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 12px 2px 12px 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.ai-bubble {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  padding: 14px 16px;
  border-radius: 2px 12px 12px 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-main);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.ai-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.ai-error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff4d4f;
  font-size: 13px;
}

.answer-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main);
  white-space: pre-line;
}

.no-evidence-alert {
  margin-top: 10px;
  font-size: 12px;
  color: #fa8c16;
  background: #fffbe6;
  padding: 6px 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.evidence-section {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #e8e8e8;
}

.evidence-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.confidence-badge {
  font-size: 11px;
  color: #52c41a;
  background: #f6ffed;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid #b7eb8f;
  margin-left: auto;
}

.evidence-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.evidence-card {
  background: #f8faff;
  border: 1px solid #d9e8ff;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.evidence-card:hover {
  background: #eef5ff;
  border-color: #91caff;
  transform: translateX(2px);
}

.evi-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 4px;
}

.evi-speaker {
  color: #1677ff;
}

.evi-time {
  color: var(--text-tertiary);
}

.evi-jump-hint {
  margin-left: auto;
  color: #1677ff;
  font-size: 11px;
}

.evi-quote {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  font-style: italic;
}

.input-container {
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  background: #ffffff;
}

.input-inner {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.char-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-qa-item {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-q {
  font-size: 14px;
  color: #1677ff;
}

.history-a {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
}

.history-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

@media (max-width: 768px) {
  .panel-header {
    padding: 10px 14px;
  }

  .panel-subtitle {
    display: none;
  }

  .messages-container {
    padding: 12px 10px;
  }

  .welcome-box {
    padding: 24px 10px;
  }

  .welcome-title {
    font-size: 15px;
  }

  .welcome-desc {
    font-size: 12px;
    margin-bottom: 16px;
  }

  .question-chip {
    font-size: 11px;
    padding: 4px 10px;
  }

  .msg-content-wrapper {
    max-width: 90%;
  }

  .user-bubble {
    padding: 8px 12px;
    font-size: 13px;
  }

  .ai-bubble {
    padding: 10px 12px;
    font-size: 13px;
  }

  .evidence-section {
    margin-top: 10px;
    padding-top: 8px;
  }

  .evidence-header {
    flex-wrap: wrap;
    gap: 4px;
  }

  .confidence-badge {
    margin-left: 0;
  }

  .evi-meta {
    flex-wrap: wrap;
    gap: 6px;
  }

  .evi-jump-hint {
    margin-left: 0;
  }

  .input-container {
    padding: 10px 12px;
  }

  .char-hint {
    display: none;
  }
}
</style>

