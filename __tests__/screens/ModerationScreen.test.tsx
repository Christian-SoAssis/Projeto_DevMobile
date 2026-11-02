import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ModerationScreen } from '../../src/adapters/screens/ModerationScreen';
import { ModerateAnimalUseCase } from '../../src/application/use-cases/ModerateAnimalUseCase';
import { ModerationGateway, ModerationEntry } from '../../src/domain/ports/ModerationGateway';
import { User } from '../../src/domain/entities/User';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { SupabaseModerationRepository } from '../../src/infrastructure/supabase/repositories/SupabaseModerationRepository';
import { FakeSupabaseClient, seedFakeDb } from '../../test-support/SupabaseFake';
import { makeAnimal } from '../../test-support/fixtures';

const admin = new User({ id: 'adm', name: 'Admin', contactInfo: new ContactInfo('adm@x.com'), role: 'ADMIN' });
const common = new User({ id: 'u1', name: 'Ana', contactInfo: new ContactInfo('ana@x.com'), role: 'USER' });

function gatewayWith(entries: ModerationEntry[]) {
  const state = { entries };
  const gateway: ModerationGateway = {
    listForModeration: jest.fn(async () => state.entries),
    moderateAnimal: jest.fn(async (id, action) => {
      state.entries = state.entries.map((e) => (e.animal.id === id ? { ...e, hidden: action === 'HIDE' } : e));
    }),
  };
  return { gateway, state };
}

describe('ModerationScreen (UC20)', () => {
  it('admin vê os anúncios, oculta e reexibe', async () => {
    const { gateway } = gatewayWith([
      { animal: makeAnimal({ id: 'a', name: 'Luna' }), hidden: false },
      { animal: makeAnimal({ id: 'b', name: 'Thor' }), hidden: true },
    ]);
    const { findByTestId, getByTestId, getByText } = await render(
      <ModerationScreen actor={admin} useCase={new ModerateAnimalUseCase(gateway)} />
    );
    expect(await findByTestId('moderation-item-a')).toBeTruthy();
    expect(getByText('Oculto')).toBeTruthy();

    await fireEvent.press(getByTestId('moderate-a'));
    await waitFor(() => expect(getByText('Anúncio ocultado da lista pública.')).toBeTruthy());
    expect(gateway.moderateAnimal).toHaveBeenCalledWith('a', 'HIDE');

    await fireEvent.press(getByTestId('moderate-b'));
    await waitFor(() => expect(getByText('Anúncio reexibido.')).toBeTruthy());
    expect(gateway.moderateAnimal).toHaveBeenCalledWith('b', 'UNHIDE');
  });

  it('usuário comum é barrado pelo use case (UI não é a barreira) e lista vazia tem mensagem', async () => {
    const { gateway } = gatewayWith([]);
    const denied = await render(
      <ModerationScreen actor={common} useCase={new ModerateAnimalUseCase(gateway)} />
    );
    expect(await denied.findByText('Somente administradores podem moderar anúncios (UC20).')).toBeTruthy();
    expect(gateway.listForModeration).not.toHaveBeenCalled();
  });

  it('sem anúncios mostra mensagem de lista vazia', async () => {
    const { gateway } = gatewayWith([]);
    const empty = await render(<ModerationScreen actor={admin} useCase={new ModerateAnimalUseCase(gateway)} />);
    expect(await empty.findByTestId('moderation-empty')).toBeTruthy();
  });

  it('falha ao moderar vira aviso e anúncio abre ao tocar', async () => {
    const { gateway } = gatewayWith([{ animal: makeAnimal({ id: 'a', name: 'Luna' }), hidden: false }]);
    (gateway.moderateAnimal as jest.Mock).mockRejectedValueOnce(new Error('Falha ao moderar o anúncio: x'));
    const onSelect = jest.fn();
    const { findByTestId, getByTestId, getByText } = await render(
      <ModerationScreen actor={admin} useCase={new ModerateAnimalUseCase(gateway)} onSelectAnimal={onSelect} />
    );
    await findByTestId('moderation-item-a');
    await fireEvent.press(getByTestId('moderate-a'));
    await waitFor(() => expect(getByText('Falha ao moderar o anúncio: x')).toBeTruthy());
    await fireEvent.press(getByText('Luna'));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('ModerateAnimalUseCase.list e SupabaseModerationRepository.listForModeration', () => {
  it('use case: ator ausente e não-admin são recusados', async () => {
    const { gateway } = gatewayWith([]);
    const useCase = new ModerateAnimalUseCase(gateway);
    await expect(useCase.list(null)).rejects.toThrow('Usuário não autenticado.');
    await expect(useCase.list(common)).rejects.toThrow('Somente administradores');
    await expect(useCase.list(admin)).resolves.toEqual([]);
  });

  const row = (id: string, moderation: string) => ({
    id,
    owner_id: 'o1',
    name: id,
    species: 'Cão',
    size: 'Pequeno',
    approximate_age: '1 ano',
    sex: 'Macho',
    description: null,
    health_notes: null,
    special_care: null,
    status: 'AVAILABLE',
    moderation_status: moderation,
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
    latitude: -21.5,
    longitude: -45.4,
    created_at: '2026-11-01T10:00:00.000Z',
    updated_at: '2026-11-01T10:00:00.000Z',
    version: 1,
  });

  it('admin lista inclusive os ocultados, marcando hidden', async () => {
    const db = seedFakeDb({ animals: [row('a', 'NONE'), row('b', 'HIDDEN')] });
    const client = new FakeSupabaseClient({ context: { db, currentUserId: 'adm', isAdmin: true } });
    const entries = await new SupabaseModerationRepository({ client }).listForModeration();
    expect(entries.map((e) => [e.animal.id, e.hidden])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('erro do servidor vira RemoteSupabaseError', async () => {
    const client = new FakeSupabaseClient({
      context: { db: seedFakeDb(), currentUserId: 'adm', isAdmin: true },
    });
    (client as unknown as { from: unknown }).from = () => ({
      select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'boom' } }) }) }),
    });
    await expect(new SupabaseModerationRepository({ client }).listForModeration()).rejects.toThrow(
      'Falha ao listar anúncios para moderação'
    );
  });
});
