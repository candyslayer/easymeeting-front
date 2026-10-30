<template>
  <div class="home-view">
    <!-- 顶部问候与个人概览卡片 -->
    <section class="welcome-card meeting-card">
      <div class="welcome-left">
        <a-avatar
          :size="64"
          :src="getAvatarUrl(authStore.userId)"
          :style="{ backgroundColor: '#1677ff', fontSize: '26px' }"
        >
          {{ authStore.nickName?.slice(0, 1) || '用' }}
        </a-avatar>
        <div class="welcome-text">
          <h1 class="greeting">您好，{{ authStore.nickName }}</h1>
          <p class="user-sub">
            <span>个人会议号: <strong>{{ formatMeetingNo(authStore.userId) || '未分配' }}</strong></span>
            <a-divider type="vertical" />
            <span>账号状态: <span class="status-badge">正常</span></span>
          </p>
        </div>
      </div>
      <div class="welcome-right">
        <a-button type="default" @click="deviceModalVisible = true">
          <SettingOutlined /> 音视频设备检测
        </a-button>
      </div>
    </section>

    <!-- 三大主要操作入口面板 (腾讯会议风格大卡片按钮) -->
    <section class="action-grid">
      <!-- 1. 新建/快速会议 -->
      <div class="action-card new-meeting" @click="quickMeetingModalVisible = true">
        <div class="action-icon-wrapper">
          <VideoCameraAddOutlined />
        </div>
        <div class="action-info">
          <h3 class="action-title">快速会议</h3>
          <p class="action-desc">一键即时发起，生成个人专属或随机会议室</p>
        </div>
      </div>

      <!-- 2. 加入会议 -->
      <div class="action-card join-meeting" @click="router.push('/meeting/join')">
        <div class="action-icon-wrapper">
          <LoginOutlined />
        </div>
        <div class="action-info">
          <h3 class="action-title">加入会议</h3>
          <p class="action-desc">输入 10 位会议号或专属邀请码快速入会</p>
        </div>
      </div>

      <!-- 3. 预约会议 -->
      <div class="action-card schedule-meeting" @click="router.push('/meeting/schedule')">
        <div class="action-icon-wrapper">
          <CalendarOutlined />
        </div>
        <div class="action-info">
          <h3 class="action-title">预约会议</h3>
          <p class="action-desc">设定会议主题与时间，邮件通知全体参会人员</p>
        </div>
      </div>
    </section>

    <!-- 进行中与已预约会议列表 -->
    <section class="section-container">
      <div class="section-header">
        <div class="title-with-badge">
          <h3 class="section-title">我的预约与进行中会议</h3>
          <a-tag v-if="todayMeetings.length > 0" color="processing">
            {{ todayMeetings.length }} 场待开 / 进行中
          </a-tag>
        </div>
        <div class="header-action-links">
          <router-link to="/meeting/history?tab=scheduled" class="view-all-link">
            全部预约会议 <RightOutlined />
          </router-link>
          <a-button type="link" size="small" :loading="loadingToday" @click="fetchTodayMeetings">
            <ReloadOutlined /> 刷新
          </a-button>
        </div>
      </div>

      <!-- 加载中骨架 -->
      <a-skeleton v-if="loadingToday" active :paragraph="{ rows: 2 }" />

      <!-- 数据列表 -->
      <div v-else-if="todayMeetings.length > 0" class="meeting-cards-list">
        <div
          v-for="meeting in todayMeetings"
          :key="meeting.meetingId"
          class="meeting-item-card meeting-card"
        >
          <div class="item-left">
            <div class="status-indicator" :class="{ live: meeting.status === 0 }"></div>
            <div class="item-content">
              <div class="item-header-row">
                <h4 class="item-name ellipsis">{{ meeting.meetingName || '在线会议' }}</h4>
                <a-tag :color="meeting.status === 0 ? 'processing' : 'default'">
                  {{ meeting.status === 0 ? '进行中 / 已预约' : '已结束' }}
                </a-tag>
              </div>
              <div class="item-meta">
                <span>会议号: <strong>{{ formatMeetingNo(meeting.meetingNo) }}</strong></span>
                <a-divider type="vertical" />
                <span>开始时间: {{ formatDateTime(meeting.startTime) || formatDateTime(meeting.createTime) }}</span>
                <span v-if="meeting.endTime"> ~ {{ formatDateTime(meeting.endTime) }}</span>
                <a-divider type="vertical" />
                <span v-if="meeting.joinType === 1" class="lock-tag">
                  <LockOutlined /> 密码保护
                </span>
                <span v-else class="free-tag">免密入会</span>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <a-button type="primary" @click="enterMeeting(meeting)">
              进入会议
            </a-button>
            <a-button type="default" @click="openInviteModal(meeting)">
              <ShareAltOutlined /> 邀请
            </a-button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state-box meeting-card">
        <a-empty description="暂无预约或进行中的会议">
          <template #image>
            <ScheduleOutlined style="font-size: 48px; color: #bfbfbf" />
          </template>
          <a-space>
            <a-button type="primary" @click="router.push('/meeting/schedule')">
              <CalendarOutlined /> 预约新会议
            </a-button>
            <a-button @click="quickMeetingModalVisible = true">
              发起快速会议
            </a-button>
          </a-space>
        </a-empty>
      </div>
    </section>

    <!-- 最近会议记录快捷面板 -->
    <section class="section-container">
      <div class="section-header">
        <h3 class="section-title">最近会议</h3>
        <router-link to="/meeting/history" class="view-all-link">
          查看全部历史记录 <RightOutlined />
        </router-link>
      </div>

      <a-skeleton v-if="loadingHistory" active :paragraph="{ rows: 3 }" />

      <div v-else-if="recentMeetings.length > 0" class="recent-table-box meeting-card">
        <a-table
          :data-source="recentMeetings"
          :columns="historyColumns"
          :pagination="false"
          :scroll="{ x: 560 }"
          row-key="meetingId"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'meetingName'">
              <span class="table-meeting-name">{{ record.meetingName }}</span>
            </template>
            <template v-else-if="column.key === 'meetingNo'">
              <span class="mono-code">{{ formatMeetingNo(record.meetingNo) }}</span>
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
              <a-button
                v-if="record.status === 0"
                type="link"
                size="small"
                @click="enterMeeting(record)"
              >
                进入
              </a-button>
              <a-button
                v-else
                type="link"
                size="small"
                @click="handleRejoin(record)"
              >
                重新发起
              </a-button>
            </template>
          </template>
        </a-table>
      </div>

      <div v-else class="empty-state-box meeting-card">
        <a-empty description="暂无历史会议记录" />
      </div>
    </section>

    <!-- 快速创建会议弹窗 -->
    <a-modal
      v-model:open="quickMeetingModalVisible"
      title="快速发起会议"
      width="500px"
      :confirm-loading="creatingMeeting"
      @ok="handleCreateQuickMeeting"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="会议主题" required>
          <a-input
            v-model:value="quickForm.meetingName"
            placeholder="例如: 团队日常同步例会"
            maxlength="50"
            allow-clear
          />
        </a-form-item>

        <a-form-item label="会议号类型">
          <a-radio-group v-model:value="quickForm.meetingNoType">
            <a-radio :value="0">使用个人会议号 ({{ authStore.userId }})</a-radio>
            <a-radio :value="1">系统随机分配 10 位会议号</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="入会安全设定">
          <a-radio-group v-model:value="quickForm.jionType">
            <a-radio :value="0">免密码快速入会</a-radio>
            <a-radio :value="1">设置 6 位入会密码</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item
          v-if="quickForm.jionType === 1"
          label="会议密码"
          required
        >
          <a-input
            v-model:value="quickForm.jionPassword"
            placeholder="请输入 6 位数字或字母入会密码"
            maxlength="20"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 音视频设备测试弹窗 -->
    <DeviceTestModal v-model:open="deviceModalVisible" />

    <!-- 邀请弹窗 -->
    <InviteModal
      v-model:open="inviteModalVisible"
      :meeting-info="activeInviteMeeting"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  VideoCameraAddOutlined,
  LoginOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  ReloadOutlined,
  SettingOutlined,
  LockOutlined,
  ShareAltOutlined,
  RightOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getAvatarUrl } from '@/api/auth'
import { quickMeeting, loadTodayMeeting, loadMeetingHistory } from '@/api/meeting'
import { formatMeetingNo, formatDateTime } from '@/utils/format'
import DeviceTestModal from '@/components/common/DeviceTestModal.vue'
import InviteModal from '@/components/common/InviteModal.vue'

const router = useRouter()
const authStore = useAuthStore()

const loadingToday = ref(false)
const loadingHistory = ref(false)
const todayMeetings = ref([])
const recentMeetings = ref([])

const deviceModalVisible = ref(false)
const quickMeetingModalVisible = ref(false)
const inviteModalVisible = ref(false)
const activeInviteMeeting = ref({})
const creatingMeeting = ref(false)

const quickForm = reactive({
  meetingName: `${authStore.nickName || '用户'} 发起的视频会议`,
  meetingNoType: 0, // 0: 个人ID, 1: 随机10位
  jionType: 0, // 0: 免密, 1: 密码
  jionPassword: ''
})

const historyColumns = [
  { title: '会议主题', dataIndex: 'meetingName', key: 'meetingName' },
  { title: '会议号', dataIndex: 'meetingNo', key: 'meetingNo', width: 160 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
  { title: '操作', key: 'actions', width: 120, align: 'right' }
]

async function fetchTodayMeetings() {
  loadingToday.value = true
  try {
    const res = await loadTodayMeeting()
    const list = Array.isArray(res) ? res : (res?.list || res?.data || [])
    todayMeetings.value = list
  } catch (err) {
    console.error('获取预约与今日会议失败:', err)
  } finally {
    loadingToday.value = false
  }
}

async function fetchRecentHistory() {
  loadingHistory.value = true
  try {
    const res = await loadMeetingHistory(1)
    const list = Array.isArray(res) ? res : (res?.list || res?.records || res?.rows || res?.data || [])
    recentMeetings.value = list.slice(0, 5)
  } catch (err) {
    console.error('获取历史会议失败:', err)
  } finally {
    loadingHistory.value = false
  }
}

async function handleCreateQuickMeeting() {
  if (!quickForm.meetingName.trim()) {
    message.warning('请输入会议主题')
    return
  }
  if (quickForm.jionType === 1 && !quickForm.jionPassword.trim()) {
    message.warning('您选择了密码保护，请输入入会密码')
    return
  }

  creatingMeeting.value = true
  try {
    const meetingId = await quickMeeting({
      meetingNoType: quickForm.meetingNoType,
      meetingName: quickForm.meetingName.trim(),
      jionType: quickForm.jionType,
      jionPassword: quickForm.jionPassword.trim()
    })

    message.success('会议创建成功，正在进入会议室...')
    quickMeetingModalVisible.value = false
    router.push(`/meeting/room/${meetingId}`)
  } catch (err) {
    message.error(err.message || '创建会议失败')
  } finally {
    creatingMeeting.value = false
  }
}

function enterMeeting(meeting) {
  router.push(`/meeting/room/${meeting.meetingId}`)
}

function openInviteModal(meeting) {
  activeInviteMeeting.value = meeting
  inviteModalVisible.value = true
}

function handleRejoin(meeting) {
  quickForm.meetingName = `${meeting.meetingName} (重新发起)`
  quickMeetingModalVisible.value = true
}

onMounted(() => {
  fetchTodayMeetings()
  fetchRecentHistory()
})
</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 欢迎卡片 */
.welcome-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
}

.welcome-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.welcome-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.greeting {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.user-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  color: var(--success-color);
  font-weight: 600;
}

/* 三大核心操作大按钮卡片 */
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.action-card {
  background: #ffffff;
  border-radius: var(--border-radius-lg);
  padding: 24px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 18px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}

.action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
}

.action-icon-wrapper {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  color: #ffffff;
}

.new-meeting .action-icon-wrapper {
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.35);
}

.join-meeting .action-icon-wrapper {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  box-shadow: 0 6px 16px rgba(82, 196, 26, 0.35);
}

.schedule-meeting .action-icon-wrapper {
  background: linear-gradient(135deg, #fa8c16 0%, #d46b08 100%);
  box-shadow: 0 6px 16px rgba(250, 140, 22, 0.35);
}

.action-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 4px;
}

.action-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* 业务区域 */
.section-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.view-all-link {
  font-size: 13px;
  color: var(--primary-color);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.view-all-link:hover {
  text-decoration: underline;
}

/* 今日进行中会议列表项 */
.meeting-cards-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meeting-item-card {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-indicator.live {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #52c41a;
  box-shadow: 0 0 0 4px rgba(82, 196, 26, 0.2);
  animation: live-blink 2s infinite;
}

@keyframes live-blink {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.item-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 4px;
}

.item-meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.lock-tag {
  color: #faad14;
}

.free-tag {
  color: #52c41a;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 空状态卡片 */
.empty-state-box {
  padding: 36px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recent-table-box {
  padding: 6px 12px;
}

.table-meeting-name {
  font-weight: 500;
  color: var(--text-main);
}

.mono-code {
  font-family: monospace;
  font-weight: 600;
  color: var(--primary-color);
}

/* 移动端响应式断点适配 */
@media (max-width: 768px) {
  .home-view {
    gap: 16px;
  }

  .welcome-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
  }

  .welcome-left {
    gap: 12px;
  }

  .welcome-left :deep(.ant-avatar) {
    width: 48px !important;
    height: 48px !important;
    line-height: 48px !important;
    font-size: 20px !important;
  }

  .greeting {
    font-size: 17px;
  }

  .user-sub {
    font-size: 11px;
    flex-wrap: wrap;
    gap: 4px;
  }

  .welcome-right {
    width: 100%;
  }

  .welcome-right .ant-btn {
    width: 100%;
  }

  .action-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .action-card {
    padding: 14px 16px;
    gap: 14px;
  }

  .action-icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    font-size: 22px;
  }

  .action-title {
    font-size: 15px;
  }

  .action-desc {
    font-size: 11px;
  }

  .meeting-item-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
  }

  .item-left {
    width: 100%;
  }

  .item-content {
    width: 100%;
    min-width: 0;
  }

  .item-meta {
    flex-wrap: wrap;
    gap: 4px;
    font-size: 11px;
  }

  .item-actions {
    width: 100%;
    justify-content: flex-end;
    gap: 8px;
  }

  .recent-table-box {
    padding: 0;
  }
}
</style>

