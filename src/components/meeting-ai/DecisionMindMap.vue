<template>
  <div class="decision-mind-map-wrapper" :class="{ 'is-fullscreen': isFullscreen, 'is-mobile': isMobileView }">
    <!-- 脑图顶部控制工具栏 -->
    <div class="mindmap-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">
          <ApartmentOutlined style="color: #1677ff; margin-right: 6px" />
          <span>决策思维导图</span>
        </span>

        <!-- 布局模式切换 -->
        <a-radio-group v-model:value="layoutMode" size="small" button-style="solid" class="layout-switch">
          <a-radio-button value="horizontal">
            <BranchesOutlined /> 水平脑图
          </a-radio-button>
          <a-radio-button value="vertical">
            <NodeIndexOutlined /> 纵向树图
          </a-radio-button>
        </a-radio-group>
      </div>

      <div class="toolbar-right">
        <!-- 缩放控制（仅在水平脑图画布模式下启用） -->
        <div v-if="layoutMode === 'horizontal'" class="zoom-controls">
          <a-button size="small" @click="handleZoomOut" title="缩小脑图">
            <MinusOutlined />
          </a-button>
          <span class="zoom-text">{{ Math.round(zoomScale * 100) }}%</span>
          <a-button size="small" @click="handleZoomIn" title="放大脑图">
            <PlusOutlined />
          </a-button>
          <a-button size="small" @click="resetZoomAndCenter" title="还原 100%">
            1:1
          </a-button>
        </div>

        <!-- 展开/折叠全部 -->
        <a-button size="small" @click="toggleAllBranches">
          {{ allExpanded ? '收起全部' : '展开全部' }}
        </a-button>

        <!-- 查看演进追踪 -->
        <a-button size="small" type="primary" ghost @click="emit('viewEvolution', decision)">
          <HistoryOutlined /> 演进追踪
        </a-button>

        <!-- 全屏模式切换 -->
        <a-button size="small" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏展示'">
          <component :is="isFullscreen ? FullscreenExitOutlined : FullscreenOutlined" />
        </a-button>
      </div>
    </div>

    <!-- 脑图主容器 -->
    <div
      class="mindmap-viewport"
      ref="viewportRef"
      :class="{ 'is-grabbing': isDragging }"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- 模式 A：水平思维导图画布模式 -->
      <div
        v-if="layoutMode === 'horizontal'"
        class="mindmap-canvas horizontal-canvas"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
          transformOrigin: 'top left'
        }"
      >
        <!-- SVG 动态贝塞尔连接曲线层 -->
        <svg class="mindmap-svg-layer" :style="{ width: svgWidth + 'px', height: svgHeight + 'px' }">
          <g>
            <path
              v-for="line in horizontalLines"
              :key="line.id"
              :d="line.d"
              :stroke="line.stroke"
              :stroke-width="line.strokeWidth || 2"
              fill="none"
              stroke-linecap="round"
            />
          </g>
        </svg>

        <!-- 脑图中心主节点（决策主题） -->
        <div class="root-node-container" ref="rootNodeRef">
          <div class="mindmap-node root-node" :class="`status-${decision.status?.toLowerCase()}`">
            <div class="node-badge-row">
              <span class="root-pill">决策议题</span>
              <a-tag :color="getStatusTagColor(decision.status)" class="status-tag">
                <component :is="getStatusIcon(decision.status)" />
                {{ getStatusText(decision.status) }}
              </a-tag>
            </div>

            <h3 class="root-topic-text">{{ decision.topic || decision.content || '未命名讨论决策' }}</h3>

            <div class="root-meta-row" v-if="decision.proposer || decision.decisionMaker">
              <span v-if="decision.proposer" class="node-meta">
                提议人: <strong>{{ decision.proposer }}</strong>
              </span>
              <span v-if="decision.decisionMaker" class="node-meta">
                定案人: <strong>{{ decision.decisionMaker }}</strong>
              </span>
            </div>

            <!-- 中心节点底部快捷动作条 -->
            <div class="root-actions-bar" v-if="canOperate">
              <a-button
                v-if="decision.status !== 'CONFIRMED'"
                type="primary"
                size="small"
                class="action-btn btn-confirm"
                @click.stop="emit('confirm', decision)"
              >
                <CheckOutlined /> 确认生效
              </a-button>

              <a-button
                v-if="decision.status !== 'DEFERRED' && decision.status !== 'CONFIRMED'"
                type="default"
                size="small"
                class="action-btn"
                @click.stop="emit('defer', decision)"
              >
                <ClockCircleOutlined /> 暂缓
              </a-button>

              <a-button
                v-if="decision.status !== 'REJECTED'"
                danger
                type="text"
                size="small"
                class="action-btn"
                @click.stop="emit('reject', decision)"
              >
                <CloseOutlined /> 否决
              </a-button>
            </div>
          </div>
        </div>

        <!-- 脑图发散分支区域 -->
        <div class="branches-wrapper horizontal-branches" ref="branchesRef">
          <!-- 分支 1：候选方案 (Candidate Options) -->
          <div class="branch-group group-candidates" ref="branchCandidatesRef">
            <div
              class="branch-header"
              :class="{ collapsed: collapsed.candidates }"
              @click="toggleBranch('candidates')"
            >
              <div class="branch-icon-wrap" style="background: #e6f4ff; color: #1677ff">
                <BulbOutlined />
              </div>
              <span class="branch-title">候选方案</span>
              <span class="branch-count">({{ candidateList.length }})</span>
              <button class="branch-toggle-btn" :title="collapsed.candidates ? '展开' : '折叠'">
                <component :is="collapsed.candidates ? PlusOutlined : MinusOutlined" />
              </button>
            </div>

            <div v-show="!collapsed.candidates" class="branch-leafs">
              <div v-if="candidateList.length === 0" class="leaf-empty">
                暂无候选备选方案
              </div>
              <div
                v-for="(opt, i) in candidateList"
                :key="i"
                class="mindmap-leaf leaf-candidate"
              >
                <span class="leaf-index">{{ i + 1 }}</span>
                <span class="leaf-text">{{ opt }}</span>
              </div>
            </div>
          </div>

          <!-- 分支 2：支持理由 (Pros) -->
          <div class="branch-group group-pros" ref="branchProsRef">
            <div
              class="branch-header"
              :class="{ collapsed: collapsed.pros }"
              @click="toggleBranch('pros')"
            >
              <div class="branch-icon-wrap" style="background: #f6ffed; color: #52c41a">
                <LikeOutlined />
              </div>
              <span class="branch-title">支持理由</span>
              <span class="branch-count">({{ proList.length }})</span>
              <button class="branch-toggle-btn">
                <component :is="collapsed.pros ? PlusOutlined : MinusOutlined" />
              </button>
            </div>

            <div v-show="!collapsed.pros" class="branch-leafs">
              <div v-if="proList.length === 0" class="leaf-empty">
                讨论中暂未明确提出支持理由
              </div>
              <div
                v-for="(pro, i) in proList"
                :key="i"
                class="mindmap-leaf leaf-pro"
              >
                <span class="leaf-bullet">✓</span>
                <span class="leaf-text">{{ pro }}</span>
              </div>
            </div>
          </div>

          <!-- 分支 3：反对理由与风险 (Cons & Risks) -->
          <div class="branch-group group-cons" ref="branchConsRef">
            <div
              class="branch-header"
              :class="{ collapsed: collapsed.cons }"
              @click="toggleBranch('cons')"
            >
              <div class="branch-icon-wrap" style="background: #fff2e8; color: #fa541c">
                <WarningOutlined />
              </div>
              <span class="branch-title">反对意见与风险</span>
              <span class="branch-count">({{ conList.length }})</span>
              <button class="branch-toggle-btn">
                <component :is="collapsed.cons ? PlusOutlined : MinusOutlined" />
              </button>
            </div>

            <div v-show="!collapsed.cons" class="branch-leafs">
              <div v-if="conList.length === 0" class="leaf-empty">
                暂未记录反对或风险限制
              </div>
              <div
                v-for="(con, i) in conList"
                :key="i"
                class="mindmap-leaf leaf-con"
              >
                <span class="leaf-bullet">!</span>
                <span class="leaf-text">{{ con }}</span>
              </div>
            </div>
          </div>

          <!-- 分支 4：决议正文与落地执行 (Resolution & Assignee) -->
          <div class="branch-group group-action" ref="branchActionRef">
            <div
              class="branch-header"
              :class="{ collapsed: collapsed.action }"
              @click="toggleBranch('action')"
            >
              <div class="branch-icon-wrap" style="background: #f9f0ff; color: #722ed1">
                <CheckSquareOutlined />
              </div>
              <span class="branch-title">落地执行与推进</span>
              <button class="branch-toggle-btn">
                <component :is="collapsed.action ? PlusOutlined : MinusOutlined" />
              </button>
            </div>

            <div v-show="!collapsed.action" class="branch-leafs">
              <!-- 决议正文 -->
              <div class="mindmap-leaf leaf-action" v-if="decision.content">
                <div class="leaf-header">
                  <span class="leaf-tag">定案决议</span>
                </div>
                <p class="leaf-body">{{ decision.content }}</p>
              </div>

              <!-- 责任人 & 截止时间 -->
              <div class="mindmap-leaf leaf-task" v-if="decision.assigneeName || decision.dueTime">
                <div class="task-row" v-if="decision.assigneeName">
                  <UserOutlined style="color: #1677ff" />
                  <span class="task-label">指派负责人:</span>
                  <span class="task-val font-semibold">{{ decision.assigneeName }}</span>
                </div>
                <div class="task-row" v-if="decision.dueTime">
                  <CalendarOutlined style="color: #fa8c16" />
                  <span class="task-label">截止时间:</span>
                  <span class="task-val mono">{{ formatDueTime(decision.dueTime) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 分支 5：论据发言与转写溯源 (Evidence Quotes) -->
          <div class="branch-group group-evidence" ref="branchEvidenceRef">
            <div
              class="branch-header"
              :class="{ collapsed: collapsed.evidence }"
              @click="toggleBranch('evidence')"
            >
              <div class="branch-icon-wrap" style="background: #e6fffb; color: #13c2c2">
                <FileTextOutlined />
              </div>
              <span class="branch-title">事实论据与引言</span>
              <button class="branch-toggle-btn">
                <component :is="collapsed.evidence ? PlusOutlined : MinusOutlined" />
              </button>
            </div>

            <div v-show="!collapsed.evidence" class="branch-leafs">
              <div v-if="!decision.evidenceQuote && !decision.rationale" class="leaf-empty">
                暂未提取出对应的发言引言
              </div>

              <div class="mindmap-leaf leaf-evidence" v-if="decision.evidenceQuote">
                <div class="evidence-quote-content">
                  "{{ decision.evidenceQuote }}"
                </div>
                <a-button
                  type="link"
                  size="small"
                  class="leaf-trace-link"
                  @click="emit('viewEvidence', decision)"
                >
                  <SearchOutlined /> 转写溯源片段
                </a-button>
              </div>

              <div class="mindmap-leaf leaf-rationale" v-if="decision.rationale">
                <span class="leaf-tag">背景立论:</span>
                <span class="rationale-text">{{ decision.rationale }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 模式 B：移动端优先的响应式纵向树状导图 (Vertical Responsive Tree) -->
      <div v-else class="mindmap-canvas vertical-tree-canvas">
        <!-- 树顶中心主题卡片 -->
        <div class="v-tree-root" :class="`status-${decision.status?.toLowerCase()}`">
          <div class="v-root-head">
            <span class="root-pill">决策议题</span>
            <a-tag :color="getStatusTagColor(decision.status)">
              <component :is="getStatusIcon(decision.status)" />
              {{ getStatusText(decision.status) }}
            </a-tag>
          </div>
          <h3 class="v-root-title">{{ decision.topic || decision.content || '未命名讨论决策' }}</h3>
          <div class="v-root-meta" v-if="decision.proposer || decision.decisionMaker">
            <span v-if="decision.proposer">提议: <strong>{{ decision.proposer }}</strong></span>
            <span v-if="decision.decisionMaker">定案: <strong>{{ decision.decisionMaker }}</strong></span>
          </div>

          <!-- 操作按钮栏 -->
          <div class="v-root-actions" v-if="canOperate">
            <a-button
              v-if="decision.status !== 'CONFIRMED'"
              type="primary"
              size="small"
              @click.stop="emit('confirm', decision)"
            >
              <CheckOutlined /> 确认生效
            </a-button>
            <a-button
              v-if="decision.status !== 'DEFERRED' && decision.status !== 'CONFIRMED'"
              size="small"
              @click.stop="emit('defer', decision)"
            >
              <ClockCircleOutlined /> 暂缓
            </a-button>
            <a-button
              v-if="decision.status !== 'REJECTED'"
              danger
              type="text"
              size="small"
              @click.stop="emit('reject', decision)"
            >
              <CloseOutlined /> 否决
            </a-button>
          </div>
        </div>

        <div class="v-tree-stem-line"></div>

        <!-- 纵向分支列表 -->
        <div class="v-tree-branches">
          <!-- 分支 1：候选方案 -->
          <div class="v-branch-card" :class="{ 'is-open': !collapsed.candidates }">
            <div class="v-branch-head" @click="toggleBranch('candidates')">
              <div class="v-head-left">
                <span class="v-icon-badge" style="background: #e6f4ff; color: #1677ff">
                  <BulbOutlined />
                </span>
                <span class="v-head-title">候选方案 ({{ candidateList.length }})</span>
              </div>
              <component :is="collapsed.candidates ? DownOutlined : UpOutlined" class="v-head-arrow" />
            </div>
            <div v-show="!collapsed.candidates" class="v-branch-body">
              <div v-if="candidateList.length === 0" class="leaf-empty">暂无候选方案</div>
              <div v-for="(opt, i) in candidateList" :key="i" class="v-leaf-item">
                <span class="leaf-index">{{ i + 1 }}</span>
                <span class="leaf-text">{{ opt }}</span>
              </div>
            </div>
          </div>

          <!-- 分支 2：支持理由 -->
          <div class="v-branch-card" :class="{ 'is-open': !collapsed.pros }">
            <div class="v-branch-head" @click="toggleBranch('pros')">
              <div class="v-head-left">
                <span class="v-icon-badge" style="background: #f6ffed; color: #52c41a">
                  <LikeOutlined />
                </span>
                <span class="v-head-title">支持理由 ({{ proList.length }})</span>
              </div>
              <component :is="collapsed.pros ? DownOutlined : UpOutlined" class="v-head-arrow" />
            </div>
            <div v-show="!collapsed.pros" class="v-branch-body">
              <div v-if="proList.length === 0" class="leaf-empty">暂无支持理由记录</div>
              <div v-for="(pro, i) in proList" :key="i" class="v-leaf-item pro-item">
                <span class="pro-bullet">✓</span>
                <span class="leaf-text">{{ pro }}</span>
              </div>
            </div>
          </div>

          <!-- 分支 3：反对理由与风险 -->
          <div class="v-branch-card" :class="{ 'is-open': !collapsed.cons }">
            <div class="v-branch-head" @click="toggleBranch('cons')">
              <div class="v-head-left">
                <span class="v-icon-badge" style="background: #fff2e8; color: #fa541c">
                  <WarningOutlined />
                </span>
                <span class="v-head-title">反对意见与风险 ({{ conList.length }})</span>
              </div>
              <component :is="collapsed.cons ? DownOutlined : UpOutlined" class="v-head-arrow" />
            </div>
            <div v-show="!collapsed.cons" class="v-branch-body">
              <div v-if="conList.length === 0" class="leaf-empty">暂未提出反对或风险</div>
              <div v-for="(con, i) in conList" :key="i" class="v-leaf-item con-item">
                <span class="con-bullet">!</span>
                <span class="leaf-text">{{ con }}</span>
              </div>
            </div>
          </div>

          <!-- 分支 4：决议推进与责任人 -->
          <div class="v-branch-card" :class="{ 'is-open': !collapsed.action }">
            <div class="v-branch-head" @click="toggleBranch('action')">
              <div class="v-head-left">
                <span class="v-icon-badge" style="background: #f9f0ff; color: #722ed1">
                  <CheckSquareOutlined />
                </span>
                <span class="v-head-title">落地执行与推进</span>
              </div>
              <component :is="collapsed.action ? DownOutlined : UpOutlined" class="v-head-arrow" />
            </div>
            <div v-show="!collapsed.action" class="v-branch-body">
              <div v-if="decision.content" class="v-action-content">
                <strong>最终决议:</strong> {{ decision.content }}
              </div>
              <div class="v-task-pills" v-if="decision.assigneeName || decision.dueTime">
                <span v-if="decision.assigneeName" class="task-pill">
                  <UserOutlined /> {{ decision.assigneeName }}
                </span>
                <span v-if="decision.dueTime" class="task-pill">
                  <CalendarOutlined /> {{ formatDueTime(decision.dueTime) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 分支 5：论据发言与引言 -->
          <div class="v-branch-card" :class="{ 'is-open': !collapsed.evidence }">
            <div class="v-branch-head" @click="toggleBranch('evidence')">
              <div class="v-head-left">
                <span class="v-icon-badge" style="background: #e6fffb; color: #13c2c2">
                  <FileTextOutlined />
                </span>
                <span class="v-head-title">事实论据与发言引言</span>
              </div>
              <component :is="collapsed.evidence ? DownOutlined : UpOutlined" class="v-head-arrow" />
            </div>
            <div v-show="!collapsed.evidence" class="v-branch-body">
              <div v-if="decision.evidenceQuote" class="v-quote-box">
                "{{ decision.evidenceQuote }}"
              </div>
              <div v-if="decision.rationale" class="v-rationale-box">
                <strong>立论背景:</strong> {{ decision.rationale }}
              </div>
              <a-button
                v-if="decision.evidenceQuote || decision.sourceSegmentIds"
                type="link"
                size="small"
                class="v-trace-btn"
                @click="emit('viewEvidence', decision)"
              >
                <SearchOutlined /> 查看转写逐字证据链
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  ApartmentOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  MinusOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  HistoryOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  BulbOutlined,
  LikeOutlined,
  WarningOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  SearchOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const props = defineProps({
  decision: {
    type: Object,
    required: true
  },
  canOperate: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['confirm', 'reject', 'defer', 'viewEvidence', 'viewEvolution'])

// 视口与全屏控制
const viewportRef = ref(null)
const rootNodeRef = ref(null)
const branchesRef = ref(null)
const branchCandidatesRef = ref(null)
const branchProsRef = ref(null)
const branchConsRef = ref(null)
const branchActionRef = ref(null)
const branchEvidenceRef = ref(null)

const isFullscreen = ref(false)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

const isMobileView = computed(() => windowWidth.value < 768)

// 布局模式：'horizontal' | 'vertical'
const layoutMode = ref('horizontal')

// 监听移动端屏幕大小，自动切换默认视图
watch(
  isMobileView,
  (mobile) => {
    if (mobile) {
      layoutMode.value = 'vertical'
    } else {
      layoutMode.value = 'horizontal'
    }
  },
  { immediate: true }
)

// 折叠状态控制
const collapsed = reactive({
  candidates: false,
  pros: false,
  cons: false,
  action: false,
  evidence: false
})

const allExpanded = computed(() => {
  return (
    !collapsed.candidates &&
    !collapsed.pros &&
    !collapsed.cons &&
    !collapsed.action &&
    !collapsed.evidence
  )
})

function toggleBranch(branchKey) {
  collapsed[branchKey] = !collapsed[branchKey]
  nextTick(() => {
    updateSvgCurves()
  })
}

function toggleAllBranches() {
  const target = allExpanded.value
  collapsed.candidates = target
  collapsed.pros = target
  collapsed.cons = target
  collapsed.action = target
  collapsed.evidence = target
  nextTick(() => {
    updateSvgCurves()
  })
}

// 画布平移与缩放 (Pan & Zoom)
const panX = ref(60)
const panY = ref(60)
const zoomScale = ref(1)
const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let panStartX = 0
let panStartY = 0

// 触控手势控制
let lastTouchDist = 0

function handleMouseDown(e) {
  if (layoutMode.value !== 'horizontal') return
  // 忽略表单和按钮点击
  if (e.target.closest('button') || e.target.closest('.ant-btn') || e.target.closest('input')) return
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  panStartX = panX.value
  panStartY = panY.value
}

function handleMouseMove(e) {
  if (!isDragging.value) return
  panX.value = panStartX + (e.clientX - dragStartX)
  panY.value = panStartY + (e.clientY - dragStartY)
}

function handleMouseUp() {
  isDragging.value = false
}

function handleTouchStart(e) {
  if (layoutMode.value !== 'horizontal') return
  if (e.touches.length === 1) {
    const t = e.touches[0]
    isDragging.value = true
    dragStartX = t.clientX
    dragStartY = t.clientY
    panStartX = panX.value
    panStartY = panY.value
  } else if (e.touches.length === 2) {
    // 双指手势
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  }
}

function handleTouchMove(e) {
  if (layoutMode.value !== 'horizontal') return
  if (e.touches.length === 1 && isDragging.value) {
    const t = e.touches[0]
    panX.value = panStartX + (t.clientX - dragStartX)
    panY.value = panStartY + (t.clientY - dragStartY)
  } else if (e.touches.length === 2) {
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    if (lastTouchDist > 0) {
      const delta = dist / lastTouchDist
      zoomScale.value = Math.min(Math.max(zoomScale.value * delta, 0.4), 2.2)
    }
    lastTouchDist = dist
  }
}

function handleTouchEnd() {
  isDragging.value = false
  lastTouchDist = 0
}

function handleZoomIn() {
  zoomScale.value = Math.min(zoomScale.value + 0.15, 2.2)
}

function handleZoomOut() {
  zoomScale.value = Math.max(zoomScale.value - 0.15, 0.4)
}

function resetZoomAndCenter() {
  zoomScale.value = 1
  panX.value = 60
  panY.value = 60
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

// 格式化解析分支数据
const candidateList = computed(() => {
  return parseStringOrArray(props.decision.candidateOptions)
})

const proList = computed(() => {
  return parseStringOrArray(props.decision.supportReasons)
})

const conList = computed(() => {
  return parseStringOrArray(props.decision.opposeReasons)
})

function parseStringOrArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed)
        if (Array.isArray(arr)) return arr.filter(Boolean)
      } catch (e) {}
    }
    // 分割换行、分号或逗号
    return trimmed
      .split(/[\n;；,，]+/)
      .map((s) => s.trim().replace(/^[-*•\d+.]\s*/, ''))
      .filter((s) => s.length > 0)
  }
  return [String(val)]
}

function formatDueTime(val) {
  if (!val) return ''
  return dayjs(val).format('MM-DD HH:mm')
}

function getStatusText(status) {
  switch (status) {
    case 'CONFIRMED':
      return '正式生效'
    case 'DISCUSSING':
      return '讨论中'
    case 'PROPOSED':
    case 'PENDING':
      return '提出方案'
    case 'DEFERRED':
      return '暂缓决定'
    case 'REJECTED':
      return '已否决'
    case 'CANCELLED':
      return '已取消'
    default:
      return status || '待定'
  }
}

function getStatusTagColor(status) {
  switch (status) {
    case 'CONFIRMED':
      return 'success'
    case 'DISCUSSING':
      return 'processing'
    case 'PROPOSED':
    case 'PENDING':
      return 'warning'
    case 'DEFERRED':
      return 'purple'
    case 'REJECTED':
      return 'default'
    case 'CANCELLED':
      return 'error'
    default:
      return 'default'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'CONFIRMED':
      return CheckCircleOutlined
    case 'DISCUSSING':
      return BranchesOutlined
    case 'PROPOSED':
    case 'PENDING':
      return BulbOutlined
    case 'DEFERRED':
      return ClockCircleOutlined
    case 'REJECTED':
      return CloseOutlined
    default:
      return BulbOutlined
  }
}

// 动态 SVG 贝塞尔曲线连接线计算
const svgWidth = ref(1600)
const svgHeight = ref(1200)
const horizontalLines = ref([])

function updateSvgCurves() {
  if (layoutMode.value !== 'horizontal') return
  if (!rootNodeRef.value || !branchesRef.value) return

  const rootEl = rootNodeRef.value
  const rootBox = rootEl.getBoundingClientRect()
  const canvasEl = rootEl.closest('.horizontal-canvas')
  if (!canvasEl) return

  const canvasBox = canvasEl.getBoundingClientRect()

  // 根节点右侧中心连接起点坐标（消除 scale 影响）
  const startX = (rootBox.right - canvasBox.left) / zoomScale.value
  const startY = (rootBox.top + rootBox.height / 2 - canvasBox.top) / zoomScale.value

  const branchRefs = [
    { ref: branchCandidatesRef.value, color: '#1677ff', id: 'candidates' },
    { ref: branchProsRef.value, color: '#52c41a', id: 'pros' },
    { ref: branchConsRef.value, color: '#fa541c', id: 'cons' },
    { ref: branchActionRef.value, color: '#722ed1', id: 'action' },
    { ref: branchEvidenceRef.value, color: '#13c2c2', id: 'evidence' }
  ]

  const lines = []
  let maxX = startX + 600
  let maxY = startY + 400

  branchRefs.forEach((b) => {
    if (!b.ref) return
    const headerEl = b.ref.querySelector('.branch-header')
    if (!headerEl) return

    const bBox = headerEl.getBoundingClientRect()
    const targetX = (bBox.left - canvasBox.left) / zoomScale.value
    const targetY = (bBox.top + bBox.height / 2 - canvasBox.top) / zoomScale.value

    if (targetX > maxX) maxX = targetX + 400
    if (targetY > maxY) maxY = targetY + 200

    // 生成光滑的三次贝塞尔曲线 M x1 y1 C cx1 y1, cx2 y2, x2 y2
    const dx = Math.max((targetX - startX) * 0.5, 40)
    const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`

    lines.push({
      id: b.id,
      d,
      stroke: b.color,
      strokeWidth: 2.2
    })
  })

  horizontalLines.value = lines
  svgWidth.value = Math.max(maxX + 100, 1600)
  svgHeight.value = Math.max(maxY + 100, 1200)
}

function onWindowResize() {
  windowWidth.value = window.innerWidth
  nextTick(() => {
    updateSvgCurves()
  })
}

watch(
  () => [props.decision, layoutMode.value],
  () => {
    nextTick(() => {
      setTimeout(() => {
        updateSvgCurves()
      }, 50)
    })
  },
  { deep: true }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }
  nextTick(() => {
    setTimeout(() => {
      updateSvgCurves()
    }, 100)
  })
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize)
  }
})
</script>

<style scoped>
.decision-mind-map-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 520px;
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
}

.decision-mind-map-wrapper.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  border-radius: 0;
}

/* 顶部工具栏 */
.mindmap-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  z-index: 10;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.zoom-controls {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px 4px;
  gap: 4px;
}

.zoom-text {
  font-size: 11px;
  font-family: monospace;
  color: #475569;
  min-width: 38px;
  text-align: center;
}

/* 视口与画布 */
.mindmap-viewport {
  flex: 1;
  position: relative;
  overflow: auto;
  cursor: grab;
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: #f8fafc;
  -webkit-overflow-scrolling: touch;
}

.mindmap-viewport.is-grabbing {
  cursor: grabbing;
}

/* 模式 A：水平脑图画布 */
.horizontal-canvas {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 1200px;
  min-height: 800px;
  display: flex;
  align-items: center;
  padding: 40px;
}

.mindmap-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

/* 根节点卡片 */
.root-node-container {
  position: relative;
  z-index: 2;
  margin-right: 90px;
  flex-shrink: 0;
}

.mindmap-node.root-node {
  width: 300px;
  background: #ffffff;
  border: 2px solid #1677ff;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s ease;
}

.root-node.status-confirmed {
  border-color: #52c41a;
  box-shadow: 0 4px 16px rgba(82, 196, 26, 0.15);
}

.root-node.status-discussing {
  border-color: #1677ff;
}

.root-node.status-proposed {
  border-color: #faad14;
}

.root-node.status-deferred {
  border-color: #722ed1;
}

.root-node.status-rejected {
  border-color: #bfbfbf;
  opacity: 0.85;
}

.node-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.root-pill {
  font-size: 11px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.root-topic-text {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
}

.root-meta-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: #64748b;
  border-top: 1px dashed #e2e8f0;
  padding-top: 8px;
}

.root-actions-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}

.action-btn {
  font-size: 11px;
}

/* 分支区域 */
.branches-wrapper.horizontal-branches {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.branch-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  width: fit-content;
}

.branch-header:hover {
  border-color: #94a3b8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.branch-icon-wrap {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.branch-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.branch-count {
  font-size: 11px;
  color: #64748b;
}

.branch-toggle-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 2px;
  display: flex;
  align-items: center;
  font-size: 11px;
}

.branch-leafs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 28px;
}

.leaf-empty {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
  padding: 4px 8px;
}

.mindmap-leaf {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  max-width: 480px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  line-height: 1.5;
  color: #334155;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.leaf-candidate {
  border-left: 3px solid #1677ff;
}

.leaf-index {
  font-size: 11px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.leaf-pro {
  border-left: 3px solid #52c41a;
}

.leaf-bullet {
  color: #52c41a;
  font-weight: bold;
  flex-shrink: 0;
}

.leaf-con {
  border-left: 3px solid #fa541c;
}

.leaf-action {
  border-left: 3px solid #722ed1;
  flex-direction: column;
  gap: 4px;
}

.leaf-tag {
  font-size: 11px;
  font-weight: 600;
  color: #722ed1;
  background: #f9f0ff;
  padding: 1px 6px;
  border-radius: 4px;
}

.leaf-task {
  border-left: 3px solid #fa8c16;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.leaf-evidence {
  border-left: 3px solid #13c2c2;
  flex-direction: column;
  gap: 6px;
}

.evidence-quote-content {
  font-style: italic;
  color: #475569;
}

.leaf-trace-link {
  font-size: 11px;
  padding: 0;
  align-self: flex-start;
}

.leaf-rationale {
  border-left: 3px solid #94a3b8;
  font-size: 12px;
}

/* 模式 B：移动端纵向树状导图 (Vertical Responsive Mode) */
.vertical-tree-canvas {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 16px 12px 32px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.v-tree-root {
  width: 100%;
  background: #ffffff;
  border: 2px solid #1677ff;
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 4px 14px rgba(22, 119, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.v-tree-root.status-confirmed {
  border-color: #52c41a;
}

.v-root-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.v-root-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  line-height: 1.5;
}

.v-root-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

.v-root-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  border-top: 1px dashed #e2e8f0;
  padding-top: 8px;
  margin-top: 4px;
}

.v-tree-stem-line {
  width: 2px;
  height: 24px;
  background: #cbd5e1;
}

.v-tree-branches {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.v-branch-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.v-branch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #ffffff;
  cursor: pointer;
  user-select: none;
}

.v-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.v-icon-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.v-head-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.v-head-arrow {
  font-size: 12px;
  color: #94a3b8;
}

.v-branch-body {
  padding: 10px 14px 14px 14px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.v-leaf-item {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  color: #334155;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.5;
}

.pro-item {
  border-left: 3px solid #52c41a;
}

.pro-bullet {
  color: #52c41a;
  font-weight: bold;
}

.con-item {
  border-left: 3px solid #fa541c;
}

.con-bullet {
  color: #fa541c;
  font-weight: bold;
}

.v-action-content {
  font-size: 13px;
  color: #1e293b;
  line-height: 1.5;
}

.v-task-pills {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.task-pill {
  font-size: 12px;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
  color: #475569;
}

.v-quote-box {
  background: #ffffff;
  border-left: 3px solid #13c2c2;
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  font-style: italic;
  color: #475569;
}

.v-rationale-box {
  font-size: 12px;
  color: #64748b;
}

.v-trace-btn {
  font-size: 12px;
  padding: 0;
  align-self: flex-start;
}

/* 移动端媒体查询微调 */
@media (max-width: 768px) {
  .mindmap-toolbar {
    padding: 8px 10px;
  }

  .toolbar-title {
    font-size: 13px;
  }

  .toolbar-right {
    gap: 6px;
  }

  .v-root-title {
    font-size: 15px;
  }

  .v-root-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
