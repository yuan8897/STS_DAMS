import React, { useEffect, useState, useCallback } from 'react';
import { useDataFetch } from '../../hooks/useDataFetch';
import { getHealthDetailed, getHealthQuick, type HealthDetailed, type HealthQuick } from '../../api/health';
import { Loading } from '../../components/common/Loading';
import { ErrorState } from '../../components/common/ErrorState';

// ==================== 状态指示灯 ====================

const StatusDot: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
    ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  }`}>
    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
    {label}
  </span>
);

// ==================== 系统信息卡片 ====================

const InfoCard: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <span>{icon}</span> {title}
    </h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string | number; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-400">{label}</span>
    <span className={`font-medium text-gray-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

// ==================== 主页面 ====================

const AdminHealthPage: React.FC = () => {
  const [quickData, setQuickData] = useState<HealthQuick | null>(null);
  const [quickError, setQuickError] = useState(false);

  // 快速健康检查 (每 30 秒刷新)
  useEffect(() => {
    const fetchQuick = async () => {
      try {
        const data = await getHealthQuick();
        setQuickData(data);
        setQuickError(false);
      } catch {
        setQuickError(true);
      }
    };
    fetchQuick();
    const interval = setInterval(fetchQuick, 30000);
    return () => clearInterval(interval);
  }, []);

  // 详细健康检查
  const fetcher = useCallback((signal: AbortSignal) => getHealthDetailed(), []);

  const { data, loading, error, refresh } = useDataFetch({
    fetcher,
    refreshInterval: 60000,
  });

  const isHealthy = quickData?.status === 'healthy';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">💚 系统健康</h2>
          <p className="text-sm text-gray-400 mt-1">服务器状态、数据库连接、系统资源监控</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
            isHealthy ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <span className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {isHealthy ? '系统正常' : '系统异常'}
          </span>
          {!loading && (
            <button onClick={refresh} className="text-sm text-gray-400 hover:text-gray-600">
              🔄 刷新
            </button>
          )}
        </div>
      </div>

      {/* 快速状态卡片 */}
      {quickData && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={`rounded-xl border p-4 ${quickData.checks.database ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500 mb-1">数据库</p>
            <StatusDot ok={quickData.checks.database} label={quickData.checks.database ? '已连接' : '断开'} />
          </div>
          <div className={`rounded-xl border p-4 ${quickData.checks.websocket ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500 mb-1">WebSocket</p>
            <StatusDot ok={quickData.checks.websocket} label={quickData.checks.websocket ? '运行中' : '异常'} />
          </div>
          <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
            <p className="text-xs text-gray-500 mb-1">运行时间</p>
            <p className="text-sm font-bold text-blue-700">{quickData.checks.uptime}</p>
          </div>
        </div>
      )}

      {loading && <Loading text="加载详细健康信息..." />}
      {error && <ErrorState message="加载健康信息失败" onRetry={refresh} />}

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 数据库信息 */}
          <InfoCard title="数据库" icon="🗄️">
            <InfoRow label="数据库名" value={data.database.name} mono />
            <InfoRow label="恢复模式" value={data.database.recoveryModel} />
            <InfoRow label="表数量" value={data.database.tables} />
            <InfoRow label="触发器" value={data.database.triggers} />
            <InfoRow label="视图" value={data.database.views} />
            <InfoRow label="预估行数" value={data.database.estimatedRows.toLocaleString()} />
            <InfoRow label="活跃连接" value={data.database.activeConnections} />
            <div className="mt-2 pt-2 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-2">数据文件</p>
              {data.database.files.map((f, i) => (
                <InfoRow key={i} label={f.FileName} value={`${f.SizeMB} MB (${f.FileType})`} />
              ))}
            </div>
          </InfoCard>

          {/* 系统资源 */}
          <InfoCard title="系统资源" icon="💻">
            <InfoRow label="平台" value={`${data.system.platform} / ${data.system.arch}`} />
            <InfoRow label="Node.js" value={data.system.nodeVersion} mono />
            <InfoRow label="CPU 核心" value={data.system.cpus} />
            <InfoRow label="总内存" value={`${data.system.totalMemoryMB} MB`} />
            <InfoRow label="可用内存" value={`${data.system.freeMemoryMB} MB`} />
            <InfoRow label="系统内存使用" value={`${data.system.memoryUsagePercent}%`} />
            <InfoRow label="进程内存" value={`${data.system.processMemoryMB} MB`} />
            <InfoRow label="进程运行时间" value={data.system.uptime} />
          </InfoCard>

          {/* 连接池 */}
          <InfoCard title="数据库连接池" icon="🔗">
            <InfoRow label="连接池大小" value={String(data.pool.size)} />
            <InfoRow label="可用连接" value={String(data.pool.available)} />
            <InfoRow label="等待请求" value={String(data.pool.pending)} />
            <InfoRow label="已借出" value={String(data.pool.borrowed)} />
          </InfoCard>

          {/* WebSocket */}
          <InfoCard title="实时连接 (WebSocket)" icon="📡">
            <InfoRow label="在线用户数" value={data.websocket.total_users} />
            <InfoRow label="总连接数" value={data.websocket.total_connections} />
          </InfoCard>

          {/* 告警信息 */}
          <div className="md:col-span-2">
            <InfoCard title="告警信息" icon="🔔">
              {data.alerts.count === 0 ? (
                <p className="text-sm text-green-600">✅ {data.alerts.message}</p>
              ) : (
                <div>
                  <p className="text-sm text-orange-600 mb-2">⚠️ {data.alerts.message}</p>
                  <p className="text-xs text-gray-400">
                    共 {data.alerts.count} 条异常记录，请查看审计日志了解详情
                  </p>
                </div>
              )}
            </InfoCard>
          </div>

          {/* 时间戳 */}
          <div className="md:col-span-2 text-center">
            <p className="text-xs text-gray-400">
              数据获取时间: {new Date(data.timestamp).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHealthPage;
