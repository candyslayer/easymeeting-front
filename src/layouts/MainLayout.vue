<template>
  <div class="main-layout">
    <!-- 左侧客户端侧边栏 -->
    <aside class="sidebar">
      <div class="logo-area">
        <div class="logo-icon">
          <VideoCameraFilled />
        </div>
        <div class="logo-text">
          <span class="brand-name">EasyMeeting</span>
          <span class="brand-sub">云会议协作</span>
        </div>
      </div>

      <!-- 核心导航菜单 -->
      <nav class="nav-menu">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: currentRoute.path === item.path }"
        >
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- 底部用户简况与退出快捷入口 -->
      <div class="sidebar-footer">
        <a-dropdown placement="topRight">
          <div class="user-profile-compact">
            <a-avatar
              :size="36"
              :src="getAvatarUrl(authStore.userId)"
              :style="{ backgroundColor: '#1677ff', verticalAlign: 'middle' }"
            >
              {{ authStore.nickName?.slice(0, 1) || '用' }}
            </a-avatar>
            <div class="user-info-text ellipsis">
              <span class="user-name ellipsis">{{ authStore.nickName }}</span>
              <span class="user-id ellipsis">ID: {{ authStore.userId || '-' }}</span>
            </div>
          </div>
          <template #overlay>
            <a-menu>
              <a-menu-item key="user-id">
                <span style="color: var(--text-secondary); font-size: 12px">账号ID: {{ authStore.userId }}</span>
              </a-menu-item>
              <a-menu-item key="profile" @click="router.push('/settings?tab=profile')">
                <UserOutlined /> 个人资料
              </a-menu-item>
              <a-menu-item key="settings" @click="router.push('/settings?tab=media')">
                <SettingOutlined /> 音视频设置
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout" @click="handleLogout">
                <LogoutOutlined style="color: #ff4d4f" />
                <span style="color: #ff4d4f">退出登录</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </aside>

    <!-- 右侧主体内容容器 -->
    <main class="main-container">
      <!-- 顶部轻量应用栏 -->
      <header class="top-header">
        <div class="header-left">
          <h2 class="view-title">{{ currentRoute.meta.title?.split(' - ')[0] || '会议系统' }}</h2>
        </div>
        <div class="header-right">
          <!-- 若有当前正在进行的会议，显示浮动提示入口 -->
          <a-button
            v-if="authStore.currentMeetingId"
            type="primary"
            danger
            size="small"
            class="ongoing-meeting-pill"
            @click="returnToCurrentMeeting"
          >
            <VideoCameraOutlined /> 您有进行中的会议 (点击进入)
          </a-button>

          <a-tooltip title="系统设置">
            <a-button type="text" shape="circle" @click="router.push('/settings')">
              <SettingOutlined />
            </a-button>
          </a-tooltip>
        </div>
      </header>

      <!-- 视图路由视图 -->
      <section class="content-body">
        <router-view />
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  HomeOutlined,
  LoginOutlined,
  CalendarOutlined,
  HistoryOutlined,
  TeamOutlined,
  SettingOutlined,
  UserOutlined,
  VideoCameraFilled,
  VideoCameraOutlined,
  LogoutOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getAvatarUrl } from '@/api/auth'

const router = useRouter()
const currentRoute = useRoute()
const authStore = useAuthStore()

const navItems = [
  { path: '/', label: '首页', icon: HomeOutlined },
  { path: '/meeting/join', label: '加入会议', icon: LoginOutlined },
  { path: '/meeting/schedule', label: '预约会议', icon: CalendarOutlined },
  { path: '/meeting/history', label: '会议记录', icon: HistoryOutlined },
  { path: '/contacts', label: '通讯录', icon: TeamOutlined },
  { path: '/settings', label: '设置', icon: SettingOutlined }
]

function returnToCurrentMeeting() {
  if (authStore.currentMeetingId) {
    router.push(`/meeting/room/${authStore.currentMeetingId}`)
  }
}

function handleLogout() {
  Modal.confirm({
    title: '确认退出登录',
    content: '退出登录后将清理本地会话凭据，是否继续？',
    okText: '确认退出',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      authStore.logout()
      message.success('已安全退出登录')
      router.push('/login')
    }
  })
}
</script>

<style scoped>
.main-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-body);
}

/* 侧边导航栏 */
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: #ffffff;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  user-select: none;
}

.logo-area {
  display: flex;
  align-items: center;
  padding: 20px 16px 24px 20px;
  gap: 12px;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #1f2329;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.brand-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.nav-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--border-radius-base);
  color: var(--text-regular);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-icon {
  font-size: 18px;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.nav-item:hover {
  background-color: #f2f3f5;
  color: var(--primary-color);
}

.nav-item:hover .nav-icon {
  color: var(--primary-color);
}

.nav-item.active {
  background-color: #e6f4ff;
  color: var(--primary-color);
  font-weight: 600;
}

.nav-item.active .nav-icon {
  color: var(--primary-color);
}

.sidebar-footer {
  padding: 14px 12px;
  border-top: 1px solid var(--border-light);
}

.user-profile-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--border-radius-base);
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-profile-compact:hover {
  background-color: #f2f3f5;
}

.user-info-text {
  display: flex;
  flex-direction: column;
  max-width: 100px;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.2;
}

.user-id {
  font-size: 11px;
  color: var(--text-secondary);
}

/* 右侧内容主区 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.top-header {
  height: var(--header-height);
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  flex-shrink: 0;
}

.view-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ongoing-meeting-pill {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(255, 77, 79, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0);
  }
}

.content-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}
</style>

