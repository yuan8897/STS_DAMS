/**
 * 角色授权中间件单元测试
 *
 * 纯逻辑测试，不依赖 Express 路由或数据库。
 * 模拟 req/res/next 对象验证 RBAC 行为。
 *
 * 运行：npx jest tests/unit/authorize.test.js
 */
const { authorize, allowAdminOrSelf, allowAdminOrDmSelf } = require('../../src/middleware/authorize');

/** 构造 mock req/res/next */
function mockReqRes(user = null, params = {}) {
  const req = { user, params };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('authorize([roles]) 中间件', () => {
  it('Admin (3) 访问 Admin 权限路由 → 放行', () => {
    const { req, res, next } = mockReqRes({ User_ID: 1, Role_Type: 3 });
    const middleware = authorize(3);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('Player (1) 访问 Admin 权限路由 → 403', () => {
    const { req, res, next } = mockReqRes({ User_ID: 5, Role_Type: 1 });
    const middleware = authorize(3);
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('权限不足');
  });

  it('DM (2) 访问 DM+Admin 共享路由 → 放行', () => {
    const { req, res, next } = mockReqRes({ User_ID: 2, Role_Type: 2 });
    const middleware = authorize(2, 3, 4);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('Store_Manager (4) 访问 Admin 专属路由 → 403', () => {
    const { req, res, next } = mockReqRes({ User_ID: 7, Role_Type: 4 });
    const middleware = authorize(3);
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Store_Manager');
  });

  it('未认证 (无 req.user) → 401', () => {
    const { req, res, next } = mockReqRes(null);
    const middleware = authorize(3);
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('请先登录');
  });

  it('Store_Manager (4) 访问 Admin+StoreManager 共享路由 → 放行', () => {
    const { req, res, next } = mockReqRes({ User_ID: 7, Role_Type: 4 });
    const middleware = authorize(3, 4);
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('403 错误消息包含当前角色和目标权限', () => {
    const { req, res, next } = mockReqRes({ User_ID: 5, Role_Type: 1 });
    const middleware = authorize(3);
    middleware(req, res, next);
    expect(res.body.error).toContain('Player');
    expect(res.body.error).toContain('Admin');
  });
});

describe('allowAdminOrSelf() 中间件', () => {
  it('Admin (3) → 放行', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 1, Role_Type: 3 },
      { id: '5' }
    );
    const middleware = allowAdminOrSelf('id');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('Store_Manager (4) → 放行', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 7, Role_Type: 4 },
      { id: '5' }
    );
    const middleware = allowAdminOrSelf('id');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('用户操作自己的资源 → 放行', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 5, Role_Type: 1 },
      { id: '5' }
    );
    const middleware = allowAdminOrSelf('id');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('用户操作他人的资源 → 403', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 5, Role_Type: 1 },
      { id: '6' }
    );
    const middleware = allowAdminOrSelf('id');
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('未认证 → 401', () => {
    const { req, res, next } = mockReqRes(null, { id: '5' });
    const middleware = allowAdminOrSelf('id');
    middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('未认证');
  });
});

describe('allowAdminOrDmSelf() 中间件', () => {
  it('Admin (3) → 放行', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 1, Role_Type: 3 },
      { id: '2' }
    );
    const middleware = allowAdminOrDmSelf();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('Store_Manager (4) → 放行', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 7, Role_Type: 4 },
      { id: '2' }
    );
    const middleware = allowAdminOrDmSelf();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('DM 访问自己的 DM 档案 → 放行 (DM_User_ID 匹配)', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 2, Role_Type: 2, DM_User_ID: 2 },
      { id: '2' }
    );
    const middleware = allowAdminOrDmSelf();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('DM 访问自己的 DM 档案 → 放行 (User_ID 匹配)', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 2, Role_Type: 2 },
      { id: '2' }
    );
    const middleware = allowAdminOrDmSelf();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('DM 访问其他 DM 的档案 → 403', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 2, Role_Type: 2, DM_User_ID: 2 },
      { id: '3' }
    );
    const middleware = allowAdminOrDmSelf();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('Player 访问 DM 档案 → 403', () => {
    const { req, res, next } = mockReqRes(
      { User_ID: 5, Role_Type: 1 },
      { id: '2' }
    );
    const middleware = allowAdminOrDmSelf();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
