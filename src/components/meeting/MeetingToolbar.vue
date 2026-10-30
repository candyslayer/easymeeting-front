<template>
  <div class="meeting-toolbar">
    <!-- 左侧辅助功能区 -->
    <div class="toolbar-section section-left">
      <!-- 设备设置快捷入口 -->
      <button class="tool-btn" @click="emit('openSettings')">
        <SettingOutlined class="tool-icon" />
        <span class="tool-label">设置</span>
      </button>

      <!-- 邀请按钮 -->
      <button class="tool-btn" @click="emit('openInvite')">
        <UserAddOutlined class="tool-icon" />
        <span class="tool-label">邀请</span>
      </button>
    </div>

    <!-- 中间核心音视频控制区 -->
    <div class="toolbar-section section-center">
      <!-- 麦克风控制 -->
      <button
        class="tool-btn"
        :class="{ active: isAudioActive, danger: !isAudioActive }"
        @click="emit('toggleAudio')"
      >
        <component :is="isAudioActive ? AudioOutlined : AudioMutedOutlined" class="tool-icon" />
        <span class="tool-label">{{ isAudioActive ? '静音' : '解除静音' }}</span>
      </button>

      <!-- 摄像头控制 -->
      <button
        class="tool-btn"
        :class="{ active: isVideoActive, danger: !isVideoActive }"
        @click="emit('toggleVideo')"
      >
        <component :is="isVideoActive ? VideoCameraOutlined : StopOutlined" class="tool-icon" />
        <span class="tool-label">{{ isVideoActive ? '关闭视频' : '开启视频' }}</span>
      </button>

      <!-- 屏幕共享 -->
      <button
        class="tool-btn"
        :class="{ active: isScreenSharing }"
        @click="emit('toggleScreenShare')"
      >
        <DesktopOutlined class="tool-icon" />
        <span class="tool-label">{{ isScreenSharing ? '停止共享' : '共享屏幕' }}</span>
      </button>

      <!-- 参会者列表 -->
      <button
        class="tool-btn"
        :class="{ active: isParticipantsOpen }"
        @click="emit('toggleParticipants')"
      >
        <a-badge :count="memberCount" :overflow-count="99" :offset="[6, 0]">
          <TeamOutlined class="tool-icon" />
        </a-badge>
        <span class="tool-label">参会人 ({{ memberCount }})</span>
      </button>

      <!-- 聊天抽屉 -->
      <button
        class="tool-btn"
        :class="{ active: isChatOpen }"
        @click="emit('toggleChat')"
      >
        <a-badge :count="unreadChatCount" :overflow-count="99" :offset="[6, 0]">
          <MessageOutlined class="tool-icon" />
        </a-badge>
        <span class="tool-label">聊天</span>
      </button>
    </div>

    <!-- 右侧退出/结束会议区 -->
    <div class="toolbar-section section-right">
      <!-- 主持人支持选择“离开会议”或“全员解散会议” -->
      <a-dropdown v-if="isHost" placement="topRight">
        <button class="leave-btn host-leave">
          <PoweroffOutlined />
          <span>结束会议</span>
          <DownOutlined style="font-size: 10px; margin-left: 2px" />
        </button>
        <template #overlay>
          <a-menu>
            <a-menu-item key="finish" @click="emit('finishMeeting')">
              <span style="color: #ff4d4f; font-weight: 600">结束全体会议 (全员解散)</span>
            </a-menu-item>
            <a-menu-item key="leave" @click="emit('exitMeeting')">
              <span>仅离开会议 (保留房间)</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>

      <!-- 普通参会者直接离开 -->
      <button v-else class="leave-btn" @click="emit('exitMeeting')">
        <LogoutOutlined />
        <span>离开会议</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  StopOutlined,
  DesktopOutlined,
  TeamOutlined,
  MessageOutlined,
  SettingOutlined,
  UserAddOutlined,
  PoweroffOutlined,
  LogoutOutlined,
  DownOutlined
} from '@ant-design/icons-vue'

defineProps({
  isAudioActive: {
    type: Boolean,
    default: true
  },
  isVideoActive: {
    type: Boolean,
    default: true
  },
  isScreenSharing: {
    type: Boolean,
    default: false
  },
  memberCount: {
    type: Number,
    default: 1
  },
  unreadChatCount: {
    type: Number,
    default: 0
  },
  isParticipantsOpen: {
    type: Boolean,
    default: false
  },
  isChatOpen: {
    type: Boolean,
    default: false
  },
  isHost: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'toggleAudio',
  'toggleVideo',
  'toggleScreenShare',
  'toggleParticipants',
  'toggleChat',
  'openInvite',
  'openSettings',
  'exitMeeting',
  'finishMeeting'
])
</script>

<style scoped>
.meeting-toolbar {
  height: 72px;
  background-color: #1a1a20;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  user-select: none;
  z-index: 10;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-center {
  gap: 16px;
}

.tool-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 60px;
  height: 54px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.tool-btn.active {
  color: #1677ff;
}

.tool-btn.active .tool-icon {
  color: #1677ff;
}

.tool-btn.danger {
  color: #ff4d4f;
}

.tool-btn.danger .tool-icon {
  color: #ff4d4f;
}

.tool-icon {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.85);
}

.tool-label {
  font-size: 11px;
  letter-spacing: -0.2px;
}

.leave-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #e02424;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.leave-btn:hover {
  background-color: #f05252;
}

.leave-btn.host-leave {
  background-color: #c81e1e;
}

.leave-btn.host-leave:hover {
  background-color: #e02424;
}

/* 移动端响应式控制栏适配 */
@media (max-width: 768px) {
  .meeting-toolbar {
    height: calc(64px + env(safe-area-inset-bottom, 0px));
    padding: 4px 8px env(safe-area-inset-bottom, 6px) 8px;
  }

  .toolbar-section {
    gap: 4px;
  }

  .section-center {
    gap: 6px;
  }

  .tool-btn {
    min-width: 48px;
    height: 48px;
    padding: 2px 4px;
    gap: 2px;
  }

  .tool-icon {
    font-size: 18px;
  }

  .tool-label {
    font-size: 10px;
    transform: scale(0.92);
  }

  .leave-btn {
    padding: 6px 10px;
    font-size: 12px;
  }
}

@media (max-width: 540px) {
  .section-left {
    display: none; /* 移动小屏隐藏工具栏左侧按钮，由顶部状态栏的邀请和设备入口承担 */
  }

  .section-center {
    flex: 1;
    justify-content: space-around;
    gap: 2px;
  }

  .tool-btn {
    min-width: 42px;
    height: 46px;
    padding: 2px;
  }

  .tool-icon {
    font-size: 17px;
  }

  .tool-label {
    font-size: 9px;
    transform: scale(0.88);
  }

  .leave-btn {
    padding: 6px 8px;
    font-size: 11px;
    gap: 2px;
  }

  .leave-btn span {
    font-size: 11px;
  }
}
</style>

