import http from './http'

/**
 * EasyMeeting Spring AI 多 Agent 智能会议 API 接口封装
 * 严格对齐后端 D:\java\project\easymeeting-java 源码与规范
 */

// ==========================================
// 0. 会议级功能开关与 ASR 状态控制 (/feature)
// ==========================================

/**
 * 动态开关会议功能 (实时转写 / 会中决策)
 * @param {Object} params { meetingId, feature: 'transcription'|'live_decision', enabled: boolean }
 */
export function toggleMeetingFeature(params) {
  return http.post('/meetingAi/feature/toggle', {
    meetingId: params.meetingId,
    feature: params.feature,
    enabled: Boolean(params.enabled)
  })
}

/**
 * 获取当前会议功能开启配置及 ASR 运行状态
 * @param {string} meetingId 会议ID
 */
export function getMeetingFeatureStatus(meetingId) {
  return http.get('/meetingAi/feature/status', {
    params: { meetingId }
  })
}

// ==========================================
// 1. 录音与文件管理接口 (/recording)
// ==========================================

/**
 * 上传会议录音文件
 * @param {FormData} formData 包含 file, meetingId, durationSeconds (可选)
 */
export function uploadRecording(formData) {
  return http.post('/meetingAi/recording/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 查询指定会议的录音文件列表
 * @param {string} meetingId 会议ID
 */
export function getRecordingList(meetingId) {
  return http.get('/meetingAi/recording/list', {
    params: { meetingId }
  })
}

/**
 * 获取录音文件下载/播放二进制流 (如需鉴权下载)
 * @param {string} recordingId 录音ID
 */
export function getRecordingAudioBlob(recordingId) {
  return http.get(`/meetingAi/recording/download/${recordingId}`, {
    responseType: 'blob'
  })
}

/**
 * 获取直接播放 URL
 * @param {string} recordingId 录音ID
 */
export function getRecordingPlayUrl(recordingId) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  return `${base}/meetingAi/recording/download/${recordingId}`
}

// ==========================================
// 2. ASR 语音转写接口 (/transcript)
// ==========================================

/**
 * 触发离线录音 ASR 转写任务
 * @param {Object} params { meetingId, recordingId, language }
 */
export function startTranscription(params) {
  return http.post('/meetingAi/transcript/start', {
    meetingId: params.meetingId,
    recordingId: params.recordingId,
    language: params.language || 'zh'
  })
}

/**
 * 分页查询会议转写片段
 * @param {Object} params { meetingId, recordingId, pageNo, pageSize }
 */
export function getTranscriptSegments(params) {
  return http.get('/meetingAi/transcript/segments', {
    params: {
      meetingId: params.meetingId,
      recordingId: params.recordingId || undefined,
      pageNo: params.pageNo || 1,
      pageSize: params.pageSize || 50
    }
  })
}

/**
 * 人工修正转写片段
 * @param {Object} params { segmentId, meetingId, revisedText, revisionReason }
 */
export function reviseTranscriptSegment(params) {
  return http.post('/meetingAi/transcript/revise', {
    segmentId: params.segmentId,
    meetingId: params.meetingId,
    revisedText: params.revisedText,
    revisionReason: params.revisionReason || ''
  })
}

/**
 * 查询片段修正历史记录
 * @param {string} segmentId 片段ID
 */
export function getRevisionHistory(segmentId) {
  return http.get('/meetingAi/transcript/revision-history', {
    params: { segmentId }
  })
}

// ==========================================
// 3. 多 Agent 会议分析与任务接口 (/analysis & /task)
// ==========================================

/**
 * 发起会议全量多 Agent 分析流水线
 * @param {Object} params { meetingId, targetLanguage, forceReanalyze }
 */
export function startAnalysis(params) {
  return http.post('/meetingAi/analysis/start', {
    meetingId: params.meetingId,
    targetLanguage: params.targetLanguage || 'zh',
    forceReanalyze: Boolean(params.forceReanalyze)
  })
}

/**
 * 查询异步分析或转写任务状态
 * @param {string} taskId 任务ID
 */
export function getTaskStatus(taskId) {
  return http.get('/meetingAi/task/status', {
    params: { taskId }
  })
}

/**
 * 查询 Agent 执行审计日志与质量评分
 * @param {string} taskId 任务ID
 */
export function getAgentLogs(taskId) {
  return http.get('/meetingAi/task/agent-logs', {
    params: { taskId }
  })
}

// ==========================================
// 4. 会议纪要生命周期管理 (/minutes)
// ==========================================

/**
 * 查询会议当前最新生效纪要
 * @param {string} meetingId 会议ID
 */
export function getMeetingMinutes(meetingId) {
  return http.get('/meetingAi/minutes/get', {
    params: { meetingId }
  })
}

/**
 * 编辑会议纪要草稿
 * @param {Object} params { minutesId, meetingId, title, summary, agendaTopicsJson, keyDiscussions, conclusions }
 */
export function editMinutesDraft(params) {
  return http.post('/meetingAi/minutes/edit-draft', {
    minutesId: params.minutesId,
    meetingId: params.meetingId,
    title: params.title,
    summary: params.summary,
    agendaTopicsJson: params.agendaTopicsJson,
    keyDiscussions: params.keyDiscussions,
    conclusions: params.conclusions
  })
}

/**
 * 提交审核 / 审核纪要 (主持人/审核人)
 * @param {Object} params { minutesId, meetingId, approved, auditRemark }
 */
export function auditMinutes(params) {
  return http.post('/meetingAi/minutes/audit', {
    minutesId: params.minutesId,
    meetingId: params.meetingId,
    approved: Boolean(params.approved),
    auditRemark: params.auditRemark || ''
  })
}

/**
 * 正式发布纪要并归档版本快照 (仅主持人/创建者)
 * @param {Object} params { minutesId, meetingId, changeLog }
 */
export function publishMinutes(params) {
  return http.post('/meetingAi/minutes/publish', {
    minutesId: params.minutesId,
    meetingId: params.meetingId,
    changeLog: params.changeLog || '正式发布'
  })
}

/**
 * 查询纪要历史版本快照列表
 * @param {string} meetingId 会议ID
 */
export function getMinutesVersions(meetingId) {
  return http.get('/meetingAi/minutes/versions', {
    params: { meetingId }
  })
}

/**
 * 查询特定版本快照详情
 * @param {string} versionId 版本ID
 */
export function getMinutesVersionDetail(versionId) {
  return http.get('/meetingAi/minutes/version-detail', {
    params: { versionId }
  })
}

// ==========================================
// 5. 决策与待办管理 (/decision & /action-item)
// ==========================================

/**
 * 查询会议决策列表
 * @param {string} meetingId 会议ID
 */
export function getDecisionList(meetingId) {
  return http.get('/meetingAi/decision/list', {
    params: { meetingId }
  })
}

/**
 * 查询单个决策详情
 * @param {string} decisionId 决策ID
 */
export function getDecisionDetail(decisionId) {
  return http.get('/meetingAi/decision/detail', {
    params: { decisionId }
  })
}

/**
 * 更新决策状态 (CONFIRMED, DISCUSSING, PROPOSED, DEFERRED, REJECTED)
 * @param {Object} params { decisionId, status }
 */
export function updateDecision(params) {
  return http.post('/meetingAi/decision/update', {
    decisionId: params.decisionId,
    status: params.status
  })
}

/**
 * 人工确认决策生效
 * @param {Object} params { decisionId, remark }
 */
export function confirmDecision(params) {
  return http.post('/meetingAi/decision/confirm', {
    decisionId: params.decisionId,
    remark: params.remark || ''
  })
}

/**
 * 人工否决决策
 * @param {Object} params { decisionId, remark }
 */
export function rejectDecision(params) {
  return http.post('/meetingAi/decision/reject', {
    decisionId: params.decisionId,
    remark: params.remark || ''
  })
}

/**
 * 人工暂缓决定
 * @param {Object} params { decisionId, remark }
 */
export function deferDecision(params) {
  return http.post('/meetingAi/decision/defer', {
    decisionId: params.decisionId,
    remark: params.remark || ''
  })
}

/**
 * 查询决策演进事件历史
 * @param {Object} params { meetingId, decisionId }
 */
export function getDecisionEvents(params) {
  return http.get('/meetingAi/decision/events', {
    params: {
      meetingId: params.meetingId,
      decisionId: params.decisionId || undefined
    }
  })
}

/**
 * 获取决策事件 SSE 流连接 URL
 * @param {string} meetingId 会议ID
 */
export function getDecisionEventsSseUrl(meetingId) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const token = localStorage.getItem('token') || ''
  return `${base}/meetingAi/decision/events/sse?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}`
}

/**
 * 查询会议待办任务列表
 * @param {Object} params { meetingId, assigneeUserId, status }
 */
export function getActionItemList(params) {
  return http.get('/meetingAi/action-item/list', {
    params: {
      meetingId: params.meetingId,
      assigneeUserId: params.assigneeUserId || undefined,
      status: params.status || undefined
    }
  })
}

/**
 * 更新待办状态、负责人或截止时间
 * @param {Object} params { actionId, status, assigneeUserId, dueTime }
 */
export function updateActionItem(params) {
  return http.post('/meetingAi/action-item/update', {
    actionId: params.actionId,
    status: params.status,
    assigneeUserId: params.assigneeUserId,
    dueTime: params.dueTime
  })
}

// ==========================================
// 6. 证据溯源接口 (/evidence)
// ==========================================

/**
 * 查询实体证据链溯源信息
 * @param {Object} params { targetType, targetId } targetType: DECISION, ACTION_ITEM, MINUTES_TOPIC, QA_ANSWER
 */
export function queryEvidence(params) {
  return http.get('/meetingAi/evidence/query', {
    params: {
      targetType: params.targetType,
      targetId: params.targetId
    }
  })
}

// ==========================================
// 7. 实时音频接入与增量转写 (/realtime)
// ==========================================

/**
 * 创建或获取实时音频会话
 * @param {Object} params { meetingId, sampleRate, audioFormat, deviceInfo }
 */
export function createRealtimeSession(params) {
  return http.post('/meetingAi/realtime/create-session', {
    meetingId: params.meetingId,
    sampleRate: params.sampleRate || 16000,
    audioFormat: params.audioFormat || 'pcm',
    deviceInfo: params.deviceInfo || navigator.userAgent
  })
}

/**
 * HTTP 音频分片推送
 * @param {FormData} formData { sessionId, chunkIndex, audioData, isLastChunk }
 */
export function streamAudioChunk(formData) {
  return http.post('/meetingAi/realtime/stream-chunk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 关闭实时音频会话
 * @param {Object} params { sessionId }
 */
export function closeRealtimeSession(params) {
  return http.post('/meetingAi/realtime/close-session', {
    sessionId: params.sessionId
  })
}

// ==========================================
// 8. 会议知识问答 (/qa)
// ==========================================

/**
 * 权限隔离的会议智能问答
 * @param {Object} params { meetingId, question }
 */
export function askMeetingQa(params) {
  return http.post('/meetingAi/qa/ask', {
    meetingId: params.meetingId || undefined,
    question: params.question
  })
}

/**
 * 查询会议问答历史
 * @param {Object} params { meetingId, pageNo, pageSize }
 */
export function getQaHistory(params) {
  return http.get('/meetingAi/qa/history', {
    params: {
      meetingId: params.meetingId || undefined,
      pageNo: params.pageNo || 1,
      pageSize: params.pageSize || 15
    }
  })
}

// ==========================================
// 9. 行业术语智能理解、LoRA 对比评测与企业术语库 (/term)
// ==========================================

/**
 * 直接向微调大模型提问行业术语、公式与上下文含义（模型优先，不依赖预置词典）
 * @param {Object} params { query, context, domainHint, targetLang, meetingId, modelOverride, adapterVersionOverride }
 */
export function askTermKnowledge(params) {
  return http.post('/meetingAi/term/ask', {
    query: params.query,
    context: params.context || undefined,
    domainHint: params.domainHint || undefined,
    targetLang: params.targetLang || 'zh',
    meetingId: params.meetingId || undefined,
    modelOverride: params.modelOverride || undefined,
    adapterVersionOverride: params.adapterVersionOverride || undefined
  }, {
    timeout: 120000
  })
}

/**
 * 基座模型与微调 LoRA 模型同场景对比评测
 * @param {Object} params { query, context, domainHint, targetLang, baseModelName, baseAdapterVersion, tunedModelName, tunedAdapterVersion }
 */
export function compareTermModels(params) {
  return http.post('/meetingAi/term/compare', {
    query: params.query,
    context: params.context || undefined,
    domainHint: params.domainHint || undefined,
    targetLang: params.targetLang || 'zh',
    baseModelName: params.baseModelName || undefined,
    baseAdapterVersion: params.baseAdapterVersion || 'base',
    tunedModelName: params.tunedModelName || undefined,
    tunedAdapterVersion: params.tunedAdapterVersion || undefined
  }, {
    timeout: 240000
  })
}

/**
 * 按对比组 ID 查询模型对比 Trace 审计详情
 * @param {string} compareGroupId 对比组 ID
 */
export function getCompareTermTraces(compareGroupId) {
  return http.get('/meetingAi/term/compare/traces', {
    params: { compareGroupId }
  })
}

/**
 * 查询支持的可配置领域清单及模型/适配器元信息
 */
export function getTermDomainsMeta() {
  return http.get('/meetingAi/term/domains')
}

/**
 * 手动触发会议术语同步识别与三层解释
 * @param {Object} params { meetingId, domainHint, targetLang }
 */
export function analyzeMeetingTermsSync(params) {
  return http.post('/meetingAi/term/meeting/analyze', {
    meetingId: params.meetingId,
    domainHint: params.domainHint || undefined,
    targetLang: params.targetLang || 'zh'
  }, {
    timeout: 180000
  })
}

/**
 * 触发整场会议的异步幂等术语识别与三层解释任务
 * @param {Object} params { meetingId, domainHint, targetLang, forceReanalyze }
 */
export function analyzeMeetingTermsAsync(params) {
  return http.post('/meetingAi/term/meeting/analyzeAsync', {
    meetingId: params.meetingId,
    domainHint: params.domainHint || undefined,
    targetLang: params.targetLang || 'zh',
    forceReanalyze: Boolean(params.forceReanalyze)
  })
}

/**
 * 查询指定会议已识别的行业术语三层解释清单
 * @param {string} meetingId 会议ID
 */
export function getMeetingTermsList(meetingId) {
  return http.get('/meetingAi/term/meeting/list', {
    params: { meetingId }
  })
}

/**
 * 查询指定会议持久化保存的总结概览与跨领域因果传导链
 * @param {string} meetingId 会议ID
 */
export function getMeetingCausalChains(meetingId) {
  return http.get('/meetingAi/term/meeting/causal-chains', {
    params: { meetingId }
  })
}

/**
 * 查询会议术语原文出现定位明细
 * @param {string} meetingId 会议ID
 */
export function getMeetingTermOccurrences(meetingId) {
  return http.get('/meetingAi/term/meeting/occurrences', {
    params: { meetingId }
  })
}

/**
 * 查询会议术语 AI 分析全链路审计日志 (Trace)
 * @param {string} meetingId 会议ID
 */
export function getMeetingTermTraces(meetingId) {
  return http.get('/meetingAi/term/meeting/traces', {
    params: { meetingId }
  })
}

/**
 * 人工审核与纠偏会议术语（管理员可选沉淀到 term_verified_cache）
 * @param {Object} params { occurrenceId, explanationId, reviewStatus, correctedStandardName, correctedDomain, correctedDefinition, correctedContextMeaning, userCorrection, promoteToVerifiedCache }
 */
export function correctMeetingTerm(params) {
  return http.post('/meetingAi/term/meeting/correct', {
    occurrenceId: params.occurrenceId || undefined,
    explanationId: params.explanationId || undefined,
    reviewStatus: params.reviewStatus,
    correctedStandardName: params.correctedStandardName || undefined,
    correctedDomain: params.correctedDomain || undefined,
    correctedDefinition: params.correctedDefinition || undefined,
    correctedContextMeaning: params.correctedContextMeaning || undefined,
    userCorrection: params.userCorrection || undefined,
    promoteToVerifiedCache: Boolean(params.promoteToVerifiedCache)
  })
}

/**
 * 更新会中实时术语识别开关、领域提示与输出语言偏好
 * @param {Object} params { meetingId, termIntelligenceEnabled, domainHint, preferredLang }
 */
export function updateMeetingTermConfig(params) {
  return http.post('/meetingAi/term/meeting/config', {
    meetingId: params.meetingId,
    termIntelligenceEnabled: params.termIntelligenceEnabled,
    domainHint: params.domainHint ?? '',
    preferredLang: params.preferredLang || 'zh'
  })
}

/**
 * 获取会中实时术语识别 SSE 事件流 URL（事件名 TERM_DETECTED）
 * @param {string} meetingId 会议ID
 */
export function getTermEventsSseUrl(meetingId) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const token = localStorage.getItem('token') || ''
  return `${base}/meetingAi/term/meeting/events/sse?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}`
}

/**
 * 新增或更新企业内部术语（团队共享知识库，传 enterpriseTermId 为更新）
 */
export function saveEnterpriseTerm(params) {
  return http.post('/meetingAi/term/enterprise/save', params)
}

/**
 * 查询企业内部术语详情
 * @param {string} enterpriseTermId 企业术语ID
 */
export function getEnterpriseTermDetail(enterpriseTermId) {
  return http.get('/meetingAi/term/enterprise/detail', {
    params: { enterpriseTermId }
  })
}

/**
 * 分页查询企业内部术语知识库
 * @param {Object} params { termCode, abbreviation, domain, subDomain, status, keywordFuzzy, pageNo, pageSize }
 */
export function pageEnterpriseTerms(params = {}) {
  return http.get('/meetingAi/term/enterprise/page', {
    params: {
      termCode: params.termCode || undefined,
      abbreviation: params.abbreviation || undefined,
      domain: params.domain || undefined,
      subDomain: params.subDomain || undefined,
      status: params.status || undefined,
      keywordFuzzy: params.keywordFuzzy || undefined,
      pageNo: params.pageNo || 1,
      pageSize: params.pageSize || 15
    }
  })
}

/**
 * 切换企业内部术语状态 (ACTIVE / DISABLED / ARCHIVED)
 * @param {Object} params { enterpriseTermId, status }
 */
export function updateEnterpriseTermStatus(params) {
  return http.post('/meetingAi/term/enterprise/status', {
    enterpriseTermId: params.enterpriseTermId,
    status: params.status
  })
}

/**
 * 归档或物理删除企业内部术语
 * @param {Object} params { enterpriseTermId, physicalDelete }
 */
export function deleteEnterpriseTerm(params) {
  return http.post('/meetingAi/term/enterprise/delete', {
    enterpriseTermId: params.enterpriseTermId,
    physicalDelete: Boolean(params.physicalDelete)
  })
}

/**
 * 批量导入企业内部术语
 * @param {Array} items EnterpriseTermSaveRequest 数组
 */
export function batchImportEnterpriseTerms(items) {
  return http.post('/meetingAi/term/enterprise/batchImport', items)
}

/**
 * 按筛选条件导出企业内部术语 JSON 列表
 * @param {Object} params { domain, status, keywordFuzzy }
 */
export function exportEnterpriseTerms(params = {}) {
  return http.get('/meetingAi/term/enterprise/export', {
    params: {
      domain: params.domain || undefined,
      status: params.status || undefined,
      keywordFuzzy: params.keywordFuzzy || undefined
    }
  })
}

/**
 * 管理员：保存或更新可选标准术语审核缓存
 */
export function saveVerifiedTermCache(params) {
  return http.post('/meetingAi/term/cache/save', params)
}

/**
 * 管理员：分页查询可选标准术语审核缓存
 */
export function pageVerifiedTermCache(params = {}) {
  return http.get('/meetingAi/term/cache/page', {
    params: {
      termKey: params.termKey || undefined,
      domain: params.domain || undefined,
      subDomain: params.subDomain || undefined,
      sourceType: params.sourceType || undefined,
      reviewStatus: params.reviewStatus || undefined,
      enabled: params.enabled !== undefined && params.enabled !== '' ? params.enabled : undefined,
      keywordFuzzy: params.keywordFuzzy || undefined,
      pageNo: params.pageNo || 1,
      pageSize: params.pageSize || 15
    }
  })
}

/**
 * 管理员：启用或停用标准术语缓存条目
 * @param {Object} params { cacheId, enabled }
 */
export function toggleVerifiedTermCache(params) {
  return http.post('/meetingAi/term/cache/toggle', {
    cacheId: params.cacheId,
    enabled: Boolean(params.enabled)
  })
}

/**
 * 管理员：删除标准术语缓存条目
 * @param {Object} params { cacheId }
 */
export function deleteVerifiedTermCache(params) {
  return http.post('/meetingAi/term/cache/delete', {
    cacheId: params.cacheId
  })
}

