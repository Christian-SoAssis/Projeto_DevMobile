import React from 'react';
import { render } from '@testing-library/react-native';
import { AccountScreen } from '../../src/adapters/screens/AccountScreen';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { User } from '../../src/domain/entities/User';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { Animal } from '../../src/domain/entities/Animal';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { InterestStatus } from '../../src/domain/value-objects/InterestStatus';
import { InterestRemoteGateway, RemoteInterest } from '../../src/domain/ports/InterestRemoteGateway';

const remoteStub = () =>
  ({
    createRemote: jest.fn(),
    listForAnimal: jest.fn().mockResolvedValue([]),
    listForUser: jest.fn().mockResolvedValue([]),
    updateStatusRemote: jest.fn(),
  }) as unknown as InterestRemoteGateway;

describe('AccountScreen — Minhas manifestações (trilha do adotante, decisão 18)', () => {
  const dummyLoc = new ApproximateLocation({ latitude: -21.55, longitude: -45.43, neighborhood: 'Centro', city: 'Varginha', region: 'MG' });
  const dummyChar = new AnimalCharacteristics({ species: 'Cão', size: 'Médio', approximateAge: '2 anos', sex: 'Fêmea' });

  const user = new User({
    id: 'usr_2',
    name: 'Fabia',
    contactInfo: new ContactInfo('fabia@enlace.app', '35999'),
  });

  it('sem repositório de interesses (ou visitante) a seção não aparece', async () => {
    const screen = await render(<AccountScreen user={user} />);
    expect(screen.queryByText('Minhas manifestações')).toBeNull();
  });

  it('visita (interessado): lista com nome do pet, status e trilha de 4 passos', async () => {
    const interestRepo = new AdoptionInterestRepositoryFake();
    const animalRepo = new AnimalRepositoryFake([
      new Animal({ id: 'a1', ownerId: 'usr_1', name: 'Luna', characteristics: dummyChar, location: dummyLoc }),
    ]);
    // Manifestação local já em EM_ANÁLISE (responsável avançou na trilha).
    await interestRepo.registerInterest(new AdoptionInterest('int_1', 'usr_2', 'a1', '2026-11-01T09:00:00.000Z'));
    await interestRepo.updateStatus('int_1', InterestStatus.emAnalise(), '2026-11-02T09:00:00.000Z');

    const screen = await render(
      <AccountScreen
        user={user}
        interestRepository={interestRepo}
        animalRepository={animalRepo}
      />
    );

    expect(await screen.findByTestId('my-interest-int_1')).toBeTruthy();
    expect(screen.getByText('Luna')).toBeTruthy();
    expect(screen.getByTestId('my-interest-status-int_1').props.children).toBe('Em análise');
    expect(screen.getByTestId('my-interest-trail-int_1-dot-2')).toBeTruthy();
    expect(screen.getByTestId('my-interest-trail-int_1-dot-4')).toBeTruthy();
  });

  it('sem manifestações: mensagem de vazio própria', async () => {
    const screen = await render(
      <AccountScreen
        user={user}
        interestRepository={new AdoptionInterestRepositoryFake()}
        animalRepository={new AnimalRepositoryFake()}
      />
    );
    expect(await screen.findByTestId('my-interests-empty')).toBeTruthy();
  });

  it('estado do SERVIDOR cobre o local defasado (a decisão do responsável vira etapa)', async () => {
    const interestRepo = new AdoptionInterestRepositoryFake();
    await interestRepo.registerInterest(new AdoptionInterest('int_2', 'usr_2', 'a2', '2026-11-01T09:00:00.000Z'));

    const remoteInterest: RemoteInterest = {
      id: 'int_2',
      userId: 'usr_2',
      animalId: 'a2',
      status: 'CONCLUIDA',
    };
    const remote = remoteStub();
    (remote.listForUser as jest.Mock).mockResolvedValue([remoteInterest]);

    const screen = await render(
      <AccountScreen
        user={user}
        interestRepository={interestRepo}
        animalRepository={new AnimalRepositoryFake()}
        remoteInterests={remote}
      />
    );

    expect(await screen.findByTestId('my-interest-int_2')).toBeTruthy();
    expect(screen.getByTestId('my-interest-status-int_2').props.children).toBe('Concluída');
    expect(screen.getByTestId('my-interest-trail-int_2-dot-4')).toBeTruthy();
  });
});
