<template>
  <div class="topics-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">会议核心议题分析</h3>
        <span class="count-badge">共 {{ agendaTopics.length }} 个议题</span>
      </div>

      <div class="header-right">
        <a-button @click="refreshTopics">
          <ReloadOutlined :spin="loading" /> 刷新
        </a-button>
        <a-button type="primary" ghost :loading="aiStore.isAnalyzing" @click="handleReanalyze">
          <RobotOutlined /> 重新提炼议题
        </a-button>
      </div>
    </div>

    <div class="panel-body">
      <a-spin :spinning="loading">
        <div v-if="agendaTopics.length === 0" class="empty-state">
          <a-empty description="暂未提取到会议议题">
            <template #extra>
              <a-button type="primary" :loading="aiStore.isAnalyzing" @click="handleReanalyze">
                <RobotOutlined /> 发起 AI 议题提炼
              </a-button>
            </template>
          </a-empty>
        </div>

        <div v-else class="topics-list">
          <div
            v-for="(topic, idx) in agendaTopics"
            :key="idx"
            class="topic-item-card"
          >
            <!-- 头部 -->
            <div class="card-head">
              <div class="index-badge">
                议题 {{ topic.topicIndex || (idx + 1) }}
              </div>
              <h4 class="topic-title">{{ topic.title }}</h4>
            </div>

            <!-- 讨论摘要 -->
            <div class="card-section">
              <span class="section-label">讨论摘要:</span>
              <p class="section-text">{{ topic.discussionSummary }}</p>
            </div>

            <!-- 达成结论 -->
            <div class="card-section conclusion-box" v-if="topic.keyConclusions">
              <span class="section-label conclusion-label">关键结论:</span>
              <p class="section-text conclusion-text">{{ topic.keyConclusions }}</p>
            </div>

            <!-- 溯源证据片段 -->
            <div class="evidence-row" v-if="topic.segmentIds && topic.segmentIds.length > 0">
              <span class="evidence-hint">来源转写证据:</span>
              <div class="evidence-tags">
                <a-tag
                  v-for="segId in topic.segmentIds"
                  :key="segId"
                  color="processing"
                  class="evidence-tag"
                  @click="handleJumpToSegment(segId)"
                >
                  <SearchOutlined /> 转写片段 #{{ segId }}
                </a-tag>
              </div>
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
  RobotOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'
import { useMeetingAiStore } from '@/stores/meetingAi'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const aiStore = useMeetingAiStore()

const loading = computed(() => aiStore.minutesLoading)
const agendaTopics = computed(() => aiStore.agendaTopics)

function refreshTopics() {
  aiStore.loadMinutes(props.meetingId)
}

function handleReanalyze() {
  aiStore.triggerAnalysis(props.meetingId, true)
}

function handleJumpToSegment(segId) {
  aiStore.jumpToSegment(segId)
}
</script>

<style scoped>
.topics-panel {
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

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.topics-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.topic-item-card {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.2s;
}

.topic-item-card:hover {
  border-color: #91caff;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.08);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.index-badge {
  font-size: 12px;
  font-weight: 700;
  color: #1677ff;
  background: #e6f4ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.topic-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.card-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-main);
  margin: 0;
}

.conclusion-box {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
  padding: 10px 14px;
}

.conclusion-label {
  color: #52c41a;
}

.conclusion-text {
  color: #274916;
  font-weight: 500;
}

.evidence-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #f0f0f0;
  font-size: 12px;
}

.evidence-hint {
  color: var(--text-tertiary);
}

.evidence-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.evidence-tag {
  cursor: pointer;
  transition: all 0.15s;
}

.evidence-tag:hover {
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .panel-header {
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 14px;
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
    padding: 4px 8px;
    font-size: 12px;
  }

  .panel-body {
    padding: 12px 10px;
  }

  .topic-item-card {
    padding: 14px 12px;
    gap: 10px;
  }

  .card-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .topic-title {
    font-size: 15px;
  }

  .evidence-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>

