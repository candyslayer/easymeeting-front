<template>
  <div class="decisions-panel">
    <!-- 1. 会议功能开关与统一 ASR 状态指示栏 -->
    <div class="feature-status-banner">
      <div class="banner-switches">
        <div class="switch-item">
          <span class="switch-label">实时转写展示:</span>
          <a-switch
            :checked="aiStore.isTranscriptionEnabled"
            :loading="aiStore.featureLoading"
            size="small"
            checked-children="开"
            un-checked-children="关"
            @change="(val) => handleToggleFeature('transcription', val)"
          />
        </div>

        <div class="switch-item">
          <span class="switch-label">会中决策追踪:</span>
          <a-switch
            :checked="aiStore.isLiveDecisionEnabled"
            :loading="aiStore.featureLoading"
            size="small"
            checked-children="开"
            un-checked-children="关"
            @change="(val) => handleToggleFeature('live_decision', val)"
          />
        </div>
      </div>

      <div class="banner-asr-indicator">
        <div class="asr-pill" :class="{ 'is-running': aiStore.isAsrRunning }">
          <span class="asr-dot" :class="{ pulse: aiStore.isAsrRunning }"></span>
          <span class="asr-text">
            {{ aiStore.isAsrRunning ? '🎙️ 统一 ASR 运行中 (转写/决策共享)' : '🎙️ ASR 待机中' }}
          </span>
        </div>

        <a-tooltip title="解耦设计：开启会中决策会自动启动后台 ASR，无需单独开启转写展示；两个功能共享同一 ASR 实例，只有当两个功能都关闭时，ASR 才会停止。">
          <QuestionCircleOutlined class="info-help-icon" />
        </a-tooltip>
      </div>
    </div>

    <!-- 2. 面板控制工具栏 -->
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">会议决策管理</h3>
        <span class="count-badge">共 {{ decisions.length }} 项决议</span>

        <!-- 视图切换：思维导图 vs 列表视图 -->
        <a-radio-group v-model:value="displayView" size="small" button-style="solid" class="view-switch">
          <a-radio-button value="mindmap">
            <ApartmentOutlined /> 思维导图
          </a-radio-button>
          <a-radio-button value="list">
            <UnorderedListOutlined /> 卡片列表
          </a-radio-button>
        </a-radio-group>
      </div>

      <div class="header-right">
        <!-- 状态筛选 -->
        <a-radio-group v-model:value="statusFilter" size="small" button-style="solid" class="status-filter-group">
          <a-radio-button value="ALL">全部 ({{ decisions.length }})</a-radio-button>
          <a-radio-button value="CONFIRMED">正式生效 ({{ confirmedCount }})</a-radio-button>
          <a-radio-button value="DISCUSSING">讨论中 ({{ discussingCount }})</a-radio-button>
          <a-radio-button value="PROPOSED">提出方案 ({{ proposedCount }})</a-radio-button>
          <a-radio-button value="DEFERRED">暂缓 ({{ deferredCount }})</a-radio-button>
        </a-radio-group>

        <a-button size="small" @click="fetchDecisions">
          <ReloadOutlined :spin="loading" /> 刷新
        </a-button>

        <a-button type="primary" ghost size="small" :loading="aiStore.isAnalyzing" @click="handleReanalyze">
          <RobotOutlined /> 提取决策
        </a-button>
      </div>
    </div>

    <!-- 3. 面板主体内容区 -->
    <div class="panel-body">
      <a-spin :spinning="loading">
        <!-- 空状态 -->
        <div v-if="filteredDecisions.length === 0" class="empty-state">
          <a-empty description="暂无符合条件的会议决策">
            <template #extra>
              <div class="empty-actions">
                <a-button
                  v-if="!aiStore.isLiveDecisionEnabled"
                  type="primary"
                  @click="handleToggleFeature('live_decision', true)"
                >
                  <PlayCircleOutlined /> 开启会中决策实时追踪
                </a-button>
                <a-button
                  v-else
                  type="default"
                  :loading="aiStore.isAnalyzing"
                  @click="handleReanalyze"
                >
                  <RobotOutlined /> 发起 AI 决策提炼
                </a-button>
              </div>
            </template>
          </a-empty>
        </div>

        <div v-else class="decisions-content-wrap">
          <!-- 模式 A：思维导图视图 (Mind Map) [默认] -->
          <div v-if="displayView === 'mindmap'" class="mindmap-view-container">
            <!-- 多决策议题切换胶囊栏 (当存在多个议题时) -->
            <div class="decision-selector-bar" v-if="filteredDecisions.length > 1">
              <span class="selector-hint">选择展示议题:</span>
              <div class="selector-pills-list">
                <button
                  v-for="(item, idx) in filteredDecisions"
                  :key="item.decisionId"
                  class="decision-pill"
                  :class="{ active: String(activeDecisionId) === String(item.decisionId) }"
                  @click="selectDecision(item.decisionId)"
                >
                  <span class="pill-idx">#{{ idx + 1 }}</span>
                  <span class="pill-topic ellipsis">{{ item.topic || item.content || `议题 ${idx + 1}` }}</span>
                  <a-tag :color="getStatusTagColor(item.status)" class="pill-tag">
                    {{ getStatusText(item.status) }}
                  </a-tag>
                </button>
              </div>
            </div>

            <!-- 当前激活决策的思维导图展示 -->
            <div class="mindmap-render-area" v-if="activeDecision">
              <DecisionMindMap
                :decision="activeDecision"
                :can-operate="true"
                @confirm="openOperationModal($event, 'CONFIRMED')"
                @reject="openOperationModal($event, 'REJECTED')"
                @defer="openOperationModal($event, 'DEFERRED')"
                @view-evidence="viewEvidenceChain"
                @view-evolution="openEvolutionDrawer"
              />
            </div>
          </div>

          <!-- 模式 B：结构化卡片列表视图 (Card List) -->
          <div v-else class="decisions-list">
            <div
              v-for="item in filteredDecisions"
              :key="item.decisionId"
              class="decision-card"
              :class="{
                'is-confirmed': item.status === 'CONFIRMED',
                'is-discussing': item.status === 'DISCUSSING',
                'is-proposed': item.status === 'PROPOSED' || item.status === 'PENDING',
                'is-deferred': item.status === 'DEFERRED',
                'is-rejected': item.status === 'REJECTED'
              }"
            >
              <!-- 头部：状态、议题与操作 -->
              <div class="card-head">
                <div class="head-left">
                  <a-tag :color="getStatusTagColor(item.status)">
                    <component :is="getStatusIcon(item.status)" />
                    {{ getStatusText(item.status) }}
                  </a-tag>
                  <h4 class="card-topic">{{ item.topic || '讨论决策事项' }}</h4>
                  <span class="decision-meta" v-if="item.proposer">
                    提议: <strong>{{ item.proposer }}</strong>
                  </span>
                  <span class="decision-meta" v-if="item.decisionMaker">
                    定案: <strong>{{ item.decisionMaker }}</strong>
                  </span>
                </div>

                <!-- 状态调整与操作 -->
                <div class="head-right">
                  <a-button
                    v-if="item.status !== 'CONFIRMED'"
                    type="primary"
                    size="small"
                    @click="openOperationModal(item, 'CONFIRMED')"
                  >
                    <CheckOutlined /> 确认生效
                  </a-button>

                  <a-button
                    v-if="item.status !== 'DEFERRED' && item.status !== 'CONFIRMED'"
                    size="small"
                    @click="openOperationModal(item, 'DEFERRED')"
                  >
                    <ClockCircleOutlined /> 暂缓
                  </a-button>

                  <a-button
                    v-if="item.status !== 'REJECTED'"
                    danger
                    type="text"
                    size="small"
                    @click="openOperationModal(item, 'REJECTED')"
                  >
                    否决
                  </a-button>

                  <a-button
                    type="link"
                    size="small"
                    @click="openEvolutionDrawer(item)"
                  >
                    <HistoryOutlined /> 演进历史
                  </a-button>
                </div>
              </div>

              <!-- 决议正文 -->
              <div class="card-content" v-if="item.content">
                <p class="content-text">{{ item.content }}</p>
              </div>

              <!-- 候选方案、理由与反对意见展开区域 -->
              <div class="card-branches-preview">
                <!-- 候选方案 -->
                <div class="branch-pill-group" v-if="hasField(item.candidateOptions)">
                  <span class="pill-label">💡 候选方案:</span>
                  <div class="pill-tags-wrap">
                    <span
                      v-for="(opt, idx) in parseList(item.candidateOptions)"
                      :key="idx"
                      class="mini-pill opt-pill"
                    >
                      {{ opt }}
                    </span>
                  </div>
                </div>

                <!-- 支持理由 -->
                <div class="branch-pill-group" v-if="hasField(item.supportReasons)">
                  <span class="pill-label pro">👍 支持理由:</span>
                  <div class="pill-tags-wrap">
                    <span
                      v-for="(pro, idx) in parseList(item.supportReasons)"
                      :key="idx"
                      class="mini-pill pro-pill"
                    >
                      {{ pro }}
                    </span>
                  </div>
                </div>

                <!-- 反对意见 -->
                <div class="branch-pill-group" v-if="hasField(item.opposeReasons)">
                  <span class="pill-label con">⚠️ 风险/反对:</span>
                  <div class="pill-tags-wrap">
                    <span
                      v-for="(con, idx) in parseList(item.opposeReasons)"
                      :key="idx"
                      class="mini-pill con-pill"
                    >
                      {{ con }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 责任人与截止时间 -->
              <div class="card-action-bar" v-if="item.assigneeName || item.dueTime">
                <span class="action-info" v-if="item.assigneeName">
                  <UserOutlined style="color: #1677ff" /> 执行人: <strong>{{ item.assigneeName }}</strong>
                </span>
                <span class="action-info" v-if="item.dueTime">
                  <CalendarOutlined style="color: #fa8c16" /> 截止时间: <strong>{{ formatDateTime(item.dueTime) }}</strong>
                </span>
              </div>

              <!-- 来源证据引言与溯源 -->
              <div class="card-evidence" v-if="item.evidenceQuote">
                <div class="evidence-quote-box">
                  <FileTextOutlined style="color: #1677ff" />
                  <span class="quote-text">{{ item.evidenceQuote }}</span>
                </div>
                <a-button
                  type="link"
                  size="small"
                  class="trace-btn"
                  @click="viewEvidenceChain(item)"
                >
                  <SearchOutlined /> 证据溯源
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- 4. 决策状态变更确认弹窗 -->
    <a-modal
      v-model:open="opModalVisible"
      :title="opModalTitle"
      @ok="handleConfirmOperation"
      :confirm-loading="submittingOp"
      :width="modalWidth(480)"
    >
      <div class="op-dialog-content">
        <p class="op-topic">
          议题: <strong>{{ currentOpItem?.topic || currentOpItem?.content }}</strong>
        </p>
        <p class="op-desc">
          确定将该项决策状态变更为
          <a-tag :color="getStatusTagColor(pendingNewStatus)">
            {{ getStatusText(pendingNewStatus) }}
          </a-tag>
          吗？
        </p>
        <div class="op-remark-box">
          <span class="remark-label">备注或定案说明 (可选):</span>
          <a-textarea
            v-model:value="opRemarkText"
            placeholder="填写定案说明、暂缓原因或执行意见..."
            :rows="3"
            maxlength="200"
            show-count
          />
        </div>
      </div>
    </a-modal>

    <!-- 5. 决策演进追踪抽屉 -->
    <DecisionEvolutionModal
      v-model:open="evolutionDrawerVisible"
      :current-decision="selectedDecisionForEvolution"
      :topic="selectedDecisionForEvolution?.topic"
      :events="aiStore.decisionEvents"
      :loading="aiStore.decisionEventsLoading"
    />

    <!-- 6. 证据溯源详情弹窗 -->
    <a-modal
      v-model:open="evidenceModalVisible"
      title="决策依据与逐字片段溯源"
      :footer="null"
      :width="modalWidth(600)"
    >
      <a-spin :spinning="loadingEvidence">
        <div v-if="evidenceList.length === 0" style="padding: 24px 0">
          <a-empty description="暂未找到更具体的证据链记录" />
        </div>
        <div v-else class="evidence-chain-list">
          <div
            v-for="evi in evidenceList"
            :key="evi.evidenceId"
            class="chain-item"
          >
            <div class="chain-header">
              <span class="chain-speaker font-semibold">{{ evi.speakerName || '参会发言者' }}</span>
              <span class="chain-time mono">{{ formatTime(evi.startTimeMs) }} - {{ formatTime(evi.endTimeMs) }}</span>
              <a-tag v-if="evi.confidenceScore" color="green">置信度: {{ (evi.confidenceScore * 100).toFixed(0) }}%</a-tag>
            </div>
            <div class="chain-quote">
              "{{ evi.quoteText }}"
            </div>
            <div class="chain-action" v-if="evi.segmentId">
              <a-button
                type="link"
                size="small"
                @click="jumpToEvidenceSegment(evi.segmentId, evi.startTimeMs)"
              >
                <RightCircleOutlined /> 跳转至对应转写片段 (#{{ evi.segmentId }})
              </a-button>
            </div>
          </div>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  RobotOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  RightCircleOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  BranchesOutlined,
  BulbOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons-vue'
import { queryEvidence } from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'
import DecisionMindMap from '@/components/meeting-ai/DecisionMindMap.vue'
import DecisionEvolutionModal from '@/components/meeting-ai/DecisionEvolutionModal.vue'
import dayjs from 'dayjs'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const aiStore = useMeetingAiStore()

const loading = ref(false)
const displayView = ref('mindmap') // 'mindmap' | 'list'
const statusFilter = ref('ALL') // 'ALL' | 'CONFIRMED' | 'DISCUSSING' | 'PROPOSED' | 'DEFERRED'

const decisions = computed(() => aiStore.decisions)

// 当前激活选中的决策 ID (脑图聚焦)
const activeDecisionId = computed({
  get: () => aiStore.activeDecisionId,
  set: (val) => aiStore.setActiveDecision(val)
})

const filteredDecisions = computed(() => {
  if (statusFilter.value === 'ALL') return decisions.value
  return decisions.value.filter((d) => {
    if (statusFilter.value === 'PROPOSED') {
      return d.status === 'PROPOSED' || d.status === 'PENDING'
    }
    return d.status === statusFilter.value
  })
})

const activeDecision = computed(() => {
  if (filteredDecisions.value.length === 0) return null
  const found = filteredDecisions.value.find(
    (d) => String(d.decisionId) === String(activeDecisionId.value)
  )
  return found || filteredDecisions.value[0]
})

function selectDecision(id) {
  activeDecisionId.value = id
}

// 各状态计数统计
const confirmedCount = computed(() => {
  return decisions.value.filter((d) => d.status === 'CONFIRMED').length
})

const discussingCount = computed(() => {
  return decisions.value.filter((d) => d.status === 'DISCUSSING').length
})

const proposedCount = computed(() => {
  return decisions.value.filter((d) => d.status === 'PROPOSED' || d.status === 'PENDING').length
})

const deferredCount = computed(() => {
  return decisions.value.filter((d) => d.status === 'DEFERRED').length
})

// 演进历史抽屉
const evolutionDrawerVisible = ref(false)
const selectedDecisionForEvolution = ref(null)

async function openEvolutionDrawer(decision) {
  selectedDecisionForEvolution.value = decision
  evolutionDrawerVisible.value = true
  await aiStore.loadDecisionEvents(decision?.decisionId, props.meetingId)
}

// 决策状态操作弹窗 (确认/否决/暂缓)
const opModalVisible = ref(false)
const currentOpItem = ref(null)
const pendingNewStatus = ref('')
const opRemarkText = ref('')
const submittingOp = ref(false)

const opModalTitle = computed(() => {
  switch (pendingNewStatus.value) {
    case 'CONFIRMED':
      return '确认决策生效'
    case 'REJECTED':
      return '否决废弃决策'
    case 'DEFERRED':
      return '暂缓决定'
    default:
      return '更新决策状态'
  }
})

function openOperationModal(decision, newStatus) {
  currentOpItem.value = decision
  pendingNewStatus.value = newStatus
  opRemarkText.value = ''
  opModalVisible.value = true
}

async function handleConfirmOperation() {
  if (!currentOpItem.value) return
  submittingOp.value = true
  const decisionId = currentOpItem.value.decisionId
  const remark = opRemarkText.value.trim()
  try {
    if (pendingNewStatus.value === 'CONFIRMED') {
      await aiStore.confirmDecisionAction(decisionId, remark)
    } else if (pendingNewStatus.value === 'REJECTED') {
      await aiStore.rejectDecisionAction(decisionId, remark)
    } else if (pendingNewStatus.value === 'DEFERRED') {
      await aiStore.deferDecisionAction(decisionId, remark)
    }
    opModalVisible.value = false
  } catch (err) {
    // 错误在 action 中已处理提示
  } finally {
    submittingOp.value = false
  }
}

// 功能开关切换
async function handleToggleFeature(feature, enabled) {
  await aiStore.toggleFeature(feature, enabled, props.meetingId)
}

// 证据溯源弹窗
const evidenceModalVisible = ref(false)
const loadingEvidence = ref(false)
const evidenceList = ref([])

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onWindowResize() {
  windowWidth.value = window.innerWidth
}
function modalWidth(defaultWidth) {
  return windowWidth.value < 640 ? '94vw' : `${defaultWidth}px`
}

function hasField(val) {
  if (!val) return false
  if (Array.isArray(val) && val.length > 0) return true
  if (typeof val === 'string' && val.trim().length > 0 && val.trim() !== '[]') return true
  return false
}

function parseList(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed)
        if (Array.isArray(arr)) return arr
      } catch (e) {}
    }
    return trimmed.split(/[\n;；,，]+/).map((s) => s.trim().replace(/^[-*•\d+.]\s*/, '')).filter(Boolean)
  }
  return [String(val)]
}

function formatDateTime(timeVal) {
  if (!timeVal) return ''
  return dayjs(timeVal).format('MM-DD HH:mm')
}

function getStatusText(status) {
  switch (status) {
    case 'CONFIRMED':
      return '正式生效'
    case 'DISCUSSING':
      return '讨论中'
    case 'PROPOSED':
    case 'PENDING':
      return '候选方案'
    case 'DEFERRED':
      return '暂缓决定'
    case 'REJECTED':
      return '已否决'
    case 'CANCELLED':
      return '已取消'
    default:
      return status || '待定'
  }
}

function getStatusTagColor(status) {
  switch (status) {
    case 'CONFIRMED':
      return 'success'
    case 'DISCUSSING':
      return 'processing'
    case 'PROPOSED':
    case 'PENDING':
      return 'warning'
    case 'DEFERRED':
      return 'purple'
    case 'REJECTED':
      return 'default'
    case 'CANCELLED':
      return 'error'
    default:
      return 'default'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'CONFIRMED':
      return CheckCircleOutlined
    case 'DISCUSSING':
      return BranchesOutlined
    case 'PROPOSED':
    case 'PENDING':
      return BulbOutlined
    case 'DEFERRED':
      return ClockCircleOutlined
    case 'REJECTED':
      return CloseCircleOutlined
    default:
      return BulbOutlined
  }
}

function formatTime(ms) {
  if (!ms && ms !== 0) return '00:00'
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function fetchDecisions() {
  if (!props.meetingId) return
  loading.value = true
  try {
    await Promise.allSettled([
      aiStore.loadDecisions(props.meetingId),
      aiStore.fetchFeatureStatus(props.meetingId)
    ])
  } catch (err) {
    console.error('获取决策列表失败', err)
  } finally {
    loading.value = false
  }
}

function handleReanalyze() {
  aiStore.triggerAnalysis(props.meetingId, true)
}

async function viewEvidenceChain(item) {
  evidenceModalVisible.value = true
  loadingEvidence.value = true
  evidenceList.value = []
  try {
    const list = await queryEvidence({
      targetType: 'DECISION',
      targetId: item.decisionId
    })
    evidenceList.value = list || []
  } catch (err) {
    console.error('查询决策证据失败', err)
  } finally {
    loadingEvidence.value = false
  }
}

function jumpToEvidenceSegment(segmentId, startTimeMs) {
  evidenceModalVisible.value = false
  aiStore.jumpToSegment(segmentId, startTimeMs)
}

watch(
  () => props.meetingId,
  () => {
    fetchDecisions()
  },
  { immediate: true }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }
  fetchDecisions()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize)
  }
})
</script>

<style scoped>
.decisions-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-card);
  overflow: hidden;
}

/* 1. 功能开关与 ASR 状态指示条 */
.feature-status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f0f7ff;
  border-bottom: 1px solid #d6e4ff;
  flex-wrap: wrap;
  gap: 10px;
}

.banner-switches {
  display: flex;
  align-items: center;
  gap: 16px;
}

.switch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1e293b;
}

.switch-label {
  font-weight: 500;
}

.banner-asr-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.asr-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #e2e8f0;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.asr-pill.is-running {
  background: #dcfce7;
  color: #15803d;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.25);
}

.asr-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.asr-dot.pulse {
  background: #22c55e;
  animation: asr-pulse-dot 1.5s infinite ease-in-out;
}

@keyframes asr-pulse-dot {
  0% { transform: scale(0.85); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.85); opacity: 0.6; }
}

.info-help-icon {
  color: #1677ff;
  cursor: pointer;
  font-size: 14px;
}

/* 2. 面板顶部工具栏 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-color);
  background: #fafafa;
  flex-wrap: wrap;
  gap: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--text-main);
}

.count-badge {
  font-size: 12px;
  color: var(--text-secondary);
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.view-switch {
  margin-left: 6px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 3. 主体内容区域 */
.panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.empty-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}

.decisions-content-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
}

/* 模式 A：思维导图容器 */
.mindmap-view-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 480px;
}

.decision-selector-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.selector-hint {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.selector-pills-list {
  display: flex;
  gap: 8px;
  align-items: center;
}

.decision-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 220px;
}

.decision-pill:hover {
  background: #e2e8f0;
}

.decision-pill.active {
  background: #e6f4ff;
  border-color: #91caff;
  color: #1677ff;
  font-weight: 600;
}

.pill-idx {
  font-size: 10px;
  color: #64748b;
}

.pill-topic {
  max-width: 110px;
}

.pill-tag {
  margin: 0;
  font-size: 10px;
  line-height: 16px;
  padding: 0 4px;
}

.mindmap-render-area {
  flex: 1;
  display: flex;
  height: 100%;
  min-height: 480px;
}

/* 模式 B：卡片列表样式 */
.decisions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
  padding: 18px 20px;
  width: 100%;
}

.decision-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
}

.decision-card.is-confirmed {
  border-left: 4px solid #52c41a;
}

.decision-card.is-discussing {
  border-left: 4px solid #1677ff;
}

.decision-card.is-proposed {
  border-left: 4px solid #faad14;
}

.decision-card.is-deferred {
  border-left: 4px solid #722ed1;
}

.decision-card.is-rejected {
  border-left: 4px solid #d9d9d9;
  opacity: 0.8;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.card-topic {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.decision-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.card-content {
  margin: 2px 0;
}

.content-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  line-height: 1.6;
  margin: 0;
}

.card-branches-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px 12px;
}

.branch-pill-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
}

.pill-label {
  font-weight: 600;
  color: #475569;
  flex-shrink: 0;
}

.pill-label.pro {
  color: #389e0d;
}

.pill-label.con {
  color: #cf1322;
}

.pill-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-pill {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.opt-pill {
  background: #e6f4ff;
  color: #0958d9;
  border: 1px solid #bae0ff;
}

.pro-pill {
  background: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}

.con-pill {
  background: #fff2e8;
  color: #d4380d;
  border: 1px solid #ffd8bf;
}

.card-action-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: #475569;
}

.card-evidence {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f9fbfd;
  border: 1px solid #e6f0fa;
  border-radius: 6px;
  padding: 8px 12px;
  gap: 12px;
}

.evidence-quote-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.quote-text {
  word-break: break-word;
}

.trace-btn {
  font-size: 12px;
  padding: 0;
  flex-shrink: 0;
}

/* 操作弹窗 */
.op-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.op-topic {
  font-size: 14px;
  color: #1e293b;
  margin: 0;
}

.op-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.op-remark-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.remark-label {
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

/* 证据溯源弹窗 */
.evidence-chain-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.chain-item {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chain-speaker {
  font-size: 13px;
}

.chain-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.chain-quote {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
  background: #ffffff;
  padding: 8px 10px;
  border-radius: 4px;
  border-left: 3px solid #1677ff;
}

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .feature-status-banner {
    padding: 8px 12px;
  }

  .banner-switches {
    width: 100%;
    justify-content: space-between;
  }

  .banner-asr-indicator {
    width: 100%;
    justify-content: space-between;
  }

  .panel-header {
    padding: 10px 12px;
    gap: 8px;
  }

  .header-left {
    width: 100%;
    justify-content: space-between;
  }

  .header-right {
    width: 100%;
  }

  .status-filter-group {
    display: flex;
    width: 100%;
    overflow-x: auto;
  }

  .status-filter-group :deep(.ant-radio-button-wrapper) {
    flex: 1;
    text-align: center;
    padding: 0 4px;
    font-size: 11px;
  }

  .decisions-list {
    padding: 12px 10px;
  }

  .decision-card {
    padding: 12px;
  }

  .card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .head-left {
    width: 100%;
  }

  .head-right {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
