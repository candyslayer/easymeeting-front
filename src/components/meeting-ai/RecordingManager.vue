<template>
  <div class="recording-manager">
    <!-- 顶部上传区域 -->
    <div class="upload-section">
      <div class="section-header">
        <h3 class="section-title">会议音视频录像上传与管理</h3>
        <span class="tip-text">支持 mp3, wav, m4a, aac 音频及 mp4, mkv, mov 等会议录像视频</span>
      </div>

      <div class="upload-dropzone">
        <a-upload-dragger
          name="file"
          :multiple="false"
          :show-upload-list="false"
          :before-upload="beforeUpload"
          :custom-request="handleCustomUpload"
          :disabled="uploading"
          accept=".mp3,.wav,.m4a,.aac,.webm,.ogg,.mp4,.mkv,.mov,.avi"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined :style="{ color: uploading ? '#faad14' : '#1677ff' }" />
          </p>
          <p class="ant-upload-text">
            {{ uploading ? `正在上传录像/录音文件... (${uploadPercent}%)` : '点击或将会议录音/录像拖拽至此处上传' }}
          </p>
          <p class="ant-upload-hint">
            视频文件将自动进行 HLS 切片转码与 AI 智能回放时间轴识别；音频文件可发起离线 ASR 逐字转写。
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
        <div class="player-header-actions">
          <a-button type="primary" size="small" ghost @click="goToReplay(activeRecording)">
            <VideoCameraOutlined /> 智能回放工作台
          </a-button>
          <a-button type="text" size="small" @click="closeAudioPlayer">关闭</a-button>
        </div>
      </div>

      <!-- 智能议题拖动条 -->
      <div class="manager-scrubber-wrap">
        <ReplayProgressBar
          :duration-ms="audioDurationMs"
          :current-time-ms="audioCurrentTimeMs"
          :topics="replayStore.topics"
          :events="replayStore.allEvents"
          :active-topic-id="replayStore.activeTopicId"
          :active-event-id="replayStore.activeEventId"
          @seek="seekAudioTime"
        />
      </div>

      <audio
        ref="audioElementRef"
        :src="activeAudioUrl"
        controls
        autoplay
        class="custom-audio"
        @timeupdate="handleAudioTimeUpdate"
        @loadedmetadata="handleAudioLoadedMetadata"
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
              <VideoCameraOutlined v-if="record.mediaType === 'VIDEO'" style="color: #1677ff; font-size: 16px" />
              <AudioOutlined v-else style="color: #52c41a; font-size: 16px" />
              <div class="name-info ellipsis">
                <span class="file-title ellipsis" :title="record.fileName">{{ record.fileName }}</span>
                <span class="file-format-badge">{{ record.fileFormat?.toUpperCase() || (record.mediaType === 'VIDEO' ? 'MP4' : 'AUDIO') }}</span>
              </div>
            </div>
          </template>

          <!-- 媒体类型 -->
          <template v-else-if="column.key === 'mediaType'">
            <a-tag :color="record.mediaType === 'VIDEO' ? 'blue' : 'green'">
              {{ record.mediaType === 'VIDEO' ? '视频录像' : '音频录音' }}
            </a-tag>
          </template>

          <!-- 文件大小与时长 -->
          <template v-else-if="column.key === 'fileSize'">
            <span>{{ formatFileSize(record.fileSize) }}</span>
          </template>

          <template v-else-if="column.key === 'duration'">
            <span>{{ record.durationSeconds ? formatSeconds(record.durationSeconds) : '未知' }}</span>
          </template>

          <!-- 转写/切片处理状态 -->
          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.processingStatus" :color="getProcessingTagColor(record.processingStatus)">
              <SyncOutlined v-if="record.processingStatus === 'PROCESSING' || record.processingStatus === 'UPLOADED'" :spin="true" />
              <CheckCircleOutlined v-else-if="record.processingStatus === 'READY'" />
              <CloseCircleOutlined v-else-if="record.processingStatus === 'FAILED'" />
              {{ getProcessingTagLabel(record.processingStatus) }}
            </a-tag>
            <a-tag v-else :color="getStatusColor(record.status)">
              <component :is="getStatusIcon(record.status)" :spin="record.status === 1" />
              {{ getStatusLabel(record.status) }}
            </a-tag>
          </template>

          <!-- 操作 -->
          <template v-else-if="column.key === 'actions'">
            <div class="action-btn-row">
              <!-- 智能回放 (视频专属) -->
              <a-button
                v-if="record.mediaType === 'VIDEO' || record.processingStatus"
                type="primary"
                size="small"
                ghost
                @click="goToReplay(record)"
              >
                <VideoCameraOutlined /> 智能回放
              </a-button>

              <!-- 音频在线试听 -->
              <a-button
                v-if="record.mediaType !== 'VIDEO'"
                type="link"
                size="small"
                @click="playRecording(record)"
              >
                <CaretRightOutlined /> 试听
              </a-button>

              <!-- 发起 ASR 转写 (若处于 0-待处理 或 3-失败) -->
              <a-button
                v-if="record.status === 0 || record.status === 3"
                type="link"
                size="small"
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

              <!-- 删除录像文件 -->
              <a-popconfirm
                title="确定删除此录像文件？"
                description="删除后将清理磁盘媒体文件与转码分片，已生成的议题、决策和会议纪要数据将完整保留。"
                ok-text="确认删除"
                cancel-text="取消"
                ok-type="danger"
                @confirm="handleDeleteRecording(record)"
              >
                <a-button type="link" danger size="small">
                  <DeleteOutlined /> 删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  InboxOutlined,
  ReloadOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  CaretRightOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SoundOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import {
  uploadRecording,
  getRecordingList,
  startTranscription,
  getRecordingPlayUrl
} from '@/api/meetingAi'
import { uploadVideoRecording, deleteRecording } from '@/api/meetingReplay'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useMeetingReplayStore } from '@/stores/meetingReplay'
import ReplayProgressBar from './ReplayProgressBar.vue'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['viewTranscript'])

const router = useRouter()
const aiStore = useMeetingAiStore()
const replayStore = useMeetingReplayStore()

const loading = ref(false)
const recordings = ref([])
const uploading = ref(false)
const uploadPercent = ref(0)
const transcribingId = ref('')

// 音频播放控制
const activeAudioUrl = ref('')
const activeRecording = ref(null)
const audioElementRef = ref(null)
const audioCurrentTimeMs = ref(0)
const audioDurationMs = ref(0)

const columns = [
  { title: '录音/录像文件名', dataIndex: 'fileName', key: 'fileName' },
  { title: '类型', dataIndex: 'mediaType', key: 'mediaType', width: 90 },
  { title: '文件大小', dataIndex: 'fileSize', key: 'fileSize', width: 110 },
  { title: '媒体时长', dataIndex: 'duration', key: 'duration', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 130 },
  { title: '上传时间', dataIndex: 'createTime', key: 'createTime', width: 170 },
  { title: '操作', key: 'actions', width: 230, align: 'right' }
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

function getProcessingTagColor(status) {
  switch (status) {
    case 'READY':
      return 'success'
    case 'PROCESSING':
    case 'UPLOADED':
      return 'processing'
    case 'FAILED':
      return 'error'
    default:
      return 'default'
  }
}

function getProcessingTagLabel(status) {
  switch (status) {
    case 'READY':
      return '可回放'
    case 'PROCESSING':
      return '切片转码中'
    case 'UPLOADED':
      return '排队中'
    case 'FAILED':
      return '转码失败'
    default:
      return status || '就绪'
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
  const allowed = [
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/x-m4a',
    'video/mp4', 'video/x-matroska', 'video/quicktime', 'video/webm', 'video/x-msvideo'
  ]
  const ext = file.name.split('.').pop().toLowerCase()
  const validExts = ['mp3', 'wav', 'm4a', 'aac', 'webm', 'ogg', 'mp4', 'mkv', 'mov', 'avi']
  if (!validExts.includes(ext) && !allowed.includes(file.type)) {
    message.error('支持上传 mp3, wav, m4a, aac 音频及 mp4, mkv, mov 视频格式')
    return false
  }
  return true
}

// 自定义上传
async function handleCustomUpload({ file }) {
  uploading.value = true
  uploadPercent.value = 10
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi)$/i.test(file.name)

  try {
    if (isVideo) {
      await uploadVideoRecording(props.meetingId, file, 0, (percent) => {
        uploadPercent.value = percent
      })
      message.success('录像上传成功，已自动提交切片转码与 AI 回放分析！')
    } else {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('meetingId', props.meetingId)
      uploadPercent.value = 50
      await uploadRecording(formData)
      uploadPercent.value = 100
      message.success('录音文件上传成功！请点击“发起转写”进行语音识别')
    }
    await fetchRecordings()
    await aiStore.loadRecordings(props.meetingId)
  } catch (err) {
    message.error(err.message || '录音/录像上传失败')
  } finally {
    setTimeout(() => {
      uploading.value = false
      uploadPercent.value = 0
    }, 400)
  }
}

function goToReplay(record) {
  if (record?.recordingId) {
    replayStore.selectRecording(record.recordingId)
  }
  router.push(`/meeting/replay/${props.meetingId}`)
}

async function handleDeleteRecording(record) {
  try {
    await deleteRecording(record.recordingId)
    message.success('录像文件已删除，历史议题与纪要资产已保留')
    await fetchRecordings()
    await aiStore.loadRecordings(props.meetingId)
  } catch (err) {
    message.error('删除失败: ' + err.message)
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
  if (record.durationSeconds) {
    audioDurationMs.value = record.durationSeconds * 1000
  }
  replayStore.selectRecording(record.recordingId)
}

function closeAudioPlayer() {
  activeAudioUrl.value = ''
  activeRecording.value = null
  audioCurrentTimeMs.value = 0
}

function viewTranscript(record) {
  emit('viewTranscript', record)
  aiStore.activeTab = 'transcript'
}

function handleAudioTimeUpdate(e) {
  const currentSec = e.target.currentTime
  audioCurrentTimeMs.value = Math.round(currentSec * 1000)
  aiStore.audioSeekTimeMs = audioCurrentTimeMs.value
  replayStore.updateCurrentTime(audioCurrentTimeMs.value)
}

function handleAudioLoadedMetadata(e) {
  if (e.target.duration && !isNaN(e.target.duration) && e.target.duration !== Infinity) {
    audioDurationMs.value = Math.round(e.target.duration * 1000)
  }
}

// 暴露音频 seek 给外部调用
function seekAudioTime(ms) {
  audioCurrentTimeMs.value = Math.round(ms)
  if (audioElementRef.value && ms !== undefined && ms !== null) {
    audioElementRef.value.currentTime = ms / 1000
    audioElementRef.value.play().catch(() => {})
  }
  replayStore.updateCurrentTime(audioCurrentTimeMs.value)
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

.player-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.manager-scrubber-wrap {
  background: #141b2d;
  border-radius: 6px;
  padding: 4px 12px;
  margin-bottom: 8px;
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

