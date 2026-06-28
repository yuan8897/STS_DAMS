/**
 * 角色授权中间件
 *
 * 角色码: 1=Player, 2=DM, 3=Admin, 4=Store_Manager
 *
 * Store_Manager (角色 4) 权限说明:
 *   - 可访问：库存管理、排班管理、优惠券管理、评价查看、会员等级管理、积分管理、推送通知
 *   - 不能访问：系统配置、数据大屏、审计日志、系统健康
 */

/** 角色名称映射 */
const ROLE_NAMES = { 1: 'Player', 2: 'DM', 3: 'Admin', 4: 'Store_Manager' };

/** 基于角色码的权限控制（含详细错误消息） */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }
    if (!roles.includes(req.user.Role_Type)) {
      const userRole = ROLE_NAMES[req.user.Role_Type] || `Role_${req.user.Role_Type}`;
      return res.status(403).json({
        error: `权限不足：您的角色为 ${userRole}，此操作需要 ${roles.map(r => ROLE_NAMES[r] || r).join(' / ')} 权限`,
      });
    }
    next();
  };
}

/** 仅允许 Admin (3) 或 Store_Manager (4) 或目标用户本人 */
function allowAdminOrSelf(paramIdField = 'id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未认证' });
    // Admin 和 Store_Manager 全部放行
    if (req.user.Role_Type === 3 || req.user.Role_Type === 4) return next();
    const targetId = parseInt(req.params[paramIdField]);
    if (req.user.User_ID === targetId) return next();
    return res.status(403).json({ error: '权限不足' });
  };
}

/** 仅允许 Admin (3) 或 Store_Manager (4) 或 DM 本人 */
function allowAdminOrDmSelf() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未认证' });
    // Admin 和 Store_Manager 全部放行
    if (req.user.Role_Type === 3 || req.user.Role_Type === 4) return next();
    const targetDmId = parseInt(req.params.id);
    if (req.user.DM_User_ID === targetDmId || req.user.User_ID === targetDmId) return next();
    return res.status(403).json({ error: '权限不足' });
  };
}

module.exports = { authorize, allowAdminOrSelf, allowAdminOrDmSelf };
