<template>
  <div class="transcript-panel">
    <!-- 顶部操作与筛选栏 -->
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">会议逐字转写记录</h3>
        <span class="total-badge">共 {{ totalCount }} 条片段</span>
        <a-tag v-if="filteredSpeaker" closable @close="filteredSpeaker = ''" color="blue">
          说话人: {{ filteredSpeaker }}
        </a-tag>
      </div>

      <div class="header-actions">
        <!-- 说话人筛选下拉 -->
        <a-select
          v-model:value="filteredSpeaker"
          placeholder="全部说话人"
          class="speaker-select"
          allow-clear
        >
          <a-select-option value="">全部说话人</a-select-option>
          <a-select-option v-for="spk in speakerOptions" :key="spk" :value="spk">
            {{ spk }}
          </a-select-option>
        </a-select>

        <!-- 关键词搜索 -->
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索转写文本..."
          class="keyword-search"
          allow-clear
        />

        <a-button @click="fetchSegments(currentPage)">
          <ReloadOutlined :spin="loading" /> 刷新
        </a-button>
      </div>
    </div>

    <!-- 转写片段内容区域 -->
    <div class="segments-container" ref="segmentsListRef">
      <a-spin :spinning="loading">
        <div v-if="displaySegments.length === 0" class="empty-box">
          <a-empty description="暂无转写记录，请在录音管理中上传录音并发起转写，或等待实时转写生成" />
        </div>

        <div v-else class="segments-list">
          <div
            v-for="item in displaySegments"
            :key="item.segmentId"
            :id="`seg-${item.segmentId}`"
            class="segment-item"
            :class="{
              'highlighted': item.segmentId === highlightSegmentId,
              'is-revised': item.isRevised === 1
            }"
          >
            <!-- 左侧说话人头像与时间戳 -->
            <div class="segment-meta">
              <a-avatar
                size="small"
                :style="{ backgroundColor: getAvatarColor(item.speakerName || '参会者') }"
              >
                {{ (item.speakerName || '参会者').slice(0, 1) }}
              </a-avatar>
              <div class="meta-info">
                <span class="speaker-name">{{ item.speakerName || '参会者' }}</span>
                <!-- 时间戳按钮：点击定位音频播放进度 -->
                <a-tooltip title="点击跳转至该时间播放">
                  <button
                    class="time-pill"
                    @click="handleTimeClick(item.startTimeMs)"
                  >
                    <CaretRightOutlined style="font-size: 10px; margin-right: 2px" />
                    {{ formatTime(item.startTimeMs) }} - {{ formatTime(item.endTimeMs) }}
                  </button>
                </a-tooltip>
              </div>
            </div>

            <!-- 右侧转写文本正文 -->
            <div class="segment-body">
              <div class="text-wrapper">
                <p class="transcript-text" :class="{ 'has-diff': item.isRevised === 1 }">
                  {{ item.currentText }}
                </p>
                <div v-if="item.isRevised === 1" class="revised-pill">
                  <EditOutlined /> 已修正
                </div>
              </div>

              <!-- 右侧快捷操作：修正、历史 -->
              <div class="item-actions">
                <a-button
                  type="text"
                  size="small"
                  class="action-btn"
                  @click="openReviseModal(item)"
                >
                  <EditOutlined /> 修正文本
                </a-button>
                <a-button
                  v-if="item.isRevised === 1"
                  type="text"
                  size="small"
                  class="action-btn"
                  @click="viewHistory(item)"
                >
                  <HistoryOutlined /> 修正记录
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- 底部翻页栏 -->
    <div class="panel-footer" v-if="totalCount > 0">
      <a-pagination
        v-model:current="currentPage"
        v-model:pageSize="pageSize"
        :total="totalCount"
        :show-total="(total) => `共 ${total} 个片段`"
        size="small"
        @change="handlePageChange"
      />
    </div>

    <!-- 人工修正文本弹窗 -->
    <a-modal
      v-model:open="reviseModalVisible"
      title="人工修正转写文本"
      :confirm-loading="submittingRevise"
      @ok="handleReviseSubmit"
    >
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="原始转写文本">
          <div class="original-quote-box">
            {{ activeSegment?.originalText }}
          </div>
        </a-form-item>

        <a-form-item label="更正后文本" required>
          <a-textarea
            v-model:value="reviseForm.revisedText"
            :rows="3"
            placeholder="请输入更正后的准确文本..."
          />
        </a-form-item>

        <a-form-item label="修改原因 / 备注">
          <a-input
            v-model:value="reviseForm.revisionReason"
            placeholder="例如: 专有名词修正、错别字修正"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 修正历史抽屉/弹窗 -->
    <a-modal
      v-model:open="historyModalVisible"
      title="片段修改历史"
      :footer="null"
      width="560px"
    >
      <a-spin :spinning="loadingHistory">
        <div v-if="revisionHistory.length === 0" style="padding: 24px 0">
          <a-empty description="暂无修改历史" />
        </div>
        <a-timeline v-else style="margin-top: 20px">
          <a-timeline-item v-for="rev in revisionHistory" :key="rev.revisionId">
            <template #dot>
              <CheckCircleOutlined style="font-size: 14px; color: #1677ff" />
            </template>
            <div class="history-item">
              <div class="history-meta">
                <span class="history-time">{{ rev.createTime }}</span>
                <span class="history-reason" v-if="rev.revisionReason">原因: {{ rev.revisionReason }}</span>
              </div>
              <div class="history-diff">
                <div class="diff-before">
                  <span class="diff-label">修改前:</span> {{ rev.beforeText }}
                </div>
                <div class="diff-after">
                  <span class="diff-label">修改后:</span> {{ rev.afterText }}
                </div>
              </div>
            </div>
          </a-timeline-item>
        </a-timeline>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  EditOutlined,
  HistoryOutlined,
  CaretRightOutlined,
  CheckCircleOutlined
} from '@ant-design/icons-vue'
import {
  getTranscriptSegments,
  reviseTranscriptSegment,
  getRevisionHistory
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['seekAudio'])

const aiStore = useMeetingAiStore()

const loading = ref(false)
const rawSegments = ref([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const filteredSpeaker = ref('')
const searchKeyword = ref('')
const segmentsListRef = ref(null)

// 高亮片段跟踪
const highlightSegmentId = computed(() => aiStore.highlightSegmentId)

// 修正弹窗
const reviseModalVisible = ref(false)
const activeSegment = ref(null)
const submittingRevise = ref(false)
const reviseForm = reactive({
  revisedText: '',
  revisionReason: ''
})

// 历史记录弹窗
const historyModalVisible = ref(false)
const loadingHistory = ref(false)
const revisionHistory = ref([])

// 提取所有说话人
const speakerOptions = computed(() => {
  const set = new Set()
  rawSegments.value.forEach((item) => {
    if (item.speakerName) set.add(item.speakerName)
  })
  return Array.from(set)
})

// 本地筛选（说话人 + 关键词）
const displaySegments = computed(() => {
  let list = rawSegments.value
  if (filteredSpeaker.value) {
    list = list.filter((item) => item.speakerName === filteredSpeaker.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter((item) => {
      const current = (item.currentText || '').toLowerCase()
      const original = (item.originalText || '').toLowerCase()
      const speaker = (item.speakerName || '').toLowerCase()
      return current.includes(kw) || original.includes(kw) || speaker.includes(kw)
    })
  }
  return list
})

// 毫秒格式化为 mm:ss
function formatTime(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// 依据名称生成柔和背景色
function getAvatarColor(name) {
  const colors = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// 获取转写列表
async function fetchSegments(page = 1) {
  if (!props.meetingId) return
  loading.value = true
  try {
    const res = await getTranscriptSegments({
      meetingId: props.meetingId,
      pageNo: page,
      pageSize: pageSize.value
    })
    if (res) {
      rawSegments.value = res.list || []
      totalCount.value = res.totalCount || 0
      currentPage.value = res.pageNo || page
    }
  } catch (err) {
    message.error(err.message || '获取转写记录失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page, size) {
  currentPage.value = page
  pageSize.value = size
  fetchSegments(page)
}

function handleTimeClick(startTimeMs) {
  emit('seekAudio', startTimeMs)
  aiStore.audioSeekTimeMs = startTimeMs
}

// 打开人工修正弹窗
function openReviseModal(item) {
  activeSegment.value = item
  reviseForm.revisedText = item.currentText || item.originalText
  reviseForm.revisionReason = ''
  reviseModalVisible.value = true
}

// 提交修正
async function handleReviseSubmit() {
  if (!reviseForm.revisedText.trim()) {
    message.warning('更正后文本不能为空')
    return
  }

  submittingRevise.value = true
  try {
    const updated = await reviseTranscriptSegment({
      segmentId: activeSegment.value.segmentId,
      meetingId: props.meetingId,
      revisedText: reviseForm.revisedText.trim(),
      revisionReason: reviseForm.revisionReason.trim()
    })

    message.success('转写文本已成功修正')
    reviseModalVisible.value = false

    // 更新本地项
    const idx = rawSegments.value.findIndex((s) => s.segmentId === activeSegment.value.segmentId)
    if (idx !== -1 && updated) {
      rawSegments.value[idx] = updated
    } else {
      fetchSegments(currentPage.value)
    }
  } catch (err) {
    message.error(err.message || '保存修正失败')
  } finally {
    submittingRevise.value = false
  }
}

// 查看历史记录
async function viewHistory(item) {
  historyModalVisible.value = true
  loadingHistory.value = true
  revisionHistory.value = []
  try {
    const list = await getRevisionHistory(item.segmentId)
    revisionHistory.value = list || []
  } catch (err) {
    message.error(err.message || '获取修改记录失败')
  } finally {
    loadingHistory.value = false
  }
}

// 监视高亮段落变动，自动滚动定位到视口
watch(
  () => aiStore.highlightSegmentId,
  (newId) => {
    if (newId) {
      nextTick(() => {
        const el = document.getElementById(`seg-${newId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    }
  }
)

watch(
  () => props.meetingId,
  (newVal) => {
    if (newVal) {
      currentPage.value = 1
      fetchSegments(1)
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchSegments(1)
})
</script>

<style scoped>
.transcript-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-card);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: #fafafa;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-main);
}

.total-badge {
  font-size: 12px;
  color: var(--text-secondary);
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.segments-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.empty-box {
  padding: 60px 0;
  text-align: center;
}

.segments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.segment-item {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #f0f0f0;
  transition: all 0.25s ease;
}

.segment-item:hover {
  background: #f9fbfd;
  border-color: #d9e8ff;
}

.segment-item.highlighted {
  background: #e6f4ff !important;
  border-color: #1677ff !important;
  box-shadow: 0 0 10px rgba(22, 119, 255, 0.2);
}

.segment-meta {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 150px;
  flex-shrink: 0;
}

.meta-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.speaker-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.time-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 11px;
  color: #1677ff;
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-family-mono);
}

.time-pill:hover {
  background: #1677ff;
  color: #ffffff;
}

.segment-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.text-wrapper {
  flex: 1;
}

.transcript-text {
  font-size: 14px;
  color: var(--text-main);
  line-height: 1.6;
  margin: 0;
  word-break: break-word;
}

.revised-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: #fa8c16;
  background: #fff7e6;
  padding: 1px 6px;
  border-radius: 3px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.segment-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  font-size: 12px;
  padding: 0 4px;
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background: #fafafa;
}

.original-quote-box {
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.history-diff {
  background: #f9f9f9;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.diff-before {
  color: #ff4d4f;
  text-decoration: line-through;
}

.diff-after {
  color: #52c41a;
}

.speaker-select {
  width: 140px;
}

.keyword-search {
  width: 200px;
}

@media (max-width: 768px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    padding: 12px 14px;
    gap: 10px;
  }

  .header-left {
    justify-content: space-between;
  }

  .header-actions {
    flex-wrap: wrap;
    gap: 8px;
  }

  .speaker-select {
    flex: 1;
    min-width: 120px;
    width: auto;
  }

  .keyword-search {
    flex: 2;
    min-width: 150px;
    width: auto;
  }

  .segments-container {
    padding: 10px 12px;
  }

  .segment-item {
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
  }

  .segment-meta {
    width: 100%;
    min-width: unset;
    align-items: center;
  }

  .meta-info {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex: 1;
  }

  .segment-body {
    flex-direction: column;
    gap: 8px;
  }

  .item-actions {
    width: 100%;
    justify-content: flex-end;
    opacity: 1;
    border-top: 1px dashed #f0f0f0;
    padding-top: 4px;
  }

  .panel-footer {
    padding: 10px 14px;
    justify-content: center;
  }
}
</style>

