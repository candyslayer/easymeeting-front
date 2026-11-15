import { defineStore } from 'pinia'
import { message, notification } from 'ant-design-vue'
import {
  listMeetingRecordings,
  getPlaybackInfo,
  deleteRecording,
  startReplayAnalysis,
  getReplayAnalysisStatus,
  retryReplayAnalysis,
  updateTopic,
  adjustTopicTimeline,
  getMeetingTimeline,
  getReplayTranscripts,
  searchReplayTranscripts
} from '@/api/meetingReplay'

export const useMeetingReplayStore = defineStore('meetingReplay', {
  state: () => ({
    // 当前绑定的会议 ID
    meetingId: '',

    // 录像与录音列表
    recordings: [],
    loadingRecordings: false,

    // 当前选中的回放录像
    selectedRecordingId: '',
    selectedRecording: null,

    // 播放信息与转码状态
    playbackInfo: null,
    loadingPlayback: false,
    transcodePollingTimer: null,

    // 议题时间轴聚合数据
    timeline: null,
    loadingTimeline: false,

    // 播放时间与高亮状态
    currentTimeMs: 0,
    isPlaying: false,
    seekTargetMs: null, // 由时间轴点击触发，通知播放器跳转
    activeTopicId: null,
    activeEventId: null,

    // AI 议题分析任务状态
    isAnalyzing: false,
    analysisTask: null,
    analysisPollingTimer: null,

    // 逐字稿与检索
    transcripts: [],
    transcriptTotal: 0,
    transcriptPageNo: 1,
    transcriptPageSize: 50,
    loadingTranscripts: false,
    searchKeyword: '',
    searchResults: [],
    searchingTranscripts: false
  }),

  getters: {
    // 议题列表
    topics: (state) => state.timeline?.topics || [],

    // 录像总时长毫秒
    totalDurationMs: (state) => {
      if (state.playbackInfo?.durationMs) {
        return state.playbackInfo.durationMs
      }
      if (state.timeline?.totalDurationMs) {
        return state.timeline.totalDurationMs
      }
      if (state.selectedRecording?.durationSeconds) {
        return state.selectedRecording.durationSeconds * 1000
      }
      return 0
    },

    // 视频是否准备就绪并可播放
    isPlaybackReady: (state) => {
      const status = state.playbackInfo?.processingStatus || state.selectedRecording?.processingStatus
      return status === 'READY' && Boolean(state.playbackInfo?.playbackFilePath || state.selectedRecording?.playbackFilePath)
    },

    // 视频转码中
    isTranscoding: (state) => {
      const status = state.playbackInfo?.processingStatus || state.selectedRecording?.processingStatus
      return status === 'PROCESSING' || status === 'UPLOADED'
    },

    // 转码失败
    isTranscodeFailed: (state) => {
      const status = state.playbackInfo?.processingStatus || state.selectedRecording?.processingStatus
      return status === 'FAILED'
    },

    // 当前高亮议题对象
    currentTopic: (state) => {
      if (!state.activeTopicId || !state.timeline?.topics) return null
      return state.timeline.topics.find((t) => t.id === state.activeTopicId) || null
    },

    // 平铺的所有事件列表，按时间排序
    allEvents: (state) => {
      const topics = state.timeline?.topics || []
      const events = []
      topics.forEach((t) => {
        if (Array.isArray(t.events)) {
          t.events.forEach((e) => {
            events.push({
              ...e,
              topicTitle: t.title,
              topicSortOrder: t.sortOrder
            })
          })
        }
      })
      return events.sort((a, b) => (a.startTimeMs || 0) - (b.startTimeMs || 0))
    }
  },

  actions: {
    /**
     * 初始化或切换会议，加载录像
     */
    async initMeeting(meetingId, targetRecordingId = '') {
      if (!meetingId) return
      this.meetingId = meetingId
      await this.loadRecordings(targetRecordingId)
    },

    /**
     * 查询会议录像列表
     */
    async loadRecordings(preferRecordingId = '') {
      this.loadingRecordings = true
      try {
        const res = await listMeetingRecordings(this.meetingId)
        this.recordings = Array.isArray(res) ? res : []

        // 自动选择合适的录像进行回放
        if (preferRecordingId && this.recordings.some((r) => r.recordingId === preferRecordingId)) {
          await this.selectRecording(preferRecordingId)
        } else if (!this.selectedRecordingId || !this.recordings.some((r) => r.recordingId === this.selectedRecordingId)) {
          if (this.recordings.length > 0) {
            // 优先选择第一个状态为 READY 的录像，否则选择第一个
            const readyOne = this.recordings.find((r) => r.processingStatus === 'READY' || r.mediaType === 'VIDEO')
            const chosen = readyOne || this.recordings[0]
            await this.selectRecording(chosen.recordingId)
          } else {
            this.selectedRecordingId = ''
            this.selectedRecording = null
            this.playbackInfo = null
            this.timeline = null
          }
        }
      } catch (err) {
        console.error('加载会议录像列表失败:', err)
      } finally {
        this.loadingRecordings = false
      }
    },

    /**
     * 选中指定录像进行回放
     */
    async selectRecording(recordingId) {
      if (!recordingId) return
      this.selectedRecordingId = recordingId
      this.selectedRecording = this.recordings.find((r) => r.recordingId === recordingId) || null
      this.currentTimeMs = 0
      this.activeTopicId = null
      this.activeEventId = null

      this.stopAllPolling()

      // 并行加载播放信息与时间轴
      await Promise.allSettled([
        this.loadPlaybackInfo(recordingId),
        this.loadTimeline(recordingId),
        this.loadTranscripts(recordingId, 1, 50)
      ])
    },

    /**
     * 查询录像播放信息与转码状态
     */
    async loadPlaybackInfo(recordingId) {
      if (!recordingId) return
      this.loadingPlayback = true
      try {
        const res = await getPlaybackInfo(recordingId)
        this.playbackInfo = res

        // 更新录像列表中对应项的最新状态
        const idx = this.recordings.findIndex((r) => r.recordingId === recordingId)
        if (idx !== -1 && res) {
          this.recordings[idx] = {
            ...this.recordings[idx],
            processingStatus: res.processingStatus,
            processingError: res.processingError,
            playbackFilePath: res.playbackFilePath,
            durationMs: res.durationMs
          }
          if (this.selectedRecordingId === recordingId) {
            this.selectedRecording = this.recordings[idx]
          }
        }

        // 如果处于转码中，自动开启短轮询检查
        if (res?.processingStatus === 'PROCESSING' || res?.processingStatus === 'UPLOADED') {
          this.startTranscodePolling(recordingId)
        } else {
          this.stopTranscodePolling()
        }
      } catch (err) {
        console.error('获取录像播放信息失败:', err)
      } finally {
        this.loadingPlayback = false
      }
    },

    /**
     * 开启转码状态轮询 (每 3 秒一次)
     */
    startTranscodePolling(recordingId) {
      this.stopTranscodePolling()
      this.transcodePollingTimer = setInterval(async () => {
        if (this.selectedRecordingId !== recordingId) {
          this.stopTranscodePolling()
          return
        }
        try {
          const res = await getPlaybackInfo(recordingId)
          if (res) {
            this.playbackInfo = res
            const idx = this.recordings.findIndex((r) => r.recordingId === recordingId)
            if (idx !== -1) {
              this.recordings[idx].processingStatus = res.processingStatus
              this.recordings[idx].processingError = res.processingError
              this.recordings[idx].playbackFilePath = res.playbackFilePath
            }
            if (res.processingStatus === 'READY') {
              this.stopTranscodePolling()
              message.success('视频切片转码处理完成，现在可以流畅回放！')
              // 自动拉取时间轴
              this.loadTimeline(recordingId)
            } else if (res.processingStatus === 'FAILED') {
              this.stopTranscodePolling()
              message.error(`视频转码失败: ${res.processingError || '未知错误'}`)
            }
          }
        } catch (e) {
          console.warn('轮询转码状态异常', e)
        }
      }, 3000)
    },

    stopTranscodePolling() {
      if (this.transcodePollingTimer) {
        clearInterval(this.transcodePollingTimer)
        this.transcodePollingTimer = null
      }
    },

    /**
     * 加载录像的议题时间轴
     */
    async loadTimeline(recordingId) {
      if (!recordingId) return
      this.loadingTimeline = true
      try {
        const res = await getMeetingTimeline(recordingId)
        this.timeline = res

        // 默认将高亮重置到第一个议题（若存在）
        if (this.timeline?.topics?.length > 0 && !this.activeTopicId) {
          this.activeTopicId = this.timeline.topics[0].id
        }
      } catch (err) {
        console.error('加载议题时间轴失败:', err)
      } finally {
        this.loadingTimeline = false
      }
    },

    /**
     * 发起或重新发起 AI 议题与事件识别
     */
    async triggerAnalysis(recordingId, forceReanalyze = false) {
      const targetId = recordingId || this.selectedRecordingId
      if (!targetId) {
        message.warning('请先选择需要分析的录像')
        return
      }

      this.isAnalyzing = true
      try {
        const task = await startReplayAnalysis(targetId, forceReanalyze)
        this.analysisTask = task
        message.loading({ content: 'AI 议题切分与事件识别任务已提交...', key: 'replay-analysis', duration: 2.5 })
        this.startAnalysisPolling(targetId)
      } catch (err) {
        this.isAnalyzing = false
        message.error(`发起 AI 分析失败: ${err.message || '请重试'}`)
      }
    },

    /**
     * 轮询 AI 任务状态
     */
    startAnalysisPolling(recordingId) {
      this.stopAnalysisPolling()
      this.analysisPollingTimer = setInterval(async () => {
        try {
          const res = await getReplayAnalysisStatus(recordingId)
          this.analysisTask = res

          // 任务完成判断 (status 2 = COMPLETED, status 3 = FAILED)
          if (res && (res.status === 2 || res.status === 'COMPLETED')) {
            this.stopAnalysisPolling()
            this.isAnalyzing = false
            message.success({ content: 'AI 会议议题与时间轴分析提炼完成！', key: 'replay-analysis' })
            await this.loadTimeline(recordingId)
          } else if (res && (res.status === 3 || res.status === 'FAILED')) {
            this.stopAnalysisPolling()
            this.isAnalyzing = false
            message.error({ content: `AI 议题分析失败: ${res.errorMessage || '未知异常'}`, key: 'replay-analysis' })
          }
        } catch (e) {
          console.warn('轮询 AI 分析状态出错', e)
        }
      }, 3000)
    },

    stopAnalysisPolling() {
      if (this.analysisPollingTimer) {
        clearInterval(this.analysisPollingTimer)
        this.analysisPollingTimer = null
      }
    },

    /**
     * 播放进度更新时触发高亮联动
     */
    updateCurrentTime(timeMs) {
      this.currentTimeMs = Math.round(timeMs)

      // 实时匹配当前播放时间所在的议题
      const topics = this.timeline?.topics || []
      const current = topics.find((t) => t.startTimeMs <= this.currentTimeMs && this.currentTimeMs <= t.endTimeMs)
      if (current) {
        this.activeTopicId = current.id

        // 匹配当前时间是否命中内部事件 (容错 4 秒)
        const hitEvent = (current.events || []).find((e) => {
          const end = e.endTimeMs || (e.startTimeMs + 4000)
          return e.startTimeMs <= this.currentTimeMs && this.currentTimeMs <= end
        })
        this.activeEventId = hitEvent ? hitEvent.id : null
      }
    },

    /**
     * 用户点击时间点，触发播放器 seek
     */
    seekTo(timeMs) {
      if (timeMs == null || isNaN(timeMs) || timeMs < 0) return
      this.currentTimeMs = Math.round(timeMs)
      this.seekTargetMs = this.currentTimeMs
      this.updateCurrentTime(this.currentTimeMs)
    },

    /**
     * 修改议题元信息
     */
    async editTopic(topicId, data) {
      try {
        await updateTopic(topicId, data)
        message.success('议题信息修改成功')
        if (this.selectedRecordingId) {
          await this.loadTimeline(this.selectedRecordingId)
        }
      } catch (err) {
        message.error(`修改失败: ${err.message}`)
        throw err
      }
    },

    /**
     * 人工微调议题起止时间
     */
    async adjustTopicTime(topicId, startTimeMs, endTimeMs) {
      try {
        await adjustTopicTimeline(topicId, startTimeMs, endTimeMs)
        message.success('议题时间轴微调成功')
        if (this.selectedRecordingId) {
          await this.loadTimeline(this.selectedRecordingId)
        }
      } catch (err) {
        message.error(`时间轴微调失败: ${err.message}`)
        throw err
      }
    },

    /**
     * 删除录像
     */
    async removeRecording(recordingId) {
      try {
        await deleteRecording(recordingId)
        message.success('录像文件已删除，历史议题与纪要资产已完整保留')
        await this.loadRecordings()
      } catch (err) {
        message.error(`删除失败: ${err.message}`)
        throw err
      }
    },

    /**
     * 加载逐字转写记录
     */
    async loadTranscripts(recordingId, pageNo = 1, pageSize = 50) {
      if (!recordingId) return
      this.loadingTranscripts = true
      this.transcriptPageNo = pageNo
      this.transcriptPageSize = pageSize
      try {
        const res = await getReplayTranscripts(recordingId, pageNo, pageSize)
        this.transcripts = res?.list || []
        this.transcriptTotal = res?.totalCount || 0
      } catch (err) {
        console.error('加载转写记录失败:', err)
      } finally {
        this.loadingTranscripts = false
      }
    },

    /**
     * 关键词检索逐字稿
     */
    async searchTranscripts(recordingId, keyword) {
      if (!recordingId || !keyword?.trim()) {
        this.searchResults = []
        return
      }
      this.searchingTranscripts = true
      this.searchKeyword = keyword.trim()
      try {
        const res = await searchReplayTranscripts(recordingId, this.searchKeyword, 1, 30)
        this.searchResults = res?.list || []
      } catch (err) {
        console.error('转写检索失败:', err)
        message.error('检索失败: ' + err.message)
      } finally {
        this.searchingTranscripts = false
      }
    },

    /**
     * 停止全部轮询
     */
    stopAllPolling() {
      this.stopTranscodePolling()
      this.stopAnalysisPolling()
    }
  }
})
