/**
 * Swagger / OpenAPI 配置
 * 访问 http://localhost:8080/api/docs
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'STS-DAMS API',
      version: '1.0.0',
      description: `
## 时空调度与动态资产管理系统 (STS-DAMS) REST API

### 认证
大部分接口需要在 Header 中携带 JWT Token：
\`\`\`
Authorization: Bearer <token>
\`\`\`

### 角色权限
| 角色 | Role_Type | 说明 |
|------|-----------|------|
| Player | 1 | 普通玩家 |
| DM | 2 | 带场主持人 |
| Store_Manager | 4 | 门店管理员（部分管理权限） |
| Admin | 3 | 店长（全部管理权限） |

### 种子账号（密码均为 123456）
| 账号 | 角色 |
|------|------|
| admin | 店长 |
| dm_ye / dm_chen / dm_lin | DM |
| player_xiaoming / player_hong / player_lily / player_david | 玩家 |
      `,
      contact: {
        name: 'STS-DAMS Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: '本地开发服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['Account_Name', 'Password'],
          properties: {
            Account_Name: { type: 'string', example: 'admin' },
            Password: { type: 'string', example: '123456' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            User_ID: { type: 'integer' },
            Account_Name: { type: 'string' },
            Role_Type: { type: 'integer', enum: [1, 2, 3, 4] },
            DM_User_ID: { type: 'integer', nullable: true },
            DM_Stage_Name: { type: 'string', nullable: true },
          },
        },
        Session: {
          type: 'object',
          properties: {
            Session_ID: { type: 'integer' },
            Script_Title: { type: 'string' },
            Session_Status: {
              type: 'string',
              enum: ['Matching', 'Locked_Ready', 'In_Progress', 'Completed', 'Aborted'],
            },
            Scheduled_Start_Time: { type: 'string', format: 'date-time' },
            Scheduled_End_Time: { type: 'string', format: 'date-time' },
            Frozen_Per_Head_Price: { type: 'number' },
            Room_Name: { type: 'string' },
            DM_Stage_Name: { type: 'string' },
            Player_Count: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            database: { type: 'string', example: 'connected' },
            websocket: { type: 'object' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: '认证接口' },
      { name: 'Accounts', description: '账户管理' },
      { name: 'Sessions', description: '场次管理' },
      { name: 'DMs', description: 'DM 管理' },
      { name: 'Scripts', description: '剧本管理' },
      { name: 'Rooms', description: '房间管理' },
      { name: 'Payments', description: '支付交易' },
      { name: 'Inventory', description: '库存管理' },
      { name: 'Consumptions', description: '消费记账' },
      { name: 'Membership', description: '会员积分' },
      { name: 'Coupons', description: '优惠券' },
      { name: 'Reviews', description: '评价管理' },
      { name: 'Notifications', description: '通知推送' },
      { name: 'Reports', description: '数据报表' },
      { name: 'Store', description: '门店信息' },
      { name: 'Lookup', description: '字典管理' },
      { name: 'Exports', description: '数据导出' },
      { name: 'Upload', description: '文件上传' },
      { name: 'Health', description: '健康检查' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
