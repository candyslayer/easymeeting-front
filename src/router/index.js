import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { public: true, title: '登录 - EasyMeeting' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { public: true, title: '注册 - EasyMeeting' }
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/home/HomeView.vue'),
        meta: { title: '会议首页 - EasyMeeting' }
      },
      {
        path: 'meeting/join',
        name: 'JoinMeeting',
        component: () => import('@/views/meeting/JoinMeetingView.vue'),
        meta: { title: '加入会议 - EasyMeeting' }
      },
      {
        path: 'meeting/schedule',
        name: 'ScheduleMeeting',
        component: () => import('@/views/meeting/ScheduleMeetingView.vue'),
        meta: { title: '预约会议 - EasyMeeting' }
      },
      {
        path: 'meeting/history',
        name: 'MeetingHistory',
        component: () => import('@/views/meeting/MeetingHistoryView.vue'),
        meta: { title: '会议记录 - EasyMeeting' }
      },
      {
        path: 'contacts',
        name: 'Contacts',
        component: () => import('@/views/contacts/ContactsView.vue'),
        meta: { title: '通讯录 - EasyMeeting' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/SettingsView.vue'),
        meta: { title: '设置 - EasyMeeting' }
      }
    ]
  },
  {
    path: '/meeting/room/:id',
    name: 'MeetingRoom',
    component: () => import('@/views/meeting/MeetingRoomView.vue'),
    meta: { title: '实时会议室 - EasyMeeting', fullscreen: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, title: '页面不存在 - EasyMeeting' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  document.title = to.meta.title || 'EasyMeeting 易会'

  if (!to.meta.public && !token) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
  } else if (to.meta.public && token && (to.name === 'Login' || to.name === 'Register')) {
    next({ name: 'Home' })
  } else {
    next()
  }
})

export default router

