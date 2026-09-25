import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../src/adapters/context/AuthContext';
import { useAnimals } from '../../src/adapters/hooks/useAnimals';
import { useSync } from '../../src/adapters/hooks/useSync';
import { useAtividades } from '../../src/adapters/hooks/useAtividades';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { PeriodoAvaliacaoRepositoryFake } from '../../src/application/fakes/PeriodoAvaliacaoRepositoryFake';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { PeriodoAvaliacao } from '../../src/domain/entities/PeriodoAvaliacao';
import { Assinatura } from '../../src/domain/value-objects/Assinatura';

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

      const { result } = renderHook(() => useAuth(), { wrapper });

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

      const { result } = renderHook(() => useAuth(), { wrapper });

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

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(await sessionStorage.getSessionToken()).toBeNull();
    });

    it('deve lançar erro se useAuth for usado fora de AuthProvider', () => {
      expect(() => renderHook(() => useAuth())).toThrow('useAuth deve ser utilizado dentro de um AuthProvider');
    });

    it('deve permitir acesso via token', async () => {
      const authGateway = new AuthGatewayFake();
      const sessionStorage = new SessionStorageFake();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider authGateway={authGateway} sessionStorage={sessionStorage}>
          {children}
        </AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.acessarViaToken('fake_token_usr_1');
      });

      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('useAnimals Custom Hook', () => {
    it('deve realizar buscas, cadastros e alterar status do animal', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const syncQueueRepo = new SyncQueueRepositoryFake();

      const { result } = renderHook(() => useAnimals(animalRepo, syncQueueRepo));

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

      const { result } = renderHook(() => useAnimals(animalRepo));

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

      const { result } = renderHook(() => useSync(syncQueueRepo, animalRepo));

      await act(async () => {
        await result.current.loadPending();
      });

      await act(async () => {
        await result.current.triggerSync();
      });

      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('useAtividades Custom Hook', () => {
    it('deve carregar período, registrar atividades e assinar relatório', async () => {
      const repo = new PeriodoAvaliacaoRepositoryFake();
      const p = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
      await repo.save(p);

      const { result } = renderHook(() => useAtividades(repo));

      await act(async () => {
        await result.current.carregarPeriodo('p1');
      });

      expect(result.current.periodo?.id).toBe('p1');

      await act(async () => {
        await result.current.registrarAtividades('p1', [{ id: 'at1', descricao: 'Refatoração', horas: 8 }]);
      });

      expect(result.current.periodo?.atividades.length).toBe(1);

      await act(async () => {
        await result.current.assinarRelatorio('p1', new Assinatura('data:image/png;base64,123456789012', 'resp_1'));
      });

      expect(result.current.periodo?.assinaturas.length).toBe(1);
    });

    it('deve tratar erros em useAtividades ao carregar, registrar e assinar', async () => {
      const repo = new PeriodoAvaliacaoRepositoryFake();
      const { result } = renderHook(() => useAtividades(repo));

      await act(async () => {
        await result.current.carregarPeriodo('p_inexistente');
      });
      expect(result.current.periodo).toBeNull();

      await act(async () => {
        try {
          await result.current.registrarAtividades('p_inexistente', []);
        } catch {}
      });
      expect(result.current.error).toBe('Período de avaliação não encontrado.');

      await act(async () => {
        try {
          await result.current.assinarRelatorio('p_inexistente', new Assinatura('data:image/png;base64,123456789012', 'resp1'));
        } catch {}
      });
      expect(result.current.error).toBe('Período de avaliação não encontrado.');
    });
  });
});
