import { AppStateRepository } from '../../domain/ports/AppStateRepository';
import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';

const MAX_EVENTS = 100;

export interface InterestWithdrawalEvent {
  id: string;
  interestId: string;
  animalId: string;
  animalName: string;
  interestedUserName: string;
  withdrawnAt: string;
}

export const interestWithdrawalsKey = (ownerId: string): string =>
  `interest_withdrawals:${ownerId}`;

export function parseInterestWithdrawalEvents(raw: string | null): InterestWithdrawalEvent[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (event): event is InterestWithdrawalEvent =>
        typeof event?.id === 'string' &&
        typeof event?.interestId === 'string' &&
        typeof event?.animalId === 'string' &&
        typeof event?.animalName === 'string' &&
        typeof event?.interestedUserName === 'string' &&
        typeof event?.withdrawnAt === 'string'
    );
  } catch {
    return [];
  }
}

export async function recordInterestWithdrawal(
  appStateRepository: AppStateRepository,
  ownerId: string,
  animalName: string,
  interest: AdoptionInterest
): Promise<void> {
  const key = interestWithdrawalsKey(ownerId);
  const existing = parseInterestWithdrawalEvents(await appStateRepository.get(key));
  const eventId = `withdrawn:${interest.id}`;
  if (existing.some((event) => event.id === eventId)) return;

  const event: InterestWithdrawalEvent = {
    id: eventId,
    interestId: interest.id,
    animalId: interest.animalId,
    animalName,
    interestedUserName: interest.userName || 'Um interessado',
    withdrawnAt: new Date().toISOString(),
  };
  await appStateRepository.set(key, JSON.stringify([event, ...existing].slice(0, MAX_EVENTS)));
}
