<template>
  <div class="agent-execution-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">Spring AI 多 Agent 流水线审计</h3>
        <span class="count-badge" v-if="currentTask">
          任务状态: {{ currentTask.taskStatus }}
        </span>
      </div>

      <div class="header-right">
        <a-button size="small" @click="fetchLogs">
          <ReloadOutlined :spin="loading" /> 刷新
        </a-button>
        <a-button
          type="primary"
          size="small"
          :loading="aiStore.isAnalyzing"
          @click="handleStartPipeline"
        >
          <PlayCircleOutlined /> 触发流水线
        </a-button>
      </div>
    </div>

    <!-- 任务元数据概览 -->
    <div class="task-summary-bar" v-if="currentTask">
      <div class="summary-item">
        <span class="label">任务 ID:</span>
        <span class="value mono">{{ currentTask.taskId }}</span>
      </div>
      <div class="summary-item">
        <span class="label">任务类型:</span>
        <span class="value">{{ currentTask.taskType }}</span>
      </div>
      <div class="summary-item">
        <span class="label">重试次数:</span>
        <span class="value">{{ currentTask.retryCount ?? 0 }}</span>
      </div>
      <div class="summary-item" v-if="currentTask.startTime">
        <span class="label">启动时间:</span>
        <span class="value">{{ currentTask.startTime }}</span>
      </div>
      <div class="summary-item" v-if="currentTask.finishTime">
        <span class="label">结束时间:</span>
        <span class="value">{{ currentTask.finishTime }}</span>
      </div>
    </div>

    <!-- 失败原因警告 -->
    <div class="error-banner" v-if="currentTask && currentTask.errorMessage">
      <a-alert
        :message="`流水线执行异常: ${currentTask.errorMessage}`"
        type="error"
        show-icon
      />
    </div>

    <!-- Agent 流程节点卡片列表 -->
    <div class="panel-body">
      <a-spin :spinning="loading">
        <div v-if="agentLogs.length === 0" class="empty-state">
          <a-empty description="当前暂无 Agent 执行审计记录">
            <template #extra>
              <a-button type="primary" :loading="aiStore.isAnalyzing" @click="handleStartPipeline">
                <RobotOutlined /> 立即发起多 Agent 分析
              </a-button>
            </template>
          </a-empty>
        </div>

        <div v-else class="agent-cards-list">
          <div
            v-for="(log, idx) in agentLogs"
            :key="log.logId || idx"
            class="agent-card"
            :class="{
              'is-success': log.status === 'SUCCESS',
              'is-failed': log.status === 'FAILED',
              'is-processing': log.status === 'PROCESSING'
            }"
          >
            <!-- 头部：序号、Agent 角色与状态 -->
            <div class="card-head">
              <div class="head-left">
                <div class="agent-num-badge">
                  #{{ idx + 1 }}
                </div>
                <div class="agent-titles">
                  <h4 class="agent-name">{{ formatAgentName(log.agentName) }}</h4>
                  <span class="agent-code mono">{{ log.agentName }}</span>
                </div>
              </div>

              <div class="head-right">
                <a-tag :color="log.status === 'SUCCESS' ? 'success' : log.status === 'FAILED' ? 'error' : 'processing'">
                  <component :is="log.status === 'SUCCESS' ? CheckCircleOutlined : CloseCircleOutlined" />
                  {{ log.status }}
                </a-tag>
              </div>
            </div>

            <!-- 性能指标：耗时、Token -->
            <div class="metrics-grid">
              <div class="metric-pill">
                <ClockCircleOutlined style="color: #1677ff" />
                <span>耗时: {{ log.costMs != null ? `${log.costMs} ms` : '-' }}</span>
              </div>
              <div class="metric-pill" v-if="log.promptTokens != null">
                <ThunderboltOutlined style="color: #fa8c16" />
                <span>输入 Token: {{ log.promptTokens }}</span>
              </div>
              <div class="metric-pill" v-if="log.completionTokens != null">
                <CheckOutlined style="color: #52c41a" />
                <span>输出 Token: {{ log.completionTokens }}</span>
              </div>
            </div>

            <!-- 输入摘要 -->
            <div class="log-block" v-if="log.inputSummary">
              <span class="block-label">输入概括:</span>
              <p class="block-content">{{ log.inputSummary }}</p>
            </div>

            <!-- 输出内容或质检评审结果 -->
            <div class="log-block output-block" v-if="log.outputContent">
              <span class="block-label">Agent 产出内容 / 评分:</span>
              <div class="code-box">
                {{ formatOutput(log.outputContent) }}
              </div>
            </div>

            <!-- 错误详情 -->
            <div class="log-block error-block" v-if="log.errorDetail">
              <span class="block-label error-label">错误栈跟踪:</span>
              <p class="error-text">{{ log.errorDetail }}</p>
            </div>
          </div>
        </div>
      </a-spin>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  ReloadOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckOutlined
} from '@ant-design/icons-vue'
import { useMeetingAiStore } from '@/stores/meetingAi'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const aiStore = useMeetingAiStore()

const loading = computed(() => aiStore.isAnalyzing)
const currentTask = computed(() => aiStore.currentTask)
const agentLogs = computed(() => aiStore.agentLogs)

function formatAgentName(name) {
  switch (name) {
    case 'LanguageUnderstandingAgent':
      return '语篇理解与议题切分 Agent'
    case 'MinutesAgent':
      return '会议纪要生成 Agent'
    case 'DecisionAgent':
      return '共识决策提炼 Agent'
    case 'ActionItemAgent':
      return '待办任务提取 Agent'
    case 'QualityReviewAgent':
      return '质量审查与反思 Agent'
    case 'MeetingQaAgent':
      return '知识检索与问答 Agent'
    default:
      return name || 'AI Agent'
  }
}

function formatOutput(content) {
  if (!content) return ''
  try {
    const obj = JSON.parse(content)
    return JSON.stringify(obj, null, 2)
  } catch (e) {
    return content
  }
}

function fetchLogs() {
  if (currentTask.value?.taskId) {
    aiStore.startTaskPolling(currentTask.value.taskId)
  }
}

function handleStartPipeline() {
  aiStore.triggerAnalysis(props.meetingId, true)
}
</script>

<style scoped>
.agent-execution-panel {
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

.count-badge {
  font-size: 12px;
  color: var(--text-secondary);
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-summary-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 20px;
  background: #fdfdfd;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.summary-item .label {
  color: var(--text-tertiary);
}

.error-banner {
  padding: 10px 20px 0;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.agent-cards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.agent-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s;
}

.agent-card.is-success {
  border-left: 4px solid #52c41a;
}

.agent-card.is-failed {
  border-left: 4px solid #ff4d4f;
}

.agent-card.is-processing {
  border-left: 4px solid #1677ff;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-num-badge {
  font-size: 12px;
  font-weight: 700;
  color: #1677ff;
  background: #e6f4ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.agent-titles {
  display: flex;
  flex-direction: column;
}

.agent-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.agent-code {
  font-size: 11px;
  color: var(--text-tertiary);
}

.metrics-grid {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.metric-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.log-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.block-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.block-content {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.6;
  margin: 0;
}

.code-box {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 8px 12px;
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--text-main);
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-block {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  padding: 8px 12px;
  border-radius: 4px;
}

.error-label {
  color: #ff4d4f;
}

.error-text {
  font-size: 12px;
  color: #a8071a;
  margin: 0;
  font-family: var(--font-family-mono);
}

@media (max-width: 768px) {
  .panel-header {
    padding: 12px 14px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .header-left {
    width: 100%;
    justify-content: space-between;
  }

  .panel-title {
    font-size: 15px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-end;
    gap: 8px;
  }

  .header-right .ant-btn {
    flex: 1;
    font-size: 12px;
  }

  .task-summary-bar {
    padding: 8px 12px;
    gap: 10px;
    font-size: 11px;
  }

  .panel-body {
    padding: 12px 10px;
  }

  .agent-card {
    padding: 12px 10px;
    gap: 10px;
  }

  .card-head {
    flex-wrap: wrap;
    gap: 6px;
  }

  .agent-name {
    font-size: 14px;
  }

  .metrics-grid {
    gap: 6px;
  }

  .metric-pill {
    font-size: 11px;
    padding: 2px 6px;
  }

  .code-box {
    font-size: 11px;
    padding: 6px 8px;
    max-height: 140px;
  }
}
</style>

