<template>
  <div class="terminology-panel">
    <!-- 1. 会中实时术语智能开关、领域提示与语言配置栏 -->
    <div class="term-config-banner">
      <div class="config-left">
        <div class="switch-group">
          <span class="cfg-label">实时术语识别:</span>
          <a-switch
            :checked="aiStore.isTermIntelligenceEnabled"
            :loading="aiStore.featureLoading"
            size="small"
            checked-children="开"
            un-checked-children="关"
            @change="handleToggleTermFeature"
          />
        </div>

        <div class="select-group">
          <span class="cfg-label">领域提示:</span>
          <a-select
            v-model:value="localDomainHint"
            allow-clear
            show-search
            placeholder="自动识别(全领域)"
            size="small"
            style="width: 150px"
            @change="handleSaveTermConfig"
          >
            <a-select-option value="">自动识别(不限)</a-select-option>
            <a-select-option v-for="d in domainOptions" :key="d" :value="d">
              {{ d }}
            </a-select-option>
          </a-select>
        </div>

        <div class="select-group">
          <span class="cfg-label">输出语言:</span>
          <a-select
            v-model:value="localPreferredLang"
            size="small"
            style="width: 120px"
            @change="handleSaveTermConfig"
          >
            <a-select-option value="zh">中文 (zh)</a-select-option>
            <a-select-option value="en">English (en)</a-select-option>
            <a-select-option value="th">ไทย (th)</a-select-option>
            <a-select-option value="fil">Filipino (fil)</a-select-option>
            <a-select-option value="id">Indonesia (id)</a-select-option>
            <a-select-option value="ms">Melayu (ms)</a-select-option>
          </a-select>
        </div>
      </div>

      <div class="config-right">
        <a-tag v-if="aiStore.termDomainsMeta" color="blue" class="model-tag">
          {{ aiStore.termDomainsMeta.modelVersion }} / {{ aiStore.termDomainsMeta.adapterVersion }}
        </a-tag>
        <a-button size="small" type="link" @click="goToTerminologyCenter">
          <ExperimentOutlined /> 术语中心 / 模型对比
        </a-button>
      </div>
    </div>

    <!-- 2. 操作控制与筛选栏 -->
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">会议行业术语智能理解</h3>
        <span class="count-badge">已识别 {{ aiStore.meetingTerms.length }} 项</span>
        <a-tag v-if="aiStore.conflictDualTermsCount > 0" color="purple">
          口径双显 {{ aiStore.conflictDualTermsCount }}
        </a-tag>
        <a-tag v-if="aiStore.ambiguousTermsCount > 0" color="warning">
          多义待定 {{ aiStore.ambiguousTermsCount }}
        </a-tag>
      </div>

      <div class="header-right">
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="检索术语/标准名/释义..."
          size="small"
          style="width: 190px"
          allow-clear
        />

        <a-button size="small" @click="openQuickAskModal">
          <QuestionCircleOutlined /> 结合本场提问
        </a-button>

        <a-button size="small" @click="refreshTerminologyAll">
          <ReloadOutlined :spin="aiStore.meetingTermsLoading" /> 刷新
        </a-button>

        <a-button
          type="default"
          size="small"
          :loading="aiStore.terminologyAnalyzing"
          @click="handleSyncAnalyze"
        >
          <ThunderboltOutlined /> 同步识别
        </a-button>

        <a-button
          type="primary"
          size="small"
          :loading="aiStore.isAnalyzing"
          @click="handleAsyncAnalyze"
        >
          <RobotOutlined /> 异步深度重析
        </a-button>
      </div>
    </div>

    <!-- 3. 内部分视图：三层术语解释 / 原文出现明细 / 全链路 Trace -->
    <div class="panel-body">
      <a-tabs v-model:activeKey="innerTab" class="inner-tabs" @change="handleInnerTabChange">
        <a-tab-pane key="cards">
          <template #tab>
            <span>
              三层智能解释 ({{ filteredTerms.length }})
            </span>
          </template>

          <!-- 总结概览 + [跨域因果传导链] -->
          <div v-if="aiStore.meetingCausalSummary" class="meeting-summary-banner">
            <div class="ms-head">
              <span class="ms-badge">总结概览</span>
              <span v-if="aiStore.meetingCausalMeta?.modelName" class="ms-meta mono">
                {{ aiStore.meetingCausalMeta.modelName }} / {{ aiStore.meetingCausalMeta.adapterVersion }}
              </span>
            </div>
            <div class="ms-text">{{ aiStore.meetingCausalSummary }}</div>
          </div>

          <TerminologyCausalChainView
            v-if="aiStore.meetingCausalChains && aiStore.meetingCausalChains.length > 0"
            :chains="aiStore.meetingCausalChains"
            @jump-evidence="handleJumpEvidence"
          />

          <div class="filter-bar">
            <a-radio-group v-model:value="statusFilter" size="small" button-style="solid">
              <a-radio-button value="ALL">全部 ({{ aiStore.meetingTerms.length }})</a-radio-button>
              <a-radio-button value="CONFLICT_DUAL">企业冲突双显 ({{ aiStore.conflictDualTermsCount }})</a-radio-button>
              <a-radio-button value="AMBIGUOUS">多义待确认 ({{ aiStore.ambiguousTermsCount }})</a-radio-button>
              <a-radio-button value="CORRECTED">已人工纠偏</a-radio-button>
            </a-radio-group>
          </div>

          <a-spin :spinning="aiStore.meetingTermsLoading || aiStore.terminologyAnalyzing">
            <div v-if="filteredTerms.length === 0" class="empty-box">
              <a-empty description="当前会议暂无行业术语识别结果">
                <template #extra>
                  <a-space>
                    <a-button type="primary" :loading="aiStore.terminologyAnalyzing" @click="handleSyncAnalyze">
                      <ThunderboltOutlined /> 基于已有转写立即识别术语
                    </a-button>
                    <a-button @click="goToTerminologyCenter">前往术语中心直接提问</a-button>
                  </a-space>
                </template>
              </a-empty>
            </div>

            <div v-else class="term-cards-list">
              <TerminologyCard
                v-for="(item, idx) in filteredTerms"
                :key="item.occurrenceId || item.explanationId || `${item.surface}-${idx}`"
                :term="item"
                :show-review-action="Boolean(item.occurrenceId || item.explanationId)"
                @jump-evidence="handleJumpEvidence"
                @review="openReviewModal"
              />
            </div>
          </a-spin>
        </a-tab-pane>

        <a-tab-pane key="occurrences" tab="原文出现明细">
          <a-table
            :data-source="aiStore.termOccurrences"
            :columns="occurrenceColumns"
            :loading="aiStore.termOccurrencesLoading"
            row-key="occurrenceId"
            size="small"
            :scroll="{ x: 860 }"
            :pagination="{ pageSize: 12 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'surface'">
                <span class="occ-surface">{{ record.surfaceText }}</span>
                <span v-if="record.standardName" class="occ-std">→ {{ record.standardName }}</span>
              </template>
              <template v-else-if="column.key === 'location'">
                <a-button
                  v-if="record.segmentId"
                  type="link"
                  size="small"
                  style="padding: 0"
                  @click="aiStore.jumpToSegment(record.segmentId, record.startTimeMs)"
                >
                  {{ record.speakerName || '发言人' }} · {{ formatMs(record.startTimeMs) }} [{{ record.startOffset ?? '-' }}, {{ record.endOffset ?? '-' }})
                </a-button>
                <span v-else>-</span>
              </template>
              <template v-else-if="column.key === 'ambiguityStatus'">
                <a-tag :color="getAmbiguityTagColor(record.ambiguityStatus)">
                  {{ record.ambiguityStatus }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'reviewStatus'">
                <a-tag :color="record.reviewStatus === 'CORRECTED' ? 'blue' : record.reviewStatus === 'CONFIRMED' ? 'green' : 'default'">
                  {{ record.reviewStatus || 'AUTO' }}
                </a-tag>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="traces" tab="Trace 全链路审计">
          <a-spin :spinning="aiStore.termTracesLoading">
            <div v-if="aiStore.termTraces.length === 0" class="empty-box">
              <a-empty description="暂无术语分析 Trace 审计日志" />
            </div>
            <div v-else class="trace-list">
              <div v-for="tr in aiStore.termTraces" :key="tr.traceId" class="trace-card">
                <div class="trace-head">
                  <div class="trace-title-left">
                    <span class="trace-type">{{ tr.analysisType }}</span>
                    <span class="trace-id mono">{{ tr.traceId }}</span>
                  </div>
                  <div class="trace-tags">
                    <a-tag :color="tr.status === 'SUCCESS' ? 'success' : 'warning'">{{ tr.status }}</a-tag>
                    <span class="mono cost-txt">{{ tr.costMs ?? '-' }} ms</span>
                  </div>
                </div>

                <div class="trace-meta-grid">
                  <span>模型: <strong>{{ tr.modelName || '-' }}</strong></span>
                  <span>模型版本: {{ tr.modelVersion || '-' }}</span>
                  <span>LoRA 适配器: <a-tag color="geekblue">{{ tr.adapterVersion || '-' }}</a-tag></span>
                  <span>Prompt 版本: {{ tr.promptVersion || '-' }}</span>
                  <span v-if="tr.promptTokens != null">Token: {{ tr.promptTokens }} / {{ tr.completionTokens ?? '-' }}</span>
                  <span>时间: {{ tr.createTime }}</span>
                </div>

                <div v-if="tr.analysisSummary" class="trace-summary">
                  <strong>分析摘要:</strong> {{ tr.analysisSummary }}
                </div>

                <div v-if="tr.toolCallsJson" class="trace-json-block">
                  <span class="json-label">检索/工具调用审计 (已剥离隐藏推理):</span>
                  <pre class="json-pre">{{ formatPrettyJson(tr.toolCallsJson) }}</pre>
                </div>

                <a-collapse v-if="tr.structuredOutputJson" ghost size="small">
                  <a-collapse-panel key="raw" header="查看结构化输出快照">
                    <pre class="json-pre">{{ formatPrettyJson(tr.structuredOutputJson) }}</pre>
                  </a-collapse-panel>
                </a-collapse>
              </div>
            </div>
          </a-spin>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 人工审核与纠偏弹窗 -->
    <a-modal
      v-model:open="reviewModalOpen"
      title="人工审核与术语口径纠偏"
      :confirm-loading="submittingReview"
      width="620px"
      @ok="submitReviewForm"
    >
      <a-form layout="vertical" style="margin-top: 12px">
        <a-alert
          v-if="reviewTarget"
          type="info"
          show-icon
          style="margin-bottom: 14px"
          :message="`正在审核术语「${reviewTarget.surface}」 -> 当前识别: ${reviewTarget.canonicalName || '-'}`"
        />

        <a-form-item label="审核结论" required>
          <a-radio-group v-model:value="reviewForm.reviewStatus">
            <a-radio value="CONFIRMED">确认准确 (CONFIRMED)</a-radio>
            <a-radio value="CORRECTED">修正释义 (CORRECTED)</a-radio>
            <a-radio value="REJECTED">标记误报/作废 (REJECTED)</a-radio>
          </a-radio-group>
        </a-form-item>

        <template v-if="reviewForm.reviewStatus === 'CORRECTED'">
          <div class="form-grid-2">
            <a-form-item label="更正标准名称">
              <a-input v-model:value="reviewForm.correctedStandardName" placeholder="如 Minimum Order Quantity" />
            </a-form-item>
            <a-form-item label="更正所属行业领域">
              <a-input v-model:value="reviewForm.correctedDomain" placeholder="如 采购管理" />
            </a-form-item>
          </div>
          <a-form-item label="更正通用标准定义">
            <a-textarea v-model:value="reviewForm.correctedDefinition" :rows="2" />
          </a-form-item>
          <a-form-item label="更正本次会议上下文含义">
            <a-textarea v-model:value="reviewForm.correctedContextMeaning" :rows="2" />
          </a-form-item>
        </template>

        <a-form-item label="人工审核批注 / 口径备注">
          <a-textarea
            v-model:value="reviewForm.userCorrection"
            :rows="2"
            placeholder="例如：本次讨论专指物料 B 的供应商 MOQ 门槛，与车间内部代号无关"
          />
        </a-form-item>

        <a-form-item v-if="authStore.isAdmin" label="沉淀至可选标准术语审核缓存 (仅管理员)">
          <a-switch v-model:checked="reviewForm.promoteToVerifiedCache" />
          <span class="help-hint">开启后将标注为 HUMAN_VERIFIED 存入 term_verified_cache 供后续参照</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 结合本场会议快速提问弹窗 -->
    <a-modal
      v-model:open="quickAskModalOpen"
      title="结合当前会议上下文提问行业术语"
      :footer="null"
      width="760px"
    >
      <div class="quick-ask-wrap">
        <div class="quick-ask-bar">
          <a-input-search
            v-model:value="quickAskQuery"
            placeholder="输入本场会议提及的术语或指标疑惑，如：这里的 LT 和 MOQ 如何影响交期？"
            enter-button="模型解析"
            :loading="quickAskLoading"
            @search="handleQuickAsk"
          />
        </div>
        <div v-if="quickAskResult" class="quick-ask-result">
          <div class="qa-res-summary">
            <strong>总结概览:</strong> {{ quickAskResult.summary }}
          </div>
          <TerminologyCausalChainView
            v-if="quickAskResult.causalChains && quickAskResult.causalChains.length > 0"
            :chains="quickAskResult.causalChains"
            compact
            @jump-evidence="handleJumpEvidence"
          />
          <TerminologyCard
            v-for="(t, i) in (quickAskResult.terms || [])"
            :key="i"
            :term="t"
            compact
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
  ExperimentOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { askTermKnowledge } from '@/api/meetingAi'
import TerminologyCard from './TerminologyCard.vue'
import TerminologyCausalChainView from './TerminologyCausalChainView.vue'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const router = useRouter()
const authStore = useAuthStore()
const aiStore = useMeetingAiStore()

const innerTab = ref('cards')
const statusFilter = ref('ALL')
const searchKeyword = ref('')

const localDomainHint = ref(aiStore.featureConfig.domainHint || '')
const localPreferredLang = ref(aiStore.featureConfig.preferredLang || 'zh')

watch(
  () => [aiStore.featureConfig.domainHint, aiStore.featureConfig.preferredLang],
  ([d, l]) => {
    localDomainHint.value = d || ''
    localPreferredLang.value = l || 'zh'
  },
  { immediate: true }
)

const domainOptions = computed(() => {
  return aiStore.termDomainsMeta?.supportedDomains || [
    '制造业',
    '质量管理',
    '生产管理',
    '采购管理',
    '供应链管理',
    '仓储物流',
    '外贸业务',
    '商贸业务',
    '财务管理',
    '企业经营管理',
    '项目管理',
    '信息技术'
  ]
})

const filteredTerms = computed(() => {
  let list = aiStore.meetingTerms || []
  if (statusFilter.value === 'CONFLICT_DUAL') {
    list = list.filter((t) => t.ambiguityStatus === 'CONFLICT_DUAL')
  } else if (statusFilter.value === 'AMBIGUOUS') {
    list = list.filter((t) => t.ambiguityStatus === 'AMBIGUOUS' || t.ambiguityStatus === 'UNRESOLVED')
  } else if (statusFilter.value === 'CORRECTED') {
    list = list.filter((t) => t.reviewStatus === 'CORRECTED' || t.reviewStatus === 'CONFIRMED')
  }

  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((t) =>
      [
        t.surface,
        t.canonicalName,
        t.chineseName,
        t.englishFullName,
        t.domain,
        t.definition,
        t.contextMeaning
      ]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(kw))
    )
  }
  return list
})

const occurrenceColumns = [
  { title: '原文命中 → 标准名', key: 'surface', width: 220 },
  { title: '领域', dataIndex: 'detectedDomain', key: 'detectedDomain', width: 120 },
  { title: '原文定位与偏移', key: 'location', width: 240 },
  { title: '上下文片段', dataIndex: 'contextSnippet', key: 'contextSnippet', ellipsis: true },
  { title: '消歧状态', key: 'ambiguityStatus', width: 130 },
  { title: '审核状态', key: 'reviewStatus', width: 100 }
]

async function handleToggleTermFeature(enabled) {
  await aiStore.updateTermConfig({ termIntelligenceEnabled: enabled }, props.meetingId)
}

async function handleSaveTermConfig() {
  await aiStore.updateTermConfig(
    {
      domainHint: localDomainHint.value || '',
      preferredLang: localPreferredLang.value || 'zh'
    },
    props.meetingId
  )
}

async function refreshTerminologyAll() {
  await Promise.allSettled([
    aiStore.loadMeetingTerms(props.meetingId),
    aiStore.loadMeetingCausalChains(props.meetingId),
    aiStore.loadTermOccurrences(props.meetingId),
    aiStore.loadTermTraces(props.meetingId)
  ])
}

async function handleSyncAnalyze() {
  await aiStore.triggerMeetingTermAnalysis(
    {
      domainHint: localDomainHint.value || undefined,
      targetLang: localPreferredLang.value || 'zh'
    },
    props.meetingId
  )
}

async function handleAsyncAnalyze() {
  await aiStore.triggerMeetingTermAnalysisAsync(
    {
      domainHint: localDomainHint.value || undefined,
      targetLang: localPreferredLang.value || 'zh',
      forceReanalyze: true
    },
    props.meetingId
  )
}

function handleInnerTabChange(key) {
  if (key === 'occurrences' && aiStore.termOccurrences.length === 0) {
    aiStore.loadTermOccurrences(props.meetingId)
  } else if (key === 'traces' && aiStore.termTraces.length === 0) {
    aiStore.loadTermTraces(props.meetingId)
  }
}

function handleJumpEvidence(ev) {
  if (ev && ev.segmentId) {
    aiStore.jumpToSegment(ev.segmentId, ev.startTime)
  }
}

// 审核纠偏弹窗
const reviewModalOpen = ref(false)
const submittingReview = ref(false)
const reviewTarget = ref(null)
const reviewForm = ref({
  occurrenceId: '',
  explanationId: '',
  reviewStatus: 'CONFIRMED',
  correctedStandardName: '',
  correctedDomain: '',
  correctedDefinition: '',
  correctedContextMeaning: '',
  userCorrection: '',
  promoteToVerifiedCache: false
})

function openReviewModal(term) {
  reviewTarget.value = term
  reviewForm.value = {
    occurrenceId: term.occurrenceId || '',
    explanationId: term.explanationId || '',
    reviewStatus: term.reviewStatus && term.reviewStatus !== 'AUTO' ? term.reviewStatus : 'CONFIRMED',
    correctedStandardName: term.canonicalName || '',
    correctedDomain: term.domain || '',
    correctedDefinition: term.definition || '',
    correctedContextMeaning: term.contextMeaning || '',
    userCorrection: term.userCorrection || '',
    promoteToVerifiedCache: false
  }
  reviewModalOpen.value = true
}

async function submitReviewForm() {
  submittingReview.value = true
  try {
    await aiStore.correctTermAction(reviewForm.value)
    reviewModalOpen.value = false
  } finally {
    submittingReview.value = false
  }
}

// 快速结合本场提问弹窗
const quickAskModalOpen = ref(false)
const quickAskQuery = ref('')
const quickAskLoading = ref(false)
const quickAskResult = ref(null)

function openQuickAskModal() {
  quickAskResult.value = null
  quickAskModalOpen.value = true
}

async function handleQuickAsk() {
  const q = quickAskQuery.value.trim()
  if (!q) {
    message.warning('请输入要提问的术语或业务问题')
    return
  }
  quickAskLoading.value = true
  try {
    quickAskResult.value = await askTermKnowledge({
      query: q,
      meetingId: props.meetingId,
      domainHint: localDomainHint.value || undefined,
      targetLang: localPreferredLang.value || 'zh'
    })
  } catch (err) {
    message.error(err.message || '模型解析提问失败')
  } finally {
    quickAskLoading.value = false
  }
}

function goToTerminologyCenter() {
  router.push('/terminology')
}

function getAmbiguityTagColor(status) {
  if (status === 'RESOLVED') return 'green'
  if (status === 'CONFLICT_DUAL') return 'purple'
  if (status === 'AMBIGUOUS') return 'warning'
  return 'default'
}

function formatMs(ms) {
  if (ms === null || ms === undefined) return '00:00'
  const sec = Math.floor(Number(ms) / 1000)
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function formatPrettyJson(raw) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch (e) {
    return raw
  }
}

onMounted(() => {
  aiStore.loadTermDomainsMeta()
  if (props.meetingId) {
    aiStore.fetchFeatureStatus(props.meetingId)
    aiStore.loadMeetingTerms(props.meetingId)
    aiStore.loadMeetingCausalChains(props.meetingId)
  }
})

watch(
  () => props.meetingId,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      aiStore.fetchFeatureStatus(newId)
      aiStore.loadMeetingTerms(newId)
      aiStore.loadMeetingCausalChains(newId)
    }
  }
)
</script>

<style scoped>
.terminology-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.term-config-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 20px;
  background: #f5f9ff;
  border-bottom: 1px solid #d6e4ff;
}

.config-left,
.config-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.switch-group,
.select-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cfg-label {
  font-size: 12px;
  color: var(--text-regular);
  font-weight: 500;
}

.model-tag {
  margin-right: 0;
  font-size: 11px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 20px;
  background: #fafafa;
  border-bottom: 1px solid var(--border-color);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 20px;
}

.filter-bar {
  margin-bottom: 14px;
}

.empty-box {
  padding: 48px 0;
  text-align: center;
}

.term-cards-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.occ-surface {
  font-weight: 600;
  color: #1677ff;
  margin-right: 6px;
}

.occ-std {
  color: var(--text-regular);
  font-size: 12px;
}

.trace-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trace-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.trace-title-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.trace-type {
  font-weight: 600;
  font-size: 13px;
}

.trace-id {
  font-size: 11px;
  color: var(--text-secondary);
}

.trace-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: var(--text-regular);
}

.trace-summary {
  font-size: 12px;
  color: var(--text-main);
  background: #fafafa;
  padding: 8px 10px;
  border-radius: 6px;
}

.json-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.json-pre {
  background: #f5f7fa;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  max-height: 220px;
  overflow: auto;
  margin: 4px 0 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.help-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.quick-ask-bar {
  margin-bottom: 14px;
}

.quick-ask-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.qa-res-summary {
  background: #f0f7ff;
  border: 1px solid #bae0ff;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #0958d9;
}

.meeting-summary-banner {
  background: #f0f7ff;
  border: 1px solid #bae0ff;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
}

.ms-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.ms-badge {
  font-size: 12px;
  font-weight: 600;
  color: #0958d9;
}

.ms-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.ms-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.55;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
