# STS-DAMS Frontend

**时空调度与动态资产管理系统** — 前端单页应用 (SPA)

基于 React 18 + TypeScript 5.5 + Vite 5 + TailwindCSS 3 构建的剧本杀门店管理系统前端，涵盖玩家拼车大厅、DM 带场工作台、店长时空大盘/数据大屏/管理后台等完整功能。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript 5.5 |
| 构建 | Vite 5 |
| 样式 | TailwindCSS 3 |
| 路由 | react-router-dom 6 |
| 图表 | ECharts 6 + echarts-for-react 3 |
| 测试 | Vitest + @testing-library/react + Playwright (E2E) |

## 快速启动

### 1. 环境配置

```bash
cp .env.example .env
# 无特殊变量，默认即可
```

### 2. 安装依赖并启动

```bash
npm install
npm run dev     # 启动 Vite 开发服务器 → http://localhost:3000
```

### 3. 构建生产版本

```bash
npm run build   # TypeScript 类型检查 + Vite 打包
npm run preview # 本地预览生产构建
```

**注意**：
- **先启动后端，再启动前端**。开发模式下，Vite 自动将 `/api` 请求代理到后端 `http://localhost:8080`（配置见 `vite.config.ts`）。
- 如果后端端口不是 8080，需修改 `vite.config.ts` 中 `proxy` 的 `target` 为实际后端地址。
- 首次启动前端时，如果后端尚未运行，页面会因 API 请求失败而显示空白或错误，属正常现象，启动后端并刷新页面即可。

## 角色与路由

| 角色 | 首页 | 核心功能 |
|------|------|----------|
| Player (1) | `/lobby` | 拼车大厅、角色选择、参团记录、优惠券钱包、我的评价 |
| DM (2) | `/dm/sessions` | 我的带场、排班管理、场次结算、消费记账、收益查询 |
| Admin (3) | `/admin/dashboard` | 时空大盘、数据大屏、所有管理后台、审计日志 |
| Store_Manager (4) | `/admin/inventory` | 库存管理、排班管理、会员管理、优惠券、评价审核 |

### 完整路由表

```
/login                          — 登录页
/register                       — 注册页
/lobby                          — 拼车大厅
/lobby/session/:sessionId       — 场次详情
/lobby/session/:sessionId/pick-role — 角色选择
/profile                        — 个人中心
/coupons                        — 优惠券钱包
/review/:sessionId              — 发表评价
/notifications                  — 通知中心
/dm/sessions                    — DM 我的带场
/dm/sessions/:sessionId         — DM 场次详情（结算）
/dm/shifts                      — DM 排班管理
/dm/earnings                    — DM 收益查询
/admin/dashboard                — 时空大盘 (Admin only)
/admin/reports                  — 数据大屏 (Admin only)
/admin/settings                 — 系统配置 (Admin only)
/admin/audit                    — 审计日志 (Admin only)
/admin/health                   — 系统健康 (Admin only)
/admin/inventory                — 库存管理
/admin/shifts                   — 排班管理
/admin/membership/levels        — 会员等级
/admin/membership/points        — 积分管理
/admin/coupons/templates        — 优惠券模板
/admin/coupons/issue            — 发放优惠券
/admin/coupons/usage            — 优惠券使用记录
/admin/coupons/instances        — 优惠券实例查询
/admin/reviews                  — 评价管理
/admin/reviews/dm/:dmId         — DM 评价详情
/admin/notifications            — 通知推送
/admin/scripts                  — 剧本资产管理
```

## 项目结构

```
src/
├── App.tsx                # 路由根组件（含懒加载 + 角色路由守卫）
├── main.tsx               # 应用入口
├── index.css              # TailwindCSS + 全局样式
├── api/                   # API 请求层（与后端路由一一对应）
│   ├── client.ts          # 统一 HTTP 客户端（GET/POST/PUT/DELETE）
│   ├── auth.ts            # 认证 API
│   ├── sessions.ts        # 场次 API
│   ├── payments.ts        # 支付 API
│   └── ...                # 共 21 个 API 模块
├── components/
│   ├── common/            # 通用组件
│   │   ├── Loading.tsx        # 加载骨架屏
│   │   ├── EmptyState.tsx     # 空状态提示
│   │   ├── ErrorState.tsx     # 错误重试
│   │   ├── ErrorBoundary.tsx  # React 错误边界
│   │   ├── Toast.tsx          # Toast 通知
│   │   ├── StarRating.tsx     # 星级评分
│   │   ├── CouponCard.tsx     # 优惠券卡片
│   │   └── ProtectedRoute.tsx # 路由守卫
│   ├── layout/
│   │   ├── MobileLayout.tsx   # 玩家/DM 移动端布局
│   │   └── AdminLayout.tsx    # 店长后台管理布局
├── hooks/
│   ├── useDataFetch.ts    # 统一数据获取 Hook（含轮询 + 请求取消）
│   ├── useApiMutation.ts  # 统一写操作 Hook
│   └── useWebSocket.ts    # WebSocket 实时推送 Hook（指数退避重连）
├── pages/
│   ├── login/             # 登录/注册
│   ├── lobby/             # 拼车大厅 + 场次详情 + 角色选择
│   ├── dm/                # DM 工作台
│   ├── profile/           # 个人中心
│   ├── coupons/           # 优惠券钱包
│   ├── reviews/           # 评价
│   ├── notifications/     # 通知
│   └── admin/             # 管理后台（含子目录）
├── store/
│   └── auth.ts            # 认证状态管理
├── types/
│   └── index.ts           # 全局 TypeScript 类型定义（400+ 行）
├── utils/
│   └── format.ts          # 格式化工具
└── constants/
    └── maps.ts            # 枚举状态标签/颜色映射
```

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 (localhost:3000) |
| `npm run build` | TypeScript 类型检查 + 生产构建 |
| `npm run preview` | 本地预览生产构建 |
| `npm test` | 运行 Vitest 组件测试 |
| `npm run test:watch` | 监听模式组件测试 |
| `npm run test:coverage` | 组件测试覆盖率报告 |

## 测试

### 组件单元测试 (Vitest + RTL)
```bash
npm test
# 6 套件 38 用例，覆盖 Toast/Loading/EmptyState/ErrorState/StarRating/ConfirmDialog
```

### E2E 测试 (Playwright)
```bash
# 需先安装 Playwright 浏览器
npx playwright install
# 运行 E2E 测试
npx playwright test tests/e2e/core-flow.spec.ts
# 4 场景：管理员登录看板 / 玩家拼车 / DM 带场 / 角色选择
```

## 关键设计决策

- **代码分割**：Admin 页面（含 ECharts ~1MB）通过 `React.lazy` + `<Suspense>` 按需加载，不阻塞首屏
- **统一数据层**：三个 Hook 范式 — `useDataFetch<T>` (读)、`useApiMutation<TIn,TOut>` (写)、`useWebSocket` (推送)
- **双布局适配**：`AppLayout` 面向 Player/DM (移动端风格) + `AdminLayout` 面向管理后台 (桌面端风格)
- **前端 RBAC**：`ProtectedRoute` + `allowedRoles` 控制路由级访问，与后端 JWT 中间件形成双层鉴权
- **指数退避重连**：WebSocket 断线重连 1s→2s→4s→...→30s max + ±25% jitter
- **乐观锁冲突检测**：更新请求携带 `ROWVERSION` 或 `Precondition` 头
