<template>
  <div class="history-view">
    <div class="history-card meeting-card">
      <div class="card-header">
        <div class="header-left">
          <h2 class="title">会议记录</h2>
          <span class="count-badge">共 {{ pagination.totalCount }} 条记录</span>
        </div>
        <div class="header-right">
          <a-input-search
            v-model:value="searchKeyword"
            placeholder="按会议主题搜索..."
            style="width: 240px"
            allow-clear
          />
          <a-button @click="fetchHistory(pagination.current)">
            <ReloadOutlined :spin="loading" /> 刷新
          </a-button>
        </div>
      </div>

      <!-- 表格内容 -->
      <a-table
        :data-source="filteredList"
        :columns="columns"
        :loading="loading"
        :pagination="tablePagination"
        row-key="meetingId"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'meetingName'">
            <div class="meeting-title-cell">
              <span class="name-text">{{ record.meetingName }}</span>
              <span v-if="record.createUserId === authStore.userId" class="creator-tag">创建者</span>
            </div>
          </template>

          <template v-else-if="column.key === 'meetingNo'">
            <div class="code-cell">
              <span class="code-text">{{ formatMeetingNo(record.meetingNo) }}</span>
              <a-tooltip title="复制会议号">
                <a-button type="text" size="small" shape="circle" @click="handleCopy(record.meetingNo, '会议号')">
                  <CopyOutlined style="font-size: 12px; color: #1677ff" />
                </a-button>
              </a-tooltip>
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-badge
              :status="record.status === 0 ? 'processing' : 'default'"
              :text="record.status === 0 ? '进行中' : '已结束'"
            />
          </template>

          <template v-else-if="column.key === 'createTime'">
            <span>{{ formatDateTime(record.createTime) }}</span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="action-btn-group">
              <a-button
                v-if="record.status === 0"
                type="primary"
                size="small"
                @click="enterMeeting(record)"
              >
                进入会议
              </a-button>
              <a-button
                v-else
                type="link"
                size="small"
                @click="relaunchMeeting(record)"
              >
                再开一场
              </a-button>
              <a-button
                type="link"
                size="small"
                @click="openInvite(record)"
              >
                邀请
              </a-button>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  CopyOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { loadMeetingHistory, quickMeeting } from '@/api/meeting'
import { formatMeetingNo, formatDateTime, copyText } from '@/utils/format'
import InviteModal from '@/components/common/InviteModal.vue'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const rawList = ref([])
const searchKeyword = ref('')
const inviteModalOpen = ref(false)
const selectedMeeting = ref({})

const pagination = reactive({
  current: 1,
  pageSize: 15,
  totalCount: 0
})

const columns = [
  { title: '会议主题', dataIndex: 'meetingName', key: 'meetingName' },
  { title: '会议号', dataIndex: 'meetingNo', key: 'meetingNo', width: 170 },
  { title: '会议状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'actions', width: 180, align: 'right' }
]

const tablePagination = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.totalCount,
  showSizeChanger: false,
  showTotal: (total) => `共 ${total} 条`
}))

const filteredList = computed(() => {
  if (!searchKeyword.value.trim()) return rawList.value
  const kw = searchKeyword.value.trim().toLowerCase()
  return rawList.value.filter((m) => {
    return (
      m.meetingName?.toLowerCase().includes(kw) ||
      String(m.meetingNo).includes(kw)
    )
  })
})

async function fetchHistory(page = 1) {
  loading.value = true
  try {
    const res = await loadMeetingHistory(page)
    // res 包含 totalCount, pageNO, list
    rawList.value = res?.list || []
    pagination.current = res?.pageNO || page
    pagination.totalCount = res?.totalCount || 0
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

async function handleCopy(text, title) {
  const success = await copyText(text)
  if (success) {
    message.success(`${title}已复制`)
  }
}

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
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
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
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meeting-title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-text {
  font-weight: 500;
  color: var(--text-main);
}

.creator-tag {
  font-size: 10px;
  background: #e6f4ff;
  color: #1677ff;
  padding: 1px 5px;
  border-radius: 3px;
}

.code-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.code-text {
  font-family: monospace;
  font-weight: 600;
  color: var(--primary-color);
}

.action-btn-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
</style>

