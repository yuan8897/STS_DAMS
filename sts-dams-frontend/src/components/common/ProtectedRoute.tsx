import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isLoggedIn, getCurrentUser } from '../../store/auth';

interface Props {
  allowedRoles?: number[];
  children?: React.ReactNode;
}

/**
 * 路由守卫组件
 *
 * 角色映射:
 *   1 = Player  → /lobby
 *   2 = DM      → /dm/sessions
 *   3 = Admin   → /admin/dashboard
 *   4 = Store_Manager → /admin/inventory (门店管理员默认进入库存管理)
 */
const ROLE_HOME: Record<number, string> = {
  1: '/lobby',
  2: '/dm/sessions',
  3: '/admin/dashboard',
  4: '/admin/inventory',
};

export const ProtectedRoute: React.FC<Props> = ({ allowedRoles, children }) => {
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const user = getCurrentUser();
    if (user && !allowedRoles.includes(user.Role_Type)) {
      // Redirect to appropriate home page based on role
      const homePath = ROLE_HOME[user.Role_Type] || '/lobby';
      return <Navigate to={homePath} replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
