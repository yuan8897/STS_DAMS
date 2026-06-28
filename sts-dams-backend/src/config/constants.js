/**
 * STS-DAMS 业务常量
 *
 * 集中管理所有魔法数字和业务配置，便于统一调整和审计。
 */

module.exports = {
  /** 积分兑换比率（分/元）：100 积分 = 1 元 */
  POINTS_TO_REDEEM_RATIO: 100,

  /** 积分最高抵扣比例：订单金额的 30% */
  MAX_POINTS_REDEEM_RATIO: 0.3,

  /** 营业日时长（小时），用于日报利用率计算 */
  BUSINESS_DAY_HOURS: 16,

  /** 库存默认安全预警阈值 */
  DEFAULT_SAFETY_ALERT_THRESHOLD: 10,

  /** 数据库连接池默认最大连接数（可通过 DB_POOL_MAX 环境变量覆盖） */
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10', 10),

  /** 通知清理保留天数（90 天前已读通知） */
  NOTIFICATION_RETENTION_DAYS: 90,

  /** 定时任务启动延迟（毫秒），确保数据库连接就绪 */
  SCHEDULER_STARTUP_DELAY_MS: 5000,

  /** 温归档阈值（月）：6 个月前完成的场次 */
  WARM_ARCHIVE_MONTHS: 6,

  /** 优惠券 Percent_Off 有效范围 */
  COUPON_PERCENT_MIN: 0,
  COUPON_PERCENT_MAX: 1,

  /** 默认门店 ID — 当前为单门店部署，预留多门店扩展入口
   *  多门店迁移路径:
   *  1. 覆盖 storeContext 中间件从子域名/Header/用户档案解析 Store_ID
   *  2. 所有数据操作代码通过 req.storeId 获取门店上下文
   */
  DEFAULT_STORE_ID: 1,
};
