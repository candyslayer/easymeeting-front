<template>
  <div v-if="chains && chains.length > 0" class="causal-chain-module" :class="{ compact }">
    <!-- 模块顶栏 -->
    <div class="module-header">
      <div class="header-left">
        <span class="module-badge">
          <ApartmentOutlined />
          跨域因果传导链
        </span>
        <a-tag color="geekblue" class="chain-count-tag">共 {{ chains.length }} 条传导链</a-tag>
        <span class="header-hint">突破单术语扁平关联，呈现「根因 → 中间指标波动 → 跨部门下游冲击」多跳推演</span>
      </div>

      <div class="header-right">
        <a-radio-group v-model:value="viewMode" size="small" button-style="solid" class="mode-switch">
          <a-radio-button value="graph">
            <BranchesOutlined /> 有向图
          </a-radio-button>
          <a-radio-button value="list">
            <UnorderedListOutlined /> 列表链路
          </a-radio-button>
        </a-radio-group>
      </div>
    </div>

    <!-- 多条独立因果传导链容器 -->
    <div class="chains-stack">
      <div
        v-for="(chain, cIdx) in chains"
        :key="chainKey(chain, cIdx)"
        class="chain-card"
        :class="`sev-${(chain.severity || 'MEDIUM').toLowerCase()}`"
      >
        <!-- 链路卡片头部 -->
        <div class="chain-card-head" @click="toggleCollapse(chainKey(chain, cIdx))">
          <div class="chain-title-row">
            <span class="chain-index">#{{ cIdx + 1 }}</span>
            <span class="chain-title">{{ chain.title }}</span>
            <a-tag :color="getSeverityColor(chain.severity)" size="small">
              {{ getSeverityText(chain.severity) }}
            </a-tag>
            <a-tag :color="getGroundingColor(chain.groundingType)" size="small">
              {{ getGroundingText(chain.groundingType) }}
            </a-tag>
            <span v-if="chain.overallConfidence != null" class="confidence-pill mono">
              参考把握 {{ Math.round(chain.overallConfidence * 100) }}%
            </span>
          </div>

          <div class="chain-head-actions">
            <div v-if="chain.domains && chain.domains.length" class="domains-arc">
              <template v-for="(d, di) in chain.domains" :key="d + di">
                <a-tag :color="getDomainColor(d)" class="domain-step-tag">{{ d }}</a-tag>
                <span v-if="di < chain.domains.length - 1" class="domain-arrow">→</span>
              </template>
            </div>
            <button type="button" class="collapse-btn">
              <DownOutlined :class="{ rotated: collapsedMap[chainKey(chain, cIdx)] }" />
            </button>
          </div>
        </div>

        <div v-show="!collapsedMap[chainKey(chain, cIdx)]" class="chain-card-body">
          <p v-if="chain.summary" class="chain-summary">{{ chain.summary }}</p>

          <!-- 视图 1：SVG 分层有向图 -->
          <div v-if="viewMode === 'graph'" class="graph-scroll-viewport">
            <div
              class="dag-canvas"
              :ref="(el) => setCanvasRef(chainKey(chain, cIdx), el)"
            >
              <!-- SVG 有向连线层 -->
              <svg
                class="dag-svg-layer"
                :width="canvasSizes[chainKey(chain, cIdx)]?.width || 600"
                :height="canvasSizes[chainKey(chain, cIdx)]?.height || 220"
              >
                <defs>
                  <marker
                    :id="`arrow-emp-${chainKey(chain, cIdx)}`"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#1677ff" />
                  </marker>
                  <marker
                    :id="`arrow-hyp-${chainKey(chain, cIdx)}`"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#fa8c16" />
                  </marker>
                </defs>

                <path
                  v-for="(line, li) in edgePaths[chainKey(chain, cIdx)] || []"
                  :key="li"
                  :d="line.d"
                  fill="none"
                  :stroke="line.hypothesis ? '#fa8c16' : '#1677ff'"
                  :stroke-width="line.hypothesis ? 1.8 : 2.1"
                  :stroke-dasharray="line.hypothesis ? '5,4' : undefined"
                  stroke-linecap="round"
                  :marker-end="line.hypothesis
                    ? `url(#arrow-hyp-${chainKey(chain, cIdx)})`
                    : `url(#arrow-emp-${chainKey(chain, cIdx)})`"
                />
              </svg>

              <!-- 边标签浮层（支持悬浮/点击看传导机理） -->
              <div class="dag-edge-labels-layer">
                <a-tooltip
                  v-for="(line, li) in edgePaths[chainKey(chain, cIdx)] || []"
                  :key="li"
                  placement="top"
                >
                  <template #title>
                    <div class="edge-tooltip">
                      <div>
                        <strong>{{ line.relationLabel }}</strong>
                        （{{ line.hypothesis ? '模型因果推演' : '原文实证传导' }}）
                      </div>
                      <div v-if="line.mechanism" class="tip-mech">{{ line.mechanism }}</div>
                      <div v-if="line.quote" class="tip-quote">原文: “{{ line.quote }}”</div>
                    </div>
                  </template>
                  <div
                    class="edge-pill"
                    :class="{ hypothesis: line.hypothesis }"
                    :style="{ left: `${line.mx}px`, top: `${line.my}px` }"
                  >
                    {{ line.relationLabel }}
                  </div>
                </a-tooltip>
              </div>

              <!-- 拓扑分层节点列 -->
              <div class="dag-columns">
                <div
                  v-for="(colNodes, colIdx) in computeChainColumns(chain)"
                  :key="colIdx"
                  class="dag-col"
                >
                  <div
                    v-for="node in colNodes"
                    :key="node.nodeId"
                    :ref="(el) => setNodeRef(chainKey(chain, cIdx), node.nodeId, el)"
                    class="dag-node"
                    :class="[
                      node.confirmed ? 'node-confirmed' : 'node-inferred',
                      `dir-${(node.changeDirection || 'NEUTRAL').toLowerCase()}`
                    ]"
                  >
                    <div class="node-top-row">
                      <a-tag :color="getDomainColor(node.domain)" class="node-domain-tag">
                        {{ node.domain || '综合' }}
                      </a-tag>
                      <span
                        class="dir-pill"
                        :class="`dir-${(node.changeDirection || 'NEUTRAL').toLowerCase()}`"
                      >
                        {{ formatDirectionBadge(node.changeDirection) }}
                      </span>
                    </div>

                    <div class="node-label">{{ node.label }}</div>

                    <div v-if="node.metricValue" class="node-metric mono">
                      {{ node.metricValue }}
                    </div>

                    <div v-if="node.canonicalTerm" class="node-term-link">
                      术语: <span class="mono">{{ node.canonicalTerm }}</span>
                    </div>

                    <div class="node-foot">
                      <a-tooltip v-if="node.segmentId" placement="bottom">
                        <template #title>
                          <div>
                            <div v-if="node.speakerName">{{ node.speakerName }} ({{ formatMs(node.startTimeMs) }})</div>
                            <div v-if="node.quote">“{{ node.quote }}”</div>
                          </div>
                        </template>
                        <button
                          type="button"
                          class="evidence-jump-btn"
                          @click.stop="emit('jumpEvidence', { segmentId: node.segmentId, startTime: node.startTimeMs })"
                        >
                          <EnvironmentOutlined />
                          {{ node.segmentId }}
                          <span v-if="node.speakerName">· {{ shortSpeaker(node.speakerName) }}</span>
                        </button>
                      </a-tooltip>
                      <span v-else class="inferred-badge">
                        {{ node.confirmed ? '输入陈述' : '模型推演' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 视图 2：链式因果步进列表（移动端友好 / 细节展开） -->
          <div v-else class="chain-list-view">
            <div
              v-for="(step, sIdx) in buildOrderedSteps(chain)"
              :key="step.node.nodeId"
              class="list-step-wrap"
            >
              <div
                class="list-node-box"
                :class="step.node.confirmed ? 'node-confirmed' : 'node-inferred'"
              >
                <div class="ln-head">
                  <div class="ln-left">
                    <span class="step-seq">{{ sIdx + 1 }}</span>
                    <a-tag :color="getDomainColor(step.node.domain)" size="small">
                      {{ step.node.domain || '综合' }}
                    </a-tag>
                    <strong class="ln-label">{{ step.node.label }}</strong>
                    <span
                      class="dir-pill"
                      :class="`dir-${(step.node.changeDirection || 'NEUTRAL').toLowerCase()}`"
                    >
                      {{ formatDirectionBadge(step.node.changeDirection) }}
                    </span>
                    <span v-if="step.node.metricValue" class="node-metric mono">
                      {{ step.node.metricValue }}
                    </span>
                  </div>
                  <div class="ln-right">
                    <a-tag v-if="step.node.canonicalTerm" color="default" size="small">
                      {{ step.node.canonicalTerm }}
                    </a-tag>
                    <a-tag :color="step.node.confirmed ? 'green' : 'orange'" size="small">
                      {{ step.node.confirmed ? '原文实证' : '模型推演' }}
                    </a-tag>
                  </div>
                </div>

                <div v-if="step.node.quote || step.node.segmentId" class="ln-quote-row">
                  <span class="quote-text" v-if="step.node.quote">“{{ step.node.quote }}”</span>
                  <button
                    v-if="step.node.segmentId"
                    type="button"
                    class="evidence-jump-btn"
                    @click="emit('jumpEvidence', { segmentId: step.node.segmentId, startTime: step.node.startTimeMs })"
                  >
                    <EnvironmentOutlined />
                    定位 [{{ step.node.segmentId }}]
                    <span v-if="step.node.speakerName">· {{ step.node.speakerName }}</span>
                  </button>
                </div>
              </div>

              <!-- 向下游传导边 -->
              <div v-for="(edge, ei) in step.outgoingEdges" :key="ei" class="list-edge-connector">
                <span class="edge-arrow-down">↓</span>
                <span class="edge-pill" :class="{ hypothesis: edge.hypothesis }">
                  {{ edge.relationLabel || '传导至' }} → {{ edge.toLabel }}
                </span>
                <span class="edge-mech-text">{{ edge.mechanism }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  ApartmentOutlined,
  BranchesOutlined,
  UnorderedListOutlined,
  DownOutlined,
  EnvironmentOutlined
} from '@ant-design/icons-vue'

const props = defineProps({
  chains: {
    type: Array,
    default: () => []
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['jumpEvidence'])

const viewMode = ref('graph')
const collapsedMap = ref({})
const canvasSizes = ref({})
const edgePaths = ref({})

const canvasElMap = new Map()
const nodeElMap = new Map() // `${cKey}::${nodeId}` -> HTMLElement
let resizeObserver = null

function chainKey(chain, idx) {
  return chain?.chainId || `chain_${idx}`
}

function setCanvasRef(cKey, el) {
  if (el) {
    canvasElMap.set(cKey, el)
    if (resizeObserver) {
      resizeObserver.observe(el)
    }
  } else {
    canvasElMap.delete(cKey)
  }
}

function setNodeRef(cKey, nodeId, el) {
  const k = `${cKey}::${nodeId}`
  if (el) {
    nodeElMap.set(k, el)
  } else {
    nodeElMap.delete(k)
  }
}

function toggleCollapse(cKey) {
  collapsedMap.value[cKey] = !collapsedMap.value[cKey]
  if (!collapsedMap.value[cKey]) {
    scheduleRedraw()
  }
}

function computeChainColumns(chain) {
  const nodes = Array.isArray(chain?.nodes) ? chain.nodes : []
  const edges = Array.isArray(chain?.edges) ? chain.edges : []
  if (nodes.length === 0) return []

  const nodeById = new Map()
  const adj = new Map()
  const depth = new Map()
  nodes.forEach((n, idx) => {
    const id = n.nodeId || `n${idx + 1}`
    nodeById.set(id, { ...n, nodeId: id })
    adj.set(id, [])
    depth.set(id, 0)
  })

  edges.forEach((e) => {
    if (nodeById.has(e.fromNodeId) && nodeById.has(e.toNodeId) && e.fromNodeId !== e.toNodeId) {
      adj.get(e.fromNodeId).push(e.toNodeId)
    }
  })

  // 松弛计算 DAG 拓扑层级（带轮次上限防止意外环死循环）
  const maxIter = nodes.length
  for (let round = 0; round < maxIter; round++) {
    let changed = false
    edges.forEach((e) => {
      if (nodeById.has(e.fromNodeId) && nodeById.has(e.toNodeId) && e.fromNodeId !== e.toNodeId) {
        const nextD = Math.min(maxIter - 1, (depth.get(e.fromNodeId) || 0) + 1)
        if (nextD > (depth.get(e.toNodeId) || 0)) {
          depth.set(e.toNodeId, nextD)
          changed = true
        }
      }
    })
    if (!changed) break
  }

  // 若所有节点仍都在第 0 层（例如缺少 edges），退化为顺序递增列
  const allZero = nodes.every((n, i) => (depth.get(n.nodeId || `n${i + 1}`) || 0) === 0)
  if (allZero && nodes.length > 1) {
    return nodes.map((n) => [n])
  }

  const maxDepth = Math.max(...nodes.map((n, i) => depth.get(n.nodeId || `n${i + 1}`) || 0))
  const cols = Array.from({ length: maxDepth + 1 }, () => [])
  nodes.forEach((n, i) => {
    const id = n.nodeId || `n${i + 1}`
    cols[depth.get(id) || 0].push(nodeById.get(id))
  })
  return cols.filter((col) => col.length > 0)
}

function buildOrderedSteps(chain) {
  const cols = computeChainColumns(chain)
  const orderedNodes = cols.flat()
  const nodeLabelMap = new Map(orderedNodes.map((n) => [n.nodeId, n.label]))
  const edges = Array.isArray(chain?.edges) ? chain.edges : []
  return orderedNodes.map((node) => ({
    node,
    outgoingEdges: edges
      .filter((e) => e.fromNodeId === node.nodeId)
      .map((e) => ({
        ...e,
        toLabel: nodeLabelMap.get(e.toNodeId) || e.toNodeId
      }))
  }))
}

function computeAllSvgGeometry() {
  if (viewMode.value !== 'graph' || !Array.isArray(props.chains)) return
  const nextSizes = {}
  const nextPaths = {}

  props.chains.forEach((chain, cIdx) => {
    const cKey = chainKey(chain, cIdx)
    if (collapsedMap.value[cKey]) return
    const canvasEl = canvasElMap.get(cKey)
    if (!canvasEl) return

    const cRect = canvasEl.getBoundingClientRect()
    const w = Math.max(canvasEl.scrollWidth, canvasEl.clientWidth, 400)
    const h = Math.max(canvasEl.scrollHeight, canvasEl.clientHeight, 180)
    nextSizes[cKey] = { width: w, height: h }

    const lines = []
    const edges = Array.isArray(chain?.edges) ? chain.edges : []
    edges.forEach((e) => {
      const fromEl = nodeElMap.get(`${cKey}::${e.fromNodeId}`)
      const toEl = nodeElMap.get(`${cKey}::${e.toNodeId}`)
      if (!fromEl || !toEl) return

      const fRect = fromEl.getBoundingClientRect()
      const tRect = toEl.getBoundingClientRect()

      const forward = tRect.left >= fRect.right - 8
      if (forward) {
        const x1 = fRect.right - cRect.left
        const y1 = fRect.top - cRect.top + fRect.height / 2
        const x2 = tRect.left - cRect.left - 3
        const y2 = tRect.top - cRect.top + tRect.height / 2
        const dx = Math.max(24, (x2 - x1) * 0.45)
        lines.push({
          d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
          mx: (x1 + x2) / 2,
          my: (y1 + y2) / 2,
          relationLabel: e.relationLabel || '传导至',
          mechanism: e.mechanism || '',
          hypothesis: Boolean(e.hypothesis),
          quote: e.quote || ''
        })
      } else {
        // 同列或回溯边：弧线绕行
        const x1 = fRect.left - cRect.left + fRect.width / 2
        const y1 = fRect.bottom - cRect.top
        const x2 = tRect.left - cRect.left + tRect.width / 2
        const y2 = tRect.top - cRect.top - 3
        const cy = Math.max(y1, y2) + 26
        lines.push({
          d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${cy}, ${x2} ${y2}`,
          mx: (x1 + x2) / 2,
          my: (y1 + y2) / 2,
          relationLabel: e.relationLabel || '传导至',
          mechanism: e.mechanism || '',
          hypothesis: Boolean(e.hypothesis),
          quote: e.quote || ''
        })
      }
    })
    nextPaths[cKey] = lines
  })

  canvasSizes.value = nextSizes
  edgePaths.value = nextPaths
}

function scheduleRedraw() {
  nextTick(() => {
    requestAnimationFrame(() => {
      computeAllSvgGeometry()
    })
  })
}

watch(
  () => [props.chains, viewMode.value],
  () => {
    scheduleRedraw()
  },
  { deep: true, immediate: true }
)

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      computeAllSvgGeometry()
    })
    canvasElMap.forEach((el) => resizeObserver.observe(el))
  }
  window.addEventListener('resize', scheduleRedraw)
  scheduleRedraw()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('resize', scheduleRedraw)
})

function getSeverityColor(sev) {
  if (sev === 'HIGH') return 'red'
  if (sev === 'LOW') return 'green'
  return 'orange'
}

function getSeverityText(sev) {
  if (sev === 'HIGH') return '高风险传导'
  if (sev === 'LOW') return '低影响传导'
  return '中风险传导'
}

function getGroundingColor(g) {
  if (g === 'CONFIRMED') return 'green'
  if (g === 'MIXED') return 'blue'
  return 'gold'
}

function getGroundingText(g) {
  if (g === 'CONFIRMED') return '全链原文实证'
  if (g === 'MIXED') return '实证 + 模型推演'
  return '模型跨领域推演'
}

const DOMAIN_COLORS = ['blue', 'cyan', 'purple', 'geekblue', 'magenta', 'volcano', 'orange', 'green']
function getDomainColor(domain) {
  if (!domain) return 'default'
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) % DOMAIN_COLORS.length
  }
  return DOMAIN_COLORS[Math.abs(hash) % DOMAIN_COLORS.length]
}

function formatDirectionBadge(dir) {
  switch ((dir || '').toUpperCase()) {
    case 'UP':
      return '↑ 攀升'
    case 'DOWN':
      return '↓ 下滑'
    case 'BLOCKED':
      return '⊗ 卡滞'
    case 'DELAYED':
      return '⏱ 延误'
    case 'RISK':
      return '⚠ 风险'
    case 'ISSUE':
      return '! 隐患'
    default:
      return '● 节点'
  }
}

function shortSpeaker(name) {
  if (!name) return ''
  return name.replace(/[（(].*[）)]/, '').trim()
}

function formatMs(ms) {
  if (ms === null || ms === undefined) return '00:00'
  const sec = Math.floor(Number(ms) / 1000)
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}
</script>

<style scoped>
.causal-chain-module {
  background: linear-gradient(180deg, #fafcff 0%, #ffffff 100%);
  border: 1px solid #d6e4ff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.causal-chain-module.compact {
  padding: 10px 12px;
  margin-bottom: 12px;
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.module-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #0958d9;
}

.chain-count-tag {
  margin: 0;
  font-size: 11px;
}

.header-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.chains-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chain-card {
  background: #ffffff;
  border: 1px solid #e6ecf5;
  border-left: 4px solid #1677ff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
}

.chain-card.sev-high {
  border-left-color: #f5222d;
}

.chain-card.sev-medium {
  border-left-color: #fa8c16;
}

.chain-card.sev-low {
  border-left-color: #52c41a;
}

.chain-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  background: #f8fafd;
  border-bottom: 1px solid #edf2f7;
  cursor: pointer;
}

.chain-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chain-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 7px;
  border-radius: 99px;
  background: #e6f4ff;
  color: #0958d9;
  font-size: 11px;
  font-weight: 700;
}

.chain-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.confidence-pill {
  font-size: 11px;
  color: var(--text-secondary);
}

.chain-head-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.domains-arc {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
}

.domain-step-tag {
  margin: 0;
  font-size: 11px;
}

.domain-arrow {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.collapse-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 4px;
  display: inline-flex;
  align-items: center;
}

.collapse-btn .rotated {
  transform: rotate(-90deg);
  transition: transform 0.2s;
}

.chain-card-body {
  padding: 12px 14px;
}

.chain-summary {
  margin: 0 0 12px 0;
  font-size: 12.5px;
  color: var(--text-regular);
  line-height: 1.55;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 6px;
}

/* ===== 1. SVG 分层有向图视图 ===== */
.graph-scroll-viewport {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}

.dag-canvas {
  position: relative;
  display: inline-block;
  min-width: 100%;
  padding: 14px 10px 10px;
}

.dag-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.dag-edge-labels-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}

.edge-pill {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
  cursor: help;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
  background: #ffffff;
  color: #0958d9;
  border: 1px solid #91caff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  white-space: nowrap;
}

.edge-pill.hypothesis {
  color: #d46b08;
  border-color: #ffd591;
  border-style: dashed;
  background: #fffbe6;
}

.dag-columns {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: stretch;
  gap: 72px;
}

.dag-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  flex-shrink: 0;
}

.dag-node {
  width: 186px;
  padding: 9px 10px;
  border-radius: 9px;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.dag-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(22, 119, 255, 0.12);
}

.dag-node.node-confirmed {
  border-color: #91caff;
  background: #ffffff;
}

.dag-node.node-inferred {
  border-color: #ffd591;
  border-style: dashed;
  background: #fffdf7;
}

.dag-node.dir-risk,
.dag-node.dir-blocked {
  border-color: #ffa39e;
}

.node-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.node-domain-tag {
  margin: 0;
  font-size: 10.5px;
  line-height: 16px;
  padding: 0 5px;
}

.dir-pill {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  white-space: nowrap;
}

.dir-pill.dir-up {
  background: #fff1f0;
  color: #cf1322;
}

.dir-pill.dir-down {
  background: #fff7e6;
  color: #d46b08;
}

.dir-pill.dir-blocked,
.dir-pill.dir-delayed {
  background: #f9f0ff;
  color: #722ed1;
}

.dir-pill.dir-risk,
.dir-pill.dir-issue {
  background: #fff1f0;
  color: #f5222d;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
  word-break: break-word;
}

.node-metric {
  font-size: 11.5px;
  color: #0958d9;
  background: #f0f5ff;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}

.node-term-link {
  font-size: 11px;
  color: var(--text-secondary);
}

.node-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px dashed #eef2f6;
}

.evidence-jump-btn {
  border: none;
  background: #e6f4ff;
  color: #0958d9;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-jump-btn:hover {
  background: #bae0ff;
}

.inferred-badge {
  font-size: 10.5px;
  color: #d46b08;
  font-style: italic;
}

.edge-tooltip .tip-mech {
  margin-top: 4px;
  font-size: 12px;
}

.edge-tooltip .tip-quote {
  margin-top: 4px;
  font-size: 11.5px;
  color: #ffd591;
}

/* ===== 2. 列表链路视图 ===== */
.chain-list-view {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-node-box {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #d6e4ff;
  background: #ffffff;
}

.list-node-box.node-inferred {
  border-color: #ffd591;
  border-style: dashed;
  background: #fffdf7;
}

.ln-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.ln-left,
.ln-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.step-seq {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1677ff;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ln-label {
  font-size: 13.5px;
  color: var(--text-primary);
}

.ln-quote-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #edf2f7;
  font-size: 12px;
  color: var(--text-secondary);
}

.list-edge-connector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 14px;
}

.list-edge-connector .edge-pill {
  position: static;
  transform: none;
}

.edge-arrow-down {
  font-size: 15px;
  font-weight: 700;
  color: #1677ff;
}

.edge-mech-text {
  font-size: 12px;
  color: var(--text-regular);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 768px) {
  .causal-chain-module {
    padding: 10px 12px;
  }

  .header-hint {
    display: none;
  }

  .dag-columns {
    gap: 56px;
  }

  .dag-node {
    width: 162px;
    padding: 8px;
  }

  .node-label {
    font-size: 12.5px;
  }
}
</style>
