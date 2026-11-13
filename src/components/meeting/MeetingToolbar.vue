<template>
  <aside class="meeting-toolbar">
    <div class="toolbar-inner">
      <!-- 左侧：麦克风与摄像头 + 设备下拉切换 -->
      <div class="toolbar-section section-left">
        <!-- 麦克风组合按钮 -->
        <div class="media-combo-group">
          <button
            type="button"
            class="tool-btn combo-main"
            :class="{ danger: !isAudioActive }"
            @click="emit('toggleAudio')"
          >
            <MeetingIcon
              :name="isAudioActive ? 'mic' : 'mic_off'"
              :size="21"
              class="tool-icon"
            />
            <span class="tool-label">{{ isAudioActive ? '静音' : '解除静音' }}</span>
          </button>

          <a-dropdown placement="topLeft" trigger="click">
            <button type="button" class="combo-arrow-btn" title="切换麦克风设备">
              <MeetingIcon name="expand_less" :size="16" />
            </button>
            <template #overlay>
              <a-menu @click="handleAudioMenuClick">
                <a-menu-item-group title="选择麦克风">
                  <a-menu-item
                    v-for="dev in audioDevices"
                    :key="dev.deviceId"
                    :class="{ 'ant-dropdown-menu-item-selected': dev.deviceId === selectedAudioDeviceId }"
                  >
                    {{ dev.label }}
                  </a-menu-item>
                  <a-menu-item v-if="audioDevices.length === 0" disabled key="__empty_audio">
                    未检测到其他麦克风
                  </a-menu-item>
                </a-menu-item-group>
                <a-menu-divider />
                <a-menu-item key="__open_settings">音频设备调试...</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>

        <!-- 摄像头组合按钮 -->
        <div class="media-combo-group">
          <button
            type="button"
            class="tool-btn combo-main"
            :class="{ danger: !isVideoActive }"
            @click="emit('toggleVideo')"
          >
            <MeetingIcon
              :name="isVideoActive ? 'videocam' : 'videocam_off'"
              :size="21"
              class="tool-icon"
            />
            <span class="tool-label">{{ isVideoActive ? '停止视频' : '开启视频' }}</span>
          </button>

          <a-dropdown placement="topLeft" trigger="click">
            <button type="button" class="combo-arrow-btn" title="切换摄像头设备">
              <MeetingIcon name="expand_less" :size="16" />
            </button>
            <template #overlay>
              <a-menu @click="handleVideoMenuClick">
                <a-menu-item-group title="选择摄像头">
                  <a-menu-item
                    v-for="dev in videoDevices"
                    :key="dev.deviceId"
                    :class="{ 'ant-dropdown-menu-item-selected': dev.deviceId === selectedVideoDeviceId }"
                  >
                    {{ dev.label }}
                  </a-menu-item>
                  <a-menu-item v-if="videoDevices.length === 0" disabled key="__empty_video">
                    未检测到其他摄像头
                  </a-menu-item>
                </a-menu-item-group>
                <a-menu-divider />
                <a-menu-item key="__open_settings">视频设备调试...</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>

      <!-- 中间：核心协同与互动工具 -->
      <div class="toolbar-section section-center">
        <!-- AI 字幕 -->
        <button
          type="button"
          class="tool-btn"
          :class="{ active: isSubtitlesOpen }"
          @click="emit('toggleSubtitles')"
        >
          <MeetingIcon name="auto_awesome" :size="20" class="tool-icon icon-primary" />
          <span class="tool-label">AI 字幕</span>
        </button>

        <!-- 共享屏幕（主行动按钮） -->
        <button
          type="button"
          class="tool-btn share-primary-btn"
          :class="{ sharing: isScreenSharing }"
          @click="emit('toggleScreenShare')"
        >
          <MeetingIcon
            :name="isScreenSharing ? 'stop_screen_share' : 'screen_share'"
            :size="20"
            class="tool-icon"
          />
          <span class="tool-label">{{ isScreenSharing ? '停止共享' : '共享屏幕' }}</span>
        </button>

        <!-- 参会人 -->
        <button
          type="button"
          class="tool-btn"
          :class="{ active: isParticipantsOpen }"
          @click="emit('toggleParticipants')"
        >
          <MeetingIcon name="group" :size="20" class="tool-icon" />
          <span class="tool-label">参会人({{ memberCount }})</span>
          <span v-if="memberCount > 1" class="online-dot"></span>
        </button>

        <!-- 举手 / 互动 -->
        <button
          type="button"
          class="tool-btn"
          :class="{ 'hand-active': isHandRaised }"
          @click="emit('toggleHandRaise')"
        >
          <MeetingIcon name="pan_tool" :size="20" class="tool-icon" />
          <span class="tool-label">{{ isHandRaised ? '已举手' : '举手/互动' }}</span>
        </button>

        <!-- 实时转写 / 纪要状态 -->
        <button
          type="button"
          class="tool-btn"
          :class="{ 'rec-active': isTranscribing }"
          @click="emit('toggleTranscription')"
        >
          <MeetingIcon
            name="radio_button_checked"
            :size="20"
            class="tool-icon"
            :class="{ 'icon-error': isTranscribing }"
          />
          <span class="tool-label">{{ isTranscribing ? '纪要中' : '开启纪要' }}</span>
        </button>
      </div>

      <!-- 右侧：聊天、移动端协同入口与设备设置 -->
      <div class="toolbar-section section-right">
        <button
          type="button"
          class="tool-btn mobile-ai-trigger"
          :class="{ active: isAiOpen }"
          @click="emit('toggleAi')"
        >
          <MeetingIcon name="neurology" :size="20" class="tool-icon icon-primary" />
          <span class="tool-label">Copilot</span>
        </button>

        <button
          type="button"
          class="tool-btn"
          :class="{ active: isChatOpen }"
          @click="emit('toggleChat')"
        >
          <a-badge :count="unreadChatCount" :overflow-count="99" :offset="[6, -2]">
            <MeetingIcon name="chat" :size="20" class="tool-icon" />
          </a-badge>
          <span class="tool-label">聊天</span>
        </button>

        <button
          type="button"
          class="tool-btn"
          @click="emit('openSettings')"
        >
          <MeetingIcon name="settings" :size="20" class="tool-icon" />
          <span class="tool-label">设置</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import MeetingIcon from '@/components/meeting/MeetingIcon.vue'

defineProps({
  isAudioActive: { type: Boolean, default: true },
  isVideoActive: { type: Boolean, default: true },
  isScreenSharing: { type: Boolean, default: false },
  memberCount: { type: Number, default: 1 },
  unreadChatCount: { type: Number, default: 0 },
  isParticipantsOpen: { type: Boolean, default: false },
  isChatOpen: { type: Boolean, default: false },
  isSubtitlesOpen: { type: Boolean, default: true },
  isHandRaised: { type: Boolean, default: false },
  isTranscribing: { type: Boolean, default: false },
  isAiOpen: { type: Boolean, default: false },
  audioDevices: { type: Array, default: () => [] },
  videoDevices: { type: Array, default: () => [] },
  selectedAudioDeviceId: { type: String, default: '' },
  selectedVideoDeviceId: { type: String, default: '' }
})

const emit = defineEmits([
  'toggleAudio',
  'toggleVideo',
  'switchAudioDevice',
  'switchVideoDevice',
  'toggleSubtitles',
  'toggleScreenShare',
  'toggleParticipants',
  'toggleHandRaise',
  'toggleTranscription',
  'toggleChat',
  'openSettings',
  'toggleAi'
])

function handleAudioMenuClick({ key }) {
  if (key === '__open_settings') {
    emit('openSettings')
    return
  }
  if (key && !String(key).startsWith('__')) {
    emit('switchAudioDevice', key)
  }
}

function handleVideoMenuClick({ key }) {
  if (key === '__open_settings') {
    emit('openSettings')
    return
  }
  if (key && !String(key).startsWith('__')) {
    emit('switchVideoDevice', key)
  }
}
</script>

<style scoped>
.meeting-toolbar {
  height: 76px;
  background: rgba(40, 40, 44, 0.96);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(193, 198, 215, 0.1);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  user-select: none;
  z-index: 40;
  flex-shrink: 0;
}

.toolbar-inner {
  width: 100%;
  max-width: 1280px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.media-combo-group {
  display: flex;
  align-items: center;
  background: rgba(226, 226, 226, 0.12);
  border-radius: 10px;
  padding: 2px;
}

.combo-arrow-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  padding: 10px 4px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.combo-arrow-btn:hover {
  color: #f1f1f1;
  background: rgba(226, 226, 226, 0.15);
}

.tool-btn {
  position: relative;
  background: transparent;
  border: none;
  color: #c1c6d7;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 66px;
  height: 54px;
  padding: 6px 10px;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn.combo-main {
  min-width: 62px;
}

.tool-btn:hover {
  background: rgba(226, 226, 226, 0.14);
  color: #f1f1f1;
}

.tool-btn .tool-icon {
  color: #f1f1f1;
}

.tool-btn .tool-icon.icon-primary {
  color: #006ef2;
}

.tool-btn .tool-icon.icon-error {
  color: #f87171;
}

.tool-btn.active {
  background: rgba(0, 110, 242, 0.18);
  color: #afc6ff;
}

.tool-btn.active .tool-icon {
  color: #afc6ff;
}

.tool-btn.danger {
  color: #f87171;
}

.tool-btn.danger .tool-icon {
  color: #f87171;
}

.tool-btn.hand-active {
  background: rgba(157, 106, 0, 0.26);
  color: #ffba45;
}

.tool-btn.hand-active .tool-icon {
  color: #ffba45;
}

.tool-btn.rec-active {
  background: rgba(186, 26, 26, 0.2);
  color: #fca5a5;
}

.tool-btn.share-primary-btn {
  min-width: 78px;
  background: #006ef2;
  color: #fefcff;
  font-weight: 500;
}

.tool-btn.share-primary-btn:hover {
  background: #0057c2;
}

.tool-btn.share-primary-btn .tool-icon {
  color: #fefcff;
}

.tool-btn.share-primary-btn.sharing {
  background: #ba1a1a;
}

.tool-btn.share-primary-btn.sharing:hover {
  background: #93000a;
}

.tool-label {
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

.online-dot {
  position: absolute;
  top: 7px;
  right: 14px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #88fd54;
}

.mobile-ai-trigger {
  display: none;
}

@media (max-width: 1024px) {
  .mobile-ai-trigger {
    display: flex;
  }

  .meeting-toolbar {
    padding: 0 12px;
  }

  .tool-btn {
    min-width: 56px;
    padding: 5px 7px;
  }
}

@media (max-width: 768px) {
  .meeting-toolbar {
    height: calc(66px + env(safe-area-inset-bottom, 0px));
    padding: 4px 8px env(safe-area-inset-bottom, 6px) 8px;
  }

  .toolbar-inner {
    overflow-x: auto;
    scrollbar-width: none;
    gap: 6px;
  }

  .toolbar-inner::-webkit-scrollbar {
    display: none;
  }

  .combo-arrow-btn {
    display: none;
  }

  .tool-btn {
    min-width: 50px;
    height: 48px;
    padding: 3px 6px;
  }

  .tool-btn.share-primary-btn {
    min-width: 58px;
  }

  .tool-label {
    font-size: 10px;
  }
}
</style>
