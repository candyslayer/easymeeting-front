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
   * 获取动态自适应的 WebSocket 服务端 URL
   */
  function getWsUrl(token) {
    let base = import.meta.env.VITE_WS_URL
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const defaultProto = isHttps ? 'wss:' : 'ws:'
    const fullHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8182'
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

    // 1. 如果在生产/线上环境（特别是开启了 HTTPS，或者同源通过 Nginx /ws 代理）
    if (isHttps || !base || base === '/ws' || base.startsWith('/') || base.includes(':8182')) {
      base = `${defaultProto}//${fullHost}/ws`
    } else if (base.includes('localhost') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // 局域网其它设备访问开发环境时，自动将 localhost 替换为当前访问的局域网 IP
      base = base.replace('localhost', hostname)
    }

    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}token=${encodeURIComponent(token)}`
  }

  /**
   * 建立 WebSocket 连接（返回 Promise，可 await 确保握手成功）
   * @param {string} customToken 
   * @returns {Promise<WebSocket>}
   */
  function connect(customToken) {
    const token = customToken || authStore.token
    if (!token) {
      console.warn('缺少 Token，暂缓连接 WebSocket')
      return Promise.reject(new Error('未登录或缺少 Token'))
    }

    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      return Promise.resolve(socket.value)
    }

    if (socket.value && socket.value.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve, reject) => {
        const checkTimer = setInterval(() => {
          if (!socket.value) {
            clearInterval(checkTimer)
            reject(new Error('WebSocket 实例已销毁'))
          } else if (socket.value.readyState === WebSocket.OPEN) {
            clearInterval(checkTimer)
            resolve(socket.value)
          } else if (socket.value.readyState === WebSocket.CLOSED) {
            clearInterval(checkTimer)
            reject(new Error('WebSocket 连接关闭'))
          }
        }, 100)
      })
    }

    return new Promise((resolve, reject) => {
      let isResolved = false
      const wsUrl = getWsUrl(token)

      // 8秒连接超时保护
      const connectTimeout = setTimeout(() => {
        if (!isResolved && socket.value && socket.value.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket 连接超时，转为后台重试')
          // 不强制 reject 阻断页面，但提示未准备好
          resolve(socket.value)
        }
      }, 8000)

      try {
        socket.value = new WebSocket(wsUrl)

        socket.value.onopen = () => {
          clearTimeout(connectTimeout)
          isConnected.value = true
          isReconnecting.value = false
          reconnectCount = 0
          console.log('✅ WebSocket 信令连接已建立')
          startHeartbeat()
          emit('open')
          if (!isResolved) {
            isResolved = true
            resolve(socket.value)
          }
        }

        socket.value.onmessage = (event) => {
          handleRawMessage(event.data)
        }

        socket.value.onerror = (err) => {
          console.error('❌ WebSocket 发生异常:', err)
          emit('error', err)
          if (!isResolved) {
            isResolved = true
            // 发生异常时也允许流程向下走，避免阻塞整个页面初始化
            resolve(socket.value)
          }
        }

        socket.value.onclose = (event) => {
          clearTimeout(connectTimeout)
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
        clearTimeout(connectTimeout)
        console.error('创建 WebSocket 实例失败:', err)
        reject(err)
      }
    })
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

        case 20: // TRANSCRIPT_INCREMENTAL: 增量转写文本推送
          emit('transcript_incremental', data.meesageContent || data)
          break

        case 22: // MINUTES_PUBLISHED: 会议纪要发布广播
          message.info('当前会议已发布最新 AI 会议纪要')
          emit('minutes_published', data.meesageContent || data)
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

