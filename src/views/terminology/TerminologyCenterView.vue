<template>
  <div class="terminology-center-view">
    <!-- 顶部模型与架构状态横幅 -->
    <section class="hero-card meeting-card">
      <div class="hero-left">
        <div class="hero-icon">
          <BookOutlined />
        </div>
        <div>
          <h2 class="hero-title">行业术语智能理解中心</h2>
          <p class="hero-sub">
            模型优先 · 数据库辅助 · 来源可验证 — 由微调行业大模型直接完成跨行业识别、三层释义与上下文消歧
          </p>
        </div>
      </div>
      <div class="hero-right" v-if="domainsMeta">
        <a-tag color="blue">模型版本: {{ domainsMeta.modelVersion }}</a-tag>
        <a-tag color="geekblue">LoRA: {{ domainsMeta.adapterVersion }}</a-tag>
        <a-tag color="default">Prompt: {{ domainsMeta.promptVersion }}</a-tag>
        <a-tag color="green">支持领域: {{ (domainsMeta.supportedDomains || []).length }}+</a-tag>
      </div>
    </section>

    <!-- 主功能标签页 -->
    <section class="center-card meeting-card">
      <a-tabs v-model:activeKey="activeTab" class="center-tabs" @change="handleTabChange">
        <!-- 1. 模型行业知识直问 -->
        <a-tab-pane key="ask" tab="行业知识直问 (Model-First)">
          <div class="tab-content-wrap">
            <div class="ask-form-panel">
              <div class="quick-samples">
                <span class="sample-label">快速体验示例:</span>
                <a-tag
                  v-for="(s, idx) in quickSamples"
                  :key="idx"
                  color="processing"
                  class="sample-chip"
                  @click="applySample(s)"
                >
                  {{ s.label }}
                </a-tag>
              </div>

              <a-form layout="vertical">
                <a-form-item label="提问内容 / 待解析专业语句（无需提前录入词库即可直接测试）" required>
                  <a-textarea
                    v-model:value="askForm.query"
                    :rows="3"
                    placeholder="例如：本月 FPY 从 96.8% 降到了 93.2%，主要是二号工序的 CT 偏高，另外换线时出现了较多的 WIP 积压；或直接提问：CT 是什么？"
                  />
                </a-form-item>

                <div class="ask-grid-4">
                  <a-form-item label="行业领域提示（可选，不选由模型自判定）">
                    <a-select v-model:value="askForm.domainHint" allow-clear show-search placeholder="自动识别">
                      <a-select-option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</a-select-option>
                    </a-select>
                  </a-form-item>

                  <a-form-item label="输出语言">
                    <a-select v-model:value="askForm.targetLang">
                      <a-select-option value="zh">简体中文 (zh)</a-select-option>
                      <a-select-option value="en">English (en)</a-select-option>
                      <a-select-option value="th">ไทย (th)</a-select-option>
                      <a-select-option value="fil">Filipino (fil)</a-select-option>
                      <a-select-option value="id">Bahasa Indonesia (id)</a-select-option>
                      <a-select-option value="ms">Bahasa Melayu (ms)</a-select-option>
                    </a-select>
                  </a-form-item>

                  <a-form-item label="模型覆盖（可选）">
                    <a-input v-model:value="askForm.modelOverride" placeholder="默认读取后端配置" />
                  </a-form-item>

                  <a-form-item label="适配器标签（可选）">
                    <a-input v-model:value="askForm.adapterVersionOverride" placeholder="如 lora-terminology-v1" />
                  </a-form-item>
                </div>

                <a-form-item label="业务上下文 / 会议主题（可选，留空可测多义自检）">
                  <a-input
                    v-model:value="askForm.context"
                    placeholder="例如：SMT 产线周质量与采购协同复盘会议"
                  />
                </a-form-item>

                <div class="ask-actions">
                  <a-button type="primary" :loading="askLoading" @click="submitAsk">
                    <SendOutlined /> 发送模型解析
                  </a-button>
                  <a-button @click="sendToCompare">
                    <SwapOutlined /> 带入 LoRA 对比评测
                  </a-button>
                </div>
              </a-form>
            </div>

            <!-- 解析结果展示 -->
            <div v-if="askResult" class="ask-result-panel">
              <div class="result-summary-bar">
                <div class="sum-left">
                  <a-tag :color="askResult.status === 'SUCCESS' ? 'success' : 'warning'">{{ askResult.status }}</a-tag>
                  <span class="sum-text">{{ askResult.summary }}</span>
                </div>
                <div class="sum-meta mono">
                  <span>{{ askResult.modelName }} / {{ askResult.adapterVersion }}</span>
                  <span>耗时 {{ askResult.costMs ?? '-' }}ms</span>
                  <span>Trace: {{ askResult.traceId }}</span>
                </div>
              </div>

              <!-- 总结概览之后：跨域因果传导链（有向图 / 列表联动） -->
              <TerminologyCausalChainView
                v-if="askResult.causalChains && askResult.causalChains.length > 0"
                :chains="askResult.causalChains"
              />

              <div class="cards-stack">
                <TerminologyCard
                  v-for="(t, i) in (askResult.terms || [])"
                  :key="i"
                  :term="t"
                />
              </div>
            </div>
          </div>
        </a-tab-pane>

        <!-- 2. 基座模型 vs 微调 LoRA 模型对比评测 -->
        <a-tab-pane key="compare" tab="Base vs LoRA 对比评测">
          <div class="tab-content-wrap">
            <a-form layout="vertical" class="compare-form-box">
              <a-form-item label="评测问题或会议语句（同输入对比基座与 LoRA 模型表现）" required>
                <a-textarea
                  v-model:value="compareForm.query"
                  :rows="2"
                  placeholder="例如：本次 MOQ 谈不下来导致 LT 拉长到 6 周，另外二号工序 CT 偏高。"
                />
              </a-form-item>

              <div class="ask-grid-4">
                <a-form-item label="业务上下文">
                  <a-input v-model:value="compareForm.context" placeholder="采购与供应链协同会" />
                </a-form-item>
                <a-form-item label="领域提示">
                  <a-select v-model:value="compareForm.domainHint" allow-clear placeholder="自动识别">
                    <a-select-option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="基座模型名称">
                  <a-input v-model:value="compareForm.baseModelName" :placeholder="domainsMeta?.baseCompareModel || 'qwen-base'" />
                </a-form-item>
                <a-form-item label="LoRA 模型 / 适配器">
                  <a-input v-model:value="compareForm.tunedAdapterVersion" :placeholder="domainsMeta?.adapterVersion || 'lora-terminology-v1'" />
                </a-form-item>
              </div>

              <div class="compare-actions">
                <a-button type="primary" :loading="compareLoading" @click="submitCompare">
                  <ExperimentOutlined /> 运行双模型对比评测
                </a-button>
                <a-button
                  v-if="compareResult?.compareGroupId"
                  @click="openCompareTraces(compareResult.compareGroupId)"
                >
                  <AuditOutlined /> 查看对比组 Trace ({{ compareResult.compareGroupId }})
                </a-button>
              </div>
            </a-form>

            <!-- 对比结果双栏并排 -->
            <div v-if="compareResult" class="compare-result-wrap">
              <a-alert
                type="info"
                show-icon
                style="margin-bottom: 16px"
                :message="`对比组 ID: ${compareResult.compareGroupId} | 评估总结: ${compareResult.comparisonSummary || '已完成双模型并行对比'}`"
              />

              <div class="compare-columns">
                <div class="compare-col">
                  <div class="col-header base-head">
                    <span class="col-title">基座模型 (Base)</span>
                    <span class="mono col-trace">Trace: {{ compareResult.baseTraceId }}</span>
                  </div>
                  <TerminologyCausalChainView
                    v-if="compareResult.baseCausalChains && compareResult.baseCausalChains.length > 0"
                    :chains="compareResult.baseCausalChains"
                    compact
                  />
                  <div class="cards-stack" v-if="(compareResult.baseModelResults || []).length > 0">
                    <TerminologyCard
                      v-for="(t, idx) in compareResult.baseModelResults"
                      :key="idx"
                      :term="t"
                      compact
                    />
                  </div>
                  <a-empty v-else description="基座模型未返回术语项" />
                </div>

                <div class="compare-col">
                  <div class="col-header tuned-head">
                    <span class="col-title">微调模型 (LoRA Tuned)</span>
                    <span class="mono col-trace">Trace: {{ compareResult.tunedTraceId }}</span>
                  </div>
                  <TerminologyCausalChainView
                    v-if="compareResult.tunedCausalChains && compareResult.tunedCausalChains.length > 0"
                    :chains="compareResult.tunedCausalChains"
                    compact
                  />
                  <div class="cards-stack" v-if="(compareResult.tunedModelResults || []).length > 0">
                    <TerminologyCard
                      v-for="(t, idx) in compareResult.tunedModelResults"
                      :key="idx"
                      :term="t"
                      compact
                    />
                  </div>
                  <a-empty v-else description="微调模型未返回术语项" />
                </div>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <!-- 3. 企业内部术语知识库（团队共享 · 适用范围隔离） -->
        <a-tab-pane key="enterprise" tab="企业内部术语库 (团队共享)">
          <div class="tab-content-wrap">
            <a-alert
              type="info"
              show-icon
              style="margin-bottom: 14px"
              message="团队共享内部产线代号、工艺口径与物料编码知识库。若与通用行业释义冲突，系统将采用「CONFLICT_DUAL 双显策略」并行呈现，绝不覆盖通用行业解释；仅创建人或管理员可修改/删除。"
            />

            <div class="kb-toolbar">
              <div class="kb-filters">
                <a-select
                  v-model:value="entQuery.domain"
                  allow-clear
                  placeholder="全部领域"
                  style="width: 140px"
                  @change="fetchEnterprisePage(1)"
                >
                  <a-select-option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</a-select-option>
                </a-select>

                <a-select
                  v-model:value="entQuery.status"
                  allow-clear
                  placeholder="全部状态"
                  style="width: 120px"
                  @change="fetchEnterprisePage(1)"
                >
                  <a-select-option value="ACTIVE">ACTIVE (生效)</a-select-option>
                  <a-select-option value="DISABLED">DISABLED (停用)</a-select-option>
                  <a-select-option value="ARCHIVED">ARCHIVED (归档)</a-select-option>
                </a-select>

                <a-input-search
                  v-model:value="entQuery.keywordFuzzy"
                  placeholder="搜索缩写/编码/名称/范围..."
                  style="width: 240px"
                  allow-clear
                  @search="fetchEnterprisePage(1)"
                />
              </div>

              <div class="kb-actions">
                <a-button @click="openBatchImportModal">
                  <UploadOutlined /> 批量 JSON 导入
                </a-button>
                <a-button @click="handleExportEnterprise">
                  <DownloadOutlined /> 导出 JSON
                </a-button>
                <a-button type="primary" @click="openEnterpriseModal()">
                  <PlusOutlined /> 新增企业术语
                </a-button>
              </div>
            </div>

            <a-table
              :data-source="entList"
              :columns="entColumns"
              :loading="entLoading"
              :pagination="{
                current: entQuery.pageNo,
                pageSize: entQuery.pageSize,
                total: entTotal,
                showTotal: (t) => `共 ${t} 条`
              }"
              row-key="enterpriseTermId"
              size="middle"
              :scroll="{ x: 980 }"
              @change="handleEntTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'term'">
                  <div class="ent-name-cell">
                    <span class="ent-abbr">{{ record.abbreviation || record.termCode || record.canonicalName }}</span>
                    <span v-if="record.chineseName" class="ent-cn">{{ record.chineseName }}</span>
                  </div>
                  <div class="ent-sub mono" v-if="record.termCode">编码: {{ record.termCode }}</div>
                </template>

                <template v-else-if="column.key === 'domain'">
                  <a-tag color="blue">{{ record.domain || '未分类' }}</a-tag>
                  <div v-if="record.applicableScope" class="scope-line">
                    范围: <a-tag color="purple" size="small">{{ record.applicableScope }}</a-tag>
                  </div>
                </template>

                <template v-else-if="column.key === 'status'">
                  <a-tag :color="record.status === 'ACTIVE' ? 'green' : record.status === 'DISABLED' ? 'orange' : 'default'">
                    {{ record.status }}
                  </a-tag>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <a-space size="small">
                    <a-button type="link" size="small" @click="openEnterpriseDetail(record.enterpriseTermId)">详情</a-button>
                    <a-button
                      v-if="canModifyEnterprise(record)"
                      type="link"
                      size="small"
                      @click="openEnterpriseModal(record)"
                    >
                      编辑
                    </a-button>
                    <a-button
                      v-if="canModifyEnterprise(record)"
                      type="link"
                      size="small"
                      @click="handleToggleEntStatus(record)"
                    >
                      {{ record.status === 'ACTIVE' ? '停用' : '启用' }}
                    </a-button>
                    <a-popconfirm
                      v-if="canModifyEnterprise(record)"
                      title="确定归档/删除该企业术语吗？"
                      ok-text="确定"
                      cancel-text="取消"
                      @confirm="handleDeleteEnt(record)"
                    >
                      <a-button type="link" danger size="small">删除</a-button>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </a-tab-pane>

        <!-- 4. 管理员可选审核缓存（非识别前置） -->
        <a-tab-pane v-if="authStore.isAdmin" key="cache" tab="标准术语审核缓存 (管理员)">
          <div class="tab-content-wrap">
            <a-alert
              type="warning"
              show-icon
              style="margin-bottom: 14px"
              message="可选人工审核缓存 (term_verified_cache) 仅作为外部权威来源或人工定稿的对照参照；清空或停用本表绝不影响微调模型对任何新术语的直接识别与解释能力。"
            />

            <div class="kb-toolbar">
              <div class="kb-filters">
                <a-input-search
                  v-model:value="cacheQuery.keywordFuzzy"
                  placeholder="搜索缓存 termKey/名称..."
                  style="width: 240px"
                  allow-clear
                  @search="fetchCachePage(1)"
                />
                <a-select
                  v-model:value="cacheQuery.domain"
                  allow-clear
                  placeholder="全部领域"
                  style="width: 140px"
                  @change="fetchCachePage(1)"
                >
                  <a-select-option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</a-select-option>
                </a-select>
              </div>
              <div class="kb-actions">
                <a-button type="primary" @click="openCacheModal()">
                  <PlusOutlined /> 新增审核缓存
                </a-button>
              </div>
            </div>

            <a-table
              :data-source="cacheList"
              :columns="cacheColumns"
              :loading="cacheLoading"
              :pagination="{
                current: cacheQuery.pageNo,
                pageSize: cacheQuery.pageSize,
                total: cacheTotal
              }"
              row-key="cacheId"
              size="middle"
              :scroll="{ x: 900 }"
              @change="handleCacheTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'sourceType'">
                  <a-tag :color="record.sourceType === 'EXTERNAL_AUTHORITATIVE' ? 'green' : 'cyan'">
                    {{ record.sourceType }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'enabled'">
                  <a-switch
                    :checked="Boolean(record.enabled)"
                    size="small"
                    @change="(val) => handleToggleCache(record, val)"
                  />
                </template>
                <template v-else-if="column.key === 'actions'">
                  <a-space size="small">
                    <a-button type="link" size="small" @click="openCacheModal(record)">编辑</a-button>
                    <a-popconfirm title="确认删除该缓存条目？" @confirm="handleDeleteCache(record)">
                      <a-button type="link" danger size="small">删除</a-button>
                    </a-popconfirm>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </a-tab-pane>
      </a-tabs>
    </section>

    <!-- 对比评测 Trace 查看弹窗 -->
    <a-modal v-model:open="compareTracesOpen" title="模型对比 Trace 审计明细" :footer="null" width="820px">
      <a-spin :spinning="compareTracesLoading">
        <div v-if="compareTracesList.length === 0">
          <a-empty description="未查询到对比组 Trace" />
        </div>
        <div v-else class="trace-cards-wrap">
          <div v-for="tr in compareTracesList" :key="tr.traceId" class="cmp-trace-card">
            <div class="cmp-t-head">
              <strong>{{ tr.modelName }} / {{ tr.adapterVersion }}</strong>
              <span class="mono">{{ tr.costMs }}ms · tokens: {{ tr.promptTokens }}/{{ tr.completionTokens }}</span>
            </div>
            <div class="cmp-t-sub">TraceId: <span class="mono">{{ tr.traceId }}</span></div>
            <div v-if="tr.toolCallsJson" class="cmp-t-json">ToolCalls: {{ tr.toolCallsJson }}</div>
            <div v-if="tr.analysisSummary" class="cmp-t-sum">{{ tr.analysisSummary }}</div>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 新增/编辑企业内部术语弹窗 -->
    <a-modal
      v-model:open="entModalOpen"
      :title="entForm.enterpriseTermId ? '编辑企业内部术语' : '新增企业内部术语'"
      :confirm-loading="entSaving"
      width="720px"
      @ok="submitEnterpriseTerm"
    >
      <a-form layout="vertical" style="margin-top: 10px">
        <div class="modal-grid-2">
          <a-form-item label="缩写 / 简写 (如 LT)">
            <a-input v-model:value="entForm.abbreviation" placeholder="如 LT、FPY、LINE-02" />
          </a-form-item>
          <a-form-item label="企业编码 (如 SOP-LT-01)">
            <a-input v-model:value="entForm.termCode" placeholder="物料/工艺/SOP 编码" />
          </a-form-item>
        </div>

        <div class="modal-grid-2">
          <a-form-item label="标准名称" required>
            <a-input v-model:value="entForm.canonicalName" placeholder="如 Line Transfer Lead Time" />
          </a-form-item>
          <a-form-item label="中文名称">
            <a-input v-model:value="entForm.chineseName" placeholder="如 产线返修流转内部时限" />
          </a-form-item>
        </div>

        <div class="modal-grid-3">
          <a-form-item label="所属领域" required>
            <a-select v-model:value="entForm.domain" show-search>
              <a-select-option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="细分领域">
            <a-input v-model:value="entForm.subDomain" placeholder="如 SMT 车间流转" />
          </a-form-item>
          <a-form-item label="适用范围（如产线/部门）">
            <a-input v-model:value="entForm.applicableScope" placeholder="如 华南SMT一厂" />
          </a-form-item>
        </div>

        <a-form-item label="企业内部专属定义" required>
          <a-textarea v-model:value="entForm.customDefinition" :rows="2" />
        </a-form-item>

        <a-form-item label="通俗解释">
          <a-input v-model:value="entForm.plainExplanation" />
        </a-form-item>

        <a-form-item label="内部考核/统计口径说明">
          <a-input v-model:value="entForm.businessCaliber" placeholder="如 超过 4 小时未流转触发红灯预警" />
        </a-form-item>

        <div class="modal-grid-3">
          <a-form-item label="别名列表（逗号分隔）">
            <a-input v-model:value="entAliasesInput" placeholder="返修LT, 车间流转时限" />
          </a-form-item>
          <a-form-item label="来源文件">
            <a-input v-model:value="entForm.sourceName" placeholder="SOP-MFG-2026" />
          </a-form-item>
          <a-form-item label="来源版本">
            <a-input v-model:value="entForm.sourceVersion" placeholder="v2.1" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 企业术语详情弹窗 -->
    <a-modal v-model:open="entDetailOpen" title="企业术语详情" :footer="null" width="640px">
      <a-descriptions v-if="entDetailData" bordered :column="2" size="small">
        <a-descriptions-item label="标准名称">{{ entDetailData.canonicalName }}</a-descriptions-item>
        <a-descriptions-item label="缩写 / 编码">{{ entDetailData.abbreviation }} / {{ entDetailData.termCode }}</a-descriptions-item>
        <a-descriptions-item label="领域">{{ entDetailData.domain }} / {{ entDetailData.subDomain || '-' }}</a-descriptions-item>
        <a-descriptions-item label="适用范围">{{ entDetailData.applicableScope || '全团队' }}</a-descriptions-item>
        <a-descriptions-item label="企业内部定义" :span="2">{{ entDetailData.customDefinition }}</a-descriptions-item>
        <a-descriptions-item label="内部考核口径" :span="2">{{ entDetailData.businessCaliber || '-' }}</a-descriptions-item>
        <a-descriptions-item label="冲突策略">{{ entDetailData.conflictStrategy }}</a-descriptions-item>
        <a-descriptions-item label="来源版本">{{ entDetailData.sourceName }} ({{ entDetailData.sourceVersion || '-' }})</a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <!-- 批量导入 JSON 弹窗 -->
    <a-modal
      v-model:open="batchImportOpen"
      title="批量导入企业内部术语 (JSON 数组)"
      :confirm-loading="batchImporting"
      width="680px"
      @ok="submitBatchImport"
    >
      <a-textarea
        v-model:value="batchImportJson"
        :rows="10"
        placeholder='[{"abbreviation":"LT","termCode":"SOP-LT-01","canonicalName":"PCB返修内部流转时限","domain":"生产管理","customDefinition":"华南SMT一厂单块PCB返修交接时限","applicableScope":"华南SMT一厂"}]'
      />
    </a-modal>

    <!-- 管理员：新增/编辑审核缓存弹窗 -->
    <a-modal
      v-model:open="cacheModalOpen"
      :title="cacheForm.cacheId ? '编辑标准术语缓存' : '新增标准术语缓存'"
      :confirm-loading="cacheSaving"
      width="640px"
      @ok="submitCache"
    >
      <a-form layout="vertical" style="margin-top: 10px">
        <div class="modal-grid-2">
          <a-form-item label="术语 Key (termKey)" required>
            <a-input v-model:value="cacheForm.termKey" placeholder="如 FPY" />
          </a-form-item>
          <a-form-item label="显示文本 (surfaceText)">
            <a-input v-model:value="cacheForm.surfaceText" placeholder="如 FPY" />
          </a-form-item>
        </div>
        <div class="modal-grid-2">
          <a-form-item label="标准名称" required>
            <a-input v-model:value="cacheForm.canonicalName" placeholder="First Pass Yield" />
          </a-form-item>
          <a-form-item label="中文名称">
            <a-input v-model:value="cacheForm.chineseName" placeholder="一次通过率" />
          </a-form-item>
        </div>
        <div class="modal-grid-2">
          <a-form-item label="来源类型" required>
            <a-select v-model:value="cacheForm.sourceType">
              <a-select-option value="HUMAN_VERIFIED">HUMAN_VERIFIED (人工审核)</a-select-option>
              <a-select-option value="EXTERNAL_AUTHORITATIVE">EXTERNAL_AUTHORITATIVE (外部权威)</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="所属领域">
            <a-select v-model:value="cacheForm.domain" show-search>
              <a-select-option v-for="d in domainOptions" :key="d" :value="d">{{ d }}</a-select-option>
            </a-select>
          </a-form-item>
        </div>
        <a-form-item label="标准定义" required>
          <a-textarea v-model:value="cacheForm.definition" :rows="2" />
        </a-form-item>
        <div class="modal-grid-2">
          <a-form-item label="来源机构/文档名">
            <a-input v-model:value="cacheForm.sourceName" placeholder="如 ISO-9001 / IPC-A-610" />
          </a-form-item>
          <a-form-item label="版本号 / 文档编号">
            <a-input v-model:value="cacheForm.sourceVersion" placeholder="如 2024" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  BookOutlined,
  SendOutlined,
  SwapOutlined,
  ExperimentOutlined,
  AuditOutlined,
  UploadOutlined,
  DownloadOutlined,
  PlusOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMeetingAiStore } from '@/stores/meetingAi'
import {
  askTermKnowledge,
  compareTermModels,
  getCompareTermTraces,
  pageEnterpriseTerms,
  getEnterpriseTermDetail,
  saveEnterpriseTerm,
  updateEnterpriseTermStatus,
  deleteEnterpriseTerm,
  batchImportEnterpriseTerms,
  exportEnterpriseTerms,
  pageVerifiedTermCache,
  saveVerifiedTermCache,
  toggleVerifiedTermCache,
  deleteVerifiedTermCache
} from '@/api/meetingAi'
import TerminologyCard from '@/components/meeting-ai/TerminologyCard.vue'
import TerminologyCausalChainView from '@/components/meeting-ai/TerminologyCausalChainView.vue'

const authStore = useAuthStore()
const aiStore = useMeetingAiStore()

const activeTab = ref('ask')
const domainsMeta = computed(() => aiStore.termDomainsMeta)
const domainOptions = computed(() => {
  return domainsMeta.value?.supportedDomains || [
    '制造业', '质量管理', '生产管理', '采购管理', '供应链管理', '仓储物流',
    '外贸业务', '商贸业务', '财务管理', '企业经营管理', '项目管理', '信息技术'
  ]
})

// ==================== 1. 模型直问 ====================
const quickSamples = [
  {
    label: '制造与采购混合: FPY / CT / WIP / MOQ / LT',
    query: '本月 FPY 从 96.8% 降到了 93.2%，主要是二号工序的 CT 偏高，另外换线时出现了较多的 WIP 积压；同时物料 B 因未达供应商 MOQ 门槛导致 LT 拉长到 6 周。',
    context: 'SMT 产线周质量与采购协同复盘会',
    domainHint: '制造业',
    targetLang: 'zh'
  },
  {
    label: '无上下文多义自检: CT 是什么？',
    query: 'CT 是什么？',
    context: '',
    domainHint: undefined,
    targetLang: 'zh'
  },
  {
    label: '东南亚语种输出提示验证: MOQ & FOB (th)',
    query: 'MOQ and FOB terms in cross-border procurement',
    context: '外贸采购谈判会议',
    domainHint: '外贸业务',
    targetLang: 'th'
  }
]

const askForm = ref({
  query: '',
  context: '',
  domainHint: undefined,
  targetLang: 'zh',
  modelOverride: '',
  adapterVersionOverride: ''
})
const askLoading = ref(false)
const askResult = ref(null)

function applySample(s) {
  askForm.value.query = s.query
  askForm.value.context = s.context
  askForm.value.domainHint = s.domainHint
  askForm.value.targetLang = s.targetLang || 'zh'
}

async function submitAsk() {
  if (!askForm.value.query.trim()) {
    message.warning('请输入要询问的术语或业务语句')
    return
  }
  askLoading.value = true
  try {
    askResult.value = await askTermKnowledge(askForm.value)
  } catch (err) {
    message.error(err.message || '模型解析失败')
  } finally {
    askLoading.value = false
  }
}

function sendToCompare() {
  compareForm.value.query = askForm.value.query
  compareForm.value.context = askForm.value.context
  compareForm.value.domainHint = askForm.value.domainHint
  compareForm.value.targetLang = askForm.value.targetLang
  activeTab.value = 'compare'
}

// ==================== 2. Base vs LoRA 对比 ====================
const compareForm = ref({
  query: '本次 MOQ 谈不下来导致 LT 拉长到 6 周，另外二号工序 CT 偏高。',
  context: '采购与供应链协同会',
  domainHint: '供应链管理',
  targetLang: 'zh',
  baseModelName: '',
  baseAdapterVersion: 'base',
  tunedModelName: '',
  tunedAdapterVersion: ''
})
const compareLoading = ref(false)
const compareResult = ref(null)
const compareTracesOpen = ref(false)
const compareTracesLoading = ref(false)
const compareTracesList = ref([])

async function submitCompare() {
  if (!compareForm.value.query.trim()) {
    message.warning('请输入评测查询内容')
    return
  }
  compareLoading.value = true
  try {
    compareResult.value = await compareTermModels(compareForm.value)
  } catch (err) {
    message.error(err.message || '对比评测执行失败')
  } finally {
    compareLoading.value = false
  }
}

async function openCompareTraces(groupId) {
  compareTracesOpen.value = true
  compareTracesLoading.value = true
  try {
    const res = await getCompareTermTraces(groupId)
    compareTracesList.value = Array.isArray(res) ? res : []
  } catch (err) {
    message.error(err.message || '加载 Trace 失败')
  } finally {
    compareTracesLoading.value = false
  }
}

// ==================== 3. 企业内部术语库 ====================
const entQuery = ref({
  domain: undefined,
  status: undefined,
  keywordFuzzy: '',
  pageNo: 1,
  pageSize: 10
})
const entLoading = ref(false)
const entList = ref([])
const entTotal = ref(0)

const entColumns = [
  { title: '术语缩写 / 编码', key: 'term', width: 200 },
  { title: '领域与适用范围', key: 'domain', width: 170 },
  { title: '企业内部定义', dataIndex: 'customDefinition', key: 'customDefinition', ellipsis: true },
  { title: '内部考核口径', dataIndex: 'businessCaliber', key: 'businessCaliber', ellipsis: true },
  { title: '来源 / 创建人', dataIndex: 'sourceName', key: 'sourceName', width: 130 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'actions', width: 200, fixed: 'right' }
]

function canModifyEnterprise(record) {
  if (authStore.isAdmin) return true
  if (!record.createdBy) return true
  return record.createdBy === authStore.userId
}

async function fetchEnterprisePage(page = entQuery.value.pageNo) {
  entQuery.value.pageNo = page
  entLoading.value = true
  try {
    const res = await pageEnterpriseTerms(entQuery.value)
    entList.value = res?.list || []
    entTotal.value = res?.totalCount || 0
  } catch (err) {
    message.error(err.message || '查询企业术语库失败')
  } finally {
    entLoading.value = false
  }
}

function handleEntTableChange(pag) {
  fetchEnterprisePage(pag.current || 1)
}

const entModalOpen = ref(false)
const entSaving = ref(false)
const entAliasesInput = ref('')
const entForm = ref(createEmptyEntForm())

function createEmptyEntForm() {
  return {
    enterpriseTermId: '',
    termCode: '',
    canonicalName: '',
    chineseName: '',
    abbreviation: '',
    domain: '生产管理',
    subDomain: '',
    customDefinition: '',
    plainExplanation: '',
    businessCaliber: '',
    applicableScope: '',
    sourceName: '',
    sourceVersion: ''
  }
}

function openEnterpriseModal(record = null) {
  if (record) {
    entForm.value = {
      enterpriseTermId: record.enterpriseTermId || '',
      termCode: record.termCode || '',
      canonicalName: record.canonicalName || '',
      chineseName: record.chineseName || '',
      abbreviation: record.abbreviation || '',
      domain: record.domain || '生产管理',
      subDomain: record.subDomain || '',
      customDefinition: record.customDefinition || '',
      plainExplanation: record.plainExplanation || '',
      businessCaliber: record.businessCaliber || '',
      applicableScope: record.applicableScope || '',
      sourceName: record.sourceName || '',
      sourceVersion: record.sourceVersion || ''
    }
    try {
      const parsed = record.aliasesJson ? JSON.parse(record.aliasesJson) : []
      entAliasesInput.value = Array.isArray(parsed) ? parsed.join(', ') : ''
    } catch (e) {
      entAliasesInput.value = ''
    }
  } else {
    entForm.value = createEmptyEntForm()
    entAliasesInput.value = ''
  }
  entModalOpen.value = true
}

async function submitEnterpriseTerm() {
  if (!entForm.value.canonicalName?.trim() || !entForm.value.customDefinition?.trim()) {
    message.warning('请填写标准名称与企业内部定义')
    return
  }
  entSaving.value = true
  try {
    const aliases = entAliasesInput.value
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean)
    await saveEnterpriseTerm({
      ...entForm.value,
      aliases
    })
    message.success(entForm.value.enterpriseTermId ? '企业术语已更新' : '企业术语已创建')
    entModalOpen.value = false
    fetchEnterprisePage()
  } catch (err) {
    message.error(err.message || '保存企业术语失败')
  } finally {
    entSaving.value = false
  }
}

const entDetailOpen = ref(false)
const entDetailData = ref(null)

async function openEnterpriseDetail(enterpriseTermId) {
  try {
    entDetailData.value = await getEnterpriseTermDetail(enterpriseTermId)
    entDetailOpen.value = true
  } catch (err) {
    message.error(err.message || '获取详情失败')
  }
}

async function handleToggleEntStatus(record) {
  const nextStatus = record.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  try {
    await updateEnterpriseTermStatus({
      enterpriseTermId: record.enterpriseTermId,
      status: nextStatus
    })
    message.success(`状态已切换为 ${nextStatus}`)
    fetchEnterprisePage()
  } catch (err) {
    message.error(err.message || '切换状态失败')
  }
}

async function handleDeleteEnt(record) {
  try {
    await deleteEnterpriseTerm({
      enterpriseTermId: record.enterpriseTermId,
      physicalDelete: false
    })
    message.success('企业术语已归档/删除')
    fetchEnterprisePage()
  } catch (err) {
    message.error(err.message || '删除失败')
  }
}

const batchImportOpen = ref(false)
const batchImporting = ref(false)
const batchImportJson = ref('')

function openBatchImportModal() {
  batchImportJson.value = ''
  batchImportOpen.value = true
}

async function submitBatchImport() {
  try {
    const items = JSON.parse(batchImportJson.value)
    if (!Array.isArray(items) || items.length === 0) {
      message.warning('请输入非空的 JSON 数组')
      return
    }
    batchImporting.value = true
    await batchImportEnterpriseTerms(items)
    message.success(`成功导入 ${items.length} 条企业术语`)
    batchImportOpen.value = false
    fetchEnterprisePage(1)
  } catch (err) {
    message.error(err.message || '批量导入失败，请检查 JSON 格式')
  } finally {
    batchImporting.value = false
  }
}

async function handleExportEnterprise() {
  try {
    const list = await exportEnterpriseTerms({
      domain: entQuery.value.domain,
      status: entQuery.value.status,
      keywordFuzzy: entQuery.value.keywordFuzzy
    })
    const blob = new Blob([JSON.stringify(list || [], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `enterprise-terms-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    message.error(err.message || '导出失败')
  }
}

// ==================== 4. 管理员可选审核缓存 ====================
const cacheQuery = ref({
  domain: undefined,
  keywordFuzzy: '',
  pageNo: 1,
  pageSize: 10
})
const cacheLoading = ref(false)
const cacheList = ref([])
const cacheTotal = ref(0)

const cacheColumns = [
  { title: 'Key / 术语', dataIndex: 'termKey', key: 'termKey', width: 130 },
  { title: '标准名称', dataIndex: 'canonicalName', key: 'canonicalName', width: 180 },
  { title: '领域', dataIndex: 'domain', key: 'domain', width: 120 },
  { title: '来源类型', key: 'sourceType', width: 180 },
  { title: '标准定义', dataIndex: 'definition', key: 'definition', ellipsis: true },
  { title: '启用参照', key: 'enabled', width: 100 },
  { title: '操作', key: 'actions', width: 130 }
]

async function fetchCachePage(page = cacheQuery.value.pageNo) {
  if (!authStore.isAdmin) return
  cacheQuery.value.pageNo = page
  cacheLoading.value = true
  try {
    const res = await pageVerifiedTermCache(cacheQuery.value)
    cacheList.value = res?.list || []
    cacheTotal.value = res?.totalCount || 0
  } catch (err) {
    message.error(err.message || '查询审核缓存失败')
  } finally {
    cacheLoading.value = false
  }
}

function handleCacheTableChange(pag) {
  fetchCachePage(pag.current || 1)
}

const cacheModalOpen = ref(false)
const cacheSaving = ref(false)
const cacheForm = ref({})

function openCacheModal(record = null) {
  cacheForm.value = record
    ? { ...record }
    : {
        cacheId: '',
        termKey: '',
        surfaceText: '',
        canonicalName: '',
        chineseName: '',
        domain: '质量管理',
        definition: '',
        sourceType: 'HUMAN_VERIFIED',
        sourceName: '',
        sourceVersion: ''
      }
  cacheModalOpen.value = true
}

async function submitCache() {
  if (!cacheForm.value.termKey?.trim() || !cacheForm.value.canonicalName?.trim() || !cacheForm.value.definition?.trim()) {
    message.warning('请填写 termKey、标准名称和标准定义')
    return
  }
  cacheSaving.value = true
  try {
    await saveVerifiedTermCache(cacheForm.value)
    message.success('审核缓存已保存')
    cacheModalOpen.value = false
    fetchCachePage()
  } catch (err) {
    message.error(err.message || '保存审核缓存失败')
  } finally {
    cacheSaving.value = false
  }
}

async function handleToggleCache(record, enabled) {
  try {
    await toggleVerifiedTermCache({ cacheId: record.cacheId, enabled })
    record.enabled = enabled
    message.success(enabled ? '缓存条目已启用' : '缓存条目已停用（不影响模型识别）')
  } catch (err) {
    message.error(err.message || '状态更新失败')
  }
}

async function handleDeleteCache(record) {
  try {
    await deleteVerifiedTermCache({ cacheId: record.cacheId })
    message.success('缓存条目已删除')
    fetchCachePage()
  } catch (err) {
    message.error(err.message || '删除缓存失败')
  }
}

function handleTabChange(key) {
  if (key === 'enterprise' && entList.value.length === 0) {
    fetchEnterprisePage(1)
  } else if (key === 'cache' && cacheList.value.length === 0) {
    fetchCachePage(1)
  }
}

onMounted(() => {
  aiStore.loadTermDomainsMeta()
})
</script>

<style scoped>
.terminology-center-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
}

.hero-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 18px 22px;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1677ff 0%, #531dab 100%);
  color: #ffffff;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.hero-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.hero-right {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.center-card {
  padding: 12px 20px 24px;
  flex: 1;
}

.tab-content-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-samples {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.sample-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.sample-chip {
  cursor: pointer;
  margin-right: 0;
}

.ask-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 960px) {
  .ask-grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ask-actions,
.compare-actions {
  display: flex;
  gap: 10px;
}

.result-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  background: #f0f7ff;
  border: 1px solid #bae0ff;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
}

.sum-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #0958d9;
}

.sum-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary);
}

.cards-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compare-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 960px) {
  .compare-columns {
    grid-template-columns: 1fr;
  }
}

.compare-col {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  background: #fafafa;
}

.col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 2px solid #e5e6eb;
}

.base-head {
  border-bottom-color: #8c8c8c;
}

.tuned-head {
  border-bottom-color: #1677ff;
}

.col-title {
  font-weight: 700;
  font-size: 14px;
}

.col-trace {
  font-size: 11px;
  color: var(--text-secondary);
}

.kb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.kb-filters,
.kb-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ent-name-cell {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.ent-abbr {
  font-weight: 700;
  color: #1677ff;
}

.ent-cn {
  font-size: 12px;
  color: var(--text-regular);
}

.ent-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.scope-line {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.modal-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.trace-cards-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cmp-trace-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
}

.cmp-t-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.cmp-t-json {
  margin-top: 6px;
  background: #f5f7fa;
  padding: 6px 8px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
