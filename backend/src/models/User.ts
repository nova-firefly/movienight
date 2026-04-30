export interface User {
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  is_admin: boolean;
  is_active: boolean;
  last_login_at?: Date | null;
  plex_id?: string | null;
  plex_username?: string | null;
  plex_thumb?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  is_admin?: boolean;
  is_active?: boolean;
}

export interface UpdateUserInput {
  id: number;
  username?: string;
  email?: string;
  password?: string;
  display_name?: string;
  is_admin?: boolean;
  is_active?: boolean;
  plex_id?: string | null;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}
