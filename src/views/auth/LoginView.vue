<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- 品牌标识 -->
      <div class="brand-header">
        <div class="brand-icon">
          <VideoCameraFilled />
        </div>
        <h1 class="brand-title">EasyMeeting 易会</h1>
        <p class="brand-subtitle">连接每一次沟通，高效协作尽在咫尺</p>
      </div>

      <!-- 登录表单 -->
      <a-form
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="login-form"
        @finish="handleLogin"
      >
        <a-form-item name="email" label="邮箱账号">
          <a-input
            v-model:value="formState.email"
            size="large"
            placeholder="请输入登录邮箱"
            allow-clear
          >
            <template #prefix>
              <MailOutlined style="color: #bfbfbf" />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item name="password" label="密码">
          <a-input-password
            v-model:value="formState.password"
            size="large"
            placeholder="请输入密码"
          >
            <template #prefix>
              <LockOutlined style="color: #bfbfbf" />
            </template>
          </a-input-password>
        </a-form-item>

        <!-- 算术图形验证码 -->
        <a-form-item name="checkCode" label="算术验证码">
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
              title="看不清？点击刷新验证码"
              @click="refreshCaptcha"
            >
              <img
                v-if="captchaBase64"
                :src="captchaBase64"
                alt="图形验证码"
                class="captcha-img"
              />
              <span v-else class="captcha-loading">加载中...</span>
            </div>
            <a-tooltip title="换一张">
              <a-button size="large" shape="circle" @click="refreshCaptcha">
                <ReloadOutlined :spin="captchaLoading" />
              </a-button>
            </a-tooltip>
          </div>
        </a-form-item>

        <div class="form-extra-row">
          <a-checkbox v-model:checked="rememberEmail">记住邮箱</a-checkbox>
          <router-link to="/register" class="register-link">注册新账号</router-link>
        </div>

        <a-form-item style="margin-top: 20px">
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            block
            :loading="submitting"
            class="submit-btn"
          >
            登 录
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  VideoCameraFilled,
  MailOutlined,
  LockOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'
import { getCheckCode, login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const submitting = ref(false)
const captchaLoading = ref(false)
const captchaBase64 = ref('')
const checkCodeKey = ref('')
const rememberEmail = ref(true)

const formState = reactive({
  email: localStorage.getItem('saved_login_email') || '',
  password: '',
  checkCode: null
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱账号', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' }
  ],
  checkCode: [
    { required: true, message: '请输入验证码计算结果', trigger: 'blur' }
  ]
}

async function refreshCaptcha() {
  captchaLoading.value = true
  try {
    const res = await getCheckCode(0) // type=0: 登录/注册验证码
    if (res) {
      checkCodeKey.value = res.checkCodeKey
      captchaBase64.value = res.checkCode
    }
  } catch (err) {
    message.error('获取验证码失败，请检查后端网络连接')
  } finally {
    captchaLoading.value = false
  }
}

async function handleLogin() {
  if (!checkCodeKey.value) {
    message.warning('验证码尚未就绪，请刷新重试')
    return
  }

  submitting.value = true
  try {
    const res = await login({
      email: formState.email,
      password: formState.password,
      checkCodeKey: checkCodeKey.value,
      checkCode: formState.checkCode
    })

    if (rememberEmail.value) {
      localStorage.setItem('saved_login_email', formState.email)
    } else {
      localStorage.removeItem('saved_login_email')
    }

    authStore.setLogin(res.token, res)
    message.success(`欢迎回来，${res.nickName || '用户'}！`)

    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    message.error(err.message || '登录失败，请检查账号密码')
    refreshCaptcha()
    formState.checkCode = null
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<style scoped>
.auth-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 50%, #f5f7fa 100%);
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  padding: 40px 36px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.brand-header {
  text-align: center;
  margin-bottom: 30px;
}

.brand-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  margin: 0 auto 16px;
  box-shadow: 0 8px 20px rgba(22, 119, 255, 0.35);
}

.brand-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
  margin: 0 0 6px;
}

.brand-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.captcha-img-box {
  width: 130px;
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

.form-extra-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.register-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.register-link:hover {
  text-decoration: underline;
}

.submit-btn {
  font-weight: 600;
  letter-spacing: 2px;
}

@media (max-width: 480px) {
  .auth-page {
    padding: 16px 12px;
  }

  .auth-card {
    padding: 26px 18px;
    border-radius: 12px;
  }

  .brand-header {
    margin-bottom: 20px;
  }

  .brand-title {
    font-size: 20px;
  }
}
</style>

