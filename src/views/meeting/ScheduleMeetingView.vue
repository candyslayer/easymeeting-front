<template>
  <div class="schedule-view">
    <div class="schedule-container meeting-card">
      <div class="header-box">
        <div class="icon-wrap">
          <CalendarOutlined />
        </div>
        <div class="header-text">
          <h2 class="title">预约新会议</h2>
          <p class="subtitle">规划未来议程，通过邮件自动通知受邀联系人</p>
        </div>
      </div>

      <!-- 预约表单 -->
      <a-form
        v-if="!scheduledResult"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="schedule-form"
        @finish="handleSchedule"
      >
        <a-form-item name="meetingName" label="会议主题" required>
          <a-input
            v-model:value="formState.meetingName"
            size="large"
            placeholder="例如: 2026 Q4 产品研发进度复盘会"
            maxlength="50"
            allow-clear
          />
        </a-form-item>

        <a-form-item label="会议计划时间" required>
          <a-range-picker
            v-model:value="formState.timeRange"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            size="large"
            style="width: 100%"
            :placeholder="['开始时间', '预计结束时间']"
          />
        </a-form-item>

        <a-form-item label="会议号分配规则">
          <a-radio-group v-model:value="formState.meetingNoType">
            <a-radio :value="0">使用个人专属会议号 ({{ authStore.userId }})</a-radio>
            <a-radio :value="1">系统随机分配独立 10 位会议号</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="入会密码保护">
          <div class="pwd-group">
            <a-switch
              v-model:checked="enablePassword"
              checked-children="已开启密码"
              un-checked-children="公开免密"
            />
            <a-input-password
              v-if="enablePassword"
              v-model:value="formState.jionPassword"
              placeholder="请输入 6 位入会密码"
              maxlength="20"
              style="width: 240px"
            />
          </div>
        </a-form-item>

        <a-form-item label="邮件邀请通知联系人 (可选)" extra="多个联系人邮箱请用英文逗号 (,) 分隔">
          <a-textarea
            v-model:value="formState.inviteEmails"
            placeholder="例如: colleague1@example.com, colleague2@example.com"
            :rows="2"
          />
        </a-form-item>

        <a-form-item label="会议调整或议程说明 (可选)">
          <a-textarea
            v-model:value="formState.remark"
            placeholder="添加会议议程或参会注意事项..."
            :rows="2"
          />
        </a-form-item>

        <a-form-item style="margin-top: 24px">
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="submitting"
            class="submit-btn"
          >
            立即创建预约会议
          </a-button>
        </a-form-item>
      </a-form>

      <!-- 预约成功完成状态卡片 -->
      <div v-else class="success-result-box">
        <a-result
          status="success"
          title="会议预约成功！"
          sub-title="已为您成功预定会议室，受邀联系人将收到包含参会链接的通知。"
        >
          <template #extra>
            <div class="result-details meeting-card">
              <div class="detail-row">
                <span class="label">会议主题：</span>
                <span class="value strong">{{ scheduledResult.meetingName }}</span>
              </div>
              <div class="detail-row">
                <span class="label">会议号：</span>
                <span class="value code">{{ formatMeetingNo(scheduledResult.meetingNo) }}</span>
                <a-button type="link" size="small" @click="handleCopy(scheduledResult.meetingNo, '会议号')">
                  复制
                </a-button>
              </div>
              <div v-if="scheduledResult.password" class="detail-row">
                <span class="label">入会密码：</span>
                <span class="value">{{ scheduledResult.password }}</span>
              </div>
              <div class="detail-row">
                <span class="label">开始时间：</span>
                <span class="value">{{ scheduledResult.startTime }}</span>
              </div>
            </div>

            <div class="result-btn-group">
              <a-button type="primary" size="large" @click="enterScheduledMeeting">
                立即进入该会议室
              </a-button>
              <a-button size="large" @click="handleCopyFullInvite">
                复制完整邀请文案
              </a-button>
              <a-button size="large" @click="resetForm">
                继续预约下一场
              </a-button>
            </div>
          </template>
        </a-result>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { CalendarOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { quickMeeting, updateMeetingTime, sendInviteEmail, generateInvite } from '@/api/meeting'
import { formatMeetingNo, copyText } from '@/utils/format'

const router = useRouter()
const authStore = useAuthStore()

const submitting = ref(false)
const enablePassword = ref(false)
const scheduledResult = ref(null)

const formState = reactive({
  meetingName: `${authStore.nickName || '用户'} 预约的研讨会`,
  timeRange: [dayjs().add(10, 'minute'), dayjs().add(70, 'minute')],
  meetingNoType: 1, // 预约默认随机10位
  jionPassword: '',
  inviteEmails: '',
  remark: ''
})

const rules = {
  meetingName: [
    { required: true, message: '请输入会议主题', trigger: 'blur' }
  ]
}

async function handleSchedule() {
  if (!formState.meetingName.trim()) {
    message.warning('请输入会议主题')
    return
  }
  if (!formState.timeRange || formState.timeRange.length < 2) {
    message.warning('请选择会议开始与结束时间')
    return
  }
  if (enablePassword.value && !formState.jionPassword.trim()) {
    message.warning('您开启了密码保护，请设置密码')
    return
  }

  submitting.value = true
  try {
    const startTimeStr = formState.timeRange[0].format('YYYY-MM-DD HH:mm:ss')
    const endTimeStr = formState.timeRange[1].format('YYYY-MM-DD HH:mm:ss')

    // 1. 调用真实接口 quickMeeting 创建会议
    const meetingId = await quickMeeting({
      meetingNoType: formState.meetingNoType,
      meetingName: formState.meetingName.trim(),
      jionType: enablePassword.value ? 1 : 0,
      jionPassword: enablePassword.value ? formState.jionPassword.trim() : ''
    })

    // 2. 调用真实接口 updateMeetingTime 同步设定的开始与结束时间
    try {
      await updateMeetingTime({
        meetingId,
        startTime: startTimeStr,
        endTime: endTimeStr,
        changeReason: formState.remark || '预约会议安排'
      })
    } catch (e) {
      console.warn('时间更新提示:', e)
    }

    // 3. 若填写了受邀联系人邮箱，调用 sendInviteEmail 发送邮件通知
    if (formState.inviteEmails.trim()) {
      try {
        await sendInviteEmail({
          meetingId,
          emails: formState.inviteEmails.trim(),
          expireHours: 48,
          allowPasswordFree: enablePassword.value ? 0 : 1
        })
      } catch (e) {
        console.warn('邮件发送提示:', e)
      }
    }

    // 4. 获取邀请码与文案
    let inviteInfo = null
    try {
      inviteInfo = await generateInvite({
        meetingId,
        expireHours: 48,
        allowPasswordFree: 1,
        maxUseCount: -1
      })
    } catch (e) {}

    scheduledResult.value = {
      meetingId,
      meetingNo: inviteInfo?.meetingNo || authStore.userId,
      meetingName: formState.meetingName,
      password: enablePassword.value ? formState.jionPassword : '',
      startTime: startTimeStr,
      inviteUrl: inviteInfo?.inviteUrl || '',
      inviteText: inviteInfo?.inviteText || ''
    }

    message.success('预约会议成功！')
  } catch (err) {
    message.error(err.message || '预约会议失败')
  } finally {
    submitting.value = false
  }
}

function enterScheduledMeeting() {
  if (scheduledResult.value?.meetingId) {
    router.push(`/meeting/room/${scheduledResult.value.meetingId}`)
  }
}

async function handleCopy(text, title) {
  const success = await copyText(text)
  if (success) {
    message.success(`${title}已复制`)
  }
}

async function handleCopyFullInvite() {
  const res = scheduledResult.value
  let text = res?.inviteText
  if (!text) {
    text = `【EasyMeeting 预约会议通知】\n会议主题：${res.meetingName}\n开始时间：${res.startTime}\n会议号：${res.meetingNo}${res.password ? `\n密码：${res.password}` : ''}`
  }
  const success = await copyText(text)
  if (success) {
    message.success('完整邀请文案已复制到剪贴板')
  }
}

function resetForm() {
  scheduledResult.value = null
  formState.meetingName = `${authStore.nickName || '用户'} 预约的研讨会`
  formState.inviteEmails = ''
  formState.remark = ''
}
</script>

<style scoped>
.schedule-view {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.schedule-container {
  width: 680px;
  background: #ffffff;
  padding: 32px 36px;
}

.header-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 24px;
}

.icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #fff7e6;
  color: #fa8c16;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 4px;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.pwd-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.submit-btn {
  font-weight: 600;
  letter-spacing: 1px;
}

.result-details {
  background: #f7f8fa;
  padding: 16px 20px;
  border-radius: var(--border-radius-base);
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 480px;
  margin: 0 auto 20px;
  text-align: left;
}

.detail-row {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.detail-row .label {
  color: var(--text-secondary);
  width: 90px;
}

.detail-row .value {
  color: var(--text-main);
  flex: 1;
}

.detail-row .value.strong {
  font-weight: 600;
}

.detail-row .value.code {
  font-family: monospace;
  font-weight: 700;
  color: var(--primary-color);
  font-size: 15px;
}

.result-btn-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
</style>

