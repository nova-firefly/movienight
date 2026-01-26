export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
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
  is_admin?: boolean;
}

export interface UpdateUserInput {
  id: number;
  username?: string;
  email?: string;
  password?: string;
  is_admin?: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}
