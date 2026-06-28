import React, { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '../common/Notification';
import { clearAuth, getCurrentUser } from '../../store/auth';
import { useZoom } from '../../hooks/useZoom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  allowedRoles: number[]; // 允许哪些角色看到该项
}

const adminNavItems: NavItem[] = [
  { path: '/admin/dashboard', label: '时空大盘', icon: '🗺️', allowedRoles: [3] },
  { path: '/admin/shifts', label: '排班管理', icon: '📅', allowedRoles: [3, 4] },
  { path: '/admin/inventory', label: '库存管理', icon: '📦', allowedRoles: [3, 4] },
  { path: '/admin/scripts', label: '剧本副本', icon: '📚', allowedRoles: [3, 4] },
  { path: '/admin/reports', label: '数据大屏', icon: '📊', allowedRoles: [3] },
  { path: '/admin/membership/levels', label: '会员等级', icon: '👑', allowedRoles: [3, 4] },
  { path: '/admin/membership/points', label: '积分管理', icon: '💰', allowedRoles: [3, 4] },
  { path: '/admin/coupons/templates', label: '优惠券模板', icon: '🎟️', allowedRoles: [3, 4] },
  { path: '/admin/coupons/issue', label: '发放优惠券', icon: '📬', allowedRoles: [3, 4] },
  { path: '/admin/coupons/usage', label: '核销记录', icon: '📋', allowedRoles: [3, 4] },
  { path: '/admin/coupons/instances', label: '实例查询', icon: '🔍', allowedRoles: [3, 4] },
  { path: '/admin/reviews', label: '评价管理', icon: '⭐', allowedRoles: [3, 4] },
  { path: '/admin/notifications', label: '推送通知', icon: '📢', allowedRoles: [3, 4] },
  { path: '/admin/audit', label: '审计日志', icon: '📋', allowedRoles: [3] },
  { path: '/admin/health', label: '系统健康', icon: '💚', allowedRoles: [3] },
  { path: '/admin/settings', label: '系统配置', icon: '⚙️', allowedRoles: [3] },
];

// 移动端底部导航：各角色最常用的 4-5 项
const mobileShortcuts: Record<number, string[]> = {
  3: ['/admin/dashboard', '/admin/shifts', '/admin/inventory', '/admin/reports', '/admin/coupons/usage'],
  4: ['/admin/dashboard', '/admin/inventory', '/admin/coupons/usage', '/admin/reviews', '/admin/shifts'],
};

const ROLE_LABELS: Record<number, string> = {
  3: '店长端',
  4: '门店管理',
};

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom();

  const user = getCurrentUser();
  const userRole = user?.Role_Type ?? 3;

  // 根据当前角色过滤可见导航项
  const visibleItems = useMemo(
    () => adminNavItems.filter(item => item.allowedRoles.includes(userRole)),
    [userRole],
  );

  // 移动端底部快捷导航
  const mobileItems = useMemo(() => {
    const shortcuts = mobileShortcuts[userRole] || mobileShortcuts[3];
    return shortcuts
      .map(path => visibleItems.find(item => item.path === path))
      .filter(Boolean) as NavItem[];
  }, [visibleItems, userRole]);

  const roleLabel = ROLE_LABELS[userRole] || '店长端';

  const isActive = (path: string) => location.pathname === path;

  const renderNavButton = (item: NavItem, mobileStyle = false) => {
    const active = isActive(item.path);
    if (mobileStyle) {
      return (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded ${
            active ? 'text-accent-purple' : 'text-gray-400'
          }`}
        >
          <span className="text-base">{item.icon}</span>
          <span className="text-2xs font-medium leading-tight">{item.label}</span>
        </button>
      );
    }
    return (
      <button
        key={item.path}
        onClick={() => { navigate(item.path); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${
          active
            ? 'bg-purple-50 text-accent-purple shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <span className="text-lg">{item.icon}</span>
        <span>{item.label}</span>
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-purple" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-base-light">
      {/* Skip-to-content: 无障碍 — Tab 键首个可聚焦元素，跳转到主内容区 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3
                   focus:z-[9999] focus:px-4 focus:py-2 focus:bg-purple-600
                   focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none
                   focus:ring-2 focus:ring-purple-300 focus:ring-offset-2"
      >
        跳转到主内容
      </a>

      {/* ===== Desktop sidebar ===== */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:w-[340px] lg:bg-white lg:border-r lg:border-gray-100 lg:overflow-hidden sidebar-scale">
        <div className="flex items-center gap-2 h-16 px-5 border-b border-gray-100">
          <span className="text-2xl">🎭</span>
          <div>
            <h1 className="text-base font-bold text-primary leading-tight">STS-DAMS</h1>
            <p className="text-2xs text-gray-400 leading-tight">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map(item => renderNavButton(item))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-100 space-y-2">
          {/* 页面缩放控件 */}
          <div className="flex items-center justify-center gap-1 px-1 py-1.5 bg-gray-50 rounded-lg">
            <button
              onClick={zoomOut}
              disabled={zoom <= 0.5}
              className="w-7 h-7 flex items-center justify-center text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1"
              aria-label="缩小页面"
              title="缩小 (Ctrl+-)"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="text-xs text-gray-400 hover:text-gray-600 min-w-[42px] py-0.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1"
              title="重置缩放 (Ctrl+0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={zoom >= 2.0}
              className="w-7 h-7 flex items-center justify-center text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1"
              aria-label="放大页面"
              title="放大 (Ctrl+=)"
            >
              +
            </button>
          </div>
          <NotificationBell />
          <button
            onClick={() => { clearAuth(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
          >
            <span>🚪</span> 退出登录
          </button>
        </div>
      </aside>

      {/* ===== Mobile/Tablet top bar ===== */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 text-gray-500 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded"
              aria-label={sidebarOpen ? '关闭导航菜单' : '打开导航菜单'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-primary">STS-DAMS</h1>
            <span className="text-2xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{roleLabel}</span>
          </div>
          <NotificationBell />
        </div>

        {/* Mobile slide-out nav */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <div className="fixed left-0 top-0 bottom-0 z-50 w-60 bg-white shadow-xl animate-[slideIn_0.2s_ease-out]">
              <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100">
                <span className="font-bold text-primary text-sm">{roleLabel}导航</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-400 text-lg focus-visible:ring-2 focus-visible:ring-purple-500 rounded" aria-label="关闭导航菜单">✕</button>
              </div>
              <nav className="px-2 py-3 space-y-1">
                {visibleItems.map(item => renderNavButton(item))}
                <hr className="border-gray-100 my-2" />
                <button
                  onClick={() => { clearAuth(); setSidebarOpen(false); navigate('/login'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400"
                >
                  <span>🚪</span> 退出登录
                </button>
              </nav>
            </div>
          </>
        )}
      </header>

      {/* ===== Main content ===== */}
      <main id="main-content" className="lg:pl-[340px] zoom-content">
        <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-6 pb-20 lg:pb-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ===== Mobile bottom nav ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-gray-100">
        <div className="flex justify-around items-center h-14">
          {mobileItems.map(item => renderNavButton(item, true))}
        </div>
      </nav>
    </div>
  );
};
