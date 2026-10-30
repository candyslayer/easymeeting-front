<template>
  <a-drawer
    v-model:open="visible"
    title="会议聊天"
    placement="right"
    :width="drawerWidth"
    :body-style="{ padding: '12px 16px', display: 'flex', flexDirection: 'column', height: '100%' }"
    @close="emit('update:open', false)"
  >
    <!-- 消息列表滚动区 -->
    <div ref="msgContainer" class="chat-messages-container">
      <div v-if="messages.length === 0" class="empty-chat">
        <span>暂无聊天消息，开始互动吧</span>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.messageId"
        class="message-bubble-wrapper"
        :class="{ 'is-self': msg.isSelf }"
      >
        <span class="sender-header">
          <span class="sender-name">{{ msg.sendNickName || '参会者' }}</span>
          <span v-if="msg.receiveUserId" class="private-tag">私聊</span>
          <span class="send-time">{{ formatTime(msg.sendTime) }}</span>
        </span>

        <!-- 文本消息气泡 -->
        <div v-if="msg.messageType === 5 || !msg.messageType" class="bubble text-bubble">
          {{ msg.meesageContent || msg.content || msg.message }}
        </div>

        <!-- 文件/媒体消息气泡 -->
        <div v-else-if="msg.messageType === 6" class="bubble file-bubble">
          <div class="file-icon-box">
            <FileTextOutlined style="font-size: 24px; color: #1677ff" />
          </div>
          <div class="file-info-col ellipsis">
            <span class="file-name ellipsis">{{ msg.fileName || getFileMeta(msg).fileName }}</span>
            <span class="file-size">{{ formatFileSize(msg.fileSize || getFileMeta(msg).fileSize) }}</span>
          </div>
          <a
            :href="getFileDownloadUrl(msg)"
            target="_blank"
            class="download-btn"
            title="下载文件"
          >
            <DownloadOutlined />
          </a>
        </div>
      </div>
    </div>

    <!-- 底部发送控制区 -->
    <div class="chat-input-panel">
      <!-- 目标接收人选择（私聊/所有人） -->
      <div class="chat-toolbar-row">
        <div class="target-selector">
          <span class="label">发送至:</span>
          <a-select
            v-model:value="targetUserId"
            size="small"
            style="width: 130px"
            placeholder="所有人"
          >
            <a-select-option value="">所有人 (公屏)</a-select-option>
            <a-select-option
              v-for="m in remoteMembers"
              :key="m.userId"
              :value="m.userId"
            >
              {{ m.nickName || '参会者' }}
            </a-select-option>
          </a-select>
        </div>

        <!-- 文件上传附件按钮 -->
        <input
          ref="fileInputEl"
          type="file"
          style="display: none"
          @change="handleFileUpload"
        />
        <a-button
          type="text"
          size="small"
          :loading="isUploading"
          @click="fileInputEl?.click()"
        >
          <PaperClipOutlined /> 发送文件
        </a-button>
      </div>

      <!-- 消息输入与发送 -->
      <div class="input-send-box">
        <a-textarea
          v-model:value="inputText"
          placeholder="输入消息，Enter 发送..."
          :auto-size="{ minRows: 2, maxRows: 4 }"
          @pressEnter.prevent="handleSend"
        />
        <a-button
          type="primary"
          size="small"
          class="send-btn"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
          <SendOutlined /> 发送
        </a-button>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  FileTextOutlined,
  DownloadOutlined,
  PaperClipOutlined,
  SendOutlined
} from '@ant-design/icons-vue'
import { sendChatMessage } from '@/api/meeting'
import { uploadFile, getDownloadUrl } from '@/api/file'
import { formatFileSize } from '@/utils/format'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  messages: {
    type: Array,
    default: () => []
  },
  members: {
    type: Array,
    default: () => []
  },
  currentUserId: {
    type: String,
    default: ''
  },
  meetingId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open'])

const visible = ref(props.open)
const msgContainer = ref(null)
const fileInputEl = ref(null)
const inputText = ref('')
const targetUserId = ref('')
const isUploading = ref(false)

const windowWidth = ref(window.innerWidth)
const drawerWidth = computed(() => (windowWidth.value <= 600 ? '100%' : 360))

function handleResize() {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const remoteMembers = computed(() => {
  return props.members.filter((m) => m.userId !== props.currentUserId)
})

watch(
  () => props.open,
  (val) => {
    visible.value = val
    if (val) {
      scrollToBottom()
    }
  }
)

watch(
  () => props.messages.length,
  () => {
    scrollToBottom()
  }
)

function formatTime(timestamp) {
  if (!timestamp) return ''
  return dayjs(timestamp).format('HH:mm')
}

function getFileMeta(msg) {
  if (msg.meesageContent && typeof msg.meesageContent === 'object') {
    return msg.meesageContent
  }
  return {}
}

function getFileDownloadUrl(msg) {
  const meta = getFileMeta(msg)
  const fileId = meta.fileId || msg.fileId
  if (fileId) {
    return getDownloadUrl(fileId)
  }
  return '#'
}

function scrollToBottom() {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTop = msgContainer.value.scrollHeight
    }
  })
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return

  try {
    await sendChatMessage({
      message: text,
      receiveUserId: targetUserId.value
    })
    inputText.value = ''
  } catch (err) {
    message.error(err.message || '发送消息失败')
  }
}

async function handleFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return

  isUploading.value = true
  try {
    await uploadFile(file, props.meetingId, targetUserId.value)
    message.success(`文件「${file.name}」已上传发送`)
  } catch (err) {
    message.error(err.message || '文件上传失败')
  } finally {
    isUploading.value = false
    if (fileInputEl.value) {
      fileInputEl.value.value = ''
    }
  }
}
</script>

<style scoped>
.chat-messages-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.empty-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 13px;
}

.message-bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  max-width: 90%;
}

.message-bubble-wrapper.is-self {
  align-self: flex-end;
  align-items: flex-end;
}

.sender-header {
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.private-tag {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
}

.bubble {
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-all;
}

.text-bubble {
  background: #f2f3f5;
  color: var(--text-main);
  border-bottom-left-radius: 2px;
}

.is-self .text-bubble {
  background: #1677ff;
  color: #ffffff;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 2px;
}

.file-bubble {
  background: #ffffff;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  gap: 10px;
  width: 240px;
}

.file-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #e6f4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
}

.file-size {
  font-size: 11px;
  color: var(--text-secondary);
}

.download-btn {
  font-size: 16px;
  color: var(--primary-color);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-input-panel {
  border-top: 1px solid var(--border-light);
  padding-top: 10px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.target-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.input-send-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.send-btn {
  align-self: flex-end;
}
</style>

