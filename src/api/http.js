import axios from 'axios'
import { message } from 'ant-design-vue'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  withCredentials: true // 跨域携带 Cookie
})

// 请求拦截器
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      // 后端 AbaseController.GetTokenUserInfo 优先读取 header 中的 'token'
      config.headers['token'] = token
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    // 处理文件下载二进制流
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
      return response.data
    }

    const res = response.data

    // 兼容后端标准结构 { status: 'success'|'error', code: 200, info: '...', data: ... }
    if (res && typeof res === 'object' && ('code' in res || 'status' in res)) {
      if (res.code === 200 || res.status === 'success') {
        return res.data
      }

      // 901: 登录已过期或未登录
      if (res.code === 901) {
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        message.warning(res.info || '登录凭据已过期，请重新登录')
        if (window.location.pathname !== '/login') {
          setTimeout(() => {
            window.location.href = '/login'
          }, 800)
        }
        return Promise.reject(new Error(res.info || '登录已过期'))
      }

      // 其他业务错误
      const errorMsg = res.info || '系统繁忙，请稍后重试'
      return Promise.reject(new Error(errorMsg))
    }

    return res
  },
  (error) => {
    let msg = '网络连接异常，请检查网络设置'
    if (error.response) {
      const { status } = error.response
      switch (status) {
        case 401:
          msg = '未授权或登录已过期'
          localStorage.removeItem('token')
          localStorage.removeItem('userInfo')
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
          break
        case 404:
          msg = '请求的接口资源不存在'
          break
        case 500:
          msg = '服务器内部发生错误'
          break
        case 504:
          msg = '网关超时，未能连接到后端服务'
          break
        default:
          msg = error.response.data?.info || `请求失败 (${status})`
      }
    } else if (error.message && error.message.includes('timeout')) {
      msg = '网络请求超时，请检查后端服务响应'
    }

    message.error(msg)
    return Promise.reject(error)
  }
)

export default http

