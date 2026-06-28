const BASE_URL = '/api';

function getToken(): string | null {
  try {
    const auth = JSON.parse(localStorage.getItem('sts_dams_auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('sts_dams_auth');
    // 尝试读取响应体中的错误详情
    let errorData: any = {};
    try { errorData = await res.json(); } catch { /* ignore parse errors */ }
    // 不发起完整页面重载 — 登录页会在下一次 React 渲染时由路由守卫显示
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    const msg = errorData?.error || errorData?.detail || '未授权，请重新登录';
    const err = new Error(msg) as Error & { status: number; data: unknown };
    err.status = 401;
    err.data = errorData;
    return Promise.reject(err);
  }

  const data = await res.json();

  if (!res.ok) {
    // 401 已在上方处理，此处不会再遇到
    const errMsg = [data.error, data.detail].filter(Boolean).join(' — ') || `请求失败 (${res.status})`;
    const err = new Error(errMsg) as Error & { status: number; data: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body);
}

export function del<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
