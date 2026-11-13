<template>
  <aside class="copilot-panel">
    <!-- 顶部标题与模式切换 -->
    <div class="copilot-header">
      <div class="copilot-title-row">
        <div class="copilot-brand">
          <MeetingIcon name="neurology" :size="20" class="brand-icon" />
          <h2 class="brand-title">EasyCopilot 智能协同</h2>
        </div>

        <button
          type="button"
          class="live-status-pill"
          :class="{ active: isTranscribing || aiStore.isAnalyzing }"
          :disabled="startingSession"
          :title="isTranscribing ? '点击暂停本机实时转写' : '点击开启实时语音转写'"
          @click="emit('toggleTranscription')"
        >
          <span class="status-pulse" :class="{ active: isTranscribing || aiStore.isAnalyzing }"></span>
          <span>
            {{
              startingSession
                ? '连接转写中...'
                : aiStore.isAnalyzing
                  ? '实时推演中'
                  : isTranscribing
                    ? '实时转写中'
                    : '开启转写'
            }}
          </span>
        </button>
      </div>

      <!-- Segmented Pill Tab Bar -->
      <div class="copilot-tabs">
        <button
          type="button"
          class="copilot-tab-btn"
          :class="{ active: activeTab === 'transcript' }"
          @click="activeTab = 'transcript'"
        >
          <span>实时转写流</span>
          <span v-if="filteredSegments.length > 0" class="tab-count-pill">
            {{ filteredSegments.length }}
          </span>
        </button>
        <button
          type="button"
          class="copilot-tab-btn"
          :class="{ active: activeTab === 'summary' }"
          @click="activeTab = 'summary'"
        >
          <span>AI 提炼纪要</span>
          <span v-if="summaryBadgeCount > 0" class="tab-count-pill accent">
            {{ summaryBadgeCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- 中间可滚动主内容区 -->
    <div class="copilot-scroll-body dark-scroll" ref="scrollContainerRef">
      <!-- Tab 1: 实时转写流（保留转写头像 + 尖角气泡时间轴） -->
      <template v-if="activeTab === 'transcript'">
        <!-- 实时阶段共识卡片 -->
        <div class="consensus-card">
          <div class="consensus-head">
            <div class="consensus-label">
              <MeetingIcon name="verified" :size="15" />
              <span>实时阶段共识 (Consensus)</span>
            </div>
            <span class="consensus-meta">
              {{ consensusMetaText }}
            </span>
          </div>
          <p class="consensus-body">
            {{ consensusSummaryText }}
          </p>
        </div>

        <!-- 说话人筛选提示条 -->
        <div v-if="filteredSpeaker" class="speaker-filter-bar">
          <span>当前仅看发言人：<strong>{{ filteredSpeaker }}</strong></span>
          <button type="button" class="clear-filter-btn" @click="filteredSpeaker = ''">
            显示全部
          </button>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredSegments.length === 0" class="copilot-empty">
          <p class="empty-title">暂无实时转写流</p>
          <p class="empty-desc">
            点击右上角「{{ isTranscribing ? '实时转写中' : '开启转写' }}」或底部「纪要中」，系统将自动捕捉语音并生成带头像气泡的实时记录。
          </p>
          <button
            v-if="!isTranscribing"
            type="button"
            class="empty-start-btn"
            :disabled="startingSession"
            @click="emit('toggleTranscription')"
          >
            <MeetingIcon name="mic" :size="15" />
            <span>立即开启实时转写</span>
          </button>
        </div>

        <!-- 保留的转写头像 + 气泡时间轴 -->
        <div v-else class="live-timeline">
          <div
            v-for="(seg, idx) in filteredSegments"
            :key="seg.segmentId || `live-${idx}`"
            class="live-timeline-item"
            :class="{
              'is-first': idx === 0,
              'is-last': idx === filteredSegments.length - 1,
              'is-self': isSelfSpeaker(seg),
              'is-live': isTranscribing && idx === filteredSegments.length - 1,
              'is-focused': focusedKey === getSegKey(seg, idx)
            }"
            :style="getItemVars(seg)"
            @click="handleItemTap(seg, idx)"
          >
            <!-- 左侧时间轴竖线与节点圆点 -->
            <div class="live-axis" aria-hidden="true">
              <span class="live-axis-top"></span>
              <span class="live-axis-dot"></span>
              <span class="live-axis-bottom"></span>
              <span class="live-axis-connector"></span>
            </div>

            <!-- 说话人圆形头像 -->
            <div class="live-avatar-col">
              <div class="live-avatar-wrap">
                <a-avatar
                  :size="34"
                  :src="getAvatarSrc(seg)"
                  :load-error="() => handleAvatarError(seg)"
                  class="live-avatar"
                  :style="{ background: getSpeakerTheme(seg.speakerName || '参会发言人').gradient }"
                >
                  {{ getSpeakerInitial(seg.speakerName || '参会发言人') }}
                </a-avatar>
                <span
                  v-if="isTranscribing && idx === filteredSegments.length - 1"
                  class="live-playing-dot"
                  title="正在识别"
                ></span>
              </div>
            </div>

            <!-- 带左侧尖角的气泡对话框 -->
            <div class="live-speech-bubble">
              <div class="live-bubble-inner">
                <div class="live-seg-head">
                  <div class="bubble-speaker-group">
                    <button
                      type="button"
                      class="speaker-name-btn"
                      :title="filteredSpeaker === seg.speakerName ? '点击取消筛选' : '点击仅看该发言人'"
                      @click.stop="toggleSpeakerFilter(seg.speakerName)"
                    >
                      <span class="speaker-dot"></span>
                      <span class="speaker-name">{{ seg.speakerName || '参会发言人' }}</span>
                    </button>
                    <span v-if="isSelfSpeaker(seg)" class="role-badge self-badge">我</span>
                    <span v-if="seg.isRevised === 1" class="status-pill revised-pill">已修正</span>
                    <span
                      v-if="isTranscribing && idx === filteredSegments.length - 1"
                      class="status-pill syncing-pill"
                    >
                      <MeetingIcon name="sync" :size="11" spin />
                      <span>实时输入</span>
                    </span>
                  </div>

                  <span class="time-pill mono">{{ formatTranscriptMs(seg.startTimeMs) }}</span>
                </div>

                <p class="live-seg-text">{{ seg.currentText || seg.text || seg.originalText }}</p>

                <!-- 悬浮时呈现轻量化气泡动作 -->
                <div class="live-bubble-actions">
                  <button
                    type="button"
                    class="bubble-mini-btn"
                    @click.stop="handleCopySeg(seg)"
                  >
                    复制
                  </button>
                  <button
                    v-if="seg.segmentId"
                    type="button"
                    class="bubble-mini-btn"
                    @click.stop="openReviseModal(seg)"
                  >
                    修正
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 智能决策提要（有真实决策时展示） -->
        <div v-if="aiStore.decisions.length > 0" class="milestones-box">
          <div class="milestones-head">
            <span>智能决策提要 (Key Decisions)</span>
            <button
              type="button"
              class="link-btn"
              @click="emit('openWorkspace', 'decisions')"
            >
              详情脑图
            </button>
          </div>

          <div
            v-for="dec in aiStore.decisions.slice(0, 4)"
            :key="dec.decisionId"
            class="milestone-row"
            @click="emit('openWorkspace', 'decisions')"
          >
            <div class="milestone-title">
              <span class="milestone-dot" :class="dec.status?.toLowerCase()"></span>
              <span class="ellipsis">{{ dec.topic || dec.content }}</span>
            </div>
            <div class="milestone-right">
              <button
                v-if="dec.status !== 'CONFIRMED'"
                type="button"
                class="mini-confirm-btn"
                title="人工确认该决策生效"
                @click.stop="aiStore.confirmDecisionAction(dec.decisionId)"
              >
                确认
              </button>
              <span class="milestone-status">{{ formatDecisionStatus(dec.status) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Tab 2: AI 提炼纪要与待办/术语 -->
      <template v-else>
        <div class="summary-toolbar">
          <div class="summary-status">
            <span>纪要状态：</span>
            <a-tag :color="aiStore.minutesStatusColor" style="margin: 0">
              {{ aiStore.minutesStatusLabel }}
            </a-tag>
          </div>
          <div class="summary-toolbar-actions">
            <button
              v-if="aiStore.minutes"
              type="button"
              class="link-btn"
              @click="emit('openWorkspace', 'minutes')"
            >
              编辑/发布
            </button>
            <a-button
              size="small"
              type="primary"
              :loading="aiStore.isAnalyzing"
              @click="aiStore.triggerAnalysis(meetingId, true)"
            >
              生成/更新纪要
            </a-button>
          </div>
        </div>

        <!-- 纪要卡片 -->
        <div v-if="aiStore.minutes" class="summary-card">
          <h4 class="summary-card-title">{{ aiStore.minutes.title || '会议智能纪要' }}</h4>
          <div v-if="aiStore.minutes.summary" class="summary-section">
            <span class="section-tag">会议概述</span>
            <p class="section-text">{{ aiStore.minutes.summary }}</p>
          </div>
          <div v-if="aiStore.minutes.conclusions" class="summary-section">
            <span class="section-tag">核心结论</span>
            <p class="section-text">{{ aiStore.minutes.conclusions }}</p>
          </div>
          <div v-if="aiStore.agendaTopics.length > 0" class="summary-section">
            <span class="section-tag">核心议题 ({{ aiStore.agendaTopics.length }})</span>
            <ul class="topics-list">
              <li v-for="(topic, i) in aiStore.agendaTopics" :key="i">
                <strong>{{ topic.title }}：</strong>{{ topic.discussionSummary }}
              </li>
            </ul>
          </div>
        </div>
        <div v-else class="copilot-empty compact">
          <p class="empty-title">尚未生成 AI 会议纪要</p>
          <p class="empty-desc">点击右上角「生成/更新纪要」，将自动调度多 Agent 提炼议题、决议与待办。</p>
        </div>

        <!-- 待办任务卡片 -->
        <div v-if="aiStore.actionItems.length > 0" class="summary-card">
          <div class="card-head-row">
            <span class="section-tag">待办事项 ({{ aiStore.actionItems.length }})</span>
            <button type="button" class="link-btn" @click="emit('openWorkspace', 'actionItems')">
              管理待办
            </button>
          </div>
          <div
            v-for="item in aiStore.actionItems"
            :key="item.actionId"
            class="action-item-row"
            :class="{ 'is-done': item.status === 'DONE' }"
          >
            <button
              type="button"
              class="action-toggle-btn"
              :class="{ checked: item.status === 'DONE' }"
              :disabled="updatingActionId === item.actionId"
              :title="item.status === 'DONE' ? '标为待办' : '标为已完成'"
              @click="handleToggleActionDone(item)"
            >
              <MeetingIcon :name="item.status === 'DONE' ? 'check_circle' : 'radio_button_unchecked'" :size="15" />
            </button>
            <div class="action-item-content">
              <span class="action-text" :class="{ done: item.status === 'DONE' }">{{ item.content }}</span>
              <span class="action-meta">
                负责人: {{ item.assigneeName || item.assigneeUserId || '待分配' }}
                <template v-if="item.dueTime"> · 截止 {{ item.dueTime }}</template>
              </span>
            </div>
          </div>
        </div>

        <!-- 实时识别的行业术语 -->
        <div class="summary-card">
          <div class="card-head-row">
            <span class="section-tag">识别行业术语 ({{ aiStore.meetingTerms.length }})</span>
            <div class="card-head-actions">
              <button
                type="button"
                class="link-btn"
                :disabled="aiStore.terminologyAnalyzing"
                @click="aiStore.triggerMeetingTermAnalysis({}, meetingId)"
              >
                {{ aiStore.terminologyAnalyzing ? '识别中...' : '同步识别' }}
              </button>
              <button type="button" class="link-btn" @click="emit('openWorkspace', 'terminology')">
                三层解释
              </button>
            </div>
          </div>
          <div v-if="aiStore.meetingTerms.length > 0" class="terms-chips">
            <button
              v-for="term in aiStore.meetingTerms.slice(0, 8)"
              :key="term.occurrenceId || term.explanationId || term.surface"
              type="button"
              class="term-chip"
              :class="{ conflict: term.ambiguityStatus === 'CONFLICT_DUAL' }"
              @click="emit('openWorkspace', 'terminology')"
            >
              <span>{{ term.surface || term.canonicalName }}</span>
              <span v-if="term.ambiguityStatus === 'CONFLICT_DUAL'" class="term-conflict-dot">口径冲突</span>
            </button>
          </div>
          <p v-else class="empty-inline-hint">暂未检测到行业术语，可点击「同步识别」基于当前转写提取。</p>
        </div>
      </template>
    </div>

    <!-- 内联 Copilot 智能问答回复卡片（提问后显示） -->
    <div v-if="qaDrawerVisible && qaMessages.length > 0" class="qa-inline-drawer">
      <div class="qa-inline-head">
        <span class="qa-inline-title">
          <MeetingIcon name="auto_awesome" :size="14" />
          EasyCopilot 实时回答
        </span>
        <div class="qa-inline-actions">
          <button type="button" class="link-btn" @click="emit('openWorkspace', 'qa')">
            完整问答
          </button>
          <button type="button" class="qa-close-btn" @click="qaDrawerVisible = false">
            <MeetingIcon name="close" :size="14" />
          </button>
        </div>
      </div>

      <div class="qa-inline-list dark-scroll" ref="qaBoxRef">
        <div
          v-for="(item, idx) in qaMessages"
          :key="idx"
          class="qa-msg-row"
          :class="{ 'is-user': item.role === 'user' }"
        >
          <div class="qa-msg-bubble">
            <span v-if="item.loading" class="qa-loading-text">
              <a-spin size="small" /> 正在检索会议上下文...
            </span>
            <span v-else-if="item.error" class="qa-error-text">{{ item.error }}</span>
            <template v-else>
              <p class="qa-answer-text">{{ item.text }}</p>
              <div v-if="item.evidenceList?.length" class="qa-evidence">
                <span>引自 {{ item.evidenceList[0].speakerName }}：</span>
                <em>“{{ item.evidenceList[0].quoteText }}”</em>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部快捷 AI 交互栏 -->
    <div class="copilot-dock">
      <div class="prompt-input-wrap">
        <MeetingIcon name="prompt_suggestion" :size="16" class="prompt-icon" />
        <input
          v-model="qaInputText"
          type="text"
          class="prompt-input"
          placeholder="向 EasyCopilot 发问或指令（如：总结当前共识）..."
          @keydown.enter.prevent="handleSendQa"
        />
        <button
          type="button"
          class="prompt-send-btn"
          :disabled="asking || !qaInputText.trim()"
          @click="handleSendQa"
        >
          {{ asking ? '...' : '发送' }}
        </button>
      </div>

      <div class="dock-quick-actions">
        <button
          type="button"
          class="dock-action-btn"
          :disabled="aiStore.isAnalyzing"
          @click="handleQuickMinutes"
        >
          <MeetingIcon name="bookmark_add" :size="14" class="icon-primary" />
          <span>截录入纪要</span>
        </button>

        <button
          type="button"
          class="dock-action-btn"
          @click="handleExportTodos"
        >
          <MeetingIcon name="fact_check" :size="14" class="icon-green" />
          <span>导出待办清单</span>
        </button>

        <a-dropdown placement="topRight" trigger="click">
          <button type="button" class="dock-more-btn" title="更多 AI 工具">
            <MeetingIcon name="more_horiz" :size="16" />
          </button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="workspace-agents" @click="emit('openWorkspace', 'agents')">
                打开 Agent 工作台
              </a-menu-item>
              <a-menu-item key="workspace-terms" @click="emit('openWorkspace', 'terminology')">
                行业术语智能理解
              </a-menu-item>
              <a-menu-item key="workspace-decisions" @click="emit('openWorkspace', 'decisions')">
                会中决策演进脑图
              </a-menu-item>
              <a-menu-item key="toggle-asr" @click="emit('toggleTranscription')">
                {{ isTranscribing ? '停止实时转写' : '开启实时转写' }}
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="external" @click="openInExternalTab">
                在新标签页打开完整工作台
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- 人工修正转写片段弹窗 -->
    <a-modal
      v-model:open="reviseModalVisible"
      title="修正实时转写文本"
      :confirm-loading="submittingRevise"
      @ok="handleReviseSubmit"
    >
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="原始转写文本">
          <div class="revise-origin-box">
            {{ activeSegment?.originalText || activeSegment?.currentText || activeSegment?.text }}
          </div>
        </a-form-item>
        <a-form-item label="更正后文本" required>
          <a-textarea v-model:value="reviseForm.revisedText" :rows="3" placeholder="请输入更正后的文本..." />
        </a-form-item>
        <a-form-item label="修改备注">
          <a-input v-model:value="reviseForm.revisionReason" placeholder="例如：专有名词修正" />
        </a-form-item>
      </a-form>
    </a-modal>
  </aside>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import MeetingIcon from '@/components/meeting/MeetingIcon.vue'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useMeetingStore } from '@/stores/meeting'
import { useAuthStore } from '@/stores/auth'
import {
  askMeetingQa,
  askTermKnowledge,
  reviseTranscriptSegment,
  updateActionItem
} from '@/api/meetingAi'
import { copyText } from '@/utils/format'
import {
  getSpeakerTheme,
  getSpeakerInitial,
  formatTranscriptMs,
  resolveSpeakerAvatarUrl
} from '@/utils/transcript'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  },
  segments: {
    type: Array,
    default: () => []
  },
  isTranscribing: {
    type: Boolean,
    default: false
  },
  startingSession: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggleTranscription', 'openWorkspace', 'segmentRevised'])

const router = useRouter()
const aiStore = useMeetingAiStore()
const meetingStore = useMeetingStore()
const authStore = useAuthStore()

const activeTab = ref('transcript')
const filteredSpeaker = ref('')
const focusedKey = ref(null)
const scrollContainerRef = ref(null)

const avatarVersion = Date.now()
const failedAvatarUrls = reactive(new Set())

// Q&A 状态
const qaInputText = ref('')
const asking = ref(false)
const qaMessages = ref([])
const qaDrawerVisible = ref(false)
const qaBoxRef = ref(null)

// 文本修正弹窗
const reviseModalVisible = ref(false)
const submittingRevise = ref(false)
const activeSegment = ref(null)
const updatingActionId = ref('')
const reviseForm = reactive({
  revisedText: '',
  revisionReason: ''
})

const filteredSegments = computed(() => {
  const list = props.segments || []
  if (!filteredSpeaker.value) return list
  return list.filter((s) => (s.speakerName || '参会发言人') === filteredSpeaker.value)
})

const summaryBadgeCount = computed(() => {
  return (aiStore.decisions?.length || 0) + (aiStore.actionItems?.length || 0)
})

const consensusMetaText = computed(() => {
  if (aiStore.isAnalyzing) return '多 Agent 推演中'
  if (aiStore.confirmedDecisions.length > 0) {
    return `已确认 ${aiStore.confirmedDecisions.length} 项`
  }
  if (aiStore.minutes?.createTime) return '纪要已同步'
  return props.isTranscribing ? '实时监听中' : '等待触发'
})

const consensusSummaryText = computed(() => {
  if (aiStore.confirmedDecisions.length > 0) {
    const latest = aiStore.confirmedDecisions[0]
    return `已达成共识：${latest.topic || latest.content}`
  }
  if (aiStore.minutes?.conclusions) {
    return aiStore.minutes.conclusions
  }
  if (aiStore.minutes?.summary) {
    return aiStore.minutes.summary
  }
  if (aiStore.decisions.length > 0) {
    const first = aiStore.decisions[0]
    return `当前聚焦议题「${first.topic || first.content}」，正在汇聚各方观点与证据链。`
  }
  return '开启实时转写或点击下方「截录入纪要」后，EasyCopilot 将自动提炼阶段共识、决议与待办清单。'
})

function getSegKey(seg, idx) {
  return seg?.segmentId || `live-${idx}`
}

function getItemVars(seg) {
  const theme = getSpeakerTheme(seg?.speakerName || '参会发言人')
  return {
    '--speaker-color': theme.color,
    '--speaker-tint-border': theme.tintBorder,
    '--speaker-glow': theme.glow
  }
}

function getAvatarSrc(seg) {
  const url = resolveSpeakerAvatarUrl(seg, meetingStore.memberList, avatarVersion)
  if (!url || failedAvatarUrls.has(url)) return undefined
  return url
}

function handleAvatarError(seg) {
  const url = resolveSpeakerAvatarUrl(seg, meetingStore.memberList, avatarVersion)
  if (url) failedAvatarUrls.add(url)
  return true
}

function isSelfSpeaker(seg) {
  if (!seg || !authStore.userId) return false
  const speakerUid = seg.speakerUserId || seg.userId
  if (speakerUid && String(speakerUid) === String(authStore.userId)) {
    return true
  }
  return seg.speakerName && seg.speakerName === authStore.nickName
}

function toggleSpeakerFilter(name) {
  if (!name) return
  filteredSpeaker.value = filteredSpeaker.value === name ? '' : name
}

function handleItemTap(seg, idx) {
  const selectedText = window.getSelection?.()?.toString()
  if (selectedText) return
  const key = getSegKey(seg, idx)
  focusedKey.value = focusedKey.value === key ? null : key
}

async function handleCopySeg(seg) {
  const text = seg.currentText || seg.text || seg.originalText || ''
  if (!text) return
  const ok = await copyText(text)
  if (ok) {
    message.success('已复制该句转写内容')
  }
}

function openReviseModal(seg) {
  activeSegment.value = seg
  reviseForm.revisedText = seg.currentText || seg.text || seg.originalText || ''
  reviseForm.revisionReason = ''
  reviseModalVisible.value = true
}

async function handleReviseSubmit() {
  if (!reviseForm.revisedText.trim()) {
    message.warning('更正后文本不能为空')
    return
  }
  submittingRevise.value = true
  try {
    const updated = await reviseTranscriptSegment({
      segmentId: activeSegment.value.segmentId,
      meetingId: props.meetingId,
      revisedText: reviseForm.revisedText.trim(),
      revisionReason: reviseForm.revisionReason.trim()
    })
    message.success('转写文本已修正')
    reviseModalVisible.value = false
    if (updated) {
      emit('segmentRevised', updated)
    } else {
      emit('segmentRevised', {
        ...activeSegment.value,
        currentText: reviseForm.revisedText.trim(),
        isRevised: 1
      })
    }
  } catch (err) {
    message.error(err.message || '保存修正失败')
  } finally {
    submittingRevise.value = false
  }
}

function formatDecisionStatus(status) {
  switch (status) {
    case 'CONFIRMED':
      return '共识达成'
    case 'DISCUSSING':
      return '讨论中'
    case 'PROPOSED':
    case 'PENDING':
      return '候选待定'
    case 'DEFERRED':
      return '暂缓'
    case 'REJECTED':
      return '已否决'
    default:
      return status || '进行中'
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
    message.success(nextStatus === 'DONE' ? '待办已标记完成' : '待办已恢复为未完成')
  } catch (err) {
    message.error(err.message || '更新待办状态失败')
  } finally {
    updatingActionId.value = ''
  }
}

async function handleSendQa() {
  const text = qaInputText.value.trim()
  if (!text || asking.value) return

  qaDrawerVisible.value = true
  qaMessages.value.push({ role: 'user', text })
  qaInputText.value = ''

  const aiIdx = qaMessages.value.length
  qaMessages.value.push({
    role: 'ai',
    text: '',
    loading: true,
    error: null,
    evidenceList: []
  })

  asking.value = true
  nextTick(() => {
    if (qaBoxRef.value) {
      qaBoxRef.value.scrollTop = qaBoxRef.value.scrollHeight
    }
  })

  try {
    if (text.startsWith('/术语') || text.startsWith('术语:') || text.startsWith('术语：')) {
      const cleanTerm = text.replace(/^(\/术语|术语[:：])\s*/i, '').trim() || text
      const res = await askTermKnowledge({
        query: cleanTerm,
        meetingId: props.meetingId,
        domainHint: aiStore.featureConfig.domainHint || undefined,
        targetLang: aiStore.featureConfig.preferredLang || 'zh'
      })
      qaMessages.value[aiIdx].loading = false
      const summary = [
        res?.standardName ? `【${res.standardName}${res.domain ? ` · ${res.domain}` : ''}】` : '',
        res?.plainExplanation || res?.definition || res?.contextMeaning || res?.answer || '已完成术语解析'
      ]
        .filter(Boolean)
        .join(' ')
      qaMessages.value[aiIdx].text = summary
      qaMessages.value[aiIdx].evidenceList = []
    } else {
      const res = await askMeetingQa({
        meetingId: props.meetingId,
        question: text
      })
      qaMessages.value[aiIdx].loading = false
      qaMessages.value[aiIdx].text = res?.answer || '暂无相关会议记录回答'
      qaMessages.value[aiIdx].evidenceList = res?.evidenceList || []
    }
  } catch (err) {
    qaMessages.value[aiIdx].loading = false
    qaMessages.value[aiIdx].error = err.message || '提问失败'
  } finally {
    asking.value = false
    nextTick(() => {
      if (qaBoxRef.value) {
        qaBoxRef.value.scrollTop = qaBoxRef.value.scrollHeight
      }
    })
  }
}

function handleQuickMinutes() {
  activeTab.value = 'summary'
  aiStore.triggerAnalysis(props.meetingId, true)
}

async function handleExportTodos() {
  const items = aiStore.actionItems || []
  if (items.length === 0) {
    activeTab.value = 'summary'
    message.info('暂无待办事项，可先点击「截录入纪要」由 AI 自动提取待办')
    return
  }

  const title = meetingStore.meetingInfo?.meetingName || 'EasyMeeting 会议'
  const lines = [
    `# ${title} - 待办事项清单`,
    '',
    ...items.map((item, i) => {
      const assignee = item.assigneeName || item.assigneeUserId || '待指定'
      const due = item.dueTime ? ` (截止: ${item.dueTime})` : ''
      return `${i + 1}. [${item.status || 'OPEN'}] ${item.content} — 负责人: ${assignee}${due}`
    })
  ]
  const ok = await copyText(lines.join('\n'))
  if (ok) {
    message.success(`已复制 ${items.length} 条待办清单到剪贴板`)
  } else {
    emit('openWorkspace', 'actionItems')
  }
}

function openInExternalTab() {
  const routeUrl = router.resolve(`/meeting/ai/${props.meetingId}`)
  const fullUrl = window.location.origin + routeUrl.href
  const newWin = window.open(fullUrl, '_blank', 'noopener,noreferrer')
  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    emit('openWorkspace', 'agents')
    message.info('浏览器阻止了弹窗，已为您打开内置工作台')
  }
}

watch(
  () => props.segments?.length,
  () => {
    if (activeTab.value === 'transcript') {
      nextTick(() => {
        if (scrollContainerRef.value) {
          scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
        }
      })
    }
  }
)
</script>

<style scoped>
.copilot-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: rgba(226, 226, 226, 0.08);
  border: 1px solid rgba(193, 198, 215, 0.12);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.35);
}

.copilot-header {
  padding: 10px 12px;
  background: rgba(226, 226, 226, 0.06);
  border-bottom: 1px solid rgba(193, 198, 215, 0.1);
  flex-shrink: 0;
}

.copilot-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.copilot-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.brand-icon {
  color: #006ef2;
}

.brand-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f1f1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(193, 198, 215, 0.2);
  background: rgba(226, 226, 226, 0.1);
  color: #c1c6d7;
  font-size: 11px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.live-status-pill:hover {
  border-color: rgba(136, 253, 84, 0.45);
  color: #f1f1f1;
}

.live-status-pill.active {
  background: rgba(136, 253, 84, 0.12);
  border-color: rgba(136, 253, 84, 0.35);
  color: #88fd54;
}

.status-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8c93a5;
}

.status-pulse.active {
  background: #88fd54;
  box-shadow: 0 0 8px rgba(136, 253, 84, 0.8);
  animation: copilot-pulse 1.5s infinite ease-in-out;
}

@keyframes copilot-pulse {
  0%, 100% { opacity: 0.7; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.25); }
}

.copilot-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 3px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.14);
  gap: 4px;
}

.copilot-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c1c6d7;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copilot-tab-btn:hover {
  color: #f1f1f1;
}

.copilot-tab-btn.active {
  background: #242529;
  color: #f1f1f1;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
}

.tab-count-pill {
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #c1c6d7;
  font-size: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

.tab-count-pill.accent {
  background: rgba(0, 110, 242, 0.24);
  color: #afc6ff;
}

.copilot-scroll-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 共识卡片 */
.consensus-card {
  background: rgba(0, 110, 242, 0.12);
  border: 1px solid rgba(175, 198, 255, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.consensus-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.consensus-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #afc6ff;
}

.consensus-meta {
  font-size: 10.5px;
  color: #c1c6d7;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

.consensus-body {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(241, 241, 241, 0.92);
}

.speaker-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 110, 242, 0.16);
  border: 1px solid rgba(175, 198, 255, 0.25);
  font-size: 12px;
  color: #f1f1f1;
}

.clear-filter-btn {
  border: none;
  background: transparent;
  color: #afc6ff;
  font-size: 11px;
  cursor: pointer;
}

.clear-filter-btn:hover {
  text-decoration: underline;
}

.copilot-empty {
  padding: 26px 16px;
  border-radius: 10px;
  border: 1px dashed rgba(193, 198, 215, 0.2);
  background: rgba(255, 255, 255, 0.03);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.copilot-empty.compact {
  padding: 20px 14px;
}

.empty-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #f1f1f1;
}

.empty-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #c1c6d7;
}

.empty-start-btn {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  background: #006ef2;
  color: #fefcff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.empty-start-btn:hover {
  background: #0057c2;
}

/* =====================================================
   保留的转写头像 + 尖角气泡时间轴（深色主题适配）
   ===================================================== */
.live-timeline {
  display: flex;
  flex-direction: column;
}

.live-timeline-item {
  position: relative;
  display: flex;
  align-items: stretch;
  padding-bottom: 14px;
  transition: opacity 0.22s ease;
  z-index: 1;
}

.live-timeline-item.is-last {
  padding-bottom: 4px;
}

.live-timeline-item.is-focused {
  z-index: 10;
}

.live-axis {
  position: relative;
  width: 16px;
  flex-shrink: 0;
  margin-right: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.live-axis-top,
.live-axis-bottom {
  width: 2px;
  background: rgba(193, 198, 215, 0.2);
}

.live-axis-top {
  height: 13px;
  flex-shrink: 0;
}

.live-axis-bottom {
  flex: 1;
  min-height: 12px;
}

.live-timeline-item.is-first .live-axis-top,
.live-timeline-item.is-last .live-axis-bottom {
  opacity: 0;
}

.live-axis-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #242529;
  border: 2.5px solid var(--speaker-color, #006ef2);
  flex-shrink: 0;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.22s ease,
    box-shadow 0.28s ease;
}

.live-axis-connector {
  position: absolute;
  left: 12px;
  top: 17px;
  width: 8px;
  height: 2px;
  border-radius: 2px;
  background: var(--speaker-color, #006ef2);
  opacity: 0;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.24s ease, opacity 0.2s ease;
}

.live-avatar-col {
  flex-shrink: 0;
  padding-top: 1px;
  margin-right: 10px;
}

.live-avatar-wrap {
  position: relative;
  display: inline-flex;
  border-radius: 50%;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35), 0 0 0 2px rgba(48, 48, 48, 0.95);
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.28s ease;
}

.live-avatar {
  color: #ffffff;
  font-weight: 600;
  user-select: none;
  border: none;
}

.live-playing-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #88fd54;
  border: 2px solid #242529;
  animation: copilot-pulse 1.5s infinite ease-in-out;
}

.live-speech-bubble {
  --bubble-bg: #25272d;
  --bubble-border: rgba(193, 198, 215, 0.16);
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  border-radius: 6px 14px 14px 14px;
  padding: 9px 12px 8px 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  transform: translate3d(0, 0, 0) scale(1);
  transform-origin: left center;
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.28s ease,
    border-color 0.22s ease,
    background-color 0.22s ease;
}

/* 左侧指向说话人头像的尖角 */
.live-speech-bubble::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 13px;
  width: 9px;
  height: 9px;
  background: var(--bubble-bg);
  border-left: 1px solid var(--bubble-border);
  border-bottom: 1px solid var(--bubble-border);
  border-bottom-left-radius: 2px;
  transform: rotate(45deg);
  transition: background-color 0.22s ease, border-color 0.22s ease;
  z-index: 1;
}

.live-timeline-item.is-self .live-speech-bubble {
  --bubble-bg: rgba(0, 110, 242, 0.14);
  --bubble-border: rgba(175, 198, 255, 0.28);
}

.live-timeline-item.is-live .live-speech-bubble {
  --bubble-border: rgba(0, 110, 242, 0.45);
}

.live-bubble-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.live-seg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.bubble-speaker-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.speaker-name-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.speaker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--speaker-color, #006ef2);
  flex-shrink: 0;
}

.speaker-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #f1f1f1;
  transition: color 0.2s ease;
}

.speaker-name-btn:hover .speaker-name {
  color: #afc6ff;
}

.role-badge.self-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 4px;
  color: #afc6ff;
  background: rgba(0, 110, 242, 0.22);
  border: 1px solid rgba(175, 198, 255, 0.3);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 999px;
}

.revised-pill {
  color: #ffba45;
  background: rgba(157, 106, 0, 0.22);
  border: 1px solid rgba(255, 186, 69, 0.3);
}

.syncing-pill {
  color: #88fd54;
  background: rgba(136, 253, 84, 0.14);
  border: 1px solid rgba(136, 253, 84, 0.28);
}

.time-pill {
  font-size: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  color: #afc6ff;
  background: rgba(0, 110, 242, 0.16);
  border: 1px solid rgba(175, 198, 255, 0.22);
  padding: 1px 6px;
  border-radius: 999px;
}

.live-seg-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(241, 241, 241, 0.92);
  word-break: break-word;
  white-space: pre-wrap;
}

.live-bubble-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: opacity 0.2s ease, max-height 0.2s ease;
}

.live-timeline-item:hover .live-bubble-actions,
.live-timeline-item.is-focused .live-bubble-actions {
  opacity: 1;
  max-height: 24px;
}

.bubble-mini-btn {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #c1c6d7;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.bubble-mini-btn:hover {
  background: rgba(0, 110, 242, 0.28);
  color: #ffffff;
}

@media (hover: hover) {
  .live-timeline:hover .live-timeline-item:not(:hover):not(.is-focused) {
    opacity: 0.84;
  }

  .live-timeline-item:hover {
    z-index: 12;
    opacity: 1;
  }

  .live-timeline-item:hover .live-axis-dot {
    background: var(--speaker-color, #006ef2);
    border-color: #f1f1f1;
    transform: scale(1.38);
    box-shadow: 0 0 0 4px var(--speaker-glow, rgba(0, 110, 242, 0.26));
  }

  .live-timeline-item:hover .live-axis-connector {
    opacity: 0.85;
    transform: scaleX(1);
  }

  .live-timeline-item:hover .live-avatar-wrap {
    transform: translateY(-2px) scale(1.1);
    box-shadow:
      0 6px 14px var(--speaker-glow, rgba(0, 110, 242, 0.25)),
      0 0 0 2px #242529,
      0 0 0 3.5px var(--speaker-tint-border, #afc6ff);
  }

  .live-timeline-item:hover .live-speech-bubble {
    --bubble-border: var(--speaker-tint-border, #69b1ff);
    transform: translate3d(4px, -3px, 0) scale(1.014);
    box-shadow:
      0 14px 28px -8px rgba(0, 0, 0, 0.45),
      0 6px 14px -4px var(--speaker-glow, rgba(0, 110, 242, 0.24));
  }
}

.live-timeline-item.is-focused .live-axis-dot {
  background: var(--speaker-color, #006ef2);
  border-color: #f1f1f1;
  transform: scale(1.32);
}

.live-timeline-item.is-focused .live-speech-bubble {
  --bubble-border: var(--speaker-tint-border, #69b1ff);
  transform: translate3d(3px, -2px, 0) scale(1.01);
}

/* 智能决策提要 */
.milestones-box {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.milestones-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 500;
  color: #c1c6d7;
}

.link-btn {
  border: none;
  background: transparent;
  color: #afc6ff;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.milestone-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.08);
  cursor: pointer;
  transition: background 0.18s ease;
}

.milestone-row:hover {
  background: rgba(226, 226, 226, 0.14);
}

.milestone-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-size: 12px;
  color: #f1f1f1;
}

.milestone-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #006ef2;
  flex-shrink: 0;
}

.milestone-dot.confirmed {
  background: #88fd54;
}

.milestone-dot.discussing {
  background: #ffba45;
}

.milestone-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.mini-confirm-btn {
  border: 1px solid rgba(136, 253, 84, 0.38);
  background: rgba(38, 109, 0, 0.28);
  color: #88fd54;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.mini-confirm-btn:hover {
  background: rgba(38, 109, 0, 0.55);
  color: #ffffff;
}

.milestone-status {
  font-size: 10.5px;
  color: #c1c6d7;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  flex-shrink: 0;
}

/* Tab 2: AI 纪要 */
.summary-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.07);
}

.summary-toolbar-actions,
.card-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.summary-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #c1c6d7;
}

.summary-card {
  padding: 12px;
  border-radius: 10px;
  background: rgba(226, 226, 226, 0.07);
  border: 1px solid rgba(193, 198, 215, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-card-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: #f1f1f1;
}

.summary-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-tag {
  font-size: 11.5px;
  font-weight: 600;
  color: #afc6ff;
}

.section-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(241, 241, 241, 0.88);
}

.topics-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(241, 241, 241, 0.88);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-item-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.action-item-row.is-done {
  opacity: 0.72;
}

.action-toggle-btn {
  border: none;
  background: transparent;
  padding: 0;
  color: #9ba3b8;
  cursor: pointer;
  margin-top: 1px;
  display: flex;
  align-items: center;
  transition: color 0.16s ease;
}

.action-toggle-btn:hover:not(:disabled),
.action-toggle-btn.checked {
  color: #88fd54;
}

.action-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.action-text {
  font-size: 12px;
  color: #f1f1f1;
  line-height: 1.45;
}

.action-text.done {
  text-decoration: line-through;
  color: #9ba3b8;
}

.empty-inline-hint {
  margin: 0;
  font-size: 11.5px;
  color: #9ba3b8;
  line-height: 1.45;
}

.action-meta {
  font-size: 11px;
  color: #c1c6d7;
}

.terms-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.term-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(175, 198, 255, 0.25);
  background: rgba(0, 110, 242, 0.14);
  color: #f1f1f1;
  font-size: 11px;
  cursor: pointer;
}

.term-chip.conflict {
  border-color: rgba(255, 186, 69, 0.45);
  background: rgba(157, 106, 0, 0.24);
}

.term-conflict-dot {
  font-size: 10px;
  color: #ffba45;
}

/* 内联 Copilot 问答抽屉 */
.qa-inline-drawer {
  border-top: 1px solid rgba(193, 198, 215, 0.14);
  background: #23252a;
  display: flex;
  flex-direction: column;
  max-height: 180px;
  flex-shrink: 0;
}

.qa-inline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(193, 198, 215, 0.1);
}

.qa-inline-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: #afc6ff;
}

.qa-inline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qa-close-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}

.qa-inline-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qa-msg-row {
  display: flex;
}

.qa-msg-row.is-user {
  justify-content: flex-end;
}

.qa-msg-bubble {
  max-width: 88%;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #f1f1f1;
  font-size: 12px;
  line-height: 1.5;
}

.qa-msg-row.is-user .qa-msg-bubble {
  background: #006ef2;
  color: #fefcff;
}

.qa-answer-text {
  margin: 0;
}

.qa-evidence {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed rgba(193, 198, 215, 0.2);
  font-size: 11px;
  color: #c1c6d7;
}

.qa-error-text {
  color: #ff8a8a;
}

/* 底部快捷 AI 交互栏 */
.copilot-dock {
  padding: 10px 10px 10px 10px;
  background: rgba(226, 226, 226, 0.08);
  border-top: 1px solid rgba(193, 198, 215, 0.12);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.prompt-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.prompt-icon {
  position: absolute;
  left: 9px;
  color: #c1c6d7;
  pointer-events: none;
}

.prompt-input {
  width: 100%;
  height: 34px;
  padding: 0 58px 0 30px;
  border-radius: 7px;
  border: 1px solid rgba(193, 198, 215, 0.16);
  background: #23252a;
  color: #f1f1f1;
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.prompt-input::placeholder {
  color: #9ba1b2;
}

.prompt-input:focus {
  border-color: #006ef2;
  box-shadow: 0 0 0 2px rgba(0, 110, 242, 0.25);
}

.prompt-send-btn {
  position: absolute;
  right: 5px;
  height: 24px;
  padding: 0 9px;
  border: none;
  border-radius: 5px;
  background: #006ef2;
  color: #fefcff;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s ease, opacity 0.18s ease;
}

.prompt-send-btn:hover:not(:disabled) {
  background: #0057c2;
}

.prompt-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dock-quick-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dock-action-btn {
  flex: 1;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(226, 226, 226, 0.14);
  color: #f1f1f1;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.dock-action-btn:hover:not(:disabled) {
  background: rgba(226, 226, 226, 0.24);
}

.dock-action-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.icon-primary {
  color: #006ef2;
}

.icon-green {
  color: #88fd54;
}

.dock-more-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(226, 226, 226, 0.14);
  color: #c1c6d7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
}

.dock-more-btn:hover {
  background: rgba(226, 226, 226, 0.24);
  color: #f1f1f1;
}

.revise-origin-box {
  padding: 10px 12px;
  border-radius: 6px;
  background: #f5f7fa;
  color: #4e5969;
  font-size: 13px;
  line-height: 1.5;
}
</style>
