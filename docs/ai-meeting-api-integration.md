# EasyMeeting AI 智能会议前后端接口映射文档

## 一、概述

本集成文档根据后端真实源码（`D:\java\project\easymeeting-java`）中的 Controller、Service、DTO、PO、Enum 以及系统设计文档梳理而成，用于规范 `easymeeting-front` 与后端 Spring AI 多 Agent 系统的无缝交互。

- **后端根路径**: `/api`（Vite 代理至后端 `http://localhost:7008`）
- **AI 模块基路径**: `/api/meetingAi`
- **信令与长连接 WebSocket**: `ws://localhost:7002/ws`
- **认证机制**: 统一在请求头携带 `token: <localStorage.getItem('token')>`，Cookie 中同步携带 `token`。
- **全局统一响应结构**:
  ```json
  {
    "status": "success",     // "success" | "error"
    "code": 200,             // 200-成功, 600-参数错误, 901-未登录/超时, 500-系统异常
    "info": "请求成功",       // 业务提示信息
    "data": { ... }          // 业务响应载荷
  }
  ```

---

## 二、后端真实 API 与前端映射清单

| 序号 | 业务模块 | 后端真实 API 路径 | 请求方式 | Content-Type | 核心请求参数 | 核心返回字段 / 数据结构 | 前端封装方法 (`src/api/meetingAi.js`) | 前端对应页面 / 组件 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 录音管理 | `/meetingAi/recording/upload` | POST | `multipart/form-data` | `file` (MultipartFile), `meetingId` (String), `durationSeconds` (Integer, 可选) | `recordingId`, `meetingId`, `fileName`, `fileSize`, `fileFormat`, `durationSeconds`, `status`, `downloadUrl`, `createTime` | `uploadRecording(formData)` | `RecordingManager.vue` |
| 2 | 录音管理 | `/meetingAi/recording/list` | GET | `application/json` | `meetingId` (String) | `List<MeetingRecordingDto>` (包含文件属性、转写状态 `status`: 0-待处理, 1-转写中, 2-已完成, 3-失败) | `getRecordingList(meetingId)` | `RecordingManager.vue` |
| 3 | 录音管理 | `/meetingAi/recording/download/{recordingId}` | GET | `audio/mpeg` | PathVariable: `recordingId` | 音频二进制流 (支持流式播放和断点续传) | `getRecordingAudioBlob(recordingId)` / 媒体播放 URL | `RecordingManager.vue`, `TranscriptPanel.vue` |
| 4 | 语音转写 | `/meetingAi/transcript/start` | POST | `application/json` | `{ meetingId, recordingId, language }` | `taskId`, `meetingId`, `taskType`, `taskStatus`, `startTime` | `startTranscription(params)` | `RecordingManager.vue`, `TranscriptPanel.vue` |
| 5 | 语音转写 | `/meetingAi/transcript/segments` | GET | `application/json` | `meetingId`, `recordingId` (可选), `pageNo`, `pageSize` | `PaginationResultVO<TranscriptSegmentDto>` (`totalCount`, `pageNo`, `pageSize`, `list`: `[{ segmentId, speakerId, speakerName, startTimeMs, endTimeMs, originalText, currentText, isRevised, sequenceNo }]`) | `getTranscriptSegments(params)` | `TranscriptPanel.vue` |
| 6 | 语音转写 | `/meetingAi/transcript/revise` | POST | `application/json` | `{ segmentId, meetingId, revisedText, revisionReason }` | 修正后的 `TranscriptSegmentDto` | `reviseTranscriptSegment(params)` | `TranscriptPanel.vue` |
| 7 | 语音转写 | `/meetingAi/transcript/revision-history` | GET | `application/json` | `segmentId` | `List<TranscriptRevisionDto>` (`revisionId`, `segmentId`, `operatorUserId`, `beforeText`, `afterText`, `revisionReason`, `createTime`) | `getRevisionHistory(segmentId)` | `TranscriptPanel.vue` |
| 8 | 多 Agent 分析 | `/meetingAi/analysis/start` | POST | `application/json` | `{ meetingId, targetLanguage, forceReanalyze }` | `taskId`, `meetingId`, `taskType`, `taskStatus` | `startAnalysis(params)` | `MeetingHistoryView.vue`, `MeetingAiWorkspaceView.vue`, `AgentExecutionPanel.vue` |
| 9 | 任务状态 | `/meetingAi/task/status` | GET | `application/json` | `taskId` | `MeetingAiTask` (`taskId`, `meetingId`, `taskType`, `taskStatus`, `retryCount`, `errorMessage`, `startTime`, `finishTime`) | `getTaskStatus(taskId)` | `AgentExecutionPanel.vue`, `MeetingAiWorkspaceView.vue` |
| 10 | Agent 日志 | `/meetingAi/task/agent-logs` | GET | `application/json` | `taskId` | `List<MeetingAgentLog>` (`agentName`, `status`, `promptTokens`, `completionTokens`, `costMs`, `inputSummary`, `outputContent`, `errorDetail`) | `getAgentLogs(taskId)` | `AgentExecutionPanel.vue` |
| 11 | 会议纪要 | `/meetingAi/minutes/get` | GET | `application/json` | `meetingId` | `MeetingMinutesDto` (`minutesId`, `meetingId`, `version`, `title`, `summary`, `agendaTopics` (JSON string), `keyDiscussions`, `conclusions`, `status`: 0-草稿, 1-待审核, 2-已发布, 3-已归档, `auditUserId`, `auditRemark`, `publishUserId`, `decisions`, `actionItems`, `createTime`, `updateTime`) | `getMeetingMinutes(meetingId)` | `MinutesPanel.vue`, `MeetingAiWorkspaceView.vue` |
| 12 | 会议纪要 | `/meetingAi/minutes/edit-draft` | POST | `application/json` | `{ minutesId, meetingId, title, summary, agendaTopicsJson, keyDiscussions, conclusions }` | 更新后的 `MeetingMinutesDto` | `editMinutesDraft(params)` | `MinutesPanel.vue` |
| 13 | 会议纪要 | `/meetingAi/minutes/audit` | POST | `application/json` | `{ minutesId, meetingId, approved, auditRemark }` | 审核后的 `MeetingMinutesDto` | `auditMinutes(params)` | `MinutesPanel.vue` |
| 14 | 会议纪要 | `/meetingAi/minutes/publish` | POST | `application/json` | `{ minutesId, meetingId, changeLog }` | 发布后的 `MeetingMinutesDto` | `publishMinutes(params)` | `MinutesPanel.vue` |
| 15 | 会议纪要 | `/meetingAi/minutes/versions` | GET | `application/json` | `meetingId` | `List<MeetingMinutesVersion>` (`versionId`, `versionNum`, `changeLog`, `createdBy`, `createTime`) | `getMinutesVersions(meetingId)` | `MinutesPanel.vue` |
| 16 | 会议纪要 | `/meetingAi/minutes/version-detail` | GET | `application/json` | `versionId` | `MeetingMinutesVersion` 包含 `contentSnapshot` JSON 字符串 | `getMinutesVersionDetail(versionId)` | `MinutesPanel.vue` |
| 17 | 议题管理 | 从 `MeetingMinutesDto.agendaTopics` 解析 | 衍生 | - | 属于纪要一部分，字段：`topicIndex`, `title`, `discussionSummary`, `keyConclusions`, `segmentIds` | `AgendaTopicDto[]` | `TopicsPanel.vue` |
| 18 | 决策管理 | `/meetingAi/decision/list` | GET | `application/json` | `meetingId` | `List<MeetingDecision>` (`decisionId`, `content`, `rationale`, `proposer`, `decisionMaker`, `status`: CONFIRMED / PENDING / REJECTED, `evidenceQuote`) | `getDecisionList(meetingId)` | `DecisionsPanel.vue` |
| 19 | 决策管理 | `/meetingAi/decision/update` | POST | `application/json` | `{ decisionId, status }` | 更新后的 `MeetingDecision` | `updateDecision(params)` | `DecisionsPanel.vue` |
| 20 | 待办事项 | `/meetingAi/action-item/list` | GET | `application/json` | `meetingId`, `assigneeUserId` (可选), `status` (可选) | `List<MeetingActionItem>` (`actionId`, `content`, `assigneeUserId`, `assigneeName`, `dueTime`, `priority`: HIGH / MEDIUM / LOW, `status`: TODO / DOING / DONE / CANCELLED, `evidenceQuote`) | `getActionItemList(params)` | `ActionItemsPanel.vue` |
| 21 | 待办事项 | `/meetingAi/action-item/update` | POST | `application/json` | `{ actionId, status, assigneeUserId, dueTime }` | 更新后的 `MeetingActionItem` | `updateActionItem(params)` | `ActionItemsPanel.vue` |
| 22 | 证据追溯 | `/meetingAi/evidence/query` | GET | `application/json` | `targetType` (`DECISION`, `ACTION_ITEM`, `MINUTES_TOPIC`, `QA_ANSWER`), `targetId` | `List<MeetingEvidenceReference>` (`evidenceId`, `segmentId`, `speakerName`, `startTimeMs`, `endTimeMs`, `quoteText`, `confidenceScore`) | `queryEvidence(params)` | `MinutesPanel.vue`, `TopicsPanel.vue`, `DecisionsPanel.vue`, `ActionItemsPanel.vue`, `MeetingQaPanel.vue` |
| 23 | 智能问答 | `/meetingAi/qa/ask` | POST | `application/json` | `{ meetingId, question }` | `MeetingQaResult` (`answer`, `hasEvidence`, `confidence`, `evidenceList`: `[{ meetingId, segmentId, speakerName, startTimeMs, endTimeMs, quoteText }]`) | `askMeetingQa(params)` | `MeetingQaPanel.vue` |
| 24 | 问答历史 | `/meetingAi/qa/history` | GET | `application/json` | `meetingId` (可选), `pageNo`, `pageSize` | `PaginationResultVO<MeetingQaHistory>` (`qaId`, `question`, `answer`, `hasEvidence`, `evidenceDetails`, `createTime`) | `getQaHistory(params)` | `MeetingQaPanel.vue` |
| 25 | 实时音频会话 | `/meetingAi/realtime/create-session` | POST | `application/json` | `{ meetingId, sampleRate, audioFormat, deviceInfo }` | `MeetingRealtimeSession` (`sessionId`, `meetingId`, `audioFormat`, `sampleRate`, `status`: ACTIVE) | `createRealtimeSession(params)` | `MeetingRoomView.vue` (实时会议室集成) |
| 26 | 实时音频分片 | `/meetingAi/realtime/stream-chunk` | POST | `multipart/form-data` | `sessionId`, `chunkIndex`, `audioData` (Blob/File), `isLastChunk` | `TranscriptSegmentDto` (当前分片识别出的转写片段) | `streamAudioChunk(formData)` | `MeetingRoomView.vue` |
| 27 | 实时会话关闭 | `/meetingAi/realtime/close-session` | POST | `application/json` | `{ sessionId }` | "会话已关闭" | `closeRealtimeSession(params)` | `MeetingRoomView.vue` |
| 28 | 实时转写广播 | WebSocket 消息接收 | WS | JSON | `messageType: 20` (`TRANSCRIPT_INCREMENTAL`) | `{ segmentId, speakerName, text / currentText, isFinal, startTimeMs, endTimeMs }` | `useWebSocket.js` 监听并分发到 `useMeetingStore` | `MeetingRoomView.vue` |
| 29 | 纪要发布广播 | WebSocket 消息接收 | WS | JSON | `messageType: 22` (`MINUTES_PUBLISHED`) | `{ meetingId, minutesId, version }` | `useWebSocket.js` 监听并分发 | `MeetingRoomView.vue`, `MeetingHistoryView.vue` |

---

## 三、核心枚举与常量定义

### 1. AI 任务状态 (`AiTaskStatusEnum`)
- `PENDING`: 等待执行（黄色/等待状态）
- `PROCESSING`: 执行中（蓝色/运行中旋转动画）
- `SUCCESS`: 执行成功（绿色/成功标签）
- `FAILED`: 执行失败（红色/失败警示）
- `CANCELLED`: 已取消（置灰）

### 2. AI 任务类型 (`AiTaskTypeEnum`)
- `TRANSCRIPTION`: 离线录音转写
- `MINUTES_ANALYSIS`: 纪要与多 Agent 分析
- `FULL_PIPELINE`: 转写分析完整流水线
- `REALTIME_FINALIZE`: 实时会话复核校准

### 3. 会议纪要生命周期状态 (`MeetingMinutes.status`)
- `0`: 草稿 (Draft) - 支持编辑
- `1`: 待审核 (Pending Audit) - 支持审核驳回或通过
- `2`: 已发布 (Published) - 已定稿，对外正式生效并生成版本快照
- `3`: 历史归档 (Archived) - 旧版本存档

### 4. 决策状态 (`MeetingDecision.status`)
- `CONFIRMED`: 已确认正式生效决策（绿色）
- `PENDING`: 候选/待讨论决策（橙色）
- `REJECTED`: 已否决/弃用（灰色）

### 5. 待办任务状态与优先级 (`MeetingActionItem`)
- **状态 (status)**:
  - `TODO`: 待办
  - `DOING`: 进行中
  - `DONE`: 已完成
  - `CANCELLED`: 已取消
- **优先级 (priority)**:
  - `HIGH`: 高优（红色）
  - `MEDIUM`: 中优（橙色）
  - `LOW`: 低优（蓝色）

### 6. 六大 Spring AI Agent 职责说明
1. **LanguageUnderstandingAgent**（语言理解与切分 Agent）: 语义分段、热词提取与议题边界划分。
2. **MinutesAgent**（会议纪要 Agent）: 总结核心要点、提取讨论脉络与生成结论。
3. **DecisionAgent**（决策提取 Agent）: 识别会议共识、定案决策与决议依据。
4. **ActionItemAgent**（待办提取 Agent）: 抽离行动项、责任人匹配及交付时间判定。
5. **QualityReviewAgent**（质量反思与审查 Agent）: 评估一致性、幻觉消除与事实合规性打分。
6. **MeetingQaAgent**（知识问答 Agent）: 基于会议事实上下文与向量证据的高精度溯源问答。

---

## 四、安全与错误码规范

- `200`: 操作成功
- `600`: 请求参数错误或格式不匹配
- `901`: 登录凭据失效或当前用户未登录
- `500`: 后端服务器业务或模型调用异常
- **权限隔离要求**:
  - 用户必须是会议创建者、受邀参会人或实际出席人，方可查看该会议的 AI 纪要、录音与转写记录。
  - 会议纪要发布 (`/minutes/publish`) 仅主持人或创建者有权触发。
  - 前端遇 901 自动引导登录，遇 403/权限拒绝显示清晰的中文提示，禁止静默截断。

