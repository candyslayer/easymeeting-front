import http from './http'

/**
 * AI Meeting Replay (智能回放与议题时间轴) API 接口
 * 严格对齐后端 MeetingReplayController 规范
 */

/**
 * 上传会议录像视频文件 (支持 .mp4, .mkv, .mov 等)
 * @param {string} meetingId 会议ID
 * @param {File} file 录像文件
 * @param {number} timeOffsetMs 音频与录像基准时间偏移 (毫秒)
 * @param {Function} onProgress 上传进度回调 (0-100)
 */
export function uploadVideoRecording(meetingId, file, timeOffsetMs = 0, onProgress = null) {
  const formData = new FormData()
  formData.append('file', file)
  if (timeOffsetMs) {
    formData.append('timeOffsetMs', timeOffsetMs)
  }

  return http.post(`/meetings/${encodeURIComponent(meetingId)}/recordings`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 300000, // 大文件上传超时时间 5 分钟
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(percent)
      }
    }
  })
}

/**
 * 查询指定会议的全部录像/录音记录
 * @param {string} meetingId 会议ID
 */
export function listMeetingRecordings(meetingId) {
  return http.get(`/meetings/${encodeURIComponent(meetingId)}/recordings`)
}

/**
 * 查询录像基础信息
 * @param {string} recordingId 录像ID
 */
export function getRecording(recordingId) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}`)
}

/**
 * 获取录像播放地址与转码处理状态
 * @param {string} recordingId 录像ID
 */
export function getPlaybackInfo(recordingId) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}/playback`)
}

/**
 * 删除录像物理文件（保留已分析出的议题、纪要和决策结构化数据）
 * @param {string} recordingId 录像ID
 */
export function deleteRecording(recordingId) {
  return http.delete(`/recordings/${encodeURIComponent(recordingId)}`)
}

/**
 * 启动或重新启动 AI 议题切分与事件提炼分析
 * @param {string} recordingId 录像ID
 * @param {boolean} forceReanalyze 是否强制重新分析 (覆盖现有结果)
 */
export function startReplayAnalysis(recordingId, forceReanalyze = false) {
  return http.post(`/recordings/${encodeURIComponent(recordingId)}/analysis`, {
    forceReanalyze: Boolean(forceReanalyze)
  })
}

/**
 * 查询录像 AI 分析任务状态
 * @param {string} recordingId 录像ID
 */
export function getReplayAnalysisStatus(recordingId) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}/analysis`)
}

/**
 * 失败重试 AI 回放分析
 * @param {string} recordingId 录像ID
 */
export function retryReplayAnalysis(recordingId) {
  return http.post(`/recordings/${encodeURIComponent(recordingId)}/analysis/retry`)
}

/**
 * 查询录像关联的所有议题列表（按起止时间与序号排序）
 * @param {string} recordingId 录像ID
 */
export function listTopics(recordingId) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}/topics`)
}

/**
 * 查询单个议题详情及其内部事件
 * @param {string} topicId 议题ID
 */
export function getTopicDetail(topicId) {
  return http.get(`/topics/${encodeURIComponent(topicId)}`)
}

/**
 * 修改议题元信息 (标题、摘要、排序)
 * @param {string} topicId 议题ID
 * @param {Object} data { title, summary, sortOrder }
 */
export function updateTopic(topicId, data) {
  return http.put(`/topics/${encodeURIComponent(topicId)}`, {
    title: data.title,
    summary: data.summary,
    sortOrder: data.sortOrder
  })
}

/**
 * 人工微调议题起止时间轴
 * @param {string} topicId 议题ID
 * @param {number} startTimeMs 起始时间(毫秒)
 * @param {number} endTimeMs 结束时间(毫秒)
 */
export function adjustTopicTimeline(topicId, startTimeMs, endTimeMs) {
  return http.put(`/topics/${encodeURIComponent(topicId)}/timeline`, {
    startTimeMs,
    endTimeMs
  })
}

/**
 * 查询指定议题内部的所有事件（决策、风险、待办、观点、待解决问题）
 * @param {string} topicId 议题ID
 */
export function listTopicEvents(topicId) {
  return http.get(`/topics/${encodeURIComponent(topicId)}/events`)
}

/**
 * 获取录像完整时间轴聚合数据 (包含录像元信息、总时长、全部议题及其内部事件)
 * @param {string} recordingId 录像ID
 */
export function getMeetingTimeline(recordingId) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}/timeline`)
}

/**
 * 分页查询录像关联的逐字转写记录
 * @param {string} recordingId 录像ID
 * @param {number} pageNo 页码
 * @param {number} pageSize 每页条数
 */
export function getReplayTranscripts(recordingId, pageNo = 1, pageSize = 50) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}/transcripts`, {
    params: {
      pageNo,
      pageSize
    }
  })
}

/**
 * 检索录像逐字稿（用于时间轴搜索与快速跳转）
 * @param {string} recordingId 录像ID
 * @param {string} keyword 关键词
 * @param {number} pageNo 页码
 * @param {number} pageSize 每页条数
 */
export function searchReplayTranscripts(recordingId, keyword, pageNo = 1, pageSize = 20) {
  return http.get(`/recordings/${encodeURIComponent(recordingId)}/transcripts/search`, {
    params: {
      keyword,
      pageNo,
      pageSize
    }
  })
}

/**
 * 解析播放器可用媒体 URL
 * 后端返回 /file/replay/... 时，自动补齐 /api 或 baseUrl 前缀
 * @param {string} url 原始相对或绝对路径
 * @returns {string} 完整的媒体播放地址
 */
export function resolvePlaybackUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  if (url.startsWith('/api/')) {
    return url
  }
  if (url.startsWith('api/')) {
    return `/${url}`
  }
  if (url.startsWith('/file/')) {
    return `${base}${url}`
  }
  if (url.startsWith('file/')) {
    return `${base}/${url}`
  }
  if (url.startsWith('replay/')) {
    return `${base}/file/${url}`
  }
  if (url.startsWith('/replay/')) {
    return `${base}/file${url}`
  }
  if (url.startsWith('recording/')) {
    return `${base}/file/${url}`
  }
  if (url.startsWith('/recording/')) {
    return `${base}/file${url}`
  }
  if (!url.startsWith('/')) {
    return `${base}/${url}`
  }
  return `${base}${url}`
}
