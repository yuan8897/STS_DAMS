import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionDetail, assignRole } from '../../api/sessions';
import { getCurrentUser } from '../../store/auth';
import { showToast } from '../../components/common/Toast';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import type { ScriptRole, SessionPlayer } from '../../types';

export const PickRolePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  const { data: detail, loading: dataLoading } = useDataFetch({
    fetcher: (_signal) => getSessionDetail(Number(sessionId)),
  });

  const { execute: doAssignRole, loading: saving } = useApiMutation({
    apiFn: (data: { regId: number; roleId: number | null; roleName?: string }) =>
      assignRole(data.regId, data.roleId),
    successMessage: '角色选择成功！',
  });

  const session = detail;
  const allRoles: ScriptRole[] = detail?.Roles || [];
  const players: SessionPlayer[] = detail?.Players || [];
  const myReg = players.find(r => r.Player_User_ID === user?.User_ID);

  if (dataLoading) {
    return <div className="py-16 text-center text-gray-400">加载中...</div>;
  }

  if (!session || !myReg) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p>你尚未参团此场次</p>
        <button onClick={() => navigate('/lobby')} className="btn-primary mt-4 text-sm">返回大厅</button>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (selectedRoleId === null || selectedRoleId === undefined) {
      showToast('请先选择一个角色（或选择"暂不选角"）', 'warning');
      return;
    }
    const roleId = selectedRoleId === -1 ? null : selectedRoleId;
    const roleName = selectedRoleId === -1
      ? undefined
      : allRoles.find(r => r.Role_ID === selectedRoleId)?.Role_Name;

    await doAssignRole({ regId: myReg.Registration_ID, roleId, roleName });
    navigate(`/lobby/session/${sessionId}`, { replace: true });
  };

  const occupiedByOthers = (roleId: number) => {
    const reg = players.find((r: any) => r.Role_ID === roleId);
    return reg && reg.Player_User_ID !== user?.User_ID ? reg : null;
  };

  const gIcon = (g: string) => g === 'Male' ? '♂️' : g === 'Female' ? '♀️' : '🔄';
  const isSkipSelected = selectedRoleId === -1;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate(`/lobby/session/${sessionId}`)} className="text-gray-400 text-sm flex items-center gap-1 hover:text-gray-600">
        ← 返回场次详情
      </button>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900">{session.Script_Title}</h2>
        <p className="text-sm text-gray-400 mt-1">选择你的角色 · 共 {allRoles.length} 个角色</p>
      </div>

      <button
        onClick={() => setSelectedRoleId(-1)}
        className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
          isSkipSelected ? 'border-accent-purple bg-purple-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl">🤔</span>
          <div>
            <span className="font-medium text-base text-gray-900">暂不选角</span>
            <p className="text-sm text-gray-400 mt-0.5">先参团占位，锁车前再确定角色</p>
          </div>
          {isSkipSelected && <span className="ml-auto text-accent-purple font-medium text-sm">已选中 ✓</span>}
        </div>
      </button>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">可选角色</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allRoles.map((role: ScriptRole) => {
            const occupied = occupiedByOthers(role.Role_ID);
            const isMySelection = selectedRoleId === role.Role_ID;

            return (
              <button
                key={role.Role_ID}
                disabled={!!occupied}
                onClick={() => setSelectedRoleId(role.Role_ID)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  occupied
                    ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                    : isMySelection
                    ? 'border-accent-purple bg-purple-50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{gIcon(role.Gender_Restriction)}</span>
                  {occupied ? (
                    <span className="text-xs text-gray-400">{occupied.Player_Name || occupied.Account_Name} 已选</span>
                  ) : isMySelection ? (
                    <span className="text-xs font-medium text-accent-purple">已选中 ✓</span>
                  ) : (
                    <span className="badge bg-green-100 text-green-600 text-[12px]">可选</span>
                  )}
                </div>
                <span className={`font-medium text-sm block ${occupied ? 'text-gray-400' : 'text-gray-900'}`}>
                  {role.Role_Name}
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  {role.Gender_Restriction === 'Male' ? '仅男性' : role.Gender_Restriction === 'Female' ? '仅女性' : '不限性别'}
                </span>
                {role.Role_Description && (
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{role.Role_Description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={() => navigate(`/lobby/session/${sessionId}`)} className="btn-secondary text-sm mr-3">
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving || (selectedRoleId === myReg?.Role_ID) || (selectedRoleId === -1 && myReg?.Role_ID === null)}
          className="btn-primary text-sm px-8"
        >
          {saving ? '保存中...' : '确认选角'}
        </button>
      </div>
    </div>
  );
};
