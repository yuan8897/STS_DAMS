import { post, get } from './client';
import type { AuthUser } from '../types';

interface LoginResponse {
  User_ID: number;
  Account_Name: string;
  Role_Type: number;
  DM_User_ID: number | null;
  DM_Stage_Name: string | null;
  token: string;
}

interface RegisterResponse {
  User_ID: number;
  token: string;
}

interface MeResponse {
  User_ID: number;
  Account_Name: string;
  Role_Type: number;
  Account_Status: string;
  Account_Created_At: string;
  Last_Login_At: string | null;
  DM_Info: {
    DM_Stage_Name: string;
    Employment_Status: string;
    Hire_Date: string;
  } | null;
}

export async function login(accountName: string, password: string): Promise<AuthUser> {
  const data = await post<LoginResponse>('/auth/login', {
    Account_Name: accountName,
    Password: password,
  });

  return {
    User_ID: data.User_ID,
    Account_Name: data.Account_Name,
    Role_Type: data.Role_Type as AuthUser['Role_Type'],
    DM_User_ID: data.DM_User_ID ?? undefined,
    DM_Stage_Name: data.DM_Stage_Name ?? undefined,
    token: data.token,
  };
}

export async function register(params: {
  Account_Name: string;
  Password: string;
  Role_Type: number;
  DM_Stage_Name?: string;
  Invite_Code?: string;
}): Promise<AuthUser> {
  const body: Record<string, unknown> = {
    Account_Name: params.Account_Name,
    Password: params.Password,
    Role_Type: params.Role_Type,
  };
  if (params.DM_Stage_Name) body.DM_Stage_Name = params.DM_Stage_Name;
  if (params.Invite_Code) body.Invite_Code = params.Invite_Code;

  const data = await post<RegisterResponse>('/auth/register', body);

  // After registration, login to get full user info
  return login(params.Account_Name, params.Password);
}

export async function getMe(): Promise<MeResponse> {
  return get<MeResponse>('/auth/me');
}
