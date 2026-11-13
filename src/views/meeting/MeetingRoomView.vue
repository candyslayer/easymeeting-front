<template>
  <div class="meeting-room-view dark-theme" ref="roomRootRef">
    <!-- 1. 顶部固定状态导航栏 (64px) -->
    <header class="room-top-header">
      <!-- 左侧：录制/转写指示、加密徽章、标题、时长、网络状态 -->
      <div class="header-left">
        <button
          type="button"
          class="rec-badge"
          :class="{ active: isTranscribing || aiStore.isAsrRunning }"
          :title="isTranscribing ? '浏览器实时采集转写运行中，点击停止' : '点击开启实时语音转写'"
          @click="handleToggleTranscription"
        >
          <span class="rec-dot" :class="{ pulsing: isTranscribing || aiStore.isAsrRunning }"></span>
          <span class="rec-text">{{ isTranscribing ? 'ASR 采集' : aiStore.isAsrRunning ? 'ASR 就绪' : '待机' }}</span>
        </button>

        <div
          class="e2ee-badge"
          :title="isWsConnected ? 'Netty WebSocket 信令与 WebRTC P2P 已就绪' : isWsReconnecting ? '正在重连信令' : '信令未连接'"
        >
          <MeetingIcon
            :name="meetingStore.meetingInfo?.joinType === 1 ? 'lock' : 'hub'"
            :size="15"
            :class="{
              'icon-online': isWsConnected,
              'icon-warn': isWsReconnecting,
              'icon-offline': !isWsConnected && !isWsReconnecting
            }"
          />
          <span class="mono">
            {{ meetingStore.meetingInfo?.joinType === 1 ? '密码入会' : 'WebRTC P2P' }} · {{ isWsConnected ? 'WS在线' : isWsReconnecting ? '重连中' : '离线' }}
          </span>
        </div>

        <div class="header-divider"></div>

        <h1 class="meeting-title ellipsis">
          {{ meetingStore.meetingInfo?.meetingName || 'EasyMeeting 会议室' }}
        </h1>

        <div class="timer-pill">
          <MeetingIcon name="schedule" :size="15" class="timer-icon" />
          <span class="mono">{{ formatDuration(meetingStore.durationSeconds) }}</span>
        </div>

        <div class="network-chip" :class="{ online: isWsConnected, warn: isWsReconnecting }">
          <MeetingIcon name="network_check" :size="15" class="network-icon" />
          <span class="mono">{{ networkStatusLabel }}</span>
        </div>
      </div>

      <!-- 中间：视图模式切换 -->
      <div class="header-center">
        <nav class="view-switcher" aria-label="会议视图切换">
          <button
            type="button"
            class="view-tab"
            :class="{ active: viewMode === 'gallery' }"
            @click="switchViewMode('gallery')"
          >
            画廊视图
          </button>
          <button
            type="button"
            class="view-tab"
            :class="{ active: viewMode === 'speaker' }"
            @click="switchViewMode('speaker')"
          >
            演讲者视图
          </button>
          <button
            type="button"
            class="view-tab"
            :class="{ active: viewMode === 'ai-collab' }"
            @click="switchViewMode('ai-collab')"
          >
            AI 协作视图
          </button>
        </nav>
      </div>

      <!-- 右侧：网格切换、全屏、离开会议、个人头像 -->
      <div class="header-right">
        <button
          type="button"
          class="header-icon-btn"
          :class="{ active: viewMode === 'gallery' && galleryEqualGrid }"
          :title="viewMode === 'gallery' ? (galleryEqualGrid ? '切回焦点画廊布局' : '切换等分多方网格') : '切至画廊视图'"
          @click="handleGridToggleBtn"
        >
          <MeetingIcon name="view_comfy" :size="19" />
        </button>

        <button
          type="button"
          class="header-icon-btn"
          :title="isStageFullscreen ? '退出全屏' : '全屏显示'"
          @click="toggleStageFullscreen"
        >
          <MeetingIcon :name="isStageFullscreen ? 'fullscreen_exit' : 'fullscreen'" :size="19" />
        </button>

        <div class="header-divider"></div>

        <!-- 主持人支持选择结束全体会议或仅离开 -->
        <a-dropdown v-if="meetingStore.isHost" placement="bottomRight">
          <button type="button" class="leave-meeting-btn">
            <MeetingIcon name="call_end" :size="17" />
            <span>离开会议</span>
          </button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="finish" @click="handleFinishMeeting">
                <span style="color: #ff4d4f; font-weight: 600">结束全体会议 (全员解散)</span>
              </a-menu-item>
              <a-menu-item key="leave" @click="handleExitMeeting">
                <span>仅离开会议 (保留房间)</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <button
          v-else
          type="button"
          class="leave-meeting-btn"
          @click="handleExitMeeting"
        >
          <MeetingIcon name="call_end" :size="17" />
          <span>离开会议</span>
        </button>

        <!-- 当前用户头像快捷菜单 -->
        <a-dropdown placement="bottomRight" trigger="click">
          <button type="button" class="user-avatar-btn" :title="authStore.nickName || '当前用户'">
            <a-avatar
              :size="32"
              :src="selfAvatarUrl"
              :load-error="() => { selfAvatarFailed = true; return true }"
              style="background: #0057c2; color: #ffffff; font-weight: 600"
            >
              {{ (authStore.nickName || '我').slice(0, 1).toUpperCase() }}
            </a-avatar>
          </button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="invite" @click="inviteModalOpen = true">
                邀请参会人
              </a-menu-item>
              <a-menu-item key="workspace" @click="openWorkspaceTab('agents')">
                打开 Agent 工作台
              </a-menu-item>
              <a-menu-item key="device" @click="deviceModalOpen = true">
                音视频设备调试
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </header>

    <!-- 2. 主工作区 -->
    <main class="room-main-shell" ref="stageContainerRef">
      <!-- 入会加载遮罩 -->
      <div v-if="joiningMeeting" class="stage-overlay">
        <a-spin size="large" />
        <span class="overlay-text">{{ loadingTip }}</span>
      </div>

      <!-- =================================================================== -->
      <!-- 视图 1：画廊视图 (72% 主焦点舞台 + 底部画廊条 | 28% EasyCopilot 协同) -->
      <!-- =================================================================== -->
      <div v-else-if="viewMode === 'gallery'" class="room-workspace">
        <!-- 顶部会议子状态条 -->
        <div class="meeting-subbar">
          <div class="subbar-left">
            <button
              type="button"
              class="meeting-id-chip"
              title="点击复制会议号"
              @click="handleCopyMeetingNo"
            >
              <span class="subbar-dot" :class="{ online: isWsConnected }"></span>
              <span class="mono">
                会议ID: {{ formatMeetingNo(meetingStore.meetingInfo?.meetingNo) || meetingId }}
              </span>
              <MeetingIcon name="content_copy" :size="13" class="copy-icon" />
            </button>

            <div class="security-pill">
              <MeetingIcon name="hub" :size="14" class="shield-icon" />
              <span>{{ isWsConnected ? '信令实时在线' : '信令连接中' }} · {{ allMembers.length }} 人在会</span>
            </div>

            <div class="subbar-feature-pills mono">
              <button
                type="button"
                class="feature-pill-btn"
                :class="{ active: isTranscribing || aiStore.isTranscriptionEnabled }"
                :disabled="aiStore.featureLoading || startingSession"
                title="切换会中实时语音转写（同步采集与后端特征开关）"
                @click="handleToggleTranscription"
              >
                <span class="fp-dot" :class="{ active: isTranscribing || aiStore.isAsrRunning }"></span>
                <span>实时转写</span>
              </button>
              <button
                type="button"
                class="feature-pill-btn"
                :class="{ active: aiStore.isLiveDecisionEnabled }"
                :disabled="aiStore.featureLoading"
                title="开启/关闭会中实时决策追踪"
                @click="aiStore.toggleFeature('live_decision', !aiStore.isLiveDecisionEnabled, meetingId)"
              >
                <span class="fp-dot" :class="{ active: aiStore.isLiveDecisionEnabled }"></span>
                <span>实时决策</span>
              </button>
              <button
                type="button"
                class="feature-pill-btn"
                :class="{ active: aiStore.isTermIntelligenceEnabled }"
                :disabled="aiStore.featureLoading"
                title="开启/关闭实时行业术语识别"
                @click="aiStore.updateTermConfig({ termIntelligenceEnabled: !aiStore.isTermIntelligenceEnabled }, meetingId)"
              >
                <span class="fp-dot" :class="{ active: aiStore.isTermIntelligenceEnabled }"></span>
                <span>术语识别</span>
              </button>
            </div>

            <button
              type="button"
              class="subbar-invite-btn"
              @click="inviteModalOpen = true"
            >
              邀请成员
            </button>
          </div>

          <div class="subbar-right">
            <span class="speaker-status-text mono">
              当前主讲：{{ spotlightMember?.nickName || authStore.nickName || '参会者' }}
              <template v-if="spotlightIsHost"> (主持人)</template>
            </span>

            <button
              type="button"
              class="ai-engine-pill"
              @click="openWorkspaceTab('agents')"
            >
              {{
                aiStore.isAnalyzing
                  ? 'Spring AI 推演中'
                  : isTranscribing || aiStore.isAsrRunning
                    ? '实时转写运行中'
                    : 'AI 工作台'
              }}
            </button>
          </div>
        </div>

        <!-- 主体 72% / 28% 分栏 -->
        <div class="room-split-body" :class="{ 'with-copilot': showDesktopCopilot }">
          <!-- LEFT & CENTER: 视频交互舞台 (72%) -->
          <section class="video-stage-column">
            <!-- 若点击右上角 view_comfy 切换了等分网格 -->
            <div v-if="galleryEqualGrid" class="gallery-stage-wrap">
              <div v-if="isAnyScreenSharing" class="gallery-share-banner">
                <div class="banner-left">
                  <MeetingIcon name="slideshow" :size="16" class="banner-icon" />
                  <span>{{ activeScreenSharer?.nickName || '参会者' }} 正在共享屏幕</span>
                </div>
                <button
                  type="button"
                  class="banner-switch-btn"
                  @click="galleryEqualGrid = false"
                >
                  聚焦共享画面
                </button>
              </div>

              <div class="video-grid" :class="gridClass">
                <VideoTile
                  v-for="member in allMembers"
                  :key="member.userId"
                  :member="member"
                  :stream="getMemberStream(member.userId)"
                  :is-self="member.userId === authStore.userId"
                  :is-host="member.userId === meetingStore.meetingInfo?.createUserId"
                  :is-speaking="isMemberSpeaking(member.userId)"
                  :is-pinned="pinnedUserId === member.userId"
                  :is-hand-raised="isMemberHandRaised(member.userId)"
                  @select="handleSelectStripMember(member)"
                />
              </div>
            </div>

            <!-- 默认画廊焦点布局：Primary Spotlight Stage + Bottom Attendees Strip -->
            <template v-else>
              <div
                class="primary-spotlight-stage"
                :class="{
                  'is-speaking': !isScreenSpotlightMode && isMemberSpeaking(spotlightMember?.userId)
                }"
              >
                <!-- 情况 1：主舞台展示屏幕共享 -->
                <template v-if="isScreenSpotlightMode">
                  <ScreenSharePlayer
                    :stream="activeScreenStream"
                    :sharer="activeScreenSharer"
                    :is-self="isScreenSharing"
                    :is-fullscreen="isStageFullscreen"
                    @stop="handleToggleScreenShare"
                    @toggle-fullscreen="toggleStageFullscreen"
                  />

                  <!-- 右上角画中画摄像头悬浮窗 -->
                  <div class="pip-camera-box" :class="{ minimized: isPipMinimized }">
                    <div class="pip-header">
                      <div class="pip-title ellipsis">
                        <MeetingIcon name="videocam" :size="13" />
                        <span class="ellipsis">{{ pipMemberMeta?.nickName || '摄像头' }}</span>
                        <span v-if="pipMemberIsSelf" class="pip-tag">(我)</span>
                      </div>
                      <div class="pip-controls">
                        <a-dropdown v-if="availablePipMembers.length > 1" placement="bottomRight">
                          <button type="button" class="pip-icon-btn" title="切换画中画成员">
                            <MeetingIcon name="picture_in_picture_alt" :size="14" />
                          </button>
                          <template #overlay>
                            <a-menu @click="handleSelectPipMember">
                              <a-menu-item
                                v-for="m in availablePipMembers"
                                :key="m.userId"
                                :class="{ 'ant-dropdown-menu-item-selected': currentPipUserId === m.userId }"
                              >
                                <span>{{ m.nickName }} {{ m.userId === authStore.userId ? '(我)' : '' }}</span>
                              </a-menu-item>
                            </a-menu>
                          </template>
                        </a-dropdown>

                        <button
                          type="button"
                          class="pip-icon-btn"
                          title="切换到发言人主画面"
                          @click="screenShareInSpotlight = false"
                        >
                          <MeetingIcon name="open_in_full" :size="14" />
                        </button>

                        <button
                          type="button"
                          class="pip-icon-btn"
                          :title="isPipMinimized ? '展开画面' : '最小化'"
                          @click="isPipMinimized = !isPipMinimized"
                        >
                          <MeetingIcon name="expand_less" :size="14" />
                        </button>
                      </div>
                    </div>

                    <div v-show="!isPipMinimized" class="pip-body">
                      <VideoTile
                        :member="pipMemberMeta"
                        :stream="pipStream"
                        :is-self="pipMemberIsSelf"
                        :is-host="pipMemberMeta?.userId === meetingStore.meetingInfo?.createUserId"
                        :is-pip="true"
                      />
                    </div>
                  </div>
                </template>

                <!-- 情况 2：主舞台展示主讲人视频画面 -->
                <template v-else>
                  <VideoTile
                    v-if="spotlightMember"
                    :member="spotlightMember"
                    :stream="spotlightStream"
                    :is-self="spotlightIsSelf"
                    :is-host="spotlightIsHost"
                    :is-speaking="isMemberSpeaking(spotlightMember.userId)"
                    :is-hand-raised="isMemberHandRaised(spotlightMember.userId)"
                    :spotlight="true"
                  />

                  <!-- 左上角悬浮主讲人信息与视频质量胶囊 -->
                  <div class="spotlight-floating-info">
                    <div class="speaker-pill">
                      <span
                        class="speaker-live-dot"
                        :class="{ speaking: isMemberSpeaking(spotlightMember?.userId) }"
                      ></span>
                      <span class="speaker-pill-name">{{ spotlightMember?.nickName || '参会者' }}</span>
                      <span class="speaker-pill-role">
                        · {{ spotlightIsHost ? '主持人' : spotlightIsSelf ? '我' : '参会者' }}
                      </span>
                      <span
                        v-if="isMemberSpeaking(spotlightMember?.userId)"
                        class="speaking-badge mono"
                      >
                        正在发言
                      </span>
                      <span v-else-if="pinnedUserId" class="pinned-badge mono">
                        已锁定焦点
                      </span>
                    </div>

                    <div class="quality-pill mono">
                      <MeetingIcon name="hd" :size="15" class="hd-icon" />
                      <span>{{ spotlightQualityLabel }}</span>
                    </div>
                  </div>

                  <!-- 右上角画中画屏幕共享预览 -->
                  <div v-if="isAnyScreenSharing" class="pip-screenshare-card">
                    <div class="pip-screen-header">
                      <div class="pip-screen-title ellipsis">
                        <MeetingIcon name="slideshow" :size="15" class="slide-icon" />
                        <span class="ellipsis">
                          {{ activeScreenSharer?.nickName || '参会者' }} · 屏幕共享
                        </span>
                      </div>
                      <button
                        type="button"
                        class="pip-icon-btn"
                        title="切回主舞台全幅展示"
                        @click="screenShareInSpotlight = true"
                      >
                        <MeetingIcon name="open_in_full" :size="14" />
                      </button>
                    </div>

                    <div class="pip-screen-preview" @click="screenShareInSpotlight = true">
                      <video
                        v-if="!isScreenSharing"
                        ref="pipScreenVideoEl"
                        autoplay
                        playsinline
                        muted
                        class="pip-screen-video"
                      ></video>
                      <div v-else class="pip-self-share-placeholder">
                        <MeetingIcon name="screen_share" :size="22" class="slide-icon" />
                        <span>您正在共享屏幕</span>
                      </div>
                      <span class="pip-sync-badge mono">实时同步中</span>
                    </div>
                  </div>
                </template>

                <!-- 底部悬停快捷控制浮动条 -->
                <div class="spotlight-hover-controls">
                  <button
                    type="button"
                    class="hover-ctrl-btn"
                    title="全屏主画面"
                    @click="toggleStageFullscreen"
                  >
                    <MeetingIcon :name="isStageFullscreen ? 'fullscreen_exit' : 'fullscreen'" :size="17" />
                  </button>

                  <button
                    v-if="isAnyScreenSharing"
                    type="button"
                    class="hover-ctrl-btn"
                    :title="screenShareInSpotlight ? '将屏幕共享切为右上画中画' : '将屏幕共享放大至主舞台'"
                    @click="screenShareInSpotlight = !screenShareInSpotlight"
                  >
                    <MeetingIcon name="picture_in_picture_alt" :size="17" />
                  </button>

                  <button
                    type="button"
                    class="hover-ctrl-btn"
                    :class="{ active: !!pinnedUserId }"
                    :title="pinnedUserId ? '取消常驻焦点锁定' : '锁定当前画面为常驻焦点'"
                    @click="togglePinSpotlight"
                  >
                    <MeetingIcon name="push_pin" :size="17" />
                  </button>

                  <button
                    type="button"
                    class="hover-ctrl-btn"
                    title="音视频与网络设置"
                    @click="deviceModalOpen = true"
                  >
                    <MeetingIcon name="signal_cellular_alt" :size="17" />
                  </button>
                </div>

                <!-- 底部 AI 实时字幕浮层 -->
                <div v-if="showSubtitles" class="ai-subtitle-overlay">
                  <div class="subtitle-card">
                    <div class="subtitle-main-line">
                      <MeetingIcon name="auto_awesome" :size="15" class="subtitle-spark-icon" />
                      <span class="subtitle-speaker">
                        【{{ latestSubtitle?.speakerName || (isTranscribing ? '实时监听' : 'AI 字幕') }}】
                      </span>
                      <span class="subtitle-text">
                        {{
                          latestSubtitleText ||
                          (isTranscribing
                            ? '正在实时识别会议语音，请发言...'
                            : 'AI 字幕已开启，点击底部「开启纪要」即可开始实时转写')
                        }}
                      </span>
                    </div>
                    <div v-if="latestSubtitleTranslation" class="subtitle-sub-line mono">
                      {{ latestSubtitleTranslation }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 底部参会人视频画廊条（仅多人参会或屏幕共享主舞台时显示，避免单人重复自己） -->
              <div v-if="allMembers.length > 1 || isScreenSpotlightMode" class="attendees-strip dark-scroll">
                <VideoTile
                  v-for="member in allMembers"
                  :key="`strip-${member.userId}`"
                  :member="member"
                  :stream="getMemberStream(member.userId)"
                  :is-self="member.userId === authStore.userId"
                  :is-host="member.userId === meetingStore.meetingInfo?.createUserId"
                  :is-speaking="isMemberSpeaking(member.userId)"
                  :is-pinned="pinnedUserId === member.userId"
                  :is-hand-raised="isMemberHandRaised(member.userId)"
                  :compact="true"
                  class="strip-tile"
                  @select="handleSelectStripMember(member)"
                />
              </div>
            </template>
          </section>

          <!-- RIGHT: EasyCopilot 智能协同 (28%) -->
          <div
            v-show="isCopilotVisible"
            class="copilot-column"
            :class="{ 'floating-drawer': !showDesktopCopilot }"
          >
            <div v-if="!showDesktopCopilot" class="floating-copilot-bar">
              <span>EasyCopilot 协同面板</span>
              <button type="button" class="floating-close-btn" @click="mobileCopilotOpen = false">
                <MeetingIcon name="close" :size="16" />
              </button>
            </div>

            <EasyCopilotPanel
              :meeting-id="meetingId"
              :segments="realtimeSegments"
              :is-transcribing="isTranscribing"
              :starting-session="startingSession"
              @toggle-transcription="toggleRealtimeSession"
              @open-workspace="openWorkspaceTab"
              @segment-revised="appendOrUpdateSegment"
            />
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- 视图 2：演讲者视图 (顶部横向缩略图条 + 9/3 主焦点舞台与可折叠速记栏) -->
      <!-- =================================================================== -->
      <div v-else-if="viewMode === 'speaker'" class="room-workspace speaker-workspace">
        <!-- 子状态条 -->
        <div class="speaker-subbar mono">
          <div class="subbar-left">
            <div class="speaker-shield-chip">
              <MeetingIcon name="hub" :size="14" />
              <span>WebRTC · Netty 信令 ({{ isWsConnected ? '实时在线' : '连接中' }})</span>
            </div>
            <div class="subbar-sep"></div>
            <div class="speaker-node-chip">
              <MeetingIcon name="stream" :size="14" class="blue-accent" />
              <span>
                主讲节点：{{ spotlightMember?.nickName || authStore.nickName || '参会者' }} ({{ spotlightQualityLabel }})
              </span>
            </div>
          </div>

          <div class="subbar-right">
            <button
              type="button"
              class="feature-pill-btn"
              :class="{ active: aiStore.isLiveDecisionEnabled }"
              :disabled="aiStore.featureLoading"
              title="开启或关闭会中实时决策追踪"
              @click="aiStore.toggleFeature('live_decision', !aiStore.isLiveDecisionEnabled, meetingId)"
            >
              <span class="fp-dot" :class="{ active: aiStore.isLiveDecisionEnabled }"></span>
              <span>{{ aiStore.isLiveDecisionEnabled ? '决策追踪已开启' : '开启决策追踪' }}</span>
            </button>
            <button
              type="button"
              class="speaker-copilot-pill"
              @click="openWorkspaceTab('decisions')"
            >
              <MeetingIcon name="auto_awesome" :size="14" />
              <span>Spring AI 决策 ({{ aiStore.confirmedDecisions.length }}/{{ aiStore.decisions.length }})</span>
            </button>
            <span class="member-count-text">已入会: {{ allMembers.length }}</span>
          </div>
        </div>

        <!-- 顶部横向参会人缩略图条 (Filmstrip) -->
        <div class="speaker-filmstrip dark-scroll">
          <div
            v-for="member in allMembers"
            :key="`film-${member.userId}`"
            class="filmstrip-card"
            :class="{
              speaking: isMemberSpeaking(member.userId),
              focused: spotlightMember?.userId === member.userId
            }"
            @click="handleSelectStripMember(member)"
          >
            <VideoTile
              :member="member"
              :stream="getMemberStream(member.userId)"
              :is-self="member.userId === authStore.userId"
              :is-host="member.userId === meetingStore.meetingInfo?.createUserId"
              :is-speaking="isMemberSpeaking(member.userId)"
              :is-pinned="pinnedUserId === member.userId"
              :is-hand-raised="isMemberHandRaised(member.userId)"
              :compact="true"
            />
            <span v-if="isMemberSpeaking(member.userId)" class="filmstrip-speaking-tag">
              <span class="ping-green-dot"></span>
              <span>当前发言</span>
            </span>
          </div>

          <!-- 末尾 AI Copilot Bot 卡片 -->
          <button
            type="button"
            class="filmstrip-bot-card"
            @click="openWorkspaceTab('agents')"
          >
            <div class="bot-avatar-ring">
              <MeetingIcon name="smart_toy" :size="20" :spin="aiStore.isAnalyzing" />
            </div>
            <span class="bot-card-name">EasyCopilot Bot</span>
            <span class="bot-card-state mono">
              <span class="bot-dot" :class="{ active: isTranscribing || aiStore.isAsrRunning || aiStore.isAnalyzing }"></span>
              <span>{{ isTranscribing ? 'ASR 实时采集中' : aiStore.isAsrRunning ? 'ASR 就绪' : aiStore.isAnalyzing ? 'Agent 分析中' : '协同就绪' }}</span>
            </span>
          </button>
        </div>

        <!-- 中央主焦点舞台 + 右侧可折叠智能纪要与速记面板 -->
        <div
          class="speaker-main-grid"
          :class="{ 'sidebar-collapsed': speakerSidebarCollapsed || isNarrowViewport }"
        >
          <!-- 左/中主焦点舞台 (9 Cols / 12 Cols when collapsed) -->
          <section class="speaker-focus-stage">
            <!-- 顶部覆盖工具条 -->
            <div class="speaker-stage-topbar">
              <div class="stage-sharer-pill">
                <MeetingIcon
                  :name="isScreenSpotlightMode ? 'screen_share' : 'videocam'"
                  :size="16"
                  class="green-accent"
                />
                <span>
                  <template v-if="isScreenSpotlightMode">
                    {{ activeScreenSharer?.nickName || '参会者' }} 正在共享屏幕
                  </template>
                  <template v-else>
                    主讲人：{{ spotlightMember?.nickName || '参会者' }}
                  </template>
                </span>
                <span class="sharer-sub-tag mono">
                  {{ isScreenSpotlightMode ? '实时画面流' : spotlightQualityLabel }}
                </span>
              </div>

              <div class="stage-utility-pill">
                <button
                  type="button"
                  class="util-btn"
                  title="适应窗口"
                  @click="speakerStageScale = 1"
                >
                  <MeetingIcon name="fit_screen" :size="16" />
                </button>
                <button
                  type="button"
                  class="util-btn"
                  title="放大画面"
                  @click="speakerStageScale = speakerStageScale >= 1.2 ? 1 : 1.15"
                >
                  <MeetingIcon name="zoom_in" :size="16" />
                </button>
                <span class="util-pct mono">{{ Math.round(speakerStageScale * 100) }}%</span>
                <button
                  type="button"
                  class="util-btn"
                  :class="{ active: !!pinnedUserId }"
                  :title="pinnedUserId ? '取消锁定焦点' : '锁定当前主讲画面'"
                  @click="togglePinSpotlight"
                >
                  <MeetingIcon name="push_pin" :size="16" />
                </button>
                <button
                  v-if="isAnyScreenSharing"
                  type="button"
                  class="util-btn"
                  :title="screenShareInSpotlight ? '切回主讲人画面' : '放大共享屏幕'"
                  @click="screenShareInSpotlight = !screenShareInSpotlight"
                >
                  <MeetingIcon name="picture_in_picture_alt" :size="16" />
                </button>
                <button
                  v-if="speakerSidebarCollapsed && !isNarrowViewport"
                  type="button"
                  class="util-expand-btn"
                  title="展开智能纪要与速记"
                  @click="speakerSidebarCollapsed = false"
                >
                  <MeetingIcon name="keyboard_double_arrow_left" :size="16" />
                  <span>速记</span>
                </button>
              </div>
            </div>

            <!-- 主舞台内容区 -->
            <div
              class="speaker-stage-media"
              :style="{ transform: `scale(${speakerStageScale})` }"
            >
              <ScreenSharePlayer
                v-if="isScreenSpotlightMode"
                :stream="activeScreenStream"
                :sharer="activeScreenSharer"
                :is-self="isScreenSharing"
                :is-fullscreen="isStageFullscreen"
                @stop="handleToggleScreenShare"
                @toggle-fullscreen="toggleStageFullscreen"
              />
              <VideoTile
                v-else-if="spotlightMember"
                :member="spotlightMember"
                :stream="spotlightStream"
                :is-self="spotlightIsSelf"
                :is-host="spotlightIsHost"
                :is-speaking="isMemberSpeaking(spotlightMember.userId)"
                :is-hand-raised="isMemberHandRaised(spotlightMember.userId)"
                :spotlight="true"
              />
            </div>

            <!-- 演讲者视图右上角悬浮画中画 (屏幕共享时展示主讲人，主讲人全幅时展示屏幕共享预览) -->
            <div v-if="isScreenSpotlightMode && spotlightMember" class="speaker-floating-pip">
              <VideoTile
                :member="spotlightMember"
                :stream="spotlightStream"
                :is-self="spotlightIsSelf"
                :is-host="spotlightIsHost"
                :is-pip="true"
              />
              <div class="pip-top-badge mono">
                <span class="ping-green-dot"></span>
                <span>{{ spotlightQualityLabel }}</span>
              </div>
              <div class="pip-bottom-info">
                <div class="pip-name-col ellipsis">
                  <span class="pip-name ellipsis">{{ spotlightMember.nickName }}</span>
                  <span class="pip-role mono">{{ spotlightIsHost ? '主持人' : '主讲人' }}</span>
                </div>
                <div class="pip-wave-bars" :class="{ active: isMemberSpeaking(spotlightMember.userId) }">
                  <span></span><span></span><span></span><span></span>
                </div>
              </div>
            </div>
            <div
              v-else-if="isAnyScreenSharing"
              class="pip-screenshare-card speaker-pip-offset"
            >
              <div class="pip-screen-header">
                <div class="pip-screen-title ellipsis">
                  <MeetingIcon name="slideshow" :size="15" class="slide-icon" />
                  <span class="ellipsis">{{ activeScreenSharer?.nickName || '参会者' }} · 屏幕共享</span>
                </div>
                <button
                  type="button"
                  class="pip-icon-btn"
                  title="切回共享屏幕主舞台"
                  @click="screenShareInSpotlight = true"
                >
                  <MeetingIcon name="open_in_full" :size="14" />
                </button>
              </div>
              <div class="pip-screen-preview" @click="screenShareInSpotlight = true">
                <video
                  v-if="!isScreenSharing"
                  ref="pipScreenVideoEl"
                  autoplay
                  playsinline
                  muted
                  class="pip-screen-video"
                ></video>
                <div v-else class="pip-self-share-placeholder">
                  <MeetingIcon name="screen_share" :size="20" class="slide-icon" />
                  <span>您正在共享屏幕</span>
                </div>
                <span class="pip-sync-badge mono">实时同步中</span>
              </div>
            </div>

            <!-- 底部居中多语双行 AI 字幕浮层 -->
            <div v-if="showSubtitles" class="speaker-subtitle-overlay">
              <div class="speaker-subtitle-card">
                <div class="sub-translate-badge">
                  <MeetingIcon name="translate" :size="16" />
                </div>
                <div class="sub-body">
                  <div class="sub-meta-row">
                    <span class="sub-speaker-name">
                      {{ latestSubtitle?.speakerName || spotlightMember?.nickName || 'AI 字幕' }}
                    </span>
                    <span class="sub-time mono">
                      {{ latestSubtitle ? formatTranscriptMs(latestSubtitle.startTimeMs) : formatDuration(meetingStore.durationSeconds) }}
                    </span>
                    <span class="sub-asr-badge mono">
                      {{ isTranscribing ? '实时 ASR' : '待机' }}
                    </span>
                  </div>
                  <p class="sub-zh-text">
                    {{
                      latestSubtitleText ||
                      (isTranscribing
                        ? '正在实时识别会议语音，请发言...'
                        : 'AI 字幕已开启，点击底部「开启纪要」即可开始实时转写')
                    }}
                  </p>
                  <p v-if="latestSubtitleTranslation" class="sub-en-text mono">
                    {{ latestSubtitleTranslation }}
                  </p>
                </div>
                <button
                  type="button"
                  class="sub-setting-btn"
                  title="关闭/设置字幕"
                  @click="showSubtitles = false"
                >
                  <MeetingIcon name="settings" :size="16" />
                </button>
              </div>
            </div>
          </section>

          <!-- 右侧可折叠面板：智能纪要与速记 (3 Cols) -->
          <div
            v-if="!speakerSidebarCollapsed && !isNarrowViewport"
            class="speaker-sidebar-col"
          >
            <SpeakerMinutesPanel
              :meeting-id="meetingId"
              :segments="realtimeSegments"
              :is-transcribing="isTranscribing"
              :hand-raised-members="handRaisedMembers"
              @collapse="speakerSidebarCollapsed = true"
              @open-workspace="openWorkspaceTab"
            />
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- 视图 3：AI 协作视图 (左 7 Cols 视频+4宫格+实时转写 | 右 5 Cols AI 协同画布) -->
      <!-- =================================================================== -->
      <div v-else class="room-workspace ai-collab-workspace">
        <!-- 顶部动态协作引擎状态条 -->
        <div class="collab-banner">
          <div class="collab-banner-left">
            <div class="engine-brand">
              <span class="engine-ping-wrap">
                <span class="engine-ping" :class="{ active: isTranscribing || aiStore.isAsrRunning || aiStore.isAnalyzing }"></span>
                <span class="engine-dot"></span>
              </span>
              <span class="engine-name">SPRING AI MULTI-AGENT ENGINE</span>
            </div>
            <div class="subbar-sep"></div>
            <div class="collab-feature-toggles mono">
              <button
                type="button"
                class="feature-pill-btn"
                :class="{ active: isTranscribing || aiStore.isTranscriptionEnabled }"
                :disabled="aiStore.featureLoading || startingSession"
                @click="handleToggleTranscription"
              >
                <span class="fp-dot" :class="{ active: isTranscribing || aiStore.isAsrRunning }"></span>
                <span>转写 {{ isTranscribing ? '采集中' : aiStore.isAsrRunning ? '就绪' : '待机' }}</span>
              </button>
              <button
                type="button"
                class="feature-pill-btn"
                :class="{ active: aiStore.isLiveDecisionEnabled }"
                :disabled="aiStore.featureLoading"
                @click="aiStore.toggleFeature('live_decision', !aiStore.isLiveDecisionEnabled, meetingId)"
              >
                <span class="fp-dot" :class="{ active: aiStore.isLiveDecisionEnabled }"></span>
                <span>实时决策</span>
              </button>
              <button
                type="button"
                class="feature-pill-btn"
                :class="{ active: aiStore.isTermIntelligenceEnabled }"
                :disabled="aiStore.featureLoading"
                @click="aiStore.updateTermConfig({ termIntelligenceEnabled: !aiStore.isTermIntelligenceEnabled }, meetingId)"
              >
                <span class="fp-dot" :class="{ active: aiStore.isTermIntelligenceEnabled }"></span>
                <span>术语识别</span>
              </button>
            </div>
            <span v-if="aiStore.termDomainsMeta?.modelVersion" class="collab-model-tag mono">
              {{ aiStore.termDomainsMeta.modelVersion }}
              <template v-if="aiStore.termDomainsMeta.adapterVersion">
                · {{ aiStore.termDomainsMeta.adapterVersion }}
              </template>
            </span>
          </div>

          <div class="collab-banner-right mono">
            <span>
              决议/术语: <strong>{{ aiStore.decisions.length }}</strong> / <strong>{{ aiStore.meetingTerms.length }}</strong>
            </span>
            <span class="dot-sep"></span>
            <span>
              共识确认: <strong class="green-accent">{{ consensusRateText }}</strong>
            </span>
            <button
              type="button"
              class="banner-analyze-btn"
              :disabled="aiStore.isAnalyzing"
              @click="aiStore.triggerAnalysis(meetingId, true)"
            >
              <MeetingIcon name="sync" :size="12" :spin="aiStore.isAnalyzing" />
              <span>{{ aiStore.isAnalyzing ? '推演中' : '触发分析' }}</span>
            </button>
          </div>
        </div>

        <!-- 12 栏双工分栏：左 7 Cols (~58%) | 右 5 Cols (~42%) -->
        <div class="ai-collab-grid">
          <!-- LEFT PANE (7 Cols): 上方主视频 + 中间 4 人缩略格 + 下方实时转写流 -->
          <section class="collab-left-pane">
            <!-- Upper Stage: 主视频画面 + 声波降噪标签 + 右上角画中画 -->
            <div class="collab-upper-stage">
              <ScreenSharePlayer
                v-if="isScreenSpotlightMode"
                :stream="activeScreenStream"
                :sharer="activeScreenSharer"
                :is-self="isScreenSharing"
                :is-fullscreen="isStageFullscreen"
                @stop="handleToggleScreenShare"
                @toggle-fullscreen="toggleStageFullscreen"
              />
              <VideoTile
                v-else-if="spotlightMember"
                :member="spotlightMember"
                :stream="spotlightStream"
                :is-self="spotlightIsSelf"
                :is-host="spotlightIsHost"
                :is-speaking="isMemberSpeaking(spotlightMember.userId)"
                :is-hand-raised="isMemberHandRaised(spotlightMember.userId)"
                :spotlight="true"
              />

              <!-- 左上角说话人标签 -->
              <div class="collab-speaker-overlay">
                <div class="collab-speaker-pill">
                  <span
                    class="collab-dot"
                    :class="{ active: isMemberSpeaking(spotlightMember?.userId) }"
                  ></span>
                  <span class="collab-speaker-name">
                    {{ spotlightMember?.nickName || '参会者' }} ({{ spotlightIsHost ? '主持人' : spotlightIsSelf ? '我' : '参会者' }})
                  </span>
                  <MeetingIcon
                    :name="spotlightMember?.openAudio !== false ? 'mic' : 'mic_off'"
                    :size="15"
                    class="blue-dim-icon"
                  />
                </div>
                <span class="collab-speaking-time mono">
                  {{ isMemberSpeaking(spotlightMember?.userId) ? '发言中' : '焦点' }} • {{ formatDuration(meetingStore.durationSeconds) }}
                </span>
              </div>

              <!-- 左下角麦克风与采集状态指示 -->
              <div class="collab-soundwave-pill">
                <div class="wave-bars" :class="{ active: isAudioActive || isMemberSpeaking(spotlightMember?.userId) }">
                  <span class="w-bar b1"></span>
                  <span class="w-bar b2"></span>
                  <span class="w-bar b3"></span>
                  <span class="w-bar b4"></span>
                </div>
                <span class="mono wave-text">
                  {{
                    !isAudioActive
                      ? '本地麦克风已静音'
                      : isTranscribing
                        ? '本地采集 + ASR 实时流'
                        : aiStore.isAsrRunning
                          ? '麦克风开启 · ASR 就绪'
                          : 'WebRTC 音频推流中'
                  }}
                </span>
              </div>

              <!-- 右上角画中画：屏幕共享 / 实时术语与管线摘要 -->
              <div
                class="collab-pip-card"
                @click="isAnyScreenSharing ? (screenShareInSpotlight = !screenShareInSpotlight) : aiStore.meetingTerms.length > 0 ? openWorkspaceTab('terminology') : handleToggleScreenShare()"
                :title="isAnyScreenSharing ? '点击切换主画面与画中画' : aiStore.meetingTerms.length > 0 ? '点击查看术语智能理解' : '点击发起屏幕共享'"
              >
                <div class="collab-pip-header">
                  <span class="collab-pip-title mono ellipsis">
                    <MeetingIcon
                      :name="isAnyScreenSharing ? 'present_to_all' : 'hub'"
                      :size="13"
                      class="green-accent"
                    />
                    <span class="ellipsis">
                      {{
                        isAnyScreenSharing
                          ? `屏幕共享: ${activeScreenSharer?.nickName || '参会者'}`
                          : aiStore.meetingTerms.length > 0
                            ? `术语追踪 (${aiStore.meetingTerms.length})`
                            : '转写与分析管线'
                      }}
                    </span>
                  </span>
                  <span class="collab-pip-tag mono">
                    {{ isAnyScreenSharing ? '切换' : isTranscribing ? '采集' : aiStore.isAsrRunning ? 'ASR' : '待机' }}
                  </span>
                </div>

                <div class="collab-pip-body">
                  <template v-if="isAnyScreenSharing && !screenShareInSpotlight">
                    <video
                      v-if="!isScreenSharing"
                      ref="aiCollabPipVideoEl"
                      autoplay
                      playsinline
                      muted
                      class="collab-pip-video"
                    ></video>
                    <div v-else class="collab-pip-placeholder">
                      <MeetingIcon name="screen_share" :size="20" class="blue-accent" />
                      <span>您正在共享屏幕</span>
                    </div>
                  </template>
                  <template v-else-if="isScreenSpotlightMode && spotlightMember">
                    <VideoTile
                      :member="spotlightMember"
                      :stream="spotlightStream"
                      :is-self="spotlightIsSelf"
                      :is-host="spotlightIsHost"
                      :is-pip="true"
                    />
                  </template>
                  <div v-else class="collab-pip-status mono">
                    <div class="pip-stat-line">
                      <span>转写切片</span>
                      <strong>{{ realtimeSegments.length }}</strong>
                    </div>
                    <div class="pip-stat-line">
                      <span>识别术语</span>
                      <strong>{{ aiStore.meetingTerms.length }}</strong>
                    </div>
                    <div class="pip-stat-line" v-if="aiStore.meetingTerms[0]">
                      <span class="ellipsis c-blue">{{ aiStore.meetingTerms[0].canonicalName || aiStore.meetingTerms[0].surface }}</span>
                    </div>
                    <div class="pip-stat-hint">
                      {{ aiStore.meetingTerms.length > 0 ? '点击打开术语详情' : '点击发起屏幕共享' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mid Stage: 4 格参会人画廊条 -->
            <div class="collab-attendees-row">
              <VideoTile
                v-for="member in collabGalleryMembers"
                :key="`collab-${member.userId}`"
                :member="member"
                :stream="getMemberStream(member.userId)"
                :is-self="member.userId === authStore.userId"
                :is-host="member.userId === meetingStore.meetingInfo?.createUserId"
                :is-speaking="isMemberSpeaking(member.userId)"
                :is-pinned="pinnedUserId === member.userId"
                :is-hand-raised="isMemberHandRaised(member.userId)"
                :compact="true"
                class="collab-attendee-tile"
                @select="handleSelectStripMember(member)"
              />
            </div>

            <!-- Lower Stage: 实时转写流面板 -->
            <div class="collab-transcript-panel">
              <div class="transcript-panel-head">
                <div class="tp-head-left">
                  <MeetingIcon name="subtitles" :size="18" class="blue-accent" />
                  <span class="tp-title">实时语音转写流 (ASR)</span>
                  <span class="tp-latency-pill mono">
                    {{
                      isTranscribing
                        ? '本地采集中'
                        : aiStore.isAsrRunning
                          ? 'ASR 运行中'
                          : realtimeSegments.length > 0
                            ? `已沉淀 ${realtimeSegments.length} 条`
                            : '等待开启'
                    }}
                  </span>
                </div>
                <div class="tp-head-actions">
                  <button
                    type="button"
                    class="tp-action-btn"
                    :disabled="aiStore.terminologyAnalyzing"
                    @click="aiStore.triggerMeetingTermAnalysis({}, meetingId)"
                  >
                    {{ aiStore.terminologyAnalyzing ? '识别中...' : '同步识别术语' }}
                  </button>
                  <button
                    type="button"
                    class="tp-action-btn"
                    @click="openWorkspaceTab('transcript')"
                  >
                    全部记录
                  </button>
                  <button
                    type="button"
                    class="tp-action-btn"
                    @click="handleExportTranscript"
                  >
                    导出字幕
                  </button>
                </div>
              </div>

              <div class="transcript-panel-scroll dark-scroll" ref="collabTranscriptScrollRef">
                <div v-if="realtimeSegments.length === 0" class="tp-empty">
                  <span>暂无实时转写记录</span>
                  <button
                    type="button"
                    class="tp-start-btn"
                    :disabled="startingSession"
                    @click="handleToggleTranscription"
                  >
                    {{ startingSession ? '正在开启...' : '开启实时转写' }}
                  </button>
                </div>

                <div
                  v-for="(seg, idx) in realtimeSegments"
                  :key="seg.segmentId || `collab-seg-${idx}`"
                  class="tp-item"
                  :class="{ 'is-live': idx === realtimeSegments.length - 1 && isTranscribing }"
                >
                  <span class="tp-time mono">
                    {{
                      idx === realtimeSegments.length - 1 && isTranscribing
                        ? '实时'
                        : formatTranscriptMs(seg.startTimeMs)
                    }}
                  </span>
                  <div class="tp-content">
                    <div class="tp-speaker-row">
                      <span
                        class="tp-speaker-name"
                        :class="{ green: idx === realtimeSegments.length - 1 && isTranscribing }"
                      >
                        {{ seg.speakerName || '参会发言人' }}
                      </span>
                      <span class="tp-role-badge">
                        {{ seg.speakerUserId === meetingStore.meetingInfo?.createUserId ? '主讲' : '发言' }}
                      </span>
                    </div>
                    <p class="tp-text">
                      <span>{{ seg.currentText || seg.text || seg.originalText }}</span>
                      <span
                        v-if="idx === realtimeSegments.length - 1 && isTranscribing"
                        class="live-cursor"
                      ></span>
                    </p>
                    <p v-if="seg.translatedText" class="tp-translation">
                      “{{ seg.translatedText }}”
                    </p>
                  </div>
                  <button
                    type="button"
                    class="tp-bookmark-btn"
                    title="复制该句转写"
                    @click="handleCopySegmentText(seg)"
                  >
                    <MeetingIcon name="bookmark_add" :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- RIGHT PANE (5 Cols): EasyCopilot Live 实时协作画布 -->
          <section v-if="!isNarrowViewport" class="collab-right-pane">
            <AiCollabPanel
              :meeting-id="meetingId"
              :segments="realtimeSegments"
              :is-transcribing="isTranscribing"
              @open-workspace="openWorkspaceTab"
            />
          </section>
        </div>
      </div>

      <!-- 窄屏模式下的浮动 EasyCopilot 抽屉（在非 gallery 视图下也可随时呼出） -->
      <div
        v-if="isNarrowViewport && mobileCopilotOpen && viewMode !== 'gallery'"
        class="copilot-column floating-drawer"
      >
        <div class="floating-copilot-bar">
          <span>EasyCopilot 协同面板</span>
          <button type="button" class="floating-close-btn" @click="mobileCopilotOpen = false">
            <MeetingIcon name="close" :size="16" />
          </button>
        </div>

        <EasyCopilotPanel
          :meeting-id="meetingId"
          :segments="realtimeSegments"
          :is-transcribing="isTranscribing"
          :starting-session="startingSession"
          @toggle-transcription="toggleRealtimeSession"
          @open-workspace="openWorkspaceTab"
          @segment-revised="appendOrUpdateSegment"
        />
      </div>
    </main>

    <!-- 3. 底部固定控制工具栏 (76px) -->
    <MeetingToolbar
      :is-audio-active="isAudioActive"
      :is-video-active="isVideoActive"
      :is-screen-sharing="isScreenSharing"
      :member-count="meetingStore.memberList.length || allMembers.length"
      :unread-chat-count="unreadChatCount"
      :is-participants-open="participantsOpen"
      :is-chat-open="chatOpen"
      :is-subtitles-open="showSubtitles"
      :is-hand-raised="isHandRaised"
      :is-transcribing="isTranscribing"
      :is-ai-open="isCopilotVisible"
      :audio-devices="mediaStore.audioInputDevices"
      :video-devices="mediaStore.videoInputDevices"
      :selected-audio-device-id="mediaStore.selectedAudioInputId"
      :selected-video-device-id="mediaStore.selectedVideoInputId"
      @toggle-audio="handleToggleAudio"
      @toggle-video="handleToggleVideo"
      @switch-audio-device="handleSwitchAudioDevice"
      @switch-video-device="handleSwitchVideoDevice"
      @toggle-subtitles="showSubtitles = !showSubtitles"
      @toggle-screen-share="handleToggleScreenShare"
      @toggle-participants="participantsOpen = !participantsOpen"
      @toggle-hand-raise="handleToggleHandRaise"
      @toggle-transcription="handleToggleTranscription"
      @toggle-chat="handleToggleChat"
      @open-settings="deviceModalOpen = true"
      @toggle-ai="handleToggleCopilotDrawer"
    />

    <!-- 右侧抽屉：参会人员 -->
    <ParticipantDrawer
      v-model:open="participantsOpen"
      :members="meetingStore.memberList"
      :current-user-id="authStore.userId"
      :host-user-id="meetingStore.meetingInfo?.createUserId || ''"
      :meeting-id="meetingId"
    />

    <!-- 右侧抽屉：会议聊天与共享 -->
    <ChatDrawer
      v-model:open="chatOpen"
      :messages="meetingStore.chatMessages"
      :members="meetingStore.memberList"
      :current-user-id="authStore.userId"
      :meeting-id="meetingId"
    />

    <!-- 音视频设备快速设置弹窗 -->
    <DeviceTestModal v-model:open="deviceModalOpen" />

    <!-- 邀请成员弹窗 -->
    <InviteModal
      v-model:open="inviteModalOpen"
      :meeting-info="meetingStore.meetingInfo"
    />

    <!-- 会内全屏 Agent 智能工作台（保持音视频与信令不断开） -->
    <MeetingAiWorkspaceModal
      v-model:open="workspaceModalOpen"
      :meeting-id="meetingId"
      :initial-tab="workspaceInitialTab"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import { useMeetingStore } from '@/stores/meeting'
import { useMeetingAiStore } from '@/stores/meetingAi'
import { useMediaStore } from '@/stores/media'
import { useMediaDevices } from '@/composables/useMediaDevices'
import { useWebSocket } from '@/composables/useWebSocket'
import { useWebRTC } from '@/composables/useWebRTC'
import { useRealtimeCopilot } from '@/composables/useRealtimeCopilot'
import {
  getCurrentMeeting,
  jionMeeting,
  getMeetingMemberList,
  exitMeeting,
  finishMeeting,
  updateMemberMediaState,
  loadChatMessage
} from '@/api/meeting'
import { formatMeetingNo, formatDuration, copyText } from '@/utils/format'
import { formatTranscriptMs } from '@/utils/transcript'
import MeetingIcon from '@/components/meeting/MeetingIcon.vue'
import VideoTile from '@/components/meeting/VideoTile.vue'
import ScreenSharePlayer from '@/components/meeting/ScreenSharePlayer.vue'
import EasyCopilotPanel from '@/components/meeting/EasyCopilotPanel.vue'
import SpeakerMinutesPanel from '@/components/meeting/SpeakerMinutesPanel.vue'
import AiCollabPanel from '@/components/meeting/AiCollabPanel.vue'
import MeetingToolbar from '@/components/meeting/MeetingToolbar.vue'
import ParticipantDrawer from '@/components/meeting/ParticipantDrawer.vue'
import ChatDrawer from '@/components/meeting/ChatDrawer.vue'
import MeetingAiWorkspaceModal from '@/components/meeting-ai/MeetingAiWorkspaceModal.vue'
import DeviceTestModal from '@/components/common/DeviceTestModal.vue'
import InviteModal from '@/components/common/InviteModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const meetingStore = useMeetingStore()
const aiStore = useMeetingAiStore()
const mediaStore = useMediaStore()

const meetingId = computed(() => String(route.params.id || ''))

const joiningMeeting = ref(true)
const loadingTip = ref('正在接入会议系统...')
const participantsOpen = ref(false)
const chatOpen = ref(false)
const workspaceModalOpen = ref(false)
const workspaceInitialTab = ref('agents')
const deviceModalOpen = ref(false)
const inviteModalOpen = ref(false)
const unreadChatCount = ref(0)

// 布局视图与协同状态
const viewMode = ref('gallery') // 'gallery' | 'speaker' | 'ai-collab'
const galleryEqualGrid = ref(false)
const speakerSidebarCollapsed = ref(false)
const speakerStageScale = ref(1)
const mobileCopilotOpen = ref(false)
const showSubtitles = ref(true)
const isHandRaised = ref(false)
const pinnedUserId = ref(null)
const screenShareInSpotlight = ref(true)

// 视口宽度响应式监听
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
const isNarrowViewport = computed(() => windowWidth.value <= 1024)
const showDesktopCopilot = computed(() => viewMode.value === 'gallery' && !isNarrowViewport.value)
const isCopilotVisible = computed(() => showDesktopCopilot.value || mobileCopilotOpen.value)

function handleWindowResize() {
  windowWidth.value = window.innerWidth
}

// 头像状态
const selfAvatarFailed = ref(false)
const selfAvatarUrl = computed(() => {
  if (!authStore.userId || selfAvatarFailed.value) return undefined
  const base = import.meta.env?.VITE_API_BASE_URL || '/api'
  return `${base}/account/getAvatar/${encodeURIComponent(authStore.userId)}`
})

// 路由守卫：防止会中误跳转到外链工作台退出会议
onBeforeRouteLeave((to, from, next) => {
  if (to.path && to.path.startsWith('/meeting/ai/')) {
    workspaceModalOpen.value = true
    next(false)
    return
  }
  next()
})

// 全屏与 PiP 控制
const roomRootRef = ref(null)
const stageContainerRef = ref(null)
const isStageFullscreen = ref(false)
const isPipMinimized = ref(false)
const selectedPipUserId = ref(null)
const pipScreenVideoEl = ref(null)
const aiCollabPipVideoEl = ref(null)
const collabTranscriptScrollRef = ref(null)

// 1. 媒体设备管理
const {
  localStream,
  screenStream,
  isAudioActive,
  isVideoActive,
  isScreenSharing,
  initLocalStream,
  toggleAudio,
  toggleVideo,
  switchAudioInputDevice,
  switchVideoInputDevice,
  startScreenShare,
  stopScreenShare,
  stopAllTracks
} = useMediaDevices()

// 2. WebSocket 信令连接
const {
  isConnected: isWsConnected,
  isReconnecting: isWsReconnecting,
  connect: connectWs,
  disconnect: disconnectWs,
  send: sendWs,
  on: onWs
} = useWebSocket()

// 3. WebRTC P2P Mesh 协商
const {
  remoteStreams: rtcRemoteStreams,
  peerConnections,
  initiateOffer,
  handleSignal,
  replaceTrackForAllPeers,
  closePeer,
  closeAllPeers
} = useWebRTC({ send: sendWs }, localStream)

// 4. 实时转写与多 Agent 数据流（独立 Composable，切换视图不断线）
const {
  isSessionActive,
  startingSession,
  realtimeSegments,
  toggleRealtimeSession,
  appendOrUpdateSegment
} = useRealtimeCopilot({
  meetingId,
  localStream,
  remoteStreams: rtcRemoteStreams,
  onWs
})

const isTranscribing = computed(() => isSessionActive.value || aiStore.isAsrRunning)

async function handleToggleTranscription() {
  const wasActive = isSessionActive.value
  await toggleRealtimeSession()
  if (meetingId.value && isSessionActive.value !== wasActive) {
    aiStore.toggleFeature('transcription', isSessionActive.value, meetingId.value).catch(() => {})
  }
}

// 本地参会者元信息
const localMemberMeta = computed(() => ({
  userId: authStore.userId,
  nickName: authStore.nickName || '我',
  openAudio: isAudioActive.value,
  openVideo: isVideoActive.value,
  screenShare: isScreenSharing.value
}))

// 全部参会成员（本地置顶 + 远端）
const allMembers = computed(() => {
  return [localMemberMeta.value, ...meetingStore.remoteMemberList]
})

const collabGalleryMembers = computed(() => {
  return allMembers.value.slice(0, 4)
})

const handRaisedMembers = computed(() => {
  return allMembers.value.filter((m) => isMemberHandRaised(m.userId))
})

function getMemberStream(userId) {
  if (userId === authStore.userId) return localStream.value
  return rtcRemoteStreams[userId] || null
}

// 屏幕共享状态
const isAnyScreenSharing = computed(() => isScreenSharing.value || !!meetingStore.screenSharer)
const isScreenSpotlightMode = computed(() => isAnyScreenSharing.value && screenShareInSpotlight.value)

const activeScreenSharer = computed(() => {
  if (isScreenSharing.value) return localMemberMeta.value
  return meetingStore.screenSharer
})

const activeScreenStream = computed(() => {
  if (isScreenSharing.value) return screenStream.value
  const sharer = meetingStore.screenSharer
  if (sharer && rtcRemoteStreams[sharer.userId]) {
    return rtcRemoteStreams[sharer.userId]
  }
  return null
})

watch(isAnyScreenSharing, (sharing, prev) => {
  if (sharing && !prev) {
    screenShareInSpotlight.value = true
  }
})

watch([activeScreenStream, screenShareInSpotlight, isAnyScreenSharing, viewMode], () => {
  nextTick(() => {
    const targets = [pipScreenVideoEl.value, aiCollabPipVideoEl.value].filter(Boolean)
    targets.forEach((el) => {
      if (isAnyScreenSharing.value && !screenShareInSpotlight.value && activeScreenStream.value) {
        if (el.srcObject !== activeScreenStream.value) {
          el.srcObject = activeScreenStream.value
        }
        el.play?.().catch(() => {})
      } else {
        el.srcObject = null
      }
    })
  })
})

watch(
  () => realtimeSegments.value.length,
  () => {
    if (viewMode.value === 'ai-collab') {
      nextTick(() => {
        if (collabTranscriptScrollRef.value) {
          collabTranscriptScrollRef.value.scrollTop = collabTranscriptScrollRef.value.scrollHeight
        }
      })
    }
  }
)

// AI 协作视图顶部指标
const topologyNodeCount = computed(() => {
  return (
    aiStore.decisions.length +
    aiStore.agendaTopics.length +
    aiStore.actionItems.length +
    aiStore.meetingTerms.length
  )
})

const consensusRateText = computed(() => {
  const total = aiStore.decisions.length
  if (total === 0) return '--'
  const pct = Math.round((aiStore.confirmedDecisions.length / total) * 100)
  return `${pct}%`
})

// 活跃发言人音量实时检测
const activeSpeakerId = ref('')
const speakingMap = reactive({})
let speakerAudioCtx = null
const speakerAnalysers = new Map()
let speakerPollTimer = null

function syncAudioAnalyserForMember(userId, stream) {
  if (!speakerAudioCtx || !stream) return
  const tracks = stream.getAudioTracks?.() || []
  if (tracks.length === 0) return

  const existing = speakerAnalysers.get(userId)
  if (existing && existing.streamId === stream.id) return

  if (existing) {
    try {
      existing.source.disconnect()
    } catch (e) {}
    speakerAnalysers.delete(userId)
  }

  try {
    const source = speakerAudioCtx.createMediaStreamSource(stream)
    const analyser = speakerAudioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    speakerAnalysers.set(userId, {
      streamId: stream.id,
      source,
      analyser,
      data: new Uint8Array(analyser.frequencyBinCount)
    })
  } catch (e) {}
}

function startSpeakerDetection() {
  stopSpeakerDetection()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  try {
    speakerAudioCtx = new AudioCtx()
  } catch (e) {
    return
  }

  speakerPollTimer = setInterval(() => {
    if (!speakerAudioCtx) return
    if (speakerAudioCtx.state === 'suspended') return

    if (localStream.value) {
      syncAudioAnalyserForMember(authStore.userId, localStream.value)
    }
    Object.entries(rtcRemoteStreams).forEach(([uid, stream]) => {
      if (stream) syncAudioAnalyserForMember(uid, stream)
    })

    let loudestUserId = ''
    let maxLevel = 16

    speakerAnalysers.forEach((entry, uid) => {
      const member = allMembers.value.find((m) => m.userId === uid)
      if (!member || member.openAudio === false) {
        speakingMap[uid] = false
        return
      }
      entry.analyser.getByteFrequencyData(entry.data)
      let sum = 0
      for (let i = 0; i < entry.data.length; i++) {
        sum += entry.data[i]
      }
      const avg = sum / entry.data.length
      const speaking = avg > 16
      speakingMap[uid] = speaking
      if (avg > maxLevel) {
        maxLevel = avg
        loudestUserId = uid
      }
    })

    if (loudestUserId) {
      activeSpeakerId.value = loudestUserId
    }
  }, 280)
}

function stopSpeakerDetection() {
  if (speakerPollTimer) {
    clearInterval(speakerPollTimer)
    speakerPollTimer = null
  }
  speakerAnalysers.forEach((entry) => {
    try {
      entry.source.disconnect()
    } catch (e) {}
  })
  speakerAnalysers.clear()
  if (speakerAudioCtx && speakerAudioCtx.state !== 'closed') {
    speakerAudioCtx.close().catch(() => {})
    speakerAudioCtx = null
  }
}

function isMemberSpeaking(userId) {
  if (!userId) return false
  return Boolean(speakingMap[userId])
}

function isMemberHandRaised(userId) {
  return userId === authStore.userId && isHandRaised.value
}

// WebRTC 实时 RTT 探测
const networkRttMs = ref(null)
let statsPollTimer = null

function startStatsPolling() {
  stopStatsPolling()
  statsPollTimer = setInterval(async () => {
    if (peerConnections.size === 0) {
      networkRttMs.value = null
      return
    }
    try {
      for (const pc of peerConnections.values()) {
        const stats = await pc.getStats()
        for (const report of stats.values()) {
          if (
            report.type === 'candidate-pair' &&
            (report.state === 'succeeded' || report.nominated) &&
            report.currentRoundTripTime != null
          ) {
            networkRttMs.value = Math.round(report.currentRoundTripTime * 1000)
            return
          }
        }
      }
    } catch (e) {}
  }, 5000)
}

function stopStatsPolling() {
  if (statsPollTimer) {
    clearInterval(statsPollTimer)
    statsPollTimer = null
  }
}

const networkStatusLabel = computed(() => {
  if (!isWsConnected.value) {
    return isWsReconnecting.value ? '信令重连中...' : '信令未连接'
  }
  if (networkRttMs.value !== null) {
    return peerConnections.size > 0
      ? `${networkRttMs.value}ms · ${peerConnections.size}路 P2P`
      : `${networkRttMs.value}ms · WS在线`
  }
  return peerConnections.size > 0
    ? `已连 ${peerConnections.size} 路媒体`
    : '信令已连接'
})

// 主舞台焦点参会人计算
const spotlightMember = computed(() => {
  if (pinnedUserId.value) {
    const pinned = allMembers.value.find((m) => m.userId === pinnedUserId.value)
    if (pinned) return pinned
  }
  if (activeSpeakerId.value) {
    const speaker = allMembers.value.find((m) => m.userId === activeSpeakerId.value)
    if (speaker) return speaker
  }
  if (meetingStore.remoteMemberList.length > 0) {
    return meetingStore.remoteMemberList[0]
  }
  return localMemberMeta.value
})

const spotlightIsSelf = computed(() => spotlightMember.value?.userId === authStore.userId)
const spotlightIsHost = computed(
  () => spotlightMember.value?.userId === meetingStore.meetingInfo?.createUserId
)

const spotlightStream = computed(() => {
  if (!spotlightMember.value) return null
  return getMemberStream(spotlightMember.value.userId)
})

const spotlightQualityLabel = computed(() => {
  if (spotlightMember.value?.openVideo === false) return '摄像头已关闭'
  const stream = spotlightStream.value
  const track = stream?.getVideoTracks?.()?.[0]
  if (!track || !track.enabled || track.readyState === 'ended') {
    return '无视频信号'
  }
  const settings = track.getSettings?.() || {}
  const res = settings.height ? `${settings.height}P` : 'HD'
  const fps = settings.frameRate ? ` ${Math.round(settings.frameRate)}FPS` : ''
  return `${res}${fps}`
})

// 最新 AI 字幕片段
const latestSubtitle = computed(() => {
  if (!realtimeSegments.value || realtimeSegments.value.length === 0) return null
  return realtimeSegments.value[realtimeSegments.value.length - 1]
})

const latestSubtitleText = computed(() => {
  const seg = latestSubtitle.value
  if (!seg) return ''
  return seg.currentText || seg.text || seg.originalText || ''
})

const latestSubtitleTranslation = computed(() => {
  const seg = latestSubtitle.value
  return seg?.translatedText || ''
})

// PIP 成员选择
const availablePipMembers = computed(() => allMembers.value)

const currentPipUserId = computed(() => {
  if (selectedPipUserId.value) {
    const exists = availablePipMembers.value.some((m) => m.userId === selectedPipUserId.value)
    if (exists) return selectedPipUserId.value
  }
  return authStore.userId
})

const pipMemberIsSelf = computed(() => currentPipUserId.value === authStore.userId)

const pipMemberMeta = computed(() => {
  return allMembers.value.find((m) => m.userId === currentPipUserId.value) || localMemberMeta.value
})

const pipStream = computed(() => getMemberStream(currentPipUserId.value))

function handleSelectPipMember({ key }) {
  selectedPipUserId.value = key
}

// 视图模式与焦点切换
function switchViewMode(mode) {
  viewMode.value = mode
  if (mode !== 'gallery') {
    galleryEqualGrid.value = false
  }
  if (isNarrowViewport.value && mode === 'ai-collab') {
    mobileCopilotOpen.value = true
  }
}

function handleGridToggleBtn() {
  if (viewMode.value === 'gallery') {
    galleryEqualGrid.value = !galleryEqualGrid.value
  } else {
    viewMode.value = 'gallery'
    galleryEqualGrid.value = true
  }
}

function handleToggleCopilotDrawer() {
  if (viewMode.value === 'gallery' && !isNarrowViewport.value) {
    viewMode.value = 'ai-collab'
  } else if (!isNarrowViewport.value) {
    viewMode.value = 'gallery'
  } else {
    mobileCopilotOpen.value = !mobileCopilotOpen.value
  }
}

function handleSelectStripMember(member) {
  if (!member?.userId) return
  if (pinnedUserId.value === member.userId) {
    pinnedUserId.value = null
  } else {
    pinnedUserId.value = member.userId
    if (isScreenSpotlightMode.value) {
      screenShareInSpotlight.value = false
    }
  }
}

function togglePinSpotlight() {
  if (pinnedUserId.value) {
    pinnedUserId.value = null
    message.info('已恢复自动发言人聚焦')
  } else if (spotlightMember.value?.userId) {
    pinnedUserId.value = spotlightMember.value.userId
    message.success(`已锁定「${spotlightMember.value.nickName}」为常驻焦点`)
  }
}

function toggleStageFullscreen() {
  const target = roomRootRef.value || stageContainerRef.value
  if (!target) return
  if (!document.fullscreenElement) {
    target.requestFullscreen?.().catch((err) => {
      console.warn('全屏请求失败:', err)
    })
  } else {
    document.exitFullscreen?.().catch((err) => {
      console.warn('退出全屏失败:', err)
    })
  }
}

function handleFullscreenChange() {
  isStageFullscreen.value = !!document.fullscreenElement
}

function openWorkspaceTab(tab = 'agents') {
  workspaceInitialTab.value = tab
  workspaceModalOpen.value = true
}

async function handleCopySegmentText(seg) {
  const text = seg.currentText || seg.text || seg.originalText || ''
  if (!text) return
  const ok = await copyText(text)
  if (ok) {
    message.success('已复制该句转写')
  }
}

async function handleExportTranscript() {
  const segs = realtimeSegments.value || []
  if (segs.length === 0) {
    message.info('暂无可导出的转写字幕')
    return
  }
  const lines = segs.map((s) => {
    const t = formatTranscriptMs(s.startTimeMs)
    const name = s.speakerName || '参会发言人'
    const text = s.currentText || s.text || s.originalText || ''
    return `[${t}] ${name}: ${text}`
  })
  const ok = await copyText(lines.join('\n'))
  if (ok) {
    message.success(`已复制 ${segs.length} 条实时字幕到剪贴板`)
  }
}

const gridClass = computed(() => {
  const total = allMembers.value.length
  if (total <= 1) return 'grid-1'
  if (total === 2) return 'grid-2'
  if (total <= 4) return 'grid-4'
  if (total <= 6) return 'grid-6'
  return 'grid-many'
})

async function initMeetingRoom() {
  joiningMeeting.value = true
  loadingTip.value = '正在核验会议信息...'

  try {
    let current = await getCurrentMeeting()
    if (!current || current.meetingId !== meetingId.value) {
      current = { meetingId: meetingId.value, meetingName: 'EasyMeeting 视频会议' }
    }
    meetingStore.setMeetingInfo(current)

    loadingTip.value = '正在初始化音视频输入设备...'
    const initialVideoPref = sessionStorage.getItem('initial_video_open') !== '0'
    const initialAudioPref = sessionStorage.getItem('initial_audio_open') !== '0'

    try {
      await initLocalStream({
        audio: initialAudioPref,
        video: initialVideoPref
      })
    } catch (e) {
      console.warn('本地音视频设备获取不完整，降级入会:', e)
    }

    setupWebSocketListeners()

    loadingTip.value = '正在连接 Netty WebSocket 信令服务器...'
    await connectWs(authStore.token)

    loadingTip.value = '正在加入会议房间...'
    await jionMeeting(meetingId.value, isVideoActive.value)

    await refreshMemberList()
    loadChatHistory()
    aiStore.initMeeting(meetingId.value)
    aiStore.fetchFeatureStatus(meetingId.value).catch(() => {})
    aiStore.loadTermDomainsMeta().catch(() => {})

    syncPeersWithExistingMembers()

    joiningMeeting.value = false
    message.success('已成功加入会议！')
  } catch (err) {
    message.error(err.message || '入会失败')
    setTimeout(() => {
      router.push('/')
    }, 1500)
  }
}

async function refreshMemberList() {
  try {
    const list = await getMeetingMemberList(meetingId.value)
    if (list) {
      meetingStore.setMemberList(list)
    }
  } catch (e) {
    console.error('获取成员列表失败:', e)
  }
}

async function loadChatHistory() {
  try {
    const history = await loadChatMessage(meetingId.value)
    if (history) {
      meetingStore.setChatHistory(history)
    }
  } catch (e) {
    console.error('加载聊天历史失败:', e)
  }
}

function setupWebSocketListeners() {
  onWs(1, (data) => {
    const newMember = data.meesageContent?.newMember
    if (newMember && newMember.userId !== authStore.userId) {
      message.info(`${newMember.nickName || '新成员'} 加入了会议`)
      initiateOffer(newMember.userId)
    }
  })

  onWs(2, (data) => {
    handleSignal(data)
  })

  onWs(3, (data) => {
    const leftUserId = data.userId || data.meesageContent
    if (leftUserId) {
      closePeer(leftUserId)
      if (pinnedUserId.value === leftUserId) {
        pinnedUserId.value = null
      }
    }
  })

  onWs(5, () => {
    if (!chatOpen.value) {
      unreadChatCount.value++
    }
  })

  onWs(6, () => {
    if (!chatOpen.value) {
      unreadChatCount.value++
    }
  })
}

function syncPeersWithExistingMembers() {
  setTimeout(() => {
    if (!meetingStore.remoteMemberList || meetingStore.remoteMemberList.length === 0) return
    meetingStore.remoteMemberList.forEach((member) => {
      if (member.userId && !peerConnections.has(member.userId)) {
        initiateOffer(member.userId)
      }
    })
  }, 1200)
}

async function handleToggleAudio() {
  const nextState = await toggleAudio()
  sessionStorage.setItem('initial_audio_open', nextState ? '1' : '0')
  try {
    const newTrack = localStream.value?.getAudioTracks?.()[0] || null
    if (newTrack && nextState) {
      await replaceTrackForAllPeers(newTrack, 'audio')
    }
    await updateMemberMediaState({
      meetingId: meetingId.value,
      openAudio: nextState
    })
    sendWs({
      messageType: 11,
      openAudio: nextState
    })
  } catch (e) {
    console.warn('同步音频状态提示:', e)
  }
}

async function handleToggleVideo() {
  const nextState = await toggleVideo()
  sessionStorage.setItem('initial_video_open', nextState ? '1' : '0')
  try {
    const newTrack = localStream.value?.getVideoTracks?.()[0] || null
    if (newTrack && nextState && !isScreenSharing.value) {
      await replaceTrackForAllPeers(newTrack, 'video')
    }
    await updateMemberMediaState({
      meetingId: meetingId.value,
      openVideo: nextState
    })
    sendWs({
      messageType: 11,
      openVideo: nextState
    })
  } catch (e) {
    console.warn('同步视频状态提示:', e)
  }
}

async function handleSwitchAudioDevice(deviceId) {
  try {
    const track = await switchAudioInputDevice(deviceId)
    if (track) {
      await replaceTrackForAllPeers(track, 'audio')
      message.success('已切换麦克风设备')
    }
  } catch (err) {
    message.error('切换麦克风失败')
  }
}

async function handleSwitchVideoDevice(deviceId) {
  try {
    const track = await switchVideoInputDevice(deviceId)
    if (track && !isScreenSharing.value) {
      await replaceTrackForAllPeers(track, 'video')
      message.success('已切换摄像头设备')
    }
  } catch (err) {
    message.error('切换摄像头失败')
  }
}

async function handleToggleScreenShare() {
  if (isScreenSharing.value) {
    stopScreenShare()
    meetingStore.updateMemberMedia(authStore.userId, { screenShare: false })
    await revertVideoTrack()
  } else {
    try {
      const stream = await startScreenShare(async () => {
        meetingStore.updateMemberMedia(authStore.userId, { screenShare: false })
        await revertVideoTrack()
      })

      const screenTrack = stream.getVideoTracks()[0]
      if (screenTrack) {
        meetingStore.updateMemberMedia(authStore.userId, { screenShare: true })
        await replaceTrackForAllPeers(screenTrack, 'video')

        await updateMemberMediaState({
          meetingId: meetingId.value,
          screenShare: true
        })
        sendWs({
          messageType: 11,
          screenShare: true
        })
      }
    } catch (e) {
      console.warn('开启屏幕共享取消或失败:', e)
    }
  }
}

async function revertVideoTrack() {
  meetingStore.updateMemberMedia(authStore.userId, { screenShare: false })
  const camTrack = localStream.value?.getVideoTracks()[0] || null
  if (camTrack) {
    await replaceTrackForAllPeers(camTrack, 'video')
  }
  try {
    await updateMemberMediaState({
      meetingId: meetingId.value,
      screenShare: false
    })
    sendWs({
      messageType: 11,
      screenShare: false
    })
  } catch (e) {}
}

function handleToggleHandRaise() {
  isHandRaised.value = !isHandRaised.value
  message.info(isHandRaised.value ? '您已举手示意发言' : '已放下举手')
}

function handleToggleChat() {
  chatOpen.value = !chatOpen.value
  if (chatOpen.value) {
    unreadChatCount.value = 0
  }
}

function handleExitMeeting() {
  Modal.confirm({
    title: '离开会议',
    content: '确定要离开当前会议吗？',
    okText: '确认离开',
    cancelText: '取消',
    onOk: async () => {
      try {
        await exitMeeting(meetingId.value)
      } catch (e) {}
      leaveAndCleanUp()
    }
  })
}

function handleFinishMeeting() {
  Modal.confirm({
    title: '解散并结束会议',
    content: '结束会议后，房间内的所有参会成员将被强制移出。确认解散？',
    okText: '确认结束全员会议',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await finishMeeting(meetingId.value)
      } catch (e) {}
      leaveAndCleanUp()
    }
  })
}

function handleBeforeUnload(e) {
  e.preventDefault()
  e.returnValue = '您正在进行会议，刷新页面将重新协商通话。确定要刷新吗？'
  return e.returnValue
}

function leaveAndCleanUp() {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  sessionStorage.removeItem('initial_transcription_enabled')
  sessionStorage.removeItem('initial_live_decision_enabled')
  stopAllTracks()
  closeAllPeers()
  disconnectWs()
  meetingStore.resetMeeting()
  router.push('/')
}

async function handleCopyMeetingNo() {
  const no = meetingStore.meetingInfo?.meetingNo || meetingId.value
  if (no) {
    const success = await copyText(no)
    if (success) {
      message.success('会议号已复制')
    }
  }
}

const resumeSpeakerCtx = () => {
  if (speakerAudioCtx && speakerAudioCtx.state === 'suspended') {
    speakerAudioCtx.resume().catch(() => {})
  }
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('click', resumeSpeakerCtx)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  initMeetingRoom()
  startSpeakerDetection()
  startStatsPolling()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('click', resumeSpeakerCtx)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  stopSpeakerDetection()
  stopStatsPolling()
  stopAllTracks()
  closeAllPeers()
  disconnectWs()
  meetingStore.resetMeeting()
})
</script>

<style scoped>
.meeting-room-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #303030;
  color: #f1f1f1;
  overflow: hidden;
  position: relative;
  user-select: none;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.blue-accent {
  color: #006ef2;
}

.green-accent {
  color: #88fd54;
}

.blue-dim-icon {
  color: #afc6ff;
}

/* 1. 顶部固定状态栏 (64px) */
.room-top-header {
  height: 64px;
  background: rgba(48, 48, 48, 0.92);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(193, 198, 215, 0.08);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 24px;
  z-index: 40;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 4px;
  border: none;
  background: rgba(226, 226, 226, 0.16);
  color: #f87171;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.rec-badge:not(.active) {
  color: #c1c6d7;
}

.rec-badge.active {
  background: rgba(186, 26, 26, 0.24);
  color: #ff8a80;
}

.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8c93a5;
}

.rec-dot.pulsing {
  background: #ba1a1a;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.85);
  animation: header-pulse 1.5s infinite ease-in-out;
}

@keyframes header-pulse {
  0%, 100% { opacity: 0.7; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.2); }
}

.e2ee-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: #c1c6d7;
  flex-shrink: 0;
}

.icon-online {
  color: #6de039;
}

.icon-warn {
  color: #ffba45;
}

.icon-offline {
  color: #f87171;
}

.header-divider {
  width: 1px;
  height: 14px;
  background: rgba(193, 198, 215, 0.28);
  flex-shrink: 0;
}

.meeting-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f1f1;
  max-width: 300px;
}

.timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 5px;
  background: rgba(226, 226, 226, 0.1);
  color: #f1f1f1;
  font-size: 12px;
  flex-shrink: 0;
}

.timer-icon {
  color: #c1c6d7;
}

.network-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #c1c6d7;
  flex-shrink: 0;
}

.network-chip.online .network-icon {
  color: #88fd54;
}

.network-chip.warn .network-icon {
  color: #ffba45;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.view-switcher {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.1);
}

.view-tab {
  border: none;
  background: transparent;
  color: #c1c6d7;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 14px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.view-tab:hover {
  color: #f1f1f1;
}

.view-tab.active {
  background: rgba(226, 226, 226, 0.28);
  color: #f1f1f1;
  font-weight: 700;
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: 1;
}

.header-icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c1c6d7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
}

.header-icon-btn:hover,
.header-icon-btn.active {
  color: #f1f1f1;
  background: rgba(226, 226, 226, 0.2);
}

.leave-meeting-btn {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: #ba1a1a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.12s ease;
}

.leave-meeting-btn:hover {
  background: #cf2323;
}

.leave-meeting-btn:active {
  transform: scale(0.95);
}

.user-avatar-btn {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
}

/* 2. 主工作区 */
.room-main-shell {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.stage-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.overlay-text {
  font-size: 14px;
  color: #c1c6d7;
}

.room-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.subbar-sep {
  width: 1px;
  height: 12px;
  background: rgba(193, 198, 215, 0.26);
  flex-shrink: 0;
}

/* ===================================================================== */
/* 视图 1：画廊视图 (72% / 28%)                                           */
/* ===================================================================== */
.meeting-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(226, 226, 226, 0.1);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.subbar-left,
.subbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.meeting-id-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  color: #f1f1f1;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 5px;
  cursor: pointer;
}

.meeting-id-chip:hover {
  background: rgba(226, 226, 226, 0.1);
}

.subbar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8c93a5;
}

.subbar-dot.online {
  background: #88fd54;
  animation: header-pulse 1.6s infinite ease-in-out;
}

.copy-icon {
  color: #c1c6d7;
}

.security-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(226, 226, 226, 0.16);
  font-size: 11.5px;
  color: #c1c6d7;
}

.shield-icon {
  color: #006ef2;
}

.subbar-invite-btn {
  border: 1px solid rgba(175, 198, 255, 0.28);
  background: rgba(0, 110, 242, 0.16);
  color: #afc6ff;
  font-size: 11.5px;
  padding: 2px 9px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.subbar-invite-btn:hover {
  background: rgba(0, 110, 242, 0.3);
  color: #ffffff;
}

.speaker-status-text {
  font-size: 12px;
  color: #c1c6d7;
}

.ai-engine-pill {
  border: none;
  padding: 3px 9px;
  border-radius: 5px;
  background: rgba(0, 110, 242, 0.2);
  color: #afc6ff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s ease;
}

.ai-engine-pill:hover {
  background: rgba(0, 110, 242, 0.35);
}

.room-split-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 14px;
  overflow: hidden;
}

.video-stage-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.room-split-body.with-copilot .video-stage-column {
  flex: 72;
}

.copilot-column {
  flex: 28;
  min-width: 330px;
  max-width: 440px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.copilot-column.floating-drawer {
  position: fixed;
  top: 72px;
  right: 12px;
  bottom: 84px;
  width: min(390px, calc(100vw - 24px));
  max-width: none;
  z-index: 45;
  background: #24262b;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
}

.floating-copilot-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: #f1f1f1;
  border-bottom: 1px solid rgba(193, 198, 215, 0.14);
}

.floating-close-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.gallery-stage-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gallery-share-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-radius: 9px;
  background: rgba(0, 110, 242, 0.18);
  border: 1px solid rgba(175, 198, 255, 0.28);
  font-size: 13px;
  color: #f1f1f1;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.banner-icon {
  color: #afc6ff;
}

.banner-switch-btn {
  border: none;
  background: #006ef2;
  color: #fefcff;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.video-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 12px;
}

.video-grid.grid-1 {
  grid-template-columns: 1fr;
  max-width: 1120px;
  width: 100%;
  margin: 0 auto;
}

.video-grid.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.video-grid.grid-4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.video-grid.grid-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.video-grid.grid-many {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  overflow-y: auto;
}

.primary-spotlight-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(226, 226, 226, 0.08);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.4);
}

.primary-spotlight-stage.is-speaking {
  box-shadow: inset 0 0 0 2px #88fd54, 0 20px 44px rgba(0, 0, 0, 0.4);
}

.spotlight-floating-info {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 12;
  flex-wrap: wrap;
}

.speaker-pill,
.quality-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 8px;
  background: rgba(48, 48, 48, 0.85);
  backdrop-filter: blur(12px);
  color: #f1f1f1;
  font-size: 12.5px;
}

.speaker-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8c93a5;
}

.speaker-live-dot.speaking {
  background: #88fd54;
  box-shadow: 0 0 8px #88fd54;
  animation: header-pulse 1.3s infinite ease-in-out;
}

.speaker-pill-name {
  font-weight: 600;
}

.speaker-pill-role {
  color: #c1c6d7;
  font-size: 12px;
}

.speaking-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(226, 226, 226, 0.28);
  color: #88fd54;
}

.pinned-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(0, 110, 242, 0.28);
  color: #afc6ff;
}

.quality-pill {
  font-size: 11.5px;
}

.hd-icon {
  color: #88fd54;
}

/* 画中画屏幕共享卡片 */
.pip-screenshare-card {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 272px;
  border-radius: 9px;
  overflow: hidden;
  background: rgba(48, 48, 48, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(193, 198, 215, 0.16);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55);
  z-index: 20;
  transition: transform 0.2s ease;
}

.pip-screenshare-card.speaker-pip-offset {
  top: 56px;
}

.pip-screenshare-card:hover {
  transform: scale(1.03);
}

.pip-screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(226, 226, 226, 0.16);
}

.pip-screen-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #f1f1f1;
  min-width: 0;
}

.slide-icon {
  color: #006ef2;
}

.pip-screen-preview {
  position: relative;
  height: 138px;
  background: #141519;
  cursor: pointer;
}

.pip-screen-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pip-self-share-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: #c1c6d7;
}

.pip-sync-badge {
  position: absolute;
  bottom: 6px;
  right: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(48, 48, 48, 0.85);
  color: #88fd54;
}

/* 摄像头画中画（当屏幕共享占主舞台时） */
.pip-camera-box {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 260px;
  height: 170px;
  background: #1e1f26;
  border: 1.5px solid #006ef2;
  border-radius: 10px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 30;
  transition: all 0.25s ease;
}

.pip-camera-box.minimized {
  height: 36px;
  width: 190px;
  border-color: rgba(193, 198, 215, 0.25);
}

.pip-header {
  height: 34px;
  min-height: 34px;
  background: rgba(24, 25, 30, 0.95);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.pip-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #f1f1f1;
  max-width: 150px;
}

.pip-tag {
  color: #afc6ff;
}

.pip-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pip-icon-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  padding: 3px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.pip-icon-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
}

.pip-body {
  flex: 1;
  min-height: 0;
  background: #0d0e11;
}

/* 悬停快捷控制浮动条 */
.spotlight-hover-controls {
  position: absolute;
  bottom: 78px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(48, 48, 48, 0.9);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  z-index: 25;
}

.primary-spotlight-stage:hover .spotlight-hover-controls {
  opacity: 1;
  pointer-events: auto;
}

.hover-ctrl-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #c1c6d7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
}

.hover-ctrl-btn:hover {
  color: #f1f1f1;
  background: rgba(226, 226, 226, 0.24);
}

.hover-ctrl-btn.active {
  color: #88fd54;
  background: rgba(136, 253, 84, 0.16);
}

/* 底部 AI 实时字幕浮层 */
.ai-subtitle-overlay {
  position: absolute;
  bottom: 12px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}

.subtitle-card {
  width: 100%;
  max-width: 820px;
  padding: 10px 18px;
  border-radius: 12px;
  background: rgba(48, 48, 48, 0.9);
  backdrop-filter: blur(14px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subtitle-main-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  color: #f1f1f1;
  line-height: 1.5;
}

.subtitle-spark-icon {
  color: #006ef2;
  flex-shrink: 0;
}

.subtitle-speaker {
  color: #88fd54;
  font-weight: 600;
  flex-shrink: 0;
}

.subtitle-text {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.subtitle-sub-line {
  font-size: 11.5px;
  color: #c1c6d7;
  padding-left: 22px;
}

/* 底部参会人视频画廊条 */
.attendees-strip {
  height: 124px;
  min-height: 124px;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
}

.strip-tile {
  width: 204px;
  height: 116px;
  flex-shrink: 0;
}

/* ===================================================================== */
/* 视图 2：演讲者视图                                                     */
/* ===================================================================== */
.speaker-workspace {
  gap: 8px;
}

.speaker-subbar {
  width: 100%;
  background: rgba(226, 226, 226, 0.14);
  backdrop-filter: blur(12px);
  border-radius: 8px;
  padding: 7px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11.5px;
  flex-shrink: 0;
}

.speaker-shield-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #88fd54;
}

.speaker-node-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #c1c6d7;
}

.speaker-copilot-pill {
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(0, 87, 194, 0.24);
  color: #afc6ff;
  padding: 3px 9px;
  border-radius: 5px;
  font-size: 11.5px;
  cursor: pointer;
}

.speaker-copilot-pill:hover {
  background: rgba(0, 87, 194, 0.38);
}

.member-count-text {
  color: #c1c6d7;
}

/* 顶部横向缩略图条 */
.speaker-filmstrip {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  flex-shrink: 0;
}

.filmstrip-card {
  position: relative;
  width: 176px;
  height: 108px;
  flex-shrink: 0;
  border-radius: 9px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}

.filmstrip-card:hover {
  box-shadow: 0 0 0 1px rgba(193, 198, 215, 0.45);
}

.filmstrip-card.focused {
  box-shadow: 0 0 0 2px #006ef2;
}

.filmstrip-card.speaking {
  box-shadow: 0 0 0 2px #88fd54;
}

.filmstrip-speaking-tag {
  position: absolute;
  top: 7px;
  left: 7px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 87, 194, 0.85);
  backdrop-filter: blur(4px);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
}

.ping-green-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #88fd54;
  animation: header-pulse 1.4s infinite ease-in-out;
}

.filmstrip-bot-card {
  width: 176px;
  height: 108px;
  flex-shrink: 0;
  border: 1px solid rgba(175, 198, 255, 0.2);
  border-radius: 9px;
  background: linear-gradient(135deg, rgba(0, 87, 194, 0.3) 0%, rgba(226, 226, 226, 0.16) 55%, rgba(157, 106, 0, 0.2) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: #f1f1f1;
}

.filmstrip-bot-card:hover {
  border-color: #006ef2;
}

.bot-avatar-ring {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #0057c2;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 87, 194, 0.35);
}

.bot-card-name {
  font-size: 12px;
  font-weight: 600;
}

.bot-card-state {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #88fd54;
}

.bot-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8c93a5;
}

.bot-dot.active {
  background: #88fd54;
}

/* 演讲者主舞台 + 右侧可折叠栏 (9 / 3) */
.speaker-main-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 9fr) minmax(300px, 3fr);
  gap: 10px;
}

.speaker-main-grid.sidebar-collapsed {
  grid-template-columns: minmax(0, 1fr);
}

.speaker-focus-stage {
  position: relative;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(226, 226, 226, 0.1);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
}

.speaker-stage-topbar {
  position: absolute;
  top: 12px;
  left: 14px;
  right: 14px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.stage-sharer-pill,
.stage-utility-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(48, 48, 48, 0.86);
  backdrop-filter: blur(12px);
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 12px;
  color: #f1f1f1;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}

.sharer-sub-tag {
  font-size: 11px;
  color: #c1c6d7;
  background: rgba(226, 226, 226, 0.14);
  padding: 1px 6px;
  border-radius: 4px;
}

.stage-utility-pill {
  gap: 4px;
  padding: 4px 8px;
}

.util-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  padding: 4px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.util-btn:hover,
.util-btn.active {
  color: #f1f1f1;
  background: rgba(226, 226, 226, 0.2);
}

.util-pct {
  font-size: 11px;
  color: #c1c6d7;
  padding: 0 4px;
}

.util-expand-btn {
  border: none;
  border-radius: 5px;
  background: rgba(0, 110, 242, 0.25);
  color: #afc6ff;
  font-size: 11px;
  padding: 3px 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}

.util-expand-btn:hover {
  background: rgba(0, 110, 242, 0.42);
  color: #ffffff;
}

.speaker-stage-media {
  width: 100%;
  height: 100%;
  transition: transform 0.2s ease;
}

.speaker-floating-pip {
  position: absolute;
  top: 56px;
  right: 14px;
  z-index: 35;
  width: 210px;
  height: 142px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(34, 35, 39, 0.85);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.58);
  border: 1px solid rgba(193, 198, 215, 0.2);
}

.pip-top-badge {
  position: absolute;
  top: 7px;
  left: 7px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
}

.pip-bottom-info {
  position: absolute;
  bottom: 6px;
  left: 8px;
  right: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.pip-name-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pip-name {
  font-size: 11.5px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.pip-role {
  font-size: 10px;
  color: #c1c6d7;
}

.pip-wave-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
  background: rgba(0, 0, 0, 0.45);
  padding: 2px 4px;
  border-radius: 4px;
}

.pip-wave-bars span {
  width: 2px;
  height: 4px;
  border-radius: 999px;
  background: #006ef2;
}

.pip-wave-bars.active span {
  animation: wave-bounce 0.85s infinite ease-in-out;
}

.pip-wave-bars.active span:nth-child(2) { animation-delay: 0.15s; }
.pip-wave-bars.active span:nth-child(3) { animation-delay: 0.3s; }
.pip-wave-bars.active span:nth-child(4) { animation-delay: 0.45s; }

@keyframes wave-bounce {
  0%, 100% { height: 4px; }
  50% { height: 11px; }
}

.speaker-subtitle-overlay {
  position: absolute;
  bottom: 14px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: center;
  z-index: 30;
  pointer-events: none;
}

.speaker-subtitle-card {
  pointer-events: auto;
  width: 100%;
  max-width: 780px;
  background: rgba(48, 48, 48, 0.92);
  backdrop-filter: blur(18px);
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sub-translate-badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #006ef2;
  color: #fefcff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.sub-body {
  flex: 1;
  min-width: 0;
}

.sub-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-speaker-name {
  font-size: 12px;
  font-weight: 600;
  color: #d9e2ff;
}

.sub-time {
  font-size: 11px;
  color: #c1c6d7;
}

.sub-asr-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(136, 253, 84, 0.18);
  color: #88fd54;
}

.sub-zh-text {
  margin: 3px 0 0;
  font-size: 13.5px;
  font-weight: 500;
  color: #f1f1f1;
  line-height: 1.45;
}

.sub-en-text {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: #c1c6d7;
  font-style: italic;
}

.sub-setting-btn {
  border: none;
  background: transparent;
  color: #c1c6d7;
  padding: 4px;
  cursor: pointer;
  align-self: center;
}

.sub-setting-btn:hover {
  color: #f1f1f1;
}

.speaker-sidebar-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ===================================================================== */
/* 视图 3：AI 协作视图 (7 Cols ~58% Left | 5 Cols ~42% Right)             */
/* ===================================================================== */
.ai-collab-workspace {
  gap: 8px;
}

.collab-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px;
  background: rgba(226, 226, 226, 0.08);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  flex-shrink: 0;
}

.collab-banner-left,
.collab-banner-right {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #c1c6d7;
}

.collab-banner-right strong {
  color: #f1f1f1;
}

.dot-sep {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(226, 226, 226, 0.35);
}

.engine-brand {
  display: flex;
  align-items: center;
  gap: 7px;
}

.engine-ping-wrap {
  position: relative;
  display: inline-flex;
  width: 8px;
  height: 8px;
}

.engine-ping {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #006ef2;
  opacity: 0.75;
}

.engine-ping.active {
  animation: tile-ping 1.5s infinite;
}

.engine-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0057c2;
}

.engine-name {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #d9e2ff;
}

.engine-telemetry {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #f1f1f1;
}

.ai-collab-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 14px;
}

.collab-left-pane,
.collab-right-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collab-upper-stage {
  position: relative;
  flex: 1;
  min-height: 210px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(226, 226, 226, 0.14);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.42);
}

.collab-speaker-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.collab-speaker-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(10px);
}

.collab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8c93a5;
}

.collab-dot.active {
  background: #88fd54;
  animation: header-pulse 1.3s infinite ease-in-out;
}

.collab-speaker-name {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
}

.collab-speaking-time {
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(0, 87, 194, 0.82);
  color: #ffffff;
  font-size: 11px;
}

.collab-soundwave-pill {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(10px);
}

.wave-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
}

.w-bar {
  width: 3px;
  height: 5px;
  border-radius: 999px;
  background: #88fd54;
}

.wave-bars.active .w-bar {
  animation: wave-bounce 0.9s infinite ease-in-out;
}

.wave-bars.active .b2 { animation-delay: 0.15s; }
.wave-bars.active .b3 { animation-delay: 0.3s; }
.wave-bars.active .b4 { animation-delay: 0.45s; }

.wave-text {
  font-size: 11px;
  color: #c1c6d7;
}

/* AI 协作右上角 PiP */
.collab-pip-card {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  width: 236px;
  aspect-ratio: 16 / 9;
  border-radius: 9px;
  overflow: hidden;
  background: rgba(20, 21, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.22s ease;
}

.collab-pip-card:hover {
  transform: scale(1.03);
}

.collab-pip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(226, 226, 226, 0.18);
  font-size: 10.5px;
  color: #c1c6d7;
  gap: 6px;
}

.collab-pip-title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.collab-pip-tag {
  font-size: 9.5px;
  background: rgba(0, 87, 194, 0.45);
  color: #ffffff;
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.collab-pip-body {
  flex: 1;
  min-height: 0;
  background: rgba(0, 0, 0, 0.85);
}

.collab-pip-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.collab-pip-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  color: #c1c6d7;
}

.collab-pip-code {
  padding: 7px 9px;
  font-size: 10.5px;
  line-height: 1.4;
  color: #d6dae6;
}

.c-blue { color: #afc6ff; }
.c-amber { color: #ffddb0; }
.c-green { color: #88fd54; }
.c-muted { color: #727786; }

/* 4-column Mid Attendees Row */
.collab-attendees-row {
  height: 108px;
  min-height: 98px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  flex-shrink: 0;
}

.collab-attendee-tile {
  height: 100%;
}

/* Lower Whisper-v3 Streaming Transcript Panel */
.collab-transcript-panel {
  height: 176px;
  min-height: 150px;
  background: rgba(226, 226, 226, 0.1);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.transcript-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.tp-head-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.tp-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f1f1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tp-latency-pill {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(226, 226, 226, 0.22);
  color: #88fd54;
  white-space: nowrap;
}

.tp-head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tp-action-btn {
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #c1c6d7;
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.tp-action-btn:hover {
  color: #ffffff;
  background: rgba(226, 226, 226, 0.2);
}

.transcript-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.tp-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
  color: #9ba3b8;
}

.tp-start-btn {
  border: none;
  border-radius: 5px;
  background: #006ef2;
  color: #ffffff;
  font-size: 11.5px;
  padding: 4px 10px;
  cursor: pointer;
}

.tp-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 8px;
}

.tp-item.is-live {
  background: rgba(0, 87, 194, 0.16);
  padding: 7px 8px;
}

.tp-time {
  font-size: 11px;
  color: #9ba3b8;
  white-space: nowrap;
  padding-top: 2px;
}

.tp-item.is-live .tp-time {
  color: #88fd54;
}

.tp-content {
  flex: 1;
  min-width: 0;
}

.tp-speaker-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.tp-speaker-name {
  font-weight: 600;
  color: #afc6ff;
}

.tp-speaker-name.green {
  color: #88fd54;
}

.tp-role-badge {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(0, 87, 194, 0.26);
  color: #d9e2ff;
}

.tp-text {
  margin: 0;
  color: #f1f1f1;
  line-height: 1.5;
}

.live-cursor {
  display: inline-block;
  width: 6px;
  height: 13px;
  background: #006ef2;
  margin-left: 4px;
  vertical-align: middle;
  animation: header-pulse 1s infinite;
}

.tp-translation {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: #9ba3b8;
  font-style: italic;
}

.tp-bookmark-btn {
  border: none;
  background: transparent;
  color: #9ba3b8;
  padding: 3px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.16s ease, color 0.16s ease;
}

.tp-item:hover .tp-bookmark-btn {
  opacity: 1;
}

.tp-bookmark-btn:hover {
  color: #006ef2;
}

.tp-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.subbar-feature-pills,
.collab-feature-toggles {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.feature-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid rgba(193, 198, 215, 0.24);
  background: rgba(255, 255, 255, 0.06);
  color: #c1c6d7;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.feature-pill-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.feature-pill-btn.active {
  border-color: rgba(136, 253, 84, 0.45);
  background: rgba(38, 109, 0, 0.28);
  color: #88fd54;
}

.feature-pill-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.fp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #727786;
}

.fp-dot.active {
  background: #88fd54;
  box-shadow: 0 0 6px rgba(136, 253, 84, 0.65);
}

.collab-model-tag {
  font-size: 11px;
  color: #afc6ff;
  background: rgba(0, 110, 242, 0.18);
  border: 1px solid rgba(175, 198, 255, 0.26);
  padding: 2px 7px;
  border-radius: 5px;
}

.banner-analyze-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid rgba(175, 198, 255, 0.34);
  background: rgba(0, 110, 242, 0.25);
  color: #e4ecff;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.banner-analyze-btn:hover:not(:disabled) {
  background: rgba(0, 110, 242, 0.42);
  color: #ffffff;
}

.banner-analyze-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.collab-pip-status {
  height: 100%;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 3px;
  font-size: 11px;
  color: #d6dbe8;
  background: rgba(18, 20, 26, 0.85);
}

.pip-stat-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.pip-stat-line strong {
  color: #88fd54;
}

.pip-stat-hint {
  font-size: 10px;
  color: #9ba3b8;
  margin-top: auto;
}

/* ===================================================================== */
/* 响应式适配                                                             */
/* ===================================================================== */
@media (max-width: 1200px) {
  .e2ee-badge,
  .network-chip,
  .security-pill {
    display: none;
  }

  .copilot-column {
    min-width: 300px;
  }
}

@media (max-width: 1024px) {
  .room-top-header {
    padding: 0 12px;
  }

  .meeting-title {
    max-width: 150px;
  }

  .speaker-status-text {
    display: none;
  }

  .ai-collab-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .room-top-header {
    height: 54px;
    padding: 0 10px;
    gap: 8px;
  }

  .header-divider,
  .meeting-title,
  .header-icon-btn {
    display: none;
  }

  .view-tab {
    padding: 4px 8px;
    font-size: 11.5px;
  }

  .leave-meeting-btn {
    padding: 0 10px;
    font-size: 11.5px;
  }

  .room-main-shell {
    padding: 8px;
  }

  .meeting-subbar,
  .speaker-subbar,
  .collab-banner {
    padding: 5px 10px;
  }

  .attendees-strip {
    height: 102px;
    min-height: 102px;
  }

  .strip-tile {
    width: 156px;
    height: 94px;
  }

  .filmstrip-card,
  .filmstrip-bot-card {
    width: 132px;
    height: 82px;
  }

  .collab-attendees-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    height: 124px;
  }

  .pip-camera-box,
  .pip-screenshare-card,
  .speaker-floating-pip,
  .collab-pip-card {
    width: 144px;
    height: 98px;
    top: 8px;
    right: 8px;
  }

  .pip-screen-preview {
    height: 66px;
  }

  .ai-subtitle-overlay,
  .speaker-subtitle-overlay {
    bottom: 8px;
    left: 8px;
    right: 8px;
  }

  .subtitle-card {
    padding: 7px 11px;
  }

  .subtitle-main-line {
    font-size: 12px;
  }
}
</style>
