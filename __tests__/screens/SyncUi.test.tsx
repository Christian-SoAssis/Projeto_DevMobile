import React from 'react';
import { render, fireEvent, waitFor, renderHook, act } from '@testing-library/react-native';
import { ConflictReviewScreen } from '../../src/adapters/screens/ConflictReviewScreen';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import { useAutoSync } from '../../src/adapters/hooks/useAutoSync';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { ConflictResolutionService } from '../../src/domain/services/ConflictResolutionService';
import { ConflictView, ResolveSyncConflictUseCase } from '../../src/application/use-cases/ResolveSyncConflictUseCase';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { ConnectivityGateway } from '../../src/domain/ports/ConnectivityGateway';
import { InterestRemoteGateway } from '../../src/domain/ports/InterestRemoteGateway';
import { makeAnimal } from '../../test-support/fixtures';

function conflictAction(id = 'a1') {
  const action = new SyncAction({ id, operation: 'UPDATE', entityType: 'animal', entityId: 'animal_1', payload: {} });
  action.markConflict('A situação do animal mudou nos dois lugares.');
  return action;
}

describe('ConflictResolutionService.evaluateStaleUpdate', () => {
  it('situação divergente pede revisão; igual → vence a mais recente (mesmo com versões iguais)', () => {
    const local = makeAnimal();
    const remote = makeAnimal();
    expect(ConflictResolutionService.evaluateStaleUpdate(local, remote).needsReview).toBe(false);
    local.markAdopted('user_1');
    expect(ConflictResolutionService.evaluateStaleUpdate(local, remote).needsReview).toBe(true);

    const older = makeAnimal({ updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeAnimal({ updatedAt: '2026-02-01T00:00:00.000Z' });
    expect(ConflictResolutionService.evaluateStaleUpdate(older, newer).chosenVersion).toBe(newer);
    expect(ConflictResolutionService.evaluateStaleUpdate(newer, older).chosenVersion).toBe(newer);
  });

  it('SyncAction: conflito é marcado, não reenviável e liberado após revisão', () => {
    const action = conflictAction();
    expect(action.isConflict).toBe(true);
    action.clearConflict();
    expect(action.isConflict).toBe(false);
    expect(action.status.isPending()).toBe(true);
    expect(action.attempts).toBe(0);
  });
});

describe('ConflictReviewScreen', () => {
  function fakeUseCase(views: ConflictView[]) {
    const state = { views };
    const useCase = {
      listConflicts: jest.fn(async () => state.views),
      keepLocal: jest.fn(async () => {
        state.views = [];
      }),
      useRemote: jest.fn(async () => {
        state.views = [];
      }),
    };
    return { useCase: useCase as unknown as ResolveSyncConflictUseCase, mocks: useCase };
  }

  it('mostra sua edição ao lado da do servidor e permite manter a local', async () => {
    const local = makeAnimal({ name: 'Local' });
    const remote = makeAnimal({ name: 'Servidor' });
    const { useCase, mocks } = fakeUseCase([{ action: conflictAction(), local, remote }]);
    const onResolved = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <ConflictReviewScreen useCase={useCase} onResolved={onResolved} />
    );

    expect(await findByTestId('conflict-a1')).toBeTruthy();
    expect(getByText('Nome: Local')).toBeTruthy();
    expect(getByText('Nome: Servidor')).toBeTruthy();

    await fireEvent.press(getByTestId('keep-local-a1'));
    await waitFor(() =>
      expect(getByText('Sua edição foi mantida e será enviada na próxima sincronização.')).toBeTruthy()
    );
    expect(mocks.keepLocal).toHaveBeenCalledWith('a1');
    expect(onResolved).toHaveBeenCalled();
    expect(getByTestId('conflicts-empty')).toBeTruthy();
  });

  it('usar a versão do servidor; anúncio apagado oferece recriar/descartar; erro vira aviso', async () => {
    const { useCase, mocks } = fakeUseCase([{ action: conflictAction(), local: makeAnimal(), remote: null }]);
    const { getByTestId, getByText, findByText } = await render(<ConflictReviewScreen useCase={useCase} />);
    expect(await findByText('Recriar o anúncio')).toBeTruthy();
    expect(getByText('Descartar minha edição')).toBeTruthy();
    await fireEvent.press(getByTestId('use-remote-a1'));
    await waitFor(() => expect(getByText('A versão do servidor foi aplicada.')).toBeTruthy());
    expect(mocks.useRemote).toHaveBeenCalledWith('a1');

    const failing = fakeUseCase([{ action: conflictAction('b1'), local: makeAnimal(), remote: makeAnimal() }]);
    failing.mocks.keepLocal.mockRejectedValueOnce(new Error('Este conflito já foi resolvido.'));
    const second = await render(<ConflictReviewScreen useCase={failing.useCase} />);
    await fireEvent.press(await second.findByTestId('keep-local-b1'));
    await waitFor(() => expect(second.getByText('Este conflito já foi resolvido.')).toBeTruthy());
  });

  it('falha ao listar mostra aviso e voltar chama onBack', async () => {
    const useCase = { listConflicts: jest.fn().mockRejectedValue(new Error('x')) } as unknown as ResolveSyncConflictUseCase;
    const onBack = jest.fn();
    const { findByTestId, getByTestId } = await render(<ConflictReviewScreen useCase={useCase} onBack={onBack} />);
    expect(await findByTestId('conflicts-feedback')).toBeTruthy();
    await fireEvent.press(getByTestId('conflicts-back'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('SyncStatusScreen — ciclo completo e conflitos', () => {
  it('mostra resumo do envio + leitura do servidor e atalho para conflitos', async () => {
    const queue = new SyncQueueRepositoryFake();
    await queue.enqueue(conflictAction());
    const runSync = jest.fn().mockResolvedValue({
      push: { processedCount: 3, successCount: 2, failedCount: 0, conflictCount: 1 },
      pull: { fetched: 5, added: 2, updated: 1, skippedPending: 0 },
    });
    const onOpenConflicts = jest.fn();
    const { getByTestId, getByText } = await render(
      <SyncStatusScreen
        syncQueueRepository={queue}
        animalRepository={new AnimalRepositoryFake()}
        runSync={runSync}
        onOpenConflicts={onOpenConflicts}
      />
    );
    await waitFor(() => expect(getByTestId('btn-open-conflicts')).toBeTruthy());
    await fireEvent.press(getByTestId('btn-open-conflicts'));
    expect(onOpenConflicts).toHaveBeenCalled();

    await fireEvent.press(getByTestId('btn-trigger-sync'));
    await waitFor(() =>
      expect(
        getByText('Processados: 3 | Sucesso: 2 | Falhas: 0 | Conflitos: 1 | Do servidor: 2 novos, 1 atualizados')
      ).toBeTruthy()
    );
  });

  it('erro de leitura do servidor aparece no resumo', async () => {
    const runSync = jest.fn().mockResolvedValue({
      push: { processedCount: 0, successCount: 0, failedCount: 0 },
      pullError: 'sem rede',
    });
    const { getByTestId, getByText } = await render(
      <SyncStatusScreen
        syncQueueRepository={new SyncQueueRepositoryFake()}
        animalRepository={new AnimalRepositoryFake()}
        runSync={runSync}
      />
    );
    await fireEvent.press(getByTestId('btn-trigger-sync'));
    await waitFor(() =>
      expect(getByText('Processados: 0 | Sucesso: 0 | Falhas: 0 | Não foi possível ler o servidor: sem rede')).toBeTruthy()
    );
  });
});

describe('useAutoSync — uma vez por ciclo de reconexão', () => {
  function gateway(initial: boolean) {
    let listener: ((online: boolean) => void) | null = null;
    const gw: ConnectivityGateway = {
      isConnected: jest.fn(async () => initial),
      subscribe: jest.fn((cb: (online: boolean) => void) => {
        listener = cb;
        return () => {
          listener = null;
        };
      }),
    };
    return { gw, emit: (online: boolean) => listener?.(online) };
  }

  it('abre online → sincroniza; repetir "online" não dispara; cair e voltar dispara de novo', async () => {
    const { gw, emit } = gateway(true);
    const run = jest.fn().mockResolvedValue(undefined);
    await renderHook(() => useAutoSync({ enabled: true, gateway: gw, run }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    await act(async () => emit(true));
    expect(run).toHaveBeenCalledTimes(1);

    await act(async () => emit(false));
    await act(async () => emit(true));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('abre offline → só sincroniza ao reconectar; desabilitado nunca sincroniza; falha não quebra', async () => {
    const { gw, emit } = gateway(false);
    const run = jest.fn().mockRejectedValue(new Error('rede'));
    await renderHook(() => useAutoSync({ enabled: true, gateway: gw, run }));
    await waitFor(() => expect(gw.isConnected).toHaveBeenCalled());
    expect(run).not.toHaveBeenCalled();
    await act(async () => emit(true));
    expect(run).toHaveBeenCalledTimes(1);

    const off = gateway(true);
    const run2 = jest.fn().mockResolvedValue(undefined);
    await renderHook(() => useAutoSync({ enabled: false, gateway: off.gw, run: run2 }));
    expect(run2).not.toHaveBeenCalled();
    expect(off.gw.subscribe).not.toHaveBeenCalled();
  });
});

describe('AnimalDetailsScreen — interessados recebidos (responsável)', () => {
  const animal = makeAnimal({ ownerId: 'user_1' });
  const baseProps = { animal, animalRepository: new AnimalRepositoryFake() };

  it('responsável vê nome, telefone e e-mail de quem demonstrou interesse', async () => {
    const remoteInterests: InterestRemoteGateway = {
      createRemote: jest.fn(),
      listForAnimal: jest.fn().mockResolvedValue([
        { id: 'i1', userId: 'u2', animalId: 'animal_1', contactName: 'Bia', contactPhone: '35999', contactEmail: 'bia@x.com', message: 'Adoro!' },
      ]),
    };
    const { findByTestId, getByText } = await render(
      <AnimalDetailsScreen {...baseProps} currentUserId="user_1" remoteInterests={remoteInterests} />
    );
    expect(await findByTestId('received-interest-i1')).toBeTruthy();
    expect(getByText('Bia')).toBeTruthy();
    expect(getByText('Telefone: 35999')).toBeTruthy();
    expect(getByText('E-mail: bia@x.com')).toBeTruthy();
    expect(getByText('Interessados (1)')).toBeTruthy();
  });

  it('lista vazia e falha de rede têm mensagens próprias; não-dono não consulta', async () => {
    const empty: InterestRemoteGateway = { createRemote: jest.fn(), listForAnimal: jest.fn().mockResolvedValue([]) };
    const a = await render(<AnimalDetailsScreen {...baseProps} currentUserId="user_1" remoteInterests={empty} />);
    expect(await a.findByTestId('received-interests-empty')).toBeTruthy();
    a.unmount();

    const failing: InterestRemoteGateway = { createRemote: jest.fn(), listForAnimal: jest.fn().mockRejectedValue(new Error('x')) };
    const b = await render(<AnimalDetailsScreen {...baseProps} currentUserId="user_1" remoteInterests={failing} />);
    expect(await b.findByTestId('received-interests-error')).toBeTruthy();
    b.unmount();

    const spy: InterestRemoteGateway = { createRemote: jest.fn(), listForAnimal: jest.fn().mockResolvedValue([]) };
    const c = await render(<AnimalDetailsScreen {...baseProps} currentUserId="outra_pessoa" remoteInterests={spy} />);
    expect(c.queryByTestId('received-interests')).toBeNull();
    expect(spy.listForAnimal).not.toHaveBeenCalled();
  });
});
