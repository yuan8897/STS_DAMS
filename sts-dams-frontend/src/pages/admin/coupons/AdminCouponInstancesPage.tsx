import React, { useState } from 'react';
import { getInstances, getTemplates, verifyCouponByCode } from '../../../api/coupons';
import { EmptyState } from '../../../components/common/EmptyState';
import { showToast } from '../../../components/common/Toast';
import { useDataFetch } from '../../../hooks/useDataFetch';
import { COUPON_STATUS_LABEL, COUPON_STATUS_COLOR } from '../../../constants/maps';
import type { CouponInstance, CouponTemplate } from '../../../types';

function getDiscountLabel(c: CouponInstance): string {
  if (c.Discount_Type === 'Fixed_Amount') return `减 ¥${c.Discount_Value}`;
  if (c.Discount_Value != null) return `${Math.round((1 - c.Discount_Value) * 100)}折`;
  return '-';
}

export const AdminCouponInstancesPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [searchCode, setSearchCode] = useState('');
  const [lookupCode, setLookupCode] = useState(''); // 实际查询用的验证码

  // ====== Load instances ======
  const params: Record<string, string | number> = {};
  if (filterStatus !== 'all') params.status = filterStatus;
  if (filterTemplate !== 'all') params.template_id = Number(filterTemplate);
  if (lookupCode) params.verification_code = lookupCode;

  const { data: instancesData, refresh } = useDataFetch<CouponInstance[]>({
    fetcher: (_signal: AbortSignal) => getInstances(
      Object.keys(params).length > 0 ? params as Parameters<typeof getInstances>[0] : undefined
    ),
    deps: [filterStatus, filterTemplate, lookupCode],
  });
  const instances = instancesData ?? [];

  // ====== Load templates for filter ======
  const { data: templatesData } = useDataFetch<CouponTemplate[]>({
    fetcher: (_signal: AbortSignal) => getTemplates(),
  });
  const templates = templatesData ?? [];

  // ====== DM 预览态（模拟DM输入验证码看到的结果） ======
  const [previewResult, setPreviewResult] = useState<{
    Coupon_Name: string; User_Name: string; Discount_Amount: number;
    Discount_Type: string; Discount_Value: number; Coupon_ID: number;
    Applicable_Script_ID?: number; Script_Title?: string; Is_Redeemed: boolean;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const handleCodeLookup = async () => {
    const code = searchCode.trim();
    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
      showToast('请输入4位数字验证码', 'error');
      return;
    }
    setPreviewing(true);
    setPreviewResult(null);
    try {
      // 调用 verify-by-code 预览（preview=true 仅查询，不标记为已使用）
      const res = await verifyCouponByCode({ Verification_Code: code, preview: true });
      setPreviewResult({
        Coupon_Name: res.Coupon_Name,
        User_Name: res.User_Name,
        Discount_Amount: res.Discount_Amount,
        Discount_Type: res.Discount_Type,
        Discount_Value: res.Discount_Value,
        Coupon_ID: res.Coupon_ID,
        Applicable_Script_ID: res.Applicable_Script_ID,
        Script_Title: res.Script_Title,
        Is_Redeemed: res.Is_Redeemed,
      });
      // 同时刷新列表以显示该验证码对应的实例
      setLookupCode(code);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '查找失败';
      showToast(msg, 'error');
      setLookupCode('');
    } finally {
      setPreviewing(false);
    }
  };

  const clearLookup = () => {
    setSearchCode('');
    setLookupCode('');
    setPreviewResult(null);
  };

  const statusTabs = [
    { key: 'all', label: '全部' },
    { key: 'Unused', label: '未使用' },
    { key: 'Used', label: '已使用' },
    { key: 'Expired', label: '已过期' },
  ];

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">优惠券实例查询</h2>
        {lookupCode && (
          <button onClick={clearLookup} className="text-xs text-purple-600 hover:underline">
            清除验证码筛选
          </button>
        )}
      </div>

      {/* ====== 验证码查找（模拟DM输入） ====== */}
      <div className="card border-purple-200 bg-purple-50/30">
        <h3 className="font-medium text-sm text-purple-800 mb-2">🔍 按验证码查找（预览DM核销界面）</h3>
        <p className="text-xs text-gray-400 mb-3">
          输入4位验证码，预览DM在核销页面输入该码后会看到的信息
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="输入4位验证码"
            value={searchCode}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setSearchCode(v);
              if (v.length === 0) {
                setLookupCode('');
                setPreviewResult(null);
              }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCodeLookup(); }}
            className="w-40 px-3 py-2 border border-purple-300 rounded-lg text-center font-mono text-lg tracking-widest
                       focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-gray-300"
          />
          <button
            onClick={handleCodeLookup}
            disabled={previewing || searchCode.length !== 4}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {previewing ? '查找中...' : '查找'}
          </button>
        </div>

        {/* DM 预览结果卡片 */}
        {previewResult && (
          <div className="mt-3 p-4 bg-white rounded-lg border-2 border-purple-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">DM 预览</span>
              <span className="text-xs text-gray-400">以下为DM输入验证码后会看到的信息</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-400 text-xs">优惠券名称</span>
                <div className="font-medium text-gray-900">{previewResult.Coupon_Name}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs">持券用户</span>
                <div className="font-medium text-gray-900">{previewResult.User_Name}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs">抵扣金额</span>
                <div className="font-bold text-accent-pink">¥{previewResult.Discount_Amount}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs">优惠类型</span>
                <div className="font-medium text-gray-900">
                  {previewResult.Discount_Type === 'Fixed_Amount'
                    ? `固定减 ¥${previewResult.Discount_Value}`
                    : `${Math.round((1 - previewResult.Discount_Value) * 100)}折`}
                </div>
              </div>
              {previewResult.Script_Title && (
                <div className="col-span-2">
                  <span className="text-gray-400 text-xs">适用剧本</span>
                  <div className="font-medium text-gray-900">仅限《{previewResult.Script_Title}》</div>
                </div>
              )}
              <div>
                <span className="text-gray-400 text-xs">核销状态</span>
                <div className="font-medium text-blue-600">
                  🔍 仅预览（未实际核销）
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              💡 此预览调用 verify-by-code 接口（preview=true），仅查询不核销，不会标记优惠券为已使用。
            </p>
          </div>
        )}
      </div>

      {/* ====== 筛选栏 ====== */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* 状态筛选 */}
        {statusTabs.map(s => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
              filterStatus === s.key ? 'bg-purple-100 text-purple-600 font-medium' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}

        <span className="text-gray-300 mx-1">|</span>

        {/* 模板筛选 */}
        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 border-0 cursor-pointer"
        >
          <option value="all">全部模板</option>
          {templates.map(t => (
            <option key={t.Template_ID} value={t.Template_ID}>{t.Coupon_Name}</option>
          ))}
        </select>

        {lookupCode && (
          <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-600 font-mono">
            验证码: {lookupCode}
          </span>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          共 {instances.length} 张
        </span>
      </div>

      {/* ====== 实例列表 ====== */}
      {instances.length === 0 ? (
        <EmptyState icon="🎫" title={lookupCode ? '未找到匹配的验证码' : '暂无优惠券实例'} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">验证码</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">用户</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">优惠券</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium text-xs">优惠</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium text-xs">状态</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs">有效期至</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((c) => (
                <tr key={c.Coupon_ID} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-3">
                    <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded tracking-wider select-all ${
                      c.Verification_Code === lookupCode
                        ? 'bg-purple-100 text-purple-700 border border-purple-300 text-base'
                        : 'text-sm bg-gray-100 text-gray-700'
                    }`}>
                      {c.Verification_Code || '-'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-800">{c.Account_Name || `User#${c.User_ID}`}</td>
                  <td className="py-2 px-3 text-gray-600">{c.Coupon_Name || `模板#${c.Template_ID}`}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-accent-pink font-medium text-xs">{getDiscountLabel(c)}</span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        color: COUPON_STATUS_COLOR[c.Coupon_Status] || '#888',
                        backgroundColor: `${COUPON_STATUS_COLOR[c.Coupon_Status] || '#888'}18`,
                      }}
                    >
                      {COUPON_STATUS_LABEL[c.Coupon_Status] || c.Coupon_Status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400 text-xs">
                    {new Date(c.Expires_At).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        💡 此页面展示所有已发放的优惠券实例。输入4位验证码可预览DM核销界面将看到的信息（与DM输入码相匹配）。
      </p>
    </div>
  );
};
