import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import { get, post, put, del } from '../client';

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
    store['sts_dams_auth'] = JSON.stringify({
      token: 'test-jwt-token',
      User_ID: 1,
      Role_Type: 3,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== HTTP 方法 ====================

  it('get() 发送 GET 请求', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'ok' }),
    });

    const result = await get('/sessions');

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
      method: 'GET',
    }));
    expect(result).toEqual({ data: 'ok' });
  });

  it('post() 发送 POST 请求并附带 body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 1 }),
    });

    const result = await post('/sessions', { title: '测试' });

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: '测试' }),
    }));
    expect(result).toEqual({ id: 1 });
  });

  it('put() 发送 PUT 请求', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ updated: true }),
    });

    const result = await put('/accounts/5', { status: 'Active' });

    expect(mockFetch).toHaveBeenCalledWith('/api/accounts/5', expect.objectContaining({
      method: 'PUT',
    }));
    expect(result).toEqual({ updated: true });
  });

  it('del() 发送 DELETE 请求', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ deleted: true }),
    });

    const result = await del('/notifications/10');

    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/10', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toEqual({ deleted: true });
  });

  // ==================== 认证 Token ====================

  it('请求自动携带 Bearer Token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await get('/profile');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('无 token 时不携带 Authorization 头', async () => {
    delete store['sts_dams_auth'];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await get('/health');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Authorization']).toBeUndefined();
  });

  // ==================== 错误处理 ====================

  it('非 ok 响应抛出错误并携带 status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: '未找到该场次' }),
    });

    await expect(get('/sessions/999')).rejects.toMatchObject({
      message: '未找到该场次',
      status: 404,
    });
  });

  it('非 ok 响应无 error 字段时使用默认消息', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    await expect(get('/sessions')).rejects.toMatchObject({
      message: expect.stringContaining('500'),
      status: 500,
    });
  });

  it('post() 不传 body 时仍正常发送', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await post('/auth/login', undefined);

    const callBody = mockFetch.mock.calls[0][1].body;
    expect(callBody).toBeUndefined();
  });
});
