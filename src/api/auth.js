import http from './http'

/**
 * 获取图形算术验证码
 * @param {number} type 0: 登录/注册验证码; 1: 发送邮箱验证码的图形码
 */
export function getCheckCode(type = 0) {
  return http.get('/account/checkCode', {
    params: { type }
  })
}

/**
 * 发送邮箱验证码
 * @param {Object} data { email, checkCodeKey, checkCode, type }
 */
export function sendEmailCode(data) {
  return http.post('/account/sendEmailCode', null, {
    params: {
      email: data.email,
      checkCodeKey: data.checkCodeKey,
      checkCode: data.checkCode,
      type: data.type || 0
    }
  })
}

/**
 * 用户注册
 * @param {Object} data { email, nickName, password, emailCode, checkCodeKey, checkCode }
 */
export function register(data) {
  return http.post('/account/register', null, {
    params: {
      email: data.email,
      nickName: data.nickName,
      password: data.password,
      emailCode: data.emailCode,
      checkCodeKey: data.checkCodeKey,
      checkCode: data.checkCode
    }
  })
}

/**
 * 用户登录
 * @param {Object} data { email, password, checkCodeKey, checkCode }
 * @returns {Promise<import('@/stores/auth').UserInfo>}
 */
export function login(data) {
  return http.post('/account/login', null, {
    params: {
      email: data.email,
      password: data.password,
      checkCodeKey: data.checkCodeKey,
      checkCode: data.checkCode
    }
  })
}

/**
 * 获取当前登录用户个人资料
 */
export function getUserInfo() {
  return http.get('/account/getUserInfo')
}

/**
 * 修改当前登录用户资料（昵称、性别，并支持可选头像文件）
 * @param {Object} data { nickName, sex, avatar }
 */
export function updateUserInfo(data) {
  const formData = new FormData()
  if (data.nickName !== undefined && data.nickName !== null) {
    formData.append('nickName', data.nickName)
  }
  if (data.sex !== undefined && data.sex !== null) {
    formData.append('sex', data.sex)
  }
  if (data.avatar) {
    formData.append('avatar', data.avatar)
  }
  return http.post('/account/updateUserInfo', formData)
}

/**
 * 单独上传用户头像
 * @param {File|Blob} file 
 */
export function uploadAvatar(file) {
  const formData = new FormData()
  formData.append('avatar', file)
  return http.post('/account/uploadAvatar', formData)
}

/**
 * 获取用户头像图片完整 URL
 * @param {string} userId 
 */
export function getAvatarUrl(userId) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const timestamp = Date.now()
  return userId
    ? `${base}/account/getAvatar/${userId}?t=${timestamp}`
    : `${base}/account/getAvatar?t=${timestamp}`
}

/**
 * 修改登录密码
 * @param {Object} data { oldPassword, newPassword }
 */
export function updatePassword(data) {
  return http.post('/account/updatePassword', null, {
    params: {
      oldPassword: data.oldPassword,
      newPassword: data.newPassword
    }
  })
}

/**
 * 退出登录接口
 */
export function logoutApi() {
  return http.post('/account/logout')
}

