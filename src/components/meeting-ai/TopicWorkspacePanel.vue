<template>
  <div class="topic-workspace-panel">
    <!-- 三栏自适应布局：议题导航 (左) + 实时转写流与实体高亮 (中) + 议题阶段性总结与多维知识 (右) -->
    <div class="workspace-grid">
      <!-- ============================================== -->
      <!-- 左栏：议题生命周期导航 -->
      <!-- ============================================== -->
      <aside class="topic-nav-column">
        <div class="column-header">
          <div class="header-title-box">
            <h3 class="col-title">会议研讨议题</h3>
            <span class="count-pill">{{ topics.length }}</span>
          </div>
          <div class="header-btn-row">
            <a-button type="primary" size="small" @click="openCreateTopicModal">
              <PlusOutlined /> 新建议题
            </a-button>
            <a-button size="small" @click="handleRefreshTopics">
              <ReloadOutlined :spin="aiStore.topicsV2Loading" />
            </a-button>
          </div>
        </div>

        <!-- 一键基于议题合成纪要入口 -->
        <div class="minutes-synthesis-box">
          <a-button
            type="dashed"
            block
            size="small"
            class="synthesis-btn"
            @click="handleGenerateMinutesFromTopics"
          >
            <ThunderboltOutlined /> 基于累积议题知识合成纪要
          </a-button>
        </div>

        <!-- 议题列表 -->
        <div class="topics-scroll-area">
          <a-spin :spinning="aiStore.topicsV2Loading">
            <div v-if="topics.length === 0" class="empty-topics">
              <a-empty description="暂无议题，请点击上方创建首个议题" />
            </div>

            <div
              v-for="(t, idx) in topics"
              :key="t.topicId"
              class="topic-nav-card"
              :class="{
                active: currentTopicId === t.topicId,
                discussing: t.status === 'DISCUSSING' || t.status === 'REOPENED'
              }"
              @click="handleSelectTopic(t.topicId)"
            >
              <div class="topic-card-top">
                <span class="topic-seq">#{{ t.sortOrder || idx + 1 }}</span>
                <a-tag :color="getTopicStatusColor(t.status)" class="status-tag">
                  {{ getTopicStatusLabel(t.status) }}
                </a-tag>
              </div>

              <h4 class="topic-card-title ellipsis" :title="t.topicName">
                {{ t.topicName }}
              </h4>

              <p class="topic-card-desc ellipsis-2" v-if="t.description || t.overview">
                {{ t.description || t.overview }}
              </p>

              <!-- 统计指示胶囊 -->
              <div class="topic-metrics-row">
                <span class="metric-item" title="关联转写片段数">
                  <FileTextOutlined /> {{ t.segmentCount || 0 }} 句
                </span>
                <span v-if="t.pendingDecisionCount > 0" class="metric-item pending-dec" title="待确认决策">
                  <ClockCircleOutlined /> {{ t.pendingDecisionCount }} 待定
                </span>
                <span v-if="t.currentVersionNo" class="metric-item ver-pill" title="总结版本">
                  V{{ t.currentVersionNo }}
                </span>
              </div>

              <!-- 快捷状态操作按钮 -->
              <div class="topic-action-bar" @click.stop>
                <a-button
                  v-if="t.status !== 'DISCUSSING' && t.status !== 'CONCLUDED'"
                  size="small"
                  type="link"
                  class="act-btn"
                  @click="handleSwitchTopic(t.topicId, 'DISCUSSING')"
                >
                  切入研讨
                </a-button>
                <a-button
                  v-if="t.status === 'DISCUSSING'"
                  size="small"
                  type="link"
                  class="act-btn pause"
                  @click="handleSwitchTopic(t.topicId, 'PAUSED')"
                >
                  暂停
                </a-button>
                <a-button
                  v-if="t.status !== 'CONCLUDED'"
                  size="small"
                  type="link"
                  class="act-btn conclude"
                  @click="openConcludeModal(t)"
                >
                  结项
                </a-button>
                <a-button
                  v-if="t.status === 'CONCLUDED'"
                  size="small"
                  type="link"
                  class="act-btn reopen"
                  @click="handleReopenTopic(t.topicId)"
                >
                  重开讨论
                </a-button>
              </div>
            </div>
          </a-spin>
        </div>
      </aside>

      <!-- ============================================== -->
      <!-- 中栏：实时转写流、实体高亮与人工重归类 -->
      <!-- ============================================== -->
      <section class="transcript-feed-column">
        <div class="column-header">
          <div class="header-title-box">
            <h3 class="col-title">实时发言转写流</h3>
            <span class="current-topic-label ellipsis" v-if="currentTopic">
              当前聚焦：【{{ currentTopic.topicName }}】
            </span>
          </div>
          <div class="feed-filters">
            <a-input-search
              v-model:value="transcriptSearch"
              placeholder="搜索转写发言与术语..."
              size="small"
              class="search-input"
            />
          </div>
        </div>

        <!-- 提示条：实体下划线与操作提示 -->
        <div class="feed-hint-bar">
          <InfoCircleOutlined style="color: #3b82f6" />
          <span>点击专业术语（如 <strong>FPY, CT, WIP</strong>）可弹出三层标准释义；点击发言可重调所属议题。</span>
        </div>

        <!-- 转写发言列表 -->
        <div class="feed-scroll-area">
          <a-spin :spinning="aiStore.transcriptLoading">
            <div v-if="filteredSegments.length === 0" class="empty-feed">
              <a-empty description="当前议题或检索条件下无发言片段" />
            </div>

            <div
              v-for="seg in filteredSegments"
              :key="seg.segmentId"
              class="transcript-card"
              :class="{
                'topic-matched': seg.topicId === currentTopicId,
                'highlighted': String(seg.segmentId) === String(aiStore.highlightSegmentId)
              }"
            >
              <div class="segment-top-row">
                <div class="speaker-info">
                  <a-avatar size="small" class="speaker-avatar">
                    {{ (seg.speakerName || '参')[0] }}
                  </a-avatar>
                  <span class="speaker-name">{{ seg.speakerName || '与会人' }}</span>
                  <span class="timestamp mono" v-if="seg.startTimeMs">
                    {{ formatMs(seg.startTimeMs) }}
                  </span>
                </div>

                <div class="segment-actions">
                  <!-- 议题标签与归属重分配 -->
                  <a-dropdown :trigger="['click']">
                    <a-tag :color="seg.topicId === currentTopicId ? 'blue' : 'default'" class="topic-tag-btn">
                      {{ getTopicNameById(seg.topicId) }} <DownOutlined />
                    </a-tag>
                    <template #overlay>
                      <a-menu @click="(e) => handleReassignSegment(seg.segmentId, e.key)">
                        <a-menu-item-group title="将此发言重归类至：">
                          <a-menu-item v-for="item in topics" :key="item.topicId">
                            {{ item.topicName }} ({{ item.status }})
                          </a-menu-item>
                        </a-menu-item-group>
                      </a-menu>
                    </template>
                  </a-dropdown>

                  <!-- 播放器联动定位 -->
                  <a-button
                    type="text"
                    size="small"
                    class="play-seek-btn"
                    title="定位录音播放"
                    @click="handleSeek(seg.startTimeMs)"
                  >
                    <PlayCircleOutlined />
                  </a-button>
                </div>
              </div>

              <!-- 发言文本 (高亮并支持点击术语) -->
              <div class="segment-content">
                <span
                  v-for="(part, pIdx) in parseTextWithTerms(seg.currentText || seg.originalText)"
                  :key="pIdx"
                  :class="{
                    'term-underline': part.isTerm,
                    'term-fpy': part.text === 'FPY',
                    'term-ct': part.text === 'CT',
                    'term-wip': part.text === 'WIP'
                  }"
                  @click="part.isTerm ? handleTermClick(part.text, seg) : null"
                >
                  {{ part.text }}
                </span>
              </div>
            </div>
          </a-spin>
        </div>
      </section>

      <!-- ============================================== -->
      <!-- 右栏：议题阶段性总结与多维知识体系 (6 大标签页) -->
      <!-- ============================================== -->
      <section class="topic-knowledge-column">
        <div class="column-header knowledge-header">
          <div class="header-title-box">
            <h3 class="col-title ellipsis" v-if="currentTopic">
              【{{ currentTopic.topicName }}】研讨知识中心
            </h3>
            <h3 class="col-title" v-else>议题知识中心</h3>
          </div>

          <div class="header-btn-row">
            <a-button
              type="primary"
              size="small"
              :loading="aiStore.topicDetailLoading"
              @click="handleGenerateSummaryNow"
            >
              <SyncOutlined /> 增量更新总结
            </a-button>
            <a-button size="small" @click="openSummaryVersionModal">
              <HistoryOutlined /> 演进历史
            </a-button>
          </div>
        </div>

        <!-- 6 个多维研讨标签页 -->
        <a-tabs v-model:activeKey="activeKnowledgeTab" class="knowledge-tabs">
          <!-- 标签 1：议题阶段性总结 -->
          <a-tab-pane key="summary" tab="阶段总结">
            <div class="tab-pane-content">
              <div v-if="currentSummary" class="summary-view-card">
                <!-- 总结版本与演进动因头部 -->
                <div class="summary-meta-header">
                  <div class="ver-info">
                    <span class="ver-large-tag">Version {{ currentSummary.versionNumber }}</span>
                    <span class="ver-time">{{ currentSummary.createTime }}</span>
                  </div>
                  <div class="summary-btn-tools">
                    <a-button size="small" @click="openEditSummaryModal">
                      <EditOutlined /> 人工编辑
                    </a-button>
                  </div>
                </div>

                <div class="evolution-reason-box" v-if="currentSummary.updateReason">
                  <span class="reason-label">演进动因:</span>
                  <span class="reason-val">{{ currentSummary.updateReason }}</span>
                </div>

                <!-- 结构化多维总结字段 -->
                <div class="structured-summary-list">
                  <!-- A. 议题概述 -->
                  <div class="summary-section-box">
                    <div class="sec-header">
                      <span class="sec-dot dot-blue"></span>
                      <span class="sec-title">议题概述 (Overview)</span>
                    </div>
                    <p class="sec-content">{{ currentSummary.overview || '暂无概述' }}</p>
                  </div>

                  <!-- B. 主要讨论重点 (含 FPY, CT, WIP 等硬核数据保留) -->
                  <div class="summary-section-box">
                    <div class="sec-header">
                      <span class="sec-dot dot-cyan"></span>
                      <span class="sec-title">主要讨论内容与关键指标</span>
                    </div>
                    <p class="sec-content font-emphasis">
                      {{ currentSummary.discussionContent || '暂无讨论记录' }}
                    </p>
                  </div>

                  <!-- C. 已形成共识 -->
                  <div class="summary-section-box">
                    <div class="sec-header">
                      <span class="sec-dot dot-green"></span>
                      <span class="sec-title">已形成的共识 (Consensus)</span>
                    </div>
                    <p class="sec-content consensus-text">
                      {{ currentSummary.consensus || '讨论进行中，尚未形成充分共识' }}
                    </p>
                  </div>

                  <!-- D. 争议与不同意见 -->
                  <div class="summary-section-box">
                    <div class="sec-header">
                      <span class="sec-dot dot-orange"></span>
                      <span class="sec-title">不同意见与争议 (Controversies)</span>
                    </div>
                    <p class="sec-content controversies-text">
                      {{ currentSummary.controversies || '暂无显著意见分歧' }}
                    </p>
                  </div>

                  <!-- E. 阶段性认识与结论 -->
                  <div class="summary-section-box">
                    <div class="sec-header">
                      <span class="sec-dot dot-purple"></span>
                      <span class="sec-title">当前阶段性认识 (Interim Conclusions)</span>
                    </div>
                    <p class="sec-content conclusion-text">
                      {{ currentSummary.interimConclusions || '结论待研讨推导' }}
                    </p>
                  </div>

                  <!-- F. 尚未解决的问题 -->
                  <div class="summary-section-box">
                    <div class="sec-header">
                      <span class="sec-dot dot-red"></span>
                      <span class="sec-title">尚未解决的问题 (Open Issues)</span>
                    </div>
                    <p class="sec-content open-issues-text">
                      {{ currentSummary.openIssues || '目前无挂起未决问题' }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-else class="empty-state">
                <a-empty description="当前议题暂未生成阶段性总结">
                  <template #extra>
                    <a-button type="primary" size="small" @click="handleGenerateSummaryNow">
                      生成首版总结
                    </a-button>
                  </template>
                </a-empty>
              </div>
            </div>
          </a-tab-pane>

          <!-- 标签 2：与会人员观点 -->
          <a-tab-pane key="opinions" tab="人员观点">
            <div class="tab-pane-content">
              <div class="pane-action-bar">
                <span class="sub-hint">已提取 {{ opinions.length }} 条发言人独立观点</span>
                <a-button size="small" type="primary" ghost @click="openAddOpinionModal">
                  <PlusOutlined /> 新增观点
                </a-button>
              </div>

              <div v-if="opinions.length === 0" class="empty-state">
                <a-empty description="暂无发言人独立观点记录" />
              </div>

              <div v-else class="opinions-list">
                <div v-for="op in opinions" :key="op.opinionId" class="opinion-item-card">
                  <div class="op-head">
                    <div class="op-speaker">
                      <a-avatar size="small" style="background-color: #1677ff">
                        {{ (op.speakerName || '参')[0] }}
                      </a-avatar>
                      <span class="name">{{ op.speakerName }}</span>
                    </div>
                    <a-tag :color="getOpinionTypeColor(op.opinionType)">
                      {{ getOpinionTypeLabel(op.opinionType) }}
                    </a-tag>
                  </div>

                  <p class="op-body">{{ op.opinionContent }}</p>

                  <div class="op-foot">
                    <div class="evidence-pill" v-if="op.evidenceSegmentIds && op.evidenceSegmentIds.length > 0">
                      <span>支撑片段:</span>
                      <a-tag
                        v-for="sId in op.evidenceSegmentIds"
                        :key="sId"
                        class="seg-anchor"
                        @click="handleHighlightSegment(sId)"
                      >
                        #{{ sId }}
                      </a-tag>
                    </div>
                    <span class="op-time">{{ formatTime(op.createTime) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <!-- 标签 3：专业术语 -->
          <a-tab-pane key="terms" tab="专业术语">
            <div class="tab-pane-content">
              <div class="pane-action-bar">
                <span class="sub-hint">本议题保留的核心行业/业务专业术语</span>
              </div>

              <div v-if="topicTerms.length === 0" class="empty-state">
                <a-empty description="本议题暂无记录的专业术语" />
              </div>

              <div v-else class="terms-grid">
                <div
                  v-for="term in topicTerms"
                  :key="term.occurrenceId || term.termKey"
                  class="term-summary-card"
                  @click="openTermDetail(term)"
                >
                  <div class="term-card-header">
                    <h5 class="term-name">{{ term.termText || term.surface || term.termKey }}</h5>
                    <a-tag color="blue">{{ term.detectedDomain || term.domain || '工业制造' }}</a-tag>
                  </div>
                  <p class="term-short-def">
                    {{ term.laymanExplanation || term.explanation || '点击查看通用行业规范与企业内部统计口径对比' }}
                  </p>
                  <span class="view-detail-link">查看三层释义与口径对比 →</span>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <!-- 标签 4：阶段性结论 -->
          <a-tab-pane key="conclusions" tab="阶段结论">
            <div class="tab-pane-content">
              <div class="pane-action-bar">
                <span class="sub-hint">共 {{ conclusions.length }} 条阶段性推论与事实</span>
              </div>

              <div v-if="conclusions.length === 0" class="empty-state">
                <a-empty description="暂无阶段性结论" />
              </div>

              <div v-else class="conclusions-list">
                <div v-for="c in conclusions" :key="c.conclusionId" class="conclusion-card">
                  <div class="conclusion-top">
                    <a-tag :color="getConclusionTypeColor(c.conclusionType)">
                      {{ getConclusionTypeLabel(c.conclusionType) }}
                    </a-tag>
                    <a-tag :color="c.status === 'CONFIRMED' ? 'green' : 'orange'">
                      {{ c.status === 'CONFIRMED' ? '已人工确认' : 'AI 推论待确认' }}
                    </a-tag>
                  </div>

                  <p class="conclusion-text">{{ c.conclusionContent }}</p>

                  <div class="conclusion-meta">
                    <span v-if="c.confidence" class="confidence-val">
                      置信度: {{ Math.round(Number(c.confidence) * 100) }}%
                    </span>
                    <span v-if="c.confirmedBy" class="confirmed-by">
                      确认人: {{ c.confirmedBy }}
                    </span>
                    <div class="con-actions" v-if="c.status !== 'CONFIRMED'">
                      <a-button
                        size="small"
                        type="primary"
                        @click="handleConfirmConclusion(c.conclusionId, c.conclusionContent)"
                      >
                        确认此结论
                      </a-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <!-- 标签 5：阶段性决议 -->
          <a-tab-pane key="decisions" tab="阶段决议">
            <div class="tab-pane-content">
              <div class="decisions-alert-box">
                <InfoCircleOutlined />
                <span>
                  <strong>严谨决议原则：</strong>AI 识别的候选决议默认标记为 <strong>待确认</strong>，禁止直接擅自确认为最终执行决议。
                </span>
              </div>

              <div v-if="topicDecisions.length === 0" class="empty-state">
                <a-empty description="当前议题暂无关联决议" />
              </div>

              <div v-else class="decisions-list">
                <div v-for="d in topicDecisions" :key="d.decisionId" class="decision-card">
                  <div class="dec-header">
                    <h5 class="dec-title">{{ d.content }}</h5>
                    <a-tag :color="d.status === 'CONFIRMED' ? 'green' : 'orange'">
                      {{ d.status === 'CONFIRMED' ? '已正式确认' : 'AI候选待确认' }}
                    </a-tag>
                  </div>

                  <div class="dec-details" v-if="d.candidateOptions || d.supportReasons">
                    <div v-if="d.candidateOptions" class="dec-row">
                      <span class="label">方案选项:</span>
                      <span class="val">{{ d.candidateOptions }}</span>
                    </div>
                    <div v-if="d.supportReasons" class="dec-row">
                      <span class="label">支撑论据:</span>
                      <span class="val">{{ d.supportReasons }}</span>
                    </div>
                  </div>

                  <div class="dec-footer">
                    <span class="owner-pill">
                      责任人: <strong>{{ d.assigneeName || '未指定' }}</strong>
                    </span>
                    <a-button
                      v-if="d.status !== 'CONFIRMED'"
                      size="small"
                      type="primary"
                      @click="handleConfirmDecision(d.decisionId)"
                    >
                      确认决议
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <!-- 标签 6：证据追溯 -->
          <a-tab-pane key="evidence" tab="证据追溯">
            <div class="tab-pane-content">
              <div class="pane-action-bar">
                <span class="sub-hint">直接追溯所有结论、观点背后的发言原句与发生时间</span>
              </div>

              <div class="evidence-timeline">
                <div v-for="seg in topicSegments" :key="seg.segmentId" class="evidence-item">
                  <div class="ev-dot"></div>
                  <div class="ev-content">
                    <div class="ev-meta">
                      <span class="ev-speaker">{{ seg.speakerName || '参会人' }}</span>
                      <span class="ev-time mono">{{ formatMs(seg.startTimeMs) }}</span>
                      <a-tag class="ev-tag">#{{ seg.segmentId }}</a-tag>
                    </div>
                    <p class="ev-quote">“{{ seg.currentText }}”</p>
                    <a-button
                      type="link"
                      size="small"
                      class="seek-anchor-btn"
                      @click="handleSeek(seg.startTimeMs)"
                    >
                      跳转录像毫秒时间轴播放
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </section>
    </div>

    <!-- 弹窗 1：创建议题 -->
    <a-modal
      v-model:visible="createModalVisible"
      title="创建新研讨议题"
      @ok="handleCreateTopicOk"
      :confirmLoading="createLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="议题标题" required>
          <a-input v-model:value="newTopicForm.topicName" placeholder="如：生产良率下降原因分析" />
        </a-form-item>
        <a-form-item label="议题简介与目标">
          <a-textarea
            v-model:value="newTopicForm.description"
            rows="3"
            placeholder="说明本议题核心关注的业务问题与研讨目标..."
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 弹窗 2：议题结项 -->
    <a-modal
      v-model:visible="concludeModalVisible"
      title="议题结项与阶段性结论确认"
      @ok="handleConcludeOk"
    >
      <p>确认将议题【<strong>{{ concludeTarget?.topicName }}</strong>】标记为已形成最终结论并结项吗？</p>
      <a-form layout="vertical">
        <a-form-item label="确认的阶段性最终结论" required>
          <a-textarea
            v-model:value="concludeForm.interimConclusion"
            rows="3"
            placeholder="总结本议题讨论达成的最终定论..."
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 弹窗 3：编辑阶段性总结 -->
    <a-modal
      v-model:visible="editSummaryModalVisible"
      title="人工编辑议题阶段性总结"
      width="700px"
      @ok="handleEditSummaryOk"
    >
      <a-form layout="vertical">
        <a-form-item label="议题概述">
          <a-textarea v-model:value="editSummaryForm.overview" rows="2" />
        </a-form-item>
        <a-form-item label="主要讨论重点 (保留专业数据与术语)">
          <a-textarea v-model:value="editSummaryForm.discussionContent" rows="3" />
        </a-form-item>
        <a-form-item label="阶段性认识与结论">
          <a-textarea v-model:value="editSummaryForm.interimConclusion" rows="2" />
        </a-form-item>
        <a-form-item label="尚未解决的问题">
          <a-textarea v-model:value="editSummaryForm.openIssues" rows="2" />
        </a-form-item>
        <a-form-item label="人工修订说明">
          <a-input v-model:value="editSummaryForm.updateReason" placeholder="如：修正关于物料供应的推论" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 弹窗 4：添加观点 -->
    <a-modal
      v-model:visible="addOpinionModalVisible"
      title="记录参会人员观点"
      @ok="handleAddOpinionOk"
    >
      <a-form layout="vertical">
        <a-form-item label="发言人姓名" required>
          <a-input v-model:value="opinionForm.speakerName" placeholder="如：张工" />
        </a-form-item>
        <a-form-item label="观点类型" required>
          <a-select v-model:value="opinionForm.opinionType">
            <a-select-option value="SUPPORT">支持 (SUPPORT)</a-select-option>
            <a-select-option value="OPPOSE">反对 (OPPOSE)</a-select-option>
            <a-select-option value="SUGGESTION">建议 (SUGGESTION)</a-select-option>
            <a-select-option value="CONCERN">担忧 (CONCERN)</a-select-option>
            <a-select-option value="FACT">事实陈述 (FACT)</a-select-option>
            <a-select-option value="QUESTION">疑问 (QUESTION)</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="观点陈述内容" required>
          <a-textarea v-model:value="opinionForm.opinionContent" rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 弹窗 5：总结版本历史与演进差异 (组件) -->
    <TopicSummaryVersionModal
      v-model:visible="versionModalVisible"
      :topicName="currentTopic?.topicName || ''"
      :versions="aiStore.topicSummaryVersions"
      :loading="aiStore.topicVersionsLoading"
    />

    <!-- 弹窗 6：三层术语深度解释与口径对比 (组件) -->
    <TermDetailModal
      v-model:visible="termModalVisible"
      :term="selectedTerm"
      @seek-audio="handleSeek"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  DownOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  HistoryOutlined,
  EditOutlined
} from '@ant-design/icons-vue'
import { useMeetingAiStore } from '@/stores/meetingAi'
import TopicSummaryVersionModal from './TopicSummaryVersionModal.vue'
import TermDetailModal from './TermDetailModal.vue'

const props = defineProps({
  meetingId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['seek-audio'])

const aiStore = useMeetingAiStore()

const transcriptSearch = ref('')
const activeKnowledgeTab = ref('summary')

// 弹窗状态
const createModalVisible = ref(false)
const createLoading = ref(false)
const newTopicForm = ref({ topicName: '', description: '' })

const concludeModalVisible = ref(false)
const concludeTarget = ref(null)
const concludeForm = ref({ interimConclusion: '' })

const editSummaryModalVisible = ref(false)
const editSummaryForm = ref({
  overview: '',
  discussionContent: '',
  interimConclusion: '',
  openIssues: '',
  updateReason: ''
})

const addOpinionModalVisible = ref(false)
const opinionForm = ref({
  speakerName: '',
  opinionType: 'SUGGESTION',
  opinionContent: ''
})

const versionModalVisible = ref(false)
const termModalVisible = ref(false)
const selectedTerm = ref(null)

// 计算属性
const topics = computed(() => aiStore.topicsV2 || [])
const currentTopicId = computed(() => aiStore.currentTopicId)
const currentTopic = computed(() => topics.value.find((t) => t.topicId === currentTopicId.value))
const currentDetail = computed(() => aiStore.currentTopicDetail)
const currentSummary = computed(() => currentDetail.value?.currentSummary)
const opinions = computed(() => currentDetail.value?.opinions || [])
const conclusions = computed(() => currentDetail.value?.conclusions || [])
const topicDecisions = computed(() => currentDetail.value?.decisions || [])
const topicTerms = computed(() => {
  if (currentDetail.value?.termOccurrences && currentDetail.value.termOccurrences.length > 0) {
    return currentDetail.value.termOccurrences
  }
  return aiStore.meetingTerms || []
})

// 当前会议所有转写片段
const allSegments = computed(() => aiStore.transcriptSegments || [])

// 筛选中栏转写发言
const filteredSegments = computed(() => {
  let list = allSegments.value
  if (transcriptSearch.value && transcriptSearch.value.trim()) {
    const q = transcriptSearch.value.trim().toLowerCase()
    list = list.filter((s) => (s.currentText || '').toLowerCase().includes(q) || (s.speakerName || '').toLowerCase().includes(q))
  }
  return list
})

// 归属本议题的所有片段（用于证据追溯）
const topicSegments = computed(() => {
  return allSegments.value.filter((s) => s.topicId === currentTopicId.value)
})

// 议题状态标签工具
function getTopicStatusColor(status) {
  switch (status) {
    case 'DISCUSSING':
      return 'blue'
    case 'PAUSED':
      return 'orange'
    case 'CONCLUDED':
      return 'green'
    case 'COMPLETED':
      return 'default'
    case 'REOPENED':
      return 'purple'
    case 'NOT_STARTED':
    default:
      return 'default'
  }
}

function getTopicStatusLabel(status) {
  switch (status) {
    case 'DISCUSSING':
      return '讨论中'
    case 'PAUSED':
      return '暂停'
    case 'CONCLUDED':
      return '已形成结论'
    case 'COMPLETED':
      return '已归档'
    case 'REOPENED':
      return '重新讨论'
    case 'NOT_STARTED':
    default:
      return '未开始'
  }
}

function getTopicNameById(topicId) {
  if (!topicId) return '未指定议题'
  const found = topics.value.find((t) => t.topicId === topicId)
  return found ? found.topicName : '关联议题'
}

function getOpinionTypeColor(type) {
  switch (type) {
    case 'SUPPORT':
      return 'green'
    case 'OPPOSE':
      return 'red'
    case 'SUGGESTION':
      return 'blue'
    case 'CONCERN':
      return 'orange'
    case 'FACT':
      return 'purple'
    case 'QUESTION':
      return 'cyan'
    default:
      return 'default'
  }
}

function getOpinionTypeLabel(type) {
  switch (type) {
    case 'SUPPORT':
      return '支持'
    case 'OPPOSE':
      return '反对'
    case 'SUGGESTION':
      return '建议'
    case 'CONCERN':
      return '担忧'
    case 'FACT':
      return '事实陈述'
    case 'QUESTION':
      return '疑问'
    default:
      return '未分类'
  }
}

function getConclusionTypeColor(type) {
  switch (type) {
    case 'FINAL_CONCLUSION':
      return 'green'
    case 'INTERIM_CONCLUSION':
      return 'blue'
    case 'FACT':
      return 'purple'
    case 'HYPOTHESIS':
      return 'orange'
    default:
      return 'default'
  }
}

function getConclusionTypeLabel(type) {
  switch (type) {
    case 'FINAL_CONCLUSION':
      return '最终结论'
    case 'INTERIM_CONCLUSION':
      return '阶段性结论'
    case 'FACT':
      return '已核实事实'
    case 'HYPOTHESIS':
      return '待验证假设'
    default:
      return '推论'
  }
}

// 文本高亮专业术语正则切分
function parseTextWithTerms(text) {
  if (!text) return []
  // 识别硬核术语：FPY, CT, WIP 等
  const regex = /(FPY|CT|WIP)/gi
  const parts = []
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isTerm: false })
    }
    parts.push({ text: match[0], isTerm: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isTerm: false })
  }
  return parts.length > 0 ? parts : [{ text, isTerm: false }]
}

// 交互操作
function handleSelectTopic(topicId) {
  aiStore.selectTopic(topicId)
}

function handleRefreshTopics() {
  aiStore.loadTopicsV2(props.meetingId)
}

function handleSwitchTopic(topicId, targetStatus) {
  aiStore.switchTopicAction(topicId, targetStatus)
}

function openCreateTopicModal() {
  newTopicForm.value = { topicName: '', description: '' }
  createModalVisible.value = true
}

async function handleCreateTopicOk() {
  if (!newTopicForm.value.topicName.trim()) {
    message.warning('请输入议题标题')
    return
  }
  createLoading.value = true
  try {
    await aiStore.createTopicAction({
      meetingId: props.meetingId,
      topicName: newTopicForm.value.topicName.trim(),
      description: newTopicForm.value.description.trim()
    })
    createModalVisible.value = false
  } finally {
    createLoading.value = false
  }
}

function openConcludeModal(topic) {
  concludeTarget.value = topic
  concludeForm.value = { interimConclusion: topic.interimConclusion || '' }
  concludeModalVisible.value = true
}

async function handleConcludeOk() {
  if (!concludeForm.value.interimConclusion.trim()) {
    message.warning('请输入阶段性最终结论')
    return
  }
  await aiStore.concludeTopicAction(concludeTarget.value.topicId, concludeForm.value.interimConclusion.trim())
  concludeModalVisible.value = false
}

function handleReopenTopic(topicId) {
  aiStore.reopenTopicAction(topicId)
}

function handleReassignSegment(segmentId, targetTopicId) {
  aiStore.reassignSegmentsAction(targetTopicId, [segmentId])
}

function handleGenerateSummaryNow() {
  if (!currentTopicId.value) return
  aiStore.generateTopicSummaryNowAction(currentTopicId.value, '手动触发增量更新')
}

function openSummaryVersionModal() {
  if (!currentTopicId.value) return
  aiStore.loadTopicSummaryVersions(currentTopicId.value)
  versionModalVisible.value = true
}

function openEditSummaryModal() {
  if (!currentSummary.value) return
  editSummaryForm.value = {
    overview: currentSummary.value.overview || '',
    discussionContent: currentSummary.value.discussionContent || '',
    interimConclusion: currentSummary.value.interimConclusions || '',
    openIssues: currentSummary.value.openIssues || '',
    updateReason: ''
  }
  editSummaryModalVisible.value = true
}

async function handleEditSummaryOk() {
  await aiStore.updateTopicSummaryAction({
    topicId: currentTopicId.value,
    overview: editSummaryForm.value.overview,
    discussionContent: editSummaryForm.value.discussionContent,
    interimConclusion: editSummaryForm.value.interimConclusion,
    openIssues: editSummaryForm.value.openIssues,
    updateReason: editSummaryForm.value.updateReason || '人工调整'
  })
  editSummaryModalVisible.value = false
}

function openAddOpinionModal() {
  opinionForm.value = { speakerName: '', opinionType: 'SUGGESTION', opinionContent: '' }
  addOpinionModalVisible.value = true
}

async function handleAddOpinionOk() {
  if (!opinionForm.value.speakerName.trim() || !opinionForm.value.opinionContent.trim()) {
    message.warning('请填写发言人和观点陈述')
    return
  }
  await aiStore.modifyTopicOpinionAction({
    topicId: currentTopicId.value,
    speakerName: opinionForm.value.speakerName.trim(),
    opinionType: opinionForm.value.opinionType,
    opinionContent: opinionForm.value.opinionContent.trim()
  })
  addOpinionModalVisible.value = false
}

function handleConfirmConclusion(conclusionId, content) {
  aiStore.confirmTopicConclusionAction({
    conclusionId,
    topicId: currentTopicId.value,
    conclusionContent: content,
    status: 'CONFIRMED'
  })
}

function handleConfirmDecision(decisionId) {
  aiStore.confirmDecisionAction(decisionId, '人工在议题面板确认')
}

function handleGenerateMinutesFromTopics() {
  aiStore.generateMinutesFromTopicsAction(props.meetingId)
}

function handleTermClick(termName, seg) {
  // 匹配术语元信息
  const found = topicTerms.value.find(
    (t) => (t.surface || t.termText || '').toUpperCase() === termName.toUpperCase()
  )
  if (found) {
    selectedTerm.value = found
  } else {
    // 启发构造标准释义
    selectedTerm.value = buildSyntheticTerm(termName, seg)
  }
  termModalVisible.value = true
}

function openTermDetail(term) {
  selectedTerm.value = term
  termModalVisible.value = true
}

function buildSyntheticTerm(termName, seg) {
  const map = {
    FPY: {
      surface: 'FPY',
      standardName: 'First Pass Yield (一次良品率)',
      domain: '电子制造/工序质控',
      laymanExplanation: '产品在第一次流经生产线且无需任何返工、调试即完全合格的比例。',
      technicalDefinition: 'FPY = (初检合格品数量 / 生产总投入数量) × 100%。反映工序内在能力与稳定性。',
      enterpriseDefinition: '本企业制造部将打标后外观不良剔除后计入，与业界严苛口径存在细微差别。',
      ambiguityStatus: 'CONFLICT_DUAL',
      conflictDetails: '企业现行标准未将轻微外观瑕疵打回计入损耗，通用标准则视为不合格。'
    },
    CT: {
      surface: 'CT',
      standardName: 'Cycle Time (节拍时间/生产周期)',
      domain: '工业工程 (IE)',
      laymanExplanation: '某一道生产工序完成一件产品加工所需的平均秒数。',
      technicalDefinition: 'Cycle Time 指单一作业流程连续生产两件合格品之间的时间间隔。',
      enterpriseDefinition: '本产线标准 CT 为 14.5 秒，二号工序当前上升至 18.2 秒，导致下游等待。'
    },
    WIP: {
      surface: 'WIP',
      standardName: 'Work in Process (在制品/在途存货)',
      domain: '精益生产与物料控制',
      laymanExplanation: '正在产线上加工或在各工序之间停留排队等待加工的半成品。',
      technicalDefinition: '已投入生产但尚未全部完工入库的所有半成品与组件价值总称。',
      enterpriseDefinition: '二号工序前 WIP 警戒线为 50 件，当前积压已超 140 件。'
    }
  }
  const base = map[termName.toUpperCase()] || {
    surface: termName,
    standardName: termName,
    domain: '专业术语',
    laymanExplanation: '会议中讨论的核心指标。',
    technicalDefinition: '专业领域指标规范定义。'
  }
  return {
    ...base,
    contextSnippet: seg?.currentText || '',
    speakerName: seg?.speakerName || '',
    startTimeMs: seg?.startTimeMs || 0
  }
}

function handleHighlightSegment(segmentId) {
  aiStore.highlightSegmentId = segmentId
}

function handleSeek(startTimeMs) {
  emit('seek-audio', startTimeMs)
}

function formatMs(ms) {
  if (!ms) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleTimeString()
}

onMounted(() => {
  aiStore.loadTopicsV2(props.meetingId)
})
</script>

<style scoped>
.topic-workspace-panel {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 290px minmax(360px, 1fr) minmax(420px, 1.25fr);
  height: 100%;
  width: 100%;
  overflow: hidden;
  border-top: 1px solid #e2e8f0;
}

/* 栏目头部公用样式 */
.column-header {
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.col-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.count-pill {
  background: #e2e8f0;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
}

.header-btn-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ================= 左栏：议题导航 ================= */
.topic-nav-column {
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.minutes-synthesis-box {
  padding: 10px 14px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
}

.synthesis-btn {
  color: #1d4ed8;
  border-color: #93c5fd;
  font-weight: 600;
}

.topics-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topic-nav-card {
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.topic-nav-card:hover {
  border-color: #93c5fd;
  background: #f8fafc;
}

.topic-nav-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
}

.topic-nav-card.discussing {
  border-left: 4px solid #3b82f6;
}

.topic-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.topic-seq {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
}

.topic-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.topic-card-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.topic-metrics-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: #64748b;
  margin-top: 2px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.metric-item.pending-dec {
  color: #b45309;
  font-weight: 600;
}

.metric-item.ver-pill {
  background: #e0f2fe;
  color: #0284c7;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 700;
}

.topic-action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}

.act-btn {
  padding: 0 4px;
  font-size: 11.5px;
}

.act-btn.pause {
  color: #d97706;
}

.act-btn.conclude {
  color: #16a34a;
}

.act-btn.reopen {
  color: #9333ea;
}

/* ================= 中栏：转写流 ================= */
.transcript-feed-column {
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.current-topic-label {
  font-size: 12px;
  color: #2563eb;
  font-weight: 600;
}

.feed-filters {
  width: 170px;
}

.feed-hint-bar {
  padding: 6px 14px;
  background: #eff6ff;
  border-bottom: 1px solid #dbeafe;
  font-size: 12px;
  color: #1e40af;
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transcript-card {
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s;
}

.transcript-card.topic-matched {
  border-left: 3px solid #3b82f6;
}

.transcript-card.highlighted {
  border-color: #f59e0b;
  background: #fffbeb;
  animation: pulse 1.5s infinite;
}

.segment-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.speaker-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.speaker-avatar {
  background-color: #2563eb;
  font-size: 11px;
}

.speaker-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.timestamp {
  font-size: 11px;
  color: #94a3b8;
}

.segment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topic-tag-btn {
  cursor: pointer;
  font-size: 11.5px;
}

.play-seek-btn {
  color: #64748b;
}

.segment-content {
  font-size: 13.5px;
  line-height: 1.6;
  color: #334155;
}

/* 术语实体高亮与下划线 */
.term-underline {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  cursor: pointer;
  font-weight: 600;
  padding: 0 2px;
  border-radius: 2px;
  transition: all 0.15s;
}

.term-fpy {
  text-decoration-color: #10b981;
  color: #047857;
  background: #ecfdf5;
}

.term-ct {
  text-decoration-color: #3b82f6;
  color: #1d4ed8;
  background: #eff6ff;
}

.term-wip {
  text-decoration-color: #8b5cf6;
  color: #6d28d9;
  background: #f5f3ff;
}

/* ================= 右栏：议题知识中心 ================= */
.topic-knowledge-column {
  background: #ffffff;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.knowledge-header {
  border-bottom: 1px solid #e2e8f0;
}

.knowledge-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.ant-tabs-nav) {
  margin: 0;
  padding: 0 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

:deep(.ant-tabs-content) {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
  overflow: hidden;
}

.tab-pane-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pane-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sub-hint {
  font-size: 12.5px;
  color: #64748b;
}

/* 阶段性总结卡片 */
.summary-view-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-meta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.ver-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ver-large-tag {
  font-size: 15px;
  font-weight: 800;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 2px 8px;
  border-radius: 6px;
}

.ver-time {
  font-size: 12px;
  color: #94a3b8;
}

.evolution-reason-box {
  padding: 6px 12px;
  background: #fefce8;
  border: 1px solid #fef08a;
  border-radius: 6px;
  font-size: 12.5px;
  color: #854d0e;
}

.reason-label {
  font-weight: 700;
  margin-right: 6px;
}

.structured-summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-section-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
}

.sec-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-blue { background: #3b82f6; }
.dot-cyan { background: #06b6d4; }
.dot-green { background: #10b981; }
.dot-orange { background: #f59e0b; }
.dot-purple { background: #8b5cf6; }
.dot-red { background: #ef4444; }

.sec-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.sec-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
}

.font-emphasis {
  color: #0f172a;
  font-weight: 500;
}

.consensus-text {
  color: #047857;
}

.controversies-text {
  color: #b45309;
}

.conclusion-text {
  color: #6d28d9;
  font-weight: 600;
}

.open-issues-text {
  color: #dc2626;
}

/* 观点卡片 */
.opinions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.opinion-item-card {
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.op-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.op-speaker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.op-speaker .name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.op-body {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
}

.op-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
}

.evidence-pill {
  display: flex;
  align-items: center;
  gap: 4px;
}

.seg-anchor {
  cursor: pointer;
  font-size: 11px;
  padding: 0 4px;
}

/* 术语卡片 */
.terms-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.term-summary-card {
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.term-summary-card:hover {
  background: #eff6ff;
  border-color: #3b82f6;
}

.term-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.term-name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.term-short-def {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.view-detail-link {
  font-size: 11.5px;
  color: #2563eb;
  font-weight: 600;
  margin-top: 4px;
}

/* 阶段性结论卡片 */
.conclusions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conclusion-card {
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.conclusion-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.conclusion-card .conclusion-text {
  margin: 0 0 8px 0;
  font-size: 13.5px;
  color: #0f172a;
  line-height: 1.5;
}

.conclusion-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
  color: #64748b;
}

/* 阶段性决议 */
.decisions-alert-box {
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fef3c7;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 6px;
}

.decisions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.decision-card {
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.dec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.dec-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.dec-details {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}

.dec-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

/* 证据追溯时间线 */
.evidence-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.evidence-item {
  display: flex;
  gap: 12px;
  position: relative;
}

.ev-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3b82f6;
  margin-top: 5px;
  flex-shrink: 0;
}

.ev-content {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}

.ev-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.ev-speaker {
  font-size: 12.5px;
  font-weight: 600;
  color: #1e293b;
}

.ev-time {
  font-size: 11px;
  color: #94a3b8;
}

.ev-quote {
  margin: 0 0 6px 0;
  font-size: 13px;
  color: #334155;
  font-style: italic;
  line-height: 1.5;
}

.seek-anchor-btn {
  padding: 0;
  font-size: 12px;
}

.empty-state {
  padding: 30px 0;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
