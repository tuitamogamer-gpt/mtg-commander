// Auth contracts.

export interface PublicUser {
  id: string;
  username: string;
  /** Null for legacy accounts created before emails were required. */
  email: string | null;
  createdAt: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  /** Username OR email. */
  identifier: string;
  password: string;
}

export interface AuthResponse {
  user: PublicUser;
}
