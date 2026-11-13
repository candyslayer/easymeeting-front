<template>
  <aside class="ai-collab-panel">
    <!-- 1. Top AI Intelligence Bar -->
    <div class="intel-bar">
      <div class="intel-left">
        <div class="intel-avatar">
          <MeetingIcon name="smart_toy" :size="22" />
        </div>
        <div class="intel-text">
          <div class="intel-title-row">
            <h2 class="intel-title">EasyCopilot Live</h2>
            <span class="confidence-badge mono">
              {{
                aiStore.isAnalyzing
                  ? '多 Agent 推演中'
                  : aiStore.confirmedDecisions.length > 0
                    ? `共识确认 ${consensusPercent}%`
                    : isTranscribing
                      ? '实时推理就绪'
                      : '协同引擎待命'
              }}
            </span>
          </div>
          <p class="intel-subtitle">多智能体实时思维建模 &amp; 议题共识提取引擎</p>
        </div>
      </div>

      <div class="intel-actions">
        <button
          type="button"
          class="intel-trigger-btn"
          :disabled="aiStore.isAnalyzing"
          title="发起全量 Spring AI 多 Agent 分析"
          @click="aiStore.triggerAnalysis(meetingId, true)"
        >
          <MeetingIcon name="sync" :size="13" :spin="aiStore.isAnalyzing" />
          <span>{{ aiStore.isAnalyzing ? '分析中' : 'AI 分析' }}</span>
        </button>
        <button
          type="button"
          class="intel-icon-btn"
          title="全屏决策脑图工作台"
          @click="emit('openWorkspace', 'decisions')"
        >
          <MeetingIcon name="open_in_full" :size="18" />
        </button>
        <button
          type="button"
          class="intel-icon-btn"
          title="导出协同看板纪要"
          @click="handleExportBoard"
        >
          <MeetingIcon name="ios_share" :size="18" />
        </button>
      </div>
    </div>

    <!-- 2. Mid AI Canvas: 决策/议题导图 <-> 术语与因果链 -->
    <div class="topology-card">
      <div class="topology-head">
        <div class="topology-title-wrap">
          <MeetingIcon name="account_tree" :size="17" class="tree-icon" />
          <div class="canvas-mode-tabs">
            <button
              type="button"
              class="canvas-tab-btn"
              :class="{ active: canvasMode === 'topology' }"
              @click="canvasMode = 'topology'"
            >
              决策/议题导图
            </button>
            <button
              type="button"
              class="canvas-tab-btn"
              :class="{ active: canvasMode === 'terms' }"
              @click="canvasMode = 'terms'"
            >
              术语与因果链 ({{ aiStore.meetingTerms.length }})
            </button>
          </div>
        </div>
        <span class="live-gen-badge" :class="{ active: isTranscribing || aiStore.isAnalyzing || aiStore.isLiveDecisionEnabled }">
          <span class="ping-dot" :class="{ active: isTranscribing || aiStore.isAnalyzing || aiStore.isLiveDecisionEnabled }"></span>
          <span>
            {{
              aiStore.isAnalyzing
                ? 'Agent 推演中'
                : aiStore.isLiveDecisionEnabled
                  ? '决策追踪中'
                  : isTranscribing
                    ? '实时同步中'
                    : '引擎就绪'
            }}
          </span>
        </span>
      </div>

      <!-- Mode A: 决策/议题导图画布 -->
      <div
        v-if="canvasMode === 'topology'"
        class="topology-canvas"
        ref="canvasRef"
        @mousedown="startPan"
        @mousemove="onPan"
        @mouseup="endPan"
        @mouseleave="endPan"
      >
        <div class="canvas-dot-grid"></div>

        <div
          class="canvas-stage"
          :style="{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`
          }"
        >
          <!-- Fixed-aspect 520x230 graph so SVG Bezier curves align exactly with nodes -->
          <div class="graph-frame">
            <svg class="graph-svg" viewBox="0 0 520 230" fill="none">
              <path
                d="M 134 115 C 174 115, 174 58, 206 58"
                stroke="rgba(0, 110, 242, 0.55)"
                stroke-width="2"
                stroke-dasharray="5 3"
              />
              <path
                d="M 134 115 C 174 115, 174 172, 206 172"
                stroke="rgba(0, 110, 242, 0.45)"
                stroke-width="2"
              />
              <path
                d="M 350 58 C 380 58, 380 115, 404 115"
                stroke="rgba(136, 253, 84, 0.5)"
                stroke-width="2"
              />
              <path
                d="M 350 172 C 380 172, 380 115, 404 115"
                stroke="rgba(0, 110, 242, 0.45)"
                stroke-width="2"
                stroke-dasharray="5 3"
              />
            </svg>

            <!-- Col 1: Transcript / Topic Input Node -->
            <button
              type="button"
              class="topo-node node-left"
              @click.stop="emit('openWorkspace', 'transcript')"
            >
              <MeetingIcon name="graphic_eq" :size="18" class="node-icon blue" />
              <div class="node-label ellipsis">{{ inputNode.title }}</div>
              <div class="node-meta mono ellipsis">{{ inputNode.sub }}</div>
            </button>

            <!-- Col 2: Decision & Terminology/Todo Branch Nodes -->
            <div class="node-middle-col">
              <button
                type="button"
                class="topo-node node-mid highlighted"
                @click.stop="emit('openWorkspace', 'decisions')"
              >
                <div class="node-tag-row blue">
                  <MeetingIcon name="speed" :size="14" />
                  <span class="mono">{{ branchTopNode.tag }}</span>
                </div>
                <div class="node-label ellipsis">{{ branchTopNode.title }}</div>
                <div class="node-meta green mono ellipsis">{{ branchTopNode.sub }}</div>
              </button>

              <button
                type="button"
                class="topo-node node-mid"
                @click.stop="emit('openWorkspace', aiStore.meetingTerms.length > 0 ? 'terminology' : 'actionItems')"
              >
                <div class="node-tag-row amber">
                  <MeetingIcon name="hub" :size="14" />
                  <span class="mono">{{ branchBottomNode.tag }}</span>
                </div>
                <div class="node-label ellipsis">{{ branchBottomNode.title }}</div>
                <div class="node-meta mono ellipsis">{{ branchBottomNode.sub }}</div>
              </button>
            </div>

            <!-- Col 3: Outcome / Minutes Node -->
            <button
              type="button"
              class="topo-node node-right"
              @click.stop="emit('openWorkspace', 'minutes')"
            >
              <MeetingIcon name="verified" :size="20" class="node-icon green" />
              <div class="node-label ellipsis">{{ outcomeNode.title }}</div>
              <div class="node-meta green mono ellipsis">{{ outcomeNode.sub }}</div>
            </button>
          </div>
        </div>

        <!-- Bottom Canvas Floating Controller -->
        <div class="canvas-zoom-bar" @mousedown.stop>
          <button type="button" class="zoom-btn" title="放大" @click="adjustZoom(0.1)">
            <MeetingIcon name="zoom_in" :size="14" />
          </button>
          <button type="button" class="zoom-btn" title="缩小" @click="adjustZoom(-0.1)">
            <MeetingIcon name="zoom_out" :size="14" />
          </button>
          <button type="button" class="zoom-btn" title="重置视图" @click="resetView">
            <MeetingIcon name="center_focus_strong" :size="14" />
          </button>
          <span class="zoom-sep">|</span>
          <span class="zoom-pct mono">{{ Math.round(zoom * 100) }}%</span>
        </div>
      </div>

      <!-- Mode B: 实时行业术语识别与因果传导链 -->
      <div v-else class="terms-canvas dark-scroll">
        <div class="terms-canvas-toolbar">
          <div class="terms-cfg-pills mono">
            <button
              type="button"
              class="cfg-toggle-pill"
              :class="{ active: aiStore.isTermIntelligenceEnabled }"
              :disabled="aiStore.featureLoading"
              @click="aiStore.updateTermConfig({ termIntelligenceEnabled: !aiStore.isTermIntelligenceEnabled }, meetingId)"
            >
              {{ aiStore.isTermIntelligenceEnabled ? '实时术语: 开' : '实时术语: 关' }}
            </button>
            <select
              class="cfg-select mono"
              :value="aiStore.featureConfig.preferredLang || 'zh'"
              @change="(e) => aiStore.updateTermConfig({ preferredLang: e.target.value }, meetingId)"
            >
              <option value="zh">zh 中文</option>
              <option value="en">en English</option>
              <option value="th">th ไทย</option>
              <option value="fil">fil Filipino</option>
              <option value="id">id Indonesia</option>
              <option value="ms">ms Melayu</option>
            </select>
          </div>
          <div class="terms-cfg-actions">
            <button
              type="button"
              class="mini-trigger-btn"
              :disabled="aiStore.terminologyAnalyzing"
              @click="aiStore.triggerMeetingTermAnalysis({}, meetingId)"
            >
              {{ aiStore.terminologyAnalyzing ? '识别中...' : '同步识别术语' }}
            </button>
            <button
              type="button"
              class="mini-trigger-btn ghost"
              @click="emit('openWorkspace', 'terminology')"
            >
              完整术语中心
            </button>
          </div>
        </div>

        <div v-if="aiStore.meetingCausalSummary" class="causal-banner">
          <span class="causal-badge mono">因果总结</span>
          <span>{{ aiStore.meetingCausalSummary }}</span>
        </div>

        <div v-if="aiStore.meetingTerms.length === 0" class="terms-empty">
          <span>暂未检测到行业术语，开启实时转写或点击「同步识别术语」提取。</span>
        </div>

        <div v-else class="terms-mini-list">
          <div
            v-for="(term, idx) in aiStore.meetingTerms"
            :key="term.occurrenceId || term.explanationId || `${term.surface}-${idx}`"
            class="term-mini-row"
            :class="{ conflict: term.ambiguityStatus === 'CONFLICT_DUAL' }"
            @click="emit('openWorkspace', 'terminology')"
          >
            <div class="term-mini-top">
              <span class="term-mini-name">{{ term.canonicalName || term.surface }}</span>
              <span class="term-mini-tag mono" :class="{ conflict: term.ambiguityStatus === 'CONFLICT_DUAL' }">
                {{ term.ambiguityStatus === 'CONFLICT_DUAL' ? '口径冲突双显' : term.domain || '专业术语' }}
              </span>
            </div>
            <p class="term-mini-desc">
              {{ term.contextMeaning || term.plainExplanation || term.definition || '点击进入三层解释详情' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Lower Half: Consensus Decisions & Action Items Split -->
    <div class="lower-split-grid">
      <!-- 结构化共识决策 -->
      <div class="split-card">
        <div class="split-card-head">
          <div class="split-title-wrap">
            <MeetingIcon name="how_to_vote" :size="17" class="green-icon" />
            <span class="split-title">结构化共识决策</span>
          </div>
          <span class="count-pill green mono">{{ aiStore.decisions.length }} 项决议</span>
        </div>

        <div class="split-scroll dark-scroll">
          <div v-if="aiStore.decisions.length === 0" class="split-empty">
            <span>暂无结构化决议</span>
            <button
              type="button"
              class="mini-trigger-btn"
              :disabled="aiStore.isAnalyzing"
              @click="aiStore.triggerAnalysis(meetingId, true)"
            >
              {{ aiStore.isAnalyzing ? '提取中...' : 'AI 提取共识' }}
            </button>
          </div>

          <div
            v-for="(dec, idx) in aiStore.decisions"
            :key="dec.decisionId || idx"
            class="board-item"
            @click="emit('openWorkspace', 'decisions')"
          >
            <div class="board-item-head">
              <span class="board-item-title ellipsis">
                <span class="status-dot" :class="dec.status === 'CONFIRMED' ? 'green' : 'blue'"></span>
                <span class="ellipsis">{{ dec.topic || `议题-${String(idx + 1).padStart(2, '0')}` }}</span>
              </span>
              <span
                class="board-item-status mono"
                :class="dec.status === 'CONFIRMED' ? 'green' : 'blue'"
              >
                {{ formatDecisionShort(dec.status) }}
              </span>
            </div>
            <p class="board-item-desc">{{ dec.content || dec.topic }}</p>
            <div class="decision-inline-row">
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :class="dec.status === 'CONFIRMED' ? 'green' : 'blue'"
                  :style="{ width: getDecisionProgress(dec.status) }"
                ></div>
              </div>
              <div v-if="dec.status !== 'CONFIRMED'" class="dec-op-group" @click.stop>
                <button
                  type="button"
                  class="dec-op-btn confirm"
                  title="确认生效"
                  @click="aiStore.confirmDecisionAction(dec.decisionId)"
                >
                  确认
                </button>
                <button
                  v-if="dec.status !== 'DEFERRED'"
                  type="button"
                  class="dec-op-btn defer"
                  title="暂缓"
                  @click="aiStore.deferDecisionAction(dec.decisionId)"
                >
                  暂缓
                </button>
                <button
                  v-if="dec.status !== 'REJECTED'"
                  type="button"
                  class="dec-op-btn reject"
                  title="否决"
                  @click="aiStore.rejectDecisionAction(dec.decisionId)"
                >
                  否决
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 自动提取待办 (Action Items) -->
      <div class="split-card">
        <div class="split-card-head">
          <div class="split-title-wrap">
            <MeetingIcon name="task_alt" :size="17" class="blue-icon" />
            <span class="split-title">自动提取待办 (Action Items)</span>
          </div>
          <button
            type="button"
            class="sync-action-btn mono"
            @click="emit('openWorkspace', 'actionItems')"
          >
            <MeetingIcon name="sync" :size="13" />
            <span>管理</span>
          </button>
        </div>

        <div class="split-scroll dark-scroll">
          <div v-if="aiStore.actionItems.length === 0" class="split-empty">
            <span>暂无提取待办</span>
            <button
              type="button"
              class="mini-trigger-btn"
              :disabled="aiStore.isAnalyzing"
              @click="aiStore.triggerAnalysis(meetingId, true)"
            >
              {{ aiStore.isAnalyzing ? '提取中...' : '提取待办' }}
            </button>
          </div>

          <div
            v-for="item in aiStore.actionItems"
            :key="item.actionId"
            class="board-item"
            @click="emit('openWorkspace', 'actionItems')"
          >
            <div class="board-item-head">
              <div class="todo-check-title ellipsis">
                <button
                  type="button"
                  class="todo-check-btn"
                  :class="{ checked: item.status === 'DONE' }"
                  :disabled="updatingActionId === item.actionId"
                  :title="item.status === 'DONE' ? '标为待办' : '标为已完成'"
                  @click.stop="handleToggleActionDone(item)"
                >
                  <MeetingIcon :name="item.status === 'DONE' ? 'check_circle' : 'radio_button_unchecked'" :size="14" />
                </button>
                <span class="board-item-title ellipsis" :class="{ done: item.status === 'DONE' }">
                  {{ item.content }}
                </span>
              </div>
              <span class="due-badge mono" :class="{ done: item.status === 'DONE' }">
                {{ item.dueTime || (item.status === 'DONE' ? '已完成' : '待跟进') }}
              </span>
            </div>
            <div class="todo-meta-row">
              <span>
                指派给: <strong>{{ item.assigneeName || item.assigneeUserId || '待指定' }}</strong>
              </span>
              <span class="todo-state" :class="item.status === 'DONE' ? 'green' : 'blue'">
                <MeetingIcon :name="item.status === 'DONE' ? 'done' : 'send'" :size="12" />
                <span>{{ formatActionStatus(item.status) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Inline Command Output Popup (if command executed) -->
    <div v-if="commandResult" class="cmd-result-banner">
      <div class="cmd-result-head">
        <span class="cmd-result-title">
          <MeetingIcon name="auto_awesome" :size="13" />
          {{ commandResult.prompt }}
        </span>
        <button type="button" class="cmd-close-btn" @click="commandResult = null">
          <MeetingIcon name="close" :size="13" />
        </button>
      </div>
      <p class="cmd-result-body">{{ commandResult.answer }}</p>
    </div>

    <!-- 4. Bottom Copilot Prompt Command Line Input -->
    <div class="command-bar">
      <div class="cmd-icon-wrap">
        <MeetingIcon name="terminal" :size="18" />
      </div>
      <input
        v-model="commandInput"
        type="text"
        class="cmd-input"
        :placeholder="commandPlaceholder"
        @keydown.enter.prevent="executeCommand()"
      />
      <div class="cmd-quick-btns">
        <button
          type="button"
          class="cmd-chip mono"
          :disabled="executing"
          @click="executeCommand('/总结当前会议核心观点、已达成共识与待确认事项')"
        >
          /总结
        </button>
        <button
          type="button"
          class="cmd-chip mono"
          :disabled="executing || aiStore.isAnalyzing"
          @click="aiStore.triggerAnalysis(meetingId, true)"
        >
          /分析
        </button>
        <button
          type="button"
          class="cmd-chip mono"
          :disabled="executing || aiStore.terminologyAnalyzing"
          @click="aiStore.triggerMeetingTermAnalysis({}, meetingId)"
        >
          /术语
        </button>
        <button
          type="button"
          class="cmd-submit-btn"
          :disabled="executing || !commandInput.trim()"
          title="执行问答或术语查询"
          @click="executeCommand()"
        >
          <MeetingIcon name="arrow_upward" :size="16" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import MeetingIcon from '@/components/meeting/MeetingIcon.vue'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useMeetingStore } from '@/stores/meeting'
import { askMeetingQa, askTermKnowledge, updateActionItem } from '@/api/meetingAi'
import { copyText } from '@/utils/format'

const props = defineProps({
  meetingId: { type: String, required: true },
  segments: { type: Array, default: () => [] },
  isTranscribing: { type: Boolean, default: false }
})

const emit = defineEmits(['openWorkspace'])

const aiStore = useMeetingAiStore()
const meetingStore = useMeetingStore()

const canvasMode = ref('topology')
const updatingActionId = ref('')

// Canvas pan & zoom
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
let panStartX = 0
let panStartY = 0

function adjustZoom(delta) {
  zoom.value = Math.min(1.5, Math.max(0.65, Number((zoom.value + delta).toFixed(2))))
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function startPan(e) {
  if (e.button !== 0) return
  isPanning.value = true
  panStartX = e.clientX - panX.value
  panStartY = e.clientY - panY.value
}

function onPan(e) {
  if (!isPanning.value) return
  panX.value = e.clientX - panStartX
  panY.value = e.clientY - panStartY
}

function endPan() {
  isPanning.value = false
}

const consensusPercent = computed(() => {
  const total = aiStore.decisions.length
  if (total === 0) return 0
  return Math.round((aiStore.confirmedDecisions.length / total) * 100)
})

const inputNode = computed(() => {
  const count = props.segments?.length || aiStore.transcriptTotal || 0
  const topic = aiStore.agendaTopics?.[0]?.title
  return {
    title: topic || '实时语音流',
    sub: count > 0 ? `${count} 条转写切片` : props.isTranscribing || aiStore.isAsrRunning ? 'ASR 接入中' : '等待语音输入'
  }
})

const branchTopNode = computed(() => {
  const d = aiStore.decisions[0]
  if (d) {
    return {
      tag: '决策推演',
      title: d.topic || '核心议题',
      sub: formatDecisionShort(d.status)
    }
  }
  const t = aiStore.agendaTopics[0]
  if (t) {
    return {
      tag: '议题提取',
      title: t.title || '讨论焦点',
      sub: 'Agent 汇聚中'
    }
  }
  return {
    tag: 'ASR 语义切片',
    title: '动态实时转写',
    sub: props.isTranscribing || aiStore.isAsrRunning ? '实时流监听中' : '待开启转写'
  }
})

const branchBottomNode = computed(() => {
  const d2 = aiStore.decisions[1]
  if (d2) {
    return {
      tag: '关联议题',
      title: d2.topic || '协同方案',
      sub: formatDecisionShort(d2.status)
    }
  }
  if (aiStore.meetingTerms.length > 0) {
    const term = aiStore.meetingTerms[0]
    return {
      tag: '专业术语链',
      title: term.canonicalName || term.surface,
      sub: `共识别 ${aiStore.meetingTerms.length} 个术语`
    }
  }
  return {
    tag: '多 Agent 协同',
    title: '异步结构化推演',
    sub: `待办 ${aiStore.actionItems.length} 项`
  }
})

const outcomeNode = computed(() => {
  const confirmed = aiStore.confirmedDecisions.length
  const total = aiStore.decisions.length
  if (confirmed > 0) {
    return {
      title: '决议达成',
      sub: `已生效 ${confirmed}/${total}`
    }
  }
  if (total > 0) {
    return {
      title: '共识表决中',
      sub: `共 ${total} 项候选`
    }
  }
  return {
    title: '共识收敛',
    sub: '等待讨论生成'
  }
})

function formatDecisionShort(status) {
  switch (status) {
    case 'CONFIRMED':
      return '已通过'
    case 'DISCUSSING':
      return '讨论中'
    case 'PROPOSED':
    case 'PENDING':
      return '待表决'
    case 'DEFERRED':
      return '已暂缓'
    case 'REJECTED':
      return '已否决'
    default:
      return status || '进行中'
  }
}

function getDecisionProgress(status) {
  switch (status) {
    case 'CONFIRMED':
      return '100%'
    case 'DISCUSSING':
      return '68%'
    case 'PROPOSED':
    case 'PENDING':
      return '40%'
    case 'DEFERRED':
      return '25%'
    default:
      return '50%'
  }
}

function formatActionStatus(status) {
  switch (status) {
    case 'DONE':
      return '已完成'
    case 'DOING':
      return '推进中'
    default:
      return '已提取'
  }
}

async function handleExportBoard() {
  const title = meetingStore.meetingInfo?.meetingName || 'EasyMeeting 协作看板'
  const lines = [`# ${title} - AI 协同看板快照`, '']
  if (aiStore.decisions.length > 0) {
    lines.push('## 结构化共识决议')
    aiStore.decisions.forEach((d, idx) => {
      lines.push(`${idx + 1}. [${formatDecisionShort(d.status)}] ${d.topic || ''} — ${d.content || ''}`)
    })
    lines.push('')
  }
  if (aiStore.actionItems.length > 0) {
    lines.push('## 自动提取待办')
    aiStore.actionItems.forEach((a, idx) => {
      lines.push(`${idx + 1}. ${a.content} (负责人: ${a.assigneeName || a.assigneeUserId || '待定'})`)
    })
  }
  if (lines.length <= 2) {
    message.info('当前暂无可导出的决议或待办数据')
    return
  }
  const ok = await copyText(lines.join('\n'))
  if (ok) {
    message.success('协同看板内容已复制到剪贴板')
  }
}

async function handleToggleActionDone(item) {
  if (!item?.actionId || updatingActionId.value) return
  const nextStatus = item.status === 'DONE' ? 'TODO' : 'DONE'
  updatingActionId.value = item.actionId
  try {
    await updateActionItem({
      actionId: item.actionId,
      status: nextStatus
    })
    await aiStore.loadActionItems(props.meetingId)
    message.success(nextStatus === 'DONE' ? '待办已标记完成' : '已恢复为待办')
  } catch (err) {
    message.error(err?.message || '更新待办状态失败')
  } finally {
    updatingActionId.value = ''
  }
}

// Command input
const DEFAULT_CMD_PLACEHOLDER = '输入会议问答，或 /总结、/术语 <关键词> 查询行业解释...'
const commandInput = ref('')
const executing = ref(false)
const commandResult = ref(null)
const commandPlaceholder = ref(DEFAULT_CMD_PLACEHOLDER)

async function executeCommand(presetCmd) {
  const raw = (presetCmd || commandInput.value).trim()
  if (!raw || executing.value) return

  if (!presetCmd) {
    commandInput.value = ''
  }

  const trimmed = raw.startsWith('/') ? raw.slice(1).trim() : raw
  if (!trimmed) return

  executing.value = true
  commandPlaceholder.value = `AI 正在协同执行: "${raw}"...`
  try {
    if (trimmed.startsWith('术语')) {
      const termQuery = trimmed.replace(/^术语[:：\s]*/, '').trim()
      if (!termQuery) {
        await aiStore.triggerMeetingTermAnalysis({}, props.meetingId)
        canvasMode.value = 'terms'
        return
      }
      const res = await askTermKnowledge({
        query: termQuery,
        meetingId: props.meetingId,
        domainHint: aiStore.featureConfig?.domainHint,
        targetLang: aiStore.featureConfig?.preferredLang
      })
      const parts = [res?.plainExplanation, res?.contextMeaning, res?.causalChain, res?.answer, res?.summary].filter(Boolean)
      commandResult.value = {
        prompt: raw,
        answer: parts.length > 0 ? parts.join(' ｜ ') : '暂未检索到该术语在当前会议语境下的三层解释。'
      }
      return
    }

    const res = await askMeetingQa({
      meetingId: props.meetingId,
      question: trimmed
    })
    commandResult.value = {
      prompt: raw,
      answer: res?.answer || '当前会议上下文暂无足够信息生成该指令回复，请继续发言或先触发 AI 分析。'
    }
  } catch (err) {
    message.error(err.message || '执行指令失败')
  } finally {
    executing.value = false
    commandPlaceholder.value = DEFAULT_CMD_PLACEHOLDER
  }
}
</script>

<style scoped>
.ai-collab-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
}

.mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* 1. Top Intelligence Bar */
.intel-bar {
  background: rgba(226, 226, 226, 0.14);
  backdrop-filter: blur(14px);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.intel-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.intel-avatar {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: linear-gradient(135deg, #0057c2 0%, #006ef2 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(0, 110, 242, 0.35);
  flex-shrink: 0;
}

.intel-text {
  min-width: 0;
}

.intel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.intel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.confidence-badge {
  padding: 1px 7px;
  border-radius: 5px;
  font-size: 11px;
  background: rgba(133, 250, 81, 0.14);
  color: #88fd54;
  border: 1px solid rgba(136, 253, 84, 0.3);
}

.intel-subtitle {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: #c1c6d7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.intel-icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #c1c6d7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
}

.intel-icon-btn:hover {
  color: #ffffff;
  background: rgba(226, 226, 226, 0.22);
}

/* 2. Mid Dynamic Topology Canvas */
.topology-card {
  flex: 1;
  min-height: 200px;
  background: rgba(226, 226, 226, 0.1);
  backdrop-filter: blur(14px);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.topology-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.topology-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tree-icon {
  color: #ffba45;
  flex-shrink: 0;
}

.topology-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
}

.topology-sub {
  font-size: 11px;
  color: #9ba3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-gen-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(38, 109, 0, 0.28);
  color: #88fd54;
  flex-shrink: 0;
}

.ping-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #88fd54;
}

.ping-dot.active {
  animation: collab-ping 1.4s infinite ease-in-out;
}

@keyframes collab-ping {
  0%, 100% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.35); opacity: 1; }
}

.topology-canvas {
  flex: 1;
  min-height: 0;
  position: relative;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.42);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}

.topology-canvas:active {
  cursor: grabbing;
}

.canvas-dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px);
  background-size: 16px 16px;
  pointer-events: none;
}

.canvas-stage {
  position: relative;
  z-index: 2;
  transition: transform 0.08s ease-out;
}

.graph-frame {
  position: relative;
  width: 520px;
  height: 230px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
}

.graph-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.topo-node {
  position: relative;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(65, 71, 85, 0.58);
  backdrop-filter: blur(8px);
  border-radius: 9px;
  padding: 9px 10px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35);
}

.topo-node:hover {
  border-color: #006ef2;
  transform: translateY(-1px);
}

.node-left {
  width: 120px;
}

.node-middle-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 2;
}

.node-mid {
  width: 144px;
}

.node-mid.highlighted {
  border-color: rgba(0, 110, 242, 0.65);
  box-shadow: 0 0 0 2px rgba(0, 87, 194, 0.28), 0 12px 24px rgba(0, 0, 0, 0.4);
}

.node-right {
  width: 112px;
  background: linear-gradient(135deg, rgba(0, 87, 194, 0.36) 0%, rgba(65, 71, 85, 0.68) 100%);
  border-color: rgba(0, 110, 242, 0.85);
}

.node-icon {
  margin-bottom: 3px;
}

.node-icon.blue {
  color: #d9e2ff;
}

.node-icon.green {
  color: #88fd54;
}

.node-tag-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 10.5px;
  margin-bottom: 3px;
}

.node-tag-row.blue {
  color: #afc6ff;
}

.node-tag-row.amber {
  color: #ffddb0;
}

.node-label {
  font-size: 12.5px;
  font-weight: 600;
  color: #ffffff;
}

.node-meta {
  font-size: 10px;
  color: #c1c6d7;
  margin-top: 2px;
}

.node-meta.green {
  color: #88fd54;
}

.canvas-zoom-bar {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  padding: 3px 8px;
  color: #c1c6d7;
  font-size: 11px;
}

.zoom-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.zoom-btn:hover {
  color: #ffffff;
}

.zoom-sep {
  color: rgba(255, 255, 255, 0.2);
}

.zoom-pct {
  font-size: 11px;
}

/* 3. Lower Split Grid (Consensus + Action Items) */
.lower-split-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  height: 186px;
  min-height: 150px;
  flex-shrink: 0;
}

.split-card {
  background: rgba(226, 226, 226, 0.1);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.split-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.split-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.green-icon {
  color: #88fd54;
  flex-shrink: 0;
}

.blue-icon {
  color: #afc6ff;
  flex-shrink: 0;
}

.split-title {
  font-size: 12.5px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count-pill {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  flex-shrink: 0;
}

.count-pill.green {
  background: rgba(38, 109, 0, 0.3);
  color: #88fd54;
}

.sync-action-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}

.sync-action-btn:hover {
  color: #ffffff;
}

.split-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}

.split-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11.5px;
  color: #9ba3b8;
}

.mini-trigger-btn {
  border: 1px solid rgba(175, 198, 255, 0.28);
  background: rgba(0, 110, 242, 0.2);
  color: #afc6ff;
  border-radius: 5px;
  font-size: 11px;
  padding: 2px 9px;
  cursor: pointer;
}

.mini-trigger-btn:hover:not(:disabled) {
  background: rgba(0, 110, 242, 0.35);
  color: #ffffff;
}

.board-item {
  background: rgba(226, 226, 226, 0.12);
  border-radius: 8px;
  padding: 7px 9px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.board-item:hover {
  background: rgba(226, 226, 226, 0.2);
}

.board-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
}

.board-item-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: #ffffff;
  min-width: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.green {
  background: #88fd54;
}

.status-dot.blue {
  background: #afc6ff;
}

.board-item-status {
  font-size: 10.5px;
  font-weight: 600;
  flex-shrink: 0;
}

.board-item-status.green {
  color: #88fd54;
}

.board-item-status.blue {
  color: #afc6ff;
}

.board-item-desc {
  margin: 0 0 5px;
  font-size: 11px;
  color: #c1c6d7;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.progress-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(226, 226, 226, 0.25);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
}

.progress-fill.green {
  background: #88fd54;
}

.progress-fill.blue {
  background: #006ef2;
}

.due-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(125, 84, 0, 0.35);
  color: #ffddb0;
  flex-shrink: 0;
}

.due-badge.done {
  background: rgba(38, 109, 0, 0.35);
  color: #88fd54;
}

.todo-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #c1c6d7;
}

.todo-meta-row strong {
  color: #ffffff;
  font-weight: 500;
}

.todo-state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.todo-state.green {
  color: #88fd54;
}

.todo-state.blue {
  color: #d9e2ff;
}

/* Command output banner */
.cmd-result-banner {
  background: rgba(0, 87, 194, 0.2);
  border: 1px solid rgba(175, 198, 255, 0.32);
  border-radius: 9px;
  padding: 8px 10px;
  flex-shrink: 0;
}

.cmd-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.cmd-result-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: #afc6ff;
}

.cmd-close-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  cursor: pointer;
}

.cmd-result-body {
  margin: 0;
  font-size: 12px;
  color: #f1f1f1;
  line-height: 1.45;
  max-height: 80px;
  overflow-y: auto;
}

/* 4. Bottom Command Bar */
.command-bar {
  background: rgba(226, 226, 226, 0.14);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 7px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.cmd-icon-wrap {
  padding-left: 6px;
  color: #006ef2;
  display: flex;
  align-items: center;
}

.cmd-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: #ffffff;
}

.cmd-input::placeholder {
  color: #9ba3b8;
}

.cmd-quick-btns {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.cmd-chip {
  border: none;
  border-radius: 5px;
  background: rgba(226, 226, 226, 0.22);
  color: #c1c6d7;
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.cmd-chip:hover:not(:disabled) {
  background: rgba(226, 226, 226, 0.35);
  color: #ffffff;
}

.cmd-submit-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: #006ef2;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.12s ease;
}

.cmd-submit-btn:hover:not(:disabled) {
  background: #0057c2;
}

.cmd-submit-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.cmd-submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.intel-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid rgba(175, 198, 255, 0.32);
  background: rgba(0, 110, 242, 0.24);
  color: #e4ecff;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
}

.intel-trigger-btn:hover:not(:disabled) {
  background: rgba(0, 110, 242, 0.42);
  color: #ffffff;
}

.intel-trigger-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.canvas-mode-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.25);
}

.canvas-tab-btn {
  border: none;
  background: transparent;
  color: #aeb6cc;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.canvas-tab-btn.active {
  background: rgba(0, 110, 242, 0.34);
  color: #ffffff;
  font-weight: 600;
}

.terms-canvas {
  flex: 1;
  min-height: 150px;
  border-radius: 10px;
  background: rgba(18, 20, 26, 0.72);
  border: 1px solid rgba(193, 198, 215, 0.12);
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.terms-canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.terms-cfg-pills,
.terms-cfg-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cfg-toggle-pill {
  border: 1px solid rgba(193, 198, 215, 0.26);
  background: rgba(255, 255, 255, 0.06);
  color: #c1c6d7;
  border-radius: 5px;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
}

.cfg-toggle-pill.active {
  border-color: rgba(136, 253, 84, 0.45);
  background: rgba(38, 109, 0, 0.3);
  color: #88fd54;
}

.cfg-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(193, 198, 215, 0.24);
  color: #e2e6f0;
  border-radius: 5px;
  font-size: 11px;
  padding: 2px 6px;
  outline: none;
}

.cfg-select option {
  background: #1f222a;
  color: #ffffff;
}

.mini-trigger-btn.ghost {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(193, 198, 215, 0.24);
  color: #d6dbe8;
}

.causal-banner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 7px;
  background: rgba(0, 110, 242, 0.14);
  border: 1px solid rgba(175, 198, 255, 0.24);
  color: #e4ecff;
  font-size: 11.5px;
  line-height: 1.45;
}

.causal-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 110, 242, 0.38);
  color: #ffffff;
  font-size: 10px;
}

.terms-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #9ba3b8;
  font-size: 12px;
  padding: 18px 8px;
}

.terms-mini-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.term-mini-row {
  background: rgba(226, 226, 226, 0.09);
  border: 1px solid rgba(193, 198, 215, 0.12);
  border-radius: 7px;
  padding: 7px 9px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.term-mini-row:hover {
  background: rgba(226, 226, 226, 0.16);
}

.term-mini-row.conflict {
  border-color: rgba(255, 186, 69, 0.45);
  background: rgba(125, 84, 0, 0.18);
}

.term-mini-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.term-mini-name {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.term-mini-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(175, 198, 255, 0.16);
  color: #afc6ff;
}

.term-mini-tag.conflict {
  background: rgba(255, 186, 69, 0.25);
  color: #ffddb0;
}

.term-mini-desc {
  margin: 0;
  font-size: 11px;
  color: #c1c6d7;
  line-height: 1.4;
}

.decision-inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.decision-inline-row .progress-track {
  flex: 1;
}

.dec-op-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.dec-op-btn {
  border: none;
  border-radius: 4px;
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.dec-op-btn.confirm {
  background: rgba(38, 109, 0, 0.45);
  color: #88fd54;
}

.dec-op-btn.defer {
  background: rgba(125, 84, 0, 0.42);
  color: #ffddb0;
}

.dec-op-btn.reject {
  background: rgba(186, 26, 26, 0.4);
  color: #ffdad6;
}

.todo-check-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.todo-check-btn {
  border: none;
  background: transparent;
  color: #9ba3b8;
  padding: 0;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.todo-check-btn.checked {
  color: #88fd54;
}

.board-item-title.done {
  text-decoration: line-through;
  color: #9ba3b8;
}
</style>
