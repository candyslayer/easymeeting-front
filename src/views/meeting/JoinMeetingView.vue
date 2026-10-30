<template>
  <div class="join-meeting-page">
    <div class="join-card meeting-card">
      <div class="join-header">
        <div class="header-icon">
          <LoginOutlined />
        </div>
        <h2 class="join-title">加入会议</h2>
        <p class="join-desc">支持输入 10 位会议号或专属 8 位邀请码</p>
      </div>

      <a-tabs v-model:activeKey="activeTab" centered>
        <!-- 方式 1：输入会议号 -->
        <a-tab-pane key="number" tab="会议号入会">
          <a-form
            :model="formState"
            layout="vertical"
            class="join-form"
            @finish="handleJoinByNumber"
          >
            <a-form-item label="会议号" required>
              <a-input
                v-model:value="formState.meetingNo"
                size="large"
                placeholder="例如: 123 456 7890"
                maxlength="16"
                allow-clear
                @input="formatInputMeetingNo"
              >
                <template #prefix>
                  <NumberOutlined style="color: #bfbfbf" />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item label="您的参会昵称" required>
              <a-input
                v-model:value="formState.nickName"
                size="large"
                placeholder="入会后展示的名称"
                maxlength="20"
              >
                <template #prefix>
                  <UserOutlined style="color: #bfbfbf" />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item label="会议密码 (若会议已设密)">
              <a-input-password
                v-model:value="formState.password"
                size="large"
                placeholder="无密码会议可留空"
              >
                <template #prefix>
                  <LockOutlined style="color: #bfbfbf" />
                </template>
              </a-input-password>
            </a-form-item>

            <!-- 初始媒体设备设置选项 -->
            <div class="options-box">
              <span class="options-title">入会设备初始偏好：</span>
              <div class="checkbox-row">
                <a-checkbox v-model:checked="mediaOptions.openAudio">入会时开启麦克风</a-checkbox>
                <a-checkbox v-model:checked="mediaOptions.openVideo">入会时开启摄像头</a-checkbox>
              </div>
            </div>

            <a-form-item style="margin-top: 24px">
              <a-button
                type="primary"
                html-type="submit"
                size="large"
                block
                :loading="joining"
                class="join-submit-btn"
              >
                立即加入会议
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <!-- 方式 2：输入邀请码 -->
        <a-tab-pane key="code" tab="邀请码入会">
          <a-form
            layout="vertical"
            class="join-form"
            @finish="handleJoinByInviteCode"
          >
            <a-form-item label="专属邀请码" required>
              <a-input
                v-model:value="inviteCodeForm.code"
                size="large"
                placeholder="请输入 8 位邀请码"
                maxlength="12"
                allow-clear
              >
                <template #prefix>
                  <KeyOutlined style="color: #bfbfbf" />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item label="入会密码 (非免密链接需填写)">
              <a-input-password
                v-model:value="inviteCodeForm.password"
                size="large"
                placeholder="若为免密链接可留空"
              >
                <template #prefix>
                  <LockOutlined style="color: #bfbfbf" />
                </template>
              </a-input-password>
            </a-form-item>

            <a-form-item style="margin-top: 24px">
              <a-button
                type="primary"
                html-type="submit"
                size="large"
                block
                :loading="joining"
                class="join-submit-btn"
              >
                通过邀请码入会
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  LoginOutlined,
  NumberOutlined,
  UserOutlined,
  LockOutlined,
  KeyOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { prejoinMeeting, joinByInviteCode, getCurrentMeeting } from '@/api/meeting'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const activeTab = ref('number')
const joining = ref(false)

const formState = reactive({
  meetingNo: '',
  nickName: authStore.nickName || '',
  password: ''
})

const inviteCodeForm = reactive({
  code: '',
  password: ''
})

const mediaOptions = reactive({
  openAudio: true,
  openVideo: true
})

function formatInputMeetingNo(e) {
  const val = e.target.value.replace(/\s+/g, '')
  formState.meetingNo = val
}

async function handleJoinByNumber() {
  const cleanNo = formState.meetingNo.replace(/\s+/g, '')
  if (!cleanNo) {
    message.warning('请输入会议号')
    return
  }
  if (!formState.nickName.trim()) {
    message.warning('请输入您的参会昵称')
    return
  }

  joining.value = true
  try {
    // 1. 调用 prejoinMeeting 校验会议状态与密码，服务端会将 currentMeetingId 绑定到 Redis
    await prejoinMeeting({
      meetingNo: cleanNo,
      nickName: formState.nickName.trim(),
      password: formState.password.trim()
    })

    // 2. 获取当前已绑定的会议信息，拿到 meetingId
    const current = await getCurrentMeeting()
    if (!current?.meetingId) {
      throw new Error('未获取到有效会议信息')
    }

    // 记录初始偏好
    sessionStorage.setItem('initial_video_open', mediaOptions.openVideo ? '1' : '0')
    sessionStorage.setItem('initial_audio_open', mediaOptions.openAudio ? '1' : '0')

    message.success('验证通过，正在进入会议室...')
    router.push(`/meeting/room/${current.meetingId}`)
  } catch (err) {
    message.error(err.message || '入会失败')
  } finally {
    joining.value = false
  }
}

async function handleJoinByInviteCode() {
  const code = inviteCodeForm.code.trim()
  if (!code) {
    message.warning('请输入邀请码')
    return
  }

  joining.value = true
  try {
    const inviteDto = await joinByInviteCode({
      inviteCode: code,
      password: inviteCodeForm.password.trim()
    })

    if (!inviteDto?.meetingId) {
      throw new Error('解析邀请码会议失败')
    }

    message.success('邀请码校验成功，正在进入会议...')
    router.push(`/meeting/room/${inviteDto.meetingId}`)
  } catch (err) {
    message.error(err.message || '邀请码校验失败')
  } finally {
    joining.value = false
  }
}

onMounted(() => {
  // 支持 URL 参数 ?no=xxx 或 ?code=xxx
  if (route.query.no) {
    formState.meetingNo = String(route.query.no)
  }
  if (route.query.code) {
    activeTab.value = 'code'
    inviteCodeForm.code = String(route.query.code)
  }
})
</script>

<style scoped>
.join-meeting-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--header-height) - 48px);
}

.join-card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: var(--border-radius-lg);
  padding: 36px 36px 40px;
}

@media (max-width: 768px) {
  .join-meeting-page {
    min-height: auto;
    padding: 10px 0;
  }

  .join-card {
    padding: 24px 18px;
    border-radius: var(--border-radius-base);
  }

  .checkbox-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}

.join-header {
  text-align: center;
  margin-bottom: 20px;
}

.header-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: #e6f4ff;
  color: var(--primary-color);
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.join-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 4px;
}

.join-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.join-form {
  margin-top: 16px;
}

.options-box {
  background: #f7f8fa;
  border-radius: var(--border-radius-base);
  padding: 12px 14px;
  margin-top: 10px;
}

.options-title {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 8px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.join-submit-btn {
  font-weight: 600;
  letter-spacing: 1px;
}
</style>

