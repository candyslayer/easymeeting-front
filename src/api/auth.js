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

