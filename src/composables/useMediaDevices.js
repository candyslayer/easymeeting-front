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

    const constraints = {
      audio: options.audio
        ? {
            deviceId: mediaStore.selectedAudioInputId
              ? { exact: mediaStore.selectedAudioInputId }
              : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        : false,
      video: options.video
        ? {
            deviceId: mediaStore.selectedVideoInputId
              ? { exact: mediaStore.selectedVideoInputId }
              : undefined,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 24, max: 30 }
          }
        : false
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
      console.error('获取音视频流失败:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message.error('请授予浏览器摄像头与麦克风访问权限')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message.warning('未检测到可用的摄像头或麦克风设备')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message.error('媒体设备正被其他程序占用，无法启动')
      } else {
        message.error(`媒体设备初始化失败: ${err.message}`)
      }
      throw err
    }
  }

  /**
   * 开启/关闭麦克风静音
   * @param {boolean} enabled 
   */
  function toggleAudio(enabled) {
    if (enabled === undefined) {
      enabled = !isAudioActive.value
    }
    if (localStream.value) {
      localStream.value.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
    isAudioActive.value = enabled
    mediaStore.setMicMuted(!enabled)
    return enabled
  }

  /**
   * 开启/关闭摄像头
   * @param {boolean} enabled 
   */
  function toggleVideo(enabled) {
    if (enabled === undefined) {
      enabled = !isVideoActive.value
    }
    if (localStream.value) {
      localStream.value.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
    isVideoActive.value = enabled
    mediaStore.setCameraOff(!enabled)
    return enabled
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
    startScreenShare,
    stopScreenShare,
    stopLocalStream,
    stopAllTracks,
    startMicMeter,
    stopMicMeter
  }
}

