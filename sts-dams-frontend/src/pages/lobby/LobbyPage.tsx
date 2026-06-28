import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatchingSessions, createSession } from '../../api/sessions';
import { getCurrentUser } from '../../store/auth';
import { getScripts } from '../../api/scripts';
import { getRooms } from '../../api/rooms';
import { SessionCard } from './SessionCard';
import { showToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';
import { Loading } from '../../components/common/Loading';
import { ErrorState } from '../../components/common/ErrorState';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { GENRES } from '../../constants/maps';
import type { Session, Script, StoreRoom } from '../../types';

const REFRESH_INTERVAL = 20000;

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  // 仅 DM (Role_Type=2) 可快速创车；Admin (Role_Type=3) 通过店长端创车
  const isDM = user?.Role_Type === 2;
  const isDMOrAdmin = user?.Role_Type === 2 || user?.Role_Type === 3;

  const [filterGenre, setFilterGenre] = useState<number>(0);
  const [filterTime, setFilterTime] = useState<string>('all');
  const [filterAvailable, setFilterAvailable] = useState(false);

  // DM 快速创车
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createForm, setCreateForm] = useState({
    Script_ID: 0, Room_ID: 0, Scheduled_Start_Time: '', Scheduled_End_Time: '',
    Frozen_Per_Head_Price: 0,
  });

  // ===== 数据加载 =====
  const { data: sessions, loading, error, refresh } = useDataFetch({
    fetcher: (_signal) => getMatchingSessions().then(data => {
      data.sort((a, b) => {
        if (a.Session_Status === 'Matching' && b.Session_Status !== 'Matching') return -1;
        if (a.Session_Status !== 'Matching' && b.Session_Status === 'Matching') return 1;
        return new Date(a.Scheduled_Start_Time).getTime() - new Date(b.Scheduled_Start_Time).getTime();
      });
      return data;
    }),
    refreshInterval: REFRESH_INTERVAL,
  });

  // 加载剧本和房间（用于快速创车）
  const { data: scriptsData } = useDataFetch<Script[]>({
    fetcher: (_signal) => getScripts({ retired: '0' }),
    refreshInterval: 0,
  });
  const { data: roomsData } = useDataFetch<StoreRoom[]>({
    fetcher: (_signal) => getRooms(),
    refreshInterval: 0,
  });

  // ===== 创车 Mutation =====
  const { execute: doCreateSession, loading: creating } = useApiMutation({
    apiFn: (data: Parameters<typeof createSession>[0]) => createSession(data),
    successMessage: '场次创建成功',
  });

  const sessionsList = sessions || [];
  const scripts = scriptsData || [];
  const operationalRooms = (roomsData || []).filter(r => r.Room_Operating_Status === 'Operational');

  let filtered = sessionsList;
  if (filterGenre > 0) {
    filtered = filtered.filter(s => s.Primary_Genre === filterGenre);
  }
  if (filterTime === 'today') {
    const today = new Date().toDateString();
    filtered = filtered.filter(s => new Date(s.Scheduled_Start_Time).toDateString() === today);
  } else if (filterTime === 'evening') {
    filtered = filtered.filter(s => {
      const h = new Date(s.Scheduled_Start_Time).getHours();
      return h >= 18 || h < 6;
    });
  }
  if (filterAvailable) {
    filtered = filtered.filter(s => (s.Registered_Count || 0) < (s.Max_Allowed_Players || 7));
  }

  // DM 统计（Admin 也可查看）
  const dmSessions = isDMOrAdmin ? sessionsList.filter(s => s.DM_User_ID === user?.DM_User_ID) : [];
  const dmOwnInProgress = dmSessions.filter(s => s.Session_Status === 'In_Progress').length;
  const dmOwnMatching = dmSessions.filter(s => s.Session_Status === 'Matching').length;

  // 快速创车逻辑
  const selectedScript = scripts.find(s => s.Script_ID === createForm.Script_ID);

  const handleQuickCreate = async () => {
    if (!selectedScript || !createForm.Room_ID || !createForm.Scheduled_Start_Time) {
      showToast('请填写完整信息', 'warning');
      return;
    }
    const endTime = new Date(
      new Date(createForm.Scheduled_Start_Time).getTime() + (selectedScript.Estimated_Duration || 240) * 60000
    ).toISOString();
    const dmUser = user?.DM_User_ID || user?.User_ID || 0;

    await doCreateSession({
      Script_ID: selectedScript.Script_ID,   // 后端自动分配/创建 Copy_ID
      Room_ID: createForm.Room_ID,
      DM_User_ID: dmUser,
      Scheduled_Start_Time: createForm.Scheduled_Start_Time,
      Scheduled_End_Time: endTime,
      Frozen_Per_Head_Price: createForm.Frozen_Per_Head_Price || selectedScript.Base_Price || 0,
    });

    refresh();
    setShowQuickCreate(false);
    setCreateStep(0);
    setCreateForm({ Script_ID: 0, Room_ID: 0, Scheduled_Start_Time: '', Scheduled_End_Time: '', Frozen_Per_Head_Price: 0 });
  };

  if (loading) return <Loading text="加载拼车列表..." />;
  if (error && filtered.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">拼车大厅</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {isDMOrAdmin ? '管理你的场次，查看玩家拼车动态' : '浏览场次，加入拼车'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{filtered.length} 个场次</span>
          {isDM && (
            <button
              onClick={() => setShowQuickCreate(true)}
              disabled={creating}
              className="btn-primary text-sm flex items-center gap-1"
            >
              {creating ? '创建中...' : '🚗 快速创车'}
            </button>
          )}
        </div>
      </div>

      {/* DM/Admin：今日统计 + 我的排班概览 */}
      {isDMOrAdmin && dmSessions.length > 0 && (
        <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800 text-sm">我的拼车概览</h3>
            <button onClick={() => navigate('/dm/sessions')} className="text-xs text-accent-purple hover:underline">
              管理带场 →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700">{dmSessions.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">我的场次</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{dmOwnInProgress}</div>
              <div className="text-xs text-gray-500 mt-0.5">进行中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{dmOwnMatching}</div>
              <div className="text-xs text-gray-500 mt-0.5">拼车中</div>
            </div>
          </div>
          {/* 我的场次快速预览 */}
          <div className="mt-3 space-y-1.5">
            {dmSessions.slice(0, 3).map(s => (
              <div
                key={s.Session_ID}
                onClick={() => navigate(`/dm/sessions/${s.Session_ID}`)}
                className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 cursor-pointer hover:bg-white transition-colors text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    s.Session_Status === 'In_Progress' ? 'bg-green-500' :
                    s.Session_Status === 'Matching' ? 'bg-blue-500' :
                    s.Session_Status === 'Locked_Ready' ? 'bg-orange-500' : 'bg-gray-300'
                  }`} />
                  <span className="font-medium text-gray-800 truncate">{s.Script_Title}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {s.Registered_Count}/{s.Max_Allowed_Players}人
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => setFilterAvailable(!filterAvailable)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filterAvailable ? 'bg-accent-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          有空位
        </button>
        <select
          value={filterTime}
          onChange={e => setFilterTime(e.target.value)}
          className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
        >
          <option value="all">全部时间</option>
          <option value="today">今天</option>
          <option value="evening">晚间场 (18:00+)</option>
        </select>
        {Object.entries(GENRES).map(([id, name]) => (
          <button
            key={id}
            onClick={() => setFilterGenre(filterGenre === Number(id) ? 0 : Number(id))}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterGenre === Number(id) ? 'bg-accent-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 场次卡片 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🎭"
          title="暂无拼车场次"
          description={isDM ? '点击「快速创车」创建新场次' : isDMOrAdmin ? '前往店长端创建场次' : '稍后再来看看吧'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(session => {
            const isOwnSession = isDMOrAdmin && session.DM_User_ID === user?.DM_User_ID;
            return (
              <div key={session.Session_ID} className="relative">
                {isOwnSession && (
                  <div className="absolute -top-1 -right-1 z-10 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-[12px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-0.5">
                    🎤 主持
                  </div>
                )}
                <SessionCard session={session} userRole={user?.Role_Type} />
              </div>
            );
          })}
        </div>
      )}

      {/* 快速创车弹窗 */}
      {showQuickCreate && (
        <>
          <div className="fixed inset-0 z-[9980] bg-black/40" onClick={() => { setShowQuickCreate(false); setCreateStep(0); }} />
          <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[9981] bg-white rounded-2xl p-5 max-w-md mx-auto sm:mx-0 shadow-xl max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">
                {createStep === 0 ? '选择剧本' : createStep === 1 ? '选择房间和时间' : '确认创车'}
              </h3>
              <button onClick={() => { setShowQuickCreate(false); setCreateStep(0); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* 步骤指示器 */}
            <div className="flex items-center gap-1 mb-4 flex-shrink-0">
              {[0, 1, 2].map(i => (
                <div key={i} className={`flex-1 h-1 rounded-full ${i <= createStep ? 'bg-accent-purple' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {createStep === 0 && (
                <div className="space-y-2">
                  {scripts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">暂无可用的剧本</p>
                  ) : (
                    scripts.map(script => (
                      <button
                        key={script.Script_ID}
                        onClick={() => {
                          setCreateForm(prev => ({
                            ...prev,
                            Script_ID: script.Script_ID,
                            Frozen_Per_Head_Price: script.Base_Price,
                          }));
                          setCreateStep(1);
                        }}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          createForm.Script_ID === script.Script_ID
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-100 hover:border-purple-200 bg-white'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">{script.Script_Title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {GENRES[script.Primary_Genre] || script.Genre_Name} · {script.Min_Required_Players}-{script.Max_Allowed_Players}人 · {script.Estimated_Duration}分钟 · ¥{script.Base_Price}/人
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {createStep === 1 && (
                <div className="space-y-4">
                  {/* 剧本摘要（剧本副本由后端自动分配，无需DM操心） */}
                  {selectedScript && (
                    <div className="bg-purple-50 rounded-xl p-3 text-sm">
                      <span className="text-purple-700 font-medium">{selectedScript.Script_Title}</span>
                      <span className="text-gray-500 ml-2">
                        {selectedScript.Min_Required_Players}-{selectedScript.Max_Allowed_Players}人 · {selectedScript.Estimated_Duration}分钟
                      </span>
                    </div>
                  )}

                  {/* 房间选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">选择房间</label>
                    {operationalRooms.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">暂无可用房间</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {operationalRooms.map(room => (
                          <button
                            key={room.Room_ID}
                            onClick={() => setCreateForm(prev => ({ ...prev, Room_ID: room.Room_ID }))}
                            className={`p-3 rounded-xl border-2 text-sm text-left transition-all ${
                              createForm.Room_ID === room.Room_ID
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-100 hover:border-purple-200 bg-white'
                            }`}
                          >
                            <div className="font-medium text-gray-900">{room.Room_Name}</div>
                            <div className="text-xs text-gray-400">容纳 {room.Room_Max_Capacity} 人</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 时间选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">开始时间</label>
                    <input
                      type="datetime-local"
                      value={createForm.Scheduled_Start_Time}
                      onChange={e => setCreateForm(prev => ({ ...prev, Scheduled_Start_Time: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-300"
                    />
                  </div>

                  {/* 价格确认 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">人均价格</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">¥</span>
                      <input
                        type="number"
                        value={createForm.Frozen_Per_Head_Price || ''}
                        onChange={e => setCreateForm(prev => ({ ...prev, Frozen_Per_Head_Price: Number(e.target.value) }))}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-300"
                        placeholder={selectedScript ? String(selectedScript.Base_Price) : '0'}
                      />
                    </div>
                  </div>

                  <button onClick={() => setCreateStep(2)} disabled={!createForm.Room_ID || !createForm.Scheduled_Start_Time}
                    className="btn-primary w-full text-sm disabled:opacity-50">
                    下一步：确认创车
                  </button>
                </div>
              )}

              {createStep === 2 && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">剧本</span>
                      <span className="font-semibold text-gray-900">{selectedScript?.Script_Title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">房间</span>
                      <span className="font-semibold text-gray-900">{operationalRooms.find(r => r.Room_ID === createForm.Room_ID)?.Room_Name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">时间</span>
                      <span className="font-semibold text-gray-900">{createForm.Scheduled_Start_Time ? new Date(createForm.Scheduled_Start_Time).toLocaleString('zh-CN') : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">预计时长</span>
                      <span className="font-semibold text-gray-900">{selectedScript?.Estimated_Duration || 240} 分钟</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">DM</span>
                      <span className="font-semibold text-gray-900">{user?.DM_Stage_Name || user?.Account_Name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">人均价格</span>
                      <span className="font-semibold text-accent-pink">¥{createForm.Frozen_Per_Head_Price || selectedScript?.Base_Price || 0}/人</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">人数</span>
                      <span className="font-semibold text-gray-900">{selectedScript?.Min_Required_Players} - {selectedScript?.Max_Allowed_Players} 人</span>
                    </div>
                  </div>
                  <button onClick={handleQuickCreate} disabled={creating} className="btn-primary w-full text-sm disabled:opacity-50">
                    {creating ? '创建中...' : '🚗 确认创车'}
                  </button>
                </div>
              )}

              {/* 步骤导航 */}
              {createStep > 0 && (
                <button onClick={() => setCreateStep(createStep - 1)} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 py-2">
                  ← 上一步
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
