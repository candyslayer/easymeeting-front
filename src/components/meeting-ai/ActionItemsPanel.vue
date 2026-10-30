<template>
  <div class="action-items-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">会议待办与行动项跟踪</h3>
        <span class="count-badge">共 {{ actionItems.length }} 项待办</span>
      </div>

      <div class="header-right">
        <!-- 状态快速筛选 -->
        <a-radio-group v-model:value="statusFilter" size="small" button-style="solid">
          <a-radio-button value="ALL">全部</a-radio-button>
          <a-radio-button value="TODO">待办 ({{ todoCount }})</a-radio-button>
          <a-radio-button value="DOING">进行中 ({{ doingCount }})</a-radio-button>
          <a-radio-button value="DONE">已完成 ({{ doneCount }})</a-radio-button>
        </a-radio-group>

        <a-button @click="fetchActionItems">
          <ReloadOutlined :spin="loading" /> 刷新
        </a-button>

        <a-button type="primary" ghost :loading="aiStore.isAnalyzing" @click="handleReanalyze">
          <RobotOutlined /> 重新提取待办
        </a-button>
      </div>
    </div>

    <!-- 待办列表 -->
    <div class="panel-body">
      <a-spin :spinning="loading">
        <div v-if="filteredItems.length === 0" class="empty-state">
          <a-empty description="暂无符合条件的行动项">
            <template #extra>
              <a-button type="primary" :loading="aiStore.isAnalyzing" @click="handleReanalyze">
                <RobotOutlined /> 发起 AI 待办事项提取
              </a-button>
            </template>
          </a-empty>
        </div>

        <div v-else class="items-list">
          <div
            v-for="item in filteredItems"
            :key="item.actionId"
            class="action-item-card"
            :class="{
              'is-done': item.status === 'DONE',
              'is-doing': item.status === 'DOING',
              'is-todo': item.status === 'TODO'
            }"
          >
            <!-- 勾选状态与任务描述 -->
            <div class="card-main">
              <div class="checkbox-area">
                <a-checkbox
                  :checked="item.status === 'DONE'"
                  @change="(e) => handleToggleDone(item, e.target.checked)"
                />
              </div>

              <div class="content-area">
                <div class="task-title-row">
                  <span
                    class="task-content"
                    :class="{ 'done-strikethrough': item.status === 'DONE' }"
                  >
                    {{ item.content }}
                  </span>
                  <!-- 优先级标签 -->
                  <a-tag :color="getPriorityColor(item.priority)">
                    {{ getPriorityLabel(item.priority) }}
                  </a-tag>
                  <!-- 状态标签 -->
                  <a-tag :color="getStatusColor(item.status)">
                    {{ getStatusLabel(item.status) }}
                  </a-tag>
                </div>

                <!-- 责任人、截止时间与证据信息 -->
                <div class="task-meta-row">
                  <div class="meta-item">
                    <UserOutlined />
                    <span>负责人: </span>
                    <strong :class="{ 'unspecified': !item.assigneeName && !item.assigneeUserId }">
                      {{ item.assigneeName || item.assigneeUserId || '未指定' }}
                    </strong>
                  </div>

                  <div class="meta-item">
                    <CalendarOutlined />
                    <span>截止时间: </span>
                    <strong :class="{ 'unspecified': !item.dueTime }">
                      {{ item.dueTime || '未指定' }}
                    </strong>
                  </div>
                </div>

                <!-- 证据引用 -->
                <div class="task-evidence-box" v-if="item.evidenceQuote">
                  <span class="evidence-prefix">提取依据:</span>
                  <span class="evidence-text">"{{ item.evidenceQuote }}"</span>
                </div>
              </div>

              <!-- 右侧快捷操作 -->
              <div class="card-actions">
                <a-button type="link" size="small" @click="openEditModal(item)">
                  <EditOutlined /> 编辑
                </a-button>
                <a-button type="link" size="small" @click="viewEvidence(item)">
                  <SearchOutlined /> 溯源
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- 编辑待办弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      title="修改待办任务"
      :confirm-loading="savingItem"
      :width="modalWidth(520)"
      @ok="handleSaveItem"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="任务内容" required>
          <a-textarea v-model:value="editForm.content" :rows="3" />
        </a-form-item>

        <a-form-item label="任务状态" required>
          <a-select v-model:value="editForm.status">
            <a-select-option value="TODO">待办 (TODO)</a-select-option>
            <a-select-option value="DOING">进行中 (DOING)</a-select-option>
            <a-select-option value="DONE">已完成 (DONE)</a-select-option>
            <a-select-option value="CANCELLED">已取消 (CANCELLED)</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="负责人 User ID">
          <a-input
            v-model:value="editForm.assigneeUserId"
            placeholder="请输入指派成员的用户ID（如留空则为未指定）"
          />
        </a-form-item>

        <a-form-item label="截止日期时间">
          <a-date-picker
            v-model:value="editForm.dueTimeDate"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            placeholder="选择截止日期时间"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 证据溯源弹窗 -->
    <a-modal
      v-model:open="evidenceModalVisible"
      title="待办任务证据链溯源"
      :footer="null"
      :width="modalWidth(580)"
    >
      <a-spin :spinning="loadingEvidence">
        <div v-if="evidenceList.length === 0" style="padding: 24px 0">
          <a-empty description="暂未找到具体转写证据片段" />
        </div>
        <div v-else class="evidence-timeline">
          <div
            v-for="evi in evidenceList"
            :key="evi.evidenceId"
            class="evi-card"
          >
            <div class="evi-header">
              <span class="speaker-name font-semibold">{{ evi.speakerName || '发言人' }}</span>
              <span class="time-range mono">{{ formatMs(evi.startTimeMs) }} - {{ formatMs(evi.endTimeMs) }}</span>
            </div>
            <p class="evi-quote">"{{ evi.quoteText }}"</p>
            <div class="evi-footer" v-if="evi.segmentId">
              <a-button
                type="link"
                size="small"
                @click="jumpToSegment(evi.segmentId, evi.startTimeMs)"
              >
                定位到转写片段 #{{ evi.segmentId }}
              </a-button>
            </div>
          </div>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ReloadOutlined,
  RobotOutlined,
  UserOutlined,
  CalendarOutlined,
  EditOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'
import {
  getActionItemList,
  updateActionItem,
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

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onWindowResize() {
  windowWidth.value = window.innerWidth
}
function modalWidth(defaultWidth) {
  return windowWidth.value < 640 ? '94vw' : `${defaultWidth}px`
}

const loading = ref(false)
const statusFilter = ref('ALL') // 'ALL' | 'TODO' | 'DOING' | 'DONE'

const actionItems = computed(() => aiStore.actionItems)

const todoCount = computed(() => actionItems.value.filter((i) => i.status === 'TODO').length)
const doingCount = computed(() => actionItems.value.filter((i) => i.status === 'DOING').length)
const doneCount = computed(() => actionItems.value.filter((i) => i.status === 'DONE').length)

const filteredItems = computed(() => {
  if (statusFilter.value === 'ALL') return actionItems.value
  return actionItems.value.filter((i) => i.status === statusFilter.value)
})

// 编辑弹窗
const editModalVisible = ref(false)
const activeItem = ref(null)
const savingItem = ref(false)
const editForm = reactive({
  content: '',
  status: 'TODO',
  assigneeUserId: '',
  dueTimeDate: null
})

// 证据溯源
const evidenceModalVisible = ref(false)
const loadingEvidence = ref(false)
const evidenceList = ref([])

function getPriorityLabel(priority) {
  switch (priority) {
    case 'HIGH':
      return '高优'
    case 'MEDIUM':
      return '中优'
    case 'LOW':
      return '低优'
    default:
      return '普通'
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'HIGH':
      return 'error'
    case 'MEDIUM':
      return 'warning'
    case 'LOW':
      return 'processing'
    default:
      return 'default'
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'TODO':
      return '待办'
    case 'DOING':
      return '进行中'
    case 'DONE':
      return '已完成'
    case 'CANCELLED':
      return '已取消'
    default:
      return status
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'TODO':
      return 'default'
    case 'DOING':
      return 'processing'
    case 'DONE':
      return 'success'
    case 'CANCELLED':
      return 'default'
    default:
      return 'default'
  }
}

function formatMs(ms) {
  if (!ms && ms !== 0) return '00:00'
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function fetchActionItems() {
  if (!props.meetingId) return
  loading.value = true
  try {
    await aiStore.loadActionItems(props.meetingId)
  } catch (err) {
    console.error('获取待办失败', err)
  } finally {
    loading.value = false
  }
}

async function handleToggleDone(item, isChecked) {
  const newStatus = isChecked ? 'DONE' : 'TODO'
  try {
    await updateActionItem({
      actionId: item.actionId,
      status: newStatus
    })
    item.status = newStatus
    message.success(isChecked ? '已标记为完成' : '已重置为待办')
  } catch (err) {
    message.error(err.message || '更新状态失败')
  }
}

function handleReanalyze() {
  aiStore.triggerAnalysis(props.meetingId, true)
}

function openEditModal(item) {
  activeItem.value = item
  editForm.content = item.content || ''
  editForm.status = item.status || 'TODO'
  editForm.assigneeUserId = item.assigneeUserId || ''
  editForm.dueTimeDate = item.dueTime ? dayjs(item.dueTime) : null
  editModalVisible.value = true
}

async function handleSaveItem() {
  if (!editForm.content.trim()) {
    message.warning('任务内容不能为空')
    return
  }

  savingItem.value = true
  try {
    const dueTimeStr = editForm.dueTimeDate ? editForm.dueTimeDate.format('YYYY-MM-DD HH:mm:ss') : null
    await updateActionItem({
      actionId: activeItem.value.actionId,
      status: editForm.status,
      assigneeUserId: editForm.assigneeUserId.trim() || undefined,
      dueTime: dueTimeStr || undefined
    })

    message.success('待办任务已更新')
    editModalVisible.value = false
    await fetchActionItems()
  } catch (err) {
    message.error(err.message || '保存待办失败')
  } finally {
    savingItem.value = false
  }
}

async function viewEvidence(item) {
  evidenceModalVisible.value = true
  loadingEvidence.value = true
  evidenceList.value = []
  try {
    const list = await queryEvidence({
      targetType: 'ACTION_ITEM',
      targetId: item.actionId
    })
    evidenceList.value = list || []
  } catch (err) {
    console.error('查询待办证据失败', err)
  } finally {
    loadingEvidence.value = false
  }
}

function jumpToSegment(segmentId, startTimeMs) {
  evidenceModalVisible.value = false
  aiStore.jumpToSegment(segmentId, startTimeMs)
}

watch(
  () => props.meetingId,
  () => {
    fetchActionItems()
  },
  { immediate: true }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }
  fetchActionItems()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize)
  }
})
</script>

<style scoped>
.action-items-panel {
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

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}

.action-item-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px 16px;
  transition: all 0.2s;
}

.action-item-card:hover {
  border-color: #91caff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.action-item-card.is-done {
  background: #fafafa;
  border-color: #f0f0f0;
}

.card-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.checkbox-area {
  padding-top: 3px;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-content {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-main);
  line-height: 1.5;
}

.done-strikethrough {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

.task-meta-row {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unspecified {
  color: var(--text-tertiary);
  font-weight: normal;
}

.task-evidence-box {
  background: #f9fbfd;
  border: 1px solid #e6f0fa;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 6px;
}

.evidence-prefix {
  color: #1677ff;
  font-weight: 600;
  flex-shrink: 0;
}

.evidence-text {
  font-style: italic;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.8;
}

.evidence-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.evi-card {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px 14px;
}

.evi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.speaker-name {
  font-size: 13px;
}

.time-range {
  font-size: 12px;
  color: var(--text-tertiary);
}

.evi-quote {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  color: var(--text-main);
}

.evi-footer {
  margin-top: 6px;
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

  .action-item-card {
    padding: 12px 10px;
  }

  .card-main {
    gap: 10px;
  }

  .task-title-row {
    gap: 6px;
  }

  .task-content {
    font-size: 14px;
  }

  .task-meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .card-actions {
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .task-evidence-box {
    flex-direction: column;
    gap: 2px;
  }
}
</style>

