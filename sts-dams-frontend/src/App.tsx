import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Loading } from './components/common/Loading';
import { AppLayout } from './components/layout/MobileLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoginPage } from './pages/login/LoginPage';
import { RegisterPage } from './pages/login/RegisterPage';
import { LobbyPage } from './pages/lobby/LobbyPage';
import { SessionDetail } from './pages/lobby/SessionDetail';
import { PickRolePage } from './pages/lobby/PickRolePage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { CouponsPage } from './pages/coupons/CouponsPage';
import { ReviewPage } from './pages/reviews/ReviewPage';
import { DmSessionsPage } from './pages/dm/DmSessionsPage';
import { DmSessionDetail } from './pages/dm/DmSessionDetail';
import { DmShiftsPage } from './pages/dm/DmShiftsPage';
import { PlayerNotificationsPage } from './pages/notifications/PlayerNotificationsPage';
import { isLoggedIn, getCurrentUser } from './store/auth';

// 代码分割：Admin 页面（含 ECharts ~1MB）按需加载
// 使用 then() 适配 named export → default export
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminShiftsPage = lazy(() => import('./pages/admin/AdminShiftsPage').then(m => ({ default: m.AdminShiftsPage })));
const AdminInventoryPage = lazy(() => import('./pages/admin/AdminInventoryPage').then(m => ({ default: m.AdminInventoryPage })));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then(m => ({ default: m.AdminReportsPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const MemberLevelsPage = lazy(() => import('./pages/admin/membership/MemberLevelsPage').then(m => ({ default: m.MemberLevelsPage })));
const MemberPointsPage = lazy(() => import('./pages/admin/membership/MemberPointsPage').then(m => ({ default: m.MemberPointsPage })));
const CouponTemplatesPage = lazy(() => import('./pages/admin/coupons/CouponTemplatesPage').then(m => ({ default: m.CouponTemplatesPage })));
const CouponIssuePage = lazy(() => import('./pages/admin/coupons/CouponIssuePage').then(m => ({ default: m.CouponIssuePage })));
const CouponUsagePage = lazy(() => import('./pages/admin/coupons/CouponUsagePage').then(m => ({ default: m.CouponUsagePage })));
const AdminCouponInstancesPage = lazy(() => import('./pages/admin/coupons/AdminCouponInstancesPage').then(m => ({ default: m.AdminCouponInstancesPage })));
const AdminReviewsPage = lazy(() => import('./pages/admin/reviews/AdminReviewsPage').then(m => ({ default: m.AdminReviewsPage })));
const DMReviewDetailPage = lazy(() => import('./pages/admin/reviews/DMReviewDetailPage').then(m => ({ default: m.DMReviewDetailPage })));
const AdminNotificationsPage = lazy(() => import('./pages/admin/notifications/AdminNotificationsPage').then(m => ({ default: m.AdminNotificationsPage })));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminHealthPage = lazy(() => import('./pages/admin/AdminHealthPage'));
const AdminScriptCopiesPage = lazy(() => import('./pages/admin/AdminScriptCopiesPage').then(m => ({ default: m.AdminScriptCopiesPage })));
const DmEarningsPage = lazy(() => import('./pages/dm/DmEarningsPage').then(m => ({ default: m.DmEarningsPage })));

const ROLE_HOME: Record<number, string> = {
  1: '/lobby',
  2: '/dm/sessions',
  3: '/admin/dashboard',
  4: '/admin/inventory', // Store_Manager 默认进入库存管理
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isLoggedIn()) {
    const user = getCurrentUser();
    const home = user?.Role_Type ? ROLE_HOME[user.Role_Type] : '/lobby';
    if (home) return <Navigate to={home} replace />;
    return <Navigate to="/lobby" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastContainer />
      <ErrorBoundary>
      <Routes>
        {/* Login/Register — redirect to home if already logged in */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Admin only routes — 仅店长 (Role_Type=3) 可访问 */}
        <Route element={<ProtectedRoute allowedRoles={[3]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/reports" element={<Suspense fallback={<Loading />}><AdminReportsPage /></Suspense>} />
            <Route path="/admin/settings" element={<Suspense fallback={<Loading />}><AdminSettingsPage /></Suspense>} />
            <Route path="/admin/audit" element={<Suspense fallback={<Loading />}><AdminAuditPage /></Suspense>} />
            <Route path="/admin/health" element={<Suspense fallback={<Loading />}><AdminHealthPage /></Suspense>} />
          </Route>
        </Route>

        {/* Admin + Store_Manager shared dashboard (dashboard shows different views per role) */}
        <Route element={<ProtectedRoute allowedRoles={[3, 4]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<Suspense fallback={<Loading />}><AdminDashboardPage /></Suspense>} />
          </Route>
        </Route>

        {/* Player/DM/Admin/Store_Manager shared routes — any authenticated user */}
        <Route element={<ProtectedRoute allowedRoles={[1, 2, 3, 4]} />}>
          <Route element={<AppLayout />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/lobby/session/:sessionId" element={<SessionDetail />} />
            <Route path="/lobby/session/:sessionId/pick-role" element={<PickRolePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/review/:sessionId" element={<ReviewPage />} />
            <Route path="/notifications" element={<PlayerNotificationsPage />} />
          </Route>
        </Route>

        {/* DM + Admin + Store_Manager 专属路由 — DM / 店长 / 门店管理员 */}
        <Route element={<ProtectedRoute allowedRoles={[2, 3, 4]} />}>
          <Route element={<AppLayout />}>
            <Route path="/dm/sessions" element={<DmSessionsPage />} />
            <Route path="/dm/sessions/:sessionId" element={<DmSessionDetail />} />
            <Route path="/dm/shifts" element={<DmShiftsPage />} />
            <Route path="/dm/earnings" element={<Suspense fallback={<Loading />}><DmEarningsPage /></Suspense>} />
          </Route>
        </Route>

        {/* Store_Manager + Admin 管理路由 — 门店管理员和店长 */}
        <Route element={<ProtectedRoute allowedRoles={[3, 4]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/inventory" element={<Suspense fallback={<Loading />}><AdminInventoryPage /></Suspense>} />
            <Route path="/admin/shifts" element={<Suspense fallback={<Loading />}><AdminShiftsPage /></Suspense>} />
            <Route path="/admin/membership/levels" element={<Suspense fallback={<Loading />}><MemberLevelsPage /></Suspense>} />
            <Route path="/admin/membership/points" element={<Suspense fallback={<Loading />}><MemberPointsPage /></Suspense>} />
            <Route path="/admin/coupons/templates" element={<Suspense fallback={<Loading />}><CouponTemplatesPage /></Suspense>} />
            <Route path="/admin/coupons/issue" element={<Suspense fallback={<Loading />}><CouponIssuePage /></Suspense>} />
            <Route path="/admin/coupons/usage" element={<Suspense fallback={<Loading />}><CouponUsagePage /></Suspense>} />
            <Route path="/admin/coupons/instances" element={<Suspense fallback={<Loading />}><AdminCouponInstancesPage /></Suspense>} />
            <Route path="/admin/reviews" element={<Suspense fallback={<Loading />}><AdminReviewsPage /></Suspense>} />
            <Route path="/admin/reviews/dm/:dmId" element={<Suspense fallback={<Loading />}><DMReviewDetailPage /></Suspense>} />
            <Route path="/admin/notifications" element={<Suspense fallback={<Loading />}><AdminNotificationsPage /></Suspense>} />
            <Route path="/admin/scripts" element={<Suspense fallback={<Loading />}><AdminScriptCopiesPage /></Suspense>} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
