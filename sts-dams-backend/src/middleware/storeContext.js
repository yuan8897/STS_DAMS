const { DEFAULT_STORE_ID } = require('../config/constants');

/**
 * 门店上下文中间件。
 *
 * 当前行为: 将 req.storeId 设置为 DEFAULT_STORE_ID (1)。
 *
 * 多门店迁移路径:
 * 1. 覆盖此中间件，从以下来源解析 Store_ID:
 *    - 子域名 (store1.example.com)
 *    - 请求头 (X-Store-ID)
 *    - 用户档案 (Account_Base_Table.Default_Store_ID)
 * 2. 所有数据操作代码已统一使用 req.storeId，无需逐处修改。
 */
function storeContext(req, res, next) {
  req.storeId = DEFAULT_STORE_ID;
  next();
}

module.exports = storeContext;
