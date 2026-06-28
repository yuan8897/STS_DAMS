# STS-DAMS Backend

**时空调度与动态资产管理系统** — 后端 API 服务

基于 Node.js + Express 4 构建的 RESTful API + WebSocket 实时推送服务，为剧本杀门店管理提供完整的数据持久化与业务规则校验。

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Node.js 18+ |
| 框架 | Express 4 |
| 数据库 | SQL Server 2019+ (mssql 11) |
| 认证 | JWT (jsonwebtoken) + bcryptjs |
| 实时推送 | WebSocket (ws 8) |
| 定时任务 | node-cron 4 |
| 文件上传 | multer 2 |
| API 文档 | swagger-jsdoc + swagger-ui-express |
| 测试 | Jest + Supertest |

## 快速启动

### 1. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，配置数据库连接和 JWT 密钥
```

`.env` 中需要修改的关键项：

| 变量 | 说明 |
|------|------|
| `DB_SERVER` | SQL Server 实例名。**默认实例**填 `localhost`；**Express 版**通常为 `localhost\SQLEXPRESS`（注意是反斜杠 `\`） |
| `DB_PORT` | 默认 `1433`，如 SQL Server 配置了不同端口则修改 |
| `DB_NAME` | 数据库名称，默认 `STS_DAMS` |
| `DB_USER` / `DB_PASSWORD` | SQL Server 登录账号密码（创建数据库时设定） |
| `DB_TRUSTED` | 设为 `true` 可改用 Windows 集成认证，此时忽略 DB_USER/DB_PASSWORD |
| `JWT_SECRET` | JWT 签名密钥，生产环境请替换为随机字符串 |
| `AES_ENCRYPTION_KEY` | 必须正好 32 字节，生产环境请替换 |

> **换机注意**：不同电脑上 SQL Server 的实例名可能不同。如果不确定自己的实例名，打开 SSMS 连接对话框，服务器名称下拉框会显示实际的实例名。

### 2. 数据库初始化

```bash
# 使用 SQL Server Management Studio 或 sqlcmd
# 按顺序执行 sql/ 目录下的 SQL 脚本：

# 主建表脚本（01-09）
sqlcmd -S localhost -d STS_DAMS -i sql/01-lookup-tables.sql
sqlcmd -S localhost -d STS_DAMS -i sql/02-module1-user-dm.sql
# ... 依次执行至 sql/09-triggers.sql

# 扩展模块（11-12）
sqlcmd -S localhost -d STS_DAMS -i sql/11-module6-9-expansion.sql
sqlcmd -S localhost -d STS_DAMS -i sql/12-seed-expansion-only.sql

# 种子数据补充
sqlcmd -S localhost -d STS_DAMS -i sql/13-seed-remaining.sql

# 修复脚本（按需执行）
# sql/ 目录下 14-22 为增量修复脚本
```

### 3. 安装依赖并启动

```bash
npm install
npm run dev    # 开发模式 (node --watch)
# 或
npm start      # 生产模式
```

服务启动于 `http://localhost:8080`

### 4. 验证

```bash
curl http://localhost:8080/api/health
# {"status":"ok","database":"connected","websocket":{"total_users":0,"total_connections":0}}

# Swagger 文档
open http://localhost:8080/api/docs
```

## 项目结构

```
src/
├── server.js           # 应用入口，Express + HTTP + WebSocket
├── wsServer.js         # WebSocket 实时推送服务
├── scheduler.js        # 定时任务（KPI 快照、归档、库存预警等）
├── config/
│   ├── db.js           # 数据库连接池 + CONTEXT_INFO 审计
│   ├── constants.js    # 业务常量集中管理
│   ├── logger.js       # 结构化日志（JSON 格式）
│   └── swagger.js      # OpenAPI 3.0 文档配置
├── middleware/
│   ├── auth.js         # JWT 认证中间件
│   ├── authorize.js    # RBAC 角色授权中间件
│   ├── storeContext.js # 门店上下文（预留多门店扩展）
│   └── transaction.js  # 事务管理（死锁重试 + 超时保护）
├── routes/
│   ├── auth.js         # 认证（注册/登录）
│   ├── accounts.js     # 账户管理
│   ├── dms.js          # DM 主持管理
│   ├── sessions.js     # 场次调度
│   ├── rooms.js        # 房间管理
│   ├── scripts.js      # 剧本库管理
│   ├── payments.js     # 支付交易
│   ├── consumptions.js # 消费记账
│   ├── inventory.js    # 库存管理
│   ├── membership.js   # 会员积分
│   ├── coupons.js      # 优惠券
│   ├── reviews.js      # 评价管理
│   ├── notifications.js# 通知推送
│   ├── reports.js      # 数据报表
│   ├── exports.js      # 数据导出
│   ├── store.js        # 门店信息
│   ├── lookup.js       # 字典管理
│   ├── upload.js       # 文件上传
│   └── health.js       # 健康检查
└── utils/
    ├── response.js     # 统一响应格式
    └── pagination.js   # 统一分页工具
```

## 角色权限

| 角色 | Role_Type | 说明 |
|------|-----------|------|
| Player | 1 | 玩家 |
| DM | 2 | 主持人 |
| Admin | 3 | 店长（全部权限） |
| Store_Manager | 4 | 门店管理员（部分管理权限） |

## 种子账号

| 账号 | 角色 | 密码 |
|------|------|------|
| admin | Admin (店长) | 123456 |
| dm_ye / dm_chen / dm_lin | DM (主持人) | 123456 |
| player_xiaoming / player_hong / player_lily / player_david | Player (玩家) | 123456 |

> ⚠️ **重要**：种子密码为演示用途，生产部署请执行 `node scripts/reset-passwords.js --random` 替换。

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 启动生产服务器 |
| `npm run dev` | 启动开发服务器（热重载） |
| `npm test` | 运行测试套件 |
| `npm run test:skip-db` | 运行测试（跳过数据库依赖） |
| `npm run backup` | 完整数据库备份 |
| `npm run backup:schema` | 仅备份表结构 |
| `npm run backup:seed` | 仅备份种子数据 |
| `npm run restore-permissions` | 恢复事件溯源表写保护 |

## API 端点

### 健康检查
```
GET /api/health          # 数据库 + WebSocket 状态
GET /api/docs            # Swagger 交互式文档
GET /api/docs.json       # OpenAPI 3.0 JSON
```

### 认证 (无需认证)
```
POST /api/auth/register  # 注册
POST /api/auth/login     # 登录
```

### 业务接口 (需认证 + Bearer Token)

完整接口文档请访问 `http://localhost:8080/api/docs`

## 关键设计决策

- **事件溯源**：支付/库存/消费/审计 四表 `DENY UPDATE, DELETE TO PUBLIC`
- **三重对账锚点**：`Frozen_Per_Head_Price` + `Unit_Price_At_Sale` + `Line_Total_Cost`
- **死锁重试**：自动检测 SQL Server 1205/1222 错误，指数退避重试 3 次
- **参数化查询**：100% `request.input()` 绑定，杜绝 SQL 注入
- **统一响应信封**：`res.success(data, msg)` / `res.fail(error, code)`
- **结构化日志**：JSON 格式，支持 `LOG_LEVEL` 环境变量分级
