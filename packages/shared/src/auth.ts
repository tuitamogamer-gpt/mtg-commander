// Auth contracts.

export interface PublicUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface RegisterInput {
  username: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: PublicUser;
}
