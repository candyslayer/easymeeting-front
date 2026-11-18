<template>
  <div class="douyu-replay-theater">
    <!-- 1. 顶部：直播间/放映厅头部信息栏 -->
    <header class="theater-top-header">
      <div class="header-left">
        <a-button type="text" class="back-link-btn" @click="handleGoBack">
          <ArrowLeftOutlined /> 返回
        </a-button>
        <div class="header-divider"></div>

        <!-- 主持人/房主信息与会议标题 -->
        <div class="streamer-profile">
          <a-avatar
            :size="42"
            :style="{ backgroundColor: '#1677ff' }"
            class="streamer-avatar"
          >
            {{ meetingInfo?.createUserName?.slice(0, 1) || '主' }}
          </a-avatar>
          <div class="streamer-meta">
            <div class="streamer-title-row">
              <h1 class="meeting-title ellipsis" :title="meetingInfo?.meetingName || 'AI 会议智能回放'">
                {{ meetingInfo?.meetingName || 'AI 会议录像高能回放放映厅' }}
              </h1>
              <span class="live-status-badge">
                <span class="live-dot"></span> 录播回放
              </span>
              <a-tag color="blue" size="small" class="ai-pill">
                <RobotOutlined /> AI 议题时间轴
              </a-tag>
            </div>
            <div class="streamer-sub-row">
              <span class="meta-item">主持人: {{ meetingInfo?.createUserName || '主持人' }}</span>
              <span class="meta-sep">|</span>
              <span class="meta-item mono">会议号: {{ formatMeetingNo(meetingInfo?.meetingNo) || meetingId }}</span>
              <span class="meta-sep">|</span>
              <span class="meta-item">录制时间: {{ formatDateTime(meetingInfo?.startTime || meetingInfo?.createTime) }}</span>
              <span class="meta-sep">|</span>
              <span class="meta-item mono">总时长: {{ formatMs(replayStore.totalDurationMs) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="header-right">
        <!-- 录像切换下拉选择 -->
        <div v-if="replayStore.recordings.length > 1" class="recording-switch-box">
          <span class="switch-label">录像源:</span>
          <a-select
            v-model:value="replayStore.selectedRecordingId"
            class="rec-select-dark"
            @change="handleRecordingChange"
          >
            <a-select-option
              v-for="rec in replayStore.recordings"
              :key="rec.recordingId"
              :value="rec.recordingId"
            >
              {{ rec.fileName }} ({{ formatMs((rec.durationSeconds || 0) * 1000) }})
            </a-select-option>
          </a-select>
        </div>

        <!-- AI 分析状态 -->
        <div v-if="replayStore.isAnalyzing" class="ai-running-tag">
          <SyncOutlined :spin="true" />
          <span>AI 议题提炼中...</span>
        </div>

        <!-- 一键重新提炼议题 -->
        <a-button
          type="primary"
          ghost
          size="middle"
          :loading="replayStore.isAnalyzing"
          @click="handleTriggerAnalysis"
        >
          <RobotOutlined /> 重新提炼议题
        </a-button>

        <!-- 上传新视频录像 -->
        <a-button type="primary" size="middle" @click="showUploadModal = true">
          <UploadOutlined /> 上传录像
        </a-button>

        <!-- 进入 AI 工作台 -->
        <a-button ghost size="middle" @click="goToWorkspace">
          <AppstoreOutlined /> AI 工作台
        </a-button>
      </div>
    </header>

    <!-- 2. 中间主体：斗鱼/虎牙大屏放映厅布局 (左侧 75% 播放舞台 + 右侧 25% 议题节目单互动栏) -->
    <main class="theater-main-stage">
      <!-- 左侧：超清播放舞台与会议纪要简报 -->
      <section class="stage-left-video-col">
        <!-- 视频播放器 (内置斗鱼/虎牙高能章节时间轴) -->
        <div class="theater-player-box">
          <ReplayPlayer
            ref="playerRef"
            :playback-url="currentPlaybackUrl"
            :duration-ms="replayStore.totalDurationMs"
            :media-title="replayStore.selectedRecording?.fileName || meetingInfo?.meetingName || '会议录像'"
            :media-type="replayStore.selectedRecording?.mediaType"
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
        </div>

        <!-- 播放器下方：会议高能情报卡片与决策成果 -->
        <div class="theater-under-player-card">
          <!-- 当前正在讨论议题横幅 (同步联动) -->
          <div class="current-discussion-strip">
            <div class="strip-left">
              <span class="live-pill">正在播放</span>
              <span class="cur-time-pill mono" v-if="replayStore.currentTopic">
                {{ formatMs(replayStore.currentTopic.startTimeMs) }} - {{ formatMs(replayStore.currentTopic.endTimeMs) }}
              </span>
              <h3 class="cur-topic-title ellipsis" v-if="replayStore.currentTopic">
                {{ replayStore.currentTopic.title }}
              </h3>
              <h3 class="cur-topic-title" v-else>
                未播放或时间未落在议题区间
              </h3>
            </div>
            <div class="strip-right" v-if="replayStore.currentTopic">
              <a-button type="link" size="small" @click="handleEditCurrentTopic">
                <EditOutlined /> 微调本议题
              </a-button>
            </div>
          </div>

          <!-- 当前议题讨论摘要与命中决策/风险 -->
          <div v-if="replayStore.currentTopic" class="current-topic-content">
            <p class="summary-paragraph">
              <strong>议题摘要:</strong> {{ replayStore.currentTopic.summary || '暂无摘要描述' }}
            </p>
            <div v-if="activeEventObj" class="active-event-highlight">
              <span class="event-type-badge" :style="{ backgroundColor: getEventTagColor(activeEventObj.eventType) }">
                {{ activeEventObj.eventType }}
              </span>
              <span class="event-title font-bold">{{ activeEventObj.title }}:</span>
              <span class="event-desc">{{ activeEventObj.content }}</span>
              <span v-if="activeEventObj.speaker" class="event-speaker">({{ activeEventObj.speaker }})</span>
            </div>
          </div>

          <!-- 底部会议结构化摘要分栏 -->
          <div class="meeting-assets-tabs">
            <a-tabs v-model:activeKey="bottomTabKey" size="small">
              <!-- 决议清单 -->
              <a-tab-pane key="decisions" :tab="`会议正式决议 (${confirmedDecisions.length})`">
                <div v-if="confirmedDecisions.length === 0" class="tab-empty">
                  暂无决议记录
                </div>
                <div v-else class="decisions-mini-grid">
                  <div
                    v-for="dec in confirmedDecisions"
                    :key="dec.decisionId"
                    class="decision-mini-card"
                  >
                    <CheckCircleFilled style="color: #52c41a; font-size: 16px" />
                    <div class="dec-info">
                      <span class="dec-title">{{ dec.title }}</span>
                      <span class="dec-content">{{ dec.content }}</span>
                    </div>
                  </div>
                </div>
              </a-tab-pane>

              <!-- 待办任务清单 -->
              <a-tab-pane key="todos" :tab="`待办行动项 (${actionItems.length})`">
                <div v-if="actionItems.length === 0" class="tab-empty">
                  暂无待办任务
                </div>
                <div v-else class="todos-mini-grid">
                  <div
                    v-for="item in actionItems"
                    :key="item.actionId"
                    class="todo-mini-card"
                  >
                    <ClockCircleFilled style="color: #fa8c16; font-size: 14px" />
                    <span class="todo-text ellipsis">{{ item.content }}</span>
                    <span class="todo-owner">{{ item.assigneeName || item.assigneeUserId || '未指定' }}</span>
                  </div>
                </div>
              </a-tab-pane>

              <!-- 会议纪要 -->
              <a-tab-pane key="minutes" tab="最新会议纪要">
                <div v-if="minutesData" class="minutes-content-box">
                  <h4 class="min-title">{{ minutesData.title }}</h4>
                  <p class="min-summary">{{ minutesData.summary }}</p>
                  <p v-if="minutesData.conclusions" class="min-conclusions">
                    <strong>结论:</strong> {{ minutesData.conclusions }}
                  </p>
                </div>
                <div v-else class="tab-empty">暂未生成正式会议纪要</div>
              </a-tab-pane>
            </a-tabs>
          </div>
        </div>
      </section>

      <!-- 右侧：斗鱼/虎牙直播间风格互动侧边栏 (议题节目单 / 高能看点 / 逐字稿) -->
      <aside class="stage-right-chat-col">
        <!-- 侧边栏头部标签页 -->
        <div class="right-tabs-header">
          <button
            class="right-tab-btn"
            :class="{ active: rightTab === 'timeline' }"
            @click="rightTab = 'timeline'"
          >
            <OrderedListOutlined />
            <span>议题时间轴</span>
            <span class="tab-count-pill">{{ replayStore.topics.length }}</span>
          </button>

          <button
            class="right-tab-btn"
            :class="{ active: rightTab === 'events' }"
            @click="rightTab = 'events'"
          >
            <ThunderboltOutlined />
            <span>高能看点</span>
            <span class="tab-count-pill">{{ replayStore.allEvents.length }}</span>
          </button>

          <button
            class="right-tab-btn"
            :class="{ active: rightTab === 'transcript' }"
            @click="rightTab = 'transcript'"
          >
            <FileTextOutlined />
            <span>逐字稿检索</span>
          </button>
        </div>

        <!-- 1. 核心议题时间轴节目单 (类似直播间高能片段列表) -->
        <div v-show="rightTab === 'timeline'" class="timeline-program-stream">
          <div class="stream-header-info">
            <span class="tip-label">点击任意议题或内部事件，视频秒级跳转：</span>
          </div>

          <div v-if="replayStore.topics.length === 0" class="stream-empty">
            <a-empty description="暂未识别到会议议题">
              <template #extra>
                <a-button type="primary" size="small" :loading="replayStore.isAnalyzing" @click="handleTriggerAnalysis">
                  <RobotOutlined /> 启动 AI 议题切分
                </a-button>
              </template>
            </a-empty>
          </div>

          <div v-else class="topic-program-list" ref="programListRef">
            <div
              v-for="(topic, idx) in replayStore.topics"
              :key="topic.id || idx"
              :id="`theater-topic-${topic.id}`"
              class="program-topic-card"
              :class="{ 'is-now-playing': topic.id === replayStore.activeTopicId }"
              @click="handleJump(topic.startTimeMs)"
            >
              <!-- 议题卡片头部 -->
              <div class="program-card-top">
                <div class="time-range-box mono">
                  <CaretRightOutlined class="play-arrow" />
                  <span>{{ formatMs(topic.startTimeMs) }} - {{ formatMs(topic.endTimeMs) }}</span>
                </div>
                <div v-if="topic.id === replayStore.activeTopicId" class="now-playing-pill">
                  <span class="pulse-dot"></span> 正在回放
                </div>
                <div v-else class="topic-order-tag">
                  议题 {{ topic.sortOrder || idx + 1 }}
                </div>
              </div>

              <!-- 议题标题与摘要 -->
              <h4 class="program-topic-title">{{ topic.title }}</h4>
              <p class="program-topic-summary">{{ topic.summary || '暂无摘要' }}</p>

              <!-- 议题内部关键事件 (决策、风险、待办) 类似超级弹幕/事件卡片 -->
              <div v-if="topic.events && topic.events.length > 0" class="program-events-wrap">
                <div
                  v-for="evt in topic.events"
                  :key="evt.id"
                  class="program-event-pill"
                  :class="[getEventClass(evt.eventType), { 'is-active-evt': evt.id === replayStore.activeEventId }]"
                  @click.stop="handleJump(evt.startTimeMs)"
                >
                  <span class="evt-badge" :style="{ backgroundColor: getEventTagColor(evt.eventType) }">
                    {{ getEventLabel(evt.eventType) }}
                  </span>
                  <span class="evt-time mono">{{ formatMs(evt.startTimeMs) }}</span>
                  <span class="evt-name ellipsis">{{ evt.title || evt.content }}</span>
                </div>
              </div>

              <!-- 证据溯源标签 -->
              <div v-if="topic.segmentIds && topic.segmentIds.length > 0" class="program-evidence-row">
                <span class="evidence-lbl">证据片段:</span>
                <span v-for="segId in topic.segmentIds.slice(0, 4)" :key="segId" class="seg-badge">
                  #{{ segId }}
                </span>
                <span v-if="topic.segmentIds.length > 4" class="seg-more">+{{ topic.segmentIds.length - 4 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 高能看点列表 (五大事件流) -->
        <div v-show="rightTab === 'events'" class="events-superchat-stream">
          <div class="events-filter-bar">
            <a-radio-group v-model:value="eventFilterType" size="small" button-style="solid">
              <a-radio-button value="ALL">全部</a-radio-button>
              <a-radio-button value="DECISION">决策</a-radio-button>
              <a-radio-button value="RISK">风险</a-radio-button>
              <a-radio-button value="TODO">待办</a-radio-button>
            </a-radio-group>
          </div>

          <div class="events-stream-list">
            <div
              v-for="evt in filteredEventsList"
              :key="evt.id"
              class="event-chat-card"
              :class="{ 'is-active-card': evt.id === replayStore.activeEventId }"
              @click="handleJump(evt.startTimeMs)"
            >
              <div class="chat-card-top">
                <span class="chat-tag" :style="{ backgroundColor: getEventTagColor(evt.eventType) }">
                  {{ getEventLabel(evt.eventType) }}
                </span>
                <span class="chat-time mono">{{ formatMs(evt.startTimeMs) }}</span>
                <span v-if="evt.speaker" class="chat-speaker">发言人: {{ evt.speaker }}</span>
              </div>
              <div class="chat-card-title font-bold">{{ evt.title }}</div>
              <div class="chat-card-body">{{ evt.content }}</div>
              <div v-if="evt.evidence" class="chat-card-evidence">
                “{{ evt.evidence }}”
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 逐字稿检索流 -->
        <div v-show="rightTab === 'transcript'" class="transcript-search-stream">
          <div class="stream-search-box">
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索发言关键词跳转..."
              allow-clear
              :loading="replayStore.searchingTranscripts"
              @search="handleSearchTranscripts"
            />
          </div>
          <div class="transcript-list-scroll">
            <div
              v-for="item in transcriptDisplayList"
              :key="item.segmentId"
              class="transcript-chat-row"
              :class="{ 'is-active': isCurrentSegment(item) }"
              @click="handleJump(item.startTimeMs)"
            >
              <div class="t-row-meta">
                <span class="t-time mono">{{ formatMs(item.startTimeMs) }}</span>
                <span class="t-speaker">{{ item.speakerName || '参会人' }}</span>
              </div>
              <div class="t-row-text" v-html="highlightKeyword(item.content || item.currentText || item.originalText, searchKeyword)"></div>
            </div>
          </div>
        </div>
      </aside>
    </main>

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
      width="500px"
    >
      <div class="modal-upload-box">
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
            {{ isUploadingVideo ? `正在上传录像... (${uploadPercent}%)` : '点击或将会议录像视频拖拽至此处' }}
          </p>
          <p class="ant-upload-hint">支持 MP4, MKV, MOV 等格式，上传后自动切片与识别议题时间轴。</p>
        </a-upload-dragger>
        <a-progress v-if="isUploadingVideo" :percent="uploadPercent" status="active" style="margin-top: 14px" />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  RobotOutlined,
  SyncOutlined,
  UploadOutlined,
  AppstoreOutlined,
  EditOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  OrderedListOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  CaretRightOutlined,
  InboxOutlined
} from '@ant-design/icons-vue'
import { useMeetingReplayStore } from '@/stores/meetingReplay'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { formatMs, formatMeetingNo, formatDateTime } from '@/utils/format'
import { loadMeetingHistory, loadTodayMeeting } from '@/api/meeting'
import { uploadVideoRecording, retryReplayAnalysis } from '@/api/meetingReplay'

import ReplayPlayer from '@/components/meeting-ai/ReplayPlayer.vue'
import TopicAdjustModal from '@/components/meeting-ai/TopicAdjustModal.vue'

const route = useRoute()
const router = useRouter()
const replayStore = useMeetingReplayStore()
const aiStore = useMeetingAiStore()

const meetingId = computed(() => String(route.params.id || ''))
const meetingInfo = ref(null)

const playerRef = ref(null)
const rightTab = ref('timeline') // 'timeline' | 'events' | 'transcript'
const bottomTabKey = ref('decisions')
const eventFilterType = ref('ALL')
const searchKeyword = ref('')
const programListRef = ref(null)

const showAdjustModal = ref(false)
const editingTopic = ref(null)
const showUploadModal = ref(false)
const isUploadingVideo = ref(false)
const uploadPercent = ref(0)

// 播放地址
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

const activeEventObj = computed(() => {
  if (!replayStore.activeEventId) return null
  return replayStore.allEvents.find((e) => e.id === replayStore.activeEventId) || null
})

const confirmedDecisions = computed(() => {
  return aiStore.decisions?.filter((d) => d.status === 'CONFIRMED') || []
})

const actionItems = computed(() => {
  return aiStore.actionItems || []
})

const minutesData = computed(() => {
  return aiStore.minutes || null
})

// 筛选高能事件
const filteredEventsList = computed(() => {
  const list = replayStore.allEvents || []
  if (eventFilterType.value === 'ALL') return list
  return list.filter((e) => e.eventType === eventFilterType.value)
})

// 转写列表
const transcriptDisplayList = computed(() => {
  if (searchKeyword.value.trim() && replayStore.searchResults?.length > 0) {
    return replayStore.searchResults
  }
  if (replayStore.transcripts && replayStore.transcripts.length > 0) {
    return replayStore.transcripts
  }
  return aiStore.transcriptSegments || []
})

onMounted(async () => {
  if (meetingId.value) {
    await Promise.allSettled([
      fetchMeetingInfo(),
      replayStore.initMeeting(meetingId.value),
      aiStore.initMeeting(meetingId.value),
      aiStore.loadMinutes(meetingId.value),
      aiStore.loadDecisions(meetingId.value),
      aiStore.loadActionItems(meetingId.value)
    ])
  }
})

onUnmounted(() => {
  replayStore.stopAllPolling()
})

// 监听活动议题，自动居中滚动卡片
watch(
  () => replayStore.activeTopicId,
  (newId) => {
    if (!newId || rightTab.value !== 'timeline') return
    nextTick(() => {
      const el = document.getElementById(`theater-topic-${newId}`)
      if (el && programListRef.value) {
        const container = programListRef.value
        const elTop = el.offsetTop - container.offsetTop
        container.scrollTo({
          top: Math.max(0, elTop - 60),
          behavior: 'smooth'
        })
      }
    })
  }
)

async function fetchMeetingInfo() {
  try {
    const [historyRes, todayRes] = await Promise.allSettled([
      loadMeetingHistory(1),
      loadTodayMeeting()
    ])
    const all = []
    if (historyRes.status === 'fulfilled') {
      const hList = Array.isArray(historyRes.value) ? historyRes.value : (historyRes.value?.list || [])
      all.push(...hList)
    }
    if (todayRes.status === 'fulfilled') {
      const tList = Array.isArray(todayRes.value) ? todayRes.value : (todayRes.value?.list || [])
      all.push(...tList)
    }
    const found = all.find((m) => m.meetingId === meetingId.value)
    if (found) {
      meetingInfo.value = found
    }
  } catch (e) {
    console.warn('获取会议元数据失败', e)
  }
}

function handleGoBack() {
  router.push('/meeting/history')
}

function goToWorkspace() {
  router.push(`/meeting/ai/${meetingId.value}`)
}

function handleRecordingChange(recordingId) {
  replayStore.selectRecording(recordingId)
}

function handleTimeUpdate(ms) {
  replayStore.updateCurrentTime(ms)
}

function handlePlayerSeek(ms) {
  replayStore.updateCurrentTime(ms)
}

function handleJump(ms) {
  if (ms == null || isNaN(ms)) return
  replayStore.seekTo(ms)
}

function handleTriggerAnalysis() {
  replayStore.triggerAnalysis(replayStore.selectedRecordingId, true)
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
      message.success('已重新提交切片与分析任务')
      replayStore.loadPlaybackInfo(replayStore.selectedRecordingId)
    } catch (e) {
      message.error('重试失败: ' + e.message)
    }
  }
}

function handleEditCurrentTopic() {
  if (replayStore.currentTopic) {
    editingTopic.value = replayStore.currentTopic
    showAdjustModal.value = true
  }
}

async function handleSaveTopicAdjust(data) {
  try {
    await replayStore.editTopic(data.topicId, {
      title: data.title,
      summary: data.summary,
      sortOrder: data.sortOrder
    })
    await replayStore.adjustTopicTime(data.topicId, data.startTimeMs, data.endTimeMs)
  } catch (e) {}
}

function handleSearchTranscripts(kw) {
  replayStore.searchTranscripts(replayStore.selectedRecordingId, kw)
}

function isCurrentSegment(item) {
  if (!item.startTimeMs) return false
  const end = item.endTimeMs || (item.startTimeMs + 4000)
  return item.startTimeMs <= replayStore.currentTimeMs && replayStore.currentTimeMs <= end
}

function highlightKeyword(text, kw) {
  if (!text) return ''
  if (!kw || !kw.trim()) return text
  const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const reg = new RegExp(`(${escaped})`, 'gi')
  return text.replace(reg, '<mark style="background-color: #ffe58f; color: #d46b08; padding: 0 2px">$1</mark>')
}

function beforeVideoUpload(file) {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi)$/i.test(file.name)
  if (!isVideo) {
    message.error('请上传有效的视频格式文件 (.mp4, .mkv, .mov)')
    return false
  }
  return true
}

async function handleCustomVideoUpload({ file }) {
  isUploadingVideo.value = true
  uploadPercent.value = 0
  try {
    const res = await uploadVideoRecording(meetingId.value, file, 0, (percent) => {
      uploadPercent.value = percent
    })
    message.success('视频录像上传成功，已提交后台切片转码与 AI 时间轴识别！')
    showUploadModal.value = false
    await replayStore.loadRecordings(res?.recordingId)
  } catch (err) {
    message.error(`上传失败: ${err.message}`)
  } finally {
    isUploadingVideo.value = false
  }
}

function getEventClass(type) {
  switch (type) {
    case 'DECISION': return 'evt-c-decision'
    case 'RISK': return 'evt-c-risk'
    case 'TODO': return 'evt-c-todo'
    case 'KEY_POINT': return 'evt-c-keypoint'
    case 'QUESTION': return 'evt-c-question'
    default: return 'evt-c-default'
  }
}

function getEventTagColor(type) {
  switch (type) {
    case 'DECISION': return '#52c41a'
    case 'RISK': return '#ff4d4f'
    case 'TODO': return '#fa8c16'
    case 'KEY_POINT': return '#1677ff'
    case 'QUESTION': return '#722ed1'
    default: return '#1677ff'
  }
}

function getEventLabel(type) {
  switch (type) {
    case 'DECISION': return '决策'
    case 'RISK': return '风险'
    case 'TODO': return '待办'
    case 'KEY_POINT': return '观点'
    case 'QUESTION': return '待解决'
    default: return '事件'
  }
}
</script>

<style scoped>
.douyu-replay-theater {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #0d1117;
  color: #c9d1d9;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* 1. 顶部直播间风格导航条 */
.theater-top-header {
  height: 64px;
  background-color: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back-link-btn {
  color: #8b949e;
  font-size: 14px;
  padding: 4px 8px;
}
.back-link-btn:hover {
  color: #ffffff;
}

.header-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
}

.streamer-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.streamer-avatar {
  border: 2px solid #1677ff;
  box-shadow: 0 0 8px rgba(22, 119, 255, 0.6);
}

.streamer-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.streamer-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.meeting-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}

.live-status-badge {
  background: rgba(255, 77, 79, 0.15);
  border: 1px solid #ff4d4f;
  color: #ff7875;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.live-dot {
  width: 6px;
  height: 6px;
  background-color: #ff4d4f;
  border-radius: 50%;
  animation: live-blink 1.5s infinite;
}

@keyframes live-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.streamer-sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8b949e;
}

.meta-sep {
  color: rgba(255, 255, 255, 0.15);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recording-switch-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.switch-label {
  font-size: 12px;
  color: #8b949e;
}

.rec-select-dark {
  width: 220px;
}

.rec-select-dark :deep(.ant-select-selector) {
  background-color: #21262d !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #c9d1d9 !important;
}

.ai-running-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #58a6ff;
  background: rgba(56, 139, 253, 0.15);
  padding: 4px 10px;
  border-radius: 12px;
}

/* 2. 中间大屏放映厅主体 (75% / 25%) */
.theater-main-stage {
  flex: 1;
  display: flex;
  background-color: #0b0e14;
  overflow: hidden;
}

/* 左侧播放舞台 (75%) */
.stage-left-video-col {
  flex: 75;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px;
  gap: 14px;
}

.theater-player-box {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

/* 播放器下方高能卡片 */
.theater-under-player-card {
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.current-discussion-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.strip-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.live-pill {
  background: #ff4d4f;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 4px;
}

.cur-time-pill {
  background: rgba(22, 119, 255, 0.2);
  border: 1px solid #1677ff;
  color: #58a6ff;
  font-size: 12px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.cur-topic-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.current-topic-content {
  background: #0d1117;
  border-radius: 6px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.summary-paragraph {
  margin: 0;
  font-size: 13px;
  color: #8b949e;
  line-height: 1.6;
}

.summary-paragraph strong {
  color: #58a6ff;
}

.active-event-highlight {
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #e6f4ff;
}

.event-type-badge {
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
}

/* 底部标签页 */
.meeting-assets-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px !important;
}

.meeting-assets-tabs :deep(.ant-tabs-tab) {
  color: #8b949e !important;
}

.meeting-assets-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #58a6ff !important;
}

.decisions-mini-grid,
.todos-mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
}

.decision-mini-card,
.todo-mini-card {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.dec-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dec-title {
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
}

.dec-content {
  color: #8b949e;
  font-size: 12px;
}

.todo-text {
  flex: 1;
  color: #c9d1d9;
  font-size: 13px;
}

.todo-owner {
  color: #58a6ff;
  font-size: 11px;
}

.tab-empty {
  color: #484f58;
  font-size: 12px;
  padding: 8px 0;
}

/* 右侧直播间互动栏 (25%) */
.stage-right-chat-col {
  flex: 25;
  background-color: #161b22;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-tabs-header {
  display: flex;
  height: 44px;
  background-color: #21262d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.right-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.right-tab-btn:hover {
  color: #ffffff;
}

.right-tab-btn.active {
  color: #58a6ff;
  background: #161b22;
  border-bottom: 2px solid #58a6ff;
  font-weight: 600;
}

.tab-count-pill {
  background: rgba(255, 255, 255, 0.1);
  color: #c9d1d9;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
}

/* 议题节目单列表 (斗鱼高能时间轴流) */
.timeline-program-stream {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stream-header-info {
  padding: 8px 14px;
  font-size: 11px;
  color: #8b949e;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.topic-program-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.program-topic-card {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.program-topic-card:hover {
  border-color: #58a6ff;
  background: #1c2128;
  transform: translateX(2px);
}

.program-topic-card.is-now-playing {
  border-color: #ff4d4f;
  background: #1c2128;
  box-shadow: 0 0 12px rgba(255, 77, 79, 0.3);
}

.program-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.time-range-box {
  background: #1f6feb;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.play-arrow {
  font-size: 10px;
}

.now-playing-pill {
  color: #ff7875;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: #ff4d4f;
  border-radius: 50%;
  animation: live-blink 1s infinite;
}

.topic-order-tag {
  color: #484f58;
  font-size: 11px;
}

.program-topic-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #f0f6fc;
}

.program-topic-summary {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
}

.program-events-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  padding-top: 6px;
}

.program-event-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #161b22;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  color: #c9d1d9;
  transition: all 0.15s;
}

.program-event-pill:hover,
.program-event-pill.is-active-evt {
  border-color: #58a6ff;
  background: #21262d;
}

.evt-badge {
  color: #ffffff;
  padding: 0 4px;
  border-radius: 2px;
  font-size: 9px;
  font-weight: 600;
}

.evt-time {
  color: #58a6ff;
  font-size: 10px;
}

.evt-name {
  flex: 1;
}

.program-evidence-row {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #484f58;
}

.seg-badge {
  background: #21262d;
  color: #8b949e;
  padding: 0 4px;
  border-radius: 2px;
}

/* 高能看点流 */
.events-superchat-stream {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.events-filter-bar {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.events-stream-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-chat-card {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.event-chat-card:hover,
.event-chat-card.is-active-card {
  border-color: #58a6ff;
  background: #1c2128;
}

.chat-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.chat-tag {
  color: #ffffff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.chat-time {
  color: #58a6ff;
  font-size: 11px;
}

.chat-speaker {
  font-size: 11px;
  color: #8b949e;
  margin-left: auto;
}

.chat-card-title {
  font-size: 13px;
  color: #f0f6fc;
}

.chat-card-body {
  font-size: 12px;
  color: #8b949e;
  margin-top: 2px;
  line-height: 1.5;
}

.chat-card-evidence {
  margin-top: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-left: 2px solid #58a6ff;
  font-size: 11px;
  color: #7d8590;
  font-style: italic;
}

/* 逐字稿流 */
.transcript-search-stream {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stream-search-box {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.transcript-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transcript-chat-row {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.transcript-chat-row:hover {
  background: #1c2128;
  border-color: #58a6ff;
}

.transcript-chat-row.is-active {
  background: #1f2a3c;
  border-color: #58a6ff;
}

.t-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.t-time {
  color: #58a6ff;
  font-size: 10px;
  background: rgba(56, 139, 253, 0.15);
  padding: 1px 4px;
  border-radius: 2px;
}

.t-speaker {
  font-size: 11px;
  color: #8b949e;
}

.t-row-text {
  font-size: 12px;
  color: #c9d1d9;
  line-height: 1.5;
}

.modal-upload-box {
  padding: 16px 0;
}
</style>
