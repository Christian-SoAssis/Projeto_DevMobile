import { AuthProvider, useAuth } from '../../../adapters/context/AuthContext';
import { RepositoriesProvider, useRepositories } from '../../../adapters/context/RepositoriesContext';
import { useFullSync } from '../../../adapters/hooks/useFullSync';

describe('Adapters context & hooks - smoke tests', () => {
  it('AuthProvider, useAuth, RepositoriesProvider, useRepositories should be importable', () => {
    expect(typeof AuthProvider).toBe('function');
    expect(typeof useAuth).toBe('function');
    expect(typeof RepositoriesProvider).toBe('function');
    expect(typeof useRepositories).toBe('function');
  });

  it('useFullSync should be importable', () => {
    expect(typeof useFullSync).toBe('function');
  });
});
