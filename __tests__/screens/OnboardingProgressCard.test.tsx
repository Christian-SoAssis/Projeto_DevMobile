import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { OnboardingProgressCard, computeOnboardingSteps } from '../../src/adapters/components/OnboardingProgressCard';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { User } from '../../src/domain/entities/User';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

describe('OnboardingProgressCard (melhoria #12)', () => {
  const dummyLoc = new ApproximateLocation({ latitude: -21.55, longitude: -45.43, neighborhood: 'Centro', city: 'Varginha', region: 'MG' });
  const dummyChar = new AnimalCharacteristics({ species: 'Cão', size: 'Médio', approximateAge: '2 anos', sex: 'Fêmea' });
  const emptyRepo = new AnimalRepositoryFake();
  const nextMock = jest.fn();
  const newMock = jest.fn();

  beforeEach(() => {
    nextMock.mockClear();
    newMock.mockClear();
  });

  const makeUser = (patch: Partial<{ avatar: boolean; phone: boolean; bio: boolean; interests: boolean }> = {}) =>
    new User({
      id: 'usr_1',
      name: 'Fabia',
      contactInfo: new ContactInfo('fabia@enlace.app', patch.phone ? '123' : undefined),
      bio: patch.bio ? 'Amor aos bichos' : undefined,
      avatarUri: patch.avatar ? 'file://avatar.jpg' : undefined,
      interests: patch.interests ? ['Cães', 'Gatos'] : [],
    });

  it('computeOnboardingSteps (puro): deriva os 5 passos do estado real do User', () => {
    const fresh = computeOnboardingSteps(makeUser(), false);
    expect(fresh.map((s) => s.id)).toEqual(['avatar', 'phone', 'bio', 'interests', 'listing']);
    expect(fresh.every((s) => !s.done)).toBe(true);

    const done = computeOnboardingSteps(makeUser({ phone: true }), false);
    expect(done.find((s) => s.id === 'phone')!.done).toBe(true);
    expect(done.find((s) => s.id === 'listing')!.done).toBe(false);
  });

  it('visitante (sem sessão) não vê card', async () => {
    const { queryByTestId } = await render(
      <OnboardingProgressCard user={null} animalRepository={emptyRepo} />
    );
    expect(queryByTestId('onboarding-card')).toBeNull();
  });

  it('perfil novo: mostra 0/5 com CTA que leva à Conta', async () => {
    const { getByTestId, getByText } = await render(
      <OnboardingProgressCard
        user={makeUser()}
        animalRepository={emptyRepo}
        onGoToAccount={nextMock}
        onNewAnimal={newMock}
      />
    );

    expect(getByText('Complete seu perfil — 0/5')).toBeTruthy();
    await fireEvent.press(getByTestId('onboarding-next-avatar'));
    expect(nextMock).toHaveBeenCalled();
  });

  it('com dados de perfil completos, sobra o passo do anúncio (4/5) e o CTA anterior desaparece', async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <OnboardingProgressCard
        user={makeUser({ avatar: true, phone: true, bio: true, interests: true })}
        animalRepository={new AnimalRepositoryFake()}
        onGoToAccount={nextMock}
      />
    );

    expect(getByText(/4\/5/)).toBeTruthy();
    expect(getByTestId('onboarding-step-listing').props.children.join(' ')).toContain('Primeiro anúncio');
    expect(queryByText('Completar dados do perfil')).toBeNull();
  });

  it('anúncio publicado no repositório completa o 5º passo: perfil completo → sem card', async () => {
    const repo = new AnimalRepositoryFake([
      new Animal({ id: 'a1', ownerId: 'usr_1', name: 'Luna', characteristics: dummyChar, location: dummyLoc }),
    ]);
    const screen = await render(
      <OnboardingProgressCard
        user={makeUser({ avatar: true, phone: true, bio: true, interests: true })}
        animalRepository={repo}
      />
    );
    // Ao completar o 5º passo o card some no MESMO frame — não existe render
    // intermediário mostrando 5/5.
    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-card')).toBeNull();
    });
  });
});
