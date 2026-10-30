<template>
  <div class="history-view">
    <div class="history-card meeting-card">
      <div class="card-header">
        <div class="header-left">
          <h2 class="title">会议管理与记录</h2>
          <span class="count-badge">共 {{ pagination.totalCount }} 条记录</span>
        </div>
        <div class="header-right">
          <a-input-search
            v-model:value="searchKeyword"
            placeholder="按会议主题或会议号搜索..."
            style="width: 240px"
            allow-clear
          />
          <a-button @click="fetchHistory(pagination.current)">
            <ReloadOutlined :spin="loading" /> 刷新
          </a-button>
          <a-button type="primary" @click="router.push('/meeting/schedule')">
            <PlusOutlined /> 预约新会议
          </a-button>
        </div>
      </div>

      <!-- 分类切换标签页：全部 / 已预约待开 / 已结束历史 -->
      <a-tabs v-model:activeKey="activeTab" class="history-tabs">
        <a-tab-pane key="all" tab="全部会议" />
        <a-tab-pane key="scheduled">
          <template #tab>
            <span>
              已预约 / 进行中
              <a-badge
                v-if="scheduledCount > 0"
                :count="scheduledCount"
                :number-style="{ backgroundColor: '#1677ff', marginLeft: '6px' }"
              />
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="finished" tab="已结束历史" />
      </a-tabs>

      <!-- 会议列表表格 -->
      <a-table
        :data-source="filteredList"
        :columns="columns"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 750 }"
        row-key="meetingId"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <!-- 会议主题 -->
          <template v-if="column.key === 'meetingName'">
            <div class="meeting-title-cell">
              <span class="name-text font-semibold">{{ record.meetingName || '在线视频会议' }}</span>
              <div class="tags-row">
                <span v-if="record.createUserId === authStore.userId" class="creator-tag">我创建的</span>
                <span v-else class="guest-tag">我受邀参会</span>
                <span v-if="record.joinType === 1" class="pwd-tag">密码保护</span>
              </div>
            </div>
          </template>

          <!-- 会议号 -->
          <template v-else-if="column.key === 'meetingNo'">
            <div class="code-cell">
              <span class="code-text mono">{{ formatMeetingNo(record.meetingNo) }}</span>
              <a-tooltip title="复制会议号">
                <a-button type="text" size="small" shape="circle" @click="handleCopy(record.meetingNo, '会议号')">
                  <CopyOutlined style="font-size: 12px; color: #1677ff" />
                </a-button>
              </a-tooltip>
            </div>
          </template>

          <!-- 计划/开始时间 -->
          <template v-else-if="column.key === 'startTime'">
            <div class="time-cell">
              <span class="time-main">{{ formatDateTime(record.startTime) || formatDateTime(record.createTime) }}</span>
              <span v-if="record.endTime" class="time-sub">至 {{ formatDateTime(record.endTime) }}</span>
            </div>
          </template>

          <!-- 会议状态 -->
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusTagColor(record)">
              <component :is="getStatusIcon(record)" />
              {{ getStatusLabel(record) }}
            </a-tag>
          </template>

          <!-- 操作栏 -->
          <template v-else-if="column.key === 'actions'">
            <div class="action-btn-group">
              <!-- 进行中或未结束的预约会议：直接进入 -->
              <a-button
                v-if="record.status === 0"
                type="primary"
                size="small"
                @click="enterMeeting(record)"
              >
                进入会议
              </a-button>

              <!-- 已结束会议：再开一场 -->
              <a-button
                v-else
                type="link"
                size="small"
                @click="relaunchMeeting(record)"
              >
                再开一场
              </a-button>

              <!-- 邀请成员 -->
              <a-button
                type="link"
                size="small"
                @click="openInvite(record)"
              >
                邀请
              </a-button>

              <!-- 我创建的未结束预约会议：允许调整时间 -->
              <a-button
                v-if="record.status === 0 && record.createUserId === authStore.userId"
                type="link"
                size="small"
                @click="openTimeModal(record)"
              >
                改期
              </a-button>

              <!-- 删除/取消预约 -->
              <a-popconfirm
                :title="record.status === 0 ? '确定取消该预约会议吗？' : '确定从历史记录中移除该会议吗？'"
                ok-text="确认删除"
                cancel-text="取消"
                ok-type="danger"
                @confirm="handleDeleteMeeting(record)"
              >
                <a-button type="link" danger size="small">
                  删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 邀请弹窗 -->
    <InviteModal
      v-model:open="inviteModalOpen"
      :meeting-info="selectedMeeting"
    />

    <!-- 修改预约会议时间弹窗 -->
    <a-modal
      v-model:open="timeModalOpen"
      title="调整预约会议时间"
      width="480px"
      :confirm-loading="updatingTime"
      @ok="handleUpdateTimeSubmit"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="会议主题">
          <span style="font-weight: 600">{{ activeTimeMeeting?.meetingName }}</span>
        </a-form-item>

        <a-form-item label="调整计划时间范围" required>
          <a-range-picker
            v-model:value="timeForm.range"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="变动原因说明 (可选，将随邮件通知)">
          <a-textarea
            v-model:value="timeForm.changeReason"
            placeholder="例如: 因紧急安排将会议顺延 30 分钟"
            :rows="2"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ReloadOutlined,
  CopyOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import {
  loadMeetingHistory,
  loadTodayMeeting,
  quickMeeting,
  delMeeting,
  updateMeetingTime
} from '@/api/meeting'
import { formatMeetingNo, formatDateTime, copyText } from '@/utils/format'
import InviteModal from '@/components/common/InviteModal.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(false)
const rawList = ref([])
const searchKeyword = ref('')
const activeTab = ref('all') // 'all' | 'scheduled' | 'finished'
const inviteModalOpen = ref(false)
const selectedMeeting = ref({})

// 修改时间弹窗状态
const timeModalOpen = ref(false)
const activeTimeMeeting = ref(null)
const updatingTime = ref(false)
const timeForm = reactive({
  range: [],
  changeReason: ''
})

const pagination = reactive({
  current: 1,
  pageSize: 15,
  totalCount: 0
})

const columns = [
  { title: '会议主题', dataIndex: 'meetingName', key: 'meetingName' },
  { title: '会议号', dataIndex: 'meetingNo', key: 'meetingNo', width: 160 },
  { title: '计划开始时间', dataIndex: 'startTime', key: 'startTime', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '操作', key: 'actions', width: 220, align: 'right' }
]

const tablePagination = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.totalCount,
  showSizeChanger: false,
  showTotal: (total) => `共 ${total} 场会议`
}))

// 已预约/进行中的会议数量
const scheduledCount = computed(() => {
  return rawList.value.filter((m) => m.status === 0).length
})

// 根据 Tab 标签与关键词组合过滤
const filteredList = computed(() => {
  let list = rawList.value

  // 1. Tab 分类过滤
  if (activeTab.value === 'scheduled') {
    list = list.filter((m) => m.status === 0)
  } else if (activeTab.value === 'finished') {
    list = list.filter((m) => m.status === 1)
  }

  // 2. 搜索关键词过滤
  if (!searchKeyword.value.trim()) return list
  const kw = searchKeyword.value.trim().toLowerCase()
  return list.filter((m) => {
    return (
      m.meetingName?.toLowerCase().includes(kw) ||
      String(m.meetingNo || '').includes(kw)
    )
  })
})

function getStatusTagColor(record) {
  if (record.status === 1) return 'default'
  if (record.startTime && dayjs(record.startTime).isAfter(dayjs())) {
    return 'processing' // 尚未到时间，已预约
  }
  return 'success' // 正在进行中
}

function getStatusIcon(record) {
  if (record.status === 1) return CheckCircleOutlined
  if (record.startTime && dayjs(record.startTime).isAfter(dayjs())) {
    return ClockCircleOutlined
  }
  return SyncOutlined
}

function getStatusLabel(record) {
  if (record.status === 1) return '已结束'
  if (record.startTime && dayjs(record.startTime).isAfter(dayjs())) {
    return '已预约'
  }
  return '进行中'
}

async function fetchHistory(page = 1) {
  loading.value = true
  try {
    // 同时拉取分页记录与今日/进行中预约会议，双向合并，确保数据库中的会议无遗漏呈现
    const [historyRes, todayRes] = await Promise.allSettled([
      loadMeetingHistory(page),
      loadTodayMeeting()
    ])

    const combinedList = []
    let total = 0

    if (historyRes.status === 'fulfilled' && historyRes.value) {
      const val = historyRes.value
      const list = Array.isArray(val) ? val : (val.list || val.records || val.rows || val.data || [])
      combinedList.push(...list)
      total = val.totalCount ?? val.total ?? list.length
    }

    if (todayRes.status === 'fulfilled' && todayRes.value) {
      const todayList = Array.isArray(todayRes.value) ? todayRes.value : (todayRes.value.list || [])
      for (const m of todayList) {
        if (!combinedList.some((item) => item.meetingId === m.meetingId)) {
          combinedList.unshift(m)
          total++
        }
      }
    }

    rawList.value = combinedList
    pagination.current = page
    pagination.totalCount = total
  } catch (err) {
    message.error(err.message || '获取会议记录失败')
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag) {
  pagination.current = pag.current
  fetchHistory(pag.current)
}

function enterMeeting(meeting) {
  router.push(`/meeting/room/${meeting.meetingId}`)
}

async function relaunchMeeting(meeting) {
  try {
    const meetingId = await quickMeeting({
      meetingNoType: 1,
      meetingName: `${meeting.meetingName} (延续)`,
      jionType: meeting.joinType || 0,
      jionPassword: meeting.jionPassword || ''
    })
    message.success('已创建新会议，正在进入...')
    router.push(`/meeting/room/${meetingId}`)
  } catch (err) {
    message.error(err.message || '重新发起会议失败')
  }
}

function openInvite(meeting) {
  selectedMeeting.value = meeting
  inviteModalOpen.value = true
}

async function handleDeleteMeeting(record) {
  try {
    await delMeeting(record.meetingId)
    message.success('会议已成功移除')
    fetchHistory(pagination.current)
  } catch (err) {
    message.error(err.message || '删除会议失败')
  }
}

function openTimeModal(meeting) {
  activeTimeMeeting.value = meeting
  timeForm.changeReason = ''
  const start = meeting.startTime ? dayjs(meeting.startTime) : dayjs().add(10, 'minute')
  const end = meeting.endTime ? dayjs(meeting.endTime) : start.add(60, 'minute')
  timeForm.range = [start, end]
  timeModalOpen.value = true
}

async function handleUpdateTimeSubmit() {
  if (!timeForm.range || timeForm.range.length < 2) {
    message.warning('请选择起止时间')
    return
  }

  updatingTime.value = true
  try {
    const startStr = timeForm.range[0].format('YYYY-MM-DD HH:mm:ss')
    const endStr = timeForm.range[1].format('YYYY-MM-DD HH:mm:ss')
    await updateMeetingTime({
      meetingId: activeTimeMeeting.value.meetingId,
      startTime: startStr,
      endTime: endStr,
      changeReason: timeForm.changeReason || '会议时间微调'
    })
    message.success('会议时间已成功调整')
    timeModalOpen.value = false
    fetchHistory(pagination.current)
  } catch (err) {
    message.error(err.message || '调整会议时间失败')
  } finally {
    updatingTime.value = false
  }
}

async function handleCopy(text, title) {
  const success = await copyText(text)
  if (success) {
    message.success(`${title}已复制`)
  }
}

// 监听路由参数：如携带 ?tab=scheduled 自动切换到预约会议标签
watch(
  () => route.query.tab,
  (tab) => {
    if (tab && ['all', 'scheduled', 'finished'].includes(tab)) {
      activeTab.value = tab
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchHistory(1)
})
</script>

<style scoped>
.history-view {
  max-width: 1200px;
  margin: 0 auto;
}

.history-card {
  background: #ffffff;
  padding: 24px;
  border-radius: var(--border-radius-card);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.count-badge {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-gray);
  padding: 2px 8px;
  border-radius: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-tabs {
  margin-bottom: 16px;
}

.meeting-title-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-text {
  color: var(--text-main);
  font-size: 14px;
}

.tags-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.creator-tag {
  font-size: 11px;
  color: #1677ff;
  background: #e6f4ff;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #91caff;
}

.guest-tag {
  font-size: 11px;
  color: #52c41a;
  background: #f6ffed;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #b7eb8f;
}

.pwd-tag {
  font-size: 11px;
  color: #faad14;
  background: #fffbe6;
  padding: 1px 6px;
  border-radius: 3px;
}

.code-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.code-text {
  font-weight: 500;
  color: var(--text-main);
}

.time-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.time-main {
  color: var(--text-main);
}

.time-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.action-btn-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

@media (max-width: 768px) {
  .history-card {
    padding: 16px 12px;
    border-radius: var(--border-radius-base);
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .header-right {
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-right :deep(.ant-input-search) {
    width: 100% !important;
  }

  .header-right .ant-btn {
    flex: 1;
  }
}
</style>
