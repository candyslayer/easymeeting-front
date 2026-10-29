import http from './http'

/**
 * 获取当前用户未结束的会议
 */
export function getCurrentMeeting() {
  return http.get('/meeting/getCurrentMeeting')
}

/**
 * 快速创建并开始会议
 * @param {Object} params { meetingNoType, meetingName, jionType, jionPassword }
 */
export function quickMeeting(params) {
  return http.post('/meeting/quickMeeting', null, {
    params: {
      meetingNoType: params.meetingNoType ?? 0,
      meetingName: params.meetingName,
      jionType: params.jionType ?? 0,
      jionPassword: params.jionPassword || ''
    }
  })
}

/**
 * 预加入会议校验
 * @param {Object} params { meetingNo, nickName, password }
 */
export function prejoinMeeting(params) {
  return http.post('/meeting/prejoinMeeting', null, {
    params: {
      meetingNo: params.meetingNo,
      nickName: params.nickName,
      password: params.password || ''
    }
  })
}

/**
 * 正式加入会议房间并向全员广播
 * 注意：后端接口路径拼写为 /meeting/jionMeeting
 * @param {boolean} videoOpen 
 */
export function jionMeeting(videoOpen = false) {
  return http.post('/meeting/jionMeeting', null, {
    params: { videoOpen }
  })
}

/**
 * 获取在线参会成员列表
 * @param {string} meetingId 
 */
export function getMeetingMemberList(meetingId) {
  return http.get('/meeting/getMeetingMemberList', {
    params: { meetingId }
  })
}

/**
 * 参会人主动退出会议
 * @param {string} meetingId 
 */
export function exitMeeting(meetingId) {
  return http.post('/meeting/exitMeeting', null, {
    params: { meetingId }
  })
}

/**
 * 主持人解散并结束会议
 * @param {string} meetingId 
 */
export function finishMeeting(meetingId) {
  return http.post('/meeting/finishMeeting', null, {
    params: { meetingId }
  })
}

/**
 * 主持人踢出成员
 * @param {string} meetingId 
 * @param {string} targetUserId 
 */
export function kickOutMember(meetingId, targetUserId) {
  return http.post('/meeting/kickOutMember', null, {
    params: { meetingId, targetUserId }
  })
}

/**
 * 主持人拉黑成员
 * @param {string} meetingId 
 * @param {string} targetUserId 
 */
export function blacklistMember(meetingId, targetUserId) {
  return http.post('/meeting/blacklistMember', null, {
    params: { meetingId, targetUserId }
  })
}

/**
 * 更新成员自身媒体状态（麦克风、摄像头、屏幕共享）
 * @param {Object} params { meetingId, openVideo, openAudio, screenShare }
 */
export function updateMemberMediaState(params) {
  return http.post('/meeting/updateMemberMediaState', null, {
    params
  })
}

/**
 * 主持人全员静音 / 解除全员静音
 * @param {string} meetingId 
 * @param {boolean} mute 
 */
export function muteAll(meetingId, mute = true) {
  return http.post('/meeting/muteAll', null, {
    params: { meetingId, mute }
  })
}

/**
 * 发送会议聊天消息
 * @param {Object} params { message, receiveUserId }
 */
export function sendChatMessage(params) {
  return http.post('/meeting/sendChatMessage', null, {
    params: {
      message: params.message,
      receiveUserId: params.receiveUserId || ''
    }
  })
}

/**
 * 加载会议历史聊天记录
 * @param {string} meetingId 
 */
export function loadChatMessage(meetingId) {
  return http.get('/meeting/loadChatMessage', {
    params: { meetingId }
  })
}

/**
 * 生成会议邀请分享链接及文案
 * @param {Object} params { meetingId, expireHours, allowPasswordFree, maxUseCount, remark }
 */
export function generateInvite(params) {
  return http.post('/meeting/generateInvite', null, {
    params: {
      meetingId: params.meetingId,
      expireHours: params.expireHours ?? 24,
      allowPasswordFree: params.allowPasswordFree ?? 1,
      maxUseCount: params.maxUseCount ?? -1,
      remark: params.remark || ''
    }
  })
}

/**
 * 解析会议邀请码
 * @param {string} inviteCode 
 */
export function parseInviteCode(inviteCode) {
  return http.get('/meeting/parseInviteCode', {
    params: { inviteCode }
  })
}

/**
 * 通过邀请码入会
 * @param {Object} params { inviteCode, password }
 */
export function joinByInviteCode(params) {
  return http.post('/meeting/joinByInviteCode', null, {
    params: {
      inviteCode: params.inviteCode,
      password: params.password || ''
    }
  })
}

/**
 * 发送会议邀请邮件
 * @param {Object} params { meetingId, emails, expireHours, allowPasswordFree }
 */
export function sendInviteEmail(params) {
  return http.post('/meeting/sendInviteEmail', null, {
    params: {
      meetingId: params.meetingId,
      emails: params.emails,
      expireHours: params.expireHours ?? 24,
      allowPasswordFree: params.allowPasswordFree ?? 1
    }
  })
}

/**
 * 作废会议邀请链接
 * @param {string} inviteId 
 */
export function cancelInvite(inviteId) {
  return http.post('/meeting/cancelInvite', null, {
    params: { inviteId }
  })
}

/**
 * 调整会议时间并邮件通知全员
 * @param {Object} params { meetingId, startTime, endTime, changeReason }
 */
export function updateMeetingTime(params) {
  return http.post('/meetingReserve/updateMeetingTime', null, {
    params
  })
}

/**
 * 预约/创建未来会议
 * @param {Object} params { meetingNoType, meetingName, startTime, endTime, joinType, jionPassword }
 */
export function saveMeeting(params) {
  return http.post('/meetingReserve/saveMeeting', null, {
    params: {
      meetingNoType: params.meetingNoType ?? 1,
      meetingName: params.meetingName,
      startTime: params.startTime,
      endTime: params.endTime,
      joinType: params.joinType ?? 0,
      jionPassword: params.jionPassword || ''
    }
  })
}

/**
 * 删除/取消预约会议
 * @param {string} meetingId 
 */
export function delMeeting(meetingId) {
  return http.post('/meetingReserve/delMeeting', null, {
    params: { meetingId }
  })
}

/**
 * 获取今日/正在进行中的会议列表
 * 注意：后端路径为 /meetingReserve/LoadTodayMeeting (大写 L)
 */
export function loadTodayMeeting() {
  return http.get('/meetingReserve/LoadTodayMeeting')
}

/**
 * 分页加载会议历史记录
 * @param {number} pageNo 
 */
export function loadMeetingHistory(pageNo = 1) {
  return http.get('/meetingReserve/loadMeeting', {
    params: {
      pageNo,
      pageNO: pageNo
    }
  })
}

