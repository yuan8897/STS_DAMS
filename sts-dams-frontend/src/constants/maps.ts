/**
 * STS-DAMS 统一常量映射
 *
 * 所有状态标签、颜色、题材等映射集中在此文件。
 * 页面组件不应再内联定义这些映射——请从这里导入。
 *
 * 用法示例：
 *   import { SESSION_STATUS_LABEL, SESSION_STATUS_BADGE, GENRES } from '../../constants/maps';
 */

import type {
  SessionStatus, PaymentStatus, CouponStatus, EmploymentStatus,
  AssetCondition, RoomStatus, ProficiencyLevel, NotificationType,
  MovementType,
} from '../types';

// ============================================================
//  场次状态 (SessionStatus)
// ============================================================

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  Matching: '拼车中',
  Locked_Ready: '已锁车',
  In_Progress: '进行中',
  Completed: '已完成',
  Aborted: '已取消',
};

export const SESSION_STATUS_COLOR: Record<SessionStatus, string> = {
  Matching: '#5b8def',
  Locked_Ready: '#f0a050',
  In_Progress: '#50c878',
  Completed: '#888888',
  Aborted: '#e04040',
};

export const SESSION_STATUS_BADGE: Record<SessionStatus, string> = {
  Matching: 'bg-blue-50 text-blue-600 border-blue-100',
  Locked_Ready: 'bg-orange-50 text-orange-600 border-orange-100',
  In_Progress: 'bg-green-50 text-green-600 border-green-100',
  Completed: 'bg-gray-50 text-gray-400 border-gray-100',
  Aborted: 'bg-red-50 text-red-400 border-red-100',
};

// 状态流转顺序索引
export const SESSION_STATUS_ORDER: Record<SessionStatus, number> = {
  Matching: 0,
  Locked_Ready: 1,
  In_Progress: 2,
  Completed: 3,
  Aborted: 4,
};

// ============================================================
//  支付状态 (PaymentStatus)
// ============================================================

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  Unpaid: '未支付',
  Deposit_Paid: '已付定金',
  Fully_Paid: '已付全款',
  Refunded: '已退款',
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  Unpaid: '#e04040',
  Deposit_Paid: '#f0a050',
  Fully_Paid: '#50c878',
  Refunded: '#888888',
};

// ============================================================
//  优惠券状态 (CouponStatus)
// ============================================================

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  Unused: '未使用',
  Used: '已使用',
  Expired: '已过期',
  Revoked: '已撤销',
};

export const COUPON_STATUS_COLOR: Record<CouponStatus, string> = {
  Unused: '#50c878',
  Used: '#888888',
  Expired: '#e04040',
  Revoked: '#f0a050',
};

// ============================================================
//  DM 聘用状态 (EmploymentStatus)
// ============================================================

export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  Probation: '试用期',
  Active: '在职',
  On_Leave: '休假中',
  Terminated: '已离职',
};

// ============================================================
//  副本资产状态 (AssetCondition)
// ============================================================

export const ASSET_CONDITION_LABEL: Record<AssetCondition, string> = {
  Perfect: '完好',
  Worn: '轻微磨损',
  In_Maintenance: '维护中',
  Scrapped: '已报废',
};

// ============================================================
//  房间状态 (RoomStatus)
// ============================================================

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  Operational: '正常运营',
  Under_Maintenance: '维护中',
};

// ============================================================
//  DM 熟练度 (ProficiencyLevel)
// ============================================================

export const PROFICIENCY_LABEL: Record<ProficiencyLevel, string> = {
  Trained: '已培训',
  Proficient: '熟练',
  Expert: '精通',
};

export const PROFICIENCY_COLOR: Record<ProficiencyLevel, string> = {
  Trained: '#5b8def',
  Proficient: '#50c878',
  Expert: '#f0a050',
};

// ============================================================
//  库存变动类型 (MovementType)
// ============================================================

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  Purchase_In: '采购入库',
  Sale_Out: '销售出库',
  Damage_Loss: '报损',
  Inventory_Adjust: '盘点调整',
  Initial_Stock: '期初建账',
};

// ============================================================
//  通知类型图标
// ============================================================

export const NOTIFICATION_TYPE_ICON: Record<string, string> = {
  session_ready: '✅',
  session_cancelled: '❌',
  inventory_alert: '📦',
  new_session: '🎉',
  payment_reminder: '💰',
  session_risk: '⚠️',
  Session_Reminder: '🎭',
  Payment_Confirm: '💰',
  Coupon_Issued: '🎫',
  Coupon_Expiring: '⏰',
  System_Announce: '📢',
  Low_Stock_Alert: '📦',
  Review_Request: '⭐',
};

// ============================================================
//  题材 (Genre)
// ============================================================

export const GENRES: Record<number, string> = {
  1: '恐怖', 2: '情感', 3: '硬核推理', 4: '欢乐', 5: '机制',
  6: '古风', 7: '民国', 8: '现代', 9: '欧式', 10: '日式',
};

// ============================================================
//  角色类型
// ============================================================

export const ROLE_LABELS: Record<number, string> = {
  1: '玩家', 2: 'DM', 3: '店长', 4: '门店管理员',
};

// ============================================================
//  会员等级名称与颜色
// ============================================================

export const LEVEL_NAMES: Record<string, string> = {
  Bronze: '青铜', Silver: '白银', Gold: '黄金', Platinum: '铂金', Diamond: '钻石',
};

export const LEVEL_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700', Platinum: '#e5e4e2', Diamond: '#b9f2ff',
};

// ============================================================
//  默认门店 ID（所有页面的唯一来源）
// ============================================================

export const DEFAULT_STORE_ID = 1;

// ============================================================
//  图表色板
// ============================================================

export const CHART_COLORS = [
  '#5b8def', '#50c878', '#f0a050', '#e04040', '#7c5ce0',
  '#ff6b6b', '#48dbfb', '#ff9ff3', '#feca57', '#54a0ff',
];

// ============================================================
//  库存商品分类
// ============================================================

export const INVENTORY_CATEGORIES = ['饮料', '零食', '剧本耗材', '道具服饰', '其他'];

// ============================================================
//  审计操作类型
// ============================================================

export const AUDIT_ACTION_TYPES = [
  'CREATE_SESSION', 'CANCEL_SESSION', 'ISSUE_REFUND', 'ADJUST_INVENTORY',
  'MODIFY_DM_SHIFT', 'UPDATE_SESSION', 'USER_LOGIN',
];
