import http from './http'

/**
 * 上传会议共享文件或普通文件
 * @param {File} file 
 * @param {string} meetingId 
 * @param {string} receiveUserId 
 * @param {Function} onProgress 
 */
export function uploadFile(file, meetingId = '', receiveUserId = '', onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  if (meetingId) {
    formData.append('meetingId', meetingId)
  }
  if (receiveUserId) {
    formData.append('receiveUserId', receiveUserId)
  }

  return http.post('/file/uploadFile', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(percent)
      }
    }
  })
}

/**
 * 获取文件下载地址
 * @param {string} fileId 
 * @returns {string}
 */
export function getDownloadUrl(fileId) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  return `${baseUrl}/file/download/${fileId}`
}

/**
 * 获取资源内嵌预览地址
 * @param {string} fileId 
 * @returns {string}
 */
export function getResourceUrl(fileId) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  return `${baseUrl}/file/getResource/${fileId}`
}

