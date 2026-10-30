<template>
  <div class="decisions-panel">
    <!-- 顶部状态栏 -->
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">会议决策管理</h3>
        <span class="count-badge">共 {{ decisions.length }} 项决议</span>
      </div>

      <div class="header-right">
        <!-- 状态筛选 -->
        <a-radio-group v-model:value="statusFilter" size="small" button-style="solid">
          <a-radio-button value="ALL">全部 ({{ decisions.length }})</a-radio-button>
          <a-radio-button value="CONFIRMED">正式生效 ({{ confirmedCount }})</a-radio-button>
          <a-radio-button value="PENDING">候选待定 ({{ pendingCount }})</a-radio-button>
        </a-radio-group>

        <a-button @click="fetchDecisions">
          <ReloadOutlined :spin="loading" /> 刷新
        </a-button>

        <a-button type="primary" ghost :loading="aiStore.isAnalyzing" @click="handleReanalyze">
          <RobotOutlined /> 重新提取决策
        </a-button>
      </div>
    </div>

    <!-- 决策提示通知栏 -->
    <div class="alert-bar">
      <a-alert
        message="AI 辅助提示：模型提取出的决议默认为「候选待定」，须经参会人员确认后方可转为「正式生效」决议。"
        type="info"
        show-icon
        banner
      />
    </div>

    <!-- 决策列表主体 -->
    <div class="panel-body">
      <a-spin :spinning="loading">
        <div v-if="filteredDecisions.length === 0" class="empty-state">
          <a-empty description="暂无符合条件的会议决策">
            <template #extra>
              <a-button type="primary" :loading="aiStore.isAnalyzing" @click="handleReanalyze">
                <RobotOutlined /> 发起 AI 决策提取
              </a-button>
            </template>
          </a-empty>
        </div>

        <div v-else class="decisions-list">
          <div
            v-for="item in filteredDecisions"
            :key="item.decisionId"
            class="decision-card"
            :class="{
              'is-confirmed': item.status === 'CONFIRMED',
              'is-pending': item.status === 'PENDING',
              'is-rejected': item.status === 'REJECTED'
            }"
          >
            <!-- 头部：状态、人员与操作 -->
            <div class="card-head">
              <div class="head-left">
                <a-tag :color="getStatusTagColor(item.status)">
                  <component :is="getStatusIcon(item.status)" />
                  {{ getStatusText(item.status) }}
                </a-tag>
                <span class="decision-meta" v-if="item.proposer">
                  提议人: <strong>{{ item.proposer }}</strong>
                </span>
                <span class="decision-meta" v-if="item.decisionMaker">
                  决策定案人: <strong>{{ item.decisionMaker }}</strong>
                </span>
              </div>

              <!-- 状态调整操作 -->
              <div class="head-right">
                <a-button
                  v-if="item.status !== 'CONFIRMED'"
                  type="primary"
                  size="small"
                  @click="handleUpdateStatus(item, 'CONFIRMED')"
                >
                  <CheckOutlined /> 确认生效
                </a-button>
                <a-button
                  v-if="item.status !== 'PENDING'"
                  type="default"
                  size="small"
                  @click="handleUpdateStatus(item, 'PENDING')"
                >
                  转为候选
                </a-button>
                <a-button
                  v-if="item.status !== 'REJECTED'"
                  danger
                  type="text"
                  size="small"
                  @click="handleUpdateStatus(item, 'REJECTED')"
                >
                  否决/废弃
                </a-button>
              </div>
            </div>

            <!-- 决议正文 -->
            <div class="card-content">
              <p class="content-text">{{ item.content }}</p>
            </div>

            <!-- 决策依据/背景说明 -->
            <div class="card-rationale" v-if="item.rationale">
              <span class="rationale-label">立论背景:</span>
              <span class="rationale-text">{{ item.rationale }}</span>
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
                <SearchOutlined /> 查看详细证据溯源
              </a-button>
            </div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- 证据溯源详情弹窗 -->
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
  FileTextOutlined
} from '@ant-design/icons-vue'
import {
  getDecisionList,
  updateDecision,
  queryEvidence
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const aiStore = useMeetingAiStore()

const loading = ref(false)
const statusFilter = ref('ALL') // 'ALL' | 'CONFIRMED' | 'PENDING'

const decisions = computed(() => aiStore.decisions)

const confirmedCount = computed(() => {
  return decisions.value.filter((d) => d.status === 'CONFIRMED').length
})

const pendingCount = computed(() => {
  return decisions.value.filter((d) => d.status === 'PENDING').length
})

const filteredDecisions = computed(() => {
  if (statusFilter.value === 'ALL') return decisions.value
  return decisions.value.filter((d) => d.status === statusFilter.value)
})

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

function getStatusText(status) {
  switch (status) {
    case 'CONFIRMED':
      return '正式生效决策'
    case 'PENDING':
      return '候选待定决策'
    case 'REJECTED':
      return '已否决废弃'
    default:
      return status
  }
}

function getStatusTagColor(status) {
  switch (status) {
    case 'CONFIRMED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
      return 'default'
    default:
      return 'default'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'CONFIRMED':
      return CheckCircleOutlined
    case 'PENDING':
      return ClockCircleOutlined
    case 'REJECTED':
      return CloseCircleOutlined
    default:
      return ClockCircleOutlined
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
    await aiStore.loadDecisions(props.meetingId)
  } catch (err) {
    console.error('获取决策列表失败', err)
  } finally {
    loading.value = false
  }
}

async function handleUpdateStatus(item, newStatus) {
  try {
    await updateDecision({
      decisionId: item.decisionId,
      status: newStatus
    })
    item.status = newStatus
    message.success(`决策状态已更新为「${getStatusText(newStatus)}」`)
  } catch (err) {
    message.error(err.message || '更新决策状态失败')
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

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: #fafafa;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-title {
  font-size: 16px;
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

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-bar {
  border-bottom: 1px solid var(--border-color);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.decisions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.decision-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
}

.decision-card.is-confirmed {
  border-left: 4px solid #52c41a;
}

.decision-card.is-pending {
  border-left: 4px solid #faad14;
}

.decision-card.is-rejected {
  border-left: 4px solid #d9d9d9;
  opacity: 0.75;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.decision-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-content {
  margin: 2px 0;
}

.content-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.6;
  margin: 0;
}

.card-rationale {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.rationale-label {
  font-weight: 600;
  margin-right: 6px;
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
  font-size: 13px;
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

@media (max-width: 768px) {
  .panel-header {
    padding: 12px 14px;
    gap: 10px;
  }

  .header-left {
    width: 100%;
    justify-content: space-between;
  }

  .panel-title {
    font-size: 15px;
  }

  .header-right {
    width: 100%;
    gap: 8px;
  }

  .header-right :deep(.ant-radio-group) {
    display: flex;
    width: 100%;
  }

  .header-right :deep(.ant-radio-button-wrapper) {
    flex: 1;
    text-align: center;
    padding: 0 4px;
    font-size: 11px;
  }

  .header-right .ant-btn {
    flex: 1;
    font-size: 12px;
  }

  .panel-body {
    padding: 12px 10px;
  }

  .decision-card {
    padding: 14px 12px;
    gap: 10px;
  }

  .card-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .head-left {
    width: 100%;
    flex-wrap: wrap;
    gap: 6px;
  }

  .head-right {
    width: 100%;
    justify-content: flex-end;
  }

  .card-evidence {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .trace-btn {
    align-self: flex-start;
  }
}
</style>
