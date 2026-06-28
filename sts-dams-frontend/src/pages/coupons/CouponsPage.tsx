import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../store/auth';
import { getWallet, redeemCoupon } from '../../api/coupons';
import { CouponCard } from '../../components/common/CouponCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import type { CouponInstance } from '../../types';

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'Unused', label: '可使用' },
  { key: 'Used', label: '已使用' },
  { key: 'Expired', label: '已过期' },
];

export const CouponsPage: React.FC = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [selectedCoupon, setSelectedCoupon] = useState<CouponInstance | null>(null);

  // ===== 数据加载 =====
  const { data: coupons, loading } = useDataFetch({
    fetcher: (_signal) => getWallet(),
  });

  // ===== 核销 Mutation =====
  const { execute: doRedeem, loading: redeeming } = useApiMutation({
    apiFn: (data: { Coupon_ID: number }) =>
      redeemCoupon({ Coupon_ID: data.Coupon_ID, Transaction_ID: 0, Order_Amount: 0 }),
    successMessage: '优惠券已核销',
  });

  const couponsList = coupons || [];
  const filtered = filter === 'all' ? couponsList : couponsList.filter(c => c.Coupon_Status === filter);

  // 查找适用场次
  const getApplicableSessions = (_coupon: CouponInstance) => {
    // Session data comes from the API; return empty until real session matching is implemented
    return [];
  };

  const handleUseCoupon = async (coupon: CouponInstance) => {
    const sessions = getApplicableSessions(coupon);
    if (sessions.length === 0) {
      setSelectedCoupon(coupon); // 展示优惠券详情，无适用场次
      return;
    }
    // 先核销优惠券，再跳转到拼车大厅
    await doRedeem({ Coupon_ID: coupon.Coupon_ID });
    navigate('/lobby');
  };

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">我的优惠券</h2>
        <span className="text-xs text-gray-400">{couponsList.filter(c => c.Coupon_Status === 'Unused').length} 张可用</span>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 优惠券列表 */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">加载中...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🎫" title="暂无优惠券" description="优惠券会通过活动发放给你" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(coupon => {
            const applicableSessions = coupon.Coupon_Status === 'Unused' ? getApplicableSessions(coupon) : [];
            return (
              <div key={coupon.Coupon_ID} className="relative">
                <CouponCard
                  coupon={coupon}
                  onRedeem={coupon.Coupon_Status === 'Unused' && !redeeming ? () => handleUseCoupon(coupon) : undefined}
                />
                {coupon.Coupon_Status === 'Unused' && (
                  <div className="mt-1 text-xs text-gray-400 px-1">
                    {applicableSessions.length > 0
                      ? `${applicableSessions.length} 个场次可用`
                      : coupon.Applicable_Script_ID
                        ? '暂无可用的指定剧本场次'
                        : '可用于拼车大厅中的场次'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 优惠券使用说明 */}
      {selectedCoupon && (
        <>
          <div className="fixed inset-0 z-[9980] bg-black/40" onClick={() => setSelectedCoupon(null)} />
          <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[9981] bg-white rounded-2xl p-5 max-w-sm mx-auto sm:mx-0 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{selectedCoupon.Coupon_Name}</h3>
              <button onClick={() => setSelectedCoupon(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              {selectedCoupon.Min_Order_Amount && selectedCoupon.Min_Order_Amount > 0 && (
                <p>· 满 ¥{selectedCoupon.Min_Order_Amount} 可用</p>
              )}
              {selectedCoupon.Applicable_Script_ID && (
                <p>· 仅限《{selectedCoupon.Script_Title}》剧本</p>
              )}
              <p>· 到期时间：{new Date(selectedCoupon.Expires_At).toLocaleDateString('zh-CN')}</p>
              <p className="text-gray-400 mt-2">
                {selectedCoupon.Applicable_Script_ID
                  ? '此优惠券仅限指定剧本使用，暂无可用的对应场次。请关注拼车大厅中该剧本的场次。'
                  : '此优惠券可在 DM 结账时使用，请将优惠券出示给带场 DM 进行核销。'}
              </p>
            </div>
            <button
              onClick={() => { setSelectedCoupon(null); navigate('/lobby'); }}
              className="btn-primary w-full mt-4 text-sm"
            >
              去拼车大厅看看
            </button>
          </div>
        </>
      )}
    </div>
  );
};
