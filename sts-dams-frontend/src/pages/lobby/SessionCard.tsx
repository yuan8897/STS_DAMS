import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '../../types';
import { formatTime } from '../../utils/format';
import { SESSION_STATUS_LABEL, SESSION_STATUS_BADGE } from '../../constants/maps';
import type { SessionStatus } from '../../types';

interface SessionCardProps {
  session: Session;
  /** 当前用户的角色类型，DM/Admin 不显示参团按钮 */
  userRole?: number;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session, userRole }) => {
  const navigate = useNavigate();
  const playerCount = session.Registered_Count || 0;
  const maxPlayers = session.Max_Allowed_Players || 7;
  const progressPct = Math.min((playerCount / maxPlayers) * 100, 100);
  const isPlayer = userRole === 1;
  const isDM = userRole === 2;

  const statusBadge = SESSION_STATUS_BADGE[session.Session_Status as SessionStatus] || SESSION_STATUS_BADGE.Matching;
  const statusLabel = SESSION_STATUS_LABEL[session.Session_Status as SessionStatus] || '';

  const hasJoined = !!session.Current_User_Registration_ID;
  const canJoin = isPlayer && !hasJoined && session.Session_Status === 'Matching' && playerCount < maxPlayers;

  // 统一使用紧凑样式，所有角色一致
  const cardPad = 'p-3';
  const headMb = 'mb-2';
  const titleSize = 'text-sm';
  const metaSize = 'text-[11px]';
  const infoMb = 'mb-2';
  const footerMt = 'mt-2 pt-2';
  const priceSize = 'text-base';

  return (
    <button
      type="button"
      onClick={() => navigate(`/lobby/session/${session.Session_ID}`)}
      aria-label={`${session.Script_Title} - ${session.DM_Stage_Name || '未知DM'}`}
      className={`card active:scale-[0.98] transition-transform cursor-pointer hover:shadow-md w-full text-left bg-white border-0 ${cardPad}`}
      style={{ appearance: 'none', fontFamily: 'inherit' }}
    >
      {/* 头部 */}
      <div className={`flex items-start justify-between ${headMb}`}>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-gray-900 truncate ${titleSize}`}>
            {session.Script_Title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-400">{session.Genre_Name}</span>
            {session.DM_Stage_Name && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">DM {session.DM_Stage_Name}</span>
              </>
            )}
          </div>
        </div>
        <span className={`badge flex-shrink-0 ${statusBadge}`}>{statusLabel}</span>
      </div>

      {/* 时间 + 房间 */}
      <div className={`flex items-center gap-3 text-gray-500 ${metaSize} ${infoMb}`}>
        <span className="flex items-center gap-1">
          <span>🕐</span>
          {formatTime(session.Scheduled_Start_Time)} ~ {formatTime(session.Scheduled_End_Time)}
        </span>
        <span className="flex items-center gap-1">
          <span>📍</span>
          {session.Room_Name}
        </span>
      </div>

      {/* 参团进度条 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressPct >= 100 ? 'bg-red-400' : progressPct >= 70 ? 'bg-orange-400' : 'bg-accent-purple'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-500 flex-shrink-0">
          {playerCount}/{maxPlayers}人
        </span>
      </div>

      {/* 底部：价格 + 操作 */}
      <div className={`flex items-center justify-between ${footerMt} border-t border-gray-50`}>
        <span className={`font-bold text-accent-pink ${priceSize}`}>
          ¥{session.Frozen_Per_Head_Price}
          <span className="text-xs font-normal text-gray-400 ml-0.5">/人</span>
        </span>
        {canJoin ? (
          <span className="text-sm font-medium text-accent-purple">可参团 →</span>
        ) : hasJoined ? (
          session.Session_Status === 'Locked_Ready' ? (
            <span className="text-sm font-medium text-orange-500">可选角</span>
          ) : (
            <span className="text-sm font-medium text-green-600">已参团 ✓</span>
          )
        ) : isDM ? (
          <span className="text-xs font-medium text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">🎤 主持</span>
        ) : session.Session_Status === 'Matching' ? (
          <span className="text-sm text-gray-400">已满员</span>
        ) : null}
      </div>
    </button>
  );
};
