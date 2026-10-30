import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../src/adapters/context/AuthContext';
import { useAnimals } from '../../src/adapters/hooks/useAnimals';
import { useSync } from '../../src/adapters/hooks/useSync';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

describe('Context API & Custom Bridge Hooks', () => {
  describe('AuthContext & AuthProvider', () => {
    it('deve inicializar desautenticado e autenticar via login', async () => {
      const authGateway = new AuthGatewayFake();
      const sessionStorage = new SessionStorageFake();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider authGateway={authGateway} sessionStorage={sessionStorage}>
          {children}
        </AuthProvider>
      );

      const { result } = await renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.isAuthenticated).toBe(false);

      await act(async () => {
        await result.current.login('ana@exemplo.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.name).toBe('Ana Silva');

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('deve inicializar com sessão salva se existir no storage', async () => {
      const authGateway = new AuthGatewayFake();
      const sessionStorage = new SessionStorageFake();
      await sessionStorage.saveSessionToken('fake_token_usr_1');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider authGateway={authGateway} sessionStorage={sessionStorage}>
          {children}
        </AuthProvider>
      );

      const { result } = await renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.id).toBe('usr_1');
    });

    it('deve limpar sessão se o token armazenado for inválido ao inicializar', async () => {
      const authGateway = new AuthGatewayFake();
      const sessionStorage = new SessionStorageFake();
      await sessionStorage.saveSessionToken('expired_token');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider authGateway={authGateway} sessionStorage={sessionStorage}>
          {children}
        </AuthProvider>
      );

      const { result } = await renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(await sessionStorage.getSessionToken()).toBeNull();
    });

    it('deve lançar erro se useAuth for usado fora de AuthProvider', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth deve ser utilizado dentro de um AuthProvider');
      consoleErrorSpy.mockRestore();
    });

    it('deve permitir acesso via token', async () => {
      const authGateway = new AuthGatewayFake();
      const sessionStorage = new SessionStorageFake();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider authGateway={authGateway} sessionStorage={sessionStorage}>
          {children}
        </AuthProvider>
      );

      const { result } = await renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.acessarViaToken('fake_token_usr_1');
      });

      expect(result.current.isAuthenticated).toBe(true);
    });
    it('deve permitir usar AuthProvider sem fornecer gateway/storage explicitamente', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );
      const { result } = await renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useAnimals Custom Hook', () => {
    it('deve permitir instanciar com repositórios padrão e tratar exceções sem mensagem', async () => {
      const { result } = await renderHook(() => useAnimals());
      const animalRepoFake = new AnimalRepositoryFake();
      animalRepoFake.search = jest.fn().mockRejectedValue('Erro string sem message');

      const { result: customResult } = await renderHook(() => useAnimals(animalRepoFake));
      await act(async () => {
        await customResult.current.searchAnimals();
      });
      expect(customResult.current.error).toBe('Erro ao carregar anúncios.');

      animalRepoFake.saveLocal = jest.fn().mockRejectedValue('Erro sem message');
      const animal = new Animal({
        id: 'a1',
        ownerId: 'usr_1',
        name: 'Rex',
        characteristics: new AnimalCharacteristics({ species: 'Cão', size: 'Médio', approximateAge: '1 ano', sex: 'Macho' }),
        location: new ApproximateLocation({ latitude: -21.5, longitude: -45.4, neighborhood: 'Centro', city: 'Varginha', region: 'MG' }),
      });
      await act(async () => {
        try { await customResult.current.createAnimal(animal); } catch {}
      });
      expect(customResult.current.error).toBe('Erro ao criar anúncio.');

      animalRepoFake.findById = jest.fn().mockRejectedValue('Erro sem message');
      await act(async () => {
        try { await customResult.current.markAdopted('usr_1', 'a1'); } catch {}
      });
      expect(customResult.current.error).toBe('Erro ao marcar como adotado.');
    });

    it('deve realizar buscas, cadastros e alterar status do animal', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const syncQueueRepo = new SyncQueueRepositoryFake();

      const { result } = await renderHook(() => useAnimals(animalRepo, syncQueueRepo));

      const animal = new Animal({
        id: 'a1',
        ownerId: 'usr_1',
        name: 'Rex',
        characteristics: new AnimalCharacteristics({ species: 'Cão', size: 'Médio', approximateAge: '1 ano', sex: 'Macho' }),
        location: new ApproximateLocation({ latitude: -21.5, longitude: -45.4, neighborhood: 'Centro', city: 'Varginha', region: 'MG' }),
      });

      await act(async () => {
        await result.current.createAnimal(animal, true);
      });

      expect(result.current.animals.length).toBe(1);

      await act(async () => {
        await result.current.markAdopted('usr_1', 'a1', true);
      });

      expect(result.current.animals[0].status.isAdopted()).toBe(true);
    });

    it('deve capturar erros ao buscar, salvar ou alterar status do animal', async () => {
      const animalRepo = new AnimalRepositoryFake();
      animalRepo.search = jest.fn().mockRejectedValue(new Error('Falha no repositório ao buscar'));

      const { result } = await renderHook(() => useAnimals(animalRepo));

      await act(async () => {
        await result.current.searchAnimals();
      });

      expect(result.current.error).toBe('Falha no repositório ao buscar');

      animalRepo.saveLocal = jest.fn().mockRejectedValue(new Error('Falha ao criar'));
      const animal = new Animal({
        id: 'a1',
        ownerId: 'usr_1',
        name: 'Rex',
        characteristics: new AnimalCharacteristics({ species: 'Cão', size: 'Médio', approximateAge: '1 ano', sex: 'Macho' }),
        location: new ApproximateLocation({ latitude: -21.5, longitude: -45.4, neighborhood: 'Centro', city: 'Varginha', region: 'MG' }),
      });

      await act(async () => {
        try {
          await result.current.createAnimal(animal);
        } catch {}
      });
      expect(result.current.error).toBe('Falha ao criar');

      animalRepo.findById = jest.fn().mockRejectedValue(new Error('Falha ao marcar'));
      await act(async () => {
        try {
          await result.current.markAdopted('usr_1', 'a1');
        } catch {}
      });
      expect(result.current.error).toBe('Falha ao marcar');
    });
  });

  describe('useSync Custom Hook', () => {
    it('deve carregar itens pendentes e disparar sincronização', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const syncQueueRepo = new SyncQueueRepositoryFake();

      const { result } = await renderHook(() => useSync(syncQueueRepo, animalRepo));

      await act(async () => {
        await result.current.loadPending();
      });

      await act(async () => {
        await result.current.triggerSync();
      });

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('useSync defaults', () => {
    it('deve iniciar sem sincronização em andamento', async () => {
      const { result } = await renderHook(() => useSync());
      expect(result.current.isSyncing).toBe(false);
    });
  });
});
