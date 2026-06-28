import React, { useState, useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, GraphChart, GaugeChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, TitleComponent, LegendComponent,
  ToolboxComponent, DataZoomComponent, VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  getDailyKPI, getPlayerLTV, getSocialTopology,
  getRoomUtilization, getSessionStatusDistribution,
  getDmPerformance, getScriptRanking, getGenreRevenue,
} from '../../api/reports';
import type {
  RoomUtilization, SessionStatusDistItem, DmPerformanceItem,
  ScriptRankingItem, GenreRevenueItem,
} from '../../api/reports';
import { EmptyState } from '../../components/common/EmptyState';
import { useDataFetch } from '../../hooks/useDataFetch';
import type { PlayerLTV } from '../../types';

echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, GraphChart, GaugeChart,
  GridComponent, TooltipComponent, TitleComponent, LegendComponent,
  ToolboxComponent, DataZoomComponent, VisualMapComponent,
  CanvasRenderer,
]);

interface DailyKPI {
  Snapshot_ID: number;
  Snapshot_Date: string;
  Total_Sessions: number;
  Completed_Sessions: number;
  Aborted_Sessions: number;
  Total_Revenue_Script: number;
  Total_Revenue_Consumption: number;
  Total_Refund: number;
  Active_Players: number;
  New_Registrations: number;
}

interface SocialEdge {
  Player_A_ID: number;
  Player_B_ID: number;
  Account_A_Name: string;
  Account_B_Name: string;
  Co_Play_Count: number;
}

interface ReportDataSet {
  kpi: DailyKPI[] | null;
  ltv: PlayerLTV[] | null;
  social: SocialEdge[] | null;
}

/** 大屏图表数据集（API 优先） */
interface DashboardDataSet {
  roomUtil: RoomUtilization | null;
  sessionStatus: SessionStatusDistItem[] | null;
  dmPerf: DmPerformanceItem[] | null;
  scriptRank: ScriptRankingItem[] | null;
  genreRev: GenreRevenueItem[] | null;
}

const CHART_COLORS = ['#7c5ce0', '#5b8def', '#50c878', '#f0a050', '#e08585', '#e04040', '#2c3e6b', '#ff9f7f'];

const STATUS_COLOR_MAP: Record<string, string> = {
  'Matching': '#5b8def',
  'Locked_Ready': '#f0a050',
  'In_Progress': '#50c878',
  'Completed': '#7c5ce0',
  'Aborted': '#e04040',
};
const STATUS_LABEL_MAP: Record<string, string> = {
  'Matching': '拼车中',
  'Locked_Ready': '已锁车',
  'In_Progress': '进行中',
  'Completed': '已完成',
  'Aborted': '已取消',
};

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string; trend?: number }> = ({ label, value, sub, color, trend }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
    <p className="text-xs text-gray-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-800'}`}>{value}</p>
    {sub && <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>}
    {trend !== undefined && (
      <p className={`text-[12px] mt-0.5 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% 环比
      </p>
    )}
  </div>
);

export const AdminReportsPage: React.FC = () => {
  const [tab, setTab] = useState<'dashboard' | 'social' | 'ltv'>('dashboard');

  /** Load API data */
  const { data: reportData, loading: dataLoading } = useDataFetch<ReportDataSet>({
    fetcher: (_signal: AbortSignal) =>
      Promise.all([
        getDailyKPI(),
        getPlayerLTV(),
        getSocialTopology(),
      ]).then(([kpi, ltv, social]) => ({ kpi, ltv, social })),
  });

  /** 大屏图表数据集 — 5 个新报表端点 */
  const { data: dashData } = useDataFetch<DashboardDataSet>({
    fetcher: (_signal: AbortSignal) =>
      Promise.all([
        getRoomUtilization(),
        getSessionStatusDistribution(),
        getDmPerformance(),
        getScriptRanking(undefined, undefined, 8),
        getGenreRevenue(),
      ]).then(([roomUtil, sessionStatus, dmPerf, scriptRank, genreRev]) => ({
        roomUtil, sessionStatus, dmPerf, scriptRank, genreRev,
      })),
  });

  const apiKpis = reportData?.kpi || [];
  const apiLtv = reportData?.ltv || [];
  const apiSocial = reportData?.social || [];

  // ====== Computed KPIs (API) ======
  const kpis = useMemo(() => {
    if (apiKpis.length > 0) {
      const today = apiKpis[apiKpis.length - 1];
      const yesterday = apiKpis.length > 1 ? apiKpis[apiKpis.length - 2] : null;
      const totalRevenue = apiKpis.reduce((sum, d) => sum + d.Total_Revenue_Script + d.Total_Revenue_Consumption, 0);
      const todayRevenue = today.Total_Revenue_Script + today.Total_Revenue_Consumption;
      const yesterdayRevenue = yesterday ? yesterday.Total_Revenue_Script + yesterday.Total_Revenue_Consumption : 0;
      return {
        todayRevenue,
        totalRevenue,
        todaySessions: today.Total_Sessions,
        todayCompleted: today.Completed_Sessions,
        totalPlayers: today.Active_Players,
        completionRate: today.Total_Sessions > 0 ? ((today.Completed_Sessions / today.Total_Sessions) * 100) : 0,
        revenueTrend: yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0,
      };
    }
    return { todayRevenue: 0, totalRevenue: 0, todaySessions: 0, todayCompleted: 0, totalPlayers: 0, completionRate: 0, revenueTrend: 0 };
  }, [apiKpis]);

  // ====== 1. 营收仪表盘 (Gauge) ======
  const gaugeOption = useMemo(() => ({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      center: ['50%', '60%'],
      radius: '90%',
      min: 0,
      max: 10000,
      splitNumber: 10,
      axisLine: { show: true, lineStyle: { width: 18, color: [[0.3, '#50c878'], [0.7, '#f0a050'], [1, '#e04040']] } },
      pointer: { length: '70%', width: 6, itemStyle: { color: '#2c3e6b' } },
      detail: { valueAnimation: true, formatter: '{value}', color: '#2c3e6b', fontSize: 22, offsetCenter: [0, '80%'] },
      data: [{ value: kpis.todayRevenue, name: '今日营收 (¥)' }],
      axisLabel: { color: '#999', fontSize: 10, formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}` },
      title: { offsetCenter: [0, '-15%'], color: '#666', fontSize: 13 },
    }],
  }), [kpis.todayRevenue]);

  // ====== 2. 近30天营收双线折线图 ======
  const lineOption = useMemo(() => {
    const days: string[] = [];
    const scriptData: number[] = [];
    const consumptionData: number[] = [];

    if (apiKpis.length > 0) {
      const last30 = apiKpis.slice(-30);
      for (const d of last30) {
        const date = new Date(d.Snapshot_Date);
        days.push(`${date.getMonth() + 1}/${date.getDate()}`);
        scriptData.push(d.Total_Revenue_Script);
        consumptionData.push(d.Total_Revenue_Consumption);
      }
    }
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['剧本收入', '消费品收入'], textStyle: { color: '#999', fontSize: 11 }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '30px', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: days, axisLabel: { color: '#999', fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { color: '#999', fontSize: 10, formatter: '¥{value}' }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
      series: [
        { name: '剧本收入', type: 'line', data: scriptData, smooth: true, lineStyle: { color: '#7c5ce0', width: 2 }, itemStyle: { color: '#7c5ce0' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(124,92,224,0.25)' }, { offset: 1, color: 'rgba(124,92,224,0.02)' }]) } },
        { name: '消费品收入', type: 'line', data: consumptionData, smooth: true, lineStyle: { color: '#f0a050', width: 2 }, itemStyle: { color: '#f0a050' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(240,160,80,0.25)' }, { offset: 1, color: 'rgba(240,160,80,0.02)' }]) } },
      ],
    };
  }, [apiKpis]);

  // ====== 3. 场次状态分布饼图 (API) ======
  const pieOption = useMemo(() => {
    let statusData: { name: string; value: number; color: string }[];

    if (dashData?.sessionStatus && dashData.sessionStatus.length > 0) {
      statusData = dashData.sessionStatus.map(d => ({
        name: STATUS_LABEL_MAP[d.Session_Status] || d.Session_Status,
        value: d.Count,
        color: STATUS_COLOR_MAP[d.Session_Status] || '#a0b4d0',
      })).filter(d => d.value > 0);
    } else {
      statusData = [];
    }

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} 场 ({d}%)' },
      legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: '#999', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      series: [{
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'inside', formatter: '{d}%', fontSize: 11, fontWeight: 'bold' },
        emphasis: { label: { fontSize: 14, fontWeight: 'bold' }, scaleSize: 8 },
        data: statusData.map(d => ({ ...d, itemStyle: { color: d.color } })),
      }],
    };
  }, [dashData?.sessionStatus]);

  // ====== 4. DM 绩效柱状图 (API) ======
  const dmBarOption = useMemo(() => {
    let dmPerformance: { name: string; completed: number; inProgress: number }[];

    if (dashData?.dmPerf && dashData.dmPerf.length > 0) {
      dmPerformance = dashData.dmPerf.map(d => ({
        name: d.DM_Stage_Name,
        completed: d.Completed_Sessions,
        inProgress: d.Active_Sessions,
      }));
    } else {
      dmPerformance = [];
    }

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['已完成', '进行中'], textStyle: { color: '#999', fontSize: 10 }, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '30px', containLabel: true },
      xAxis: { type: 'category', data: dmPerformance.map(d => d.name), axisLabel: { color: '#999', fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { color: '#999', fontSize: 10 }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
      series: [
        { name: '已完成', type: 'bar', data: dmPerformance.map(d => d.completed), itemStyle: { color: '#7c5ce0', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
        { name: '进行中', type: 'bar', data: dmPerformance.map(d => d.inProgress), itemStyle: { color: '#f0a050', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 },
      ],
    };
  }, [dashData?.dmPerf]);

  // ====== 5. 热门剧本横向柱状图 (API) ======
  const scriptBarOption = useMemo(() => {
    let scriptData: { name: string; count: number; revenue: number }[];

    if (dashData?.scriptRank && dashData.scriptRank.length > 0) {
      scriptData = dashData.scriptRank.map(d => ({
        name: d.Script_Title,
        count: d.Session_Count,
        revenue: d.Total_Revenue,
      }));
    } else {
      scriptData = [];
    }

    // Sort by count ascending for horizontal bar display (inverse y-axis)
    const sorted = [...scriptData].sort((a, b) => a.count - b.count);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => `${p[0].name}<br/>场次: ${p[0].value}<br/>营收: ¥${scriptData.find(d => d.name === p[0].name)?.revenue || 0}` },
      grid: { left: '3%', right: '12%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: { type: 'value', axisLabel: { color: '#999', fontSize: 10 }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
      yAxis: { type: 'category', data: sorted.map(d => d.name), axisLabel: { color: '#666', fontSize: 10 }, inverse: true },
      series: [{
        type: 'bar',
        data: sorted.map((d, i) => ({ value: d.count, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] } })),
        barMaxWidth: 24,
        label: { show: true, position: 'right', color: '#999', fontSize: 10, formatter: '{c} 场' },
      }],
    };
  }, [dashData?.scriptRank]);

  // ====== 6. 题材营收占比 (环形图, API) ======
  const genrePieOption = useMemo(() => {
    let data: { name: string; value: number }[];

    if (dashData?.genreRev && dashData.genreRev.length > 0) {
      data = dashData.genreRev.map(d => ({ name: d.Genre_Name, value: d.Revenue }));
    } else {
      data = [];
    }

    return {
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { bottom: 0, textStyle: { color: '#999', fontSize: 10 }, itemWidth: 8, itemHeight: 8 },
      series: [{
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '45%'],
        data: data.map((d, i) => ({ ...d, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } })),
        label: { formatter: '{b}\n{d}%', fontSize: 10, color: '#666' },
        emphasis: { scaleSize: 6 },
      }],
    };
  }, [dashData?.genreRev]);

  // ====== 6.5. 房间利用率柱状图 (API) ======
  const roomUtilOption = useMemo(() => {
    let rooms: { name: string; utilization: number; sessions: number }[];

    if (dashData?.roomUtil && dashData.roomUtil.rooms.length > 0) {
      rooms = dashData.roomUtil.rooms.map(r => ({
        name: r.room_name,
        utilization: r.utilization_pct,
        sessions: r.total_sessions,
      }));
    } else {
      rooms = [];
    }

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => `${p[0].name}<br/>利用率: ${p[0].value}%<br/>${rooms.find(r => r.name === p[0].name)?.sessions || 0} 场` },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: { type: 'category', data: rooms.map(r => r.name), axisLabel: { color: '#999', fontSize: 10, rotate: 20 } },
      yAxis: { type: 'value', axisLabel: { color: '#999', fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
      series: [{
        type: 'bar',
        data: rooms.map((r, i) => ({
          value: r.utilization,
          itemStyle: {
            color: r.utilization > 60 ? '#50c878' : r.utilization > 30 ? '#f0a050' : '#e08585',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 40,
        label: { show: true, position: 'top', color: '#999', fontSize: 10, formatter: '{c}%' },
      }],
    };
  }, [dashData?.roomUtil]);

  // ====== 7. 社交拓扑力导向图 ======
  const socialGraphOption = useMemo(() => {
    if (apiSocial.length > 0) {
      // Build name map from edges
      const nameMap = new Map<number, string>();
      for (const e of apiSocial) {
        if (!nameMap.has(e.Player_A_ID)) nameMap.set(e.Player_A_ID, e.Account_A_Name);
        if (!nameMap.has(e.Player_B_ID)) nameMap.set(e.Player_B_ID, e.Account_B_Name);
      }

      const playerIds = new Set<number>();
      for (const e of apiSocial) {
        playerIds.add(e.Player_A_ID);
        playerIds.add(e.Player_B_ID);
      }
      const nodes = Array.from(playerIds).slice(0, 20).map(id => {
        const edgeCount = apiSocial.filter(e => e.Player_A_ID === id || e.Player_B_ID === id)
          .reduce((s, e) => s + e.Co_Play_Count, 0);
        const category = edgeCount > 10 ? 0 : edgeCount > 5 ? 1 : 2;
        return {
          id: String(id),
          name: nameMap.get(id) || `玩家#${id}`,
          symbolSize: Math.max(edgeCount * 3 + 14, 20),
          value: edgeCount * 100,
          category,
          itemStyle: { color: ['#7c5ce0', '#5b8def', '#a0b4d0'][category] },
          label: { show: true, fontSize: 9, color: '#555', position: 'bottom' as const, distance: 4 },
        };
      });
      const links = apiSocial.slice(0, 30).map(e => ({
        source: String(e.Player_A_ID),
        target: String(e.Player_B_ID),
        value: e.Co_Play_Count,
        lineStyle: { width: e.Co_Play_Count >= 3 ? 2.5 : 1, color: e.Co_Play_Count >= 3 ? '#7c5ce0' : '#d0d0d0', curveness: 0.2 },
      }));
      return {
        tooltip: { formatter: (p: any) => p.dataType === 'node' ? `${p.name}<br/>共玩次数: ${p.value / 100}` : `共玩 ${p.value} 次` },
        legend: { data: ['高价值', '中价值', '普通'], bottom: 0, textStyle: { color: '#999', fontSize: 10 }, itemWidth: 8, itemHeight: 8 },
        series: [{
          type: 'graph',
          layout: 'force',
          force: { repulsion: 280, edgeLength: [100, 200], gravity: 0.12 },
          roam: true,
          draggable: true,
          data: nodes,
          links,
          categories: [{ name: '高价值' }, { name: '中价值' }, { name: '普通' }],
          emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        }],
      };
    }
    // Return empty graph when no data
    return {
      series: [{
        type: 'graph',
        layout: 'force',
        data: [],
        links: [],
      }],
    };
  }, [apiSocial]);

  // ====== 8. LTV 散点图 ======
  const ltvScatterOption = useMemo(() => {
    if (apiLtv.length > 0) {
      const ltvData = apiLtv.map(a => ({
        name: a.Account_Name,
        sessions: a.Total_Sessions_Attended || 0,
        spent: a.Total_Spent_Script + a.Total_Spent_Consumption,
        tier: a.Total_Spent_Script + a.Total_Spent_Consumption > 2000 ? '高价值' :
              a.Total_Spent_Script + a.Total_Spent_Consumption > 1000 ? '中价值' : '普通',
      }));
      return {
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => `${p.name}<br/>参团: ${p.value[0]} 次<br/>消费: ¥${p.value[1]}`,
        },
        grid: { left: '8%', right: '5%', bottom: '8%', top: '5%' },
        xAxis: { name: '参团次数', nameTextStyle: { color: '#999', fontSize: 11 }, type: 'value', axisLabel: { color: '#999', fontSize: 10 }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
        yAxis: { name: '累计消费 (¥)', nameTextStyle: { color: '#999', fontSize: 11 }, type: 'value', axisLabel: { color: '#999', fontSize: 10, formatter: '¥{value}' }, splitLine: { lineStyle: { color: '#f0f0f0' } } },
        visualMap: {
          min: 0, max: 3000, orient: 'horizontal', bottom: 0, left: 'center',
          text: ['高', '低'], textStyle: { color: '#999', fontSize: 10 },
          inRange: { color: ['#e8e0f8', '#b8a4e8', '#7c5ce0'] },
          itemWidth: 10, itemHeight: 100,
        },
        series: [
          { name: '高价值', type: 'scatter', data: ltvData.filter(d => d.tier === '高价值').map(d => [d.sessions, d.spent, d.name]), symbolSize: (v: number[]) => Math.sqrt(v[1]) * 0.8 + 8, itemStyle: { color: '#7c5ce0' }, emphasis: { scale: 1.5 } },
          { name: '中价值', type: 'scatter', data: ltvData.filter(d => d.tier === '中价值').map(d => [d.sessions, d.spent, d.name]), symbolSize: (v: number[]) => Math.sqrt(v[1]) * 0.8 + 8, itemStyle: { color: '#5b8def' }, emphasis: { scale: 1.5 } },
          { name: '普通', type: 'scatter', data: ltvData.filter(d => d.tier === '普通').map(d => [d.sessions, d.spent, d.name]), symbolSize: (v: number[]) => Math.sqrt(v[1]) * 0.8 + 8, itemStyle: { color: '#a0b4d0' }, emphasis: { scale: 1.5 } },
        ],
      };
    }
    return {
      grid: { left: '8%', right: '5%', bottom: '8%', top: '5%' },
      xAxis: { name: '参团次数', nameTextStyle: { color: '#999', fontSize: 11 }, type: 'value', axisLabel: { color: '#999', fontSize: 10 } },
      yAxis: { name: '累计消费 (¥)', nameTextStyle: { color: '#999', fontSize: 11 }, type: 'value', axisLabel: { color: '#999', fontSize: 10 } },
      series: [],
    };
  }, [apiLtv]);

  // ====== LTV 表格数据 ======
  const ltvTableData = useMemo(() => {
    if (apiLtv.length > 0) {
      return apiLtv.map(a => {
        const totalSpent = a.Total_Spent_Script + a.Total_Spent_Consumption;
        const sessions = a.Total_Sessions_Attended || 0;
        const avg = sessions > 0 ? Math.round(totalSpent / sessions) : 0;
        const tier = totalSpent >= 2000 ? '高价值' : totalSpent >= 1000 ? '中价值' : sessions <= 2 ? '新用户' : '普通';
        return { name: a.Account_Name, sessions, totalSpent, avg, tier };
      }).sort((a, b) => b.totalSpent - a.totalSpent);
    }
    return [];
  }, [apiLtv]);

  const chartStyle = "bg-white rounded-xl border border-gray-100 shadow-sm p-4";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">数据大屏</h2>
          <p className="text-sm text-gray-400 mt-0.5">ECharts 可视化 · 营收分析 · 社交拓扑 · LTV 散点</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { key: 'dashboard' as const, label: '经营大盘' },
            { key: 'social' as const, label: '社交拓扑' },
            { key: 'ltv' as const, label: 'LTV 分析' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="今日营收" value={`¥${kpis.todayRevenue.toLocaleString()}`} sub={`${kpis.todayCompleted} 场完成`} color="text-accent-pink" trend={kpis.revenueTrend} />
            <StatCard label="累计营收" value={`¥${kpis.totalRevenue.toLocaleString()}`} sub="全部已完成场次" color="text-gray-800" />
            <StatCard label="今日场次" value={kpis.todaySessions} sub={`${kpis.todayCompleted} 完成`} color="text-accent-purple" />
            <StatCard label="注册玩家" value={kpis.totalPlayers} sub="累计注册" color="text-primary" />
            <StatCard label="完成率" value={`${kpis.completionRate.toFixed(0)}%`} sub="已完成 / 总场次" color="text-green-500" />
          </div>

          {/* Row 1: Gauge + Line Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={chartStyle}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">营收仪表盘</h4>
              <ReactEChartsCore echarts={echarts} option={gaugeOption} style={{ height: 240 }} notMerge />
            </div>
            <div className={`${chartStyle} lg:col-span-2`}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">近 30 天营收趋势</h4>
              <ReactEChartsCore echarts={echarts} option={lineOption} style={{ height: 240 }} notMerge />
            </div>
          </div>

          {/* Row 2: Session Status Pie + Room Utilization Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={chartStyle}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">场次状态分布</h4>
              <ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 260 }} notMerge />
            </div>
            <div className={chartStyle}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">房间利用率</h4>
              <p className="text-xs text-gray-400 mb-2">
                {dashData?.roomUtil
                  ? `整体利用率 ${dashData.roomUtil.overall_utilization_pct}% · ${dashData.roomUtil.total_rooms} 个房间`
                  : '16h 日运营 × 30 天窗口'}
              </p>
              <ReactEChartsCore echarts={echarts} option={roomUtilOption} style={{ height: 240 }} notMerge />
            </div>
          </div>

          {/* Row 3: Genre Pie + DM Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={chartStyle}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">各题材营收占比</h4>
              <ReactEChartsCore echarts={echarts} option={genrePieOption} style={{ height: 260 }} notMerge />
            </div>
            <div className={chartStyle}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">DM 带场绩效</h4>
              <ReactEChartsCore echarts={echarts} option={dmBarOption} style={{ height: 260 }} notMerge />
            </div>
          </div>

          {/* Row 4: Script Ranking Bar */}
          <div className={chartStyle}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">热门剧本排行</h4>
            <ReactEChartsCore echarts={echarts} option={scriptBarOption} style={{ height: 280 }} notMerge />
          </div>
        </div>
      )}

      {tab === 'social' && (
        <div className="space-y-4">
          <div className={chartStyle}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">社交拓扑网络（力导向图）</h4>
            <p className="text-xs text-gray-400 mb-3">
              节点大小 = 消费金额，连线粗度 = 共玩次数。紫色连线 (≥3次) 标记"核心熟人小团体"，可推送定向优惠。
            </p>
            <ReactEChartsCore echarts={echarts} option={socialGraphOption} style={{ height: 420 }} notMerge />
          </div>
        </div>
      )}

      {tab === 'ltv' && (
        <div className="space-y-4">
          <div className={chartStyle}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">用户 LTV 散点图</h4>
            <p className="text-xs text-gray-400 mb-3">X 轴 = 参团次数，Y 轴 = 累计消费。气泡大小 = 消费金额</p>
            <ReactEChartsCore echarts={echarts} option={ltvScatterOption} style={{ height: 380 }} notMerge />
          </div>

          <div className={chartStyle}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">用户 LTV 分层明细</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">玩家</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">累计参团</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">累计消费</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">平均客单价</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs">价值分层</th>
                  </tr>
                </thead>
                <tbody>
                  {ltvTableData.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="px-4 py-2 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">{p.sessions}</td>
                      <td className="px-4 py-2 text-right font-mono text-accent-pink">¥{p.totalSpent.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">¥{p.avg}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-[12px] px-2 py-0.5 rounded ${
                          p.tier === '高价值' ? 'bg-purple-50 text-purple-600 font-medium' :
                          p.tier === '中价值' ? 'bg-blue-50 text-blue-600' :
                          p.tier === '新用户' ? 'bg-orange-50 text-orange-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>{p.tier}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Churn warning */}
          <div className={chartStyle}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">流失预警</h4>
            <p className="text-xs text-gray-400 mb-3">距上次参团 &gt; 30 天 + 历史消费 &gt; ¥500 的玩家</p>
            {ltvTableData.filter(p => p.sessions <= 3 && p.totalSpent > 500).length === 0 ? (
              <p className="text-sm text-gray-400">当前无流失预警用户</p>
            ) : (
              <div className="space-y-2">
                {ltvTableData.filter(p => p.sessions <= 3 && p.totalSpent > 500).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 py-2">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="text-orange-500 text-xs">流失风险 · {p.sessions}场 · ¥{p.totalSpent}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
