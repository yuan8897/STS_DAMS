/**
 * STS-DAMS 统一 API 响应格式
 *
 * 所有成功响应使用 res.success(data, message)，失败使用 res.fail(error, statusCode)。
 * 逐步迁移各路由到统一信封格式 { success: boolean, data?: any, message?: string, error?: string }。
 *
 * 用法：
 *   const { respond } = require('../utils/response');
 *   app.use(respond);
 *   // 在路由中: res.success(data, '操作成功'); 或 res.fail('参数错误', 400);
 */

function respond(req, res, next) {
  res.success = function (data = null, message = '操作成功') {
    const body = { success: true, message };
    if (data !== null && data !== undefined) {
      body.data = data;
    }
    return res.json(body);
  };

  res.fail = function (error = '服务器内部错误', statusCode = 500) {
    return res.status(statusCode).json({
      success: false,
      error: typeof error === 'string' ? error : error.message || '服务器内部错误',
    });
  };

  next();
}

module.exports = { respond };
