import { ref, shallowRef } from 'vue'
import { message } from 'ant-design-vue'
import { useMediaStore } from '@/stores/media'

export function useMediaDevices() {
  const mediaStore = useMediaStore()

  const localStream = shallowRef(null)
  const screenStream = shallowRef(null)
  const isAudioActive = ref(true)
  const isVideoActive = ref(true)
  const isScreenSharing = ref(false)

  // 麦克风音量检测相关
  let audioContext = null
  let analyserNode = null
  let micLevelAnimationId = null
  const micVolumeLevel = ref(0) // 0 - 100

  /**
   * 枚举系统音视频输入输出设备
   */
  async function enumerateDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      message.warning('当前浏览器环境不支持获取媒体设备列表')
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioIns = []
      const audioOuts = []
      const videoIns = []

      devices.forEach((device) => {
        const item = {
          deviceId: device.deviceId,
          label: device.label || `${device.kind} (${device.deviceId.slice(0, 5)})`
        }
        if (device.kind === 'audioinput') audioIns.push(item)
        else if (device.kind === 'audiooutput') audioOuts.push(item)
        else if (device.kind === 'videoinput') videoIns.push(item)
      })

      mediaStore.setAudioInputDevices(audioIns)
      mediaStore.setAudioOutputDevices(audioOuts)
      mediaStore.setVideoInputDevices(videoIns)

      if (!mediaStore.selectedAudioInputId && audioIns.length > 0) {
        mediaStore.setSelectedAudioInput(audioIns[0].deviceId)
      }
      if (!mediaStore.selectedAudioOutputId && audioOuts.length > 0) {
        mediaStore.setSelectedAudioOutput(audioOuts[0].deviceId)
      }
      if (!mediaStore.selectedVideoInputId && videoIns.length > 0) {
        mediaStore.setSelectedVideoInput(videoIns[0].deviceId)
      }
    } catch (err) {
      console.error('枚举媒体设备失败:', err)
    }
  }

  function buildAudioConstraints(deviceId, exact = false) {
    return {
      deviceId: deviceId ? (exact ? { exact: deviceId } : { ideal: deviceId }) : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }

  function buildVideoConstraints(deviceId, exact = false) {
    return {
      deviceId: deviceId ? (exact ? { exact: deviceId } : { ideal: deviceId }) : undefined,
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 24, max: 30 }
    }
  }

  function reportMediaError(err, kindLabel = '摄像头与麦克风') {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      message.error(`请授予浏览器${kindLabel}访问权限`)
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      message.warning(`未检测到可用的${kindLabel}设备`)
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      message.error(`${kindLabel}正被其他程序占用，无法启动`)
    } else if (err.name === 'OverconstrainedError') {
      message.warning(`${kindLabel}配置参数不受当前硬件支持`)
    } else {
      message.error(`${kindLabel}启动失败: ${err.message || err.name}`)
    }
  }

  async function requestSingleTrack(kind) {
    const isVideo = kind === 'video'
    const deviceId = isVideo ? mediaStore.selectedVideoInputId : mediaStore.selectedAudioInputId
    const makeConstraints = (withDevice) =>
      isVideo
        ? { video: buildVideoConstraints(withDevice ? deviceId : '', false), audio: false }
        : { audio: buildAudioConstraints(withDevice ? deviceId : '', false), video: false }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia(makeConstraints(true))
    } catch (err) {
      if (deviceId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        if (isVideo) mediaStore.setSelectedVideoInput('')
        else mediaStore.setSelectedAudioInput('')
        stream = await navigator.mediaDevices.getUserMedia(makeConstraints(false))
      } else {
        throw err
      }
    }
    return isVideo ? stream.getVideoTracks()[0] || null : stream.getAudioTracks()[0] || null
  }

  /**
   * 获取本地摄像头与麦克风媒体流
   * @param {Object} options { audio: boolean, video: boolean }
   */
  async function initLocalStream(options = { audio: true, video: true }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message.error('当前浏览器不支持 WebRTC getUserMedia，请在 HTTPS 或 localhost 环境下运行')
      throw new Error('getUserMedia not supported')
    }

    // 先停止已有本地流
    stopLocalStream()

    const wantAudio = options.audio !== false
    const wantVideo = options.video !== false

    if (!wantAudio && !wantVideo) {
      localStream.value = new MediaStream()
      isAudioActive.value = false
      isVideoActive.value = false
      mediaStore.setMicMuted(true)
      mediaStore.setCameraOff(true)
      return localStream.value
    }

    const constraints = {
      audio: wantAudio ? buildAudioConstraints(mediaStore.selectedAudioInputId, false) : false,
      video: wantVideo ? buildVideoConstraints(mediaStore.selectedVideoInputId, false) : false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStream.value = stream
      isAudioActive.value = stream.getAudioTracks().some((t) => t.enabled)
      isVideoActive.value = stream.getVideoTracks().some((t) => t.enabled)

      mediaStore.setMicMuted(!isAudioActive.value)
      mediaStore.setCameraOff(!isVideoActive.value)

      // 重新枚举设备以读取带 label 的名称（首次授权后才有 label）
      enumerateDevices()

      return stream
    } catch (err) {
      console.error('获取音视频流失败，尝试按单设备降级获取:', err)
      // 若同时请求音视频失败（例如缺少摄像头或摄像头被占用），尝试分别获取可用轨道
      const tracks = []
      let audioErr = null
      let videoErr = null

      if (wantAudio) {
        try {
          const aTrack = await requestSingleTrack('audio')
          if (aTrack) tracks.push(aTrack)
        } catch (e) {
          audioErr = e
        }
      }
      if (wantVideo) {
        try {
          const vTrack = await requestSingleTrack('video')
          if (vTrack) tracks.push(vTrack)
        } catch (e) {
          videoErr = e
        }
      }

      if (tracks.length > 0) {
        const fallbackStream = new MediaStream(tracks)
        localStream.value = fallbackStream
        isAudioActive.value = fallbackStream.getAudioTracks().some((t) => t.enabled)
        isVideoActive.value = fallbackStream.getVideoTracks().some((t) => t.enabled)
        mediaStore.setMicMuted(!isAudioActive.value)
        mediaStore.setCameraOff(!isVideoActive.value)
        enumerateDevices()

        if (videoErr) reportMediaError(videoErr, '摄像头')
        if (audioErr) reportMediaError(audioErr, '麦克风')
        return fallbackStream
      }

      reportMediaError(videoErr || audioErr || err, wantVideo && wantAudio ? '摄像头与麦克风' : wantVideo ? '摄像头' : '麦克风')
      throw err
    }
  }

  function setMediaKindState(kind, active) {
    if (kind === 'video') {
      isVideoActive.value = active
      mediaStore.setCameraOff(!active)
    } else {
      isAudioActive.value = active
      mediaStore.setMicMuted(!active)
    }
  }

  function replaceTrackInLocalStream(kind, newTrack, active) {
    newTrack.enabled = active
    const keepOtherTracks = localStream.value
      ? (kind === 'video' ? localStream.value.getAudioTracks() : localStream.value.getVideoTracks()).filter(
          (t) => t.readyState !== 'ended'
        )
      : []

    if (localStream.value) {
      const oldSameKind = kind === 'video' ? localStream.value.getVideoTracks() : localStream.value.getAudioTracks()
      oldSameKind.forEach((t) => t.stop())
    }

    localStream.value = new MediaStream([...keepOtherTracks, newTrack])
    setMediaKindState(kind, active)
    return newTrack
  }

  const pendingToggle = { audio: false, video: false }

  async function toggleMediaKind(kind, enabled) {
    const isVideo = kind === 'video'
    const currentActive = isVideo ? isVideoActive.value : isAudioActive.value
    const label = isVideo ? '摄像头' : '麦克风'
    const nextEnabled = enabled === undefined ? !currentActive : Boolean(enabled)

    if (!nextEnabled) {
      if (localStream.value) {
        const tracks = isVideo ? localStream.value.getVideoTracks() : localStream.value.getAudioTracks()
        tracks.forEach((track) => {
          track.enabled = false
        })
      }
      setMediaKindState(kind, false)
      return false
    }

    const existingTracks = localStream.value
      ? (isVideo ? localStream.value.getVideoTracks() : localStream.value.getAudioTracks()).filter(
          (t) => t.readyState !== 'ended'
        )
      : []

    if (existingTracks.length > 0) {
      existingTracks.forEach((track) => {
        track.enabled = true
      })
      setMediaKindState(kind, true)
      return true
    }

    if (pendingToggle[kind]) {
      return isVideo ? isVideoActive.value : isAudioActive.value
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      message.error(`当前浏览器不支持开启${label}，请检查 HTTPS/localhost 环境`)
      setMediaKindState(kind, false)
      return false
    }

    pendingToggle[kind] = true
    try {
      const newTrack = await requestSingleTrack(kind)
      if (!newTrack) {
        throw new Error(`未获取到有效${label}轨道`)
      }
      replaceTrackInLocalStream(kind, newTrack, true)
      enumerateDevices()
      return true
    } catch (err) {
      console.error(`开启${label}失败:`, err)
      reportMediaError(err, label)
      setMediaKindState(kind, false)
      return false
    } finally {
      pendingToggle[kind] = false
    }
  }

  async function switchMediaInputDevice(kind, deviceId) {
    if (!navigator.mediaDevices?.getUserMedia) return null
    const isVideo = kind === 'video'
    if (isVideo) {
      mediaStore.setSelectedVideoInput(deviceId)
    } else {
      mediaStore.setSelectedAudioInput(deviceId)
    }

    const constraints = isVideo
      ? { video: buildVideoConstraints(deviceId, true), audio: false }
      : { audio: buildAudioConstraints(deviceId, true), video: false }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      reportMediaError(err, isVideo ? '摄像头' : '麦克风')
      throw err
    }

    const newTrack = isVideo ? stream.getVideoTracks()[0] || null : stream.getAudioTracks()[0] || null
    if (!newTrack) return null
    const active = isVideo ? isVideoActive.value : isAudioActive.value
    return replaceTrackInLocalStream(kind, newTrack, active)
  }

  /**
   * 开启/关闭麦克风静音（若当前尚无音频轨道，开启时自动向浏览器申请采集）
   * @param {boolean} enabled
   */
  function toggleAudio(enabled) {
    return toggleMediaKind('audio', enabled)
  }

  /**
   * 开启/关闭摄像头（若当前尚无视频轨道，开启时自动向浏览器申请采集）
   * @param {boolean} enabled
   */
  function toggleVideo(enabled) {
    return toggleMediaKind('video', enabled)
  }

  /**
   * 运行中热切换麦克风设备
   * @param {string} deviceId
   * @returns {Promise<MediaStreamTrack|null>}
   */
  function switchAudioInputDevice(deviceId) {
    return switchMediaInputDevice('audio', deviceId)
  }

  /**
   * 运行中热切换摄像头设备
   * @param {string} deviceId
   * @returns {Promise<MediaStreamTrack|null>}
   */
  function switchVideoInputDevice(deviceId) {
    return switchMediaInputDevice('video', deviceId)
  }

  /**
   * 发起屏幕共享
   * @param {Function} onEndedCallback 屏幕共享结束回调
   */
  async function startScreenShare(onEndedCallback) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      message.error('当前浏览器不支持屏幕共享 (getDisplayMedia)')
      throw new Error('getDisplayMedia not supported')
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 15, max: 30 }
        },
        audio: false, // 大多数会议场景避免回声，默认不抓取系统音频
        selfBrowserSurface: 'exclude', // 提示浏览器优先推荐外部窗口或屏幕，避免选中自身产生死循环镜像
        surfaceSwitching: 'include'
      })

      screenStream.value = stream
      isScreenSharing.value = true
      mediaStore.setSharingScreen(true)

      const screenTrack = stream.getVideoTracks()[0]
      if (screenTrack) {
        screenTrack.onended = () => {
          stopScreenShare()
          if (onEndedCallback) onEndedCallback()
        }
      }

      return stream
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('发起屏幕共享失败:', err)
        message.error('启动屏幕共享失败')
      }
      throw err
    }
  }

  /**
   * 停止屏幕共享
   */
  function stopScreenShare() {
    if (screenStream.value) {
      screenStream.value.getTracks().forEach((track) => track.stop())
      screenStream.value = null
    }
    isScreenSharing.value = false
    mediaStore.setSharingScreen(false)
  }

  /**
   * 停止并释放本地音视频轨道
   */
  function stopLocalStream() {
    stopMicMeter()
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => track.stop())
      localStream.value = null
    }
    isAudioActive.value = false
    isVideoActive.value = false
  }

  /**
   * 停止所有媒体流（包括摄像头、麦克风和屏幕共享）
   */
  function stopAllTracks() {
    stopLocalStream()
    stopScreenShare()
  }

  /**
   * 启动麦克风音量采样动画（用于设置页面的麦克风测试）
   */
  function startMicMeter(stream) {
    stopMicMeter()
    const targetStream = stream || localStream.value
    if (!targetStream || targetStream.getAudioTracks().length === 0) return

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      audioContext = new AudioCtx()
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      const source = audioContext.createMediaStreamSource(targetStream)
      source.connect(analyserNode)

      const bufferLength = analyserNode.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateVolume = () => {
        analyserNode.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        // 归一化为 0 - 100
        micVolumeLevel.value = Math.min(100, Math.round((average / 128) * 100))
        micLevelAnimationId = requestAnimationFrame(updateVolume)
      }
      updateVolume()
    } catch (e) {
      console.warn('启动音量监测失败:', e)
    }
  }

  /**
   * 停止麦克风音量采样
   */
  function stopMicMeter() {
    if (micLevelAnimationId) {
      cancelAnimationFrame(micLevelAnimationId)
      micLevelAnimationId = null
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close()
      audioContext = null
    }
    analyserNode = null
    micVolumeLevel.value = 0
  }

  return {
    localStream,
    screenStream,
    isAudioActive,
    isVideoActive,
    isScreenSharing,
    micVolumeLevel,
    enumerateDevices,
    initLocalStream,
    toggleAudio,
    toggleVideo,
    switchAudioInputDevice,
    switchVideoInputDevice,
    startScreenShare,
    stopScreenShare,
    stopLocalStream,
    stopAllTracks,
    startMicMeter,
    stopMicMeter
  }
}

