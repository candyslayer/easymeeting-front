import { ref, watch, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  createRealtimeSession,
  streamAudioChunk,
  closeRealtimeSession,
  getTranscriptSegments,
  getTermEventsSseUrl
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'

/**
 * 会议内实时转写与多 Agent 协同数据流 Composable
 * 保证在切换画廊/演讲者/AI协作视图时，音频混音录制与 WS/SSE 监听持续不断线
 */
export function useRealtimeCopilot({ meetingId, localStream, remoteStreams, onWs }) {
  const aiStore = useMeetingAiStore()

  const isSessionActive = ref(false)
  const startingSession = ref(false)
  const currentSessionId = ref('')
  const chunkIndex = ref(0)
  const hasAutoStarted = ref(false)
  const userManuallyStopped = ref(false)
  const realtimeSegments = ref([])

  let mediaRecorder = null
  let audioContextInstance = null
  let mixerDestination = null
  let termEventSource = null
  const connectedSourceNodes = new Map()

  let unbindWsTranscript = null
  let unbindWsDecision = null
  let unbindWsMinutes = null
  let unbindWsTerms = null

  function connectStreamToMixer(stream, audioCtx, destination) {
    if (!stream || !audioCtx || !destination) return
    if (typeof stream.getAudioTracks !== 'function') return
    const audioTracks = stream.getAudioTracks()
    if (!audioTracks || audioTracks.length === 0) return

    const streamId = stream.id || String(Math.random())
    if (connectedSourceNodes.has(streamId)) return

    try {
      const sourceNode = audioCtx.createMediaStreamSource(stream)
      sourceNode.connect(destination)
      connectedSourceNodes.set(streamId, sourceNode)
    } catch (err) {
      console.warn('连接音频流到混音器失败', streamId, err)
    }
  }

  function disconnectAllMixerSources() {
    connectedSourceNodes.forEach((node) => {
      try {
        node.disconnect()
      } catch (e) {}
    })
    connectedSourceNodes.clear()
  }

  function appendOrUpdateSegment(seg) {
    if (!seg) return
    const existingIdx = realtimeSegments.value.findIndex(
      (s) => seg.segmentId && s.segmentId === seg.segmentId
    )
    if (existingIdx !== -1) {
      realtimeSegments.value[existingIdx] = { ...realtimeSegments.value[existingIdx], ...seg }
    } else {
      realtimeSegments.value.push(seg)
      aiStore.transcriptTotal = Math.max(aiStore.transcriptTotal || 0, realtimeSegments.value.length)
    }
  }

  function startRecording(stream) {
    if (!stream) return
    if (mediaRecorder && mediaRecorder.state !== 'inactive') return

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0 && isSessionActive.value) {
          chunkIndex.value++
          const currentIdx = chunkIndex.value
          try {
            const formData = new FormData()
            formData.append('sessionId', currentSessionId.value)
            formData.append('chunkIndex', currentIdx)
            formData.append('audioData', e.data, `chunk_${currentIdx}.webm`)
            formData.append('isLastChunk', false)

            const seg = await streamAudioChunk(formData)
            if (seg && (seg.originalText || seg.currentText)) {
              appendOrUpdateSegment(seg)
            }
          } catch (err) {
            console.warn('分片推送转写异常', err)
          }
        }
      }

      mediaRecorder.start(3000)
    } catch (e) {
      console.warn('初始化音频 MediaRecorder 失败，转写将依靠信令广播', e)
    }
  }

  async function startRealtimeSession(isAuto = false) {
    const mid = meetingId.value
    if (!mid || startingSession.value || isSessionActive.value) return

    startingSession.value = true
    try {
      let audioStream = null
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass) {
        try {
          disconnectAllMixerSources()
          audioContextInstance = new AudioContextClass()
          if (audioContextInstance.state === 'suspended') {
            await audioContextInstance.resume()
          }
          mixerDestination = audioContextInstance.createMediaStreamDestination()

          if (localStream.value) {
            connectStreamToMixer(localStream.value, audioContextInstance, mixerDestination)
          }
          if (remoteStreams) {
            Object.values(remoteStreams).forEach((rStream) => {
              connectStreamToMixer(rStream, audioContextInstance, mixerDestination)
            })
          }

          if (mixerDestination.stream && mixerDestination.stream.getAudioTracks().length > 0) {
            audioStream = mixerDestination.stream
          }
        } catch (err) {
          console.warn('初始化 Web Audio 混音器失败，降级使用本地麦克风', err)
        }
      }

      if (!audioStream && localStream.value && typeof localStream.value.getAudioTracks === 'function') {
        const audioTracks = localStream.value.getAudioTracks()
        if (audioTracks && audioTracks.length > 0) {
          audioStream = new MediaStream([audioTracks[0]])
        }
      }

      const session = await createRealtimeSession({
        meetingId: mid,
        sampleRate: 16000,
        audioFormat: 'webm'
      })

      currentSessionId.value = session.sessionId
      chunkIndex.value = 0
      isSessionActive.value = true

      if (audioStream) {
        startRecording(audioStream)
      }

      if (isAuto) {
        message.success('已自动开启全场实时语音转写')
      } else {
        message.success('实时转写会话已建立')
      }
    } catch (err) {
      if (!isAuto) {
        message.error(err.message || '开启实时转写失败')
      }
      isSessionActive.value = false
      disconnectAllMixerSources()
      if (audioContextInstance) {
        try {
          audioContextInstance.close()
        } catch (e) {}
        audioContextInstance = null
      }
      mixerDestination = null
    } finally {
      startingSession.value = false
    }
  }

  async function stopRealtimeSession(silent = false) {
    userManuallyStopped.value = true
    isSessionActive.value = false

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      } catch (e) {}
      mediaRecorder = null
    }

    disconnectAllMixerSources()
    if (audioContextInstance) {
      try {
        audioContextInstance.close()
      } catch (e) {}
      audioContextInstance = null
    }
    mixerDestination = null

    const sid = currentSessionId.value
    currentSessionId.value = ''

    if (sid) {
      try {
        await closeRealtimeSession({ sessionId: sid })
      } catch (e) {}
    }

    if (!silent) {
      message.info('实时转写会话已关闭')
    }
  }

  async function toggleRealtimeSession() {
    if (isSessionActive.value) {
      await stopRealtimeSession()
    } else {
      userManuallyStopped.value = false
      await startRealtimeSession(false)
    }
  }

  async function autoStartTranscriptionIfNeeded() {
    if (
      userManuallyStopped.value ||
      hasAutoStarted.value ||
      isSessionActive.value ||
      startingSession.value
    ) {
      return
    }
    const isEnabledInStorage = sessionStorage.getItem('initial_transcription_enabled') === '1'
    const isEnabledInStore = Boolean(aiStore.isTranscriptionEnabled)
    if (!isEnabledInStorage && !isEnabledInStore) return
    if (!meetingId.value) return

    hasAutoStarted.value = true
    await startRealtimeSession(true)
  }

  async function initCopilotData() {
    const mid = meetingId.value
    if (!mid) return
    aiStore.initMeeting(mid)
    await Promise.allSettled([
      aiStore.loadMinutes(mid),
      aiStore.loadDecisions(mid),
      aiStore.loadActionItems(mid),
      aiStore.loadMeetingTerms(mid),
      (async () => {
        try {
          const res = await getTranscriptSegments({
            meetingId: mid,
            pageNo: 1,
            pageSize: 50
          })
          if (res?.list) {
            realtimeSegments.value = res.list
            aiStore.transcriptTotal = res.totalCount || res.list.length
          }
        } catch (e) {}
      })()
    ])
  }

  function connectTermSse(targetMeetingId) {
    disconnectTermSse()
    if (!targetMeetingId || typeof EventSource === 'undefined') return
    const sseUrl = getTermEventsSseUrl(targetMeetingId)
    if (!sseUrl) return
    try {
      const es = new EventSource(sseUrl)
      es.addEventListener('TERM_DETECTED', (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          aiStore.handleRealtimeTermDetected(payload)
        } catch (err) {}
      })
      es.onerror = () => {}
      termEventSource = es
    } catch (err) {}
  }

  function disconnectTermSse() {
    if (termEventSource) {
      termEventSource.close()
      termEventSource = null
    }
  }

  function bindWsListeners() {
    if (typeof onWs !== 'function') return
    unbindWsListeners()

    unbindWsTranscript = onWs(20, (data) => {
      const seg = data.meesageContent || data
      if (seg) {
        appendOrUpdateSegment(seg)
      }
    })

    unbindWsDecision = onWs(30, (data) => {
      const eventDto = data.meesageContent || data
      if (eventDto) {
        aiStore.handleDecisionEvent(eventDto)
      }
    })

    unbindWsTerms = onWs(31, (data) => {
      const termPayload = data?.meesageContent || data
      if (termPayload) {
        aiStore.handleRealtimeTermDetected(termPayload)
      }
    })

    unbindWsMinutes = onWs(22, async (data) => {
      const targetId = meetingId.value || data?.meetingId || data?.meesageContent?.meetingId
      if (targetId) {
        await Promise.allSettled([
          aiStore.loadMinutes(targetId),
          aiStore.loadDecisions(targetId),
          aiStore.loadActionItems(targetId)
        ])
      }
    })
  }

  function unbindWsListeners() {
    if (typeof unbindWsTranscript === 'function') unbindWsTranscript()
    if (typeof unbindWsDecision === 'function') unbindWsDecision()
    if (typeof unbindWsMinutes === 'function') unbindWsMinutes()
    if (typeof unbindWsTerms === 'function') unbindWsTerms()
    unbindWsTranscript = null
    unbindWsDecision = null
    unbindWsMinutes = null
    unbindWsTerms = null
  }

  watch(
    () => localStream.value,
    (newLocal) => {
      if (newLocal) {
        if (!isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
          autoStartTranscriptionIfNeeded()
        } else if (isSessionActive.value) {
          if (audioContextInstance && mixerDestination) {
            connectStreamToMixer(newLocal, audioContextInstance, mixerDestination)
          } else if (!mediaRecorder) {
            const audioTracks = newLocal.getAudioTracks()
            if (audioTracks && audioTracks.length > 0) {
              startRecording(new MediaStream([audioTracks[0]]))
            }
          }
        }
      }
    }
  )

  watch(
    () => remoteStreams,
    (newRemote) => {
      if (isSessionActive.value && audioContextInstance && mixerDestination && newRemote) {
        Object.values(newRemote).forEach((rStream) => {
          connectStreamToMixer(rStream, audioContextInstance, mixerDestination)
        })
      }
    },
    { deep: true }
  )

  watch(
    () => aiStore.isTranscriptionEnabled,
    (enabled) => {
      if (enabled && !isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
        autoStartTranscriptionIfNeeded()
      }
    }
  )

  watch(
    () => meetingId.value,
    (newMid) => {
      if (newMid) {
        initCopilotData()
        connectTermSse(newMid)
      } else {
        disconnectTermSse()
      }
    }
  )

  const resumeAudioCtx = () => {
    if (audioContextInstance && audioContextInstance.state === 'suspended') {
      audioContextInstance.resume().catch(() => {})
    }
  }

  onMounted(async () => {
    bindWsListeners()
    if (meetingId.value) {
      initCopilotData()
      connectTermSse(meetingId.value)
      try {
        await aiStore.fetchFeatureStatus(meetingId.value)
      } catch (e) {}
    }
    autoStartTranscriptionIfNeeded()
    setTimeout(() => {
      if (!isSessionActive.value && !hasAutoStarted.value && !userManuallyStopped.value) {
        autoStartTranscriptionIfNeeded()
      }
    }, 1200)
    window.addEventListener('click', resumeAudioCtx, { once: true })
  })

  onUnmounted(() => {
    if (isSessionActive.value) {
      stopRealtimeSession(true)
    }
    unbindWsListeners()
    disconnectTermSse()
    window.removeEventListener('click', resumeAudioCtx)
  })

  return {
    isSessionActive,
    startingSession,
    realtimeSegments,
    toggleRealtimeSession,
    startRealtimeSession,
    stopRealtimeSession,
    appendOrUpdateSegment,
    initCopilotData
  }
}
