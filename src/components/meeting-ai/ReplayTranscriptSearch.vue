<template>
  <div class="transcript-search-panel">
    <!-- 顶部搜索栏 -->
    <div class="search-bar-wrap">
      <a-input-search
        v-model:value="keyword"
        placeholder="搜索会议转写逐字稿 (如：PostgreSQL、数据库架构)..."
        allow-clear
        :loading="searching"
        @search="handleSearch"
      />
    </div>

    <!-- 列表区域 -->
    <div class="transcripts-scroll-wrap" ref="scrollContainerRef">
      <a-spin :spinning="loading || searching">
        <!-- 搜索无结果 -->
        <div v-if="displayList.length === 0" class="empty-state">
          <a-empty :description="keyword ? '未搜索到包含该关键词的转写片段' : '暂无转写记录'" />
        </div>

        <!-- 转写记录列表 -->
        <div v-else class="segments-list">
          <div
            v-for="item in displayList"
            :key="item.segmentId"
            class="segment-row"
            :class="{ 'is-active': isCurrentSegment(item) }"
            @click="handleJump(item.startTimeMs)"
          >
            <div class="segment-meta">
              <span class="time-tag mono">{{ formatMs(item.startTimeMs) }}</span>
              <span class="speaker-tag ellipsis">{{ item.speakerName || '参会人' }}</span>
            </div>

            <div class="segment-content">
              <span v-html="highlightKeyword(item.content, keyword)"></span>
            </div>
          </div>
        </div>
      </a-spin>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatMs } from '@/utils/format'

const props = defineProps({
  transcripts: {
    type: Array,
    default: () => []
  },
  searchResults: {
    type: Array,
    default: () => []
  },
  currentTimeMs: {
    type: Number,
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  },
  searching: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['search', 'seek'])

const keyword = ref('')
const scrollContainerRef = ref(null)

const displayList = computed(() => {
  if (keyword.value.trim() && props.searchResults?.length > 0) {
    return props.searchResults
  }
  return props.transcripts || []
})

function isCurrentSegment(item) {
  if (!item.startTimeMs) return false
  const end = item.endTimeMs || (item.startTimeMs + 4000)
  return item.startTimeMs <= props.currentTimeMs && props.currentTimeMs <= end
}

function handleSearch(val) {
  emit('search', val)
}

function handleJump(ms) {
  if (ms == null || isNaN(ms)) return
  emit('seek', ms)
}

function highlightKeyword(text, kw) {
  if (!text) return ''
  if (!kw || !kw.trim()) return text
  const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const reg = new RegExp(`(${escaped})`, 'gi')
  return text.replace(reg, '<mark class="kw-mark">$1</mark>')
}
</script>

<style scoped>
.transcript-search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: var(--border-radius-card, 8px);
  overflow: hidden;
  border: 1px solid #f0f0f0;
}

.search-bar-wrap {
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.transcripts-scroll-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.empty-state {
  padding: 40px 16px;
  text-align: center;
}

.segments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.segment-row {
  padding: 8px 12px;
  border-radius: 6px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.segment-row:hover {
  background: #f0f5ff;
  border-color: #adc6ff;
}

.segment-row.is-active {
  background: #e6f4ff;
  border-color: #1677ff;
}

.segment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.time-tag {
  font-size: 11px;
  color: #1677ff;
  font-weight: 600;
  background: #e6f4ff;
  padding: 1px 6px;
  border-radius: 3px;
}

.speaker-tag {
  font-size: 12px;
  font-weight: 500;
  color: #595959;
}

.segment-content {
  font-size: 13px;
  color: #262626;
  line-height: 1.6;
}

:deep(.kw-mark) {
  background-color: #ffe58f;
  color: #d46b08;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}
</style>
