import { defineStore } from 'pinia'
import { message } from 'ant-design-vue'
import {
  getRecordingList,
  getTranscriptSegments,
  getMeetingMinutes,
  getDecisionList,
  getActionItemList,
  getTaskStatus,
  getAgentLogs,
  startAnalysis
} from '@/api/meetingAi'

export const useMeetingAiStore = defineStore('meetingAi', {
  state: () => ({
    // 当前工作空间绑定的会议 ID 与元数据
    currentMeetingId: '',
    meetingInfo: null,
    activeTab: 'overview', // 'overview' | 'transcript' | 'recording' | 'minutes' | 'topics' | 'decisions' | 'actionItems' | 'qa' | 'agents'

    // 录音文件管理
    recordings: [],
    recordingsLoading: false,

    // 转写片段
    transcriptSegments: [],
    transcriptTotal: 0,
    transcriptPageNo: 1,
    transcriptPageSize: 50,
    transcriptLoading: false,
    highlightSegmentId: null, // 证据定位高亮片段 ID

    // 结构化纪要与议题
    minutes: null,
    minutesLoading: false,
    agendaTopics: [],

    // 决策与待办
    decisions: [],
    decisionsLoading: false,
    actionItems: [],
    actionItemsLoading: false,

    // 多 Agent 执行监控
    currentTask: null,
    agentLogs: [],
    taskPollingTimer: null,
    isAnalyzing: false,

    // 播放器时间戳联动 (毫秒)
    audioSeekTimeMs: 0
  }),

  getters: {
    // 纪要状态枚举文本
    minutesStatusLabel: (state) => {
      const status = state.minutes?.status
      switch (status) {
        case 0:
          return '草稿'
        case 1:
          return '待审核'
        case 2:
          return '已正式发布'
        case 3:
          return '历史归档'
        default:
          return '未生成'
      }
    },

    // 纪要状态色彩
    minutesStatusColor: (state) => {
      const status = state.minutes?.status
      switch (status) {
        case 0:
          return 'warning'
        case 1:
          return 'processing'
        case 2:
          return 'success'
        case 3:
          return 'default'
        default:
          return 'default'
      }
    },

    // 候选待人工确认的决策
    pendingDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'PENDING')
    },

    // 已经确认生效的决策
    confirmedDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'CONFIRMED')
    }
  },

  actions: {
    /**
     * 设置当前会议并重置对应状态
     */
    initMeeting(meetingId, meetingInfo = null) {
      if (this.currentMeetingId !== meetingId) {
        this.resetState()
        this.currentMeetingId = meetingId
      }
      if (meetingInfo) {
        this.meetingInfo = meetingInfo
      }
    },

    /**
     * 证据链点击后，跳转至转写面板并高亮目标片段
     */
    jumpToSegment(segmentId, startTimeMs = null) {
      this.highlightSegmentId = segmentId
      this.activeTab = 'transcript'
      if (startTimeMs !== null && startTimeMs !== undefined) {
        this.audioSeekTimeMs = startTimeMs
      }
    },

    /**
     * 刷新录音列表
     */
    async loadRecordings(meetingId = this.currentMeetingId) {
      if (!meetingId) return
      this.recordingsLoading = true
      try {
        const res = await getRecordingList(meetingId)
        this.recordings = res || []
      } catch (err) {
        console.error('获取录音列表失败', err)
      } finally {
        this.recordingsLoading = false
      }
    },

    /**
     * 刷新转写片段
     */
    async loadTranscriptSegments(meetingId = this.currentMeetingId, pageNo = 1, pageSize = 50) {
      if (!meetingId) return
      this.transcriptLoading = true
      try {
        const res = await getTranscriptSegments({
          meetingId,
          pageNo,
          pageSize
        })
        if (res) {
          this.transcriptSegments = res.list || []
          this.transcriptTotal = res.totalCount || 0
          this.transcriptPageNo = res.pageNo || 1
          this.transcriptPageSize = res.pageSize || 50
        }
      } catch (err) {
        console.error('获取转写片段失败', err)
      } finally {
        this.transcriptLoading = false
      }
    },

    /**
     * 刷新会议纪要及议题
     */
    async loadMinutes(meetingId = this.currentMeetingId) {
      if (!meetingId) return
      this.minutesLoading = true
      try {
        const data = await getMeetingMinutes(meetingId)
        this.minutes = data
        if (data && data.agendaTopics) {
          try {
            this.agendaTopics = typeof data.agendaTopics === 'string'
              ? JSON.parse(data.agendaTopics)
              : data.agendaTopics
          } catch (e) {
            this.agendaTopics = []
          }
        } else {
          this.agendaTopics = []
        }
      } catch (err) {
        console.error('获取会议纪要失败', err)
        this.minutes = null
        this.agendaTopics = []
      } finally {
        this.minutesLoading = false
      }
    },

    /**
     * 刷新决策列表
     */
    async loadDecisions(meetingId = this.currentMeetingId) {
      if (!meetingId) return
      this.decisionsLoading = true
      try {
        const data = await getDecisionList(meetingId)
        this.decisions = data || []
      } catch (err) {
        console.error('获取决策列表失败', err)
      } finally {
        this.decisionsLoading = false
      }
    },

    /**
     * 刷新待办列表
     */
    async loadActionItems(meetingId = this.currentMeetingId) {
      if (!meetingId) return
      this.actionItemsLoading = true
      try {
        const data = await getActionItemList({ meetingId })
        this.actionItems = data || []
      } catch (err) {
        console.error('获取待办列表失败', err)
      } finally {
        this.actionItemsLoading = false
      }
    },

    /**
     * 一键刷新全部当前会议 AI 业务数据
     */
    async refreshAll(meetingId = this.currentMeetingId) {
      if (!meetingId) return
      await Promise.allSettled([
        this.loadRecordings(meetingId),
        this.loadTranscriptSegments(meetingId, 1, this.transcriptPageSize),
        this.loadMinutes(meetingId),
        this.loadDecisions(meetingId),
        this.loadActionItems(meetingId)
      ])
    },

    /**
     * 触发全量多 Agent 分析流水线并开启状态轮询
     */
    async triggerAnalysis(meetingId = this.currentMeetingId, forceReanalyze = false) {
      if (!meetingId) return
      this.isAnalyzing = true
      try {
        const task = await startAnalysis({
          meetingId,
          targetLanguage: 'zh',
          forceReanalyze
        })
        this.currentTask = task
        message.success('已启动多 Agent 分析流水线')
        if (task && task.taskId) {
          this.startTaskPolling(task.taskId)
        }
      } catch (err) {
        message.error(err.message || '启动 AI 分析流水线失败')
        this.isAnalyzing = false
      }
    },

    /**
     * 开启任务轮询 (每 2.5 秒)
     */
    startTaskPolling(taskId) {
      this.stopTaskPolling()
      const poll = async () => {
        try {
          const task = await getTaskStatus(taskId)
          this.currentTask = task
          if (task && task.taskId) {
            const logs = await getAgentLogs(task.taskId)
            this.agentLogs = logs || []
          }

          if (task && (task.taskStatus === 'SUCCESS' || task.taskStatus === 'FAILED' || task.taskStatus === 'CANCELLED')) {
            this.isAnalyzing = false
            this.stopTaskPolling()
            if (task.taskStatus === 'SUCCESS') {
              message.success('多 Agent 会议分析完成')
              // 自动刷新纪要、议题、决策和待办
              this.loadMinutes()
              this.loadDecisions()
              this.loadActionItems()
            } else if (task.taskStatus === 'FAILED') {
              message.error(`AI 分析流水线执行失败: ${task.errorMessage || '未知错误'}`)
            }
          }
        } catch (e) {
          console.warn('轮询 AI 任务状态异常', e)
        }
      }

      poll()
      this.taskPollingTimer = setInterval(poll, 2500)
    },

    /**
     * 停止轮询
     */
    stopTaskPolling() {
      if (this.taskPollingTimer) {
        clearInterval(this.taskPollingTimer)
        this.taskPollingTimer = null
      }
    },

    /**
     * 重置状态（切会议或离会）
     */
    resetState() {
      this.stopTaskPolling()
      this.currentMeetingId = ''
      this.meetingInfo = null
      this.activeTab = 'overview'
      this.recordings = []
      this.recordingsLoading = false
      this.transcriptSegments = []
      this.transcriptTotal = 0
      this.transcriptPageNo = 1
      this.transcriptLoading = false
      this.highlightSegmentId = null
      this.minutes = null
      this.minutesLoading = false
      this.agendaTopics = []
      this.decisions = []
      this.decisionsLoading = false
      this.actionItems = []
      this.actionItemsLoading = false
      this.currentTask = null
      this.agentLogs = []
      this.isAnalyzing = false
      this.audioSeekTimeMs = 0
    }
  }
})

