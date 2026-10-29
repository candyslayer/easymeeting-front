import http from './http'

/**
 * 搜索联系人
 * @param {string} searchKey 用户ID、邮箱或昵称
 */
export function searchContact(searchKey) {
  return http.get('/userContact/searchContact', {
    params: { searchKey }
  })
}

/**
 * 发送好友申请
 * @param {Object} params { receiveUserId, applyInfo }
 */
export function applyContact(params) {
  return http.post('/userContact/applyContact', null, {
    params
  })
}

/**
 * 处理好友申请
 * @param {Object} params { applyId, status } 1:同意 2:拒绝 3:拉黑
 */
export function dealWithApply(params) {
  return http.post('/userContact/dealWithApply', null, {
    params
  })
}

/**
 * 获取通讯录好友列表
 */
export function loadContactList() {
  return http.get('/userContact/loadContactList')
}

/**
 * 分页获取收到的好友申请列表
 * @param {number} pageNo 
 */
export function loadApplyList(pageNo = 1) {
  return http.get('/userContact/loadApplyList', {
    params: { pageNo }
  })
}

/**
 * 修改好友备注
 * @param {Object} params { contactId, remark }
 */
export function updateRemark(params) {
  return http.post('/userContact/updateRemark', null, {
    params
  })
}

/**
 * 删除好友联系人
 * @param {string} contactId 
 */
export function delContact(contactId) {
  return http.post('/userContact/delContact', null, {
    params: { contactId }
  })
}

/**
 * 会议中邀请好友参会
 * @param {Object} params { meetingId, contactId }
 */
export function inviteContactToMeeting(params) {
  return http.post('/userContact/inviteContactToMeeting', null, {
    params
  })
}

