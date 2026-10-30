<template>
  <div class="recording-manager">
    <!-- 顶部上传区域 -->
    <div class="upload-section">
      <div class="section-header">
        <h3 class="section-title">会议录音上传与管理</h3>
        <span class="tip-text">支持 mp3, wav, m4a, aac, webm, ogg 格式音频（单文件建议小于 500MB）</span>
      </div>

      <div class="upload-dropzone">
        <a-upload-dragger
          name="file"
          :multiple="false"
          :show-upload-list="false"
          :before-upload="beforeUpload"
          :custom-request="handleCustomUpload"
          :disabled="uploading"
          accept=".mp3,.wav,.m4a,.aac,.webm,.ogg"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined :style="{ color: uploading ? '#faad14' : '#1677ff' }" />
          </p>
          <p class="ant-upload-text">
            {{ uploading ? `正在上传音频文件... (${uploadPercent}%)` : '点击或将会议录音文件拖拽至此处上传' }}
          </p>
          <p class="ant-upload-hint">
            上传成功后将保存到 EasyMeeting 音频云存储，可随时在线播放或发起离线 ASR 语音转写。
          </p>
        </a-upload-dragger>
        <a-progress
          v-if="uploading"
          :percent="uploadPercent"
          status="active"
          style="margin-top: 10px"
        />
      </div>
    </div>

    <!-- 音频在线播放器控件 (若当前有选中的录音) -->
    <div v-if="activeAudioUrl" class="audio-player-card">
      <div class="player-header">
        <div class="player-title ellipsis">
          <SoundOutlined style="color: #1677ff" />
          <span class="ellipsis">{{ activeRecording?.fileName || '音频播放中' }}</span>
        </div>
        <a-button type="text" size="small" @click="closeAudioPlayer">关闭播放器</a-button>
      </div>
      <audio
        ref="audioElementRef"
        :src="activeAudioUrl"
        controls
        autoplay
        class="custom-audio"
        @timeupdate="handleAudioTimeUpdate"
      ></audio>
    </div>

    <!-- 录音列表表格 -->
    <div class="recordings-table-section">
      <div class="table-header">
        <h4 class="sub-title">已上传录音列表 ({{ recordings.length }})</h4>
        <div class="table-actions">
          <a-button size="small" @click="fetchRecordings">
            <ReloadOutlined :spin="loading" /> 刷新
          </a-button>
        </div>
      </div>

      <a-table
        :data-source="recordings"
        :columns="columns"
        :loading="loading"
        row-key="recordingId"
        size="middle"
        :scroll="{ x: 650 }"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <!-- 文件名 -->
          <template v-if="column.key === 'fileName'">
            <div class="file-name-cell">
              <AudioOutlined style="color: #1677ff; font-size: 16px" />
              <div class="name-info ellipsis">
                <span class="file-title ellipsis" :title="record.fileName">{{ record.fileName }}</span>
                <span class="file-format-badge">{{ record.fileFormat?.toUpperCase() || 'AUDIO' }}</span>
              </div>
            </div>
          </template>

          <!-- 文件大小与时长 -->
          <template v-else-if="column.key === 'fileSize'">
            <span>{{ formatFileSize(record.fileSize) }}</span>
          </template>

          <template v-else-if="column.key === 'duration'">
            <span>{{ record.durationSeconds ? formatSeconds(record.durationSeconds) : '未知' }}</span>
          </template>

          <!-- 转写状态 -->
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              <component :is="getStatusIcon(record.status)" :spin="record.status === 1" />
              {{ getStatusLabel(record.status) }}
            </a-tag>
          </template>

          <!-- 操作 -->
          <template v-else-if="column.key === 'actions'">
            <div class="action-btn-row">
              <!-- 在线播放 -->
              <a-button
                type="link"
                size="small"
                @click="playRecording(record)"
              >
                <CaretRightOutlined /> 试听
              </a-button>

              <!-- 发起 ASR 转写 (若处于 0-待处理 或 3-失败) -->
              <a-button
                v-if="record.status === 0 || record.status === 3"
                type="primary"
                size="small"
                ghost
                :loading="transcribingId === record.recordingId"
                @click="handleStartTranscription(record)"
              >
                <PlayCircleOutlined /> 发起转写
              </a-button>

              <!-- 已转写完成，查看文本 -->
              <a-button
                v-else-if="record.status === 2"
                type="link"
                size="small"
                @click="viewTranscript(record)"
              >
                <FileTextOutlined /> 查看转写
              </a-button>

              <!-- 转写中 -->
              <a-button
                v-else-if="record.status === 1"
                type="link"
                size="small"
                disabled
              >
                <SyncOutlined :spin="true" /> 转写中...
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  InboxOutlined,
  ReloadOutlined,
  AudioOutlined,
  CaretRightOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SoundOutlined
} from '@ant-design/icons-vue'
import {
  uploadRecording,
  getRecordingList,
  startTranscription,
  getRecordingPlayUrl
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['viewTranscript'])

const aiStore = useMeetingAiStore()

const loading = ref(false)
const recordings = ref([])
const uploading = ref(false)
const uploadPercent = ref(0)
const transcribingId = ref('')

// 音频播放控制
const activeAudioUrl = ref('')
const activeRecording = ref(null)
const audioElementRef = ref(null)

const columns = [
  { title: '录音文件名', dataIndex: 'fileName', key: 'fileName' },
  { title: '文件大小', dataIndex: 'fileSize', key: 'fileSize', width: 110 },
  { title: '音频时长', dataIndex: 'duration', key: 'duration', width: 100 },
  { title: '转写状态', dataIndex: 'status', key: 'status', width: 130 },
  { title: '上传时间', dataIndex: 'createTime', key: 'createTime', width: 170 },
  { title: '操作', key: 'actions', width: 200, align: 'right' }
]

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatSeconds(sec) {
  if (!sec) return '00:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getStatusLabel(status) {
  switch (status) {
    case 0:
      return '已上传待转写'
    case 1:
      return 'ASR 转写中'
    case 2:
      return '转写已完成'
    case 3:
      return '转写失败'
    default:
      return '未知状态'
  }
}

function getStatusColor(status) {
  switch (status) {
    case 0:
      return 'default'
    case 1:
      return 'processing'
    case 2:
      return 'success'
    case 3:
      return 'error'
    default:
      return 'default'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 0:
      return ClockCircleOutlined
    case 1:
      return SyncOutlined
    case 2:
      return CheckCircleOutlined
    case 3:
      return CloseCircleOutlined
    default:
      return ClockCircleOutlined
  }
}

// 获取录音列表
async function fetchRecordings() {
  if (!props.meetingId) return
  loading.value = true
  try {
    const list = await getRecordingList(props.meetingId)
    recordings.value = list || []
  } catch (err) {
    console.error('获取录音列表失败', err)
  } finally {
    loading.value = false
  }
}

// 上传校验
function beforeUpload(file) {
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/x-m4a']
  const ext = file.name.split('.').pop().toLowerCase()
  const validExts = ['mp3', 'wav', 'm4a', 'aac', 'webm', 'ogg']
  if (!validExts.includes(ext) && !allowed.includes(file.type)) {
    message.error('只支持上传 mp3, wav, m4a, aac, webm, ogg 格式的音频')
    return false
  }
  return true
}

// 自定义上传
async function handleCustomUpload({ file }) {
  uploading.value = true
  uploadPercent.value = 10
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('meetingId', props.meetingId)

    // 尝试读取时长
    const audioObj = new Audio(URL.createObjectURL(file))
    audioObj.onloadedmetadata = () => {
      if (audioObj.duration && !isNaN(audioObj.duration)) {
        formData.append('durationSeconds', Math.round(audioObj.duration))
      }
    }

    uploadPercent.value = 40
    const res = await uploadRecording(formData)
    uploadPercent.value = 100

    message.success('录音文件上传成功！请点击“发起转写”进行语音识别')
    fetchRecordings()
  } catch (err) {
    message.error(err.message || '录音文件上传失败')
  } finally {
    setTimeout(() => {
      uploading.value = false
      uploadPercent.value = 0
    }, 600)
  }
}

// 发起转写
async function handleStartTranscription(record) {
  transcribingId.value = record.recordingId
  try {
    const task = await startTranscription({
      meetingId: props.meetingId,
      recordingId: record.recordingId,
      language: 'zh'
    })
    message.success('转写任务已提交，后台正在使用 ASR 语音模型处理...')
    record.status = 1 // 标记为转写中
    // 轮询该录音状态
    pollRecordingStatus(record.recordingId)
  } catch (err) {
    message.error(err.message || '发起转写任务失败')
  } finally {
    transcribingId.value = ''
  }
}

// 轮询录音状态
let pollTimer = null
function pollRecordingStatus(recordingId) {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      const list = await getRecordingList(props.meetingId)
      recordings.value = list || []
      const target = list.find((item) => item.recordingId === recordingId)
      if (target && target.status !== 1) {
        clearInterval(pollTimer)
        pollTimer = null
        if (target.status === 2) {
          message.success(`录音《${target.fileName}》转写完成！`)
          aiStore.loadTranscriptSegments()
        } else if (target.status === 3) {
          message.error(`录音《${target.fileName}》转写失败`)
        }
      }
    } catch (e) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }, 3000)
}

// 播放录音
function playRecording(record) {
  activeRecording.value = record
  activeAudioUrl.value = getRecordingPlayUrl(record.recordingId)
}

function closeAudioPlayer() {
  activeAudioUrl.value = ''
  activeRecording.value = null
}

function viewTranscript(record) {
  emit('viewTranscript', record)
  aiStore.activeTab = 'transcript'
}

function handleAudioTimeUpdate(e) {
  const currentSec = e.target.currentTime
  aiStore.audioSeekTimeMs = Math.round(currentSec * 1000)
}

// 暴露音频 seek 给外部调用
function seekAudioTime(ms) {
  if (audioElementRef.value && ms !== undefined && ms !== null) {
    audioElementRef.value.currentTime = ms / 1000
    audioElementRef.value.play().catch(() => {})
  }
}

defineExpose({
  seekAudioTime,
  playRecording
})

watch(
  () => props.meetingId,
  () => {
    fetchRecordings()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.recording-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: #ffffff;
  padding: 20px;
  border-radius: var(--border-radius-card);
}

.section-header {
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-main);
}

.tip-text {
  font-size: 12px;
  color: var(--text-tertiary);
}

.upload-dropzone {
  margin-top: 8px;
}

.audio-player-card {
  background: #f0f7ff;
  border: 1px solid #bae0ff;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.player-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
}

.custom-audio {
  width: 100%;
  height: 36px;
  border-radius: 4px;
}

.recordings-table-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--text-main);
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-title {
  font-weight: 500;
  color: var(--text-main);
}

.file-format-badge {
  font-size: 10px;
  background: #f0f0f0;
  color: var(--text-secondary);
  padding: 1px 4px;
  border-radius: 3px;
}

.action-btn-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

@media (max-width: 768px) {
  .recording-manager {
    padding: 12px;
    gap: 14px;
  }

  .upload-dropzone :deep(.ant-upload-drag) {
    padding: 12px 8px;
  }

  .upload-dropzone :deep(.ant-upload-drag-icon) {
    margin-bottom: 8px;
    font-size: 32px;
  }

  .upload-dropzone :deep(.ant-upload-text) {
    font-size: 13px;
  }

  .upload-dropzone :deep(.ant-upload-hint) {
    font-size: 11px;
  }

  .audio-player-card {
    padding: 10px 12px;
  }
}
</style>

