<template>
  <div class="meeting-ai-workspace">
    <!-- 顶部工作空间导航条 -->
    <header class="workspace-top-bar">
      <div class="top-left">
        <a-button type="text" class="back-btn" @click="handleGoBack">
          <ArrowLeftOutlined /> 返回会议列表
        </a-button>
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
          <span>Spring AI 多 Agent 分析流水线执行中...</span>
        </div>

        <!-- 刷新全部 -->
        <a-button @click="refreshAllData">
          <ReloadOutlined :spin="refreshing" /> 刷新全部
        </a-button>

        <!-- 一键发起 AI 分析 -->
        <a-button
          type="primary"
          :loading="aiStore.isAnalyzing"
          @click="aiStore.triggerAnalysis(meetingId, true)"
        >
          <RobotOutlined /> 启动 AI 分析流水线
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
            <!-- 会议核心指标卡片 -->
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

          <!-- 快速预览模块 -->
          <div class="overview-sections">
            <!-- 会议纪要简报 -->
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

            <!-- 待办任务简报 -->
            <div class="overview-box">
              <div class="box-head">
                <h4 class="box-title">
                  <UnorderedListOutlined style="color: #fa8c16" /> 重点待办事项
                </h4>
                <a-button type="link" size="small" @click="switchTab('actionItems')">
                  全部待办 <RightOutlined />
                </a-button>
              </div>
              <div class="box-body" v-if="aiStore.actionItems.length > 0">
                <div
                  v-for="item in aiStore.actionItems.slice(0, 4)"
                  :key="item.actionId"
                  class="todo-mini-row"
                >
                  <span class="todo-bullet">•</span>
                  <span class="todo-content ellipsis">{{ item.content }}</span>
                  <span class="todo-user">{{ item.assigneeName || item.assigneeUserId || '未指定' }}</span>
                </div>
              </div>
              <div v-else class="box-empty">
                <a-empty description="暂无待办事项" />
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 转写记录 -->
        <div v-show="currentTab === 'transcript'" class="tab-container">
          <TranscriptPanel
            :meeting-id="meetingId"
            @seek-audio="handleSeekAudio"
          />
        </div>

        <!-- 3. 录音管理 -->
        <div v-show="currentTab === 'recording'" class="tab-container">
          <RecordingManager
            ref="recordingManagerRef"
            :meeting-id="meetingId"
            @view-transcript="switchTab('transcript')"
          />
        </div>

        <!-- 4. 会议纪要 -->
        <div v-show="currentTab === 'minutes'" class="tab-container">
          <MinutesPanel
            :meeting-id="meetingId"
            :meeting-info="meetingInfo"
          />
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

        <!-- 8. 智能问答 -->
        <div v-show="currentTab === 'qa'" class="tab-container">
          <MeetingQaPanel :meeting-id="meetingId" />
        </div>

        <!-- 9. Agent 执行状态 -->
        <div v-show="currentTab === 'agents'" class="tab-container">
          <AgentExecutionPanel :meeting-id="meetingId" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  RobotOutlined,
  SyncOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  AudioOutlined,
  OrderedListOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  QuestionCircleOutlined,
  ClusterOutlined,
  RightOutlined
} from '@ant-design/icons-vue'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { formatMeetingNo, formatDateTime } from '@/utils/format'
import { loadMeetingHistory } from '@/api/meeting'

// 子面板组件
import TranscriptPanel from '@/components/meeting-ai/TranscriptPanel.vue'
import RecordingManager from '@/components/meeting-ai/RecordingManager.vue'
import MinutesPanel from '@/components/meeting-ai/MinutesPanel.vue'
import TopicsPanel from '@/components/meeting-ai/TopicsPanel.vue'
import DecisionsPanel from '@/components/meeting-ai/DecisionsPanel.vue'
import ActionItemsPanel from '@/components/meeting-ai/ActionItemsPanel.vue'
import MeetingQaPanel from '@/components/meeting-ai/MeetingQaPanel.vue'
import AgentExecutionPanel from '@/components/meeting-ai/AgentExecutionPanel.vue'

const route = useRoute()
const router = useRouter()
const aiStore = useMeetingAiStore()

const meetingId = computed(() => String(route.params.id || ''))
const meetingInfo = ref(null)
const refreshing = ref(false)
const recordingManagerRef = ref(null)

const currentTab = computed({
  get: () => aiStore.activeTab,
  set: (val) => {
    aiStore.activeTab = val
  }
})

const navTabs = computed(() => [
  { key: 'overview', label: '会议概览', icon: AppstoreOutlined },
  { key: 'transcript', label: '转写记录', icon: FileTextOutlined, badge: aiStore.transcriptTotal },
  { key: 'recording', label: '录音管理', icon: AudioOutlined, badge: aiStore.recordings.length },
  { key: 'minutes', label: '会议纪要', icon: FileTextOutlined },
  { key: 'topics', label: '核心议题', icon: OrderedListOutlined, badge: aiStore.agendaTopics.length },
  { key: 'decisions', label: '会议决策', icon: CheckCircleOutlined, badge: aiStore.decisions.length },
  { key: 'actionItems', label: '待办事项', icon: UnorderedListOutlined, badge: aiStore.actionItems.length },
  { key: 'qa', label: '智能问答', icon: QuestionCircleOutlined },
  { key: 'agents', label: 'Agent 审计', icon: ClusterOutlined }
])

function switchTab(tabKey) {
  currentTab.value = tabKey
}

function handleGoBack() {
  router.push('/meeting/history')
}

function handleSeekAudio(startTimeMs) {
  if (recordingManagerRef.value && recordingManagerRef.value.seekAudioTime) {
    recordingManagerRef.value.seekAudioTime(startTimeMs)
  }
}

async function fetchMeetingMeta() {
  if (!meetingId.value) return
  try {
    // 从历史中找到该场会议元数据
    const res = await loadMeetingHistory(1)
    const list = Array.isArray(res) ? res : (res?.list || [])
    const found = list.find((m) => m.meetingId === meetingId.value)
    if (found) {
      meetingInfo.value = found
      aiStore.meetingInfo = found
    }
  } catch (err) {
    console.warn('获取会议元信息失败', err)
  }
}

async function refreshAllData() {
  refreshing.value = true
  try {
    await Promise.allSettled([
      fetchMeetingMeta(),
      aiStore.refreshAll(meetingId.value)
    ])
    message.success('已刷新当前会议所有 AI 数据')
  } finally {
    refreshing.value = false
  }
}

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab) {
      currentTab.value = newTab
    }
  },
  { immediate: true }
)

watch(
  () => meetingId.value,
  (newId) => {
    if (newId) {
      aiStore.initMeeting(newId)
      refreshAllData()
    }
  },
  { immediate: true }
)

onMounted(() => {
  aiStore.initMeeting(meetingId.value)
  refreshAllData()
})

onUnmounted(() => {
  aiStore.stopTaskPolling()
})
</script>

<style scoped>
.meeting-ai-workspace {
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
  padding: 12px 24px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 16px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back-btn {
  font-size: 13px;
  color: var(--text-secondary);
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
}

.meeting-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meeting-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.meeting-no {
  font-size: 12px;
  color: var(--text-tertiary);
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.ai-running-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e6f4ff;
  color: #1677ff;
  border: 1px solid #91caff;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
}

.workspace-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.workspace-nav {
  width: 220px;
  background: #ffffff;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 16px 0;
}

.nav-header {
  padding: 0 16px 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.nav-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-items-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-main);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #f5f5f5;
}

.tab-btn.active {
  background: #e6f4ff;
  color: #1677ff;
  font-weight: 600;
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  flex: 1;
}

.tab-badge {
  font-size: 11px;
  background: #f0f0f0;
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 10px;
}

.tab-btn.active .tab-badge {
  background: #bae0ff;
  color: #0958d9;
}

.meeting-meta-box {
  padding: 12px 16px;
  margin: 0 8px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
}

.workspace-main {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.tab-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.overview-tab {
  overflow-y: auto;
  padding-right: 4px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #ffffff;
  padding: 18px;
  border-radius: var(--border-radius-card);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 22px;
  color: var(--text-main);
  line-height: 1.2;
}

.overview-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.overview-box {
  background: #ffffff;
  border-radius: var(--border-radius-card);
  border: 1px solid var(--border-color);
  padding: 18px;
  display: flex;
  flex-direction: column;
}

.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 8px;
}

.box-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
}

.box-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.min-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.min-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.min-conclusion {
  font-size: 13px;
  color: #1677ff;
  background: #f0f7ff;
  padding: 8px 12px;
  border-radius: 6px;
}

.todo-mini-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.todo-bullet {
  color: #fa8c16;
  font-weight: bold;
}

.todo-content {
  flex: 1;
  color: var(--text-main);
}

.todo-user {
  font-size: 11px;
  color: var(--text-tertiary);
  background: #f5f5f5;
  padding: 1px 6px;
  border-radius: 4px;
}

.box-empty {
  padding: 30px 0;
  text-align: center;
}

@media (max-width: 768px) {
  .workspace-top-bar {
    flex-direction: column;
    align-items: stretch;
    padding: 10px 14px;
    gap: 10px;
  }

  .top-left {
    justify-content: space-between;
    width: 100%;
  }

  .top-right {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }

  .top-right .ant-btn {
    flex: 1;
    font-size: 13px;
    padding: 4px 8px;
  }

  .ai-running-pill {
    width: 100%;
    justify-content: center;
    font-size: 11px;
    padding: 4px 8px;
    order: -1;
  }

  .workspace-body {
    flex-direction: column;
  }

  .workspace-nav {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    padding: 4px 8px;
  }

  .nav-header {
    display: none;
  }

  .nav-items-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 6px;
    padding: 4px 2px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .nav-items-list::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: 13px;
    white-space: nowrap;
    border-radius: 16px;
    background: #f5f5f5;
  }

  .tab-btn.active {
    background: #1677ff;
    color: #ffffff;
  }

  .tab-btn.active .tab-badge {
    background: #ffffff;
    color: #1677ff;
  }

  .meeting-meta-box {
    display: none;
  }

  .workspace-main {
    padding: 10px 8px;
  }

  .overview-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat-card {
    padding: 10px 12px;
    gap: 10px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
    border-radius: 8px;
  }

  .stat-label {
    font-size: 11px;
  }

  .stat-value {
    font-size: 18px;
  }

  .overview-sections {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .overview-box {
    padding: 14px;
  }
}

@media (max-width: 480px) {
  .meeting-title-wrap {
    max-width: 220px;
  }
  .meeting-name {
    font-size: 14px;
  }
}
</style>

