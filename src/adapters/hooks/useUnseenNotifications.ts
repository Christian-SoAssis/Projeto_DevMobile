import { useEffect, useState } from 'react';
import { onNotificationsChanged } from '../sync/notificationEvents';
import { onPullCompleted } from '../sync/pullEvents';
import { BuildNotificationsUseCase } from '../../application/use-cases/BuildNotificationsUseCase';

/**
 * Badge do sino (decisão 20): contagem de não-vistas persistida no aparelho
 * (`app_state`). Recalcula ao abrir a central, ao completar um pull do
 * servidor e quando a fila muda de estado. Sem sessão = 0 (badge some).
 */
export function useUnseenNotifications(
  useCase: BuildNotificationsUseCase | undefined,
  userId: string | null
): number {
  const [unseen, setUnseen] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const bump = () => setPulse((p) => p + 1);
    const offChanged = onNotificationsChanged(bump);
    const offPull = onPullCompleted(bump);
    return () => {
      offChanged();
      offPull();
    };
  }, []);

  useEffect(() => {
    if (!userId || !useCase) {
      setUnseen(0);
      return;
    }
    let active = true;
    useCase
      .execute(userId)
      .then((feed) => {
        if (active) setUnseen(feed.unseenCount);
      })
      .catch(() => {
        if (active) setUnseen(0); // falha de leitura nunca infla o badge
      });
    return () => {
      active = false;
    };
    // pulse: dispara quando eventos de notificação/pull chegam.
  }, [useCase, userId, pulse]);

  return unseen;
}
