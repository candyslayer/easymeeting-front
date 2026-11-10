import { defineStore } from 'pinia'
import { message, notification } from 'ant-design-vue'
import {
  getRecordingList,
  getTranscriptSegments,
  getMeetingMinutes,
  getDecisionList,
  getDecisionDetail,
  getActionItemList,
  getTaskStatus,
  getAgentLogs,
  startAnalysis,
  toggleMeetingFeature,
  getMeetingFeatureStatus,
  confirmDecision,
  rejectDecision,
  deferDecision,
  getDecisionEvents
} from '@/api/meetingAi'

export const useMeetingAiStore = defineStore('meetingAi', {
  state: () => ({
    // 当前工作空间绑定的会议 ID 与元数据
    currentMeetingId: '',
    meetingInfo: null,
    activeTab: 'overview', // 'overview' | 'transcript' | 'recording' | 'minutes' | 'topics' | 'decisions' | 'actionItems' | 'qa' | 'agents'

    // 会议级功能配置与统一 ASR 引擎状态
    featureConfig: {
      transcriptionEnabled: false,
      liveDecisionEnabled: false,
      asrRunning: false
    },
    featureLoading: false,

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
    activeDecisionId: null, // 当前脑图聚焦的决策 ID
    decisionEvents: [], // 实时决策演进事件记录流
    decisionEventsLoading: false,
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
    // 统一 ASR 引擎是否运行中
    isAsrRunning: (state) => Boolean(state.featureConfig?.asrRunning),
    isTranscriptionEnabled: (state) => Boolean(state.featureConfig?.transcriptionEnabled),
    isLiveDecisionEnabled: (state) => Boolean(state.featureConfig?.liveDecisionEnabled),

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

    // 决策分类
    proposedDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'PROPOSED' || d.status === 'PENDING')
    },
    discussingDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'DISCUSSING')
    },
    confirmedDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'CONFIRMED')
    },
    deferredDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'DEFERRED')
    },
    rejectedDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'REJECTED')
    },
    pendingDecisions: (state) => {
      return state.decisions.filter((d) => d.status === 'PENDING' || d.status === 'PROPOSED' || d.status === 'DISCUSSING')
    }
  },

  actions: {
    /**
     * 设置当前会议并重置对应状态
     */
    initMeeting(meetingId, meetingInfo = null) {
      if (!meetingId) return
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
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.recordingsLoading = true
      try {
        const res = await getRecordingList(mid)
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
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.transcriptLoading = true
      try {
        const res = await getTranscriptSegments({
          meetingId: mid,
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
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.minutesLoading = true
      try {
        const data = await getMeetingMinutes(mid)
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

        // 若当前接口返回了内嵌的决策与待办，第一时间同步
        if (data && Array.isArray(data.decisions) && data.decisions.length > 0) {
          this.decisions = data.decisions
        }
        if (data && Array.isArray(data.actionItems) && data.actionItems.length > 0) {
          this.actionItems = data.actionItems
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
     * 查询会议功能开关状态与统一 ASR 引擎状态
     */
    async fetchFeatureStatus(meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.featureLoading = true
      try {
        const config = await getMeetingFeatureStatus(mid)
        if (config) {
          this.featureConfig = {
            transcriptionEnabled: Boolean(config.transcriptionEnabled),
            liveDecisionEnabled: Boolean(config.liveDecisionEnabled),
            asrRunning: Boolean(config.asrRunning)
          }
        }
      } catch (err) {
        console.warn('查询会议功能状态失败', err)
      } finally {
        this.featureLoading = false
      }
    },

    /**
     * 动态切换会议功能（实时转写 / 会中决策）
     * 自动驱动后端 SessionManager 进行 ASR 生命周期管理
     */
    async toggleFeature(feature, enabled, meetingId = this.currentMeetingId) {
      if (!meetingId) return
      this.featureLoading = true
      try {
        const config = await toggleMeetingFeature({
          meetingId,
          feature,
          enabled
        })
        if (config) {
          this.featureConfig = {
            transcriptionEnabled: Boolean(config.transcriptionEnabled),
            liveDecisionEnabled: Boolean(config.liveDecisionEnabled),
            asrRunning: Boolean(config.asrRunning)
          }
        }
        const label = feature === 'transcription' ? '实时语音转写' : '会中决策识别'
        message.success(`${label}已${enabled ? '开启' : '关闭'}`)
      } catch (err) {
        message.error(err.message || '切换功能开关失败')
      } finally {
        this.featureLoading = false
      }
    },

    /**
     * 处理 WebSocket / SSE 广播的决策演进事件 (messageType 30)
     */
    handleDecisionEvent(eventDto) {
      if (!eventDto) return
      console.log('⚡ 收到会中决策实时演进事件:', eventDto)

      // 1. 记入本地演进流水
      this.decisionEvents.unshift(eventDto)
      if (this.decisionEvents.length > 50) {
        this.decisionEvents.pop()
      }

      // 2. 局部增量或就地更新决策列表
      const targetDecision = eventDto.currentDecision
      if (targetDecision && targetDecision.decisionId) {
        const existingIdx = this.decisions.findIndex(
          (d) => String(d.decisionId) === String(targetDecision.decisionId)
        )
        if (existingIdx !== -1) {
          // 合并更新
          this.decisions[existingIdx] = {
            ...this.decisions[existingIdx],
            ...targetDecision
          }
        } else {
          // 新增决策
          this.decisions.unshift(targetDecision)
        }

        // 如果未聚焦任何决策，则聚焦最新演进的决策
        if (!this.activeDecisionId) {
          this.activeDecisionId = targetDecision.decisionId
        }
      } else if (eventDto.decisionId) {
        // 如果未附带完整 currentDecision，通过 ID 就地更新状态或重新拉取
        const existingIdx = this.decisions.findIndex(
          (d) => String(d.decisionId) === String(eventDto.decisionId)
        )
        if (existingIdx !== -1) {
          if (eventDto.currentStatus) {
            this.decisions[existingIdx].status = eventDto.currentStatus
          }
          if (eventDto.topic) {
            this.decisions[existingIdx].topic = eventDto.topic
          }
        } else {
          this.loadDecisions()
        }
      }

      // 3. 桌面/卡片提示通知
      const eventType = eventDto.eventType
      const topicName = eventDto.topic || targetDecision?.topic || '决策事项'
      if (eventType === 'CREATED') {
        notification.info({
          message: '识别到新会议决策议题',
          description: `主题: ${topicName} (状态: 候选待定)`,
          duration: 3.5
        })
      } else if (eventType === 'CONFIRMED') {
        notification.success({
          message: '决策已达成一致并确认',
          description: `「${topicName}」已正式生效`,
          duration: 3.5
        })
      } else if (eventType === 'UPDATED') {
        message.info(`会中决策更新: ${topicName}`)
      }
    },

    /**
     * 确认决策生效
     */
    async confirmDecisionAction(decisionId, remark = '') {
      try {
        const updated = await confirmDecision({ decisionId, remark })
        if (updated) {
          const idx = this.decisions.findIndex((d) => String(d.decisionId) === String(decisionId))
          if (idx !== -1) {
            this.decisions[idx] = { ...this.decisions[idx], ...updated }
          }
        }
        message.success('决策已正式确认生效')
        return updated
      } catch (err) {
        message.error(err.message || '确认决策失败')
        throw err
      }
    },

    /**
     * 否决决策
     */
    async rejectDecisionAction(decisionId, remark = '') {
      try {
        const updated = await rejectDecision({ decisionId, remark })
        if (updated) {
          const idx = this.decisions.findIndex((d) => String(d.decisionId) === String(decisionId))
          if (idx !== -1) {
            this.decisions[idx] = { ...this.decisions[idx], ...updated }
          }
        }
        message.info('决策已标记为否决/废弃')
        return updated
      } catch (err) {
        message.error(err.message || '否决决策失败')
        throw err
      }
    },

    /**
     * 暂缓决定
     */
    async deferDecisionAction(decisionId, remark = '') {
      try {
        const updated = await deferDecision({ decisionId, remark })
        if (updated) {
          const idx = this.decisions.findIndex((d) => String(d.decisionId) === String(decisionId))
          if (idx !== -1) {
            this.decisions[idx] = { ...this.decisions[idx], ...updated }
          }
        }
        message.info('决策已转为暂缓决定')
        return updated
      } catch (err) {
        message.error(err.message || '暂缓决策失败')
        throw err
      }
    },

    /**
     * 查询决策演进事件历史
     */
    async loadDecisionEvents(decisionId = null, meetingId = this.currentMeetingId) {
      if (!meetingId) return
      this.decisionEventsLoading = true
      try {
        const list = await getDecisionEvents({ meetingId, decisionId })
        this.decisionEvents = list || []
        return this.decisionEvents
      } catch (err) {
        console.warn('获取决策演进记录失败', err)
      } finally {
        this.decisionEventsLoading = false
      }
    },

    /**
     * 设置当前聚焦脑图的决策 ID
     */
    setActiveDecision(decisionId) {
      this.activeDecisionId = decisionId
    },

    /**
     * 刷新决策列表
     */
    async loadDecisions(meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.decisionsLoading = true
      try {
        const data = await getDecisionList(mid)
        this.decisions = data || []
        if (this.decisions.length > 0 && !this.activeDecisionId) {
          this.activeDecisionId = this.decisions[0].decisionId
        }
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
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.actionItemsLoading = true
      try {
        const data = await getActionItemList({ meetingId: mid })
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
      const mid = meetingId || this.currentMeetingId
      if (!mid) return
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      await Promise.allSettled([
        this.loadRecordings(mid),
        this.loadTranscriptSegments(mid, 1, this.transcriptPageSize),
        this.loadMinutes(mid),
        this.loadDecisions(mid),
        this.loadActionItems(mid)
      ])
    },

    /**
     * 触发全量多 Agent 分析流水线并开启状态轮询
     */
    async triggerAnalysis(meetingId = this.currentMeetingId, forceReanalyze = false) {
      const targetMeetingId = meetingId || this.currentMeetingId
      if (!targetMeetingId) return
      this.currentMeetingId = targetMeetingId
      this.isAnalyzing = true
      try {
        const task = await startAnalysis({
          meetingId: targetMeetingId,
          targetLanguage: 'zh',
          forceReanalyze
        })
        this.currentTask = task
        message.success('已启动多 Agent 分析流水线')
        if (task && task.taskId) {
          this.startTaskPolling(task.taskId, targetMeetingId)
        }
      } catch (err) {
        message.error(err.message || '启动 AI 分析流水线失败')
        this.isAnalyzing = false
      }
    },

    /**
     * 开启任务轮询 (1.2 秒高响应轮询)
     */
    startTaskPolling(taskId, meetingId = this.currentMeetingId) {
      this.stopTaskPolling()
      const targetMeetingId = meetingId || this.currentMeetingId
      if (targetMeetingId) {
        this.currentMeetingId = targetMeetingId
      }

      const poll = async () => {
        try {
          const task = await getTaskStatus(taskId)
          this.currentTask = task
          const effectiveMeetingId = targetMeetingId || task?.meetingId || this.currentMeetingId
          if (effectiveMeetingId && !this.currentMeetingId) {
            this.currentMeetingId = effectiveMeetingId
          }

          if (task && task.taskId) {
            const logs = await getAgentLogs(task.taskId)
            this.agentLogs = logs || []
          }

          if (task && (task.taskStatus === 'SUCCESS' || task.taskStatus === 'FAILED' || task.taskStatus === 'CANCELLED')) {
            this.isAnalyzing = false
            this.stopTaskPolling()
            if (task.taskStatus === 'SUCCESS') {
              message.success('多 Agent 会议分析完成，已同步生成纪要与议题')
              // 得到数据的瞬间，立刻拉取并在页面同步显示
              if (effectiveMeetingId) {
                await Promise.allSettled([
                  this.loadMinutes(effectiveMeetingId),
                  this.loadDecisions(effectiveMeetingId),
                  this.loadActionItems(effectiveMeetingId)
                ])
              }
            } else if (task.taskStatus === 'FAILED') {
              message.error(`AI 分析流水线执行失败: ${task.errorMessage || '未知错误'}`)
            }
          }
        } catch (e) {
          console.warn('轮询 AI 任务状态异常', e)
        }
      }

      poll()
      this.taskPollingTimer = setInterval(poll, 1200)
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
      this.featureConfig = {
        transcriptionEnabled: false,
        liveDecisionEnabled: false,
        asrRunning: false
      }
      this.featureLoading = false
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
      this.activeDecisionId = null
      this.decisionEvents = []
      this.decisionEventsLoading = false
      this.actionItems = []
      this.actionItemsLoading = false
      this.currentTask = null
      this.agentLogs = []
      this.isAnalyzing = false
      this.audioSeekTimeMs = 0
    }
  }
})

