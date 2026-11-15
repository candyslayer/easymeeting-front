<template>
  <a-modal
    v-model:open="visible"
    title="人工微调议题与时间轴"
    :confirm-loading="submitting"
    @ok="handleSubmit"
    @cancel="handleCancel"
    width="540px"
  >
    <a-form layout="vertical" :model="formData" :rules="rules" ref="formRef">
      <!-- 议题标题 -->
      <a-form-item label="议题标题" name="title">
        <a-input
          v-model:value="formData.title"
          placeholder="请输入清晰简短的议题名称，例如：技术架构讨论"
          maxlength="100"
          show-count
        />
      </a-form-item>

      <!-- 时间区间调整 (mm:ss 或 hh:mm:ss) -->
      <div class="time-range-row">
        <a-form-item label="起始时间 (分:秒)" name="startTimeStr" class="time-item">
          <a-input
            v-model:value="formData.startTimeStr"
            placeholder="00:00"
            @blur="formatTimeInput('startTimeStr')"
          />
        </a-form-item>

        <span class="range-separator">至</span>

        <a-form-item label="结束时间 (分:秒)" name="endTimeStr" class="time-item">
          <a-input
            v-model:value="formData.endTimeStr"
            placeholder="08:32"
            @blur="formatTimeInput('endTimeStr')"
          />
        </a-form-item>
      </div>

      <div class="time-tip">
        提示：支持输入 <code>08:32</code> 或 <code>01:15:30</code>，系统将自动映射为精确毫秒时间轴。
      </div>

      <!-- 议题摘要 -->
      <a-form-item label="议题讨论摘要" name="summary">
        <a-textarea
          v-model:value="formData.summary"
          placeholder="总结本议题的核心探讨内容、关键分歧与共识..."
          :rows="4"
          maxlength="500"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { message } from 'ant-design-vue'
import { formatMs, parseTimeToMs } from '@/utils/format'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  topic: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:open', 'submit'])

const visible = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const formData = reactive({
  topicId: '',
  title: '',
  summary: '',
  startTimeStr: '00:00',
  endTimeStr: '00:00',
  sortOrder: 1
})

const rules = {
  title: [{ required: true, message: '请输入议题标题', trigger: 'blur' }],
  startTimeStr: [{ required: true, message: '请输入起始时间', trigger: 'blur' }],
  endTimeStr: [{ required: true, message: '请输入结束时间', trigger: 'blur' }]
}

watch(
  () => props.open,
  (val) => {
    visible.value = val
    if (val && props.topic) {
      formData.topicId = props.topic.id
      formData.title = props.topic.title || ''
      formData.summary = props.topic.summary || ''
      formData.startTimeStr = formatMs(props.topic.startTimeMs || 0)
      formData.endTimeStr = formatMs(props.topic.endTimeMs || 0)
      formData.sortOrder = props.topic.sortOrder || 1
    }
  }
)

watch(
  () => visible.value,
  (val) => {
    emit('update:open', val)
  }
)

function formatTimeInput(field) {
  const ms = parseTimeToMs(formData[field])
  formData[field] = formatMs(ms)
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
    const startMs = parseTimeToMs(formData.startTimeStr)
    const endMs = parseTimeToMs(formData.endTimeStr)

    if (endMs <= startMs) {
      message.error('结束时间必须大于起始时间')
      return
    }

    submitting.value = true
    emit('submit', {
      topicId: formData.topicId,
      title: formData.title,
      summary: formData.summary,
      sortOrder: formData.sortOrder,
      startTimeMs: startMs,
      endTimeMs: endMs
    })
    visible.value = false
  } catch (err) {
    // 校验未通过
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  visible.value = false
}
</script>

<style scoped>
.time-range-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-item {
  flex: 1;
  margin-bottom: 0;
}

.range-separator {
  margin-top: 14px;
  color: rgba(0, 0, 0, 0.45);
  font-weight: 500;
}

.time-tip {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 6px;
  margin-bottom: 16px;
}

.time-tip code {
  background: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
  color: #1677ff;
}
</style>
