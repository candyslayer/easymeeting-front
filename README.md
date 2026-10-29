# EasyMeeting 易会 - Web 前端工程

一套现代化、高性能的企业级音视频网络会议协作 Web 前端系统。以腾讯会议为视觉与交互体验标杆，采用深度定制的会议客户端交互布局与沉浸式深色实时会议室设计。

本工程严格与 `easymeeting-java` 后端系统深度契约对接，实现了账号认证体系、数学算术动态图形码校验、会议预约与快速发起、输入会议号与邀请码入会、基于 Netty WebSocket 与 WebRTC P2P Mesh 的音视频与屏幕共享、会议全员与私聊互动、会议共享文件上传下载与内嵌预览、通讯录管理及会议呼叫邀请等全套业务闭环。

---

## 一、技术栈约束与选型

| 技术层 | 选型 | 版本/规范 | 说明 |
| :--- | :--- | :--- | :--- |
| **基础框架** | Vue 3 | `^3.5.13` | 纯 Composition API 与 `<script setup>` |
| **编程语言** | JavaScript (ESNext) | `.js` / `.vue` | 严格禁止 TypeScript，全原生 JavaScript 编写 |
| **构建工具** | Vite | `^5.4.14` | 极速热重载，预置反向代理转发 |
| **UI 组件库** | Ant Design Vue | `^4.2.6` | 统一的企业级设计语言与图标体系 |
| **路由管理** | Vue Router | `^4.5.0` | 包含严格身份凭据路由守卫与动态导航 |
| **跨页面状态** | Pinia | `^2.3.1` | 模块化存储 Auth、Meeting、Media 状态 |
| **网络请求** | Axios | `^1.7.9` | 统一请求/响应拦截器、Token 自动注入、错误统一处理 |
| **实时通信** | WebRTC + WebSocket | 原生 Web API | 针对 Netty WebSocket 协议的 P2P Mesh 实时信令通信 |

---

## 二、前端工程结构

```
easymeeting-front/
├── docs/
│   └── frontend-backend-audit.md       # 深度前后端技术审计与数据契约报告
├── src/
│   ├── api/                            # 统一接口层，严禁散落硬编码
│   │   ├── http.js                     # Axios 实例、Token 自动注入与错误响应拦截
│   │   ├── auth.js                     # 验证码、邮箱验证、注册、登录接口
│   │   ├── meeting.js                  # 快速会议、预入会、正式入会、退出/解散、成员与邀请
│   │   ├── contact.js                  # 通讯录、好友搜索、好友申请/审批、会议呼叫
│   │   └── file.js                     # 会议附件上传、下载、内嵌预览
│   ├── assets/
│   │   └── styles/
│   │       └── global.css              # 腾讯会议风格全局设计变量与滚动条定制
│   ├── components/
│   │   ├── common/
│   │   │   ├── DeviceTestModal.vue     # 摄像头与麦克风设备检测与动态音量计弹窗
│   │   │   └── InviteModal.vue         # 会议直达链接、剪贴板文案与邮件邀请弹窗
│   │   └── meeting/
│   │       ├── VideoTile.vue           # 独立参会者视频卡片 (支持真实 MediaStream 绑定与头像占位)
│   │       ├── MeetingToolbar.vue      # 底部沉浸式会议控制工具栏 (音视频/屏幕/成员/聊天/解散)
│   │       ├── ParticipantDrawer.vue   # 参会人员右侧抽屉 (支持全员静音、踢出、拉黑)
│   │       └── ChatDrawer.vue          # 会议聊天右侧抽屉 (支持公屏/私聊、文件上传下载预览)
│   ├── composables/                    # 纯粹业务逻辑抽象组合式函数
│   │   ├── useMediaDevices.js          # 设备枚举、摄像头/麦克风流捕获、屏幕采集与音量采样
│   │   ├── useWebSocket.js             # Netty WebSocket 连接、25s 心跳保活与事件总线
│   │   └── useWebRTC.js                # Full Mesh RTCPeerConnection 管理、Offer/Answer 协商
│   ├── layouts/
│   │   └── MainLayout.vue              # 客户端风格侧边栏、顶部标题栏与全局登录态菜单
│   ├── router/
│   │   └── index.js                    # 路由定义与权限前置路由守卫
│   ├── stores/                         # Pinia 响应式状态中心
│   │   ├── auth.js                     # 用户身份令牌、登录恢复与持久化
│   │   ├── meeting.js                  # 当前会议元数据、成员列表、计时器、聊天记录
│   │   └── media.js                    # 硬件设备偏好设置与静音开关状态
│   ├── utils/
│   │   └── format.js                   # 会议号格式化、时长转换、文件尺寸与剪贴板复制
│   ├── views/                          # 核心业务页面
│   │   ├── auth/
│   │   │   ├── LoginView.vue           # 现代企业级登录页 (算术图形验证码)
│   │   │   └── RegisterView.vue        # 注册页 (邮箱验证码与图形码双重校验)
│   │   ├── home/
│   │   │   └── HomeView.vue            # 客户端首页 (三大核心大按钮、今日会议、历史列表)
│   │   ├── meeting/
│   │   │   ├── JoinMeetingView.vue     # 加入会议页 (会议号/邀请码双通道)
│   │   │   ├── ScheduleMeetingView.vue # 预约会议页 (时间范围选择、邮件邀约、安全密码)
│   │   │   ├── MeetingHistoryView.vue  # 会议记录页 (分页、搜索、再次发起)
│   │   │   └── MeetingRoomView.vue     # 核心实时会议室 (深色沉浸式、响应式网格、音视频互联)
│   │   ├── contacts/
│   │   │   └── ContactsView.vue        # 通讯录管理 (好友搜索、申请审批、备注修改、呼叫入会)
│   │   ├── settings/
│   │   │   └── SettingsView.vue        # 系统与设备设置 (实时摄像头镜像、麦克风能量条、网络拓扑)
│   │   └── NotFoundView.vue            # 404 友好缺省页
│   ├── App.vue                         # Ant Design Vue 中文国际化与主题定制
│   └── main.js                         # 应用入口挂载
├── .env                                # 默认环境变量
├── .env.example                        # 环境变量模板
├── index.html                          # HTML 入口
├── package.json                        # 锁定稳定依赖版本
├── vite.config.js                      # Vite 基础配置与反向代理
└── README.md                           # 工程说明文档
```

---

## 三、环境变量配置说明

前端工程根目录下提供 `.env.example` 和 `.env` 文件：

```bash
# HTTP 业务接口基准路径 (开发阶段通过 Vite proxy 代理转发至后端 7008 端口)
VITE_API_BASE_URL=/api

# Netty WebSocket 信令服务器地址 (后端端口 7002)
VITE_WS_URL=ws://localhost:7002/ws

# 文件上传与资源预览基准前缀
VITE_FILE_BASE_URL=/file

# WebRTC P2P 打洞默认 STUN 服务器
VITE_STUN_SERVER=stun:stun.l.google.com:19302
```

---

## 四、本地启动与构建

### 4.1 安装依赖
```bash
npm install
```

### 4.2 启动本地开发服务器
```bash
npm run dev
```
启动成功后，浏览器访问：`http://localhost:3000`

### 4.3 生产环境构建
```bash
npm run build
```
构建产物输出至 `dist/` 目录，可直接交由 Nginx 或静态服务器托管。

---

## 五、与 Java 后端联合运行指南

### 5.1 后端服务就绪检查
1. 启动 MySQL，确保数据库表结构（`meeting_info`、`user_info`、`user_contact` 等）已初始化。
2. 启动 Redis 服务（默认 6379 端口）。
3. 运行 `easymeeting-web` 模块中的 `EasymeetingApplication`。
   - Spring Boot 控制台输出端口为 `7008`，上下文为 `/api`。
   - Netty 日志输出 `Netty WebSocket信令服务器启动成功，端口号: 7002`。

### 5.2 前后端联调环境
Vite 内置代理已自动配置如下路由映射，彻底解决前端与后端的同源策略（CORS）与跨协议通信问题：
- `/api` -> `http://localhost:7008/api`
- `/file` -> `http://localhost:7008/file`
- `/ws` -> `ws://localhost:7002/ws`

### 5.3 浏览器安全上下文注意（WebRTC 音视频关键）
- `navigator.mediaDevices.getUserMedia` 和 `getDisplayMedia`（屏幕共享）受现代浏览器安全策略严格保护，**仅允许在 HTTPS 或 `http://localhost` / `http://127.0.0.1` 安全上下文中运行**。
- 若需要在局域网其他计算机（如 `http://192.168.x.x`）访问进行多人视频测试，必须配置 SSL 证书启用 HTTPS，或者在 Chrome 浏览器中开启 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 并添加测试 IP。

---

## 六、WebRTC 与实时信令通信机制

1. **信令拓扑**：
   - 现阶段后端为 **Full Mesh P2P 架构**，无媒体中继转发服务器（SFU）。
   - 服务端负责路由与消息透传；每个客户端与房间内的其他参会成员一对一建立 `RTCPeerConnection`。
2. **入会触发协商**：
   - 用户入会调用 `/meeting/jionMeeting`，服务端广播 `ADD_METING_ROOM`（`messageType=1`）。
   - 房间内现有老成员收到通知后，作为 **Offerer** 主动为新成员创建 RTCPeerConnection 并发送 `offer`。
   - 新成员收到后作为 **Answerer** 回复 `answer`。
   - 双方实时透传交换 `candidate` 完成网络打洞。
3. **屏幕共享与轨道切换**：
   - 屏幕共享采用流轨道热替换（`replaceTrack`），直接将既有连接的 Video Track 替换为屏幕采集轨道，无需全量重新进行 SDP 协商，平滑顺畅。

