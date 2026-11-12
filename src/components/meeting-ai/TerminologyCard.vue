<template>
  <div
    class="term-card"
    :class="{
      'is-compact': compact,
      'is-conflict': term.ambiguityStatus === 'CONFLICT_DUAL',
      'is-ambiguous': term.ambiguityStatus === 'AMBIGUOUS' || term.ambiguityStatus === 'UNRESOLVED',
      'is-corrected': term.reviewStatus === 'CORRECTED'
    }"
  >
    <!-- 顶部主标题与状态标识 -->
    <div class="term-card-head">
      <div class="head-main">
        <div class="title-line">
          <span class="term-surface">{{ term.surface || term.canonicalName }}</span>
          <span v-if="term.canonicalName && term.canonicalName !== term.surface" class="term-arrow">→</span>
          <span v-if="term.canonicalName && term.canonicalName !== term.surface" class="term-canonical">
            {{ term.canonicalName }}
          </span>
          <span v-if="term.chineseName" class="term-cn">({{ term.chineseName }})</span>
        </div>

        <div class="meta-tags-row">
          <a-tag v-if="term.domain" color="blue" class="mini-tag">
            {{ term.domain }}<template v-if="term.subDomain"> / {{ term.subDomain }}</template>
          </a-tag>
          <a-tag :color="ambiguityColor" class="mini-tag">
            {{ ambiguityLabel }}
          </a-tag>
          <a-tag v-if="term.reviewStatus && term.reviewStatus !== 'AUTO'" :color="reviewColor" class="mini-tag">
            审核: {{ reviewLabel }}
          </a-tag>
          <a-tag v-if="term.langCode && term.langCode !== 'zh'" color="cyan" class="mini-tag">
            {{ term.langCode.toUpperCase() }}
          </a-tag>
          <a-tooltip title="模型参考把握度，仅用于排序提示，不代表经过统计学校准的真实概率">
            <span v-if="term.confidence != null" class="confidence-pill">
              参考把握度 {{ Math.round(Number(term.confidence) * 100) }}%
            </span>
          </a-tooltip>
        </div>

        <div v-if="term.englishFullName || (term.aliases && term.aliases.length)" class="sub-names-row">
          <span v-if="term.englishFullName" class="en-full">{{ term.englishFullName }}</span>
          <span v-if="term.aliases && term.aliases.length" class="aliases-wrap">
            别名: {{ term.aliases.join('、') }}
          </span>
        </div>
      </div>

      <div class="head-actions" v-if="showReviewAction">
        <a-button size="small" type="primary" ghost @click="$emit('review', term)">
          <EditOutlined /> 审核/纠偏
        </a-button>
      </div>
    </div>

    <!-- 多语言未核验提示 -->
    <a-alert
      v-if="term.translationVerified === false && term.langCode && term.langCode !== 'zh' && term.langCode !== 'en'"
      type="warning"
      show-icon
      banner
      class="lang-warn-alert"
      :message="`目标语言 (${term.langCode}) 的术语译法由模型直接生成，未经权威标准词典核验，请以业务审核为准。`"
    />

    <!-- 企业内部口径 vs 通用口径双显区 (CONFLICT_DUAL 或命中企业知识库) -->
    <div v-if="term.enterpriseDefinition" class="dual-caliber-box">
      <div class="dual-box-title">
        <ApartmentOutlined />
        <span>
          {{ term.ambiguityStatus === 'CONFLICT_DUAL' ? '通用行业口径 vs 企业内部口径冲突双显' : '企业内部术语口径补充' }}
        </span>
        <a-tag v-if="term.enterpriseScope" color="purple" class="scope-tag">
          适用范围: {{ term.enterpriseScope }}
        </a-tag>
      </div>
      <div class="dual-columns" :class="{ stacked: compact }">
        <div class="dual-col generic-col">
          <div class="col-label">通用行业解释</div>
          <div class="col-text">{{ term.definition || '暂无通用定义' }}</div>
        </div>
        <div class="dual-col enterprise-col">
          <div class="col-label">企业内部定义与考核口径</div>
          <div class="col-text">{{ term.enterpriseDefinition }}</div>
          <div v-if="term.enterpriseCaliber" class="col-caliber">
            <strong>考核口径:</strong> {{ term.enterpriseCaliber }}
          </div>
        </div>
      </div>
    </div>

    <!-- 三层解释主体 -->
    <div class="layers-container">
      <!-- 第一层：核心定义与通俗解释 -->
      <div class="layer-block">
        <div class="layer-badge l1">第一层 · 术语核心释义</div>
        <div v-if="term.definition && !term.enterpriseDefinition" class="field-row">
          <span class="field-label">专业定义:</span>
          <span class="field-val">{{ term.definition }}</span>
        </div>
        <div v-if="term.plainExplanation" class="field-row">
          <span class="field-label">通俗解释:</span>
          <span class="field-val">{{ term.plainExplanation }}</span>
        </div>
        <div v-if="term.technicalExplanation && term.technicalExplanation !== term.definition" class="field-row">
          <span class="field-label">技术视角:</span>
          <span class="field-val">{{ term.technicalExplanation }}</span>
        </div>
        <div v-if="term.formula || term.unit" class="formula-unit-bar">
          <span v-if="term.formula" class="fu-pill formula-pill">
            <strong>公式:</strong> <code>{{ term.formula }}</code>
          </span>
          <span v-if="term.unit" class="fu-pill unit-pill">
            <strong>单位:</strong> {{ term.unit }}
          </span>
        </div>
      </div>

      <!-- 第二层：本次语境含义 -->
      <div v-if="term.contextMeaning" class="layer-block">
        <div class="layer-badge l2">第二层 · 当前上下文含义</div>
        <div class="field-val">{{ term.contextMeaning }}</div>
      </div>

      <!-- 第三层：业务场景与风险影响 -->
      <div v-if="term.businessScenario || term.businessImpact" class="layer-block">
        <div class="layer-badge l3">第三层 · 业务应用与影响</div>
        <div v-if="term.businessScenario" class="field-row">
          <span class="field-label">应用场景:</span>
          <span class="field-val">{{ term.businessScenario }}</span>
        </div>
        <div v-if="term.businessImpact" class="field-row">
          <span class="field-label">业务影响:</span>
          <span class="field-val">{{ term.businessImpact }}</span>
        </div>
      </div>
    </div>

    <!-- 多义候选消歧列表 -->
    <div v-if="term.candidates && term.candidates.length > 0" class="candidates-box">
      <div class="sub-block-title">
        <QuestionCircleOutlined style="color: #fa8c16" /> 多义候选消歧 ({{ term.candidates.length }} 项候选)
      </div>
      <div class="candidates-list">
        <div v-for="(c, idx) in term.candidates" :key="idx" class="candidate-item">
          <div class="cand-top">
            <span class="cand-name">{{ c.canonicalName }}</span>
            <span v-if="c.chineseName" class="cand-cn">({{ c.chineseName }})</span>
            <a-tag v-if="c.domain" size="small" color="default">{{ c.domain }}<template v-if="c.subDomain">/{{ c.subDomain }}</template></a-tag>
            <span v-if="c.score != null" class="cand-score">候选参考分 {{ Math.round(Number(c.score) * 100) }}%</span>
          </div>
          <div v-if="c.definition" class="cand-def">{{ c.definition }}</div>
          <div v-if="c.reason" class="cand-reason">不确定/判定说明: {{ c.reason }}</div>
        </div>
      </div>
    </div>

    <!-- 信息严格分层：事实 vs 待确认口径 vs 模型推断 vs 不确定性 -->
    <div v-if="hasInformationLayers" class="info-layers-grid" :class="{ stacked: compact }">
      <div v-if="term.confirmedFacts && term.confirmedFacts.length" class="info-pill-box facts">
        <div class="pill-box-title"><CheckCircleOutlined /> 原文确认事实</div>
        <ul>
          <li v-for="(item, i) in term.confirmedFacts" :key="i">{{ item }}</li>
        </ul>
      </div>

      <div v-if="term.unconfirmedCalibers && term.unconfirmedCalibers.length" class="info-pill-box calibers">
        <div class="pill-box-title"><ExclamationCircleOutlined /> 待确认口径</div>
        <ul>
          <li v-for="(item, i) in term.unconfirmedCalibers" :key="i">{{ item }}</li>
        </ul>
      </div>

      <div v-if="term.businessInferences && term.businessInferences.length" class="info-pill-box inferences">
        <div class="pill-box-title"><BulbOutlined /> 模型业务推断（待验证）</div>
        <ul>
          <li v-for="(item, i) in term.businessInferences" :key="i">{{ item }}</li>
        </ul>
      </div>

      <div v-if="term.uncertainties && term.uncertainties.length" class="info-pill-box uncertainties">
        <div class="pill-box-title"><InfoCircleOutlined /> 不确定性 / 差异提示</div>
        <ul>
          <li v-for="(item, i) in term.uncertainties" :key="i">{{ item }}</li>
        </ul>
      </div>
    </div>

    <!-- 术语业务关联 -->
    <div v-if="term.relations && term.relations.length > 0" class="relations-box">
      <div class="sub-block-title"><ShareAltOutlined style="color: #1677ff" /> 概念关联</div>
      <div class="relations-list">
        <div v-for="(rel, i) in term.relations" :key="i" class="relation-chip">
          <a-tag color="geekblue" class="rel-type-tag">{{ rel.relationType || 'RELATED_TO' }}</a-tag>
          <span class="rel-target">{{ rel.targetTerm }}</span>
          <span v-if="rel.targetChineseName" class="rel-cn">({{ rel.targetChineseName }})</span>
          <a-tag v-if="rel.hypothesis" color="orange" class="mini-tag">规律推测</a-tag>
          <span v-if="rel.description" class="rel-desc">— {{ rel.description }}</span>
        </div>
      </div>
    </div>

    <!-- 原文定位证据 -->
    <div v-if="term.evidence && term.evidence.length > 0" class="evidence-box">
      <div class="sub-block-title"><FileTextOutlined style="color: #52c41a" /> 会议原文定位证据</div>
      <div class="evidence-items">
        <div
          v-for="(ev, idx) in term.evidence"
          :key="idx"
          class="evidence-row"
          :class="{ clickable: Boolean(ev.segmentId) }"
          @click="handleEvidenceClick(ev)"
        >
          <div class="ev-meta">
            <span class="ev-speaker">{{ ev.speakerName || '参会人' }}</span>
            <span v-if="ev.startTime != null" class="ev-time mono">
              {{ formatMs(ev.startTime) }}<template v-if="ev.endTime != null"> - {{ formatMs(ev.endTime) }}</template>
            </span>
            <span v-if="ev.startOffset != null && ev.endOffset != null" class="ev-offset mono">
              偏移 [{{ ev.startOffset }}, {{ ev.endOffset }})
            </span>
            <span v-if="ev.segmentId" class="ev-jump">跳转定位 →</span>
          </div>
          <div class="ev-quote">“{{ ev.quote }}”</div>
        </div>
      </div>
    </div>

    <!-- 人工纠偏备注（如有） -->
    <div v-if="term.userCorrection" class="correction-note">
      <strong>人工审核意见:</strong> {{ term.userCorrection }}
    </div>

    <!-- 知识来源与模型可追溯底栏 -->
    <div class="provenance-footer">
      <div class="sources-list">
        <span class="prov-label">知识来源:</span>
        <a-tag
          v-for="(src, idx) in (term.knowledgeSources || [])"
          :key="idx"
          :color="getSourceColor(src)"
          class="source-tag"
        >
          {{ formatSourceLabel(src) }}
          <span v-if="src.applicableScope"> [{{ src.applicableScope }}]</span>
        </a-tag>
      </div>

      <div class="model-meta-footer" v-if="term.modelName || term.adapterVersion">
        <span class="mono">{{ term.modelName || 'Model' }}</span>
        <span v-if="term.adapterVersion" class="mono"> / {{ term.adapterVersion }}</span>
        <span v-if="term.costMs != null" class="mono"> · {{ term.costMs }}ms</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  EditOutlined,
  ApartmentOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  ShareAltOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'

const props = defineProps({
  term: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  showReviewAction: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['jump-evidence', 'review'])

const ambiguityColor = computed(() => {
  switch (props.term.ambiguityStatus) {
    case 'RESOLVED':
      return 'success'
    case 'CONFLICT_DUAL':
      return 'purple'
    case 'AMBIGUOUS':
      return 'warning'
    case 'UNRESOLVED':
      return 'orange'
    default:
      return 'default'
  }
})

const ambiguityLabel = computed(() => {
  switch (props.term.ambiguityStatus) {
    case 'RESOLVED':
      return '语境已消歧'
    case 'CONFLICT_DUAL':
      return '通用/企业冲突双显'
    case 'AMBIGUOUS':
      return '多义待确认'
    case 'UNRESOLVED':
      return '上下文不足未定'
    default:
      return props.term.ambiguityStatus || '未知状态'
  }
})

const reviewColor = computed(() => {
  switch (props.term.reviewStatus) {
    case 'CONFIRMED':
      return 'green'
    case 'CORRECTED':
      return 'blue'
    case 'REJECTED':
      return 'red'
    default:
      return 'default'
  }
})

const reviewLabel = computed(() => {
  switch (props.term.reviewStatus) {
    case 'CONFIRMED':
      return '已确认'
    case 'CORRECTED':
      return '已纠偏'
    case 'REJECTED':
      return '已否决'
    default:
      return props.term.reviewStatus
  }
})

const hasInformationLayers = computed(() => {
  const t = props.term
  return (
    (t.confirmedFacts && t.confirmedFacts.length > 0) ||
    (t.unconfirmedCalibers && t.unconfirmedCalibers.length > 0) ||
    (t.businessInferences && t.businessInferences.length > 0) ||
    (t.uncertainties && t.uncertainties.length > 0)
  )
})

function getSourceColor(src) {
  if (!src) return 'default'
  if (src.authoritative) return 'green'
  switch (src.sourceType) {
    case 'ENTERPRISE_KB':
      return 'purple'
    case 'HUMAN_VERIFIED':
      return 'cyan'
    case 'MODEL_DEGRADED':
      return 'red'
    case 'MODEL_GENERATED':
    default:
      return 'default'
  }
}

function formatSourceLabel(src) {
  if (!src) return ''
  const authNote = src.authoritative ? '权威资料' : '非权威参照'
  switch (src.sourceType) {
    case 'MODEL_GENERATED':
      return `模型知识推理 (${authNote})`
    case 'ENTERPRISE_KB':
      return `企业内部 KB: ${src.sourceName || '内部口径'}`
    case 'EXTERNAL_AUTHORITATIVE':
      return `外部权威资料: ${src.sourceName || ''}`
    case 'HUMAN_VERIFIED':
      return `人工审核沉淀: ${src.sourceName || ''}`
    case 'MODEL_DEGRADED':
      return '模型降级诊断'
    default:
      return `${src.sourceName || src.sourceType} (${authNote})`
  }
}

function formatMs(ms) {
  if (ms === null || ms === undefined) return '00:00'
  const sec = Math.floor(Number(ms) / 1000)
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

function handleEvidenceClick(ev) {
  if (ev && ev.segmentId) {
    emit('jump-evidence', ev)
  }
}
</script>

<style scoped>
.term-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.term-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.term-card.is-conflict {
  border-left: 4px solid #722ed1;
}

.term-card.is-ambiguous {
  border-left: 4px solid #faad14;
}

.term-card.is-corrected {
  border-left: 4px solid #1677ff;
}

.term-card.is-compact {
  padding: 12px 14px;
  gap: 10px;
}

.term-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.head-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.title-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.term-surface {
  font-size: 16px;
  font-weight: 700;
  color: #1677ff;
}

.term-arrow {
  color: var(--text-secondary);
}

.term-canonical {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}

.term-cn {
  font-size: 14px;
  color: var(--text-regular);
}

.meta-tags-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-tag {
  margin-right: 0;
  font-size: 11px;
}

.confidence-pill {
  font-size: 11px;
  color: #595959;
  background: #f5f5f5;
  padding: 1px 8px;
  border-radius: 10px;
  cursor: help;
}

.sub-names-row {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.lang-warn-alert {
  border-radius: 6px;
  font-size: 12px;
}

.dual-caliber-box {
  background: #f9f0ff;
  border: 1px solid #d3adf7;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dual-box-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #531dab;
}

.dual-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dual-columns.stacked {
  grid-template-columns: 1fr;
}

.dual-col {
  background: #ffffff;
  border-radius: 6px;
  padding: 8px 10px;
  border: 1px solid #efdbff;
  font-size: 12px;
}

.col-label {
  font-weight: 600;
  color: #595959;
  margin-bottom: 4px;
}

.enterprise-col {
  border-color: #b37feb;
}

.enterprise-col .col-label {
  color: #531dab;
}

.col-caliber {
  margin-top: 4px;
  color: #722ed1;
}

.layers-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer-block {
  background: #fafafa;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border: 1px solid #f0f0f0;
}

.layer-badge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin-bottom: 2px;
}

.layer-badge.l1 { color: #0958d9; }
.layer-badge.l2 { color: #08979c; }
.layer-badge.l3 { color: #d46b08; }

.field-row {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-main);
}

.field-label {
  font-weight: 600;
  color: var(--text-regular);
  margin-right: 6px;
}

.field-val {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-main);
}

.formula-unit-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.fu-pill {
  font-size: 12px;
  background: #e6f4ff;
  color: #0958d9;
  padding: 2px 8px;
  border-radius: 6px;
}

.fu-pill code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.candidates-box,
.relations-box,
.evidence-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-block-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-regular);
}

.candidates-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.candidate-item {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.cand-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 3px;
}

.cand-name {
  font-weight: 600;
  color: #1f2329;
}

.cand-score {
  color: #d46b08;
  font-size: 11px;
}

.cand-def {
  color: #4e5969;
  line-height: 1.45;
}

.cand-reason {
  margin-top: 2px;
  color: #8c8c8c;
  font-size: 11px;
}

.info-layers-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.info-layers-grid.stacked {
  grid-template-columns: 1fr;
}

.info-pill-box {
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.info-pill-box ul {
  margin: 4px 0 0 16px;
  padding: 0;
  line-height: 1.45;
}

.pill-box-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}

.info-pill-box.facts {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #237804;
}

.info-pill-box.calibers {
  background: #fff7e6;
  border: 1px solid #ffd591;
  color: #ad4e00;
}

.info-pill-box.inferences {
  background: #e6f4ff;
  border: 1px solid #91caff;
  color: #0958d9;
}

.info-pill-box.uncertainties {
  background: #fff1f0;
  border: 1px solid #ffccc7;
  color: #a8071a;
}

.relations-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.relation-chip {
  font-size: 12px;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;
}

.rel-target {
  font-weight: 600;
  color: #1f2329;
}

.rel-desc {
  color: var(--text-secondary);
}

.evidence-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.evidence-row {
  background: #f6ffed;
  border: 1px solid #d9f7be;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.evidence-row.clickable {
  cursor: pointer;
}

.evidence-row.clickable:hover {
  border-color: #73d13d;
  background: #f0fde4;
}

.ev-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.ev-speaker {
  font-weight: 600;
  color: #237804;
}

.ev-time,
.ev-offset {
  color: #595959;
  font-size: 11px;
}

.ev-jump {
  margin-left: auto;
  color: #1677ff;
  font-size: 11px;
}

.ev-quote {
  color: #1f2329;
  font-style: italic;
}

.correction-note {
  background: #e6f4ff;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #0958d9;
}

.provenance-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e6eb;
  font-size: 11px;
}

.sources-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.prov-label {
  color: var(--text-secondary);
}

.source-tag {
  margin-right: 0;
  font-size: 11px;
}

.model-meta-footer {
  color: var(--text-secondary);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
