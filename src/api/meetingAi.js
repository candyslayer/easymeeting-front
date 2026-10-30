import http from './http'

/**
 * EasyMeeting Spring AI 多 Agent 智能会议 API 接口封装
 * 严格对齐后端 D:\java\project\easymeeting-java 源码与规范
 */

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
 * 更新决策状态 (CONFIRMED, PENDING, REJECTED)
 * @param {Object} params { decisionId, status }
 */
export function updateDecision(params) {
  return http.post('/meetingAi/decision/update', {
    decisionId: params.decisionId,
    status: params.status
  })
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

