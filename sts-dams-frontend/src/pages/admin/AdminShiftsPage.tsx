import React, { useState, useMemo, useCallback } from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { showToast } from '../../components/common/Toast';
import { getDMShifts, createDMShift, deleteDMShift, createDMCapability, deleteDMCapability, getDMs, getDMCapabilities } from '../../api/dms';
import { getScripts } from '../../api/scripts';
import { getSessions } from '../../api/sessions';
import type { DMScriptCapability, DMShift, DMProfile, Script, Session, ShiftType, ProficiencyLevel } from '../../types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { GENRES, PROFICIENCY_LABEL } from '../../constants/maps';

const SHIFT_TYPE_LABELS: Record<string, string> = {
  Regular: '常规班', Overtime: '加班', On_Call: '待命',
};

const PROFICIENCY_TAILWIND_COLORS: Record<string, string> = {
  Trained: 'bg-blue-100 text-blue-700',
  Proficient: 'bg-green-100 text-green-700',
  Expert: 'bg-purple-100 text-purple-700',
};

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const AdminShiftsPage: React.FC = () => {
  const [tab, setTab] = useState<'shifts' | 'capabilities'>('shifts');
  const [selectedDM, setSelectedDM] = useState<number>(0);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddCap, setShowAddCap] = useState(false);
  const [newShift, setNewShift] = useState({ DM_User_ID: 0, Available_Start: '', Available_End: '', Shift_Type: 'Regular' as const, Script_ID: 0 });
  const [newCap, setNewCap] = useState({ DM_User_ID: 0, Script_ID: 0, Proficiency_Level: 'Trained' as const });

  // Today and week dates
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  const weekStart = monday.toISOString().slice(0, 10);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const isToday = (dateStr: string) => dateStr === today.toISOString().slice(0, 10);

  // ─── useDataFetch: DMs ──────────────────────────────────────────────
  const { data: apiDMs } = useDataFetch<DMProfile[]>({
    fetcher: (_signal) => getDMs(),
  });
  const dms = apiDMs || [];

  // ─── useDataFetch: scripts ──────────────────────────────────────────
  const { data: apiScripts } = useDataFetch<Script[]>({
    fetcher: (_signal) => getScripts(),
  });
  const scripts = apiScripts || [];

  // ─── useDataFetch: shifts ───────────────────────────────────────────
  const {
    data: shiftsData,
    loading: shiftsLoading,
    refresh: refreshShifts,
  } = useDataFetch<DMShift[]>({
    fetcher: useCallback(async (_signal: AbortSignal) => {
      const activeDMs = dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation');
      if (activeDMs.length === 0) return [];
      const results = await Promise.allSettled(activeDMs.map(dm => getDMShifts(dm.DM_User_ID)));
      const allShifts: DMShift[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') allShifts.push(...r.value);
      });
      return allShifts;
    }, [dms]),
    deps: [dms.length],
  });

  const shifts: DMShift[] = shiftsData || [];

  // ─── Fetch sessions for DM conflict detection ─────────────────────────
  const { data: sessionsData } = useDataFetch<Session[]>({
    fetcher: useCallback(async (_signal: AbortSignal) => {
      const activeDMs = dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation');
      const allSessions: Session[] = [];
      for (const dm of activeDMs) {
        try {
          const dmSessions = await getSessions({ dm_id: String(dm.DM_User_ID) });
          allSessions.push(...dmSessions);
        } catch { /* skip */ }
      }
      return allSessions;
    }, [dms]),
  });
  const sessions: Session[] = sessionsData || [];

  // ─── useDataFetch: capabilities ─────────────────────────────────────
  // ─── useDataFetch: capabilities (per-DM) ───────────────────────────
  const {
    data: capData,
    loading: capLoading,
    refresh: refreshCaps,
  } = useDataFetch<DMScriptCapability[]>({
    fetcher: useCallback(async (_signal: AbortSignal) => {
      const activeDMs = dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation');
      if (activeDMs.length === 0) return [];
      const allCaps: DMScriptCapability[] = [];
      for (const dm of activeDMs) {
        try {
          const dmCaps = await getDMCapabilities(dm.DM_User_ID);
          allCaps.push(...dmCaps);
        } catch { /* skip DMs with no capabilities */ }
      }
      return allCaps;
    }, [dms]),
    deps: [dms.length],
  });

  const capabilities: DMScriptCapability[] = capData || [];

  // ─── useApiMutation: create shift ───────────────────────────────────
  const { execute: createShiftMutation, loading: shiftCreating } = useApiMutation({
    apiFn: (data: { dmId: number; Available_Start: string; Available_End: string; Shift_Type: string; Script_ID?: number }) =>
      createDMShift(data.dmId, {
        Available_Start: data.Available_Start,
        Available_End: data.Available_End,
        Shift_Type: data.Shift_Type,
        Script_ID: data.Script_ID,
      }),
    successMessage: '排班添加成功',
  });

  // ─── useApiMutation: delete shift ───────────────────────────────────
  const { execute: deleteShiftMutation } = useApiMutation({
    apiFn: (shiftId: number) => deleteDMShift(shiftId),
    successMessage: '排班已删除',
  });

  // ─── useApiMutation: create capability ──────────────────────────────
  const { execute: createCapMutation } = useApiMutation({
    apiFn: (data: { dmId: number; Script_ID: number; Proficiency_Level: string }) =>
      createDMCapability(data.dmId, {
        Script_ID: data.Script_ID,
        Proficiency_Level: data.Proficiency_Level,
      }),
    successMessage: '剧本能力添加成功',
  });

  // ─── useApiMutation: delete capability ──────────────────────────────
  const { execute: deleteCapMutation } = useApiMutation({
    apiFn: (data: { dmId: number; capId: number }) => deleteDMCapability(data.dmId, data.capId),
    successMessage: '能力已移除',
  });

  // ====== DM 时间冲突检测 (shifts + sessions) ======
  const dmConflicts = useMemo(() => {
    const conflicts: Map<number, Set<string>> = new Map();
    const activeDMs = dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation');

    activeDMs.forEach(dm => {
      const dmShifts = shifts.filter(s => s.DM_User_ID === dm.DM_User_ID);
      const dmSessions = sessions.filter(s => s.DM_User_ID === dm.DM_User_ID);
      const conflictDays = new Set<string>();

      // Check for overlapping shifts (shift vs shift)
      for (let i = 0; i < dmShifts.length; i++) {
        for (let j = i + 1; j < dmShifts.length; j++) {
          const aStart = new Date(dmShifts[i].Available_Start).getTime();
          const aEnd = new Date(dmShifts[i].Available_End).getTime();
          const bStart = new Date(dmShifts[j].Available_Start).getTime();
          const bEnd = new Date(dmShifts[j].Available_End).getTime();
          if (aStart < bEnd && aEnd > bStart) {
            conflictDays.add(new Date(dmShifts[i].Available_Start).toISOString().slice(0, 10));
          }
        }
      }

      // Check for shift vs session overlaps (常规班不应与剧本冲突)
      for (const shift of dmShifts) {
        const sStart = new Date(shift.Available_Start).getTime();
        const sEnd = new Date(shift.Available_End).getTime();
        for (const session of dmSessions) {
          if (session.Session_Status === 'Aborted') continue;
          const sessStart = new Date(session.Scheduled_Start_Time).getTime();
          const sessEnd = new Date(session.Scheduled_End_Time).getTime();
          if (sStart < sessEnd && sEnd > sessStart) {
            conflictDays.add(new Date(shift.Available_Start).toISOString().slice(0, 10));
          }
        }
      }

      if (conflictDays.size > 0) conflicts.set(dm.DM_User_ID, conflictDays);
    });

    return conflicts;
  }, [shifts, sessions, dms]);

  const getShiftsForDMAndDate = (dmId: number, dateStr: string) => {
    return shifts.filter(s => {
      if (s.DM_User_ID !== dmId) return false;
      const shiftDate = new Date(s.Available_Start).toISOString().slice(0, 10);
      return shiftDate === dateStr;
    });
  };

  // ====== 批量排班：复制上周 ======
  const handleCopyLastWeek = async () => {
    if (!selectedDM) return;
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lastMonday);
      d.setDate(lastMonday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    let copied = 0;
    for (const oldDate of lastWeekDays) {
      const oldShifts = shifts.filter(s => {
        if (s.DM_User_ID !== selectedDM) return false;
        return new Date(s.Available_Start).toISOString().slice(0, 10) === oldDate;
      });
      for (const oldShift of oldShifts) {
        const offset = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        const newStart = new Date(new Date(oldShift.Available_Start).getTime() + offset);
        const newEnd = new Date(new Date(oldShift.Available_End).getTime() + offset);
        const newDate = newStart.toISOString().slice(0, 10);

        // Check if new date already has shifts
        const exists = shifts.some(s => {
          if (s.DM_User_ID !== selectedDM) return false;
          return new Date(s.Available_Start).toISOString().slice(0, 10) === newDate;
        });

        if (!exists && newDate >= today.toISOString().slice(0, 10)) {
          try {
            await createDMShift(selectedDM, {
              Available_Start: newStart.toISOString(),
              Available_End: newEnd.toISOString(),
              Shift_Type: oldShift.Shift_Type,
            });
            copied++;
          } catch {
            // skip failures
          }
        }
      }
    }

    if (copied > 0) {
      refreshShifts();
      showToast(`已复制 ${copied} 个班次`, 'success');
    } else {
      showToast('上周无班次可复制，或本周已有排班', 'warning');
    }
  };

  // ====== Add shift handler ======
  const handleAddShift = async () => {
    if (!newShift.DM_User_ID || !newShift.Available_Start || !newShift.Available_End) return;
    const s = new Date(newShift.Available_Start + ':00Z').getTime();
    const e = new Date(newShift.Available_End + ':00Z').getTime();

    // 排班时间冲突检测 (shift vs shift)
    const hasShiftConflict = shifts.some(shift => {
      if (shift.DM_User_ID !== newShift.DM_User_ID) return false;
      const shiftS = new Date(shift.Available_Start).getTime();
      const shiftE = new Date(shift.Available_End).getTime();
      return s < shiftE && e > shiftS;
    });
    if (hasShiftConflict) {
      showToast('该 DM 在此时间段已有排班，存在时间重叠', 'error');
      return;
    }

    // 检测排班与会话冲突 (常规班不应与剧本场次冲突)
    const hasSessionConflict = sessions.some(sess => {
      if (sess.DM_User_ID !== newShift.DM_User_ID) return false;
      if (sess.Session_Status === 'Aborted') return false;
      const sessStart = new Date(sess.Scheduled_Start_Time).getTime();
      const sessEnd = new Date(sess.Scheduled_End_Time).getTime();
      return s < sessEnd && e > sessStart;
    });
    if (hasSessionConflict) {
      showToast('该时段与 DM 已有剧本场次冲突，请调整时间', 'error');
      return;
    }

    const result = await createShiftMutation({
      dmId: newShift.DM_User_ID,
      Available_Start: new Date(newShift.Available_Start + ':00Z').toISOString(),
      Available_End: new Date(newShift.Available_End + ':00Z').toISOString(),
      Shift_Type: newShift.Shift_Type,
      Script_ID: newShift.Script_ID > 0 ? newShift.Script_ID : undefined,
    });

    if (result !== null) {
      setShowAddShift(false);
      setNewShift({ DM_User_ID: 0, Available_Start: '', Available_End: '', Shift_Type: 'Regular', Script_ID: 0 });
      refreshShifts();
    }
  };

  // ====== Add capability handler ======
  const handleAddCap = async () => {
    if (!newCap.DM_User_ID || !newCap.Script_ID) return;
    const exists = capabilities.some(c => c.DM_User_ID === newCap.DM_User_ID && c.Script_ID === newCap.Script_ID);
    if (exists) {
      showToast('该 DM 已具备此剧本能力', 'warning');
      return;
    }

    const result = await createCapMutation({
      dmId: newCap.DM_User_ID,
      Script_ID: newCap.Script_ID,
      Proficiency_Level: newCap.Proficiency_Level,
    });

    if (result !== null) {
      setShowAddCap(false);
      setNewCap({ DM_User_ID: 0, Script_ID: 0, Proficiency_Level: 'Trained' });
      refreshCaps();
    }
  };

  // ====== Delete capability handler ======
  const handleDeleteCap = async (capId: number) => {
    const cap = capabilities.find(c => c.Capability_ID === capId);
    await deleteCapMutation({ dmId: cap?.DM_User_ID || 0, capId });
    refreshCaps();
  };

  // ====== Delete shift handler ======
  const handleDeleteShift = async (shiftId: number) => {
    await deleteShiftMutation(shiftId);
    refreshShifts();
  };

  const dmShiftsForWeek = selectedDM ? weekDays.map(d => ({
    date: d,
    shifts: getShiftsForDMAndDate(selectedDM, d),
  })) : [];

  const selectedDMConflicts = selectedDM ? dmConflicts.get(selectedDM) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">排班管理</h2>
          <p className="text-sm text-gray-400 mt-0.5">DM 排班周视图 · 剧本能力认证 · 冲突检测</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('shifts')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === 'shifts' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
          }`}
        >排班周视图</button>
        <button
          onClick={() => setTab('capabilities')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === 'capabilities' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
          }`}
        >剧本能力管理</button>
      </div>

      {tab === 'shifts' && (
        <>
          {/* DM selector with conflict indicators */}
          <div className="flex flex-wrap gap-2">
            {dms.map(dm => {
              const hasConflict = dmConflicts.has(dm.DM_User_ID);
              return (
                <button
                  key={dm.DM_User_ID}
                  onClick={() => setSelectedDM(dm.DM_User_ID === selectedDM ? 0 : dm.DM_User_ID)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all relative ${
                    dm.DM_User_ID === selectedDM
                      ? 'bg-accent-purple text-white border-accent-purple'
                      : hasConflict
                      ? 'bg-white text-gray-600 border-red-300 hover:border-red-400'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  } ${dm.Employment_Status !== 'Active' && dm.Employment_Status !== 'Probation' ? 'opacity-50' : ''}`}
                >
                  {dm.DM_Stage_Name}
                  <span className="text-xs ml-1 opacity-70">
                    ({dm.Employment_Status === 'Active' ? '在职' : dm.Employment_Status === 'Probation' ? '试用' : dm.Employment_Status === 'On_Leave' ? '请假' : '离职'})
                  </span>
                  {hasConflict && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[11px] flex items-center justify-center" title="排班冲突">!</span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => { setShowAddShift(true); setNewShift({ DM_User_ID: selectedDM || dms[0]?.DM_User_ID || 0, Available_Start: '', Available_End: '', Shift_Type: 'Regular', Script_ID: 0 }); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-400 hover:text-accent-purple hover:border-accent-purple transition-all"
            >
              + 新增排班
            </button>
            {selectedDM > 0 && (
              <button
                onClick={handleCopyLastWeek}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-purple-300 text-purple-400 hover:text-purple-600 hover:border-purple-400 transition-all"
                title="复制上周排班到本周"
              >
                📋 复制上周
              </button>
            )}
          </div>

          {/* Conflict warnings */}
          {selectedDM > 0 && selectedDMConflicts && selectedDMConflicts.size > 0 && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
              ⚠ 检测到排班冲突：以下日期的 DM 排班存在时间重叠，请检查调整。
              {Array.from(selectedDMConflicts).map(d => (
                <span key={d} className="inline-block bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded ml-2">{d.slice(5)}</span>
              ))}
            </div>
          )}

          {/* Week calendar for selected DM — override parent zoom to prevent horizontal scroll */}
          {selectedDM > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto" style={{ zoom: 1 }}>
              <div className="grid grid-cols-7 border-b border-gray-100" style={{ minWidth: 700 }}>
                {WEEKDAYS.map((day, i) => (
                  <div key={day} className={`px-2 py-2 text-center border-r border-gray-50 last:border-r-0 ${
                    isToday(weekDays[i]) ? 'bg-purple-50' : ''
                  }`}>
                    <div className="text-xs text-gray-400">{day}</div>
                    <div className={`text-sm font-medium ${isToday(weekDays[i]) ? 'text-accent-purple' : 'text-gray-700'}`}>
                      {weekDays[i].slice(5)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7" style={{ minHeight: 200 }}>
                {dmShiftsForWeek.map((day, i) => {
                  const hasConflict = selectedDMConflicts?.has(day.date);
                  // Get sessions for this DM on this day
                  const daySessions = sessions.filter(sess => {
                    if (sess.DM_User_ID !== selectedDM) return false;
                    if (sess.Session_Status === 'Aborted') return false;
                    const sessDate = new Date(sess.Scheduled_Start_Time).toISOString().slice(0, 10);
                    return sessDate === day.date;
                  });
                  return (
                    <div key={i} className={`border-r border-gray-50 last:border-r-0 p-2 space-y-1.5 min-h-[120px] ${
                      isToday(day.date) ? 'bg-purple-50/30' : ''
                    } ${hasConflict ? 'bg-red-50/20' : ''}`}>
                      {/* Session blocks (剧本场次) - shown above shifts */}
                      {daySessions.map(sess => (
                        <div
                          key={`sess-${sess.Session_ID}`}
                          className="rounded-lg px-2 py-1 text-[12px] relative border bg-purple-50 border-purple-200"
                        >
                          <div className="font-medium text-purple-700 truncate">
                            🎭 {sess.Script_Title}
                          </div>
                          <div className="text-purple-500">
                            {new Date(sess.Scheduled_Start_Time).toISOString().slice(11, 16)} - {new Date(sess.Scheduled_End_Time).toISOString().slice(11, 16)}
                          </div>
                          <div className="text-[11px] text-purple-400">{sess.Room_Name}</div>
                        </div>
                      ))}
                      {/* Shift blocks (排班) */}
                      {day.shifts.length === 0 && daySessions.length === 0 ? (
                        <p className="text-[12px] text-gray-300 text-center pt-4">--</p>
                      ) : (
                        day.shifts.map(shift => (
                          <div
                            key={shift.Shift_ID}
                            className={`rounded-lg px-2 py-1 text-[12px] relative group border ${
                              hasConflict
                                ? 'bg-red-50 border-red-200'
                                : shift.Shift_Type === 'Regular'
                                ? 'bg-blue-50 border-blue-100'
                                : shift.Shift_Type === 'Overtime'
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className={`font-medium ${
                              hasConflict ? 'text-red-700'
                              : shift.Shift_Type === 'Regular' ? 'text-blue-700'
                              : shift.Shift_Type === 'Overtime' ? 'text-yellow-700'
                              : 'text-gray-600'
                            }`}>
                              {new Date(shift.Available_Start).toISOString().slice(11, 16)} - {new Date(shift.Available_End).toISOString().slice(11, 16)}
                            </div>
                            <div className={hasConflict ? 'text-red-500' : 'text-blue-500'}>
                              {SHIFT_TYPE_LABELS[shift.Shift_Type] || shift.Shift_Type}
                              {shift.Script_ID && shift.Script_Title && (
                                <span className="ml-1">
                                  · {shift.Script_Title}
                                  {shift.Script_Duration_Minutes && ` (${shift.Script_Duration_Minutes}min)`}
                                </span>
                              )}
                            </div>
                            {hasConflict && (
                              <div className="text-[11px] text-red-400">⚠ 冲突</div>
                            )}
                            <button
                              onClick={() => handleDeleteShift(shift.Shift_ID)}
                              className="absolute top-0.5 right-0.5 text-[12px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >✕</button>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDM === 0 && (
            <EmptyState title="请选择一个 DM 查看排班" />
          )}
        </>
      )}

      {tab === 'capabilities' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">DM 剧本能力认证</h3>
            <button onClick={() => setShowAddCap(true)} className="btn-primary text-sm px-3 py-1.5">+ 添加能力</button>
          </div>

          {dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation').map(dm => {
            const dmCaps = capabilities.filter(c => c.DM_User_ID === dm.DM_User_ID);
            // Check DM capability coverage vs active scripts
            const activeScripts = scripts.filter(s => !s.Is_Retired);
            const missingCaps = activeScripts.filter(s => !dmCaps.some(c => c.Script_ID === s.Script_ID));

            return (
              <div key={dm.DM_User_ID} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-medium text-gray-800">{dm.DM_Stage_Name}</span>
                  <span className="text-xs text-gray-400">· 底薪 ¥{dm.Base_Per_Session_Wage}/场</span>
                  <span className="text-xs text-gray-400">· {dmCaps.length}/{activeScripts.length} 本剧本</span>
                </div>
                {dmCaps.length === 0 ? (
                  <p className="text-sm text-gray-400">暂未登记任何剧本能力</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dmCaps.map(cap => (
                      <span key={cap.Capability_ID} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${PROFICIENCY_TAILWIND_COLORS[cap.Proficiency_Level] || 'bg-gray-100 text-gray-600'} group`}>
                        {cap.Script_Title} · {PROFICIENCY_LABEL[cap.Proficiency_Level as keyof typeof PROFICIENCY_LABEL]}
                        <button
                          onClick={() => handleDeleteCap(cap.Capability_ID)}
                          className="text-[12px] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                )}
                {missingCaps.length > 0 && (
                  <p className="text-[12px] text-gray-400 mt-2">
                    未认证剧本: {missingCaps.map(s => s.Script_Title).join('、')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Shift Dialog */}
      {showAddShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddShift(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">新增排班</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DM</label>
              <select value={newShift.DM_User_ID} onChange={e => setNewShift({ ...newShift, DM_User_ID: parseInt(e.target.value) })} className="input-field text-sm">
                <option value={0}>选择 DM</option>
                {dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation').map(dm => (
                  <option key={dm.DM_User_ID} value={dm.DM_User_ID}>{dm.DM_Stage_Name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">班次类型</label>
              <select value={newShift.Shift_Type} onChange={e => setNewShift({ ...newShift, Shift_Type: e.target.value as ShiftType })} className="input-field text-sm">
                {Object.entries(SHIFT_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                关联剧本 <span className="text-gray-400 font-normal">(可选，关联后排班将在周视图标注剧本名)</span>
              </label>
              <select value={newShift.Script_ID} onChange={e => setNewShift({ ...newShift, Script_ID: parseInt(e.target.value) })} className="input-field text-sm">
                <option value={0}>不关联（常规排班）</option>
                {scripts.filter(s => !s.Is_Retired).map(s => (
                  <option key={s.Script_ID} value={s.Script_ID}>{s.Script_Title} ({s.Estimated_Duration}分钟)</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                <input type="datetime-local" value={newShift.Available_Start} onChange={e => setNewShift({ ...newShift, Available_Start: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                <input type="datetime-local" value={newShift.Available_End} onChange={e => setNewShift({ ...newShift, Available_End: e.target.value })} className="input-field text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAddShift(false)} className="btn-secondary text-sm flex-1">取消</button>
              <button onClick={handleAddShift} disabled={shiftCreating} className="btn-primary text-sm flex-1">
                {shiftCreating ? '添加中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Capability Dialog */}
      {showAddCap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddCap(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">添加 DM 剧本能力</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DM</label>
              <select value={newCap.DM_User_ID} onChange={e => setNewCap({ ...newCap, DM_User_ID: parseInt(e.target.value) })} className="input-field text-sm">
                <option value={0}>选择 DM</option>
                {dms.filter(d => d.Employment_Status === 'Active' || d.Employment_Status === 'Probation').map(dm => (
                  <option key={dm.DM_User_ID} value={dm.DM_User_ID}>{dm.DM_Stage_Name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">剧本</label>
              <select value={newCap.Script_ID} onChange={e => setNewCap({ ...newCap, Script_ID: parseInt(e.target.value) })} className="input-field text-sm">
                <option value={0}>选择剧本</option>
                {scripts.filter(s => !s.Is_Retired).map(s => (
                  <option key={s.Script_ID} value={s.Script_ID}>{s.Script_Title} ({GENRES[s.Primary_Genre]})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">熟练度</label>
              <select value={newCap.Proficiency_Level} onChange={e => setNewCap({ ...newCap, Proficiency_Level: e.target.value as ProficiencyLevel })} className="input-field text-sm">
                {Object.entries(PROFICIENCY_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAddCap(false)} className="btn-secondary text-sm flex-1">取消</button>
              <button onClick={handleAddCap} className="btn-primary text-sm flex-1">确认添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
