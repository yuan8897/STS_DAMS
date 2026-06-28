import React, { useState } from 'react';
import { getCurrentUser } from '../../store/auth';
import { getDMShifts, createDMShift, deleteDMShift } from '../../api/dms';
import { getSessions } from '../../api/sessions';
import { getScripts } from '../../api/scripts';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { showToast } from '../../components/common/Toast';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import type { DMShift, Session, Script } from '../../types';

const SHIFT_TYPE_LABEL: Record<string, string> = {
  Regular: '常规班',
  Overtime: '加班',
  On_Call: '待命',
};

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 8); // 8:00 ~ 25:00 (1am next day)

function getWeekDates(): Date[] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DmShiftsPage: React.FC = () => {
  const user = getCurrentUser();
  const dmId = user?.DM_User_ID || 0;

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    date: toDateStr(new Date()),
    start: '12:00',
    end: '22:00',
    type: 'Regular' as string,
    scriptId: 0,
  });
  const [selectedWeek, setSelectedWeek] = useState(() => getWeekDates());

  const weekDates = selectedWeek;
  const weekStr = `${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}`;

  const { data, loading, error, refresh } = useDataFetch({
    fetcher: (_signal) => dmId ? getDMShifts(dmId) : Promise.resolve([]),
    refreshInterval: 0,
  });

  // Load scripts for shift association
  const { data: scriptsData } = useDataFetch<Script[]>({
    fetcher: (_signal) => getScripts(),
    refreshInterval: 0,
  });
  const scripts = (scriptsData || []).filter(s => !s.Is_Retired);

  // Fetch sessions for this DM to show alongside shifts
  const { data: sessionsRaw } = useDataFetch<Session[]>({
    fetcher: (_signal) => dmId ? getSessions({ dm_id: String(dmId) }) : Promise.resolve([]),
    refreshInterval: 0,
  });
  const sessions: Session[] = (sessionsRaw || []).filter(s => s.Session_Status !== 'Aborted');

  const { execute: doCreate, loading: creating } = useApiMutation({
    apiFn: (params: { Available_Start: string; Available_End: string; Shift_Type: string; Script_ID?: number }) =>
      createDMShift(dmId, params),
    successMessage: '排班已添加',
  });

  const { execute: doDelete } = useApiMutation({
    apiFn: (shiftId: number) => deleteDMShift(shiftId),
    successMessage: '排班已删除',
  });

  const shifts = data || [];

  const handleAdd = async () => {
    if (!addForm.date || !addForm.start || !addForm.end) {
      showToast('请填写完整信息', 'warning');
      return;
    }
    const start = `${addForm.date}T${addForm.start}:00`;
    const end = `${addForm.date}T${addForm.end}:00`;
    await doCreate({
      Available_Start: start,
      Available_End: end,
      Shift_Type: addForm.type,
      Script_ID: addForm.scriptId > 0 ? addForm.scriptId : undefined,
    });
    refresh();
    setShowAdd(false);
    setAddForm({ date: toDateStr(new Date()), start: '12:00', end: '22:00', type: 'Regular', scriptId: 0 });
  };

  // 按天分组
  const shiftsByDay: Record<string, DMShift[]> = {};
  shifts.forEach(s => {
    const day = s.Available_Start.slice(0, 10);
    if (!shiftsByDay[day]) shiftsByDay[day] = [];
    shiftsByDay[day].push(s);
  });

  if (loading) return <Loading text="加载排班数据..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">我的排班</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {user?.DM_Stage_Name} · {weekStr} · 共 {shifts.length} 个时段
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-1">
          ➕ 添加排班
        </button>
      </div>

      {/* 添加排班弹窗 */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-[9980] bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[9981] bg-white rounded-2xl p-5 max-w-sm mx-auto sm:mx-0 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">添加排班</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <input type="date" value={addForm.date}
                  onChange={e => setAddForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始</label>
                  <input type="time" value={addForm.start}
                    onChange={e => setAddForm(p => ({ ...p, start: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束</label>
                  <input type="time" value={addForm.end}
                    onChange={e => setAddForm(p => ({ ...p, end: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <div className="flex gap-2">
                  {['Regular', 'Overtime', 'On_Call'].map(t => (
                    <button key={t}
                      onClick={() => setAddForm(p => ({ ...p, type: t }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        addForm.type === t ? 'bg-accent-purple text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {SHIFT_TYPE_LABEL[t] || t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  关联剧本 <span className="text-gray-400 font-normal text-xs">(可选，关联后显示剧本时长)</span>
                </label>
                <select
                  value={addForm.scriptId}
                  onChange={e => setAddForm(p => ({ ...p, scriptId: parseInt(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value={0}>不关联（常规排班）</option>
                  {scripts.map(s => (
                    <option key={s.Script_ID} value={s.Script_ID}>
                      {s.Script_Title} ({s.Estimated_Duration}分钟)
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleAdd} disabled={creating}
                className="btn-primary w-full text-sm disabled:opacity-50">
                {creating ? '添加中...' : '确认添加'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 周视图 */}
      {(shifts.length === 0 && sessions.length === 0) ? (
        <EmptyState icon="📅" title="暂无排班" description="点击「添加排班」设置你可用的带场时间" />
      ) : (
        <div className="card overflow-x-auto">
          <div className="min-w-[700px]">
            {/* 日期头 */}
            <div className="flex border-b border-gray-100">
              <div className="w-16 flex-shrink-0" />
              {weekDates.map((d, i) => (
                <div key={i} className="flex-1 text-center py-3">
                  <div className="text-xs text-gray-400">{DAYS[d.getDay()]}</div>
                  <div className="text-sm font-semibold text-gray-700 mt-0.5">{formatDate(d)}</div>
                </div>
              ))}
            </div>

            {/* 时间线 — shows both shifts AND sessions */}
            <div className="relative">
              {HOURS.map(h => (
                <div key={h} className="flex border-b border-gray-50">
                  <div className="w-16 flex-shrink-0 text-[12px] text-gray-400 text-right pr-2 py-2">
                    {h < 24 ? `${h}:00` : `${h - 24}:00(+1)`}
                  </div>
                  {weekDates.map((d, di) => {
                    const dateStr = toDateStr(d);
                    const dayShifts = (shiftsByDay[dateStr] || []).filter(s =>
                      s.Available_Start < `${dateStr}T${String(h + 1).padStart(2, '0')}:00` &&
                      s.Available_End > `${dateStr}T${String(h).padStart(2, '0')}:00`
                    );
                    // Sessions on this day for this hour
                    const daySessions = sessions.filter(sess => {
                      const sessDate = sess.Scheduled_Start_Time.slice(0, 10);
                      if (sessDate !== dateStr) return false;
                      const sessStart = sess.Scheduled_Start_Time;
                      const sessEnd = sess.Scheduled_End_Time;
                      const hStart = `${dateStr}T${String(h).padStart(2, '0')}:00`;
                      const hEnd = `${dateStr}T${String(h + 1).padStart(2, '0')}:00`;
                      return sessStart < hEnd && sessEnd > hStart;
                    });
                    return (
                      <div key={di} className="flex-1 h-10 border-l border-gray-50 relative">
                        {/* Shift blocks (排班 - 半透明背景) */}
                        {dayShifts.map(s => (
                          <div key={s.Shift_ID}
                            className="absolute inset-x-0.5 top-0.5 rounded opacity-70 flex items-center justify-center"
                            style={{
                              height: 'calc(100% - 4px)',
                              backgroundColor: s.Shift_Type === 'Regular' ? '#c4b5fd' :
                                s.Shift_Type === 'Overtime' ? '#fde68a' : '#cbd5e1',
                            }}
                            title={`排班 ${SHIFT_TYPE_LABEL[s.Shift_Type]}: ${s.Available_Start.slice(11, 16)} ~ ${s.Available_End.slice(11, 16)}${s.Script_Title ? ' · ' + s.Script_Title : ''}`}
                          >
                            {s.Script_Title && (
                              <span className="text-[11px] text-purple-700 font-medium truncate px-0.5 leading-tight">{s.Script_Title.slice(0, 4)}</span>
                            )}
                          </div>
                        ))}
                        {/* Session blocks (剧本场次 - 实心色块) */}
                        {daySessions.map(sess => (
                          <div key={`sess-${sess.Session_ID}`}
                            className="absolute inset-x-0.5 top-0.5 rounded flex items-center justify-center"
                            style={{
                              height: 'calc(100% - 4px)',
                              backgroundColor: sess.Session_Status === 'In_Progress' ? '#22c55e' :
                                sess.Session_Status === 'Matching' ? '#3b82f6' :
                                sess.Session_Status === 'Locked_Ready' ? '#f97316' : '#6b7280',
                              zIndex: 10,
                            }}
                            title={`🎭 ${sess.Script_Title}: ${new Date(sess.Scheduled_Start_Time).toISOString().slice(11, 16)} ~ ${new Date(sess.Scheduled_End_Time).toISOString().slice(11, 16)} (${sess.Room_Name})`}
                          >
                            <span className="text-[11px] text-white font-medium truncate px-0.5 leading-tight">
                              {sess.Script_Title?.slice(0, 6)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-[12px] text-gray-400 px-2">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-300 opacity-70"></span> 排班时段</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500"></span> 剧本场次</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> 进行中</span>
          </div>
        </div>
      )}

      {/* 排班列表 */}
      {shifts.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">时段列表</h3>
          <div className="space-y-2">
            {shifts.sort((a, b) => a.Available_Start.localeCompare(b.Available_Start)).map(s => (
              <div key={s.Shift_ID}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    s.Shift_Type === 'Regular' ? 'bg-purple-400' :
                    s.Shift_Type === 'Overtime' ? 'bg-yellow-400' : 'bg-gray-400'
                  }`} />
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {s.Available_Start.slice(0, 10)} {s.Available_Start.slice(11, 16)} ~ {s.Available_End.slice(11, 16)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {SHIFT_TYPE_LABEL[s.Shift_Type]}
                      {s.Script_Title && (
                        <span className="ml-1 text-accent-purple">
                          · {s.Script_Title}
                          {s.Script_Duration_Minutes && ` (${s.Script_Duration_Minutes}分钟)`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => { await doDelete(s.Shift_ID); refresh(); }}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
