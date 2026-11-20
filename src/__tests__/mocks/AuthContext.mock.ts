import { User } from '../../domain/entities/User';

export const mockAuth = {
  user: null as User | null,
  loading: false,
  login: jest.fn().mockResolvedValue(undefined),
  register: jest.fn().mockResolvedValue(undefined),
  updateProfile: jest.fn().mockResolvedValue(undefined),
  logout: jest.fn().mockResolvedValue(undefined),
};

export const AuthContext = {
  Provider: ({ children }: any) => children,
};

export function useAuth() {
  return mockAuth;
}

export function AuthProvider({ children }: any) {
  return children;
}
