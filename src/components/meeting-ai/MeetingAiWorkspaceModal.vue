<template>
  <a-modal
    :open="open"
    :title="null"
    :footer="null"
    :width="modalWidth"
    :body-style="{ height: modalBodyHeight, padding: '0px', overflow: 'hidden' }"
    wrap-class-name="meeting-ai-workspace-modal-wrap"
    destroy-on-close
    @update:open="(val) => emit('update:open', val)"
  >
    <div class="in-meeting-ai-workspace">
      <!-- 顶部工作空间导航条 -->
      <header class="workspace-top-bar">
        <div class="top-left">
          <div class="modal-badge-tag">
            <ClusterOutlined style="color: #1677ff" />
            <span>会内 Agent 工作台</span>
          </div>
          <div class="divider"></div>
          <div class="meeting-title-wrap ellipsis">
            <span class="meeting-name ellipsis">{{ meetingInfo?.meetingName || '智能会议工作台' }}</span>
            <span class="meeting-no mono">会议号: {{ formatMeetingNo(meetingInfo?.meetingNo) || meetingId }}</span>
          </div>
        </div>

        <div class="top-right">
          <!-- AI 分析运行指示 -->
          <div v-if="aiStore.isAnalyzing" class="ai-running-pill">
            <SyncOutlined :spin="true" />
            <span>Agent 分析流水线执行中...</span>
          </div>

          <!-- 刷新全部 -->
          <a-button size="small" @click="refreshAllData">
            <ReloadOutlined :spin="refreshing" /> 刷新
          </a-button>

          <!-- 一键发起 AI 分析 -->
          <a-button
            type="primary"
            size="small"
            :loading="aiStore.isAnalyzing"
            @click="aiStore.triggerAnalysis(meetingId, true)"
          >
            <RobotOutlined /> 启动 AI 分析
          </a-button>

          <!-- 在独立新标签页打开 -->
          <a-tooltip title="在独立浏览器新标签页打开工作台（当前会议持续进行）">
            <a-button size="small" @click="openInExternalTab">
              <ExportOutlined /> 独立窗口
            </a-button>
          </a-tooltip>

          <!-- 关闭模态窗口 -->
          <a-button type="text" shape="circle" class="close-btn" @click="handleClose">
            <CloseOutlined />
          </a-button>
        </div>
      </header>

      <!-- 工作台主体内容区：左侧菜单 + 中间主面板 -->
      <div class="workspace-body">
        <!-- 左侧功能导航栏 -->
        <aside class="workspace-nav">
          <div class="nav-header">
            <span class="nav-title">工作空间内容</span>
          </div>

          <div class="nav-items-list">
            <button
              v-for="item in navTabs"
              :key="item.key"
              class="tab-btn"
              :class="{ active: currentTab === item.key }"
              @click="switchTab(item.key)"
            >
              <component :is="item.icon" class="tab-icon" />
              <span class="tab-label">{{ item.label }}</span>
              <span v-if="item.badge != null && item.badge > 0" class="tab-badge">
                {{ item.badge }}
              </span>
            </button>
          </div>

          <!-- 左下角简要会议信息卡片 -->
          <div class="meeting-meta-box">
            <div class="meta-row">
              <span class="meta-label">计划时间:</span>
              <span class="meta-val">{{ formatDateTime(meetingInfo?.startTime) || formatDateTime(meetingInfo?.createTime) || '-' }}</span>
            </div>
            <div class="meta-row" v-if="meetingInfo?.endTime">
              <span class="meta-label">结束时间:</span>
              <span class="meta-val">{{ formatDateTime(meetingInfo.endTime) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">纪要状态:</span>
              <a-tag :color="aiStore.minutesStatusColor" size="small">
                {{ aiStore.minutesStatusLabel }}
              </a-tag>
            </div>
          </div>
        </aside>

        <!-- 中间核心工作区域 -->
        <main class="workspace-main">
          <!-- 1. 会议概览 -->
          <div v-show="currentTab === 'overview'" class="tab-container overview-tab">
            <div class="overview-grid">
              <div class="stat-card">
                <div class="stat-icon" style="background: #e6f4ff; color: #1677ff">
                  <FileTextOutlined />
                </div>
                <div class="stat-info">
                  <span class="stat-label">逐字转写片段</span>
                  <span class="stat-value font-bold">{{ aiStore.transcriptTotal || 0 }}</span>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon" style="background: #f6ffed; color: #52c41a">
                  <CheckCircleOutlined />
                </div>
                <div class="stat-info">
                  <span class="stat-label">正式生效决议</span>
                  <span class="stat-value font-bold">{{ aiStore.confirmedDecisions.length }}</span>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon" style="background: #fff7e6; color: #fa8c16">
                  <UnorderedListOutlined />
                </div>
                <div class="stat-info">
                  <span class="stat-label">待办行动项</span>
                  <span class="stat-value font-bold">{{ aiStore.actionItems.length }}</span>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon" style="background: #f9f0ff; color: #722ed1">
                  <AudioOutlined />
                </div>
                <div class="stat-info">
                  <span class="stat-label">会议录音文件</span>
                  <span class="stat-value font-bold">{{ aiStore.recordings.length }}</span>
                </div>
              </div>
            </div>

            <div class="overview-sections">
              <div class="overview-box">
                <div class="box-head">
                  <h4 class="box-title">
                    <FileTextOutlined style="color: #1677ff" /> 最新会议纪要
                  </h4>
                  <a-button type="link" size="small" @click="switchTab('minutes')">
                    完整查阅 <RightOutlined />
                  </a-button>
                </div>
                <div class="box-body" v-if="aiStore.minutes">
                  <h5 class="min-title">{{ aiStore.minutes.title }}</h5>
                  <p class="min-summary">{{ aiStore.minutes.summary }}</p>
                  <div v-if="aiStore.minutes.conclusions" class="min-conclusion">
                    <strong>结论:</strong> {{ aiStore.minutes.conclusions }}
                  </div>
                </div>
                <div v-else class="box-empty">
                  <a-empty description="暂未生成会议纪要" />
                </div>
              </div>

              <div class="overview-box">
                <div class="box-head">
                  <h4 class="box-title">
                    <CheckCircleOutlined style="color: #52c41a" /> 待办与决议快览
                  </h4>
                  <a-button type="link" size="small" @click="switchTab('actionItems')">
                    查看待办 <RightOutlined />
                  </a-button>
                </div>
                <div class="box-body" v-if="aiStore.actionItems.length > 0">
                  <ul class="quick-tasks-list">
                    <li v-for="item in aiStore.actionItems.slice(0, 4)" :key="item.actionId" class="task-li">
                      <span class="task-badge" :class="item.status">{{ item.status }}</span>
                      <span class="task-text ellipsis">{{ item.content }}</span>
                    </li>
                  </ul>
                </div>
                <div v-else class="box-empty">
                  <a-empty description="暂无会议待办" />
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 转写记录 -->
          <div v-show="currentTab === 'transcript'" class="tab-container">
            <TranscriptPanel :meeting-id="meetingId" @seek-audio="handleSeekAudio" />
          </div>

          <!-- 3. 录音管理 -->
          <div v-show="currentTab === 'recording'" class="tab-container">
            <RecordingManager ref="recordingManagerRef" :meeting-id="meetingId" />
          </div>

          <!-- 4. 会议纪要 -->
          <div v-show="currentTab === 'minutes'" class="tab-container">
            <MinutesPanel :meeting-id="meetingId" />
          </div>

          <!-- 5. 核心议题 -->
          <div v-show="currentTab === 'topics'" class="tab-container">
            <TopicsPanel :meeting-id="meetingId" />
          </div>

          <!-- 6. 会议决策 -->
          <div v-show="currentTab === 'decisions'" class="tab-container">
            <DecisionsPanel :meeting-id="meetingId" />
          </div>

          <!-- 7. 待办事项 -->
          <div v-show="currentTab === 'actionItems'" class="tab-container">
            <ActionItemsPanel :meeting-id="meetingId" />
          </div>

          <!-- 8. 行业术语智能理解 -->
          <div v-show="currentTab === 'terminology'" class="tab-container">
            <TerminologyPanel :meeting-id="meetingId" />
          </div>

          <!-- 9. 智能问答 -->
          <div v-show="currentTab === 'qa'" class="tab-container">
            <MeetingQaPanel :meeting-id="meetingId" />
          </div>

          <!-- 9. Agent 执行审计与控制台 -->
          <div v-show="currentTab === 'agents'" class="tab-container">
            <AgentExecutionPanel :meeting-id="meetingId" />
          </div>
        </main>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  CloseOutlined,
  ReloadOutlined,
  RobotOutlined,
  SyncOutlined,
  ExportOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  AudioOutlined,
  OrderedListOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  QuestionCircleOutlined,
  ClusterOutlined,
  RightOutlined,
  BookOutlined
} from '@ant-design/icons-vue'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { formatMeetingNo, formatDateTime } from '@/utils/format'
import { loadMeetingHistory } from '@/api/meeting'

import TranscriptPanel from '@/components/meeting-ai/TranscriptPanel.vue'
import RecordingManager from '@/components/meeting-ai/RecordingManager.vue'
import MinutesPanel from '@/components/meeting-ai/MinutesPanel.vue'
import TopicsPanel from '@/components/meeting-ai/TopicsPanel.vue'
import DecisionsPanel from '@/components/meeting-ai/DecisionsPanel.vue'
import ActionItemsPanel from '@/components/meeting-ai/ActionItemsPanel.vue'
import TerminologyPanel from '@/components/meeting-ai/TerminologyPanel.vue'
import MeetingQaPanel from '@/components/meeting-ai/MeetingQaPanel.vue'
import AgentExecutionPanel from '@/components/meeting-ai/AgentExecutionPanel.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  meetingId: {
    type: String,
    required: true
  },
  initialTab: {
    type: String,
    default: 'agents'
  }
})

const emit = defineEmits(['update:open'])

const router = useRouter()
const aiStore = useMeetingAiStore()

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onWindowResize() {
  windowWidth.value = window.innerWidth
}

const modalWidth = computed(() => {
  if (windowWidth.value < 768) return '96vw'
  if (windowWidth.value < 1200) return '92vw'
  return '1200px'
})

const modalBodyHeight = computed(() => {
  if (windowWidth.value < 768) return '88vh'
  return '82vh'
})

const meetingInfo = ref(null)
const refreshing = ref(false)
const recordingManagerRef = ref(null)

const currentTab = ref(props.initialTab || 'agents')

const navTabs = computed(() => [
  { key: 'agents', label: 'Agent 控制台', icon: ClusterOutlined },
  { key: 'overview', label: '会议概览', icon: AppstoreOutlined },
  { key: 'minutes', label: '会议纪要', icon: FileTextOutlined },
  { key: 'topics', label: '核心议题', icon: OrderedListOutlined, badge: aiStore.agendaTopics.length },
  { key: 'decisions', label: '会议决策', icon: CheckCircleOutlined, badge: aiStore.decisions.length },
  { key: 'actionItems', label: '待办事项', icon: UnorderedListOutlined, badge: aiStore.actionItems.length },
  { key: 'terminology', label: '行业术语', icon: BookOutlined, badge: aiStore.meetingTerms.length },
  { key: 'transcript', label: '转写记录', icon: FileTextOutlined, badge: aiStore.transcriptTotal },
  { key: 'recording', label: '录音管理', icon: AudioOutlined, badge: aiStore.recordings.length },
  { key: 'qa', label: '智能问答', icon: QuestionCircleOutlined }
])

function switchTab(tabKey) {
  currentTab.value = tabKey
}

function handleClose() {
  emit('update:open', false)
}

function handleSeekAudio(startTimeMs) {
  if (recordingManagerRef.value && recordingManagerRef.value.seekAudioTime) {
    recordingManagerRef.value.seekAudioTime(startTimeMs)
  }
}

function openInExternalTab() {
  const routeUrl = router.resolve(`/meeting/ai/${props.meetingId}`)
  const fullUrl = window.location.origin + routeUrl.href
  const newWin = window.open(fullUrl, '_blank', 'noopener,noreferrer')
  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    message.info('当前浏览器阻止了新窗口弹出，已为您在当前会议内展示工作台')
  } else {
    message.success('已在新标签页开启独立工作台，当前视频会议保持连接中')
  }
}

async function fetchMeetingMeta() {
  if (!props.meetingId) return
  try {
    const res = await loadMeetingHistory(1)
    const list = Array.isArray(res) ? res : (res?.list || [])
    const found = list.find((m) => m.meetingId === props.meetingId)
    if (found) {
      meetingInfo.value = found
      aiStore.meetingInfo = found
    }
  } catch (err) {
    console.warn('获取会议元信息失败', err)
  }
}

async function refreshAllData() {
  if (!props.meetingId) return
  refreshing.value = true
  try {
    await Promise.allSettled([
      fetchMeetingMeta(),
      aiStore.refreshAll(props.meetingId)
    ])
    message.success('已刷新 AI 数据')
  } finally {
    refreshing.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.initialTab) {
        currentTab.value = props.initialTab
      }
      aiStore.initMeeting(props.meetingId)
      refreshAllData()
    }
  },
  { immediate: true }
)

watch(
  () => aiStore.highlightSegmentId,
  (segId) => {
    if (segId && props.open) {
      currentTab.value = 'transcript'
    }
  }
)

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
</script>

<style scoped>
.in-meeting-ai-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-body);
  overflow: hidden;
}

.workspace-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 12px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.modal-badge-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  padding: 3px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border-color);
}

.meeting-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meeting-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.meeting-no {
  font-size: 12px;
  color: var(--text-secondary);
}

.top-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ai-running-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #1677ff;
  background: #e6f4ff;
  padding: 3px 8px;
  border-radius: 12px;
  animation: pulse-border 2s infinite ease-in-out;
}

.close-btn {
  font-size: 15px;
  color: var(--text-secondary);
}

.workspace-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.workspace-nav {
  width: 200px;
  background: #ffffff;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.nav-header {
  padding: 12px 16px 8px;
}

.nav-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.nav-items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 10px;
  flex: 1;
  overflow-y: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: var(--bg-gray);
  color: var(--text-main);
}

.tab-btn.active {
  background: #e6f4ff;
  color: #1677ff;
  font-weight: 600;
}

.tab-icon {
  font-size: 15px;
}

.tab-badge {
  margin-left: auto;
  font-size: 11px;
  background: #f0f0f0;
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 10px;
}

.tab-btn.active .tab-badge {
  background: #1677ff;
  color: #ffffff;
}

.meeting-meta-box {
  padding: 12px;
  margin: 10px;
  background: #fafafa;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meta-label {
  color: var(--text-tertiary);
}

.meta-val {
  color: var(--text-secondary);
  font-weight: 500;
}

.workspace-main {
  flex: 1;
  overflow: hidden;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.tab-container {
  height: 100%;
  width: 100%;
  overflow-y: auto;
}

.overview-tab {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #ffffff;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 20px;
  color: var(--text-main);
  line-height: 1.2;
}

.overview-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.overview-box {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  padding: 14px;
  display: flex;
  flex-direction: column;
}

.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
  margin-bottom: 10px;
}

.box-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.min-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 6px 0;
}

.min-summary {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.min-conclusion {
  font-size: 12px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  padding: 6px 10px;
  border-radius: 4px;
  color: #274916;
}

.quick-tasks-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.task-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #f0f0f0;
}

.task-badge.DONE {
  background: #f6ffed;
  color: #52c41a;
}

.task-badge.DOING {
  background: #e6f4ff;
  color: #1677ff;
}

@media (max-width: 768px) {
  .workspace-top-bar {
    padding: 8px 12px;
    flex-wrap: wrap;
  }

  .workspace-body {
    flex-direction: column;
  }

  .workspace-nav {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  .nav-header {
    display: none;
  }

  .nav-items-list {
    flex-direction: row;
    overflow-x: auto;
    padding: 6px 8px;
    gap: 6px;
  }

  .tab-btn {
    flex: 0 0 auto;
    padding: 6px 10px;
    font-size: 12px;
  }

  .meeting-meta-box {
    display: none;
  }

  .overview-sections {
    grid-template-columns: 1fr;
  }
}
</style>

