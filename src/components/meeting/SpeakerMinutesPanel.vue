<template>
  <aside class="speaker-minutes-panel">
    <!-- 顶部标题栏与收起控制 -->
    <div class="panel-head">
      <div class="head-left">
        <MeetingIcon name="smart_toy" :size="20" class="head-icon" />
        <h2 class="head-title">智能纪要与速记</h2>
      </div>
      <div class="head-actions">
        <button
          type="button"
          class="head-icon-btn"
          title="全屏查看完整纪要"
          @click="emit('openWorkspace', 'minutes')"
        >
          <MeetingIcon name="open_in_new" :size="16" />
        </button>
        <button
          type="button"
          class="head-icon-btn"
          title="收起面板"
          @click="emit('collapse')"
        >
          <MeetingIcon name="keyboard_double_arrow_right" :size="18" />
        </button>
      </div>
    </div>

    <!-- 模式分段切换 -->
    <div class="segmented-tabs">
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'points' }"
        @click="activeTab = 'points'"
      >
        实时要点
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'terms' }"
        @click="activeTab = 'terms'"
      >
        术语 ({{ aiStore.meetingTerms.length }})
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'interact' }"
        @click="activeTab = 'interact'"
      >
        互动 ({{ interactionCount }})
      </button>
    </div>

    <!-- Tab 1: AI 实时要点 -->
    <template v-if="activeTab === 'points'">
      <!-- 最新决议收敛横幅 -->
      <div class="decision-marker-banner">
        <div class="banner-top">
          <div class="banner-title">
            <MeetingIcon name="check_circle" :size="16" class="banner-check-icon" />
            <span>{{ latestDecision ? '最新决策收敛' : 'Spring AI 纪要与决策' }}</span>
          </div>
          <span class="banner-status-pill mono" :class="latestDecision?.status?.toLowerCase() || 'idle'">
            {{ latestDecision ? formatDecisionShort(latestDecision.status) : aiStore.minutesStatusLabel }}
          </span>
        </div>

        <p class="banner-desc">
          <template v-if="latestDecision">
            {{ latestDecision.topic ? `${latestDecision.topic}：` : '' }}{{ latestDecision.content }}
          </template>
          <template v-else-if="aiStore.minutes?.conclusions">
            {{ aiStore.minutes.conclusions }}
          </template>
          <template v-else>
            {{
              aiStore.isLiveDecisionEnabled || isTranscribing
                ? '正在实时捕捉发言并自动收敛核心议题、决议与待办分工...'
                : '开启会中决策追踪或点击提取按钮，自动汇总本场会议核心决议。'
            }}
          </template>
        </p>

        <div class="banner-meta">
          <template v-if="latestDecision">
            <span class="assignee-tag mono">
              {{ latestDecision.assigneeName || latestDecision.decisionMaker || latestDecision.proposer || '待指派' }}
            </span>
            <button
              v-if="latestDecision.status !== 'CONFIRMED'"
              type="button"
              class="inline-op-btn confirm"
              @click="aiStore.confirmDecisionAction(latestDecision.decisionId)"
            >
              确认生效
            </button>
            <button
              v-if="latestDecision.status !== 'CONFIRMED' && latestDecision.status !== 'DEFERRED'"
              type="button"
              class="inline-op-btn defer"
              @click="aiStore.deferDecisionAction(latestDecision.decisionId)"
            >
              暂缓
            </button>
            <button
              type="button"
              class="inline-op-btn ghost"
              @click="emit('openWorkspace', 'decisions')"
            >
              脑图
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="trigger-extract-btn"
              :disabled="aiStore.isAnalyzing"
              @click="aiStore.triggerAnalysis(meetingId, true)"
            >
              {{ aiStore.isAnalyzing ? '多 Agent 提炼中...' : '启动 AI 提炼' }}
            </button>
            <button
              v-if="!aiStore.isLiveDecisionEnabled"
              type="button"
              class="inline-op-btn ghost"
              :disabled="aiStore.featureLoading"
              @click="aiStore.toggleFeature('live_decision', true, meetingId)"
            >
              开启会中决策追踪
            </button>
          </template>
        </div>
      </div>

      <!-- 时间轴要点流 -->
      <div class="timeline-scroll dark-scroll" ref="timelineScrollRef">
        <div v-if="timelineNodes.length === 0 && !isTranscribing && !aiStore.isAnalyzing" class="empty-timeline">
          <p>暂无实时速记节点，发言或开启实时转写后将自动生成时间轴要点。</p>
        </div>

        <div
          v-for="(node, idx) in timelineNodes"
          :key="node.id"
          class="timeline-node"
        >
          <div class="node-axis">
            <span class="node-dot" :class="node.dotType"></span>
            <span
              v-if="idx < timelineNodes.length - 1 || isTranscribing || aiStore.isAnalyzing"
              class="node-line"
            ></span>
          </div>
          <div class="node-content">
            <div class="node-head">
              <span class="node-speaker">{{ node.title }}</span>
              <span class="node-time mono">{{ node.time }}</span>
            </div>
            <p class="node-text">{{ node.text }}</p>
          </div>
        </div>

        <!-- 实时分析中/转写中动态尾部节点 -->
        <div v-if="isTranscribing || aiStore.isAnalyzing" class="timeline-node is-live">
          <div class="node-axis">
            <span class="node-dot amber pulsing"></span>
          </div>
          <div class="node-content">
            <div class="node-head">
              <span class="node-speaker amber">
                {{ aiStore.isAnalyzing ? '多 Agent 生成中...' : '统一 ASR 实时监听中...' }}
              </span>
              <span class="node-tag mono">LIVE</span>
            </div>
            <p class="node-text italic">
              {{
                latestLiveText
                  ? `“${latestLiveText}”`
                  : '正在持续识别会议音频流并提炼关键要点...'
              }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Tab 2: 实时行业术语识别与因果链 -->
    <template v-else-if="activeTab === 'terms'">
      <div class="terms-toolbar">
        <div class="terms-cfg-info mono">
          <span>{{ aiStore.isTermIntelligenceEnabled ? '实时术语识别开启' : '实时术语识别关闭' }}</span>
          <span v-if="aiStore.featureConfig.domainHint"> · {{ aiStore.featureConfig.domainHint }}</span>
        </div>
        <div class="terms-toolbar-btns">
          <button
            type="button"
            class="inline-op-btn ghost"
            :disabled="aiStore.terminologyAnalyzing"
            @click="aiStore.triggerMeetingTermAnalysis({}, meetingId)"
          >
            {{ aiStore.terminologyAnalyzing ? '识别中...' : '同步识别' }}
          </button>
          <button
            type="button"
            class="inline-op-btn confirm"
            @click="emit('openWorkspace', 'terminology')"
          >
            完整解释
          </button>
        </div>
      </div>

      <div class="interact-scroll dark-scroll">
        <div v-if="aiStore.meetingCausalSummary" class="interact-card causal-summary-card">
          <span class="causal-tag mono">跨域因果概览</span>
          <p class="interact-msg-body">{{ aiStore.meetingCausalSummary }}</p>
        </div>

        <div v-if="aiStore.meetingTerms.length === 0" class="empty-timeline">
          <p>暂未识别到行业术语。发言包含专业术语后将通过实时流推送，或点击上方「同步识别」提取。</p>
        </div>

        <div
          v-for="(term, idx) in aiStore.meetingTerms"
          :key="term.occurrenceId || term.explanationId || `${term.surface}-${idx}`"
          class="interact-card term-mini-card"
          :class="{ conflict: term.ambiguityStatus === 'CONFLICT_DUAL' }"
          @click="emit('openWorkspace', 'terminology')"
        >
          <div class="interact-msg-head">
            <span class="interact-name">{{ term.canonicalName || term.surface }}</span>
            <span
              class="interact-badge mono"
              :class="{ conflict: term.ambiguityStatus === 'CONFLICT_DUAL' }"
            >
              {{
                term.ambiguityStatus === 'CONFLICT_DUAL'
                  ? '口径冲突'
                  : term.domain || '行业术语'
              }}
            </span>
          </div>
          <p class="interact-msg-body">
            {{ term.contextMeaning || term.plainExplanation || term.definition || '点击查看三层智能解释' }}
          </p>
        </div>
      </div>
    </template>

    <!-- Tab 3: 参会互动 -->
    <template v-else>
      <div class="interact-scroll dark-scroll">
        <div v-if="handRaisedMembers.length > 0" class="interact-section">
          <div class="interact-section-title">
            <MeetingIcon name="pan_tool" :size="14" class="amber-icon" />
            <span>举手示意 ({{ handRaisedMembers.length }})</span>
          </div>
          <div
            v-for="m in handRaisedMembers"
            :key="m.userId"
            class="interact-card hand-card"
          >
            <span class="interact-name">{{ m.nickName }}</span>
            <span class="interact-badge">请求发言</span>
          </div>
        </div>

        <div class="interact-section">
          <div class="interact-section-title">
            <MeetingIcon name="chat" :size="14" class="blue-icon" />
            <span>实时消息互动 ({{ meetingStore.chatMessages.length }})</span>
          </div>

          <div v-if="meetingStore.chatMessages.length === 0" class="empty-timeline">
            <p>暂无参会互动消息，可通过下方快捷气泡或输入框发送。</p>
          </div>

          <div
            v-for="msg in recentChatMessages"
            :key="msg.messageId"
            class="interact-card"
          >
            <div class="interact-msg-head">
              <span class="interact-name">{{ msg.sendNickName || (msg.isSelf ? '我' : '参会者') }}</span>
              <span class="node-time mono">{{ formatChatTime(msg.sendTime) }}</span>
            </div>
            <p class="interact-msg-body">{{ msg.meesageContent || msg.content || msg.message }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- 内联 @EasyCopilot 回答浮条 -->
    <div v-if="copilotReply" class="copilot-reply-box">
      <div class="reply-head">
        <span class="reply-title">
          <MeetingIcon name="auto_awesome" :size="13" />
          EasyCopilot 回复
        </span>
        <button type="button" class="reply-close" @click="copilotReply = null">
          <MeetingIcon name="close" :size="13" />
        </button>
      </div>
      <p class="reply-body">{{ copilotReply }}</p>
    </div>

    <!-- 底部快捷互动气泡与输入框 -->
    <div class="quick-interact-dock">
      <div class="quick-dock-head">
        <span>快捷提问 / 互动气泡</span>
        <button type="button" class="clear-btn" @click="handleClearQuick">清空</button>
      </div>

      <div class="quick-chips">
        <button
          type="button"
          class="quick-chip"
          @click="sendQuickInteraction('🙋 请求补充当前细节')"
        >
          🙋 请求补充细节
        </button>
        <button
          type="button"
          class="quick-chip"
          @click="sendQuickInteraction('⚡ 赞同当前方案')"
        >
          ⚡ 赞同当前方案
        </button>
      </div>

      <div class="dock-input-wrap">
        <input
          v-model="inputText"
          type="text"
          class="dock-input"
          placeholder="发消息、@EasyCopilot 问答或 /术语 检索..."
          @keydown.enter.prevent="handleSubmit"
        />
        <button
          type="button"
          class="dock-send-btn"
          :disabled="sending || !inputText.trim()"
          @click="handleSubmit"
        >
          <MeetingIcon name="send" :size="17" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import MeetingIcon from '@/components/meeting/MeetingIcon.vue'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useMeetingStore } from '@/stores/meeting'
import { askMeetingQa, askTermKnowledge } from '@/api/meetingAi'
import { sendChatMessage } from '@/api/meeting'
import { formatTranscriptMs } from '@/utils/transcript'

const props = defineProps({
  meetingId: { type: String, required: true },
  segments: { type: Array, default: () => [] },
  isTranscribing: { type: Boolean, default: false },
  handRaisedMembers: { type: Array, default: () => [] }
})

const emit = defineEmits(['collapse', 'openWorkspace'])

const aiStore = useMeetingAiStore()
const meetingStore = useMeetingStore()

const activeTab = ref('points')
const inputText = ref('')
const sending = ref(false)
const copilotReply = ref(null)
const timelineScrollRef = ref(null)

const latestDecision = computed(() => {
  return aiStore.confirmedDecisions[0] || aiStore.decisions[0] || null
})

const interactionCount = computed(() => {
  return (meetingStore.chatMessages?.length || 0) + (props.handRaisedMembers?.length || 0)
})

const recentChatMessages = computed(() => {
  return [...(meetingStore.chatMessages || [])].slice(-20)
})

const timelineNodes = computed(() => {
  const nodes = []
  if (aiStore.agendaTopics?.length > 0) {
    aiStore.agendaTopics.forEach((topic, i) => {
      nodes.push({
        id: `topic-${i}`,
        title: topic.title || `核心议题 ${i + 1}`,
        time: topic.startTime ? formatChatTime(topic.startTime) : `议题 #${i + 1}`,
        text: topic.discussionSummary || topic.summary || '',
        dotType: i % 2 === 0 ? 'primary' : 'green'
      })
    })
  }
  const segList = props.segments || []
  const tailSegs = segList.slice(-8)
  tailSegs.forEach((seg, i) => {
    const content = seg.currentText || seg.text || seg.originalText
    if (!content) return
    nodes.push({
      id: seg.segmentId || `seg-${i}`,
      title: seg.speakerName || '参会发言人',
      time: formatTranscriptMs(seg.startTimeMs),
      text: content,
      dotType: i % 2 === 0 ? 'primary' : 'green'
    })
  })
  return nodes
})

const latestLiveText = computed(() => {
  const list = props.segments || []
  if (list.length === 0) return ''
  const last = list[list.length - 1]
  return last.currentText || last.text || last.originalText || ''
})

function formatDecisionShort(status) {
  switch (status) {
    case 'CONFIRMED':
      return '已确认'
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

function formatDecisionTime(val) {
  if (!val) return '刚刚'
  return dayjs(val).isValid() ? dayjs(val).format('HH:mm') : String(val)
}

function formatChatTime(ts) {
  if (!ts) return ''
  return dayjs(ts).isValid() ? dayjs(ts).format('HH:mm') : ''
}

function handleClearQuick() {
  inputText.value = ''
  copilotReply.value = null
}

async function sendQuickInteraction(text) {
  try {
    await sendChatMessage({ message: text, receiveUserId: '' })
    message.success('已发送互动气泡')
  } catch (err) {
    message.error(err.message || '发送失败')
  }
}

async function handleSubmit() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  sending.value = true
  try {
    if (text.startsWith('/术语') || text.startsWith('术语:') || text.startsWith('术语：')) {
      const termQuery = text.replace(/^(\/术语|术语[:：])\s*/i, '').trim() || text
      const res = await askTermKnowledge({
        query: termQuery,
        meetingId: props.meetingId,
        domainHint: aiStore.featureConfig.domainHint || undefined,
        targetLang: aiStore.featureConfig.preferredLang || 'zh'
      })
      copilotReply.value =
        [
          res?.standardName ? `【${res.standardName}${res.domain ? ` · ${res.domain}` : ''}】` : '',
          res?.plainExplanation || res?.definition || res?.contextMeaning || res?.answer || '已完成术语检索'
        ]
          .filter(Boolean)
          .join(' ')
      inputText.value = ''
    } else if (text.startsWith('@EasyCopilot') || text.startsWith('@AI') || text.startsWith('/')) {
      const cleanQuestion = text.replace(/^(@EasyCopilot|@AI|\/)\s*/i, '').trim() || '请总结当前会议重点与结论'
      const res = await askMeetingQa({
        meetingId: props.meetingId,
        question: cleanQuestion
      })
      copilotReply.value = res?.answer || '暂无相关会议记录回答'
      inputText.value = ''
    } else {
      await sendChatMessage({ message: text, receiveUserId: '' })
      inputText.value = ''
      activeTab.value = 'interact'
    }
  } catch (err) {
    message.error(err.message || '发送失败')
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.speaker-minutes-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: rgba(226, 226, 226, 0.11);
  backdrop-filter: blur(16px);
  border-radius: 12px;
  padding: 14px;
  gap: 12px;
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.38);
  border: 1px solid rgba(193, 198, 215, 0.1);
}

.mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
  flex-shrink: 0;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.head-icon {
  color: #006ef2;
}

.head-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f1f1;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.head-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c1c6d7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
}

.head-icon-btn:hover {
  color: #f1f1f1;
  background: rgba(226, 226, 226, 0.22);
}

.segmented-tabs {
  display: flex;
  padding: 3px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.14);
  flex-shrink: 0;
}

.seg-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: #c1c6d7;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.seg-btn:hover {
  color: #f1f1f1;
}

.seg-btn.active {
  background: #0057c2;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 87, 194, 0.35);
}

.decision-marker-banner {
  background: rgba(0, 87, 194, 0.16);
  border: 1px solid rgba(175, 198, 255, 0.18);
  border-radius: 9px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.banner-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.banner-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #afc6ff;
}

.banner-check-icon {
  color: #88fd54;
}

.banner-time {
  font-size: 11px;
  color: #c1c6d7;
}

.banner-status-pill {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(226, 226, 226, 0.16);
  color: #c1c6d7;
}

.banner-status-pill.confirmed {
  background: rgba(38, 109, 0, 0.35);
  color: #88fd54;
}

.banner-status-pill.discussing {
  background: rgba(125, 84, 0, 0.35);
  color: #ffddb0;
}

.inline-op-btn {
  border: 1px solid rgba(193, 198, 215, 0.25);
  background: rgba(226, 226, 226, 0.12);
  color: #f1f1f1;
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.inline-op-btn.confirm {
  border-color: rgba(136, 253, 84, 0.4);
  background: rgba(38, 109, 0, 0.3);
  color: #88fd54;
}

.inline-op-btn.confirm:hover {
  background: rgba(38, 109, 0, 0.55);
}

.inline-op-btn.defer {
  border-color: rgba(255, 186, 69, 0.38);
  background: rgba(125, 84, 0, 0.28);
  color: #ffddb0;
}

.inline-op-btn.ghost {
  color: #afc6ff;
  border-color: rgba(175, 198, 255, 0.28);
  background: rgba(0, 110, 242, 0.16);
}

.inline-op-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.terms-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.08);
  flex-shrink: 0;
}

.terms-cfg-info {
  font-size: 10.5px;
  color: #afc6ff;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terms-toolbar-btns {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.causal-summary-card {
  border: 1px solid rgba(175, 198, 255, 0.22);
  background: rgba(0, 87, 194, 0.14);
}

.causal-tag {
  display: inline-block;
  font-size: 10px;
  color: #afc6ff;
  margin-bottom: 3px;
}

.term-mini-card {
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.16s ease;
}

.term-mini-card:hover {
  border-color: rgba(0, 110, 242, 0.45);
  background: rgba(226, 226, 226, 0.16);
}

.term-mini-card.conflict {
  border-color: rgba(255, 186, 69, 0.4);
}

.interact-badge.conflict {
  background: rgba(186, 26, 26, 0.25);
  color: #ff8a80;
}

.banner-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #f1f1f1;
}

.banner-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.assignee-tag {
  font-size: 11px;
  color: #afc6ff;
  background: rgba(0, 87, 194, 0.25);
  padding: 2px 7px;
  border-radius: 4px;
}

.due-tag {
  font-size: 11px;
  color: #c1c6d7;
}

.trigger-extract-btn {
  border: none;
  border-radius: 5px;
  background: #006ef2;
  color: #ffffff;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  cursor: pointer;
}

.trigger-extract-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.timeline-scroll,
.interact-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.empty-timeline {
  padding: 24px 10px;
  text-align: center;
  font-size: 12px;
  color: #c1c6d7;
}

.timeline-node {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.node-axis {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
}

.node-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-top: 5px;
  background: #0057c2;
  flex-shrink: 0;
}

.node-dot.green {
  background: #88fd54;
}

.node-dot.amber {
  background: #ffba45;
}

.node-dot.pulsing {
  animation: node-pulse 1.5s infinite ease-in-out;
}

@keyframes node-pulse {
  0%, 100% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.25); opacity: 1; }
}

.node-line {
  width: 1.5px;
  flex: 1;
  min-height: 16px;
  background: rgba(226, 226, 226, 0.22);
  margin: 4px 0;
}

.node-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 10px;
}

.node-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.node-speaker {
  font-size: 12px;
  font-weight: 600;
  color: #f1f1f1;
}

.node-speaker.amber {
  color: #ffba45;
}

.node-time {
  font-size: 11px;
  color: #9ba3b8;
}

.node-tag {
  font-size: 10px;
  color: #c1c6d7;
}

.node-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #c1c6d7;
}

.node-text.italic {
  font-style: italic;
}

.interact-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.interact-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: #c1c6d7;
}

.amber-icon {
  color: #ffba45;
}

.blue-icon {
  color: #006ef2;
}

.interact-card {
  background: rgba(226, 226, 226, 0.1);
  border-radius: 8px;
  padding: 8px 10px;
}

.hand-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(255, 186, 69, 0.35);
}

.interact-msg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.interact-name {
  font-size: 12px;
  font-weight: 600;
  color: #f1f1f1;
}

.interact-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 186, 69, 0.2);
  color: #ffba45;
}

.interact-msg-body {
  margin: 0;
  font-size: 12px;
  color: #d6dae6;
  line-height: 1.45;
}

.copilot-reply-box {
  background: rgba(0, 110, 242, 0.16);
  border: 1px solid rgba(175, 198, 255, 0.3);
  border-radius: 8px;
  padding: 8px 10px;
  flex-shrink: 0;
}

.reply-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.reply-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: #afc6ff;
}

.reply-close {
  border: none;
  background: transparent;
  color: #c1c6d7;
  cursor: pointer;
}

.reply-body {
  margin: 0;
  font-size: 12px;
  color: #f1f1f1;
  line-height: 1.45;
  max-height: 96px;
  overflow-y: auto;
}

.quick-interact-dock {
  padding-top: 6px;
  border-top: 1px solid rgba(193, 198, 215, 0.12);
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex-shrink: 0;
}

.quick-dock-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #c1c6d7;
}

.clear-btn {
  border: none;
  background: transparent;
  color: #afc6ff;
  font-size: 11px;
  cursor: pointer;
}

.clear-btn:hover {
  text-decoration: underline;
}

.quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quick-chip {
  border: none;
  border-radius: 6px;
  background: rgba(226, 226, 226, 0.16);
  color: #f1f1f1;
  font-size: 11.5px;
  padding: 4px 9px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.quick-chip:hover {
  background: rgba(226, 226, 226, 0.28);
}

.dock-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.dock-input {
  width: 100%;
  background: rgba(226, 226, 226, 0.12);
  border: 1px solid rgba(193, 198, 215, 0.12);
  border-radius: 8px;
  padding: 7px 36px 7px 11px;
  font-size: 12.5px;
  color: #f1f1f1;
  outline: none;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.dock-input::placeholder {
  color: #9ba3b8;
}

.dock-input:focus {
  background: rgba(226, 226, 226, 0.2);
  border-color: #006ef2;
}

.dock-send-btn {
  position: absolute;
  right: 6px;
  border: none;
  background: transparent;
  color: #afc6ff;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.dock-send-btn:hover:not(:disabled) {
  color: #006ef2;
}

.dock-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
