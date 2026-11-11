<template>
  <div class="transcript-panel">
    <!-- 顶部操作与筛选栏 -->
    <div class="panel-header">
      <div class="header-left">
        <div class="title-row">
          <h3 class="panel-title">会议逐字转写记录</h3>
          <span class="total-badge">共 {{ totalCount }} 条片段</span>
          <span v-if="isFiltered" class="filter-count-badge">
            已筛选 {{ displaySegments.length }} 条
          </span>
        </div>
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
          placeholder="搜索转写文本或说话人..."
          class="keyword-search"
          allow-clear
        />

        <a-button class="refresh-btn" @click="fetchSegments(currentPage)">
          <ReloadOutlined :spin="loading" />
          <span class="btn-label">刷新</span>
        </a-button>
      </div>
    </div>

    <!-- 时间轴转写片段内容区域 -->
    <div class="segments-container" ref="segmentsListRef">
      <a-spin :spinning="loading">
        <div v-if="displaySegments.length === 0" class="empty-box">
          <a-empty description="暂无转写记录，请在录音管理中上传录音并发起转写，或等待实时转写生成" />
        </div>

        <div v-else class="transcript-timeline">
          <div
            v-for="(item, idx) in displaySegments"
            :key="item.segmentId"
            :id="`seg-${item.segmentId}`"
            class="timeline-item"
            :class="{
              'highlighted': item.segmentId === highlightSegmentId,
              'is-revised': item.isRevised === 1,
              'is-playing': isSegmentPlaying(item),
              'is-focused': focusedSegmentId === item.segmentId,
              'is-self': isSelfSpeaker(item),
              'is-first': idx === 0,
              'is-last': idx === displaySegments.length - 1
            }"
            :style="getTimelineItemVars(item)"
            @click="handleItemTap(item, $event)"
          >
            <!-- 1. 左侧时间坐标列 (桌面端显示) -->
            <div class="timeline-time-col">
              <a-tooltip title="点击跳转至该时间播放">
                <button
                  type="button"
                  class="time-anchor-btn"
                  @click.stop="handleTimeClick(item.startTimeMs)"
                >
                  <CaretRightOutlined class="time-play-icon" />
                  <span>{{ formatTranscriptMs(item.startTimeMs) }}</span>
                </button>
              </a-tooltip>
              <span v-if="formatSegmentDuration(item.startTimeMs, item.endTimeMs)" class="duration-sub">
                {{ formatSegmentDuration(item.startTimeMs, item.endTimeMs) }}
              </span>
            </div>

            <!-- 2. 时间轴纵线与节点圆点 -->
            <div class="timeline-axis" aria-hidden="true">
              <span class="axis-line-top"></span>
              <button
                type="button"
                class="timeline-dot-btn"
                :title="`跳转至 ${formatTranscriptMs(item.startTimeMs)} 播放`"
                @click.stop="handleTimeClick(item.startTimeMs)"
              >
                <span class="timeline-dot"></span>
              </button>
              <span class="axis-line-bottom"></span>
              <span class="axis-connector"></span>
            </div>

            <!-- 3. 说话人头像 -->
            <div class="timeline-avatar-col">
              <div class="speaker-avatar-wrap">
                <a-avatar
                  :size="isMobile ? 32 : 40"
                  :src="getSegmentAvatarSrc(item)"
                  :load-error="() => handleAvatarError(item)"
                  class="speaker-avatar"
                  :style="{ background: getSpeakerTheme(item.speakerName).gradient }"
                >
                  {{ getSpeakerInitial(item.speakerName) }}
                </a-avatar>
                <span v-if="isSegmentPlaying(item)" class="playing-dot" title="当前播放位置"></span>
              </div>
            </div>

            <!-- 4. 气泡对话框 -->
            <div class="speech-bubble">
              <div class="bubble-inner">
                <!-- 气泡顶部说话人与时间戳 -->
                <div class="bubble-header">
                  <div class="bubble-speaker-group">
                    <button
                      type="button"
                      class="speaker-name-btn"
                      :title="filteredSpeaker === item.speakerName ? '取消仅看该说话人' : '点击筛选该说话人'"
                      @click.stop="toggleSpeakerFilter(item.speakerName)"
                    >
                      <span class="speaker-color-dot"></span>
                      <span class="speaker-name">{{ item.speakerName || '参会者' }}</span>
                    </button>
                    <span v-if="isSelfSpeaker(item)" class="role-badge self-badge">我</span>
                    <span v-if="item.segmentId === highlightSegmentId" class="status-pill evidence-pill">
                      证据定位
                    </span>
                    <span v-if="isSegmentPlaying(item)" class="status-pill playing-pill">
                      <SoundOutlined /> 播放中
                    </span>
                    <span v-if="item.isRevised === 1" class="status-pill revised-pill">
                      <EditOutlined /> 已修正
                    </span>
                  </div>

                  <div class="bubble-time-group">
                    <a-tooltip title="点击跳转至该时间播放">
                      <button
                        type="button"
                        class="bubble-time-pill"
                        @click.stop="handleTimeClick(item.startTimeMs)"
                      >
                        <CaretRightOutlined class="pill-play-icon" />
                        <span>{{ formatTranscriptMs(item.startTimeMs) }} - {{ formatTranscriptMs(item.endTimeMs) }}</span>
                      </button>
                    </a-tooltip>
                  </div>
                </div>

                <!-- 气泡正文 -->
                <div class="bubble-body">
                  <p class="transcript-text" :class="{ 'has-diff': item.isRevised === 1 }">
                    <template
                      v-for="(part, partIdx) in splitHighlightParts(item.currentText || item.originalText, searchKeyword)"
                      :key="partIdx"
                    >
                      <mark v-if="part.match" class="kw-highlight">{{ part.text }}</mark>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </p>
                </div>

                <!-- 气泡底部快捷动作 -->
                <div class="bubble-footer">
                  <div class="item-actions">
                    <a-button
                      type="text"
                      size="small"
                      class="action-btn"
                      @click.stop="handleCopySegment(item)"
                    >
                      <CopyOutlined /> 复制
                    </a-button>
                    <a-button
                      type="text"
                      size="small"
                      class="action-btn"
                      @click.stop="openReviseModal(item)"
                    >
                      <EditOutlined /> 修正文本
                    </a-button>
                    <a-button
                      v-if="item.isRevised === 1"
                      type="text"
                      size="small"
                      class="action-btn"
                      @click.stop="viewHistory(item)"
                    >
                      <HistoryOutlined /> 修正记录
                    </a-button>
                  </div>
                </div>
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
        :simple="isSmallMobile"
        :show-size-changer="!isMobile"
        :show-total="isMobile ? undefined : (total) => `共 ${total} 个片段`"
        size="small"
        @change="handlePageChange"
      />
    </div>

    <!-- 人工修正文本弹窗 -->
    <a-modal
      v-model:open="reviseModalVisible"
      title="人工修正转写文本"
      :width="isMobile ? '94vw' : '520px'"
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
      :width="isMobile ? '94vw' : '560px'"
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
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  EditOutlined,
  HistoryOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  SoundOutlined
} from '@ant-design/icons-vue'
import {
  getTranscriptSegments,
  reviseTranscriptSegment,
  getRevisionHistory
} from '@/api/meetingAi'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useAuthStore } from '@/stores/auth'
import { useMeetingStore } from '@/stores/meeting'
import { copyText } from '@/utils/format'
import {
  getSpeakerTheme,
  getSpeakerInitial,
  formatTranscriptMs,
  formatSegmentDuration,
  resolveSpeakerAvatarUrl,
  splitHighlightParts
} from '@/utils/transcript'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['seekAudio'])

const aiStore = useMeetingAiStore()
const authStore = useAuthStore()
const meetingStore = useMeetingStore()

const loading = ref(false)
const rawSegments = ref([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const filteredSpeaker = ref('')
const searchKeyword = ref('')
const segmentsListRef = ref(null)
const focusedSegmentId = ref(null)

// 视口宽度监听（适配移动端）
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value <= 768)
const isSmallMobile = computed(() => windowWidth.value <= 480)

function handleWindowResize() {
  windowWidth.value = window.innerWidth
}

// 头像缓存与失败记录
const avatarVersion = Date.now()
const failedAvatarUrls = reactive(new Set())

// 高亮片段跟踪
const highlightSegmentId = computed(() => aiStore.highlightSegmentId)

// 是否存在筛选条件
const isFiltered = computed(() => Boolean(filteredSpeaker.value || searchKeyword.value.trim()))

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

function getTimelineItemVars(item) {
  const theme = getSpeakerTheme(item?.speakerName || '参会者')
  return {
    '--speaker-color': theme.color,
    '--speaker-gradient': theme.gradient,
    '--speaker-tint-bg': theme.tintBg,
    '--speaker-tint-border': theme.tintBorder,
    '--speaker-glow': theme.glow
  }
}

function getSegmentAvatarSrc(item) {
  const url = resolveSpeakerAvatarUrl(item, meetingStore.memberList, avatarVersion)
  if (!url || failedAvatarUrls.has(url)) {
    return undefined
  }
  return url
}

function handleAvatarError(item) {
  const url = resolveSpeakerAvatarUrl(item, meetingStore.memberList, avatarVersion)
  if (url) {
    failedAvatarUrls.add(url)
  }
  return true
}

function isSelfSpeaker(item) {
  if (!item || !authStore.userId) return false
  const speakerUid = item.speakerUserId || item.userId
  if (speakerUid && String(speakerUid) === String(authStore.userId)) {
    return true
  }
  return false
}

function isSegmentPlaying(item) {
  const seek = aiStore.audioSeekTimeMs
  if (!seek || seek <= 0) return false
  if (item.startTimeMs == null || item.endTimeMs == null) return false
  return seek >= item.startTimeMs && seek <= item.endTimeMs
}

function toggleSpeakerFilter(speakerName) {
  if (!speakerName) return
  filteredSpeaker.value = filteredSpeaker.value === speakerName ? '' : speakerName
}

function handleItemTap(item) {
  if (typeof window !== 'undefined') {
    const selectedText = window.getSelection?.()?.toString()
    if (selectedText) return
  }
  // 移动端/触屏下支持轻触时间轴卡片凸起聚焦；桌面端主要靠鼠标悬停动效
  if (isMobile.value || (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches)) {
    focusedSegmentId.value = focusedSegmentId.value === item.segmentId ? null : item.segmentId
  }
}

async function handleCopySegment(item) {
  const text = item.currentText || item.originalText || ''
  if (!text) return
  const ok = await copyText(text)
  if (ok) {
    message.success('已复制该句转写内容')
  } else {
    message.error('复制失败，请手动选中复制')
  }
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
      focusedSegmentId.value = null
      fetchSegments(1)
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize)
  }
  fetchSegments(1)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleWindowResize)
  }
})
</script>

<style scoped>
.transcript-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-lg, 12px);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color, #e5e6eb);
  background: #ffffff;
  gap: 12px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-main, #1f2329);
}

.total-badge {
  font-size: 12px;
  color: var(--text-secondary, #86909c);
  background: #f2f4f7;
  padding: 2px 9px;
  border-radius: 12px;
}

.filter-count-badge {
  font-size: 12px;
  color: #1677ff;
  background: #e6f4ff;
  padding: 2px 9px;
  border-radius: 12px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.speaker-select {
  width: 140px;
}

.keyword-search {
  width: 210px;
}

/* 时间轴容器区域：留足右侧边距保证气泡放大凸起不被裁剪 */
.segments-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 28px 28px 22px;
  background: linear-gradient(180deg, #f8fafd 0%, #f3f6fb 100%);
}

.empty-box {
  padding: 60px 16px;
  text-align: center;
  background: #ffffff;
  border-radius: 12px;
  border: 1px dashed #e2e8f0;
}

.transcript-timeline {
  display: flex;
  flex-direction: column;
  max-width: 1040px;
  margin: 0 auto;
}

/* 单条时间轴节点行 */
.timeline-item {
  position: relative;
  display: flex;
  align-items: stretch;
  padding-bottom: 18px;
  transition: opacity 0.25s ease;
  z-index: 1;
}

.timeline-item.is-last {
  padding-bottom: 6px;
}

.timeline-item.highlighted,
.timeline-item.is-focused {
  z-index: 12;
}

/* 1. 左侧时间坐标 */
.timeline-time-col {
  width: 78px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 9px;
  padding-right: 10px;
  gap: 3px;
}

.time-anchor-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #ffffff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition:
    transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.22s ease,
    color 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}

.time-play-icon {
  font-size: 10px;
  opacity: 0.7;
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.time-anchor-btn:hover {
  background: var(--speaker-color, #1677ff);
  border-color: var(--speaker-color, #1677ff);
  color: #ffffff;
}

.duration-sub {
  font-size: 11px;
  color: #8c96a6;
  padding-right: 4px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* 2. 中间时间轴竖线与圆点 */
.timeline-axis {
  position: relative;
  width: 26px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12px;
}

.axis-line-top,
.axis-line-bottom {
  width: 2px;
  background: linear-gradient(180deg, #dbe3ef 0%, #d4deec 100%);
  transition: background 0.25s ease;
}

.axis-line-top {
  height: 14px;
  flex-shrink: 0;
}

.axis-line-bottom {
  flex: 1;
  min-height: 16px;
}

.timeline-item.is-first .axis-line-top {
  opacity: 0;
}

.timeline-item.is-last .axis-line-bottom {
  opacity: 0;
}

.timeline-dot-btn {
  position: relative;
  z-index: 2;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.timeline-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid var(--speaker-color, #1677ff);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.3s ease;
}

.axis-connector {
  position: absolute;
  left: 20px;
  top: 21px;
  width: 12px;
  height: 2px;
  border-radius: 2px;
  background: var(--speaker-color, #1677ff);
  opacity: 0;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.26s ease, opacity 0.22s ease;
}

/* 3. 说话人头像 */
.timeline-avatar-col {
  flex-shrink: 0;
  padding-top: 2px;
  margin-right: 14px;
}

.speaker-avatar-wrap {
  position: relative;
  display: inline-flex;
  border-radius: 50%;
  transition:
    transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.3s ease;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1), 0 0 0 2px #ffffff;
}

.speaker-avatar {
  color: #ffffff;
  font-weight: 600;
  user-select: none;
  border: none;
}

.playing-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #52c41a;
  border: 2px solid #ffffff;
  animation: pulse-playing 1.5s infinite ease-in-out;
}

@keyframes pulse-playing {
  0%, 100% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.5);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 0 5px rgba(82, 196, 26, 0);
  }
}

/* 4. 气泡对话框 */
.speech-bubble {
  --bubble-bg: #ffffff;
  --bubble-border: #e5ebf3;
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  border-radius: 6px 16px 16px 16px;
  padding: 12px 16px 10px 16px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transform: translate3d(0, 0, 0) scale(1);
  transform-origin: left center;
  will-change: transform, box-shadow;
  transition:
    transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.25s ease,
    background-color 0.25s ease;
}

/* 气泡左侧指向头像的尖角 */
.speech-bubble::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 16px;
  width: 10px;
  height: 10px;
  background: var(--bubble-bg);
  border-left: 1px solid var(--bubble-border);
  border-bottom: 1px solid var(--bubble-border);
  border-bottom-left-radius: 2px;
  transform: rotate(45deg);
  transition: background-color 0.25s ease, border-color 0.25s ease;
  z-index: 1;
}

.bubble-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.bubble-speaker-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.speaker-name-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.speaker-color-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--speaker-color, #1677ff);
  flex-shrink: 0;
}

.speaker-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-main, #1f2329);
  transition: color 0.2s ease;
}

.speaker-name-btn:hover .speaker-name {
  color: var(--speaker-color, #1677ff);
}

.role-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.self-badge {
  color: #1677ff;
  background: #e6f4ff;
  border: 1px solid #bae0ff;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 500;
}

.revised-pill {
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
}

.evidence-pill {
  color: #0958d9;
  background: #e6f4ff;
  border: 1px solid #91caff;
}

.playing-pill {
  color: #389e0d;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.bubble-time-group {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.bubble-time-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #1677ff;
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  border-radius: 999px;
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  transition: all 0.2s ease;
}

.bubble-time-pill:hover {
  background: #1677ff;
  border-color: #1677ff;
  color: #ffffff;
}

.pill-play-icon {
  font-size: 10px;
}

.bubble-body {
  padding-right: 4px;
}

.transcript-text {
  font-size: 14.5px;
  color: var(--text-main, #1f2329);
  line-height: 1.7;
  margin: 0;
  word-break: break-word;
  white-space: pre-wrap;
}

.kw-highlight {
  background: #ffe58f;
  color: #1f2329;
  padding: 0 2px;
  border-radius: 3px;
}

.bubble-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px dashed #f0f3f8;
}

.item-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  opacity: 0.68;
  transition: opacity 0.22s ease;
}

.action-btn {
  font-size: 12px;
  color: #5c6675;
  padding: 0 6px;
  height: 24px;
  border-radius: 6px;
}

.action-btn:hover {
  color: #1677ff;
  background: #f0f7ff;
}

/* =====================================================
   核心交互：鼠标放上时间轴时该句发言动效凸起
   ===================================================== */
@media (hover: hover) {
  .transcript-timeline:hover .timeline-item:not(:hover):not(.highlighted):not(.is-focused) {
    opacity: 0.82;
  }

  .timeline-item:hover {
    z-index: 15;
    opacity: 1;
  }

  .timeline-item:hover .time-anchor-btn {
    background: var(--speaker-color, #1677ff);
    border-color: var(--speaker-color, #1677ff);
    color: #ffffff;
    transform: translateX(-3px) scale(1.06);
    box-shadow: 0 4px 12px var(--speaker-glow, rgba(22, 119, 255, 0.24));
  }

  .timeline-item:hover .time-play-icon {
    opacity: 1;
    transform: translateX(1px);
  }

  .timeline-item:hover .timeline-dot {
    background: var(--speaker-color, #1677ff);
    border-color: #ffffff;
    transform: scale(1.48);
    box-shadow:
      0 0 0 5px var(--speaker-glow, rgba(22, 119, 255, 0.24)),
      0 2px 8px var(--speaker-glow, rgba(22, 119, 255, 0.28));
  }

  .timeline-item:hover .axis-connector {
    opacity: 0.85;
    transform: scaleX(1);
  }

  .timeline-item:hover .speaker-avatar-wrap {
    transform: translateY(-3px) scale(1.12);
    box-shadow:
      0 8px 18px var(--speaker-glow, rgba(22, 119, 255, 0.24)),
      0 0 0 3px #ffffff,
      0 0 0 5px var(--speaker-tint-border, #91caff);
  }

  .timeline-item:hover .speech-bubble {
    --bubble-bg: #ffffff;
    --bubble-border: var(--speaker-tint-border, #69b1ff);
    transform: translate3d(6px, -4px, 0) scale(1.018);
    box-shadow:
      0 18px 36px -10px rgba(15, 23, 42, 0.14),
      0 8px 18px -6px var(--speaker-glow, rgba(22, 119, 255, 0.24)),
      0 0 0 1px var(--speaker-tint-border, rgba(22, 119, 255, 0.25));
  }

  .timeline-item:hover .item-actions {
    opacity: 1;
  }
}

/* 本人发言微区分、证据链高亮、正在播放与移动端点击聚焦凸起状态 */
.timeline-item.is-self .speech-bubble {
  --bubble-bg: #f9fcff;
  --bubble-border: #dceaff;
}

.timeline-item.is-focused .time-anchor-btn,
.timeline-item.highlighted .time-anchor-btn,
.timeline-item.is-playing .time-anchor-btn {
  background: var(--speaker-color, #1677ff);
  border-color: var(--speaker-color, #1677ff);
  color: #ffffff;
}

.timeline-item.is-focused .timeline-dot,
.timeline-item.highlighted .timeline-dot,
.timeline-item.is-playing .timeline-dot {
  background: var(--speaker-color, #1677ff);
  border-color: #ffffff;
  transform: scale(1.38);
  box-shadow: 0 0 0 5px var(--speaker-glow, rgba(22, 119, 255, 0.24));
}

.timeline-item.is-focused .axis-connector,
.timeline-item.highlighted .axis-connector {
  opacity: 0.9;
  transform: scaleX(1);
}

.timeline-item.is-focused .speaker-avatar-wrap,
.timeline-item.highlighted .speaker-avatar-wrap {
  transform: translateY(-2px) scale(1.08);
  box-shadow:
    0 6px 14px var(--speaker-glow, rgba(22, 119, 255, 0.22)),
    0 0 0 2px #ffffff,
    0 0 0 4px var(--speaker-tint-border, #91caff);
}

.timeline-item.is-focused .speech-bubble {
  --bubble-bg: #ffffff;
  --bubble-border: var(--speaker-tint-border, #69b1ff);
  transform: translate3d(4px, -3px, 0) scale(1.015);
  box-shadow:
    0 14px 28px -8px rgba(15, 23, 42, 0.14),
    0 6px 14px -4px var(--speaker-glow, rgba(22, 119, 255, 0.24));
}

.timeline-item.highlighted .speech-bubble {
  --bubble-bg: #f0f7ff;
  --bubble-border: #1677ff;
  transform: translate3d(5px, -3px, 0) scale(1.015);
  box-shadow:
    0 14px 30px -8px rgba(22, 119, 255, 0.24),
    0 0 0 2px rgba(22, 119, 255, 0.16);
}

.timeline-item.is-playing .speech-bubble {
  --bubble-bg: #f6ffed;
  --bubble-border: #73d13d;
  box-shadow: 0 8px 20px -6px rgba(82, 196, 26, 0.2);
}

.timeline-item.is-focused .item-actions,
.timeline-item.highlighted .item-actions {
  opacity: 1;
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #e5e6eb);
  background: #ffffff;
  flex-shrink: 0;
}

.original-quote-box {
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary, #86909c);
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
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--text-tertiary, #8c8c8c);
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

/* 尊重系统减弱动效偏好 */
@media (prefers-reduced-motion: reduce) {
  .timeline-item,
  .time-anchor-btn,
  .timeline-dot,
  .speaker-avatar-wrap,
  .speech-bubble,
  .axis-connector {
    transition-duration: 0.05s !important;
    animation: none !important;
  }
}

/* =====================================================
   移动端与窄屏适配 (<= 768px)
   ===================================================== */
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

  .panel-title {
    font-size: 15px;
  }

  .header-actions {
    flex-wrap: wrap;
    gap: 8px;
  }

  .speaker-select {
    flex: 1 1 120px;
    width: auto;
  }

  .keyword-search {
    flex: 2 1 160px;
    width: auto;
  }

  .refresh-btn {
    flex: 0 0 auto;
  }

  .segments-container {
    padding: 14px 16px 20px 10px;
  }

  .timeline-item {
    padding-bottom: 14px;
  }

  /* 移动端隐藏左侧独立时间列，时间胶囊保留在气泡右上角 */
  .timeline-time-col {
    display: none;
  }

  .timeline-axis {
    width: 18px;
    margin-right: 8px;
  }

  .axis-line-top {
    height: 12px;
  }

  .timeline-dot-btn {
    width: 14px;
    height: 14px;
  }

  .timeline-dot {
    width: 10px;
    height: 10px;
    border-width: 2.5px;
  }

  .axis-connector {
    display: none;
  }

  .timeline-avatar-col {
    padding-top: 2px;
    margin-right: 10px;
  }

  .speech-bubble {
    border-radius: 6px 14px 14px 14px;
    padding: 10px 12px 8px 12px;
  }

  .speech-bubble::before {
    left: -5px;
    top: 13px;
    width: 9px;
    height: 9px;
  }

  .bubble-header {
    gap: 6px;
  }

  .speaker-name {
    font-size: 13px;
  }

  .bubble-time-pill {
    padding: 2px 7px;
    font-size: 10.5px;
  }

  .transcript-text {
    font-size: 13.5px;
    line-height: 1.62;
  }

  .item-actions {
    width: 100%;
    justify-content: flex-end;
    opacity: 1;
    gap: 4px;
  }

  .action-btn {
    height: 28px;
    padding: 0 8px;
    font-size: 12px;
  }

  .timeline-item:active .speech-bubble {
    transform: translate3d(2px, -2px, 0) scale(1.008);
  }

  .timeline-item.is-focused .speech-bubble {
    transform: translate3d(3px, -3px, 0) scale(1.012);
  }

  .panel-footer {
    padding: 10px 12px;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .segments-container {
    padding: 12px 12px 18px 8px;
  }

  .timeline-axis {
    width: 14px;
    margin-right: 6px;
  }

  .timeline-avatar-col {
    margin-right: 8px;
  }

  .speech-bubble {
    padding: 9px 10px 7px 10px;
  }

  .bubble-header {
    align-items: flex-start;
  }

  .refresh-btn .btn-label {
    display: none;
  }
}
</style>
