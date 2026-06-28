import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { login } from '../../store/auth';
import { getAuth } from '../../store/auth';
import { showToast } from '../../components/common/Toast';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const ROLE_HOME: Record<number, string> = {
  1: '/lobby',
  2: '/dm/sessions',
  3: '/admin/dashboard',
  4: '/admin/inventory',
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(() => {
    const saved = sessionStorage.getItem('login_attempts');
    return saved ? JSON.parse(saved) : { count: 0, lockedUntil: 0 };
  });

  const isLocked = attempts.lockedUntil > Date.now();
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  useEffect(() => {
    if (getAuth()) {
      const user = getAuth()!;
      const home = ROLE_HOME[user.Role_Type] || '/lobby';
      navigate(home, { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountName.trim() || !password.trim()) {
      showToast('请填写完整信息', 'warning');
      return;
    }

    if (isLocked) {
      const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      showToast(`账户已锁定，请 ${remaining} 分钟后再试`, 'error');
      return;
    }

    setLoading(true);

    try {
      const user = await login(accountName, password);
      sessionStorage.removeItem('login_attempts');
      setAttempts({ count: 0, lockedUntil: 0 });

      // 登录后跳回原始目标页面，或根据角色进入默认页面
      const home = ROLE_HOME[user.Role_Type] || '/lobby';
      navigate(fromPath || home, { replace: true });
    } catch (err: any) {
      const newCount = attempts.count + 1;
      const newAttempts = { count: newCount, lockedUntil: 0 };
      if (newCount >= MAX_LOGIN_ATTEMPTS) {
        newAttempts.lockedUntil = Date.now() + LOCK_DURATION_MS;
        showToast('登录失败次数过多，账户已锁定 15 分钟', 'error');
      } else {
        const msg = err.message || '账户名或密码错误';
        showToast(`${msg}（还剩 ${MAX_LOGIN_ATTEMPTS - newCount} 次尝试）`, 'error');
      }
      sessionStorage.setItem('login_attempts', JSON.stringify(newAttempts));
      setAttempts(newAttempts);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-light flex flex-col justify-center px-6">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🎭</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">STS-DAMS</h1>
          <p className="text-sm text-gray-400 mt-1">剧本杀门店时空调度系统</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">账户名</label>
            <input
              type="text"
              className="input-field"
              placeholder="手机号 / 昵称"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              autoComplete="username"
              disabled={isLocked}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">密码</label>
            <input
              type="password"
              className="input-field"
              placeholder="输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLocked}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {isLocked && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">
              账户已锁定 {Math.ceil((attempts.lockedUntil - Date.now()) / 60000)} 分钟，请稍后再试
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="btn-primary w-full py-3.5 text-base"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          还没有账户？
          <Link to="/register" className="text-accent-purple font-medium ml-1">
            立即注册
          </Link>
        </p>

        <div className="mt-8 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500 text-center mb-1">演示账户（密码均为 123456）</p>
          <div className="text-sm text-gray-500 space-y-0.5">
            <p>店长：admin | 门店管理员：store_mgr</p>
            <p>DM：dm_ye / dm_chen / dm_lin</p>
            <p>玩家：player_xiaoming / player_hong / player_lily / player_david</p>
          </div>
        </div>
      </div>
    </div>
  );
};
