<template>
  <a-drawer
    v-model:open="visible"
    title="参会人员"
    placement="right"
    :width="340"
    :body-style="{ padding: '16px', display: 'flex', flexDirection: 'column' }"
    @close="emit('update:open', false)"
  >
    <!-- 搜索筛选 -->
    <div class="search-box">
      <a-input
        v-model:value="searchKeyword"
        placeholder="搜索参会成员..."
        allow-clear
        size="small"
      >
        <template #prefix>
          <SearchOutlined style="color: #bfbfbf" />
        </template>
      </a-input>
    </div>

    <!-- 成员统计与全员操作提示 -->
    <div class="list-meta">
      <span>在线成员 ({{ filteredMembers.length }})</span>
      <span v-if="screenSharer" class="share-badge">
        <DesktopOutlined /> {{ screenSharer.nickName }} 正在共享
      </span>
    </div>

    <!-- 成员列表滚动区 -->
    <div class="member-list-scroll">
      <div
        v-for="member in filteredMembers"
        :key="member.userId"
        class="member-item"
      >
        <div class="member-left">
          <a-avatar
            :size="32"
            :style="{ backgroundColor: getAvatarColor(member.userId) }"
          >
            {{ member.nickName?.slice(0, 1) || '参' }}
          </a-avatar>
          <div class="member-text ellipsis">
            <span class="member-name ellipsis">
              {{ member.nickName || '参会者' }}
              <span v-if="member.userId === hostUserId" class="host-pill">主持人</span>
              <span v-if="member.userId === currentUserId" class="self-pill">我</span>
            </span>
          </div>
        </div>

        <div class="member-right">
          <!-- 媒体状态图示 -->
          <component
            :is="member.openAudio !== false ? AudioOutlined : AudioMutedOutlined"
            class="status-icon"
            :class="{ muted: member.openAudio === false }"
          />
          <component
            :is="member.openVideo !== false ? VideoCameraOutlined : StopOutlined"
            class="status-icon"
            :class="{ muted: member.openVideo === false }"
          />

          <!-- 主持人管理菜单（不可对自身操作） -->
          <a-dropdown v-if="isHost && member.userId !== currentUserId" placement="bottomRight">
            <a-button type="text" size="small" shape="circle">
              <MoreOutlined />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="kick" @click="handleKick(member)">
                  <span style="color: #ff4d4f">移出会议</span>
                </a-menu-item>
                <a-menu-item key="blacklist" @click="handleBlacklist(member)">
                  <span style="color: #d4380d">拉黑成员 (禁止再入)</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </div>

    <!-- 主持人底部控制台（全员静音/解除静音） -->
    <div v-if="isHost" class="host-bottom-actions">
      <a-button block @click="handleMuteAll(true)">
        <AudioMutedOutlined /> 全员静音
      </a-button>
      <a-button block @click="handleMuteAll(false)">
        <AudioOutlined /> 解除全员静音
      </a-button>
    </div>
  </a-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  SearchOutlined,
  DesktopOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  StopOutlined,
  MoreOutlined
} from '@ant-design/icons-vue'
import { kickOutMember, blacklistMember, muteAll } from '@/api/meeting'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  members: {
    type: Array,
    default: () => []
  },
  currentUserId: {
    type: String,
    default: ''
  },
  hostUserId: {
    type: String,
    default: ''
  },
  meetingId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:open'])

const visible = ref(props.open)
const searchKeyword = ref('')

watch(
  () => props.open,
  (val) => {
    visible.value = val
  }
)

const isHost = computed(() => {
  return props.currentUserId && props.currentUserId === props.hostUserId
})

const screenSharer = computed(() => {
  return props.members.find((m) => m.screenShare === true)
})

const filteredMembers = computed(() => {
  if (!searchKeyword.value.trim()) return props.members
  const kw = searchKeyword.value.trim().toLowerCase()
  return props.members.filter((m) => {
    return (
      m.nickName?.toLowerCase().includes(kw) ||
      m.userName?.toLowerCase().includes(kw) ||
      m.userId?.toLowerCase().includes(kw)
    )
  })
})

function getAvatarColor(userId) {
  const colors = ['#1677ff', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96']
  const str = userId || 'user'
  const index = Math.abs(str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length
  return colors[index]
}

function handleKick(member) {
  Modal.confirm({
    title: '移出会议确认',
    content: `确定要将参会人「${member.nickName}」移出当前会议吗？`,
    okText: '确认移出',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await kickOutMember(props.meetingId, member.userId)
        message.success(`已将 ${member.nickName} 移出会议`)
      } catch (err) {
        message.error(err.message || '移出失败')
      }
    }
  })
}

function handleBlacklist(member) {
  Modal.confirm({
    title: '拉黑成员确认',
    content: `拉黑「${member.nickName}」后，该成员将立即被移出且无法再次加入本次会议。是否继续？`,
    okText: '确认拉黑',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await blacklistMember(props.meetingId, member.userId)
        message.success(`已拉黑成员 ${member.nickName}`)
      } catch (err) {
        message.error(err.message || '拉黑失败')
      }
    }
  })
}

async function handleMuteAll(mute) {
  try {
    await muteAll(props.meetingId, mute)
    message.success(mute ? '已将全体成员静音' : '已解除全员静音')
  } catch (err) {
    message.error(err.message || '全员静音操作失败')
  }
}
</script>

<style scoped>
.search-box {
  margin-bottom: 12px;
}

.list-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 10px;
}

.share-badge {
  color: var(--primary-color);
  font-weight: 500;
}

.member-list-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--border-radius-base);
  transition: background-color 0.2s;
}

.member-item:hover {
  background-color: #f7f8fa;
}

.member-left {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 200px;
}

.member-text {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 4px;
}

.host-pill {
  font-size: 10px;
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffd591;
  padding: 0 4px;
  border-radius: 3px;
}

.self-pill {
  font-size: 10px;
  background: #e6f4ff;
  color: #1677ff;
  border: 1px solid #91caff;
  padding: 0 4px;
  border-radius: 3px;
}

.member-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 15px;
  color: #52c41a;
}

.status-icon.muted {
  color: #ff4d4f;
}

.host-bottom-actions {
  display: flex;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
  margin-top: 12px;
}
</style>

