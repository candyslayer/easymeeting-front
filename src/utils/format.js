import dayjs from 'dayjs'

/**
 * 格式化会议号为友好的三段式或四段式显示（例如：123 456 7890）
 * @param {string|number} meetingNo 
 * @returns {string}
 */
export function formatMeetingNo(meetingNo) {
  if (!meetingNo) return ''
  const str = String(meetingNo).trim().replace(/\s+/g, '')
  if (str.length === 10) {
    return `${str.slice(0, 3)} ${str.slice(3, 6)} ${str.slice(6)}`
  }
  if (str.length === 9) {
    return `${str.slice(0, 3)} ${str.slice(3, 6)} ${str.slice(6)}`
  }
  return str
}

/**
 * 格式化日期时间
 * @param {string|number|Date} date 
 * @param {string} formatStr 
 * @returns {string}
 */
export function formatDateTime(date, formatStr = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '-'
  return dayjs(date).format(formatStr)
}

/**
 * 格式化会议时长（秒数转 00:00:00）
 * @param {number} totalSeconds 
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) totalSeconds = 0
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

/**
 * 格式化文件尺寸大小
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 复制文本至剪贴板
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  if (!text) return false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-999999px'
      textarea.style.top = '-999999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const successful = document.execCommand('copy')
      textarea.remove()
      return successful
    }
  } catch (err) {
    console.error('复制失败:', err)
    return false
  }
}

