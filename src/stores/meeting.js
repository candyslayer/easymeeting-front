import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useMeetingStore = defineStore('meeting', () => {
  const authStore = useAuthStore()

  const meetingInfo = ref(null)
  const memberList = ref([])
  const chatMessages = ref([])
  const durationSeconds = ref(0)
  let timerInterval = null

  // 是否正在会议中
  const isInMeeting = computed(() => !!meetingInfo.value?.meetingId)
  
  // 是否为主持人
  const isHost = computed(() => {
    if (!meetingInfo.value || !authStore.userId) return false
    return meetingInfo.value.createUserId === authStore.userId
  })

  // 房间内当前是否有正在共享屏幕的用户
  const screenSharer = computed(() => {
    return memberList.value.find((m) => m.screenShare === true)
  })

  // 本人参会信息
  const selfMember = computed(() => {
    return memberList.value.find((m) => m.userId === authStore.userId)
  })

  // 远端成员列表
  const remoteMemberList = computed(() => {
    return memberList.value.filter((m) => m.userId !== authStore.userId)
  })

  function setMeetingInfo(info) {
    meetingInfo.value = info
    if (info?.meetingId) {
      authStore.setCurrentMeetingId(info.meetingId)
      startTimer()
    }
  }

  function setMemberList(list) {
    memberList.value = list || []
  }

  function addOrUpdateMember(member) {
    if (!member || !member.userId) return
    const index = memberList.value.findIndex((m) => m.userId === member.userId)
    if (index > -1) {
      memberList.value[index] = { ...memberList.value[index], ...member }
    } else {
      memberList.value.push(member)
    }
  }

  function removeMember(userId) {
    memberList.value = memberList.value.filter((m) => m.userId !== userId)
  }

  function updateMemberMedia(userId, { openVideo, openAudio, screenShare }) {
    const member = memberList.value.find((m) => m.userId === userId)
    if (member) {
      if (openVideo !== undefined) member.openVideo = openVideo
      if (openAudio !== undefined) member.openAudio = openAudio
      if (screenShare !== undefined) member.screenShare = screenShare
    }
  }

  function muteAllAudio(mute = true) {
    memberList.value.forEach((m) => {
      if (m.userId !== meetingInfo.value?.createUserId) {
        m.openAudio = !mute
      }
    })
  }

  function addChatMessage(msg) {
    if (!msg) return
    const isSelf = msg.userId === authStore.userId
    const messageId = msg.messageId || Date.now() + Math.random()
    // 防重复插入
    const exists = chatMessages.value.some((m) => m.messageId === messageId)
    if (!exists) {
      chatMessages.value.push({
        ...msg,
        messageId,
        isSelf
      })
    }
  }

  function setChatHistory(list) {
    chatMessages.value = (list || []).map((msg) => ({
      ...msg,
      isSelf: msg.userId === authStore.userId
    }))
  }

  function startTimer() {
    stopTimer()
    durationSeconds.value = 0
    timerInterval = setInterval(() => {
      durationSeconds.value++
    }, 1000)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function resetMeeting() {
    stopTimer()
    meetingInfo.value = null
    memberList.value = []
    chatMessages.value = []
    durationSeconds.value = 0
    authStore.setCurrentMeetingId(null)
  }

  return {
    meetingInfo,
    memberList,
    chatMessages,
    durationSeconds,
    isInMeeting,
    isHost,
    screenSharer,
    selfMember,
    remoteMemberList,
    setMeetingInfo,
    setMemberList,
    addOrUpdateMember,
    removeMember,
    updateMemberMedia,
    muteAllAudio,
    addChatMessage,
    setChatHistory,
    startTimer,
    stopTimer,
    resetMeeting
  }
})

