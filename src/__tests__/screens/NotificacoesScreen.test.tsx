import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NotificacoesScreen from '../../../app/(tabs)/notificacoes';
import { mockAuth } from '../mocks/AuthContext.mock';
import { mockRepositories } from '../mocks/RepositoriesContext.mock';
import {
  createTestAnimal,
  createTestInterest,
  createTestUser,
} from '../fakes/in-memory-repositories';

const runFullSync = jest.fn();

jest.mock('../../adapters/hooks/useFullSync', () => ({
  useFullSync: () => runFullSync,
}));

jest.mock('../../adapters/hooks/useConnectivity', () => ({
  useConnectivity: () => true,
}));

describe('NotificacoesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.user = createTestUser({ id: 'dono', name: 'Dona do pet' });
    mockRepositories.syncQueueRepository.listPending.mockResolvedValue([]);
    mockRepositories.animalRepository.findById.mockResolvedValue(null);
    mockRepositories.animalRepository.findByOwner.mockResolvedValue([]);
    mockRepositories.interestRepository.listByUser.mockResolvedValue([]);
    mockRepositories.interestRepository.listByAnimal.mockResolvedValue([]);
  });

  it('recarrega os avisos depois do pull remoto, incluindo interesses enviados e recebidos', async () => {
    const ownedAnimal = createTestAnimal({ id: 'pet-meu', ownerId: 'dono', name: 'Pipoca' });
    const sent = createTestInterest({
      id: 'meu-interesse',
      userId: 'dono',
      animalId: 'pet-de-outro',
      status: 'EM_ANALISE',
    });
    const received = createTestInterest({
      id: 'interesse-recebido',
      userId: 'adotante',
      animalId: ownedAnimal.id,
    });
    let pulled = false;

    mockRepositories.animalRepository.findByOwner.mockImplementation(async () =>
      pulled ? [ownedAnimal] : []
    );
    mockRepositories.animalRepository.findById.mockImplementation(async (id: string) =>
      id === sent.animalId ? createTestAnimal({ id, name: 'Amora' }) : null
    );
    mockRepositories.interestRepository.listByUser.mockImplementation(async () =>
      pulled ? [sent] : []
    );
    mockRepositories.interestRepository.listByAnimal.mockImplementation(async () =>
      pulled ? [received] : []
    );
    runFullSync.mockImplementation(async () => {
      pulled = true;
    });

    const { getByTestId, queryByText, findByText } = await render(<NotificacoesScreen />);
    await waitFor(() => expect(queryByText('Trilha de adoção • Amora')).toBeNull());

    await fireEvent(getByTestId('notifications-refresh-control'), 'refresh');

    expect(await findByText('Trilha de adoção • Amora')).toBeTruthy();
    expect(await findByText('Etapa atual: EM ANALISE')).toBeTruthy();
    expect(await findByText('Novo interessado em Pipoca')).toBeTruthy();
    expect(runFullSync).toHaveBeenCalledTimes(1);
  });

  it('mostra o aviso quando um interessado retira a manifestação do anúncio', async () => {
    mockRepositories.appStateRepository.get.mockResolvedValue(
      JSON.stringify([
        {
          id: 'withdrawn:interest-1',
          interestId: 'interest-1',
          animalId: 'pet-meu',
          animalName: 'Pipoca',
          interestedUserName: 'Carlos',
          withdrawnAt: '2026-11-22T12:00:00.000Z',
        },
      ])
    );

    const { findByText } = await render(<NotificacoesScreen />);

    expect(await findByText('Carlos retirou o interesse')).toBeTruthy();
    expect(await findByText('No anúncio de Pipoca')).toBeTruthy();
  });
});
