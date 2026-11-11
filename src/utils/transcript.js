const SPEAKER_PALETTE = [
  {
    color: '#1677ff',
    gradient: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
    tintBg: '#f0f7ff',
    tintBorder: '#91caff',
    glow: 'rgba(22, 119, 255, 0.22)'
  },
  {
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    tintBg: '#f0f9ff',
    tintBorder: '#7dd3fc',
    glow: 'rgba(14, 165, 233, 0.22)'
  },
  {
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    tintBg: '#ecfdf5',
    tintBorder: '#6ee7b7',
    glow: 'rgba(16, 185, 129, 0.22)'
  },
  {
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    tintBg: '#fffbeb',
    tintBorder: '#fcd34d',
    glow: 'rgba(245, 158, 11, 0.22)'
  },
  {
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    tintBg: '#f5f3ff',
    tintBorder: '#c4b5fd',
    glow: 'rgba(139, 92, 246, 0.22)'
  },
  {
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #db2777 0%, #f472b6 100%)',
    tintBg: '#fdf2f8',
    tintBorder: '#f9a8d4',
    glow: 'rgba(236, 72, 153, 0.22)'
  }
]

/**
 * 根据说话人名称生成稳定一致的主题配色
 * @param {string} name
 */
export function getSpeakerTheme(name) {
  const safeName = String(name || '参会者').trim() || '参会者'
  let hash = 0
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SPEAKER_PALETTE[Math.abs(hash) % SPEAKER_PALETTE.length]
}

/**
 * 提取说话人首字符作为默认头像占位
 * @param {string} name
 */
export function getSpeakerInitial(name) {
  const safeName = String(name || '').trim()
  return safeName ? safeName.slice(0, 1).toUpperCase() : '参'
}

/**
 * 毫秒格式化为 mm:ss 或 hh:mm:ss
 * @param {number} ms
 */
export function formatTranscriptMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms)) || Number(ms) < 0) {
    return '00:00'
  }
  const totalSeconds = Math.floor(Number(ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

/**
 * 计算片段持续时长标签
 * @param {number} startMs
 * @param {number} endMs
 */
export function formatSegmentDuration(startMs, endMs) {
  if (
    startMs === null ||
    startMs === undefined ||
    endMs === null ||
    endMs === undefined ||
    Number.isNaN(Number(startMs)) ||
    Number.isNaN(Number(endMs))
  ) {
    return ''
  }
  const diff = Number(endMs) - Number(startMs)
  if (diff <= 0) return ''
  const sec = Math.max(1, Math.round(diff / 1000))
  if (sec >= 60) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${m}m${s}s` : `${m}m`
  }
  return `${sec}s`
}

/**
 * 解析说话人头像 URL（优先使用片段自带头像，其次尝试匹配参会人 userId）
 * @param {Object} segment
 * @param {Array} memberList
 * @param {string|number} versionTs
 */
export function resolveSpeakerAvatarUrl(segment, memberList = [], versionTs = '') {
  if (!segment) return ''
  if (segment.speakerAvatar || segment.avatar) {
    return segment.speakerAvatar || segment.avatar
  }
  const members = Array.isArray(memberList) ? memberList : []
  const matchedMember = members.find(
    (m) =>
      (segment.speakerId && m.userId === segment.speakerId) ||
      (segment.speakerName && m.nickName === segment.speakerName)
  )
  const userId = segment.speakerUserId || segment.userId || matchedMember?.userId
  if (!userId) return ''
  const base = import.meta.env?.VITE_API_BASE_URL || '/api'
  const query = versionTs ? `?t=${versionTs}` : ''
  return `${base}/account/getAvatar/${encodeURIComponent(userId)}${query}`
}

/**
 * 拆分高亮关键词文本片段（避免使用 v-html）
 * @param {string} text
 * @param {string} keyword
 */
export function splitHighlightParts(text, keyword) {
  const source = String(text || '')
  const kw = String(keyword || '').trim()
  if (!kw || !source) {
    return [{ text: source, match: false }]
  }
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return source
    .split(regex)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: part.toLowerCase() === kw.toLowerCase()
    }))
}
