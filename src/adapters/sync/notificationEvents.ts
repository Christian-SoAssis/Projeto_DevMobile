/**
 * Canal leve da central de notificações (decisão 20, melhoria #7), mesmo
 * padrão de `pullEvents`: observação de UI, não lógica de domínio.
 *
 * `central` → `notifyNotificationsChanged()` (abrir grava last_seen)
 * `sino`     → `onNotificationsChanged(listener)` reconta o badge.
 */
const listeners = new Set<() => void>();

export function onNotificationsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyNotificationsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
