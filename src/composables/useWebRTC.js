import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'

export function useWebRTC(websocketService, localStreamRef) {
  // 保存每个远端参会者的 RTCPeerConnection 实例与媒体流
  const peerConnections = new Map() // remoteUserId -> RTCPeerConnection
  const remoteStreams = reactive({}) // remoteUserId -> MediaStream
  const pendingCandidates = new Map() // remoteUserId -> RTCIceCandidateInit[]

  // ICE 配置
  const rtcConfig = {
    iceServers: [
      {
        urls: [
          import.meta.env.VITE_STUN_SERVER || 'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302'
        ]
      }
    ],
    iceCandidatePoolSize: 4
  }

  /**
   * 初始化并获取对指定远端用户的 RTCPeerConnection
   * @param {string} remoteUserId 
   */
  function getOrCreatePeerConnection(remoteUserId) {
    if (peerConnections.has(remoteUserId)) {
      return peerConnections.get(remoteUserId)
    }

    const pc = new RTCPeerConnection(rtcConfig)

    // 1. 将当前本地媒体轨道添加到连接中
    if (localStreamRef.value) {
      localStreamRef.value.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.value)
      })
    }

    // 2. 收集并向远端发送本地 ICE Candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        websocketService.send({
          messageType: 2,
          signalType: 'candidate',
          signalData: JSON.stringify(event.candidate.toJSON()),
          receiveUserId: remoteUserId
        })
      }
    }

    // 3. 接收远端音视频轨道并组装 MediaStream
    pc.ontrack = (event) => {
      console.log(`收到来自用户 ${remoteUserId} 的媒体轨道:`, event.track.kind)
      if (event.streams && event.streams[0]) {
        remoteStreams[remoteUserId] = event.streams[0]
      } else {
        if (!remoteStreams[remoteUserId]) {
          remoteStreams[remoteUserId] = new MediaStream()
        }
        remoteStreams[remoteUserId].addTrack(event.track)
      }
    }

    // 4. 连接状态监听
    pc.onconnectionstatechange = () => {
      console.log(`用户 ${remoteUserId} WebRTC 连接状态:`, pc.connectionState)
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.warn(`与用户 ${remoteUserId} 的媒体连接中断`)
      } else if (pc.connectionState === 'closed') {
        closePeer(remoteUserId)
      }
    }

    peerConnections.set(remoteUserId, pc)
    return pc
  }

  /**
   * 主动向远端新成员发起 Offer 握手
   * @param {string} remoteUserId 
   */
  async function initiateOffer(remoteUserId) {
    try {
      const pc = getOrCreatePeerConnection(remoteUserId)
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
      await pc.setLocalDescription(offer)

      websocketService.send({
        messageType: 2,
        signalType: 'offer',
        signalData: JSON.stringify(offer),
        receiveUserId: remoteUserId
      })
    } catch (err) {
      console.error(`向用户 ${remoteUserId} 发起 Offer 失败:`, err)
    }
  }

  /**
   * 处理接收到的 WebRTC 信令
   * @param {Object} data MessageSendDto
   */
  async function handleSignal(data) {
    const senderUserId = data.userId
    if (!senderUserId) return

    let signalType = data.signalType
    let signalData = data.signalData

    // 兼容后端嵌套在 meesageContent 中的结构
    if (!signalType && data.meesageContent) {
      signalType = data.meesageContent.signalType
      signalData = data.meesageContent.signalData
    }

    if (!signalType || !signalData) {
      return
    }

    try {
      const parsedData = typeof signalData === 'string' ? JSON.parse(signalData) : signalData

      if (signalType === 'offer') {
        // 收到 Offer，被动响应 Answer
        const pc = getOrCreatePeerConnection(senderUserId)
        await pc.setRemoteDescription(new RTCSessionDescription(parsedData))

        // 刷新缓存的 Candidates
        await flushPendingCandidates(senderUserId, pc)

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        websocketService.send({
          messageType: 2,
          signalType: 'answer',
          signalData: JSON.stringify(answer),
          receiveUserId: senderUserId
        })
      } else if (signalType === 'answer') {
        // 收到 Answer 握手完成
        const pc = peerConnections.get(senderUserId)
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(parsedData))
          await flushPendingCandidates(senderUserId, pc)
        }
      } else if (signalType === 'candidate') {
        // 收到 ICE Candidate
        const pc = peerConnections.get(senderUserId)
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(parsedData))
        } else {
          // 远端描述尚未设置时暂存 Candidate
          if (!pendingCandidates.has(senderUserId)) {
            pendingCandidates.set(senderUserId, [])
          }
          pendingCandidates.get(senderUserId).push(parsedData)
        }
      }
    } catch (err) {
      console.error(`处理来自 ${senderUserId} 的信令异常 (${signalType}):`, err)
    }
  }

  /**
   * 刷新暂存的 ICE Candidate 队列
   */
  async function flushPendingCandidates(userId, pc) {
    if (pendingCandidates.has(userId)) {
      const candidates = pendingCandidates.get(userId)
      for (const cand of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } catch (e) {
          console.warn('添加暂存 Candidate 失败:', e)
        }
      }
      pendingCandidates.delete(userId)
    }
  }

  /**
   * 替换所有对端连接中的视频/音频轨道（例如切换屏幕共享流或切换摄像头）
   * @param {MediaStreamTrack} newTrack 
   * @param {'video'|'audio'} kind 
   */
  async function replaceTrackForAllPeers(newTrack, kind = 'video') {
    for (const [userId, pc] of peerConnections.entries()) {
      try {
        const senders = pc.getSenders()
        const targetSender = senders.find((s) => s.track && s.track.kind === kind)
        if (targetSender) {
          await targetSender.replaceTrack(newTrack)
        } else if (newTrack && localStreamRef.value) {
          pc.addTrack(newTrack, localStreamRef.value)
        }
      } catch (err) {
        console.error(`为对端 ${userId} 替换 ${kind} 轨道失败:`, err)
      }
    }
  }

  /**
   * 关闭与指定成员的 PeerConnection
   * @param {string} remoteUserId 
   */
  function closePeer(remoteUserId) {
    const pc = peerConnections.get(remoteUserId)
    if (pc) {
      pc.close()
      peerConnections.delete(remoteUserId)
    }
    delete remoteStreams[remoteUserId]
    pendingCandidates.delete(remoteUserId)
  }

  /**
   * 关闭所有 PeerConnection 并重置状态
   */
  function closeAllPeers() {
    peerConnections.forEach((pc) => {
      try {
        pc.close()
      } catch (e) {}
    })
    peerConnections.clear()

    Object.keys(remoteStreams).forEach((key) => {
      delete remoteStreams[key]
    })
    pendingCandidates.clear()
  }

  return {
    remoteStreams,
    peerConnections,
    initiateOffer,
    handleSignal,
    replaceTrackForAllPeers,
    closePeer,
    closeAllPeers
  }
}

