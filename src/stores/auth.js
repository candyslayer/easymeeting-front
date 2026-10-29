import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(null)

  // 从本地恢复用户信息
  const savedUserInfo = localStorage.getItem('userInfo')
  if (savedUserInfo) {
    try {
      userInfo.value = JSON.parse(savedUserInfo)
    } catch (e) {
      console.error('解析本地用户信息失败:', e)
    }
  }

  const isLoggedIn = computed(() => !!token.value)
  const userId = computed(() => userInfo.value?.userId || '')
  const nickName = computed(() => userInfo.value?.nickName || userInfo.value?.userName || '未登录用户')
  const userSex = computed(() => userInfo.value?.sex ?? 1)
  const isAdmin = computed(() => !!userInfo.value?.admin)
  const currentMeetingId = computed(() => userInfo.value?.currentMeetingId || '')

  function setLogin(newToken, newUserInfo) {
    token.value = newToken
    userInfo.value = newUserInfo
    localStorage.setItem('token', newToken)
    localStorage.setItem('userInfo', JSON.stringify(newUserInfo))
  }

  function updateUserInfo(partial) {
    if (!userInfo.value) return
    userInfo.value = { ...userInfo.value, ...partial }
    localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
  }

  function setCurrentMeetingId(meetingId) {
    if (userInfo.value) {
      userInfo.value.currentMeetingId = meetingId
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
    }
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    userId,
    nickName,
    userSex,
    isAdmin,
    currentMeetingId,
    setLogin,
    updateUserInfo,
    setCurrentMeetingId,
    logout
  }
})

