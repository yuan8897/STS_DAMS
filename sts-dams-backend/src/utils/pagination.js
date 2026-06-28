/**
 * 统一分页工具
 *
 * 用法：
 *   const { paginate } = require('../utils/pagination');
 *   router.get('/', async (req, res) => {
 *     const result = await paginate({
 *       req,
 *       baseQuery: 'SELECT * FROM SomeTable WHERE 1=1',
 *       countQuery: 'SELECT COUNT(*) AS total FROM SomeTable WHERE 1=1',
 *       request: pool.request(),
 *     });
 *     res.json(result);
 *   });
 */

/**
 * @param {object} opts
 * @param {import('express').Request} opts.req - Express 请求对象 (读取 query.page/query.size)
 * @param {string} opts.baseQuery - 数据查询 SQL (不含 ORDER BY/OFFSET/FETCH)
 * @param {string} opts.countQuery - 计数查询 SQL
 * @param {import('mssql').Request} opts.request - mssql Request 对象 (已绑定参数)
 * @param {string} [opts.defaultOrder] - 默认排序子句 (如 ' ORDER BY Created_At DESC')
 * @returns {Promise<{ data: any[], page: number, size: number, total: number, totalPages: number }>}
 */
async function paginate({ req, baseQuery, countQuery, request, defaultOrder = '' }) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const size = Math.min(200, Math.max(1, parseInt(req.query.size) || 50));
  const offset = (page - 1) * size;

  // 执行计数查询
  const countResult = await request.query(countQuery);
  const total = countResult.recordset[0]?.total ?? 0;

  // 执行分页数据查询
  const orderClause = defaultOrder || ' ORDER BY 1';
  const dataQuery = `${baseQuery}${orderClause} OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`;
  const dataResult = await request.query(dataQuery);

  return {
    data: dataResult.recordset,
    page,
    size,
    total,
    totalPages: Math.ceil(total / size),
  };
}

module.exports = { paginate };
