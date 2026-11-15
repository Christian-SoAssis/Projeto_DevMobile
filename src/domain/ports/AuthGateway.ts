import { User } from '../entities/User';

export interface AuthSession {
  user: User;
  accessToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  contactInfo?: string;
}

export interface UpdateProfileInput {
  userId: string;
  name: string;
  contactInfo: string;
  bio: string;
  avatarUrl?: string;
  interestsTags?: string[];
}

export interface AuthGateway {
  login(email: string, password: string): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  restoreSession(): Promise<AuthSession | null>;
  updateProfile(input: UpdateProfileInput): Promise<User>;
  logout(): Promise<void>;
}
