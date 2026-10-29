<template>
  <div class="settings-view">
    <div class="settings-card meeting-card">
      <h2 class="settings-title">系统与设备设置</h2>

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

        <!-- 标签页 2：个人账号资料 -->
        <a-tab-pane key="profile" tab="个人资料">
          <div class="tab-pane-container">
            <h3 class="group-title">当前登录用户信息</h3>

            <a-descriptions bordered :column="1" style="max-width: 600px">
              <a-descriptions-item label="用户头像">
                <a-avatar :size="48" :style="{ backgroundColor: '#1677ff', fontSize: '20px' }">
                  {{ authStore.nickName?.slice(0, 1) || '用' }}
                </a-avatar>
              </a-descriptions-item>
              <a-descriptions-item label="用户标识 (ID)">
                <span class="mono-text">{{ authStore.userId }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="用户昵称">
                <span>{{ authStore.nickName }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="登录邮箱">
                <span>{{ authStore.userInfo?.email || '已绑定' }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="性别">
                <span>{{ authStore.userSex === 1 ? '男' : '女' }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="管理员权限">
                <a-tag :color="authStore.isAdmin ? 'gold' : 'default'">
                  {{ authStore.isAdmin ? '管理员' : '普通用户' }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="登录凭据状态">
                <a-tag color="success">有效凭据 (Redis Token 有效期 7 天)</a-tag>
              </a-descriptions-item>
            </a-descriptions>

            <a-alert
              type="info"
              show-icon
              style="margin-top: 20px; max-width: 600px"
              message="后端接口说明"
              description="根据项目审计结果，当前后端服务仅提供查询验证，修改昵称、头像和密码接口待 Java 后端后续迭代开放。"
            />
          </div>
        </a-tab-pane>

        <!-- 标签页 3：网络与系统信息 -->
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
import { ref, onMounted, onUnmounted } from 'vue'
import { CameraOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'
import { useMediaDevices } from '@/composables/useMediaDevices'

const authStore = useAuthStore()
const mediaStore = useMediaStore()

const activeTab = ref('media')
const previewVideoEl = ref(null)

const {
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

async function initSettingsPreview() {
  await enumerateDevices()
  try {
    const stream = await initLocalStream({ audio: true, video: true })
    if (previewVideoEl.value && stream) {
      previewVideoEl.value.srcObject = stream
    }
    startMicMeter(stream)
  } catch (e) {
    console.warn('打开设置预览失败:', e)
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

function toggleVideoTest() {
  toggleVideo()
}

onMounted(() => {
  initSettingsPreview()
})

onUnmounted(() => {
  stopMicMeter()
  stopLocalStream()
  if (previewVideoEl.value) {
    previewVideoEl.value.srcObject = null
  }
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

