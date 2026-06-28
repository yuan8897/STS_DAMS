const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

const router = Router();
router.use(authenticate);
router.use(authorize(3)); // 仅 Admin

/** HTML 实体转义 — 防止 XSS 攻击 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 将记录集转为 CSV 字符串（BOM + 转义） */
function toCSV(columns, rows) {
  const BOM = '﻿';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col] != null ? String(row[col]) : '';
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  ).join('\n');
  return BOM + header + '\n' + body;
}

// GET /api/exports/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/payments', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `SELECT t.Transaction_ID, t.Registration_ID, t.Transaction_Type,
                        t.Amount, t.Payment_Method, t.External_Reference_No,
                        t.Processed_At, t.Remarks,
                        a.Account_Name AS Operator_Name,
                        reg.Player_User_ID,
                        pa.Account_Name AS Player_Name,
                        s.Session_ID, s.Frozen_Per_Head_Price
                 FROM Payment_Transaction_Table t
                 LEFT JOIN Account_Base_Table a ON a.User_ID = t.Operator_User_ID
                 LEFT JOIN Bridge_Player_Registration reg ON reg.Registration_ID = t.Registration_ID
                 LEFT JOIN Account_Base_Table pa ON pa.User_ID = reg.Player_User_ID
                 LEFT JOIN Fact_Session_Schedule s ON s.Session_ID = reg.Session_ID
                 WHERE 1=1`;
    const request = (await getPool()).request();
    if (from) query += ' AND t.Processed_At >= @from', request.input('from', sql.DateTime2, new Date(from));
    if (to) query += ' AND t.Processed_At < DATEADD(DAY, 1, @to)', request.input('to', sql.Date, to);
    query += ' ORDER BY t.Processed_At';

    const result = await request.query(query);
    const columns = ['Transaction_ID', 'Registration_ID', 'Transaction_Type', 'Amount',
                     'Payment_Method', 'External_Reference_No', 'Processed_At', 'Remarks',
                     'Operator_Name', 'Player_Name', 'Session_ID', 'Frozen_Per_Head_Price'];
    const csv = toCSV(columns, result.recordset);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=payments_${from || 'all'}_${to || 'all'}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export payments error:', err);
    res.status(500).json({ error: '导出支付报表失败' });
  }
});

// GET /api/exports/inventory?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/inventory', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `SELECT m.Movement_ID, i.Item_Name, i.Item_Category,
                        m.Quantity_Delta, m.Movement_Type, m.Movement_Reason,
                        m.Movement_At, a.Account_Name AS Operator_Name,
                        m.Related_Session_ID
                 FROM Inventory_Movement_Ledger m
                 JOIN Dim_Inventory_Item i ON i.Item_ID = m.Item_ID
                 LEFT JOIN Account_Base_Table a ON a.User_ID = m.Operator_User_ID
                 WHERE 1=1`;
    const request = (await getPool()).request();
    if (from) query += ' AND m.Movement_At >= @from', request.input('from', sql.DateTime2, new Date(from));
    if (to) query += ' AND m.Movement_At < DATEADD(DAY, 1, @to)', request.input('to', sql.Date, to);
    query += ' ORDER BY m.Movement_At';

    const result = await request.query(query);
    const columns = ['Movement_ID', 'Item_Name', 'Item_Category', 'Quantity_Delta',
                     'Movement_Type', 'Movement_Reason', 'Movement_At',
                     'Operator_Name', 'Related_Session_ID'];
    const csv = toCSV(columns, result.recordset);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=inventory_${from || 'all'}_${to || 'all'}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export inventory error:', err);
    res.status(500).json({ error: '导出库存报表失败' });
  }
});

// GET /api/exports/audit-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/audit-logs', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `SELECT l.Audit_ID, l.Action_Type, l.Target_Entity, l.Target_Record_ID,
                        l.Action_Details, l.Client_IP, l.Logged_At,
                        a.Account_Name AS Operator_Name
                 FROM System_Audit_Log_Table l
                 LEFT JOIN Account_Base_Table a ON a.User_ID = l.Operator_User_ID
                 WHERE 1=1`;
    const request = (await getPool()).request();
    if (from) query += ' AND l.Logged_At >= @from', request.input('from', sql.DateTime2, new Date(from));
    if (to) query += ' AND l.Logged_At < DATEADD(DAY, 1, @to)', request.input('to', sql.Date, to);
    query += ' ORDER BY l.Logged_At DESC';

    const result = await request.query(query);
    const columns = ['Audit_ID', 'Action_Type', 'Target_Entity', 'Target_Record_ID',
                     'Action_Details', 'Client_IP', 'Logged_At', 'Operator_Name'];
    const csv = toCSV(columns, result.recordset);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${from || 'all'}_${to || 'all'}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export audit error:', err);
    res.status(500).json({ error: '导出审计日志失败' });
  }
});

// ==================== HTML 可打印报表 ====================

/** 生成可打印的 HTML 报表页面 */
function htmlReport(title, sections) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title} — STS-DAMS</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 12px; color: #333; padding: 20px; }
    h1 { font-size: 20px; text-align: center; margin-bottom: 5px; color: #2c3e6b; }
    .subtitle { text-align: center; color: #999; font-size: 11px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
    th { background: #2c3e6b; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr:nth-child(even) td { background: #f9fafb; }
    .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 120px; background: #f0f2f5; border-radius: 8px; padding: 12px 15px; text-align: center; }
    .summary-card .label { font-size: 10px; color: #999; margin-bottom: 4px; }
    .summary-card .value { font-size: 22px; font-weight: bold; color: #2c3e6b; }
    .footer { text-align: center; color: #ccc; font-size: 10px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; }
    .amount { font-family: "Courier New", monospace; text-align: right; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">STS-DAMS 时空调度与动态资产管理系统 · 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  ${sections}
  <div class="footer">STS-DAMS © ${new Date().getFullYear()} — 本报表由系统自动生成</div>
</body>
</html>`;
}

// GET /api/exports/report/payments?from=&to= — 支付报表 (HTML可打印)
router.get('/report/payments', async (req, res) => {
  try {
    const { from, to } = req.query;
    const request = (await getPool()).request();

    let query = `SELECT t.Transaction_ID, t.Transaction_Type, t.Amount, t.Payment_Method,
                        t.Processed_At, t.Remarks,
                        a.Account_Name AS Operator_Name,
                        pa.Account_Name AS Player_Name,
                        s.Session_ID
                 FROM Payment_Transaction_Table t
                 LEFT JOIN Account_Base_Table a ON a.User_ID = t.Operator_User_ID
                 LEFT JOIN Bridge_Player_Registration reg ON reg.Registration_ID = t.Registration_ID
                 LEFT JOIN Account_Base_Table pa ON pa.User_ID = reg.Player_User_ID
                 LEFT JOIN Fact_Session_Schedule s ON s.Session_ID = reg.Session_ID
                 WHERE 1=1`;
    if (from) { query += ' AND t.Processed_At >= @from'; request.input('from', sql.DateTime2, new Date(from)); }
    if (to) { query += ' AND t.Processed_At < DATEADD(DAY, 1, @to)'; request.input('to', sql.Date, to); }
    query += ' ORDER BY t.Processed_At';

    const result = await request.query(query);
    const rows = result.recordset;

    // 汇总
    const totalAmount = rows.reduce((sum, r) => sum + (r.Amount || 0), 0);
    const depositAmount = rows.filter(r => r.Transaction_Type === 'Deposit').reduce((s, r) => s + r.Amount, 0);
    const finalAmount = rows.filter(r => r.Transaction_Type === 'Final_Payment').reduce((s, r) => s + r.Amount, 0);
    const refundAmount = rows.filter(r => r.Transaction_Type === 'Refund').reduce((s, r) => s + Math.abs(r.Amount), 0);
    const countByMethod = {};
    rows.forEach(r => { countByMethod[r.Payment_Method] = (countByMethod[r.Payment_Method] || 0) + 1; });

    const sections = `
  <div class="summary">
    <div class="summary-card"><div class="label">总交易笔数</div><div class="value">${rows.length}</div></div>
    <div class="summary-card"><div class="label">定金合计</div><div class="value">¥${depositAmount.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">尾款合计</div><div class="value">¥${finalAmount.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">退款合计</div><div class="value">¥${refundAmount.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">净收入</div><div class="value">¥${totalAmount.toFixed(2)}</div></div>
  </div>
  <div class="summary">
    ${Object.entries(countByMethod).map(([k, v]) =>
      `<div class="summary-card"><div class="label">${k}</div><div class="value">${v}</div></div>`
    ).join('')}
  </div>
  <table>
    <thead><tr>
      <th>交易ID</th><th>类型</th><th>金额</th><th>支付方式</th>
      <th>玩家</th><th>场次</th><th>操作者</th><th>时间</th><th>备注</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(r.Transaction_ID)}</td>
          <td>${escapeHtml(r.Transaction_Type)}</td>
          <td class="amount ${r.Amount < 0 ? 'negative' : 'positive'}">¥${escapeHtml(r.Amount?.toFixed(2))}</td>
          <td>${escapeHtml(r.Payment_Method)}</td>
          <td>${escapeHtml(r.Player_Name) || '—'}</td>
          <td>#${escapeHtml(r.Session_ID) || '—'}</td>
          <td>${escapeHtml(r.Operator_Name) || '—'}</td>
          <td>${r.Processed_At ? new Date(r.Processed_At).toLocaleString('zh-CN') : '—'}</td>
          <td>${escapeHtml(r.Remarks) || '—'}</td>
        </tr>`).join('')}
    </tbody>
  </table>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlReport('支付交易报表', sections));
  } catch (err) {
    console.error('HTML report payments error:', err);
    res.status(500).json({ error: '生成报表失败' });
  }
});

// GET /api/exports/report/inventory?from=&to= — 库存报表 (HTML可打印)
router.get('/report/inventory', async (req, res) => {
  try {
    const { from, to } = req.query;
    const request = (await getPool()).request();

    let query = `SELECT m.Movement_ID, i.Item_Name, i.Item_Category,
                        m.Quantity_Delta, m.Movement_Type, m.Movement_Reason,
                        m.Movement_At, a.Account_Name AS Operator_Name
                 FROM Inventory_Movement_Ledger m
                 JOIN Dim_Inventory_Item i ON i.Item_ID = m.Item_ID
                 LEFT JOIN Account_Base_Table a ON a.User_ID = m.Operator_User_ID
                 WHERE 1=1`;
    if (from) { query += ' AND m.Movement_At >= @from'; request.input('from', sql.DateTime2, new Date(from)); }
    if (to) { query += ' AND m.Movement_At < DATEADD(DAY, 1, @to)'; request.input('to', sql.Date, to); }
    query += ' ORDER BY m.Movement_At DESC';

    const result = await request.query(query);
    const rows = result.recordset;

    const totalIn = rows.filter(r => r.Quantity_Delta > 0).reduce((s, r) => s + r.Quantity_Delta, 0);
    const totalOut = rows.filter(r => r.Quantity_Delta < 0).reduce((s, r) => s + Math.abs(r.Quantity_Delta), 0);

    const sections = `
  <div class="summary">
    <div class="summary-card"><div class="label">总流水数</div><div class="value">${rows.length}</div></div>
    <div class="summary-card"><div class="label">总入库量</div><div class="value">${totalIn}</div></div>
    <div class="summary-card"><div class="label">总出库量</div><div class="value">${totalOut}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>流水ID</th><th>商品</th><th>类别</th><th>变动量</th>
      <th>类型</th><th>操作者</th><th>时间</th><th>原因</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(r.Movement_ID)}</td>
          <td>${escapeHtml(r.Item_Name)}</td>
          <td>${escapeHtml(r.Item_Category)}</td>
          <td class="amount ${r.Quantity_Delta < 0 ? 'negative' : 'positive'}">${r.Quantity_Delta > 0 ? '+' : ''}${escapeHtml(r.Quantity_Delta)}</td>
          <td>${escapeHtml(r.Movement_Type)}</td>
          <td>${escapeHtml(r.Operator_Name) || '—'}</td>
          <td>${r.Movement_At ? new Date(r.Movement_At).toLocaleString('zh-CN') : '—'}</td>
          <td>${escapeHtml(r.Movement_Reason) || '—'}</td>
        </tr>`).join('')}
    </tbody>
  </table>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlReport('库存流水报表', sections));
  } catch (err) {
    console.error('HTML report inventory error:', err);
    res.status(500).json({ error: '生成报表失败' });
  }
});

// GET /api/exports/report/audit?from=&to= — 审计报表 (HTML可打印)
router.get('/report/audit', async (req, res) => {
  try {
    const { from, to } = req.query;
    const request = (await getPool()).request();

    let query = `SELECT l.Audit_ID, l.Action_Type, l.Target_Entity, l.Target_Record_ID,
                        l.Action_Details, l.Client_IP, l.Logged_At,
                        a.Account_Name AS Operator_Name
                 FROM System_Audit_Log_Table l
                 LEFT JOIN Account_Base_Table a ON a.User_ID = l.Operator_User_ID
                 WHERE 1=1`;
    if (from) { query += ' AND l.Logged_At >= @from'; request.input('from', sql.DateTime2, new Date(from)); }
    if (to) { query += ' AND l.Logged_At < DATEADD(DAY, 1, @to)'; request.input('to', sql.Date, to); }
    query += ' ORDER BY l.Logged_At DESC';

    const result = await request.query(query);
    const rows = result.recordset;

    const actionCounts = {};
    rows.forEach(r => { actionCounts[r.Action_Type] = (actionCounts[r.Action_Type] || 0) + 1; });

    const sections = `
  <div class="summary">
    <div class="summary-card"><div class="label">总记录数</div><div class="value">${rows.length}</div></div>
    ${Object.entries(actionCounts).slice(0, 6).map(([k, v]) =>
      `<div class="summary-card"><div class="label">${k}</div><div class="value">${v}</div></div>`
    ).join('')}
  </div>
  <table>
    <thead><tr>
      <th>ID</th><th>操作类型</th><th>目标实体</th><th>记录ID</th>
      <th>操作者</th><th>时间</th><th>IP</th><th>详情</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${escapeHtml(r.Audit_ID)}</td>
          <td>${escapeHtml(r.Action_Type)}</td>
          <td>${escapeHtml(r.Target_Entity)}</td>
          <td>${escapeHtml(r.Target_Record_ID)}</td>
          <td>${escapeHtml(r.Operator_Name) || '—'}</td>
          <td>${r.Logged_At ? new Date(r.Logged_At).toLocaleString('zh-CN') : '—'}</td>
          <td>${escapeHtml(r.Client_IP) || '—'}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml((r.Action_Details || '—').slice(0, 80))}</td>
        </tr>`).join('')}
    </tbody>
  </table>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlReport('审计日志报表', sections));
  } catch (err) {
    console.error('HTML report audit error:', err);
    res.status(500).json({ error: '生成报表失败' });
  }
});

module.exports = router;
