import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { showToast } from '../../components/common/Toast';
import { getSessionGrid, createSession, updateSessionStatus, cancelSession } from '../../api/sessions';
import { getRooms } from '../../api/rooms';
import { getScripts, getScriptCopies } from '../../api/scripts';
import { getDMs } from '../../api/dms';
import { getCurrentUser, getUserRole } from '../../store/auth';
import type { Session, StoreRoom, Script, DMProfile, ScriptCopy } from '../../types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import { SESSION_STATUS_LABEL, SESSION_STATUS_COLOR, DEFAULT_STORE_ID, GENRES } from '../../constants/maps';

const ROW_HEIGHT = 140;  // 每个房间行的高度
const HOUR_WIDTH = 64;  // 每小时列宽 (px)
const START_HOUR = 8;
const END_HOUR = 26; // 2am next day
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HEADER_WIDTH = 180;
const TIMELINE_WIDTH = TOTAL_HOURS * HOUR_WIDTH;

interface CreateSessionForm {
  Script_ID: number;
  Copy_ID: number;
  DM_User_ID: number;
  Room_ID: number;
  Scheduled_Start_Time: string;
  Scheduled_End_Time: string;
  Frozen_Per_Head_Price: number;
}

const initialForm: CreateSessionForm = {
  Script_ID: 0,
  Copy_ID: 0,
  DM_User_ID: 0,
  Room_ID: 0,
  Scheduled_Start_Time: '',
  Scheduled_End_Time: '',
  Frozen_Per_Head_Price: 0,
};

export const AdminDashboardPage: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateSessionForm>({ ...initialForm, Room_ID: 0 });
  const [formStep, setFormStep] = useState(0);
  const [conflict, setConflict] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ session: Session; edge: 'start' | 'end' | 'move'; startX: number; startY: number } | null>(null);

  // Fetch rooms from API
  const { data: apiRooms } = useDataFetch<StoreRoom[]>({
    fetcher: (_signal) => getRooms(),
  });
  const rooms = apiRooms || [];
  const operationalRooms = rooms.filter(r => r.Room_Operating_Status === 'Operational');

  // Fetch scripts from API
  const { data: apiScripts } = useDataFetch<Script[]>({
    fetcher: (_signal) => getScripts(),
  });
  const scripts = apiScripts || [];

  // Fetch DMs from API
  const { data: apiDMs } = useDataFetch<DMProfile[]>({
    fetcher: (_signal) => getDMs(),
  });
  const dms = apiDMs || [];

  // Fetch script copies for selected script
  const [scriptCopies, setScriptCopies] = useState<ScriptCopy[]>([]);
  useEffect(() => {
    if (form.Script_ID > 0) {
      getScriptCopies(form.Script_ID).then(setScriptCopies).catch(() => setScriptCopies([]));
    } else {
      setScriptCopies([]);
    }
  }, [form.Script_ID]);

  // ─── useDataFetch: load sessions grid ───────────────────────────────
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  const {
    data: sessionsData,
    loading: sessionsLoading,
    error: sessionsError,
    refresh,
  } = useDataFetch({
    fetcher: useCallback(async (_signal: AbortSignal) => {
      const grid = await getSessionGrid(selectedDateRef.current);
      const flat: Session[] = [];
      grid.rooms.forEach(r => {
        r.sessions.forEach(s => {
          flat.push({
            Session_ID: s.Session_ID,
            Store_ID: DEFAULT_STORE_ID,
            Copy_ID: 0,
            Room_ID: r.Room_ID,
            DM_User_ID: 0,
            Scheduled_Start_Time: s.Start,
            Scheduled_End_Time: s.End,
            Session_Status: s.Status,
            Frozen_Per_Head_Price: s.Frozen_Per_Head_Price,
            Created_By_User_ID: 0,
            Created_At: '',
            Script_Title: s.Script_Title,
            Room_Name: r.Room_Name,
            DM_Stage_Name: s.DM_Stage_Name,
            Player_Count: s.Player_Count,
            Max_Allowed_Players: s.Max_Players,
          });
        });
      });
      return flat;
    }, []),
  });

  // Re-fetch when date changes
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Local sessions state (driven by hook data, mutable for drag UX)
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    if (sessionsData) setSessions(sessionsData);
  }, [sessionsData]);

  // ─── useApiMutation: create session ─────────────────────────────────
  const { execute: createSessionMutation, loading: creating } = useApiMutation({
    apiFn: (data: {
      Copy_ID: number; Room_ID: number; DM_User_ID: number;
      Scheduled_Start_Time: string; Scheduled_End_Time: string;
      Frozen_Per_Head_Price: number;
    }) => createSession(data),
    successMessage: '场次创建成功',
  });

  // ─── useApiMutation: status changes ─────────────────────────────────
  const { execute: lockSessionMutation } = useApiMutation({
    apiFn: (id: number) => updateSessionStatus(id, 'Locked_Ready'),
    successMessage: '场次已锁车',
  });

  const { execute: startSessionMutation } = useApiMutation({
    apiFn: (id: number) => updateSessionStatus(id, 'In_Progress'),
    successMessage: '场次已开场',
  });

  const { execute: completeSessionMutation } = useApiMutation({
    apiFn: (id: number) => updateSessionStatus(id, 'Completed'),
    successMessage: '场次已结账完成',
  });

  const { execute: cancelSessionMutation } = useApiMutation({
    apiFn: (id: number) => cancelSession(id),
    successMessage: '场次已取消',
  });

  // ─── Utility functions ──────────────────────────────────────────────
  const formatHour = (h: number) => {
    if (h >= 24) return `次日${h - 24}:00`;
    return `${h}:00`;
  };

  const timeToX = (timeStr: string) => {
    const d = new Date(timeStr);
    const hours = d.getHours() + d.getMinutes() / 60;
    return (hours - START_HOUR) * HOUR_WIDTH;
  };

  const getDurationWidth = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return ((e - s) / 3600000) * HOUR_WIDTH;
  };

  const checkConflict = useCallback((roomId: number, dmId: number, start: string, end: string, excludeId?: number) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const roomConflict = sessions.find(sess =>
      sess.Room_ID === roomId &&
      (excludeId === undefined || sess.Session_ID !== excludeId) &&
      new Date(sess.Scheduled_Start_Time).getTime() < e &&
      new Date(sess.Scheduled_End_Time).getTime() > s
    );
    if (roomConflict) return `房间冲突: ${roomConflict.Script_Title} (${formatTime(roomConflict.Scheduled_Start_Time)}-${formatTime(roomConflict.Scheduled_End_Time)})`;

    const dmConflict = sessions.find(sess =>
      sess.DM_User_ID === dmId &&
      (excludeId === undefined || sess.Session_ID !== excludeId) &&
      new Date(sess.Scheduled_Start_Time).getTime() < e &&
      new Date(sess.Scheduled_End_Time).getTime() > s
    );
    if (dmConflict) return `DM冲突: ${dmConflict.DM_Stage_Name} 在 ${formatTime(dmConflict.Scheduled_Start_Time)}-${formatTime(dmConflict.Scheduled_End_Time)} 有场次`;

    return null;
  }, [sessions]);

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  /** Convert X offset (from timeline left edge) to a time string */
  const xToTime = (x: number) => {
    const hours = START_HOUR + x / HOUR_WIDTH;
    const h = Math.round(hours * 4) / 4; // snap to 15min
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${selectedDate}T${String(Math.min(hh, 23)).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`;
  };

  // ─── Drag handlers (X-axis) ─────────────────────────────────────────
  const [dragX, setDragX] = useState<number | null>(null);
  const [dragSessionId, setDragSessionId] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent, session: Session) => {
    if (session.Session_Status !== 'Matching' && session.Session_Status !== 'Locked_Ready') return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    setDragSessionId(session.Session_ID);
    setDragState({ session, edge: 'move', startX, startY: e.clientY });
    setDragX(0);
  }, []);

  useEffect(() => {
    if (!dragState || dragSessionId == null) return;

    const onMove = (e: MouseEvent) => {
      setDragX(e.clientX - dragState.startX);
    };
    const onUp = async () => {
      if (dragX != null && Math.abs(dragX) > 5) {
        const deltaMs = (dragX / HOUR_WIDTH) * 3600000;
        const oldStart = new Date(dragState.session.Scheduled_Start_Time).getTime();
        const oldEnd = new Date(dragState.session.Scheduled_End_Time).getTime();
        const newStart = new Date(oldStart + deltaMs).toISOString();
        const newEnd = new Date(oldEnd + deltaMs).toISOString();

        // Check conflicts
        const otherSessions = sessions.filter(s => s.Session_ID !== dragState.session.Session_ID);
        const hasConflict = otherSessions.some(s =>
          (s.Room_ID === dragState.session.Room_ID || s.DM_User_ID === dragState.session.DM_User_ID) &&
          new Date(s.Scheduled_Start_Time).getTime() < new Date(newEnd).getTime() &&
          new Date(s.Scheduled_End_Time).getTime() > new Date(newStart).getTime()
        );

        if (hasConflict) {
          showToast('时间冲突：目标时段已有其他场次', 'error');
        } else {
          try {
            await updateSessionStatus(dragState.session.Session_ID, dragState.session.Session_Status);
            setSessions(prev => prev.map(s =>
              s.Session_ID === dragState.session.Session_ID
                ? { ...s, Scheduled_Start_Time: newStart, Scheduled_End_Time: newEnd }
                : s
            ));
            showToast('场次时间已调整');
          } catch {
            showToast('调整失败，后端未响应', 'error');
          }
        }
      }
      setDragState(null);
      setDragSessionId(null);
      setDragX(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragState, dragSessionId, dragX, sessions]);

  const getDragOffset = (sessionId: number) =>
    dragSessionId === sessionId && dragX != null ? dragX : 0;

  // ─── Create session handler ─────────────────────────────────────────
  const handleCreateSession = async () => {
    const c = checkConflict(form.Room_ID, form.DM_User_ID, form.Scheduled_Start_Time, form.Scheduled_End_Time);
    if (c) { setConflict(c); return; }

    const result = await createSessionMutation({
      Copy_ID: form.Copy_ID,
      Room_ID: form.Room_ID,
      DM_User_ID: form.DM_User_ID,
      Scheduled_Start_Time: form.Scheduled_Start_Time,
      Scheduled_End_Time: form.Scheduled_End_Time,
      Frozen_Per_Head_Price: form.Frozen_Per_Head_Price,
    });

    if (result !== null) {
      setShowCreate(false);
      setForm({ ...initialForm });
      setFormStep(0);
      setConflict(null);
      refresh();
    }
  };

  // ─── Grid click → quick-create (X-axis) ─────────────────────────────
  const handleGridClick = (roomId: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hours = START_HOUR + x / HOUR_WIDTH;
    const startHour = Math.floor(hours);
    const startMin = Math.round((hours - startHour) * 60 / 30) * 30;
    const startTime = new Date(`${selectedDate}T00:00:00`);
    startTime.setHours(startHour, startMin >= 60 ? 0 : startMin, 0, 0);
    if (startMin >= 60) startTime.setHours(startHour + 1);

    const endTime = new Date(startTime.getTime() + 4 * 3600000);

    setForm({
      ...initialForm,
      Room_ID: roomId,
      Scheduled_Start_Time: startTime.toISOString(),
      Scheduled_End_Time: endTime.toISOString(),
    });
    setShowCreate(true);
    setFormStep(1);
    setConflict(null);
  };

  const selectedScript = scripts.find(s => s.Script_ID === form.Script_ID);
  const availableCopies = scriptCopies.filter(c => c.Script_ID === form.Script_ID && (c.Asset_Condition === 'Perfect' || c.Asset_Condition === 'Worn'));
  const availableDMs = dms.filter(d => {
    if (d.Employment_Status !== 'Active' && d.Employment_Status !== 'Probation') return false;
    return true;
  });

  const isStoreManager = getUserRole() === 4;
  const navigate = useNavigate();

  // ─── Store_Manager 轻量运营概览 ──────────────────────────────────────
  if (isStoreManager) {
    const statusOrder = ['Matching', 'Locked_Ready', 'In_Progress', 'Completed'] as const;
    const activeSessions = sessions.filter(s => s.Session_Status !== 'Completed' && s.Session_Status !== 'Aborted');
    const todaySessions = sessions.filter(s => {
      const sessionDate = new Date(s.Scheduled_Start_Time).toISOString().slice(0, 10);
      return sessionDate === selectedDate;
    });
    const roomsInUse = new Set(activeSessions.map(s => s.Room_ID)).size;
    const dmsOnDuty = new Set(activeSessions.map(s => s.DM_User_ID)).size;

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">门店运营概览</h2>
            <p className="text-base text-gray-400 mt-0.5">快速查看今日场次与运营数据</p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input-field text-base py-2 w-auto"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '今日场次', value: todaySessions.length, icon: '🎪', color: 'bg-blue-50 text-blue-700' },
            { label: '进行中', value: activeSessions.filter(s => s.Session_Status === 'In_Progress').length, icon: '▶️', color: 'bg-green-50 text-green-700' },
            { label: '使用房间', value: roomsInUse, icon: '🏠', color: 'bg-purple-50 text-purple-700' },
            { label: '在岗 DM', value: dmsOnDuty, icon: '🎭', color: 'bg-orange-50 text-orange-700' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color}`}>
                {icon}
              </div>
              <div>
                <p className="text-2xs text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '库存管理', icon: '📦', path: '/admin/inventory' },
            { label: '优惠券核销', icon: '🎟️', path: '/admin/coupons/usage' },
            { label: '排班查看', icon: '📅', path: '/admin/shifts' },
            { label: '评价管理', icon: '⭐', path: '/admin/reviews' },
          ].map(({ label, icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="card flex flex-col items-center gap-2 py-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>

        {/* Today's Sessions Table */}
        <div className="card overflow-hidden !p-0">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">
              {selectedDate === today ? '今日场次' : `场次列表 (${selectedDate})`}
            </h3>
          </div>
          {sessionsLoading ? (
            <p className="text-base text-gray-400 p-5">加载中...</p>
          ) : sessionsError ? (
            <p className="text-base text-red-500 p-5">{sessionsError}</p>
          ) : todaySessions.length === 0 ? (
            <div className="p-8">
              <EmptyState message="暂无场次数据" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">时间</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">剧本</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">DM</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">房间</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">人数</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySessions.map(sess => (
                    <tr key={sess.Session_ID} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatTime(sess.Scheduled_Start_Time)}-{formatTime(sess.Scheduled_End_Time)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{sess.Script_Title}</td>
                      <td className="px-4 py-3 text-gray-600">{sess.DM_Stage_Name}</td>
                      <td className="px-4 py-3 text-gray-600">{sess.Room_Name}</td>
                      <td className="px-4 py-3 text-gray-700">{sess.Player_Count ?? 0}/{sess.Max_Allowed_Players}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-medium text-white"
                          style={{ backgroundColor: SESSION_STATUS_COLOR[sess.Session_Status as keyof typeof SESSION_STATUS_COLOR] || '#999' }}
                        >
                          {SESSION_STATUS_LABEL[sess.Session_Status as keyof typeof SESSION_STATUS_LABEL]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-3 text-sm">
          {statusOrder.map(status => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: SESSION_STATUS_COLOR[status] }} />
              {SESSION_STATUS_LABEL[status]}: {sessions.filter(s => s.Session_Status === status).length}
            </span>
          ))}
          <span className="text-gray-400">共 {sessions.length} 场</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">时空管理大盘</h2>
          <p className="text-sm text-gray-400 mt-0.5">Canvas 时间轴画布 · 房间-时间双维矩阵</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input-field text-sm py-1.5"
          />
          <button
            onClick={() => { setShowCreate(true); setFormStep(0); setForm({ ...initialForm }); setConflict(null); }}
            className="btn-primary text-sm px-4 py-1.5"
          >
            + 创车
          </button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(SESSION_STATUS_LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: SESSION_STATUS_COLOR[k as keyof typeof SESSION_STATUS_COLOR] }} />
            {v}
          </span>
        ))}
      </div>

      {/* Loading / error states */}
      {sessionsLoading && <p className="text-sm text-gray-400">加载中...</p>}
      {sessionsError && <p className="text-sm text-red-500">{sessionsError}</p>}

      {/* Timeline Grid — time on horizontal axis, rooms on vertical axis */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm" style={{ zoom: 1, overflowX: 'auto', width: 'fit-content', maxWidth: '100%' }}>
        <div style={{ width: HEADER_WIDTH + TIMELINE_WIDTH }}>
          {/* Hour header row — horizontal time labels */}
          <div className="flex border-b border-gray-200" style={{ marginLeft: HEADER_WIDTH, width: TIMELINE_WIDTH }}>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={i} className="text-xs text-gray-400 text-center py-1 border-l border-gray-100" style={{ width: HOUR_WIDTH }}>
                {formatHour(START_HOUR + i)}
              </div>
            ))}
          </div>

          {/* Room rows */}
          <div>
            {operationalRooms.map(room => {
              const roomSessions = sessions.filter(s => s.Room_ID === room.Room_ID);
              return (
                <div key={room.Room_ID} className="flex border-b-2 border-gray-300">
                  {/* Room label */}
                  <div className="flex-shrink-0 flex flex-col justify-center px-3 py-1 border-r-2 border-gray-300 bg-gray-50/50" style={{ width: HEADER_WIDTH }}>
                    <span className="text-sm text-gray-800 truncate">{room.Room_Name}</span>
                    <span className="text-xs text-gray-400">{room.Room_Max_Capacity}人</span>
                  </div>

                  {/* Timeline lane — horizontal time axis */}
                  <div
                    className="relative cursor-pointer"
                    style={{ width: TIMELINE_WIDTH, height: ROW_HEIGHT }}
                    onClick={(e) => handleGridClick(room.Room_ID, e)}
                  >
                    {/* Vertical hour grid lines */}
                    {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-gray-100 pointer-events-none"
                        style={{ left: i * HOUR_WIDTH }}
                      />
                    ))}

                    {/* Session blocks — positioned horizontally by time */}
                    {roomSessions.map(sess => {
                      const left = timeToX(sess.Scheduled_Start_Time);
                      const width = getDurationWidth(sess.Scheduled_Start_Time, sess.Scheduled_End_Time);
                      const canDrag = sess.Session_Status === 'Matching' || sess.Session_Status === 'Locked_Ready';
                      const offset = getDragOffset(sess.Session_ID);
                      const isDragging = dragSessionId === sess.Session_ID;

                      return (
                        <div
                          key={sess.Session_ID}
                          className={`absolute top-0.5 bottom-0.5 rounded px-1 py-0.5 transition-all overflow-hidden z-10 ${
                            isDragging ? 'z-30 opacity-80 shadow-lg' : 'shadow-sm'
                          } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                          style={{
                            left: left + offset,
                            width: Math.max(width, 48),
                            backgroundColor: SESSION_STATUS_COLOR[sess.Session_Status as keyof typeof SESSION_STATUS_COLOR] || '#999',
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedSession(sess); }}
                          onMouseDown={(e) => { if (canDrag) handleDragStart(e, sess); }}
                        >
                          <div className="text-white text-xs leading-snug truncate">
                            {sess.Script_Title}
                          </div>
                          <div className="text-white/80 text-xs leading-snug truncate">
                            {sess.DM_Stage_Name}
                          </div>
                          <div className="text-white/70 text-[11px] leading-snug mt-0.5">
                            {formatTime(sess.Scheduled_Start_Time)}-{formatTime(sess.Scheduled_End_Time)}
                          </div>
                        </div>
                      );
                    })}

                    {/* Current time indicator — vertical red line */}
                    {selectedDate === today && (() => {
                      const now = new Date();
                      const nowHours = now.getHours() + now.getMinutes() / 60;
                      if (nowHours >= START_HOUR && nowHours < END_HOUR) {
                        return (
                          <div
                            className="absolute top-0 bottom-0 border-l-2 border-red-400 z-20 pointer-events-none"
                            style={{ left: (nowHours - START_HOUR) * HOUR_WIDTH }}
                          >
                            <div className="w-2 h-2 bg-red-400 rounded-full -mt-1 -ml-1" />
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Session count summary */}
      <div className="flex gap-3 text-sm text-gray-500">
        <span>共 {sessions.length} 个场次</span>
        {(['Matching', 'Locked_Ready', 'In_Progress', 'Completed'] as const).map(status => (
          <span key={status} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded" style={{ backgroundColor: SESSION_STATUS_COLOR[status] }} />
            {SESSION_STATUS_LABEL[status]}: {sessions.filter(s => s.Session_Status === status).length}
          </span>
        ))}
      </div>

      {/* Create Session Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCreate(false); setConflict(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">创建新场次</h3>
              <button onClick={() => { setShowCreate(false); setConflict(null); }} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Progress indicator */}
              <div className="flex items-center gap-2 mb-2">
                {['剧本', '时间', '确认'].map((label, i) => (
                  <React.Fragment key={label}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      formStep >= i ? 'bg-accent-purple text-white' : 'bg-gray-100 text-gray-400'
                    }`}>{i + 1}</span>
                    <span className={`text-xs ${formStep >= i ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                    {i < 2 && <span className="flex-1 h-px bg-gray-100" />}
                  </React.Fragment>
                ))}
              </div>

              {formStep === 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">选择剧本</label>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {scripts.filter(s => !s.Is_Retired).map(script => (
                      <button
                        key={script.Script_ID}
                        onClick={() => {
                          setForm({ ...form, Script_ID: script.Script_ID, Frozen_Per_Head_Price: script.Base_Price });
                          setFormStep(1);
                        }}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          form.Script_ID === script.Script_ID
                            ? 'border-accent-purple bg-purple-50'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-800">{script.Script_Title}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5">
                          {GENRES[script.Primary_Genre] || script.Genre_Name} · {script.Min_Required_Players}-{script.Max_Allowed_Players}人 · ¥{script.Base_Price}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">剧本副本</label>
                      <select
                        value={form.Copy_ID}
                        onChange={e => setForm({ ...form, Copy_ID: parseInt(e.target.value) })}
                        className="input-field text-sm"
                      >
                        <option value={0}>选择副本</option>
                        {availableCopies.map(c => (
                          <option key={c.Copy_ID} value={c.Copy_ID}>
                            {c.Copy_Asset_Barcode} ({c.Asset_Condition === 'Perfect' ? '完好' : '轻微磨损'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DM 主持人</label>
                      <select
                        value={form.DM_User_ID}
                        onChange={e => setForm({ ...form, DM_User_ID: parseInt(e.target.value) })}
                        className="input-field text-sm"
                      >
                        <option value={0}>选择 DM</option>
                        {availableDMs.map(dm => (
                          <option key={dm.DM_User_ID} value={dm.DM_User_ID}>
                            {dm.DM_Stage_Name} ({dm.Employment_Status === 'Probation' ? '试用' : '在职'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">房间</label>
                    <select
                      value={form.Room_ID}
                      onChange={e => setForm({ ...form, Room_ID: parseInt(e.target.value) })}
                      className="input-field text-sm"
                    >
                      <option value={0}>选择房间</option>
                      {operationalRooms.map(r => (
                        <option key={r.Room_ID} value={r.Room_ID}>{r.Room_Name} (容量{r.Room_Max_Capacity}人)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                      <input
                        type="datetime-local"
                        value={form.Scheduled_Start_Time ? new Date(form.Scheduled_Start_Time).toISOString().slice(0, 16) : ''}
                        onChange={e => {
                          const d = new Date(e.target.value + ':00Z');
                          setForm({ ...form, Scheduled_Start_Time: d.toISOString() });
                        }}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                      <input
                        type="datetime-local"
                        value={form.Scheduled_End_Time ? new Date(form.Scheduled_End_Time).toISOString().slice(0, 16) : ''}
                        onChange={e => {
                          const d = new Date(e.target.value + ':00Z');
                          setForm({ ...form, Scheduled_End_Time: d.toISOString() });
                        }}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      单人价格 ¥{form.Frozen_Per_Head_Price || (selectedScript?.Base_Price || 0)}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={400}
                      step={10}
                      value={form.Frozen_Per_Head_Price || selectedScript?.Base_Price || 0}
                      onChange={e => setForm({ ...form, Frozen_Per_Head_Price: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[12px] text-gray-400">
                      <span>¥0</span><span>¥400</span>
                    </div>
                  </div>

                  {conflict && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                      ⚠ {conflict}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setFormStep(0)} className="btn-secondary text-sm flex-1">上一步</button>
                    <button onClick={handleCreateSession} disabled={creating} className="btn-primary text-sm flex-1">
                      {creating ? '创建中...' : '确认创建'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Sidebar */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedSession(null)} />
          <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-[slideInRight_0.2s_ease-out]">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">场次详情</h3>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white`}
                  style={{ backgroundColor: SESSION_STATUS_COLOR[selectedSession.Session_Status as keyof typeof SESSION_STATUS_COLOR] }}>
                  {SESSION_STATUS_LABEL[selectedSession.Session_Status as keyof typeof SESSION_STATUS_LABEL]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">剧本</span><p className="font-medium">{selectedSession.Script_Title}</p></div>
                <div><span className="text-gray-400">DM</span><p className="font-medium">{selectedSession.DM_Stage_Name}</p></div>
                <div><span className="text-gray-400">房间</span><p className="font-medium">{selectedSession.Room_Name}</p></div>
                <div><span className="text-gray-400">题材</span><p className="font-medium">{selectedSession.Genre_Name}</p></div>
                <div><span className="text-gray-400">时间</span><p className="font-medium">{formatTime(selectedSession.Scheduled_Start_Time)} - {formatTime(selectedSession.Scheduled_End_Time)}</p></div>
                <div><span className="text-gray-400">单价</span><p className="font-medium text-accent-pink">¥{selectedSession.Frozen_Per_Head_Price}</p></div>
                <div><span className="text-gray-400">参团人数</span><p className="font-medium">{selectedSession.Player_Count ?? 0}/{selectedSession.Max_Allowed_Players}</p></div>
                <div><span className="text-gray-400">最低开局</span><p className="font-medium">{selectedSession.Min_Required_Players}人</p></div>
              </div>
              <div className="flex gap-2 pt-2">
                {selectedSession.Session_Status === 'Matching' && (
                  <button className="btn-warning text-sm flex-1" onClick={async () => {
                    await lockSessionMutation(selectedSession.Session_ID);
                    refresh();
                    setSelectedSession(prev => prev ? { ...prev, Session_Status: 'Locked_Ready' } : null);
                  }}>锁车</button>
                )}
                {selectedSession.Session_Status === 'Locked_Ready' && (
                  <button className="btn-primary text-sm flex-1" onClick={async () => {
                    await startSessionMutation(selectedSession.Session_ID);
                    refresh();
                    setSelectedSession(prev => prev ? { ...prev, Session_Status: 'In_Progress' } : null);
                  }}>开场</button>
                )}
                {selectedSession.Session_Status === 'In_Progress' && (
                  <button className="btn-primary text-sm flex-1" onClick={async () => {
                    await completeSessionMutation(selectedSession.Session_ID);
                    refresh();
                    setSelectedSession(prev => prev ? { ...prev, Session_Status: 'Completed' } : null);
                  }}>结账完成</button>
                )}
                {(selectedSession.Session_Status === 'Matching' || selectedSession.Session_Status === 'Locked_Ready') && (
                  <button className="btn-danger text-sm flex-1" onClick={async () => {
                    await cancelSessionMutation(selectedSession.Session_ID);
                    refresh();
                    setSelectedSession(null);
                  }}>取消场次</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
