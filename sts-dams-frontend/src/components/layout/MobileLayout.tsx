import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '../common/Notification';
import { getCurrentUser, clearAuth } from '../../store/auth';
import { useZoom } from '../../hooks/useZoom';

const dmOnlyItems = [
  { path: '/dm/sessions', label: '我的带场', icon: '🎪' },
  { path: '/dm/shifts', label: '我的排班', icon: '📅' },
  { path: '/dm/earnings', label: '收益汇总', icon: '📊' },
];

const dmExtraItems = [
  { path: '/lobby', label: '拼车大厅', icon: '🎭' },
  { path: '/notifications', label: '消息通知', icon: '🔔' },
];

const playerCommonItems = [
  { path: '/lobby', label: '拼车大厅', icon: '🎭' },
  { path: '/coupons', label: '优惠券', icon: '🎫' },
  { path: '/notifications', label: '消息通知', icon: '🔔' },
  { path: '/profile', label: '个人中心', icon: '👤' },
];

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom();

  const user = getCurrentUser();
  const isDM = user?.Role_Type === 2;
  const isAdmin = user?.Role_Type === 3;
  const isStoreManager = user?.Role_Type === 4;
  const isAdminOrManager = isAdmin || isStoreManager;
  const showDMItems = isDM || isAdmin;
  // DM端：只显示 DM 管理项 + 必要项（拼车大厅、通知），去除优惠券/个人中心/消费相关
  // 玩家端：显示完整通用项
  const commonItems = isDM ? dmExtraItems : playerCommonItems;
  // 移动端底部导航：合并 DM 专属 + 通用项
  const bottomItems = showDMItems ? [...dmOnlyItems, ...(isDM ? dmExtraItems : playerCommonItems)] : playerCommonItems;

  const isActive = (path: string) => {
    if (path === '/lobby') return location.pathname.startsWith('/lobby');
    if (path === '/dm/sessions') return location.pathname.startsWith('/dm/sessions');
    return location.pathname === path;
  };

  const userLabel = isAdmin ? '店长端' : isStoreManager ? '门店管理' : isDM ? 'DM 端' : '玩家端';

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
            <p className="text-[12px] text-gray-400 leading-tight">{userLabel}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* DM 管理区 */}
          {showDMItems && (
            <>
              <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-1 pb-2">
                DM 管理
              </p>
              {dmOnlyItems.map(item => {
                const active = isActive(item.path);
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
              })}
              <div className="border-t border-gray-100 my-2" />
            </>
          )}
          {/* 通用功能区 */}
          {commonItems.map(item => {
            const active = isActive(item.path);
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
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 space-y-2">
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
          {isAdminOrManager && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-accent-purple rounded-lg hover:bg-purple-50 transition-all"
            >
              <span>⚙️</span> {isAdmin ? '返回店长端' : '返回管理端'}
            </button>
          )}
          <button
            onClick={() => { clearAuth(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
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
            <span className="text-[12px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{userLabel}</span>
          </div>
          <NotificationBell />
        </div>

        {/* Mobile slide-out nav */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <div className="fixed left-0 top-0 bottom-0 z-50 w-60 bg-white shadow-xl animate-[slideIn_0.2s_ease-out]">
              <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100">
                <span className="font-bold text-primary text-sm">导航菜单</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-400 text-lg focus-visible:ring-2 focus-visible:ring-purple-500 rounded" aria-label="关闭导航菜单">✕</button>
              </div>
              <nav className="px-2 py-3 space-y-1">
                {/* DM 管理区 */}
                {showDMItems && (
                  <>
                    <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-1 pb-2">
                      DM 管理
                    </p>
                    {dmOnlyItems.map(item => {
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${
                            active ? 'bg-purple-50 text-accent-purple' : 'text-gray-600'
                          }`}
                        >
                          <span className="text-lg">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                    <hr className="border-gray-100 my-2" />
                  </>
                )}
                {/* 通用功能区 */}
                {commonItems.map(item => {
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${
                        active ? 'bg-purple-50 text-accent-purple' : 'text-gray-600'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <hr className="border-gray-100 my-2" />
                {isAdminOrManager && (
                  <button
                    onClick={() => { navigate('/admin/dashboard'); setSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-primary"
                  >
                    <span>⚙️</span> {isAdmin ? '返回店长端' : '返回管理端'}
                  </button>
                )}
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
          {bottomItems.slice(0, 4).map(item => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[60px] focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 rounded ${
                  active ? 'text-accent-purple' : 'text-gray-400'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[12px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
