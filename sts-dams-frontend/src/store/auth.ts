import type { AuthUser } from '../types';
import { login as apiLogin, register as apiRegister } from '../api/auth';

// 角色名称映射（含 Store_Manager）
export const ROLE_NAMES: Record<number, string> = {
  1: 'Player',
  2: 'DM',
  3: 'Admin',
  4: 'Store_Manager',
};

const AUTH_KEY = 'sts_dams_auth';

export function getAuth(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getAuth()?.token ?? null;
}

export function setAuth(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function isLoggedIn(): boolean {
  return getAuth() !== null;
}

export function getCurrentUser(): AuthUser | null {
  return getAuth();
}

export function getUserRole(): number | null {
  return getAuth()?.Role_Type ?? null;
}

export async function login(accountName: string, password: string): Promise<AuthUser> {
  const user = await apiLogin(accountName, password);
  setAuth(user);
  return user;
}

export async function register(params: {
  Account_Name: string;
  Password: string;
  Role_Type: number;
  DM_Stage_Name?: string;
  Invite_Code?: string;
}): Promise<AuthUser> {
  const user = await apiRegister(params);
  setAuth(user);
  return user;
}
