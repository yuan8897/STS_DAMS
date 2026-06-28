import React from 'react';
import type { CouponInstance } from '../../types';
import { COUPON_STATUS_LABEL, COUPON_STATUS_COLOR } from '../../constants/maps';

interface Props {
  coupon: CouponInstance;
  onRedeem?: () => void;
  selected?: boolean;
}

function getExpiryText(expiresAt: string): { text: string; urgent: boolean } {
  const now = new Date();
  const exp = new Date(expiresAt);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: '已过期', urgent: false };
  if (days === 0) return { text: '今日到期', urgent: true };
  if (days <= 3) return { text: `剩余 ${days} 天`, urgent: true };
  return { text: `剩余 ${days} 天`, urgent: false };
}

function getDiscountText(coupon: CouponInstance): string {
  if (coupon.Discount_Type === 'Fixed_Amount') {
    return `¥${coupon.Discount_Value}`;
  }
  return `${Math.round((1 - (coupon.Discount_Value || 0)) * 100)}折`;
}

export const CouponCard: React.FC<Props> = ({ coupon, onRedeem, selected = false }) => {
  const expiry = getExpiryText(coupon.Expires_At);
  const isUsable = coupon.Coupon_Status === 'Unused';
  const statusColor = COUPON_STATUS_COLOR[coupon.Coupon_Status] || COUPON_STATUS_COLOR.Unused;
  const statusLabel = COUPON_STATUS_LABEL[coupon.Coupon_Status] || COUPON_STATUS_LABEL.Unused;

  return (
    <button
      type="button"
      disabled={!isUsable}
      onClick={() => isUsable && onRedeem?.()}
      aria-label={`${coupon.Coupon_Name} - ${statusLabel}`}
      className={`relative rounded-lg border-2 p-4 w-full text-left transition-all ${
        selected ? 'ring-2 ring-purple-500' : ''
      } ${isUsable ? 'cursor-pointer hover:shadow-md' : 'opacity-60 cursor-default'}`}
      style={{
        appearance: 'none',
        fontFamily: 'inherit',
        backgroundColor: `${statusColor}18`,
        borderColor: `${statusColor}44`,
      }}
    >
      {/* 状态标签 */}
      <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${
        isUsable ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'
      }`}>
        {statusLabel}
      </span>

      {/* 折扣金额 */}
      <div className="mb-2">
        <span className="text-3xl font-bold text-purple-700">{getDiscountText(coupon)}</span>
        {coupon.Discount_Type === 'Fixed_Amount' && <span className="text-sm text-gray-500 ml-1">元</span>}
      </div>

      {/* 券名称 */}
      <div className="font-medium text-gray-800 mb-1">{coupon.Coupon_Name}</div>

      {/* 4位验证码 — 玩家可出示给DM核销 */}
      {isUsable && coupon.Verification_Code && (
        <div className="flex items-center gap-1.5 mt-1 mb-1">
          <span className="text-[12px] text-gray-400">核销码</span>
          <span className="text-sm font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded tracking-wider select-all">
            {coupon.Verification_Code}
          </span>
        </div>
      )}

      {/* 使用门槛 */}
      {coupon.Min_Order_Amount && coupon.Min_Order_Amount > 0 && (
        <div className="text-xs text-gray-500 mb-1">
          满 ¥{coupon.Min_Order_Amount} 可用
        </div>
      )}

      {/* 适用范围 */}
      {coupon.Script_Title && (
        <div className="text-xs text-gray-400 mb-1">仅限《{coupon.Script_Title}》</div>
      )}

      {/* 有效期 */}
      <div className={`text-xs mt-2 ${expiry.urgent ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {expiry.text}
      </div>

      {/* 操作按钮 */}
      {isUsable && onRedeem && (
        <span
          role="button"
          tabIndex={0}
          className="mt-2 w-full btn-primary text-sm py-1 block text-center"
          onClick={(e) => { e.stopPropagation(); onRedeem(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRedeem(); } }}
        >
          立即使用
        </span>
      )}
    </button>
  );
};
