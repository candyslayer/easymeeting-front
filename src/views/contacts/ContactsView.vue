<template>
  <div class="contacts-view">
    <div class="contacts-card meeting-card">
      <div class="contacts-layout">
        <!-- 左侧菜单栏 -->
        <div class="contacts-sidebar">
          <div class="sidebar-header">
            <a-button type="primary" block @click="searchModalVisible = true">
              <UserAddOutlined /> 添加联系人
            </a-button>
          </div>

          <div class="category-menu">
            <div
              class="cat-item"
              :class="{ active: currentTab === 'contacts' }"
              @click="currentTab = 'contacts'"
            >
              <TeamOutlined class="cat-icon" />
              <span class="cat-label">全部联系人</span>
              <span class="cat-badge">{{ contactList.length }}</span>
            </div>

            <div
              class="cat-item"
              :class="{ active: currentTab === 'applies' }"
              @click="currentTab = 'applies'"
            >
              <UsergroupAddOutlined class="cat-icon" />
              <span class="cat-label">好友申请通知</span>
              <a-badge
                v-if="pendingAppliesCount > 0"
                :count="pendingAppliesCount"
                :offset="[4, 0]"
              />
            </div>
          </div>
        </div>

        <!-- 右侧主体内容区 -->
        <div class="contacts-main-content">
          <!-- 标签页 1：联系人列表 -->
          <div v-if="currentTab === 'contacts'" class="tab-content">
            <div class="content-header">
              <h3 class="panel-title">通讯录好友 ({{ contactList.length }})</h3>
              <a-input-search
                v-model:value="contactFilterText"
                placeholder="搜索昵称或邮箱..."
                style="width: 240px"
                allow-clear
              />
            </div>

            <a-skeleton v-if="loadingContacts" active :paragraph="{ rows: 4 }" />

            <div v-else-if="filteredContacts.length > 0" class="contact-grid">
              <div
                v-for="contact in filteredContacts"
                :key="contact.contactId"
                class="contact-card"
              >
                <div class="contact-top">
                  <a-avatar
                    :size="48"
                    :style="{ backgroundColor: getAvatarColor(contact.contactId) }"
                  >
                    {{ (contact.remark || contact.nickName)?.slice(0, 1) || '友' }}
                  </a-avatar>
                  <div class="contact-info ellipsis">
                    <h4 class="name ellipsis">
                      {{ contact.remark || contact.nickName }}
                      <span v-if="contact.remark" class="sub-nickname">({{ contact.nickName }})</span>
                    </h4>
                    <span class="email ellipsis">{{ contact.email }}</span>
                  </div>
                </div>

                <div class="contact-status-bar">
                  <span v-if="contact.isOnline" class="online-tag">
                    <span class="dot online"></span> 在线
                  </span>
                  <span v-else class="offline-tag">
                    <span class="dot offline"></span> 离线
                  </span>

                  <span v-if="contact.currentMeetingId" class="in-meeting-tag">
                    <VideoCameraOutlined /> 正在会议中
                  </span>
                </div>

                <div class="contact-actions">
                  <a-button
                    type="link"
                    size="small"
                    @click="openEditRemark(contact)"
                  >
                    备注
                  </a-button>
                  <a-button
                    v-if="authStore.currentMeetingId"
                    type="link"
                    size="small"
                    @click="handleInviteToMeeting(contact)"
                  >
                    呼叫入会
                  </a-button>
                  <a-popconfirm
                    title="确定删除此联系人好友吗？"
                    ok-text="删除"
                    cancel-text="取消"
                    ok-type="danger"
                    @confirm="handleDeleteContact(contact)"
                  >
                    <a-button type="link" danger size="small">
                      删除
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
            </div>

            <div v-else class="empty-box">
              <a-empty description="暂无联系人，快去添加新好友吧">
                <a-button type="primary" @click="searchModalVisible = true">
                  添加联系人
                </a-button>
              </a-empty>
            </div>
          </div>

          <!-- 标签页 2：好友申请列表 -->
          <div v-else class="tab-content">
            <div class="content-header">
              <h3 class="panel-title">好友申请列表</h3>
              <a-button size="small" @click="fetchApplies(1)">
                <ReloadOutlined :spin="loadingApplies" /> 刷新
              </a-button>
            </div>

            <a-skeleton v-if="loadingApplies" active :paragraph="{ rows: 3 }" />

            <div v-else-if="applyList.length > 0" class="apply-list-container">
              <div
                v-for="apply in applyList"
                :key="apply.applyId"
                class="apply-item"
              >
                <div class="apply-info-left">
                  <a-avatar
                    :size="40"
                    :style="{ backgroundColor: '#1677ff' }"
                  >
                    {{ apply.applyUserName?.slice(0, 1) || '申' }}
                  </a-avatar>
                  <div class="apply-text">
                    <div class="apply-user-line">
                      <span class="apply-name">{{ apply.applyUserName }}</span>
                      <span class="apply-email">{{ apply.applyUserEmail }}</span>
                    </div>
                    <div class="apply-msg">
                      附言: {{ apply.applyInfo || '请求添加您为联系人好友' }}
                    </div>
                  </div>
                </div>

                <div class="apply-actions-right">
                  <!-- 状态 0: 待处理 -->
                  <div v-if="apply.status === 0" class="deal-btns">
                    <a-button
                      type="primary"
                      size="small"
                      @click="handleDealApply(apply.applyId, 1)"
                    >
                      同意
                    </a-button>
                    <a-button
                      size="small"
                      @click="handleDealApply(apply.applyId, 2)"
                    >
                      拒绝
                    </a-button>
                    <a-button
                      type="text"
                      danger
                      size="small"
                      @click="handleDealApply(apply.applyId, 3)"
                    >
                      拉黑
                    </a-button>
                  </div>
                  <!-- 其他状态 -->
                  <span v-else class="status-result">
                    <a-tag v-if="apply.status === 1" color="success">已同意</a-tag>
                    <a-tag v-else-if="apply.status === 2" color="default">已拒绝</a-tag>
                    <a-tag v-else-if="apply.status === 3" color="error">已拉黑</a-tag>
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="empty-box">
              <a-empty description="暂无收到的好友申请" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索与添加联系人弹窗 -->
    <a-modal
      v-model:open="searchModalVisible"
      title="查找并添加联系人"
      width="540px"
      :footer="null"
    >
      <div class="search-modal-body">
        <a-input-search
          v-model:value="searchKey"
          placeholder="请输入用户 ID、邮箱或昵称..."
          enter-button="查找"
          size="large"
          :loading="searching"
          @search="handleSearchContact"
        />

        <div v-if="searchResults.length > 0" class="search-results-list">
          <div
            v-for="user in searchResults"
            :key="user.userId"
            class="user-result-row"
          >
            <div class="user-info-col">
              <a-avatar :size="40" :style="{ backgroundColor: '#1677ff' }">
                {{ user.nickName?.slice(0, 1) || '用' }}
              </a-avatar>
              <div class="user-details ellipsis">
                <span class="user-name ellipsis">{{ user.nickName }}</span>
                <span class="user-email ellipsis">{{ user.email }} (ID: {{ user.userId }})</span>
              </div>
            </div>

            <div class="user-action-col">
              <span v-if="user.friendshipStatus === 1" class="is-friend">已是好友</span>
              <span v-else-if="user.friendshipStatus === 2" class="is-applying">已申请</span>
              <span v-else-if="user.friendshipStatus === 3" class="is-self">我自己</span>
              <a-button
                v-else
                type="primary"
                size="small"
                @click="openApplyDialog(user)"
              >
                添加好友
              </a-button>
            </div>
          </div>
        </div>

        <div v-else-if="hasSearched && searchResults.length === 0" class="no-result">
          未检索到符合条件的用户
        </div>
      </div>
    </a-modal>

    <!-- 发送好友申请附言弹窗 -->
    <a-modal
      v-model:open="applyDialogVisible"
      title="发送添加好友申请"
      :confirm-loading="applying"
      @ok="submitApply"
    >
      <a-form layout="vertical" style="margin-top: 14px">
        <a-form-item label="对方昵称">
          <span>{{ targetApplyUser?.nickName }} ({{ targetApplyUser?.email }})</span>
        </a-form-item>
        <a-form-item label="申请附言">
          <a-textarea
            v-model:value="applyMessage"
            placeholder="例如: 我是研发组的某某，请求添加好友"
            :rows="3"
            maxlength="100"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 修改备注弹窗 -->
    <a-modal
      v-model:open="remarkDialogVisible"
      title="修改联系人备注"
      @ok="submitRemark"
    >
      <a-form layout="vertical" style="margin-top: 14px">
        <a-form-item label="好友原昵称">
          <span>{{ targetRemarkContact?.nickName }}</span>
        </a-form-item>
        <a-form-item label="备注名" required>
          <a-input
            v-model:value="newRemarkText"
            placeholder="请输入新的备注名"
            maxlength="20"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  TeamOutlined,
  UsergroupAddOutlined,
  UserAddOutlined,
  ReloadOutlined,
  VideoCameraOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import {
  loadContactList,
  loadApplyList,
  searchContact,
  applyContact,
  dealWithApply,
  updateRemark,
  delContact,
  inviteContactToMeeting
} from '@/api/contact'

const authStore = useAuthStore()

const currentTab = ref('contacts')
const contactList = ref([])
const applyList = ref([])
const loadingContacts = ref(false)
const loadingApplies = ref(false)
const contactFilterText = ref('')

// 搜索添加弹窗状态
const searchModalVisible = ref(false)
const searchKey = ref('')
const searching = ref(false)
const searchResults = ref([])
const hasSearched = ref(false)

// 申请附言弹窗状态
const applyDialogVisible = ref(false)
const targetApplyUser = ref(null)
const applyMessage = ref('')
const applying = ref(false)

// 修改备注弹窗状态
const remarkDialogVisible = ref(false)
const targetRemarkContact = ref(null)
const newRemarkText = ref('')

const pendingAppliesCount = computed(() => {
  return applyList.value.filter((a) => a.status === 0).length
})

const filteredContacts = computed(() => {
  if (!contactFilterText.value.trim()) return contactList.value
  const kw = contactFilterText.value.trim().toLowerCase()
  return contactList.value.filter((c) => {
    return (
      c.nickName?.toLowerCase().includes(kw) ||
      c.remark?.toLowerCase().includes(kw) ||
      c.email?.toLowerCase().includes(kw)
    )
  })
})

function getAvatarColor(id) {
  const colors = ['#1677ff', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96']
  const str = id || 'contact'
  const index = Math.abs(str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colors.length
  return colors[index]
}

async function fetchContacts() {
  loadingContacts.value = true
  try {
    const res = await loadContactList()
    contactList.value = res || []
  } catch (err) {
    message.error(err.message || '获取联系人列表失败')
  } finally {
    loadingContacts.value = false
  }
}

async function fetchApplies(page = 1) {
  loadingApplies.value = true
  try {
    const res = await loadApplyList(page)
    applyList.value = res?.list || []
  } catch (err) {
    console.error('获取申请列表失败:', err)
  } finally {
    loadingApplies.value = false
  }
}

async function handleSearchContact() {
  const kw = searchKey.value.trim()
  if (!kw) return

  searching.value = true
  hasSearched.value = true
  try {
    const res = await searchContact(kw)
    searchResults.value = res || []
  } catch (err) {
    message.error(err.message || '搜索联系人失败')
  } finally {
    searching.value = false
  }
}

function openApplyDialog(user) {
  targetApplyUser.value = user
  applyMessage.value = `我是 ${authStore.nickName}，请求添加好友`
  applyDialogVisible.value = true
}

async function submitApply() {
  if (!targetApplyUser.value) return
  applying.value = true
  try {
    await applyContact({
      receiveUserId: targetApplyUser.value.userId,
      applyInfo: applyMessage.value.trim()
    })
    message.success('好友申请已成功发送')
    applyDialogVisible.value = false
    targetApplyUser.value.friendshipStatus = 2
  } catch (err) {
    message.error(err.message || '发送好友申请失败')
  } finally {
    applying.value = false
  }
}

async function handleDealApply(applyId, status) {
  try {
    await dealWithApply({ applyId, status })
    const actionName = status === 1 ? '同意' : status === 2 ? '拒绝' : '拉黑'
    message.success(`已${actionName}该申请`)
    fetchApplies(1)
    if (status === 1) {
      fetchContacts()
    }
  } catch (err) {
    message.error(err.message || '处理申请失败')
  }
}

function openEditRemark(contact) {
  targetRemarkContact.value = contact
  newRemarkText.value = contact.remark || ''
  remarkDialogVisible.value = true
}

async function submitRemark() {
  if (!targetRemarkContact.value) return
  try {
    await updateRemark({
      contactId: targetRemarkContact.value.contactId,
      remark: newRemarkText.value.trim()
    })
    message.success('备注名已更新')
    targetRemarkContact.value.remark = newRemarkText.value.trim()
    remarkDialogVisible.value = false
  } catch (err) {
    message.error(err.message || '修改备注失败')
  }
}

async function handleDeleteContact(contact) {
  try {
    await delContact(contact.contactId)
    message.success('已删除联系人好友')
    contactList.value = contactList.value.filter((c) => c.contactId !== contact.contactId)
  } catch (err) {
    message.error(err.message || '删除联系人失败')
  }
}

async function handleInviteToMeeting(contact) {
  if (!authStore.currentMeetingId) return
  try {
    await inviteContactToMeeting({
      meetingId: authStore.currentMeetingId,
      contactId: contact.contactId
    })
    message.success(`已向 ${contact.nickName} 发送会议呼叫与邮件通知`)
  } catch (err) {
    message.error(err.message || '呼叫好友失败')
  }
}

onMounted(() => {
  fetchContacts()
  fetchApplies(1)
})
</script>

<style scoped>
.contacts-view {
  max-width: 1200px;
  margin: 0 auto;
}

.contacts-card {
  background: #ffffff;
  padding: 0;
  overflow: hidden;
  height: calc(100vh - var(--header-height) - 48px);
}

.contacts-layout {
  display: flex;
  height: 100%;
}

.contacts-sidebar {
  width: 240px;
  border-right: 1px solid var(--border-color);
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
}

.category-menu {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--border-radius-base);
  font-size: 14px;
  color: var(--text-regular);
  cursor: pointer;
  transition: all 0.2s;
}

.cat-item:hover {
  background-color: #f0f2f5;
  color: var(--primary-color);
}

.cat-item.active {
  background-color: #e6f4ff;
  color: var(--primary-color);
  font-weight: 600;
}

.cat-icon {
  font-size: 16px;
}

.cat-label {
  flex: 1;
}

.cat-badge {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 主面板 */
.contacts-main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.contact-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-base);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
}

.contact-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border-color: #91caff;
}

.contact-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.sub-nickname {
  font-size: 12px;
  font-weight: normal;
  color: var(--text-secondary);
}

.email {
  font-size: 12px;
  color: var(--text-secondary);
}

.contact-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.dot.online {
  background: #52c41a;
}

.dot.offline {
  background: #bfbfbf;
}

.online-tag {
  color: #52c41a;
}

.offline-tag {
  color: var(--text-secondary);
}

.in-meeting-tag {
  color: #1677ff;
}

.contact-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border-light);
  padding-top: 8px;
}

.empty-box {
  padding: 60px 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 好友申请 */
.apply-list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.apply-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #fafafa;
  border-radius: var(--border-radius-base);
  border: 1px solid var(--border-light);
}

.apply-info-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.apply-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.apply-user-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.apply-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.apply-email {
  font-size: 12px;
  color: var(--text-secondary);
}

.apply-msg {
  font-size: 12px;
  color: var(--text-regular);
}

.deal-btns {
  display: flex;
  gap: 8px;
}

/* 搜索模态框 */
.search-modal-body {
  padding-top: 10px;
}

.search-results-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow-y: auto;
}

.user-result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f7f8fa;
  border-radius: var(--border-radius-base);
}

.user-info-col {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.user-email {
  font-size: 12px;
  color: var(--text-secondary);
}

.is-friend, .is-applying, .is-self {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>

