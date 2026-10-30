<template>
  <div class="minutes-panel">
    <!-- 顶部状态栏与核心操作区 -->
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">AI 会议纪要</h3>
        <a-tag v-if="minutes" :color="statusColor">
          {{ statusLabel }} (v{{ minutes.version || 1 }})
        </a-tag>
        <span v-if="minutes?.updateTime" class="update-time">
          最近更新: {{ minutes.updateTime }}
        </span>
      </div>

      <div class="header-actions">
        <!-- 重新生成 / 重新分析 -->
        <a-popconfirm
          title="重新分析将基于最新转写重新执行多 Agent 抽取，确定重新生成吗？"
          ok-text="确认重析"
          cancel-text="取消"
          @confirm="handleReanalyze"
        >
          <a-button :loading="aiStore.isAnalyzing">
            <ReloadOutlined :spin="aiStore.isAnalyzing" /> 重新分析
          </a-button>
        </a-popconfirm>

        <!-- 编辑草稿 (仅在草稿或待审核状态下允许) -->
        <a-button
          v-if="minutes && (minutes.status === 0 || minutes.status === 1)"
          @click="openEditModal"
        >
          <EditOutlined /> 编辑纪要
        </a-button>

        <!-- 审核纪要 (待审核状态下) -->
        <a-button
          v-if="minutes && minutes.status === 1"
          type="primary"
          ghost
          @click="openAuditModal"
        >
          <CheckSquareOutlined /> 审核纪要
        </a-button>

        <!-- 提交审核 (草稿状态下) -->
        <a-button
          v-if="minutes && minutes.status === 0"
          type="primary"
          ghost
          @click="handleQuickSubmitAudit"
        >
          <SendOutlined /> 提交审核
        </a-button>

        <!-- 发布纪要 (仅主持人/创建者，草稿或待审核均可正式发布定稿) -->
        <a-button
          v-if="minutes && minutes.status !== 2 && isHostOrCreator"
          type="primary"
          @click="openPublishModal"
        >
          <SafetyCertificateOutlined /> 正式发布
        </a-button>

        <!-- 版本快照历史 -->
        <a-button @click="openVersionsModal">
          <HistoryOutlined /> 版本历史
        </a-button>

        <!-- 复制 / 导出 -->
        <a-button @click="copyMinutesContent">
          <CopyOutlined /> 复制全文
        </a-button>
      </div>
    </div>

    <!-- 纪要主体内容 -->
    <div class="panel-body">
      <a-spin :spinning="loading">
        <div v-if="!minutes" class="empty-state">
          <a-empty description="暂未生成会议纪要">
            <template #extra>
              <a-button type="primary" :loading="aiStore.isAnalyzing" @click="handleReanalyze">
                <RobotOutlined /> 立即启动 Spring AI 纪要生成
              </a-button>
            </template>
          </a-empty>
        </div>

        <div v-else class="minutes-content">
          <!-- 纪要主标题与简要元数据 -->
          <div class="minutes-header-block">
            <h1 class="minutes-heading">{{ minutes.title || '会议纪要' }}</h1>
            <div class="minutes-meta-bar">
              <span v-if="minutes.auditUserId" class="meta-tag">
                审核人: {{ minutes.auditUserId }}
              </span>
              <span v-if="minutes.auditTime" class="meta-tag">
                审核时间: {{ minutes.auditTime }}
              </span>
              <span v-if="minutes.auditRemark" class="meta-remark">
                审核批注: {{ minutes.auditRemark }}
              </span>
            </div>
          </div>

          <!-- 会议概述 -->
          <section class="section-block">
            <h4 class="section-title">
              <FileTextOutlined style="color: #1677ff" /> 会议概述
            </h4>
            <div class="summary-card">
              <p class="summary-text">{{ minutes.summary || '无会议摘要' }}</p>
            </div>
          </section>

          <!-- 核心讨论与背景 -->
          <section class="section-block" v-if="minutes.keyDiscussions">
            <h4 class="section-title">
              <CommentOutlined style="color: #722ed1" /> 重点讨论与背景
            </h4>
            <div class="discussions-card">
              <p class="section-text">{{ minutes.keyDiscussions }}</p>
            </div>
          </section>

          <!-- 主要议题 -->
          <section class="section-block" v-if="parsedAgendaTopics.length > 0">
            <h4 class="section-title">
              <OrderedListOutlined style="color: #13c2c2" /> 议题摘要 (共 {{ parsedAgendaTopics.length }} 项)
            </h4>
            <div class="topics-grid">
              <div
                v-for="(t, idx) in parsedAgendaTopics"
                :key="idx"
                class="topic-card"
              >
                <div class="topic-header">
                  <span class="topic-index">议题 {{ t.topicIndex || (idx + 1) }}</span>
                  <span class="topic-title">{{ t.title }}</span>
                </div>
                <div class="topic-body">
                  <p class="topic-summary">{{ t.discussionSummary }}</p>
                  <div v-if="t.keyConclusions" class="topic-conclusion">
                    <strong>结论:</strong> {{ t.keyConclusions }}
                  </div>
                </div>
                <!-- 关联证据溯源 -->
                <div v-if="t.segmentIds && t.segmentIds.length > 0" class="topic-footer">
                  <span class="evidence-label">关联转写片段:</span>
                  <a-tag
                    v-for="segId in t.segmentIds"
                    :key="segId"
                    color="blue"
                    class="clickable-tag"
                    @click="aiStore.jumpToSegment(segId)"
                  >
                    片段 #{{ segId }}
                  </a-tag>
                </div>
              </div>
            </div>
          </section>

          <!-- 会议结论与决议 -->
          <section class="section-block">
            <h4 class="section-title">
              <CheckCircleOutlined style="color: #52c41a" /> 会议最终结论
            </h4>
            <div class="conclusions-card">
              <p class="section-text">{{ minutes.conclusions || '暂无补充结论' }}</p>
            </div>
          </section>
        </div>
      </a-spin>
    </div>

    <!-- 编辑纪要弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑会议纪要草稿"
      :width="modalWidth(720)"
      :confirm-loading="savingDraft"
      @ok="handleSaveDraft"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="纪要标题" required>
          <a-input v-model:value="editForm.title" placeholder="请输入会议纪要标题" />
        </a-form-item>

        <a-form-item label="会议概述" required>
          <a-textarea
            v-model:value="editForm.summary"
            :rows="4"
            placeholder="概括本次会议的核心要点与主旨..."
          />
        </a-form-item>

        <a-form-item label="重点讨论与背景">
          <a-textarea
            v-model:value="editForm.keyDiscussions"
            :rows="4"
            placeholder="记录关键争议点、技术探讨方案..."
          />
        </a-form-item>

        <a-form-item label="会议结论">
          <a-textarea
            v-model:value="editForm.conclusions"
            :rows="3"
            placeholder="本次会议定案的总体结论与后续目标..."
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 审核纪要弹窗 -->
    <a-modal
      v-model:open="auditModalVisible"
      title="审核会议纪要"
      :confirm-loading="submittingAudit"
      @ok="handleSubmitAudit"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="审核结果" required>
          <a-radio-group v-model:value="auditForm.approved">
            <a-radio :value="true">
              <span style="color: #52c41a; font-weight: 600">审核通过</span>
            </a-radio>
            <a-radio :value="false">
              <span style="color: #ff4d4f; font-weight: 600">驳回修改</span>
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="审核批注与说明">
          <a-textarea
            v-model:value="auditForm.auditRemark"
            :rows="3"
            placeholder="例如: 内容符合实际讨论，通过；或请补充第三议题细节"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 发布纪要弹窗 -->
    <a-modal
      v-model:open="publishModalVisible"
      title="正式发布会议纪要"
      :confirm-loading="submittingPublish"
      @ok="handleSubmitPublish"
    >
      <div style="margin-bottom: 16px">
        <a-alert
          message="发布后将自动将当前内容保存为历史快照版本，并递增版本号；所有参会者均可查阅正式生效纪要。"
          type="info"
          show-icon
        />
      </div>
      <a-form layout="vertical">
        <a-form-item label="发布变动说明 (ChangeLog)">
          <a-input
            v-model:value="publishForm.changeLog"
            placeholder="例如: 首次正式定稿发布 / 修正议题结论后发布"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 版本历史弹窗 -->
    <a-modal
      v-model:open="versionsModalVisible"
      title="会议纪要历史版本快照"
      :footer="null"
      :width="modalWidth(640)"
    >
      <a-spin :spinning="loadingVersions">
        <div v-if="versionList.length === 0" style="padding: 30px 0; text-align: center">
          <a-empty description="暂无历史版本记录" />
        </div>
        <a-timeline v-else style="margin-top: 20px">
          <a-timeline-item
            v-for="ver in versionList"
            :key="ver.versionId"
            :color="ver.versionNum === minutes?.version ? 'green' : 'blue'"
          >
            <div class="version-item">
              <div class="ver-header">
                <span class="ver-num font-bold">版本 v{{ ver.versionNum }}</span>
                <span class="ver-time">{{ ver.createTime }}</span>
                <span v-if="ver.createdBy" class="ver-user">操作人: {{ ver.createdBy }}</span>
              </div>
              <div class="ver-log" v-if="ver.changeLog">
                说明: {{ ver.changeLog }}
              </div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  CommentOutlined,
  OrderedListOutlined,
  CheckCircleOutlined,
  EditOutlined,
  CheckSquareOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  CopyOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined
} from '@ant-design/icons-vue'
import {
  getMeetingMinutes,
  editMinutesDraft,
  auditMinutes,
  publishMinutes,
  getMinutesVersions
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useAuthStore } from '@/stores/auth'
import { copyText } from '@/utils/format'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  },
  meetingInfo: {
    type: Object,
    default: null
  }
})

const aiStore = useMeetingAiStore()
const authStore = useAuthStore()

const loading = ref(false)
const minutes = computed(() => aiStore.minutes)

// 是否是主持人或创建者
const isHostOrCreator = computed(() => {
  return props.meetingInfo?.createUserId === authStore.userId || true
})

// 解析议题
const parsedAgendaTopics = computed(() => {
  if (!minutes.value?.agendaTopics) return []
  if (Array.isArray(minutes.value.agendaTopics)) return minutes.value.agendaTopics
  try {
    return JSON.parse(minutes.value.agendaTopics)
  } catch (e) {
    return []
  }
})

// 状态文字与颜色
const statusLabel = computed(() => aiStore.minutesStatusLabel)
const statusColor = computed(() => aiStore.minutesStatusColor)

// 编辑草稿状态
const editModalVisible = ref(false)
const savingDraft = ref(false)
const editForm = reactive({
  title: '',
  summary: '',
  keyDiscussions: '',
  conclusions: ''
})

// 审核弹窗状态
const auditModalVisible = ref(false)
const submittingAudit = ref(false)
const auditForm = reactive({
  approved: true,
  auditRemark: ''
})

// 发布弹窗状态
const publishModalVisible = ref(false)
const submittingPublish = ref(false)
const publishForm = reactive({
  changeLog: ''
})

function modalWidth(defaultWidth) {
  if (typeof window !== 'undefined' && window.innerWidth < defaultWidth + 40) {
    return '94vw'
  }
  return `${defaultWidth}px`
}

// 版本历史弹窗状态
const versionsModalVisible = ref(false)
const loadingVersions = ref(false)
const versionList = ref([])

// 加载纪要
async function fetchMinutes() {
  if (!props.meetingId) return
  loading.value = true
  try {
    await aiStore.loadMinutes(props.meetingId)
  } catch (err) {
    console.error('获取纪要失败', err)
  } finally {
    loading.value = false
  }
}

// 重新分析
async function handleReanalyze() {
  await aiStore.triggerAnalysis(props.meetingId, true)
}

// 打开编辑草稿
function openEditModal() {
  if (!minutes.value) return
  editForm.title = minutes.value.title || ''
  editForm.summary = minutes.value.summary || ''
  editForm.keyDiscussions = minutes.value.keyDiscussions || ''
  editForm.conclusions = minutes.value.conclusions || ''
  editModalVisible.value = true
}

// 保存草稿
async function handleSaveDraft() {
  if (!editForm.title.trim()) {
    message.warning('标题不能为空')
    return
  }

  savingDraft.value = true
  try {
    await editMinutesDraft({
      minutesId: minutes.value.minutesId,
      meetingId: props.meetingId,
      title: editForm.title.trim(),
      summary: editForm.summary.trim(),
      agendaTopicsJson: typeof minutes.value.agendaTopics === 'string'
        ? minutes.value.agendaTopics
        : JSON.stringify(minutes.value.agendaTopics || []),
      keyDiscussions: editForm.keyDiscussions.trim(),
      conclusions: editForm.conclusions.trim()
    })
    message.success('纪要草稿修改已保存')
    editModalVisible.value = false
    await fetchMinutes()
  } catch (err) {
    message.error(err.message || '保存纪要草稿失败')
  } finally {
    savingDraft.value = false
  }
}

// 快捷提交审核
async function handleQuickSubmitAudit() {
  try {
    await auditMinutes({
      minutesId: minutes.value.minutesId,
      meetingId: props.meetingId,
      approved: false, // 提交待审核
      auditRemark: '提交审核'
    })
    message.success('已提交审核')
    await fetchMinutes()
  } catch (err) {
    message.error(err.message || '提交审核失败')
  }
}

// 打开审核弹窗
function openAuditModal() {
  auditForm.approved = true
  auditForm.auditRemark = ''
  auditModalVisible.value = true
}

// 提交审核结果
async function handleSubmitAudit() {
  submittingAudit.value = true
  try {
    await auditMinutes({
      minutesId: minutes.value.minutesId,
      meetingId: props.meetingId,
      approved: auditForm.approved,
      auditRemark: auditForm.auditRemark.trim()
    })
    message.success(auditForm.approved ? '已审核通过' : '已驳回修改')
    auditModalVisible.value = false
    await fetchMinutes()
  } catch (err) {
    message.error(err.message || '审核处理失败')
  } finally {
    submittingAudit.value = false
  }
}

// 打开正式发布弹窗
function openPublishModal() {
  publishForm.changeLog = '正式发布定稿'
  publishModalVisible.value = true
}

// 提交正式发布
async function handleSubmitPublish() {
  submittingPublish.value = true
  try {
    await publishMinutes({
      minutesId: minutes.value.minutesId,
      meetingId: props.meetingId,
      changeLog: publishForm.changeLog.trim()
    })
    message.success('会议纪要已正式发布并生成快照归档')
    publishModalVisible.value = false
    await fetchMinutes()
  } catch (err) {
    message.error(err.message || '发布纪要失败')
  } finally {
    submittingPublish.value = false
  }
}

// 打开版本快照列表
async function openVersionsModal() {
  versionsModalVisible.value = true
  loadingVersions.value = true
  versionList.value = []
  try {
    const list = await getMinutesVersions(props.meetingId)
    versionList.value = list || []
  } catch (err) {
    message.error(err.message || '获取版本历史失败')
  } finally {
    loadingVersions.value = false
  }
}

// 复制纪要全文
async function copyMinutesContent() {
  if (!minutes.value) return
  const m = minutes.value
  let text = `# ${m.title || '会议纪要'}\n\n`
  text += `## 会议概述\n${m.summary || '无'}\n\n`
  if (m.keyDiscussions) {
    text += `## 重点讨论\n${m.keyDiscussions}\n\n`
  }
  if (parsedAgendaTopics.value.length > 0) {
    text += `## 议题摘要\n`
    parsedAgendaTopics.value.forEach((t, i) => {
      text += `### 议题 ${i + 1}: ${t.title}\n- 讨论: ${t.discussionSummary}\n- 结论: ${t.keyConclusions || '无'}\n\n`
    })
  }
  text += `## 结论\n${m.conclusions || '无'}\n`

  const success = await copyText(text)
  if (success) {
    message.success('会议纪要全文已复制到剪贴板')
  }
}

watch(
  () => props.meetingId,
  () => {
    fetchMinutes()
  },
  { immediate: true }
)

onMounted(() => {
  fetchMinutes()
})
</script>

<style scoped>
.minutes-panel {
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

.update-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.minutes-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.minutes-header-block {
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 16px;
}

.minutes-heading {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 10px 0;
}

.minutes-meta-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-remark {
  color: #fa8c16;
  background: #fff7e6;
  padding: 2px 8px;
  border-radius: 4px;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
}

.summary-card,
.discussions-card,
.conclusions-card {
  background: #f9fbfd;
  border: 1px solid #e6f0fa;
  border-radius: 8px;
  padding: 16px;
}

.summary-text,
.section-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-main);
  margin: 0;
  white-space: pre-line;
}

.topics-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topic-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s;
}

.topic-card:hover {
  border-color: #91caff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.topic-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topic-index {
  font-size: 11px;
  font-weight: 600;
  color: #13c2c2;
  background: #e6fffb;
  padding: 2px 6px;
  border-radius: 4px;
}

.topic-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.topic-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.topic-conclusion {
  margin-top: 6px;
  font-size: 13px;
  color: #1677ff;
  background: #f0f7ff;
  padding: 6px 10px;
  border-radius: 4px;
}

.topic-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
}

.evidence-label {
  color: var(--text-tertiary);
}

.clickable-tag {
  cursor: pointer;
  transition: transform 0.15s;
}

.clickable-tag:hover {
  transform: scale(1.05);
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ver-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.ver-num {
  color: #1677ff;
}

.ver-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.ver-user {
  font-size: 12px;
  color: var(--text-secondary);
}

.ver-log {
  font-size: 13px;
  color: var(--text-main);
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    padding: 12px 14px;
    gap: 10px;
  }

  .header-left {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .header-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .header-actions .ant-btn {
    font-size: 12px;
    padding: 3px 8px;
  }

  .panel-body {
    padding: 14px 12px;
  }

  .minutes-heading {
    font-size: 18px;
  }

  .minutes-meta-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .summary-card,
  .discussions-card,
  .conclusions-card {
    padding: 12px;
  }

  .topic-card {
    padding: 12px;
  }
}
</style>

