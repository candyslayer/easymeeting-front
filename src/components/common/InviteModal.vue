<template>
  <a-modal
    v-model:open="visible"
    title="邀请成员加入会议"
    width="580px"
    :footer="null"
    @cancel="handleClose"
  >
    <div class="invite-modal-body">
      <a-tabs v-model:activeKey="activeTab">
        <!-- 标签页 1：链接与文案复制 -->
        <a-tab-pane key="copy" tab="复制邀请信息">
          <div class="info-card">
            <div class="info-row">
              <span class="label">会议主题：</span>
              <span class="val strong">{{ meetingInfo?.meetingName || '在线视频会议' }}</span>
            </div>
            <div class="info-row">
              <span class="label">会议号：</span>
              <span class="val highlight">{{ formattedMeetingNo }}</span>
              <a-button type="link" size="small" @click="handleCopy(meetingInfo?.meetingNo, '会议号')">
                <CopyOutlined /> 复制
              </a-button>
            </div>
            <div v-if="meetingInfo?.jionPassword" class="info-row">
              <span class="label">入会密码：</span>
              <span class="val">{{ meetingInfo.jionPassword }}</span>
              <a-button type="link" size="small" @click="handleCopy(meetingInfo.jionPassword, '密码')">
                <CopyOutlined /> 复制
              </a-button>
            </div>
            <div v-if="inviteData?.inviteCode" class="info-row">
              <span class="label">专属邀请码：</span>
              <span class="val code-badge">{{ inviteData.inviteCode }}</span>
              <a-button type="link" size="small" @click="handleCopy(inviteData.inviteCode, '邀请码')">
                <CopyOutlined /> 复制
              </a-button>
            </div>
            <div v-if="inviteData?.inviteUrl" class="info-row">
              <span class="label">直达入会链接：</span>
              <span class="val link-text ellipsis">{{ inviteData.inviteUrl }}</span>
              <a-button type="link" size="small" @click="handleCopy(inviteData.inviteUrl, '入会链接')">
                <CopyOutlined /> 复制
              </a-button>
            </div>
          </div>

          <div class="action-bar">
            <a-button
              type="primary"
              block
              size="large"
              :loading="generating"
              @click="handleCopyFullInvite"
            >
              <CopyOutlined /> 一键复制完整邀请信息
            </a-button>
          </div>
        </a-tab-pane>

        <!-- 标签页 2：邮件邀请函发送 -->
        <a-tab-pane key="email" tab="邮件直接邀请">
          <a-form layout="vertical" class="email-form">
            <a-form-item label="参会人邮箱地址" required extra="多个邮箱地址请用英文逗号 (,) 分隔">
              <a-textarea
                v-model:value="emailForm.emails"
                placeholder="例如: user1@example.com, user2@example.com"
                :rows="3"
              />
            </a-form-item>

            <a-form-item label="链接有效期与权限">
              <div class="options-row">
                <a-select v-model:value="emailForm.expireHours" style="width: 140px">
                  <a-select-option :value="2">2 小时内有效</a-select-option>
                  <a-select-option :value="12">12 小时内有效</a-select-option>
                  <a-select-option :value="24">24 小时内有效</a-select-option>
                  <a-select-option :value="72">3 天内有效</a-select-option>
                </a-select>
                <a-checkbox v-model:checked="emailForm.allowPasswordFree">
                  允许收件人免密一键入会
                </a-checkbox>
              </div>
            </a-form-item>

            <a-button
              type="primary"
              block
              size="large"
              :loading="sendingEmail"
              @click="handleSendEmail"
            >
              <MailOutlined /> 发送会议邀请邮件
            </a-button>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined, MailOutlined } from '@ant-design/icons-vue'
import { generateInvite, sendInviteEmail } from '@/api/meeting'
import { formatMeetingNo, copyText } from '@/utils/format'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  meetingInfo: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:open'])

const visible = ref(props.open)
const activeTab = ref('copy')
const inviteData = ref(null)
const generating = ref(false)
const sendingEmail = ref(false)

const emailForm = ref({
  emails: '',
  expireHours: 24,
  allowPasswordFree: true
})

const formattedMeetingNo = computed(() => {
  return formatMeetingNo(props.meetingInfo?.meetingNo)
})

watch(
  () => props.open,
  (val) => {
    visible.value = val
    if (val && props.meetingInfo?.meetingId) {
      loadInviteDetails()
    }
  }
)

async function loadInviteDetails() {
  if (!props.meetingInfo?.meetingId) return
  generating.value = true
  try {
    const res = await generateInvite({
      meetingId: props.meetingInfo.meetingId,
      expireHours: 24,
      allowPasswordFree: 1,
      maxUseCount: -1
    })
    inviteData.value = res
  } catch (err) {
    console.error('生成邀请失败:', err)
  } finally {
    generating.value = false
  }
}

async function handleCopy(text, title) {
  if (!text) return
  const success = await copyText(text)
  if (success) {
    message.success(`${title}已复制到剪贴板`)
  } else {
    message.error('复制失败，请手动选取复制')
  }
}

async function handleCopyFullInvite() {
  let fullText = inviteData.value?.inviteText
  if (!fullText) {
    const pwdText = props.meetingInfo.jionPassword ? `\n会议密码：${props.meetingInfo.jionPassword}` : ''
    fullText = `【EasyMeeting 会议邀请】\n会议主题：${props.meetingInfo.meetingName}\n会议号：${props.meetingInfo.meetingNo}${pwdText}\n点击链接直接加入：${inviteData.value?.inviteUrl || window.location.origin + '/meeting/join'}`
  }

  const success = await copyText(fullText)
  if (success) {
    message.success('完整会议邀请信息已复制到剪贴板')
  } else {
    message.error('复制失败，请手动选取')
  }
}

async function handleSendEmail() {
  if (!emailForm.value.emails.trim()) {
    message.warning('请填写至少一个接收人邮箱')
    return
  }

  sendingEmail.value = true
  try {
    await sendInviteEmail({
      meetingId: props.meetingInfo.meetingId,
      emails: emailForm.value.emails.trim(),
      expireHours: emailForm.value.expireHours,
      allowPasswordFree: emailForm.value.allowPasswordFree ? 1 : 0
    })
    message.success('会议邀请邮件已成功发送')
    emailForm.value.emails = ''
  } catch (err) {
    message.error(err.message || '发送邀请邮件失败')
  } finally {
    sendingEmail.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}
</script>

<style scoped>
.invite-modal-body {
  padding-top: 8px;
}

.info-card {
  background: #f7f8fa;
  border-radius: var(--border-radius-base);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.label {
  color: var(--text-secondary);
  width: 100px;
  flex-shrink: 0;
}

.val {
  color: var(--text-main);
  flex: 1;
}

.val.strong {
  font-weight: 600;
}

.val.highlight {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary-color);
  letter-spacing: 0.5px;
}

.code-badge {
  font-family: monospace;
  font-weight: 600;
  background: #e6f4ff;
  color: #1677ff;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.link-text {
  max-width: 320px;
  color: var(--primary-color);
  font-size: 13px;
}

.action-bar {
  margin-top: 10px;
}

.options-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

@media (max-width: 540px) {
  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .label {
    width: 100%;
  }

  .link-text {
    max-width: 100%;
    word-break: break-all;
  }
}
</style>

