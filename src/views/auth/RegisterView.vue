<template>
  <div class="auth-page">
    <div class="auth-card register-card">
      <div class="brand-header">
        <div class="brand-icon">
          <VideoCameraFilled />
        </div>
        <h1 class="brand-title">注册 EasyMeeting 账号</h1>
        <p class="brand-subtitle">开启全高清、低延时的音视频协同新体验</p>
      </div>

      <a-form
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="register-form"
        @finish="handleRegister"
      >
        <!-- 邮箱 -->
        <a-form-item name="email" label="电子邮箱">
          <a-input
            v-model:value="formState.email"
            size="large"
            placeholder="请输入您的邮箱地址"
            allow-clear
          >
            <template #prefix>
              <MailOutlined style="color: #bfbfbf" />
            </template>
          </a-input>
        </a-form-item>

        <!-- 发送邮件所需的图形验证码 (type=1) -->
        <a-form-item label="图形验证码 (发送邮件前校验)">
          <div class="captcha-row">
            <a-input-number
              v-model:value="emailCheckCode"
              size="large"
              placeholder="计算结果"
              :controls="false"
              style="flex: 1"
            />
            <div
              class="captcha-img-box"
              title="点击刷新"
              @click="refreshEmailCaptcha"
            >
              <img
                v-if="emailCaptchaBase64"
                :src="emailCaptchaBase64"
                alt="图形码"
                class="captcha-img"
              />
              <span v-else class="captcha-loading">加载中</span>
            </div>
            <a-button
              type="primary"
              size="large"
              :disabled="countdown > 0 || !formState.email || emailCheckCode === null"
              :loading="sendingEmail"
              @click="handleSendEmailCode"
            >
              {{ countdown > 0 ? `${countdown}s 后重新发送` : '获取邮箱验证码' }}
            </a-button>
          </div>
        </a-form-item>

        <!-- 邮箱收到的验证码 -->
        <a-form-item name="emailCode" label="邮箱收到的验证码">
          <a-input
            v-model:value="formState.emailCode"
            size="large"
            placeholder="请输入邮箱中的 6 位验证码"
          >
            <template #prefix>
              <SafetyCertificateOutlined style="color: #bfbfbf" />
            </template>
          </a-input>
        </a-form-item>

        <!-- 昵称 -->
        <a-form-item name="nickName" label="用户昵称">
          <a-input
            v-model:value="formState.nickName"
            size="large"
            placeholder="例如: 张三 / Alex"
          >
            <template #prefix>
              <UserOutlined style="color: #bfbfbf" />
            </template>
          </a-input>
        </a-form-item>

        <!-- 密码 -->
        <a-form-item name="password" label="设置登录密码">
          <a-input-password
            v-model:value="formState.password"
            size="large"
            placeholder="至少 6 位字符"
          >
            <template #prefix>
              <LockOutlined style="color: #bfbfbf" />
            </template>
          </a-input-password>
        </a-form-item>

        <!-- 注册提交算术图形验证码 (type=0) -->
        <a-form-item name="checkCode" label="防机器人注册验证码">
          <div class="captcha-row">
            <a-input-number
              v-model:value="formState.checkCode"
              size="large"
              placeholder="计算结果"
              :controls="false"
              style="flex: 1"
            />
            <div
              class="captcha-img-box"
              title="点击刷新"
              @click="refreshSubmitCaptcha"
            >
              <img
                v-if="submitCaptchaBase64"
                :src="submitCaptchaBase64"
                alt="注册图形码"
                class="captcha-img"
              />
              <span v-else class="captcha-loading">加载中</span>
            </div>
            <a-tooltip title="换一张">
              <a-button size="large" shape="circle" @click="refreshSubmitCaptcha">
                <ReloadOutlined :spin="submitCaptchaLoading" />
              </a-button>
            </a-tooltip>
          </div>
        </a-form-item>

        <a-form-item style="margin-top: 10px">
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="submitting"
            class="submit-btn"
          >
            注 册 账 号
          </a-button>
        </a-form-item>

        <div class="login-footer-row">
          <span>已有 EasyMeeting 账号？</span>
          <router-link to="/login" class="login-link">直接登录</router-link>
        </div>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  VideoCameraFilled,
  MailOutlined,
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'
import { getCheckCode, sendEmailCode, register } from '@/api/auth'

const router = useRouter()

const submitting = ref(false)
const sendingEmail = ref(false)
const countdown = ref(0)
let timer = null

// 发送邮箱图形验证码 (type=1)
const emailCaptchaBase64 = ref('')
const emailCheckCodeKey = ref('')
const emailCheckCode = ref(null)

// 注册提交图形验证码 (type=0)
const submitCaptchaLoading = ref(false)
const submitCaptchaBase64 = ref('')
const submitCheckCodeKey = ref('')

const formState = reactive({
  email: '',
  emailCode: '',
  nickName: '',
  password: '',
  checkCode: null
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不合法', trigger: 'blur' }
  ],
  emailCode: [
    { required: true, message: '请输入邮箱收到的验证码', trigger: 'blur' }
  ],
  nickName: [
    { required: true, message: '请输入用户昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '昵称长度为 2-20 位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码不能少于 6 位', trigger: 'blur' }
  ],
  checkCode: [
    { required: true, message: '请输入计算验证码', trigger: 'blur' }
  ]
}

async function refreshEmailCaptcha() {
  try {
    const res = await getCheckCode(1) // type=1
    if (res) {
      emailCheckCodeKey.value = res.checkCodeKey
      emailCaptchaBase64.value = res.checkCode
    }
  } catch (err) {
    console.error('获取邮箱图形码失败:', err)
  }
}

async function refreshSubmitCaptcha() {
  submitCaptchaLoading.value = true
  try {
    const res = await getCheckCode(0) // type=0
    if (res) {
      submitCheckCodeKey.value = res.checkCodeKey
      submitCaptchaBase64.value = res.checkCode
    }
  } catch (err) {
    console.error('获取注册图形码失败:', err)
  } finally {
    submitCaptchaLoading.value = false
  }
}

async function handleSendEmailCode() {
  if (!formState.email) {
    message.warning('请先输入有效的邮箱账号')
    return
  }
  if (emailCheckCode.value === null) {
    message.warning('请输入图形验证码计算结果')
    return
  }

  sendingEmail.value = true
  try {
    await sendEmailCode({
      email: formState.email,
      checkCodeKey: emailCheckCodeKey.value,
      checkCode: emailCheckCode.value,
      type: 0
    })
    message.success('验证码已发送至您的邮箱，请在 15 分钟内完成注册')
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (err) {
    message.error(err.message || '发送邮箱验证码失败')
    refreshEmailCaptcha()
    emailCheckCode.value = null
  } finally {
    sendingEmail.value = false
  }
}

async function handleRegister() {
  if (!submitCheckCodeKey.value) {
    message.warning('防刷验证码未就绪，请刷新重试')
    return
  }

  submitting.value = true
  try {
    await register({
      email: formState.email,
      nickName: formState.nickName,
      password: formState.password,
      emailCode: formState.emailCode,
      checkCodeKey: submitCheckCodeKey.value,
      checkCode: formState.checkCode
    })

    message.success('注册成功！正在前往登录页...')
    setTimeout(() => {
      router.push('/login')
    }, 1000)
  } catch (err) {
    message.error(err.message || '注册失败')
    refreshSubmitCaptcha()
    formState.checkCode = null
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  refreshEmailCaptcha()
  refreshSubmitCaptcha()
})
</script>

<style scoped>
.auth-page {
  width: 100vw;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 50%, #f5f7fa 100%);
  padding: 30px 20px;
}

.register-card {
  width: 480px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  padding: 36px 36px;
}

.brand-header {
  text-align: center;
  margin-bottom: 24px;
}

.brand-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  margin: 0 auto 12px;
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.3);
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
  margin: 0 0 4px;
}

.brand-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.captcha-img-box {
  width: 110px;
  height: 40px;
  background: #f7f8fa;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.captcha-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.captcha-loading {
  font-size: 11px;
  color: var(--text-secondary);
}

.login-footer-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 14px;
}

.login-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}

.login-link:hover {
  text-decoration: underline;
}

.submit-btn {
  font-weight: 600;
  letter-spacing: 2px;
}
</style>

