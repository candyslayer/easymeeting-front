<template>
  <a-modal
    v-model:open="visible"
    title="音视频设备设置与调试"
    width="640px"
    :footer="null"
    @cancel="handleClose"
  >
    <div class="device-modal-body">
      <!-- 摄像头实时画面预览 -->
      <div class="video-preview-box">
        <video
          ref="videoEl"
          autoplay
          playsinline
          muted
          class="preview-video"
          :class="{ hidden: !isVideoActive }"
        ></video>
        <div v-if="!isVideoActive" class="no-video-placeholder">
          <CameraOutlined style="font-size: 40px; color: #86909c" />
          <span>摄像头已关闭或不可用</span>
        </div>
      </div>

      <!-- 设备选择与调试控件 -->
      <a-form layout="vertical" class="device-form">
        <!-- 摄像头选择 -->
        <a-form-item label="摄像头设备">
          <div class="select-row">
            <a-select
              v-model:value="mediaStore.selectedVideoInputId"
              placeholder="选择摄像头"
              style="flex: 1"
              @change="handleVideoDeviceChange"
            >
              <a-select-option
                v-for="d in mediaStore.videoInputDevices"
                :key="d.deviceId"
                :value="d.deviceId"
              >
                {{ d.label }}
              </a-select-option>
            </a-select>
            <a-button
              :type="isVideoActive ? 'default' : 'primary'"
              @click="toggleCameraTest"
            >
              {{ isVideoActive ? '关闭摄像头' : '打开摄像头' }}
            </a-button>
          </div>
        </a-form-item>

        <!-- 麦克风选择与音量测试 -->
        <a-form-item label="麦克风设备">
          <div class="select-row">
            <a-select
              v-model:value="mediaStore.selectedAudioInputId"
              placeholder="选择麦克风"
              style="flex: 1"
              @change="handleAudioDeviceChange"
            >
              <a-select-option
                v-for="d in mediaStore.audioInputDevices"
                :key="d.deviceId"
                :value="d.deviceId"
              >
                {{ d.label }}
              </a-select-option>
            </a-select>
            <a-button
              :type="isAudioActive ? 'default' : 'primary'"
              @click="toggleMicTest"
            >
              {{ isAudioActive ? '静音' : '开启' }}
            </a-button>
          </div>

          <!-- 动态麦克风音量能量条 -->
          <div class="mic-meter-box">
            <span class="meter-label">输入音量：</span>
            <a-progress
              :percent="micVolumeLevel"
              :show-info="false"
              stroke-color="#52c41a"
              style="flex: 1; margin: 0"
            />
          </div>
        </a-form-item>

        <!-- 扬声器输出选择 -->
        <a-form-item label="扬声器 / 耳机输出">
          <a-select
            v-model:value="mediaStore.selectedAudioOutputId"
            placeholder="选择音频输出设备"
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
  </a-modal>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { CameraOutlined } from '@ant-design/icons-vue'
import { useMediaStore } from '@/stores/media'
import { useMediaDevices } from '@/composables/useMediaDevices'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:open'])

const visible = ref(props.open)
watch(
  () => props.open,
  (val) => {
    visible.value = val
    if (val) {
      startPreview()
    } else {
      stopPreview()
    }
  }
)

const videoEl = ref(null)
const mediaStore = useMediaStore()
const {
  localStream,
  isAudioActive,
  isVideoActive,
  micVolumeLevel,
  enumerateDevices,
  initLocalStream,
  toggleAudio,
  toggleVideo,
  stopLocalStream,
  startMicMeter,
  stopMicMeter
} = useMediaDevices()

async function startPreview() {
  await enumerateDevices()
  try {
    const stream = await initLocalStream({ audio: true, video: true })
    if (videoEl.value && stream) {
      videoEl.value.srcObject = stream
    }
    startMicMeter(stream)
  } catch (e) {
    console.warn('开启预览流失败:', e)
  }
}

function stopPreview() {
  stopMicMeter()
  stopLocalStream()
  if (videoEl.value) {
    videoEl.value.srcObject = null
  }
}

function handleVideoDeviceChange(id) {
  mediaStore.setSelectedVideoInput(id)
  startPreview()
}

function handleAudioDeviceChange(id) {
  mediaStore.setSelectedAudioInput(id)
  startPreview()
}

function handleSpeakerChange(id) {
  mediaStore.setSelectedAudioOutput(id)
}

function toggleCameraTest() {
  toggleVideo()
}

function toggleMicTest() {
  toggleAudio()
}

function handleClose() {
  stopPreview()
  emit('update:open', false)
}

onUnmounted(() => {
  stopPreview()
})
</script>

<style scoped>
.device-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.video-preview-box {
  width: 100%;
  height: 240px;
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
  transform: scaleX(-1); /* 镜像镜像显示 */
}

.preview-video.hidden {
  display: none;
}

.no-video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
}

.select-row {
  display: flex;
  gap: 10px;
}

.mic-meter-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 6px 12px;
  background: #f5f7fa;
  border-radius: var(--border-radius-base);
}

.meter-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>

