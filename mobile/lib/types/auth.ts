export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  status: string;
  avatarUrl?: string;
  batchIds: string[];
  batchNames: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: AuthUser;
}
