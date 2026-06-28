import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../store/auth';
import { formatTime, formatDateTime } from '../../utils/format';
import { getSessionDetail, updateSessionStatus } from '../../api/sessions';
import { getPlayerCoupons, verifyCouponByCode } from '../../api/coupons';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { SESSION_STATUS_LABEL, SESSION_STATUS_BADGE } from '../../constants/maps';
import { showToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Loading } from '../../components/common/Loading';
import { ErrorState } from '../../components/common/ErrorState';
import { CouponCard } from '../../components/common/CouponCard';
import { ConsumptionCart } from './ConsumptionCart';
import type { SessionStatus, CouponInstance, CouponVerifyResult, SessionPlayer } from '../../types';

export const DmSessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const { data: session, loading, error, refresh } = useDataFetch({
    fetcher: (_signal) => getSessionDetail(Number(sessionId)),
  });

  const { execute: doStatusChange } = useApiMutation({
    apiFn: (params: { sessionId: number; newStatus: SessionStatus }) =>
      updateSessionStatus(params.sessionId, params.newStatus),
    successMessage: '场次状态已更新',
  });

  const regs: SessionPlayer[] = session?.Players || [];
  const currentStatus = session?.Session_Status as SessionStatus | undefined;

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; newStatus: SessionStatus | null; danger: boolean;
  }>({ open: false, title: '', message: '', newStatus: null, danger: false });

  // 优惠券相关
  const [playerCoupons, setPlayerCoupons] = useState<Record<number, CouponInstance[]>>({});
  const [showCouponSelector, setShowCouponSelector] = useState<number | null>(null); // player userId
  const [appliedCoupons, setAppliedCoupons] = useState<Record<number, { coupon: CouponInstance; discount: number }>>({});
  const [couponsLoading, setCouponsLoading] = useState<Record<number, boolean>>({});

  // 验证码核销
  const [showVerifyCode, setShowVerifyCode] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<CouponVerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const loadPlayerCoupons = async (playerUserId: number) => {
    setCouponsLoading(prev => ({ ...prev, [playerUserId]: true }));
    try {
      const coupons = await getPlayerCoupons(playerUserId);
      setPlayerCoupons(prev => ({
        ...prev,
        [playerUserId]: coupons || [],
      }));
    } catch {
      setPlayerCoupons(prev => ({
        ...prev,
        [playerUserId]: [],
      }));
    } finally {
      setCouponsLoading(prev => ({ ...prev, [playerUserId]: false }));
    }
  };

  const handleVerifyCode = async () => {
    if (!verifyCode || verifyCode.length !== 4) {
      setVerifyError('请输入4位验证码');
      return;
    }
    setVerifyLoading(true);
    setVerifyError('');
    setVerifyResult(null);
    try {
      const result = await verifyCouponByCode({
        Verification_Code: verifyCode,
        Order_Amount: session?.Frozen_Per_Head_Price || 0,
      });
      setVerifyResult(result);
      if (result.User_ID && result.Coupon_ID) {
        // 检查该玩家是否已参团
        const isPlayerInSession = regs.some(r => r.Player_User_ID === result.User_ID);
        if (!isPlayerInSession) {
          showToast(`验证成功！优惠券属于「${result.User_Name}」，但该玩家未在本场次参团`, 'warning');
          return;
        }
        // 自动应用优惠券
        applyCoupon(result.User_ID, {
          Coupon_ID: result.Coupon_ID,
          Coupon_Name: result.Coupon_Name,
          Discount_Type: result.Discount_Type as CouponInstance['Discount_Type'],
          Discount_Value: result.Discount_Value,
          Min_Order_Amount: 0,
          Applicable_Script_ID: result.Applicable_Script_ID,
          Script_Title: result.Script_Title,
        } as CouponInstance);
      }
    } catch (err: any) {
      setVerifyError(err?.message || '验证失败，请检查验证码');
    } finally {
      setVerifyLoading(false);
    }
  };

  const applyCoupon = (playerUserId: number, coupon: CouponInstance) => {
    const perHeadPrice = session?.Frozen_Per_Head_Price || 0;
    let discount = 0;
    if (coupon.Discount_Type === 'Fixed_Amount') {
      discount = Math.min(coupon.Discount_Value || 0, perHeadPrice);
    } else if (coupon.Discount_Type === 'Percent_Off') {
      discount = Math.min(perHeadPrice * (coupon.Discount_Value || 0), coupon.Max_Discount_Cap || Infinity, perHeadPrice);
    }
    // 检查最低消费门槛
    if ((coupon.Min_Order_Amount || 0) > 0 && perHeadPrice < (coupon.Min_Order_Amount || 0)) {
      showToast(`人均¥${perHeadPrice}未达到优惠券最低消费¥${coupon.Min_Order_Amount}`, 'warning');
      return;
    }
    // 检查剧本限制
    if (coupon.Applicable_Script_ID && coupon.Applicable_Script_ID !== session?.Script_ID) {
      showToast(`此券仅限《${coupon.Script_Title}》使用`, 'warning');
      return;
    }
    setAppliedCoupons(prev => ({
      ...prev,
      [playerUserId]: { coupon, discount: Math.round(discount * 100) / 100 },
    }));
    setShowCouponSelector(null);
    showToast(`已为玩家应用优惠：-¥${discount.toFixed(2)}`);
  };

  const removeAppliedCoupon = (playerUserId: number) => {
    setAppliedCoupons(prev => {
      const next = { ...prev };
      delete next[playerUserId];
      return next;
    });
  };

  const executeStatusChange = async (newStatus: SessionStatus) => {
    await doStatusChange({ sessionId: session!.Session_ID, newStatus });
    refresh();
    setConfirmDialog({ open: false, title: '', message: '', newStatus: null, danger: false });
  };

  const requestStatusChange = (newStatus: SessionStatus) => {
    if (newStatus === 'Aborted') {
      setConfirmDialog({
        open: true, danger: true,
        title: '确认取消场次',
        message: `确定取消《${session?.Script_Title}》吗？已参团玩家将被通知。此操作不可撤销。`,
        newStatus,
      });
    } else if (newStatus === 'Completed') {
      const totalBeforeDiscount = regs.length * (session?.Frozen_Per_Head_Price || 0);
      const totalDiscount = Object.values(appliedCoupons).reduce((sum, ac) => sum + ac.discount, 0);
      setConfirmDialog({
        open: true, danger: false,
        title: '确认结账完成',
        message: `场次总收入：¥${totalBeforeDiscount.toFixed(2)}${totalDiscount > 0 ? `\n优惠券抵扣：-¥${totalDiscount.toFixed(2)}\n实收：¥${(totalBeforeDiscount - totalDiscount).toFixed(2)}` : ''}\n\n确认后将无法继续记账。`,
        newStatus,
      });
    } else {
      executeStatusChange(newStatus);
    }
  };

  if (loading) return <Loading text="加载场次详情..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!session || !user) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p>场次不存在</p>
        <button onClick={() => navigate('/dm/sessions')} className="btn-primary mt-4 text-sm">返回我的带场</button>
      </div>
    );
  }

  const statusActions: { status: SessionStatus; label: string; color: string; condition: boolean }[] = [
    { status: 'Locked_Ready', label: '🔒 锁车', color: 'bg-orange-500 hover:bg-orange-600', condition: currentStatus === 'Matching' },
    { status: 'In_Progress', label: '▶ 开场', color: 'bg-green-500 hover:bg-green-600', condition: currentStatus === 'Locked_Ready' },
    { status: 'Completed', label: '✅ 结账完成', color: 'bg-gray-600 hover:bg-gray-700', condition: currentStatus === 'In_Progress' },
    { status: 'Aborted', label: '✕ 取消场次', color: 'bg-red-500 hover:bg-red-600', condition: currentStatus !== 'Completed' && currentStatus !== 'Aborted' },
  ];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/dm/sessions')} className="text-gray-400 text-sm flex items-center gap-1 hover:text-gray-600">
        ← 返回我的带场
      </button>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{session.Script_Title}</h2>
              <span className={`badge text-sm ${SESSION_STATUS_BADGE[currentStatus || 'Matching']}`}>
                {SESSION_STATUS_LABEL[currentStatus || 'Matching']}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm text-gray-600">
              <div><span className="text-gray-400">时间</span> <span className="ml-2">{formatDateTime(session.Scheduled_Start_Time)} ~ {formatTime(session.Scheduled_End_Time)}</span></div>
              <div><span className="text-gray-400">房间</span> <span className="ml-2">{session.Room_Name}</span></div>
              <div><span className="text-gray-400">人数</span> <span className="ml-2">{regs.length}/{session.Max_Allowed_Players}（最少 {session.Min_Required_Players}）</span></div>
              <div><span className="text-gray-400">价格</span> <span className="ml-2 text-lg font-bold text-accent-pink">¥{session.Frozen_Per_Head_Price}/人</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:min-w-[130px]">
            {statusActions.filter(a => a.condition).map(action => (
              <button key={action.status} onClick={() => requestStatusChange(action.status)}
                className={`${action.color} text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors`}
              >{action.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 玩家列表 + 优惠券 */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">已参团玩家 ({regs.length}/{session.Max_Allowed_Players})</h3>
          {regs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无玩家参团</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {regs.map((reg: any) => {
                const applied = appliedCoupons[reg.Player_User_ID];
                return (
                <div key={reg.Registration_ID} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                      {(reg.Player_Name || reg.Account_Name || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900">{reg.Player_Name || reg.Account_Name || `U${reg.Player_User_ID}`}</span>
                      {reg.Role_Name ? <span className="text-xs text-gray-400 ml-1.5">饰 {reg.Role_Name}</span>
                        : <span className="text-xs text-orange-400 ml-1.5">未选角</span>}
                      {applied && (
                        <div className="text-xs text-green-500 mt-0.5">
                          🎫 {applied.coupon.Coupon_Name} -¥{applied.discount.toFixed(2)}
                          <button onClick={() => removeAppliedCoupon(reg.Player_User_ID)} className="ml-1 text-red-400 hover:text-red-600">✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge text-[12px] ${
                      reg.Cached_Payment_Status === 'Fully_Paid' ? 'bg-green-100 text-green-600' :
                      reg.Cached_Payment_Status === 'Deposit_Paid' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {reg.Cached_Payment_Status === 'Fully_Paid' ? '已付' : reg.Cached_Payment_Status === 'Deposit_Paid' ? '定金' : '未付'}
                    </span>
                    {currentStatus !== 'Completed' && currentStatus !== 'Aborted' && !applied && (
                      <button
                        onClick={() => {
                          setShowCouponSelector(reg.Player_User_ID);
                          loadPlayerCoupons(reg.Player_User_ID);
                        }}
                        className="text-xs text-purple-500 hover:text-purple-700 font-medium"
                        title="为该玩家使用优惠券"
                      >
                        🎫
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* 优惠汇总 */}
          {Object.keys(appliedCoupons).length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">优惠券总抵扣</span>
                <span className="font-semibold text-green-600">
                  -¥{Object.values(appliedCoupons).reduce((sum, ac) => sum + ac.discount, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* 验证码核销板块 */}
          {currentStatus !== 'Completed' && currentStatus !== 'Aborted' && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => { setShowVerifyCode(!showVerifyCode); setVerifyCode(''); setVerifyResult(null); setVerifyError(''); }}
                className="text-sm font-medium text-purple-500 hover:text-purple-700 flex items-center gap-1"
              >
                🔑 {showVerifyCode ? '收起核销' : '验证码核销'}
              </button>

              {showVerifyCode && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setVerifyError(''); setVerifyResult(null); }}
                      placeholder="输入4位验证码"
                      maxLength={4}
                      className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-purple-300"
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={verifyLoading || verifyCode.length !== 4}
                      className="btn-primary text-sm px-4 py-2.5 disabled:opacity-50 whitespace-nowrap"
                    >
                      {verifyLoading ? '验证中...' : '核销'}
                    </button>
                  </div>
                  {verifyError && (
                    <p className="text-xs text-red-500">{verifyError}</p>
                  )}
                  {verifyResult && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium">✅ 验证成功</span>
                        <span className="text-xs text-green-500">券主：{verifyResult.User_Name}</span>
                      </div>
                      <div className="text-green-700">
                        🎫 {verifyResult.Coupon_Name} · 抵扣 ¥{verifyResult.Discount_Amount.toFixed(2)}
                      </div>
                      {verifyResult.Script_Title && (
                        <div className="text-xs text-green-500">仅限《{verifyResult.Script_Title}》</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {currentStatus === 'In_Progress' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">追加消费记账</h3>
            <ConsumptionCart sessionId={session.Session_ID} dmUserId={user.User_ID} />
          </div>
        )}

        {currentStatus !== 'In_Progress' && (
          <div className="card flex items-center justify-center">
            <p className="text-sm text-gray-400 text-center py-8">
              {currentStatus === 'Matching' && '拼车完成后可开场，开场后可记账消费'}
              {currentStatus === 'Locked_Ready' && '开场后可进行消费记账'}
              {currentStatus === 'Completed' && '场次已结账完成'}
              {currentStatus === 'Aborted' && '场次已取消'}
            </p>
          </div>
        )}
      </div>

      {/* 优惠券选择弹窗 */}
      {showCouponSelector !== null && (
        <>
          <div className="fixed inset-0 z-[9980] bg-black/40" onClick={() => setShowCouponSelector(null)} />
          <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[9981] bg-white rounded-2xl p-5 max-w-sm mx-auto sm:mx-0 shadow-xl max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">为玩家选择优惠券</h3>
              <button onClick={() => setShowCouponSelector(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {(!playerCoupons[showCouponSelector] || playerCoupons[showCouponSelector].length === 0) ? (
              <p className="text-sm text-gray-400 text-center py-8">该玩家暂无可用优惠券</p>
            ) : (
              <div className="space-y-2">
                {(playerCoupons[showCouponSelector] || []).map(coupon => (
                  <CouponCard
                    key={coupon.Coupon_ID}
                    coupon={coupon}
                    onRedeem={() => applyCoupon(showCouponSelector, coupon)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        confirmText={confirmDialog.newStatus === 'Aborted' ? '确认取消' : '确认'}
        cancelText="返回"
        onConfirm={() => {
          if (confirmDialog.newStatus) executeStatusChange(confirmDialog.newStatus);
        }}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', newStatus: null, danger: false })}
      />
    </div>
  );
};
