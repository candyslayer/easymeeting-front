<template>
  <div class="replay-workspace">
    <!-- 顶部工作条：录像选择器 + 状态提示 + 操作按钮 -->
    <div class="workspace-header-bar">
      <div class="header-left">
        <span class="label-text">当前录像:</span>
        <a-select
          v-model:value="replayStore.selectedRecordingId"
          class="recording-select"
          :loading="replayStore.loadingRecordings"
          @change="handleRecordingChange"
          placeholder="请选择需要回放的会议录像"
        >
          <a-select-option
            v-for="item in replayStore.recordings"
            :key="item.recordingId"
            :value="item.recordingId"
          >
            <div class="recording-option-row">
              <VideoCameraOutlined v-if="item.mediaType === 'VIDEO'" style="color: #1677ff" />
              <AudioOutlined v-else style="color: #52c41a" />
              <span class="rec-name ellipsis" :title="item.fileName">{{ item.fileName }}</span>
              <span class="rec-duration mono">({{ formatMs((item.durationSeconds || 0) * 1000) }})</span>
              <a-tag :color="getStatusTagColor(item.processingStatus)" size="small">
                {{ getStatusTagLabel(item.processingStatus) }}
              </a-tag>
            </div>
          </a-select-option>
        </a-select>

        <a-button size="small" @click="handleRefreshAll">
          <ReloadOutlined :spin="replayStore.loadingRecordings || replayStore.loadingTimeline" />
        </a-button>
      </div>

      <div class="header-right">
        <!-- AI 分析运行态提示 -->
        <div v-if="replayStore.isAnalyzing" class="ai-status-pill">
          <SyncOutlined :spin="true" />
          <span>AI 议题与事件识别中...</span>
        </div>

        <!-- 进入独立全屏放映厅 -->
        <a-button
          type="primary"
          style="background: #fa541c; border-color: #fa541c"
          @click="router.push(`/meeting/replay/${props.meetingId}`)"
        >
          <FullscreenOutlined /> 斗鱼/虎牙放映厅
        </a-button>

        <!-- 一键重新提炼议题 -->
        <a-button
          type="primary"
          ghost
          :loading="replayStore.isAnalyzing"
          @click="handleTriggerAnalysis"
        >
          <RobotOutlined /> AI 提炼议题时间轴
        </a-button>

        <!-- 上传新录像 -->
        <a-button type="primary" @click="showUploadModal = true">
          <UploadOutlined /> 上传会议录像
        </a-button>
      </div>
    </div>

    <!-- 主体区域：左侧播放器与概要 + 右侧议题时间轴与检索 -->
    <div class="workspace-main-content">
      <!-- 左侧：播放器与当前播放上下文 -->
      <div class="content-left-col">
        <!-- 视频播放器 -->
        <ReplayPlayer
          ref="playerRef"
          :playback-url="currentPlaybackUrl"
          :duration-ms="replayStore.totalDurationMs"
          :media-title="replayStore.selectedRecording?.fileName || '会议录像回放'"
          :status="replayStore.playbackInfo?.processingStatus || replayStore.selectedRecording?.processingStatus"
          :error-message="replayStore.playbackInfo?.processingError"
          :topics="replayStore.topics"
          :events="replayStore.allEvents"
          :active-topic-id="replayStore.activeTopicId"
          :active-event-id="replayStore.activeEventId"
          :seek-target-ms="replayStore.seekTargetMs"
          @timeupdate="handleTimeUpdate"
          @seek="handlePlayerSeek"
          @refresh-status="handleRefreshPlayback"
          @retry-transcode="handleRetryTranscode"
        />

        <!-- 当前播放议题与关键事件速览卡片 -->
        <div class="now-playing-card">
          <div class="card-head">
            <span class="head-title">
              <SoundOutlined style="color: #1677ff" /> 当前播放议题与决议速览
            </span>
            <span v-if="replayStore.currentTopic" class="time-range-pill mono">
              {{ formatMs(replayStore.currentTopic.startTimeMs) }} - {{ formatMs(replayStore.currentTopic.endTimeMs) }}
            </span>
          </div>

          <div v-if="replayStore.currentTopic" class="card-body">
            <h4 class="cur-topic-title">{{ replayStore.currentTopic.title }}</h4>
            <p class="cur-topic-summary">{{ replayStore.currentTopic.summary || '暂无摘要' }}</p>

            <!-- 命中事件提示 -->
            <div v-if="activeEventObj" class="cur-hit-event">
              <a-tag :color="getEventTagColor(activeEventObj.eventType)">
                {{ activeEventObj.eventType }}
              </a-tag>
              <span class="hit-event-title font-bold">{{ activeEventObj.title }}:</span>
              <span class="hit-event-content">{{ activeEventObj.content }}</span>
            </div>
          </div>
          <div v-else class="card-empty">
            <span class="empty-tip">未播放或当前时间点未匹配到议题区间</span>
          </div>
        </div>

        <!-- 录像文件元数据信息栏 -->
        <div v-if="replayStore.selectedRecording" class="recording-meta-bar">
          <div class="meta-item">
            <span class="meta-label">文件格式:</span>
            <span class="meta-val">{{ replayStore.selectedRecording.fileFormat?.toUpperCase() || 'MP4' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">文件大小:</span>
            <span class="meta-val">{{ formatFileSize(replayStore.selectedRecording.fileSize) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">上传时间:</span>
            <span class="meta-val">{{ formatDateTime(replayStore.selectedRecording.createTime) }}</span>
          </div>
          <div class="meta-actions">
            <a-popconfirm
              title="确定删除此录像文件吗？"
              description="删除后将清理磁盘媒体文件与转码分片，已生成的议题、决策和会议纪要数据将完整保留。"
              ok-text="确认删除"
              cancel-text="取消"
              ok-type="danger"
              @confirm="handleDeleteCurrentRecording"
            >
              <a-button type="link" danger size="small">
                <DeleteOutlined /> 删除录像
              </a-button>
            </a-popconfirm>
          </div>
        </div>
      </div>

      <!-- 右侧：议题时间轴与逐字稿检索 Tab 栏 -->
      <div class="content-right-col">
        <a-tabs v-model:activeKey="activeRightTab" class="right-col-tabs">
          <!-- Tab 1: 议题时间轴 -->
          <a-tab-pane key="timeline" tab="议题时间轴">
            <ReplayTimeline
              :topics="replayStore.topics"
              :active-topic-id="replayStore.activeTopicId"
              :active-event-id="replayStore.activeEventId"
              :current-time-ms="replayStore.currentTimeMs"
              :is-analyzing="replayStore.isAnalyzing"
              @seek="handleSeek"
              @edit-topic="handleOpenEditModal"
              @reanalyze="handleTriggerAnalysis"
            />
          </a-tab-pane>

          <!-- Tab 2: 逐字稿与检索 -->
          <a-tab-pane key="transcript" tab="逐字稿与检索">
            <ReplayTranscriptSearch
              :transcripts="replayStore.transcripts"
              :search-results="replayStore.searchResults"
              :current-time-ms="replayStore.currentTimeMs"
              :loading="replayStore.loadingTranscripts"
              :searching="replayStore.searchingTranscripts"
              @search="handleSearchTranscripts"
              @seek="handleSeek"
            />
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>

    <!-- 弹窗：人工微调议题与时间轴 -->
    <TopicAdjustModal
      v-model:open="showAdjustModal"
      :topic="editingTopic"
      @submit="handleSaveTopicAdjust"
    />

    <!-- 弹窗：上传新会议录像 -->
    <a-modal
      v-model:open="showUploadModal"
      title="上传会议录像视频"
      :footer="null"
      width="520px"
    >
      <div class="upload-modal-content">
        <a-upload-dragger
          name="file"
          :multiple="false"
          :show-upload-list="false"
          :before-upload="beforeVideoUpload"
          :custom-request="handleCustomVideoUpload"
          :disabled="isUploadingVideo"
          accept=".mp4,.mkv,.mov,.webm,.avi"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined :style="{ color: isUploadingVideo ? '#faad14' : '#1677ff' }" />
          </p>
          <p class="ant-upload-text">
            {{ isUploadingVideo ? `正在上传录像... (${uploadPercent}%)` : '点击或将会议录像拖拽至此处上传' }}
          </p>
          <p class="ant-upload-hint">
            支持 MP4, MKV, MOV, WEBM 等常见视频格式。上传后将自动进行 HLS 切片转码与 AI 议题时间轴识别。
          </p>
        </a-upload-dragger>
        <a-progress
          v-if="isUploadingVideo"
          :percent="uploadPercent"
          status="active"
          style="margin-top: 14px"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  VideoCameraOutlined,
  AudioOutlined,
  ReloadOutlined,
  SyncOutlined,
  RobotOutlined,
  UploadOutlined,
  SoundOutlined,
  DeleteOutlined,
  InboxOutlined,
  FullscreenOutlined
} from '@ant-design/icons-vue'
import { useMeetingReplayStore } from '@/stores/meetingReplay'
import { formatMs, formatFileSize, formatDateTime } from '@/utils/format'
import { uploadVideoRecording, retryReplayAnalysis } from '@/api/meetingReplay'

import ReplayPlayer from './ReplayPlayer.vue'
import ReplayTimeline from './ReplayTimeline.vue'
import ReplayTranscriptSearch from './ReplayTranscriptSearch.vue'
import TopicAdjustModal from './TopicAdjustModal.vue'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const router = useRouter()
const replayStore = useMeetingReplayStore()

const playerRef = ref(null)
const activeRightTab = ref('timeline')
const showAdjustModal = ref(false)
const editingTopic = ref(null)

// 上传视频控制
const showUploadModal = ref(false)
const isUploadingVideo = ref(false)
const uploadPercent = ref(0)

const activeEventObj = computed(() => {
  if (!replayStore.activeEventId) return null
  return replayStore.allEvents.find((e) => e.id === replayStore.activeEventId) || null
})

// 计算媒体播放地址，保证有源即播
const currentPlaybackUrl = computed(() => {
  return (
    replayStore.playbackInfo?.playbackUrl ||
    replayStore.playbackInfo?.playbackFilePath ||
    replayStore.selectedRecording?.playbackUrl ||
    replayStore.selectedRecording?.playbackFilePath ||
    replayStore.selectedRecording?.downloadUrl ||
    ''
  )
})

onMounted(() => {
  replayStore.initMeeting(props.meetingId)
})

onUnmounted(() => {
  replayStore.stopAllPolling()
})

watch(
  () => props.meetingId,
  (newId) => {
    if (newId) {
      replayStore.initMeeting(newId)
    }
  }
)

function handleRecordingChange(recordingId) {
  replayStore.selectRecording(recordingId)
}

function handleRefreshAll() {
  replayStore.loadRecordings(replayStore.selectedRecordingId)
}

function handleTimeUpdate(ms) {
  replayStore.updateCurrentTime(ms)
}

function handlePlayerSeek(ms) {
  replayStore.updateCurrentTime(ms)
}

function handleSeek(ms) {
  replayStore.seekTo(ms)
}

function handleRefreshPlayback() {
  if (replayStore.selectedRecordingId) {
    replayStore.loadPlaybackInfo(replayStore.selectedRecordingId)
  }
}

async function handleRetryTranscode() {
  if (replayStore.selectedRecordingId) {
    try {
      await retryReplayAnalysis(replayStore.selectedRecordingId)
      message.success('已重新提交转码与分析任务')
      replayStore.loadPlaybackInfo(replayStore.selectedRecordingId)
    } catch (e) {
      message.error('重试失败: ' + e.message)
    }
  }
}

function handleTriggerAnalysis() {
  replayStore.triggerAnalysis(replayStore.selectedRecordingId, true)
}

function handleSearchTranscripts(kw) {
  replayStore.searchTranscripts(replayStore.selectedRecordingId, kw)
}

function handleOpenEditModal(topic) {
  editingTopic.value = topic
  showAdjustModal.value = true
}

async function handleSaveTopicAdjust(data) {
  try {
    // 1. 更新元信息
    await replayStore.editTopic(data.topicId, {
      title: data.title,
      summary: data.summary,
      sortOrder: data.sortOrder
    })
    // 2. 更新时间轴
    await replayStore.adjustTopicTime(data.topicId, data.startTimeMs, data.endTimeMs)
  } catch (e) {
    // 错误在 store 中提示
  }
}

async function handleDeleteCurrentRecording() {
  if (!replayStore.selectedRecordingId) return
  await replayStore.removeRecording(replayStore.selectedRecordingId)
}

// 视频文件上传逻辑
function beforeVideoUpload(file) {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi)$/i.test(file.name)
  if (!isVideo) {
    message.error('请上传有效的视频格式文件 (.mp4, .mkv, .mov, .webm)')
    return false
  }
  const isLt2G = file.size / 1024 / 1024 < 2048
  if (!isLt2G) {
    message.error('视频文件大小不能超过 2GB')
    return false
  }
  return true
}

async function handleCustomVideoUpload({ file }) {
  isUploadingVideo.value = true
  uploadPercent.value = 0

  try {
    const res = await uploadVideoRecording(props.meetingId, file, 0, (percent) => {
      uploadPercent.value = percent
    })
    message.success('会议录像上传成功，正在进行异步切片转码与 AI 识别！')
    showUploadModal.value = false
    // 刷新录像列表并自动选中新录像
    await replayStore.loadRecordings(res?.recordingId)
  } catch (err) {
    message.error(`上传失败: ${err.message || '网络异常'}`)
  } finally {
    isUploadingVideo.value = false
    uploadPercent.value = 0
  }
}

function getStatusTagColor(status) {
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

function getStatusTagLabel(status) {
  switch (status) {
    case 'READY':
      return '可播放'
    case 'PROCESSING':
      return '转码中'
    case 'UPLOADED':
      return '排队中'
    case 'FAILED':
      return '转码失败'
    default:
      return status || '就绪'
  }
}

function getEventTagColor(type) {
  switch (type) {
    case 'DECISION':
      return '#52c41a'
    case 'RISK':
      return '#ff4d4f'
    case 'TODO':
      return '#fa8c16'
    case 'KEY_POINT':
      return '#1677ff'
    case 'QUESTION':
      return '#722ed1'
    default:
      return '#1677ff'
  }
}
</script>

<style scoped>
.replay-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

/* 顶部工作栏 */
.workspace-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  z-index: 5;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label-text {
  font-size: 13px;
  color: #595959;
  font-weight: 500;
}

.recording-select {
  width: 320px;
}

.recording-option-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.rec-name {
  max-width: 150px;
}

.rec-duration {
  font-size: 11px;
  color: #8c8c8c;
}

.ai-status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: #e6f4ff;
  color: #1677ff;
  padding: 4px 10px;
  border-radius: 12px;
}

/* 主内容布局 (左右分栏) */
.workspace-main-content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

/* 左侧栏 */
.content-left-col {
  flex: 62;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* 右侧栏 */
.content-right-col {
  flex: 38;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: var(--border-radius-card, 8px);
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.right-col-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.ant-tabs-nav) {
  margin-bottom: 0 !important;
  padding: 0 16px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.ant-tabs-content-holder) {
  flex: 1;
  overflow: hidden;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
}

/* 当前播放速览卡片 */
.now-playing-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 14px 16px;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.head-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f1f1f;
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-range-pill {
  font-size: 11px;
  background: #f0f5ff;
  color: #1677ff;
  padding: 1px 6px;
  border-radius: 4px;
}

.cur-topic-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1677ff;
}

.cur-topic-summary {
  font-size: 13px;
  color: #595959;
  line-height: 1.5;
  margin: 0;
}

.cur-hit-event {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hit-event-title {
  color: #389e0d;
}

.hit-event-content {
  color: #262626;
}

.card-empty {
  font-size: 12px;
  color: #8c8c8c;
  padding: 6px 0;
}

/* 录像元数据行 */
.recording-meta-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  background: #ffffff;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  font-size: 12px;
  color: #595959;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-label {
  color: #8c8c8c;
}

.meta-actions {
  margin-left: auto;
}

.upload-modal-content {
  padding: 16px 0;
}
</style>
