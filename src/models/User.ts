export interface User {
  id: string;
  username: string;
  email: string;
  display_name?: string | null;
  is_admin: boolean;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}
