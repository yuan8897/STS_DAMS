import React, { useState } from 'react';
import { getTemplates, issueCoupons } from '../../../api/coupons';
import { getAccounts } from '../../../api/accounts';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { useApiMutation } from '../../../hooks/useApiMutation';
import type { CouponTemplate, Account, IssuedCouponDetail } from '../../../types';

function getDiscountLabel(detail: IssuedCouponDetail): string {
  if (detail.Discount_Type === 'Fixed_Amount') return `减 ¥${detail.Discount_Value}`;
  return `${Math.round((1 - detail.Discount_Value) * 100)}折`;
}

export const CouponIssuePage: React.FC = () => {
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [issueResult, setIssueResult] = useState<{
    Issued_Count: number; Skipped_Count: number; Issued_Details: IssuedCouponDetail[];
  } | null>(null);

  // ====== Load templates ======
  const { data: templates = [] } = useDataFetch<CouponTemplate[]>({
    fetcher: (_signal: AbortSignal) => getTemplates(),
  });

  // Fetch player accounts
  const { data: playersData = [] } = useDataFetch<Account[]>({
    fetcher: (_signal: AbortSignal) => getAccounts({ role: 1 }),
  });
  const players = playersData || [];
  const activeTemplates = (templates || []).filter(t => t.Is_Active);

  // ====== Issue mutation ======
  const { execute: doIssue, loading: issuing } = useApiMutation({
    apiFn: (data: { Template_ID: number; User_IDs: number[] }) => issueCoupons(data),
    successMessage: '优惠券发放成功',
  });

  const toggleUser = (uid: number) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const selectAll = () => {
    if (selectedUsers.length === players.length) setSelectedUsers([]);
    else setSelectedUsers(players.map(p => p.User_ID));
  };

  const handleIssue = async () => {
    if (!templateId) { showToast('请选择优惠券模板', 'error'); return; }
    if (selectedUsers.length === 0) { showToast('请选择发放用户', 'error'); return; }
    const result = await doIssue({ Template_ID: templateId, User_IDs: selectedUsers });
    if (result) {
      setSelectedUsers([]);
      setIssueResult({
        Issued_Count: result.Issued_Count,
        Skipped_Count: result.Skipped_Count,
        Issued_Details: result.Issued_Details || [],
      });
    }
  };

  const copyAllCodes = () => {
    if (!issueResult) return;
    const text = issueResult.Issued_Details
      .map(d => `${d.Account_Name}: ${d.Verification_Code}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('已复制全部核销码'));
  };

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">发放优惠券</h2>

      {/* 选择模板 */}
      <div className="card">
        <h3 className="font-medium text-sm text-gray-700 mb-2">选择优惠券模板</h3>
        <div className="space-y-2">
          {activeTemplates.map(t => (
            <div key={t.Template_ID}
              onClick={() => setTemplateId(t.Template_ID)}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                templateId === t.Template_ID ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
              }`}>
              <div className="font-medium text-sm">{t.Coupon_Name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {t.Discount_Type === 'Fixed_Amount' ? `减 ¥${t.Discount_Value}` : `${((1 - t.Discount_Value) * 100).toFixed(0)}折`}
                {t.Min_Order_Amount > 0 && ` · 满 ¥${t.Min_Order_Amount}`}
                {t.Script_Title && ` · 仅限《${t.Script_Title}》`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 选择用户 */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm text-gray-700">选择发放用户</h3>
          <button onClick={selectAll} className="text-xs text-purple-600">
            {selectedUsers.length === players.length ? '取消全选' : '全选玩家'}
          </button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {players.map(p => (
            <label key={p.User_ID} className="flex items-center gap-2 py-1.5 cursor-pointer">
              <input type="checkbox" checked={selectedUsers.includes(p.User_ID)}
                onChange={() => toggleUser(p.User_ID)}
                className="rounded border-gray-300 text-purple-600" />
              <span className="text-sm text-gray-700">{p.Account_Name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 发放按钮 */}
      <button onClick={handleIssue} disabled={issuing}
        className="btn-primary w-full py-3 text-base disabled:opacity-50">
        {issuing ? '发放中...' : `确认发放至 ${selectedUsers.length} 位用户`}
      </button>

      {/* ====== 发放结果预览 ====== */}
      {issueResult && (
        <div className="card border-2 border-green-200 bg-green-50/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-green-800">
              ✅ 发放完成 — 成功 {issueResult.Issued_Count} 张
              {issueResult.Skipped_Count > 0 && (
                <span className="text-amber-600 ml-2 text-sm font-normal">（跳过 {issueResult.Skipped_Count} 张）</span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={copyAllCodes}
                className="text-xs px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                📋 复制全部核销码
              </button>
              <button
                onClick={() => setIssueResult(null)}
                className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                ✕ 关闭
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="text-left py-2 px-2 text-green-700 font-medium text-xs">核销码</th>
                  <th className="text-left py-2 px-2 text-green-700 font-medium text-xs">用户</th>
                  <th className="text-left py-2 px-2 text-green-700 font-medium text-xs">优惠券</th>
                  <th className="text-center py-2 px-2 text-green-700 font-medium text-xs">优惠</th>
                  <th className="text-right py-2 px-2 text-green-700 font-medium text-xs">有效期至</th>
                </tr>
              </thead>
              <tbody>
                {issueResult.Issued_Details.map((d, idx) => (
                  <tr key={idx} className="border-b border-green-100 hover:bg-green-50/50">
                    <td className="py-2 px-2">
                      <span className="inline-block font-mono font-bold text-base bg-white text-purple-700 px-2 py-0.5 rounded border border-purple-200 tracking-wider select-all">
                        {d.Verification_Code}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-800">{d.Account_Name}</td>
                    <td className="py-2 px-2 text-gray-600">{d.Coupon_Name}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-accent-pink font-medium">{getDiscountLabel(d)}</span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400 text-xs">
                      {new Date(d.Expires_At).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            💡 玩家出示以上 <strong>4位核销码</strong> 给DM，DM在带场页面输入验证码即可核销。也可在「优惠券实例查询」页面按验证码查找。
          </p>
        </div>
      )}
    </div>
  );
};
