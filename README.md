# STS-DAMS 剧本杀门店管理系统

时空调度与动态资产管理系统（STS-DAMS），面向剧本杀门店的全功能管理平台。

## 技术栈

| 层级   | 技术                                                       |
| ------ | ---------------------------------------------------------- |
| 前端   | React 18 + TypeScript + Vite + Tailwind CSS + ECharts      |
| 后端   | Node.js + Express + WebSocket                              |
| 数据库 | SQL Server（28 张表，含触发器、索引视图、存储过程）        |
| 认证   | JWT + bcryptjs + 角色权限控制                              |
| 测试   | Jest + Supertest（后端）、Vitest + Testing Library（前端） |

## 项目结构

```
├── sts-dams-backend/     # 后端 API 服务
│   ├── src/
│   │   ├── config/       # 数据库、日志、Swagger 配置
│   │   ├── middleware/    # 认证、授权、事务、门店上下文
│   │   ├── routes/       # 20+ 路由模块
│   │   └── utils/        # 分页、响应格式工具
│   ├── scripts/          # 数据库备份、权限恢复等脚本
│   └── tests/            # API 测试 & 并发测试
├── sts-dams-frontend/    # 前端 SPA
│   └── src/
│       ├── api/          # API 请求层
│       ├── components/   # 通用组件 & 布局
│       ├── pages/        # 页面（管理端/DM/玩家）
│       ├── hooks/        # 自定义 hooks
│       └── store/        # 状态管理
├── sql/                  # 数据库脚本（按序执行）
│   ├── 01-*.sql ~ 06-*.sql   # 核心模块建表 + 种子数据
│   ├── 07-indexes.sql        # 索引优化
│   ├── 08-indexed-views.sql  # 索引视图
│   ├── 09-triggers.sql       # 触发器
│   ├── 10-permissions-seed.sql # 权限与种子数据
│   └── 11-*.sql ~ 23-*.sql   # 扩展模块 & 修复脚本
├── database-diagram-28-tables.puml  # 数据库 ER 图
├── enable-sql-tcp.bat       # SQL Server TCP 一键启用
├── enable-tcp.ps1           # SQL Server TCP 启用脚本 (PowerShell)
└── 部署指南.md              # 详细部署文档
```

## 快速开始

### 1. 环境要求

- Node.js ≥ 18.11
- SQL Server 2019 Express 或更高（混合认证模式）

### 2. 数据库初始化

以管理员身份运行 `enable-sql-tcp.bat` 启用 TCP/IP 协议，然后在 SSMS 中按编号顺序执行 `sql/` 目录下的所有 `.sql` 文件。

### 3. 启动后端

```bash
cd sts-dams-backend
cp .env.example .env          # 编辑 .env 填入数据库连接信息
npm install
npm run dev
```

### 4. 启动前端

```bash
cd sts-dams-frontend
cp .env.example .env
npm install
npm run dev
```

前端默认运行在 `http://localhost:3000`，后端 API 运行在 `http://localhost:8080`。

## 功能模块

- **用户与权限** — 注册登录、角色管理、细粒度权限控制
- **DM 排班** — 主持人排班、签到签退、工时统计
- **剧本资产管理** — 剧本上架下架、副本管理、分类标签
- **场次调度** — 玩家预约、场次创建、房间分配
- **库存管理** — 零食饮料进销存、消费记录
- **审计快照** — 多维度审计日志、数据快照
- **会员积分** — 等级体系、积分累计与兑换
- **优惠券** — 模板创建、批量发放、使用核销
- **评价系统** — 玩家对 DM/剧本/场次多维度评分
- **支付结算** — 订单支付、DM 收益结算
- **实时通知** — WebSocket 推送、站内消息
- **数据报表** — ECharts 可视化图表

## 详细文档

参见 [部署指南.md](部署指南.md) 了解完整的部署流程、数据库初始化和常见问题排查。
