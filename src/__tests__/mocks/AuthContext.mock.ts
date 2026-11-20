import { User } from '../../domain/entities/User';

export const AuthContext = {
  Provider: ({ children }: any) => children,
};

export function useAuth() {
  return {
    user: null as User | null,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    updateProfile: jest.fn(),
    logout: jest.fn(),
  };
}

export function AuthProvider({ children }: any) {
  return children;
}
