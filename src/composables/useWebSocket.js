import { ref, onUnmounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import { useMeetingStore } from '@/stores/meeting'

export function useWebSocket() {
  const authStore = useAuthStore()
  const meetingStore = useMeetingStore()

  const socket = ref(null)
  const isConnected = ref(false)
  const isReconnecting = ref(false)
  let heartbeatTimer = null
  let reconnectTimer = null
  let reconnectCount = 0
  const MAX_RECONNECT_ATTEMPTS = 5

  // 事件监听分发映射表
  const listeners = new Map()

  /**
   * 注册指定信令/消息类型的监听器
   * @param {number|string} eventType 
   * @param {Function} callback 
   */
  function on(eventType, callback) {
    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set())
    }
    listeners.get(eventType).add(callback)
    return () => off(eventType, callback)
  }

  /**
   * 取消注册
   */
  function off(eventType, callback) {
    if (listeners.has(eventType)) {
      listeners.get(eventType).delete(callback)
    }
  }

  function emit(eventType, payload) {
    if (listeners.has(eventType)) {
      listeners.get(eventType).forEach((cb) => {
        try {
          cb(payload)
        } catch (e) {
          console.error(`事件 ${eventType} 处理异常:`, e)
        }
      })
    }
  }

  /**
   * 建立 WebSocket 连接
   * @param {string} customToken 
   */
  function connect(customToken) {
    const token = customToken || authStore.token
    if (!token) {
      console.warn('缺少 Token，暂缓连接 WebSocket')
      return
    }

    if (socket.value && (socket.value.readyState === WebSocket.OPEN || socket.value.readyState === WebSocket.CONNECTING)) {
      return
    }

    // 后端 Netty 端口 7002，路径 /ws?token=...
    let wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:7002/ws'
    if (!wsUrl.includes('token=')) {
      const sep = wsUrl.includes('?') ? '&' : '?'
      wsUrl = `${wsUrl}${sep}token=${encodeURIComponent(token)}`
    }

    try {
      socket.value = new WebSocket(wsUrl)

      socket.value.onopen = () => {
        isConnected.value = true
        isReconnecting.value = false
        reconnectCount = 0
        console.log('✅ WebSocket 信令连接已建立')
        startHeartbeat()
        emit('open')
      }

      socket.value.onmessage = (event) => {
        handleRawMessage(event.data)
      }

      socket.value.onerror = (err) => {
        console.error('❌ WebSocket 发生异常:', err)
        emit('error', err)
      }

      socket.value.onclose = (event) => {
        isConnected.value = false
        stopHeartbeat()
        console.warn('⚠️ WebSocket 已断开连接, code:', event.code, 'reason:', event.reason)
        emit('close', event)

        // 非主动关闭且未超限时触发重连
        if (event.code !== 1000 && reconnectCount < MAX_RECONNECT_ATTEMPTS && authStore.isLoggedIn) {
          scheduleReconnect()
        }
      }
    } catch (err) {
      console.error('创建 WebSocket 实例失败:', err)
    }
  }

  /**
   * 解析收到的文本帧
   */
  function handleRawMessage(text) {
    if (!text) return

    // 1. 处理心跳回复
    if (text.trim() === 'pong') {
      return
    }

    try {
      const data = JSON.parse(text)
      const msgType = data.messageType

      // 触发全局消息监听
      emit('message', data)
      if (msgType !== undefined) {
        emit(msgType, data)
      }

      // 内置核心系统行为处理
      switch (msgType) {
        case 1: // ADD_METING_ROOM: 新成员进入
          if (data.meesageContent?.newMember) {
            meetingStore.addOrUpdateMember(data.meesageContent.newMember)
          }
          if (data.meesageContent?.meetingMemberList) {
            meetingStore.setMemberList(data.meesageContent.meetingMemberList)
          }
          break

        case 3: // EXIT_MEETING_ROOM: 成员退出
          if (data.userId || data.meesageContent) {
            const leftUserId = data.userId || data.meesageContent
            meetingStore.removeMember(leftUserId)
          }
          break

        case 4: // FINISH_MEETING: 主持人结束会议
          Modal.warning({
            title: '会议已结束',
            content: data.meesageContent || '主持人已解散并结束了本次会议。',
            okText: '确定',
            onOk: () => {
              meetingStore.resetMeeting()
              window.location.href = '/'
            }
          })
          break

        case 5: // CHAT_TEXT_MESSAGE: 文字聊天
          meetingStore.addChatMessage(data)
          break

        case 6: // CHAT_MEDIA_MESSAGE: 媒体文件分享
          meetingStore.addChatMessage(data)
          break

        case 8: // USER_CONTACT_APPLY: 好友申请
          message.info(`收到来自 ${data.sendNickName || '新用户'} 的好友申请`)
          break

        case 9: // INVIT_MEMBER_MEETING: 收到会议邀请
          message.info(`收到来自 ${data.sendNickName || '联系人'} 的会议入会邀请`)
          break

        case 10: // FORCE_OFF_LINE: 被强制移出会议
          Modal.error({
            title: '移出会议通知',
            content: data.meesageContent || '您已被主持人移出当前会议。',
            okText: '退出',
            onOk: () => {
              meetingStore.resetMeeting()
              window.location.href = '/'
            }
          })
          break

        case 11: // USER_MEETING_VIDEO_CHANGE: 媒体状态更新
          if (data.meesageContent && typeof data.meesageContent === 'object') {
            const member = data.meesageContent
            meetingStore.updateMemberMedia(member.userId, {
              openVideo: member.openVideo,
              openAudio: member.openAudio,
              screenShare: member.screenShare
            })
          }
          break

        default:
          break
      }
    } catch (e) {
      console.warn('非标准 JSON 帧:', text)
    }
  }

  /**
   * 发送心跳包
   */
  function startHeartbeat() {
    stopHeartbeat()
    // 间隔 25 秒发送 "ping"，远小于服务端的 60 秒超时
    heartbeatTimer = setInterval(() => {
      if (socket.value && socket.value.readyState === WebSocket.OPEN) {
        socket.value.send('ping')
      }
    }, 25000)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /**
   * 指数退避自动重连
   */
  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    isReconnecting.value = true
    reconnectCount++
    const delay = Math.min(1000 * Math.pow(2, reconnectCount - 1), 10000)
    console.log(`将在 ${delay / 1000} 秒后尝试第 ${reconnectCount} 次重连...`)

    reconnectTimer = setTimeout(() => {
      connect()
    }, delay)
  }

  /**
   * 发送业务 JSON 消息
   * @param {Object} data 
   */
  function send(data) {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未处于连接状态，无法发送数据')
      return false
    }

    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      socket.value.send(payload)
      return true
    } catch (err) {
      console.error('发送信令帧异常:', err)
      return false
    }
  }

  /**
   * 主动安全断开
   */
  function disconnect() {
    stopHeartbeat()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectCount = 0
    isReconnecting.value = false
    if (socket.value) {
      socket.value.close(1000, 'Normal Closure')
      socket.value = null
    }
    isConnected.value = false
  }

  onUnmounted(() => {
    // 仅在显式退出页面或组件销毁时断开
  })

  return {
    socket,
    isConnected,
    isReconnecting,
    connect,
    disconnect,
    send,
    on,
    off
  }
}

