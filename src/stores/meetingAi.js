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
  getDecisionEvents,
  getTermDomainsMeta,
  getMeetingTermsList,
  getMeetingCausalChains,
  getMeetingTermOccurrences,
  getMeetingTermTraces,
  analyzeMeetingTermsSync,
  analyzeMeetingTermsAsync,
  correctMeetingTerm,
  updateMeetingTermConfig
} from '@/api/meetingAi'

export const useMeetingAiStore = defineStore('meetingAi', {
  state: () => ({
    // 当前工作空间绑定的会议 ID 与元数据
    currentMeetingId: '',
    meetingInfo: null,
    activeTab: 'overview', // 'overview' | 'transcript' | 'recording' | 'minutes' | 'topics' | 'decisions' | 'actionItems' | 'terminology' | 'qa' | 'agents'

    // 会议级功能配置与统一 ASR 引擎状态
    featureConfig: {
      transcriptionEnabled: false,
      liveDecisionEnabled: false,
      asrRunning: false,
      termIntelligenceEnabled: true,
      domainHint: '',
      preferredLang: 'zh'
    },
    featureLoading: false,

    // 行业术语智能理解状态
    meetingTerms: [],
    meetingTermsLoading: false,
    meetingCausalChains: [],
    meetingCausalSummary: '',
    meetingCausalMeta: null,
    causalChainsLoading: false,
    termOccurrences: [],
    termOccurrencesLoading: false,
    termTraces: [],
    termTracesLoading: false,
    termDomainsMeta: null,
    terminologyAnalyzing: false,

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
    isTermIntelligenceEnabled: (state) => state.featureConfig?.termIntelligenceEnabled !== false,
    conflictDualTermsCount: (state) => state.meetingTerms.filter((t) => t.ambiguityStatus === 'CONFLICT_DUAL').length,
    ambiguousTermsCount: (state) => state.meetingTerms.filter((t) => t.ambiguityStatus === 'AMBIGUOUS' || t.ambiguityStatus === 'UNRESOLVED').length,

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
            asrRunning: Boolean(config.asrRunning),
            termIntelligenceEnabled: config.termIntelligenceEnabled !== false,
            domainHint: config.domainHint || '',
            preferredLang: config.preferredLang || 'zh'
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
            asrRunning: Boolean(config.asrRunning),
            termIntelligenceEnabled: config.termIntelligenceEnabled !== false,
            domainHint: config.domainHint || '',
            preferredLang: config.preferredLang || 'zh'
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
        this.loadActionItems(mid),
        this.loadMeetingTerms(mid)
      ])
    },

    /**
     * 加载支持的行业领域列表与当前模型/LoRA版本元信息
     */
    async loadTermDomainsMeta() {
      if (this.termDomainsMeta) return this.termDomainsMeta
      try {
        const meta = await getTermDomainsMeta()
        this.termDomainsMeta = meta
        return meta
      } catch (err) {
        console.warn('获取术语领域与模型元信息失败', err)
        return null
      }
    },

    /**
     * 更新会中实时术语开关、领域提示或目标语言偏好
     */
    async updateTermConfig(partial = {}, meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return null
      this.featureLoading = true
      try {
        const payload = {
          meetingId: mid,
          termIntelligenceEnabled:
            partial.termIntelligenceEnabled !== undefined
              ? Boolean(partial.termIntelligenceEnabled)
              : this.featureConfig.termIntelligenceEnabled !== false,
          domainHint:
            partial.domainHint !== undefined ? partial.domainHint : this.featureConfig.domainHint,
          preferredLang:
            partial.preferredLang !== undefined ? partial.preferredLang : this.featureConfig.preferredLang
        }
        const config = await updateMeetingTermConfig(payload)
        if (config) {
          this.featureConfig = {
            ...this.featureConfig,
            termIntelligenceEnabled: config.termIntelligenceEnabled !== false,
            domainHint: config.domainHint || '',
            preferredLang: config.preferredLang || 'zh'
          }
        }
        message.success('实时术语理解配置已更新')
        return config
      } catch (err) {
        message.error(err.message || '更新术语配置失败')
        throw err
      } finally {
        this.featureLoading = false
      }
    },

    /**
     * 加载会议已识别的行业术语三层解释清单
     */
    async loadMeetingTerms(meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return []
      if (this.currentMeetingId !== mid) this.currentMeetingId = mid
      this.meetingTermsLoading = true
      try {
        const list = await getMeetingTermsList(mid)
        this.meetingTerms = Array.isArray(list) ? list : []
        return this.meetingTerms
      } catch (err) {
        console.warn('获取会议术语解释清单失败', err)
        return []
      } finally {
        this.meetingTermsLoading = false
      }
    },

    /**
     * 加载会议总结概览与跨领域因果传导链
     */
    async loadMeetingCausalChains(meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return null
      this.causalChainsLoading = true
      try {
        const res = await getMeetingCausalChains(mid)
        if (res) {
          this.meetingCausalChains = Array.isArray(res.causalChains) ? res.causalChains : []
          if (res.summary) {
            this.meetingCausalSummary = res.summary
          }
          this.meetingCausalMeta = {
            status: res.status,
            traceId: res.traceId,
            modelName: res.modelName,
            modelVersion: res.modelVersion,
            adapterVersion: res.adapterVersion,
            costMs: res.costMs
          }
        }
        return res
      } catch (err) {
        console.warn('获取会议跨域因果传导链失败', err)
        return null
      } finally {
        this.causalChainsLoading = false
      }
    },

    /**
     * 加载会议术语原文出现定位明细
     */
    async loadTermOccurrences(meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return []
      this.termOccurrencesLoading = true
      try {
        const list = await getMeetingTermOccurrences(mid)
        this.termOccurrences = Array.isArray(list) ? list : []
        return this.termOccurrences
      } catch (err) {
        console.warn('获取术语原文出现记录失败', err)
        return []
      } finally {
        this.termOccurrencesLoading = false
      }
    },

    /**
     * 加载会议术语 Trace 全链路审计记录
     */
    async loadTermTraces(meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return []
      this.termTracesLoading = true
      try {
        const list = await getMeetingTermTraces(mid)
        this.termTraces = Array.isArray(list) ? list : []
        return this.termTraces
      } catch (err) {
        console.warn('获取术语分析 Trace 失败', err)
        return []
      } finally {
        this.termTracesLoading = false
      }
    },

    /**
     * 手动触发会议术语同步分析
     */
    async triggerMeetingTermAnalysis(options = {}, meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return null
      this.terminologyAnalyzing = true
      try {
        const res = await analyzeMeetingTermsSync({
          meetingId: mid,
          domainHint: options.domainHint !== undefined ? options.domainHint : this.featureConfig.domainHint,
          targetLang: options.targetLang || this.featureConfig.preferredLang || 'zh'
        })
        if (res && Array.isArray(res.terms)) {
          this.handleRealtimeTermDetected(res.terms, { notify: false })
        }
        if (res) {
          if (Array.isArray(res.causalChains)) {
            this.meetingCausalChains = res.causalChains
          }
          if (res.summary) {
            this.meetingCausalSummary = res.summary
          }
          this.meetingCausalMeta = {
            status: res.status,
            traceId: res.traceId,
            modelName: res.modelName,
            modelVersion: res.modelVersion,
            adapterVersion: res.adapterVersion,
            costMs: res.costMs
          }
        }
        await Promise.allSettled([
          this.loadMeetingTerms(mid),
          this.loadMeetingCausalChains(mid),
          this.loadTermOccurrences(mid),
          this.loadTermTraces(mid)
        ])
        if (res?.status === 'DEGRADED') {
          message.warning(res.summary || '大模型暂不可用，已诚实返回降级参考结果')
        } else {
          message.success(res?.summary || '行业术语同步识别完成')
        }
        return res
      } catch (err) {
        message.error(err.message || '会议术语同步分析失败')
        throw err
      } finally {
        this.terminologyAnalyzing = false
      }
    },

    /**
     * 手动触发会议术语异步幂等分析并开启任务轮询
     */
    async triggerMeetingTermAnalysisAsync(options = {}, meetingId = this.currentMeetingId) {
      const mid = meetingId || this.currentMeetingId
      if (!mid) return null
      this.isAnalyzing = true
      try {
        const task = await analyzeMeetingTermsAsync({
          meetingId: mid,
          domainHint: options.domainHint !== undefined ? options.domainHint : this.featureConfig.domainHint,
          targetLang: options.targetLang || this.featureConfig.preferredLang || 'zh',
          forceReanalyze: Boolean(options.forceReanalyze)
        })
        this.currentTask = task
        message.success('已发起异步行业术语智能理解任务')
        if (task && task.taskId) {
          this.startTaskPolling(task.taskId, mid)
        }
        return task
      } catch (err) {
        message.error(err.message || '发起异步术语分析失败')
        this.isAnalyzing = false
        throw err
      }
    },

    /**
     * 提交人工审核与纠偏
     */
    async correctTermAction(payload) {
      try {
        const updated = await correctMeetingTerm(payload)
        if (updated) {
          const idx = this.meetingTerms.findIndex(
            (t) =>
              (payload.occurrenceId && t.occurrenceId === payload.occurrenceId) ||
              (payload.explanationId && t.explanationId === payload.explanationId)
          )
          if (idx !== -1) {
            this.meetingTerms[idx] = { ...this.meetingTerms[idx], ...updated }
          }
        }
        await Promise.allSettled([
          this.loadMeetingTerms(this.currentMeetingId),
          this.loadTermOccurrences(this.currentMeetingId)
        ])
        message.success('术语审核纠偏结论已保存')
        return updated
      } catch (err) {
        message.error(err.message || '提交术语纠偏失败')
        throw err
      }
    },

    /**
     * 处理 WebSocket (messageType=31) 或 SSE (TERM_DETECTED) 推送的实时术语
     */
    handleRealtimeTermDetected(rawPayload, { notify = true } = {}) {
      const items = Array.isArray(rawPayload)
        ? rawPayload
        : Array.isArray(rawPayload?.terms)
          ? rawPayload.terms
          : rawPayload
            ? [rawPayload]
            : []
      if (items.length === 0) return

      let newlyAdded = 0
      let hasConflict = false
      items.forEach((item) => {
        if (!item || (!item.surface && !item.canonicalName)) return
        if (item.ambiguityStatus === 'CONFLICT_DUAL') {
          hasConflict = true
        }
        const itemKey = item.occurrenceId
          ? `occ:${item.occurrenceId}`
          : `${(item.surface || '').toLowerCase()}|${(item.canonicalName || '').toLowerCase()}|${item.evidence?.[0]?.segmentId || ''}`
        const existIdx = this.meetingTerms.findIndex((existing) => {
          const existingKey = existing.occurrenceId
            ? `occ:${existing.occurrenceId}`
            : `${(existing.surface || '').toLowerCase()}|${(existing.canonicalName || '').toLowerCase()}|${existing.evidence?.[0]?.segmentId || ''}`
          return existingKey === itemKey
        })
        if (existIdx !== -1) {
          this.meetingTerms[existIdx] = { ...this.meetingTerms[existIdx], ...item }
        } else {
          this.meetingTerms.unshift(item)
          newlyAdded++
        }
      })

      if (notify && newlyAdded > 0) {
        const names = items
          .map((t) => t.surface || t.canonicalName)
          .filter(Boolean)
          .slice(0, 4)
          .join('、')
        notification.info({
          message: hasConflict ? '识别到行业术语（含企业口径冲突）' : '实时识别到行业专业术语',
          description: `${names}${hasConflict ? ' — 已并排展示通用行业含义与企业内部口径' : ''}`,
          duration: 3.5
        })
      }
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
                  this.loadActionItems(effectiveMeetingId),
                  this.loadMeetingTerms(effectiveMeetingId),
                  this.loadMeetingCausalChains(effectiveMeetingId),
                  this.loadTermOccurrences(effectiveMeetingId),
                  this.loadTermTraces(effectiveMeetingId)
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
        asrRunning: false,
        termIntelligenceEnabled: true,
        domainHint: '',
        preferredLang: 'zh'
      }
      this.featureLoading = false
      this.meetingTerms = []
      this.meetingTermsLoading = false
      this.meetingCausalChains = []
      this.meetingCausalSummary = ''
      this.meetingCausalMeta = null
      this.causalChainsLoading = false
      this.termOccurrences = []
      this.termOccurrencesLoading = false
      this.termTraces = []
      this.termTracesLoading = false
      this.terminologyAnalyzing = false
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

