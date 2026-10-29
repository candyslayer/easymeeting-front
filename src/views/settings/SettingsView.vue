<template>
  <div class="settings-view">
    <div class="settings-card meeting-card">
      <h2 class="settings-title">系统与账号设置</h2>

      <a-tabs v-model:activeKey="activeTab" tab-position="left" class="settings-tabs">
        <!-- 标签页 1：音视频设备调试 -->
        <a-tab-pane key="media" tab="音视频设备">
          <div class="tab-pane-container">
            <h3 class="group-title">摄像头设置</h3>
            <div class="camera-preview-row">
              <div class="video-preview-wrapper">
                <video
                  ref="previewVideoEl"
                  autoplay
                  playsinline
                  muted
                  class="preview-video"
                  :class="{ hidden: !isVideoActive }"
                ></video>
                <div v-if="!isVideoActive" class="no-camera-box">
                  <CameraOutlined style="font-size: 36px; color: #86909c" />
                  <span>摄像头画面预览已关闭</span>
                </div>
              </div>
              <div class="preview-actions">
                <a-form layout="vertical">
                  <a-form-item label="选择摄像头">
                    <a-select
                      v-model:value="mediaStore.selectedVideoInputId"
                      style="width: 280px"
                      placeholder="未检测到摄像头设备"
                      @change="handleVideoChange"
                    >
                      <a-select-option
                        v-for="d in mediaStore.videoInputDevices"
                        :key="d.deviceId"
                        :value="d.deviceId"
                      >
                        {{ d.label }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                  <a-button
                    :type="isVideoActive ? 'default' : 'primary'"
                    @click="toggleVideoTest"
                  >
                    {{ isVideoActive ? '关闭预览' : '打开摄像头预览' }}
                  </a-button>
                </a-form>
              </div>
            </div>

            <a-divider />

            <h3 class="group-title">音频与麦克风设置</h3>
            <a-form layout="vertical" style="max-width: 500px">
              <a-form-item label="麦克风输入设备">
                <a-select
                  v-model:value="mediaStore.selectedAudioInputId"
                  placeholder="未检测到麦克风设备"
                  @change="handleAudioChange"
                >
                  <a-select-option
                    v-for="d in mediaStore.audioInputDevices"
                    :key="d.deviceId"
                    :value="d.deviceId"
                  >
                    {{ d.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>

              <!-- 麦克风输入能量测试 -->
              <a-form-item label="麦克风音量能量条测试">
                <div class="meter-row">
                  <a-progress
                    :percent="micVolumeLevel"
                    :show-info="false"
                    stroke-color="#52c41a"
                    style="flex: 1"
                  />
                  <span class="vol-num">{{ micVolumeLevel }}%</span>
                </div>
                <span class="help-text">请对着麦克风说话，如果绿色能量条跳动，说明麦克风工作正常。</span>
              </a-form-item>

              <a-form-item label="扬声器 / 耳机输出设备">
                <a-select
                  v-model:value="mediaStore.selectedAudioOutputId"
                  placeholder="默认音频输出设备"
                  @change="handleSpeakerChange"
                >
                  <a-select-option
                    v-for="d in mediaStore.audioOutputDevices"
                    :key="d.deviceId"
                    :value="d.deviceId"
                  >
                    {{ d.label }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>

        <!-- 标签页 2：个人账号资料编辑 -->
        <a-tab-pane key="profile" tab="个人资料设置">
          <div class="tab-pane-container">
            <h3 class="group-title">编辑个人资料</h3>

            <div class="avatar-edit-section">
              <div class="avatar-box">
                <a-avatar
                  v-if="!avatarImgError"
                  :size="80"
                  :src="avatarPreviewUrl"
                  @error="avatarImgError = true"
                />
                <a-avatar
                  v-else
                  :size="80"
                  :style="{ backgroundColor: '#1677ff', fontSize: '32px' }"
                >
                  {{ profileForm.nickName?.slice(0, 1) || '用' }}
                </a-avatar>
              </div>
              <div class="avatar-upload-action">
                <a-upload
                  :show-upload-list="false"
                  :before-upload="handleBeforeAvatarUpload"
                  accept="image/*"
                >
                  <a-button>
                    <UploadOutlined /> 上传新头像
                  </a-button>
                </a-upload>
                <span class="upload-tip">支持 JPG、PNG 格式图片，大小不超过 5MB</span>
              </div>
            </div>

            <a-form
              :model="profileForm"
              layout="vertical"
              style="max-width: 520px; margin-top: 24px"
              @finish="handleSaveProfile"
            >
              <a-form-item label="账号 ID (个人会议号)">
                <a-input :value="authStore.userId" disabled class="mono-text">
                  <template #suffix>
                    <a-button type="link" size="small" @click="handleCopyId">复制</a-button>
                  </template>
                </a-input>
              </a-form-item>

              <a-form-item label="绑定登录邮箱">
                <a-input :value="authStore.userInfo?.email || '已绑定'" disabled />
              </a-form-item>

              <a-form-item label="用户昵称" required name="nickName">
                <a-input
                  v-model:value="profileForm.nickName"
                  placeholder="请输入您的显示昵称"
                  maxlength="30"
                  allow-clear
                />
              </a-form-item>

              <a-form-item label="性别" name="sex">
                <a-radio-group v-model:value="profileForm.sex">
                  <a-radio :value="1">男</a-radio>
                  <a-radio :value="0">女</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item style="margin-top: 20px">
                <a-button
                  type="primary"
                  html-type="submit"
                  :loading="savingProfile"
                  @click="handleSaveProfile"
                >
                  保存个人资料
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>

        <!-- 标签页 3：修改密码 -->
        <a-tab-pane key="security" tab="安全与密码">
          <div class="tab-pane-container">
            <h3 class="group-title">修改登录密码</h3>
            <p class="subtitle-text">为了您的账号安全，请定期更换密码，密码长度不少于 6 位。</p>

            <a-form
              :model="pwdForm"
              layout="vertical"
              style="max-width: 460px; margin-top: 20px"
              @finish="handleUpdatePassword"
            >
              <a-form-item label="原密码" required name="oldPassword">
                <a-input-password
                  v-model:value="pwdForm.oldPassword"
                  placeholder="请输入当前旧密码"
                  maxlength="32"
                />
              </a-form-item>

              <a-form-item label="新密码" required name="newPassword">
                <a-input-password
                  v-model:value="pwdForm.newPassword"
                  placeholder="请输入新密码（不少于6位）"
                  maxlength="32"
                />
              </a-form-item>

              <a-form-item label="确认新密码" required name="confirmPassword">
                <a-input-password
                  v-model:value="pwdForm.confirmPassword"
                  placeholder="请再次输入新密码确认"
                  maxlength="32"
                />
              </a-form-item>

              <a-form-item style="margin-top: 24px">
                <a-button
                  type="primary"
                  danger
                  html-type="submit"
                  :loading="savingPwd"
                  @click="handleUpdatePassword"
                >
                  确认修改密码
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </a-tab-pane>

        <!-- 标签页 4：网络与系统信息 -->
        <a-tab-pane key="about" tab="网络与系统">
          <div class="tab-pane-container">
            <h3 class="group-title">实时网络拓扑与环境</h3>
            <a-descriptions bordered :column="1" style="max-width: 600px">
              <a-descriptions-item label="客户端版本">
                <span>EasyMeeting Web 1.0.0</span>
              </a-descriptions-item>
              <a-descriptions-item label="前端技术架构">
                <span>Vue 3 + Composition API + Ant Design Vue + Vite</span>
              </a-descriptions-item>
              <a-descriptions-item label="后端 HTTP 服务">
                <span>http://localhost:7008/api</span>
              </a-descriptions-item>
              <a-descriptions-item label="Netty WebSocket 信令">
                <span>ws://localhost:7002/ws</span>
              </a-descriptions-item>
              <a-descriptions-item label="WebRTC 信令模式">
                <span>P2P Full Mesh (端对端网状多路信令中继)</span>
              </a-descriptions-item>
              <a-descriptions-item label="默认 STUN 服务器">
                <span>stun:stun.l.google.com:19302</span>
              </a-descriptions-item>
            </a-descriptions>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { CameraOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'
import { useMediaDevices } from '@/composables/useMediaDevices'
import {
  getUserInfo,
  updateUserInfo,
  updatePassword,
  getAvatarUrl
} from '@/api/auth'
import { copyText } from '@/utils/format'

const route = useRoute()
const authStore = useAuthStore()
const mediaStore = useMediaStore()

const activeTab = ref(route.query.tab || 'media')
const previewVideoEl = ref(null)

// 个人资料表单
const savingProfile = ref(false)
const avatarFile = ref(null)
const avatarPreviewUrl = ref(getAvatarUrl(authStore.userId))
const avatarImgError = ref(false)

const profileForm = reactive({
  nickName: authStore.nickName || '',
  sex: authStore.userSex ?? 1
})

// 修改密码表单
const savingPwd = ref(false)
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const {
  localStream,
  isAudioActive,
  isVideoActive,
  micVolumeLevel,
  enumerateDevices,
  initLocalStream,
  toggleVideo,
  stopLocalStream,
  startMicMeter,
  stopMicMeter
} = useMediaDevices()

// 监听标签页切换：仅当停留在“音视频设备”标签页时开启摄像头与麦克风，切换到个人资料等其它标签页时彻底释放硬件
watch(activeTab, async (newTab) => {
  if (newTab === 'media') {
    await initSettingsPreview()
  } else {
    stopSettingsPreview()
  }
})

// 监听路由参数变化（方便从外部带 query 跳转指定标签页）
watch(
  () => route.query.tab,
  (tab) => {
    if (tab && tab !== activeTab.value) {
      activeTab.value = tab
    }
  }
)

async function fetchLatestUserInfo() {
  try {
    const info = await getUserInfo()
    if (info) {
      if (info.nickName) profileForm.nickName = info.nickName
      if (info.sex !== undefined) profileForm.sex = info.sex
      authStore.updateUserInfo(info)
      avatarPreviewUrl.value = getAvatarUrl(authStore.userId)
      avatarImgError.value = false
    }
  } catch (e) {
    console.warn('获取最新用户信息失败:', e)
  }
}

function handleBeforeAvatarUpload(file) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    message.error('请选择有效的图片文件！')
    return false
  }
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isLt5M) {
    message.error('头像图片大小不能超过 5MB！')
    return false
  }

  avatarFile.value = file
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarImgError.value = false

  // 立即触发资料更新保存头像
  handleSaveProfile()
  return false
}

async function handleSaveProfile() {
  if (savingProfile.value) return
  if (!profileForm.nickName || !profileForm.nickName.trim()) {
    message.warning('请输入用户昵称')
    return
  }

  savingProfile.value = true
  try {
    const res = await updateUserInfo({
      nickName: profileForm.nickName.trim(),
      sex: profileForm.sex,
      avatar: avatarFile.value || undefined
    })

    authStore.updateUserInfo(res || {
      nickName: profileForm.nickName.trim(),
      sex: profileForm.sex
    })

    avatarFile.value = null
    avatarPreviewUrl.value = getAvatarUrl(authStore.userId)
    avatarImgError.value = false

    message.success('个人资料已成功更新！')
  } catch (err) {
    message.error(err.message || '更新个人资料失败')
  } finally {
    savingProfile.value = false
  }
}

async function handleUpdatePassword() {
  if (savingPwd.value) return
  if (!pwdForm.oldPassword) {
    message.warning('请输入当前原密码')
    return
  }
  if (!pwdForm.newPassword) {
    message.warning('请输入新密码')
    return
  }
  if (pwdForm.newPassword.length < 6) {
    message.warning('新密码长度不能少于 6 位')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    message.warning('两次输入的新密码不一致，请检查')
    return
  }

  savingPwd.value = true
  try {
    await updatePassword({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    })

    message.success('密码修改成功，请牢记您的新密码！')
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
  } catch (err) {
    message.error(err.message || '修改密码失败')
  } finally {
    savingPwd.value = false
  }
}

async function handleCopyId() {
  if (authStore.userId) {
    const success = await copyText(authStore.userId)
    if (success) {
      message.success('用户 ID 已复制')
    }
  }
}

async function initSettingsPreview() {
  await enumerateDevices()
  try {
    const stream = await initLocalStream({ audio: true, video: true })
    await nextTick()
    if (previewVideoEl.value && stream) {
      previewVideoEl.value.srcObject = stream
    }
    startMicMeter(stream)
  } catch (e) {
    console.warn('打开设置预览失败:', e)
  }
}

function stopSettingsPreview() {
  stopMicMeter()
  stopLocalStream()
  if (previewVideoEl.value) {
    previewVideoEl.value.srcObject = null
  }
}

function handleVideoChange(id) {
  mediaStore.setSelectedVideoInput(id)
  initSettingsPreview()
}

function handleAudioChange(id) {
  mediaStore.setSelectedAudioInput(id)
  initSettingsPreview()
}

function handleSpeakerChange(id) {
  mediaStore.setSelectedAudioOutput(id)
}

async function toggleVideoTest() {
  if (isVideoActive.value) {
    // 关闭预览：停止视频轨道以释放摄像头硬件并熄灭指示灯
    if (localStream.value) {
      localStream.value.getVideoTracks().forEach((track) => {
        track.stop()
        localStream.value.removeTrack(track)
      })
    }
    isVideoActive.value = false
    mediaStore.setCameraOff(true)
    if (previewVideoEl.value) {
      previewVideoEl.value.srcObject = null
    }
  } else {
    // 重新开启摄像头预览
    try {
      const constraints = {
        video: mediaStore.selectedVideoInputId
          ? {
              deviceId: { exact: mediaStore.selectedVideoInputId },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            }
          : { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
        audio: false
      }
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newTrack = newStream.getVideoTracks()[0]
      if (newTrack) {
        if (localStream.value) {
          localStream.value.addTrack(newTrack)
        } else {
          localStream.value = newStream
        }
        isVideoActive.value = true
        mediaStore.setCameraOff(false)
        await nextTick()
        if (previewVideoEl.value) {
          previewVideoEl.value.srcObject = localStream.value
        }
      }
    } catch (e) {
      console.error('开启摄像头预览失败:', e)
      message.error('无法启动摄像头预览，请检查设备与权限')
    }
  }
}

onMounted(() => {
  if (activeTab.value === 'media') {
    initSettingsPreview()
  }
  fetchLatestUserInfo()
})

onUnmounted(() => {
  stopSettingsPreview()
})
</script>

<style scoped>
.settings-view {
  max-width: 1000px;
  margin: 0 auto;
}

.settings-card {
  background: #ffffff;
  padding: 28px 32px;
  border-radius: var(--border-radius-card);
  min-height: calc(100vh - var(--header-height) - 48px);
}

.settings-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 24px;
}

.settings-tabs :deep(.ant-tabs-nav) {
  width: 160px;
}

.tab-pane-container {
  padding-left: 24px;
}

.group-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0 0 16px;
}

.subtitle-text {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.avatar-edit-section {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
  background: var(--bg-gray);
  border-radius: 8px;
  max-width: 520px;
}

.avatar-upload-action {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upload-tip {
  font-size: 12px;
  color: var(--text-tertiary);
}

.camera-preview-row {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.video-preview-wrapper {
  width: 320px;
  height: 200px;
  background: #1e1e24;
  border-radius: var(--border-radius-base);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.preview-video.hidden {
  display: none;
}

.no-camera-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.preview-actions {
  flex: 1;
}

.meter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vol-num {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-secondary);
  width: 36px;
}

.help-text {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-top: 4px;
}

.mono-text {
  font-family: monospace;
  font-weight: 600;
}
</style>
