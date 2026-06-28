import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, getAuth } from '../../store/auth';
import { showToast } from '../../components/common/Toast';
import type { RoleType } from '../../types';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleType, setRoleType] = useState<RoleType>(1);
  const [dmStageName, setDmStageName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAuth()) {
      const user = getAuth()!;
      if (user.Role_Type === 2) navigate('/dm/sessions', { replace: true });
      else navigate('/lobby', { replace: true });
    }
  }, [navigate]);

  const passwordStrength = (pw: string): { level: number; text: string; color: string } => {
    if (pw.length < 6) return { level: 0, text: '太短', color: 'bg-red-400' };
    if (pw.length < 8) return { level: 1, text: '一般', color: 'bg-orange-400' };
    if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) && pw.length >= 8) return { level: 2, text: '较强', color: 'bg-blue-400' };
    if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw) && pw.length >= 10) return { level: 3, text: '很强', color: 'bg-green-400' };
    return { level: 1, text: '一般', color: 'bg-orange-400' };
  };

  const strength = passwordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || !password.trim()) {
      showToast('请填写完整信息', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      return;
    }
    if (strength.level < 1) {
      showToast('密码强度不足，请使用至少 6 位密码', 'warning');
      return;
    }
    if (roleType === 2 && !dmStageName.trim()) {
      showToast('DM 需要填写艺名', 'warning');
      return;
    }
    if ((roleType === 3 || roleType === 4) && !inviteCode.trim()) {
      showToast('店长/门店管理员注册需要邀请码', 'warning');
      return;
    }

    setLoading(true);

    try {
      const user = await register({
        Account_Name: accountName,
        Password: password,
        Role_Type: roleType,
        DM_Stage_Name: roleType === 2 ? dmStageName : undefined,
        Invite_Code: (roleType === 3 || roleType === 4) ? inviteCode : undefined,
      });

      showToast('注册成功！');

      if (user.Role_Type === 2) {
        navigate('/dm/sessions', { replace: true });
      } else {
        navigate('/lobby', { replace: true });
      }
    } catch (err: any) {
      showToast(err.message || '注册失败，请重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-light flex flex-col justify-center px-6 py-10">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">创建账户</h1>
          <p className="text-sm text-gray-400 mt-1">加入 STS-DAMS 剧本杀平台</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">选择身份</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 1 as RoleType, label: '🎮 玩家', desc: '拼车参团' },
                { value: 2 as RoleType, label: '🎪 DM', desc: '主持带场' },
                { value: 3 as RoleType, label: '🏠 店长', desc: '需要邀请码' },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRoleType(item.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    roleType === item.value
                      ? 'border-accent-purple bg-purple-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
            {(roleType === 3 || roleType === 4) && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">邀请码</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="请输入管理员邀请码"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                />
                <p className="text-xs text-amber-500 mt-1">请联系系统管理员获取邀请码</p>
              </div>
            )}
          </div>

          {roleType === 2 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">DM 艺名</label>
              <input
                type="text"
                className="input-field"
                placeholder="你的 DM 艺名"
                value={dmStageName}
                onChange={e => setDmStageName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">账户名</label>
            <input
              type="text"
              className="input-field"
              placeholder="手机号 / 昵称"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              autoComplete="username"
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
              autoComplete="new-password"
            />
            {password && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.color}`}
                    style={{ width: `${(strength.level + 1) * 25}%` }} />
                </div>
                <span className="text-xs text-gray-400">{strength.text}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">确认密码</label>
            <input
              type="password"
              className="input-field"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">两次输入的密码不一致</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-base mt-2"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          已有账户？
          <Link to="/login" className="text-accent-purple font-medium ml-1">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
};
