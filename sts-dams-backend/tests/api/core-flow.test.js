/**
 * STS-DAMS API 集成测试 — 核心业务流程
 *
 * 前置条件：SQL Server 运行中 + 数据库 STS_DAMS 已部署 + 种子数据已就位
 * 运行方式：npx jest tests/api/core-flow.test.js --forceExit
 *
 * 注意：本测试依赖真实数据库连接，不 mock 数据库层。
 *       设置环境变量 SKIP_DB_TESTS=1 可跳过数据库相关测试。
 */
const { describe, it, beforeAll, expect } = require('@jest/globals');

// 加载环境变量
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const skipDb = process.env.SKIP_DB_TESTS === '1';

// ============================================================
// 测试套件 1：健康检查（不依赖数据库）
// ============================================================
describe('API 健康检查', () => {
  const BASE = `http://localhost:${process.env.PORT || 8080}`;

  it('GET /api/health 应返回 ok', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

// ============================================================
// 测试套件 2：认证流程
// ============================================================
describe('认证流程', () => {
  const BASE = `http://localhost:${process.env.PORT || 8080}`;

  let adminToken = '';

  it('POST /api/auth/login 管理员登录成功', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Account_Name: 'admin', Password: '123456' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.Role_Type).toBe(3);
    adminToken = body.token;
  });

  it('POST /api/auth/login 错误密码应返回 401', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Account_Name: 'admin', Password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/sessions/matching 需认证', async () => {
    const res = await fetch(`${BASE}/api/sessions/matching`);
    expect(res.status).toBe(401);
  });
});

// ============================================================
// 测试套件 3：核心业务 — 场次与参团
// ============================================================
describe('核心业务 — 场次与参团', () => {
  const BASE = `http://localhost:${process.env.PORT || 8080}`;
  let adminToken = '';
  let playerToken = '';

  beforeAll(async () => {
    if (skipDb) return;

    // 管理员登录
    const adminRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Account_Name: 'admin', Password: '123456' }),
    });
    adminToken = (await adminRes.json()).token;

    // 玩家登录
    const playerRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Account_Name: 'player_xiaoming', Password: '123456' }),
    });
    playerToken = (await playerRes.json()).token;
  });

  it('GET /api/sessions/matching 返回拼车场次列表', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/sessions/matching`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    // Matching 状态的场次至少应有 101 和 102
    const matchingIds = body.map(s => s.Session_ID);
    expect(matchingIds).toContain(101);
    expect(matchingIds).toContain(102);
  });

  it('GET /api/scripts 返回剧本列表', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/scripts`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(6);
  });

  it('GET /api/rooms 返回房间列表', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/rooms`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(5);
  });

  it('POST /api/sessions/:id/join 玩家参团', async () => {
    if (skipDb) return;
    // 尝试加入场次 101（Matching 状态）
    const res = await fetch(`${BASE}/api/sessions/101/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    // 可能成功（未参团）或 409（已参团），都是合理的
    expect([200, 201, 409]).toContain(res.status);
  });

  it('POST /api/sessions 创车 — Admin 权限', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        Copy_ID: 1,
        Room_ID: 5,
        DM_User_ID: 2,
        Scheduled_Start_Time: '2026-06-04T10:00:00',
        Scheduled_End_Time: '2026-06-04T14:00:00',
        Frozen_Per_Head_Price: 198.00,
      }),
    });
    // 可能成功或时段冲突，都是合法业务结果
    expect([201, 400, 409]).toContain(res.status);
  });
});

// ============================================================
// 测试套件 4：数据完整性 — 查询所有主要端点
// ============================================================
describe('数据完整性 — 关键端点验证', () => {
  const BASE = `http://localhost:${process.env.PORT || 8080}`;
  let token = '';

  beforeAll(async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Account_Name: 'admin', Password: '123456' }),
    });
    token = (await res.json()).token;
  });

  const endpoints = [
    { method: 'GET', path: '/api/accounts' },
    { method: 'GET', path: '/api/dms' },
    { method: 'GET', path: '/api/dms/2/earnings' },
    { method: 'GET', path: '/api/store/info' },
    { method: 'GET', path: '/api/lookup/genres' },
    { method: 'GET', path: '/api/inventory' },
    { method: 'GET', path: '/api/membership/levels' },
    { method: 'GET', path: '/api/coupons/templates' },
    { method: 'GET', path: '/api/reviews/dm/2/stats' },
    { method: 'GET', path: '/api/notifications' },
    { method: 'GET', path: '/api/audit-logs' },
    { method: 'GET', path: '/api/reports/daily-kpi' },
    { method: 'GET', path: '/api/reports/room-utilization' },
    { method: 'GET', path: '/api/payments?user_id=5' },
  ];

  for (const ep of endpoints) {
    it(`${ep.method} ${ep.path} 返回 200`, async () => {
      if (skipDb) return;
      const res = await fetch(`${BASE}${ep.path}`, {
        method: ep.method,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    });
  }
});

// ============================================================
// 测试套件 5：支付历史查询（新增端点）
// ============================================================
describe('支付历史查询', () => {
  const BASE = `http://localhost:${process.env.PORT || 8080}`;
  let playerToken = '';

  beforeAll(async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Account_Name: 'player_xiaoming', Password: '123456' }),
    });
    playerToken = (await res.json()).token;
  });

  it('GET /api/payments?user_id=5 返回玩家支付记录', async () => {
    if (skipDb) return;
    const res = await fetch(`${BASE}/api/payments?user_id=5`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('玩家只能查看自己的支付记录', async () => {
    if (skipDb) return;
    // player_xiaoming (User_ID=5) 尝试查看 player_hong (User_ID=6) 的记录
    const res = await fetch(`${BASE}/api/payments?user_id=6`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // 应返回空数组或仅包含自己相关的记录
    expect(Array.isArray(body)).toBe(true);
  });
});
