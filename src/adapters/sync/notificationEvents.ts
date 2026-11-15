type NotificationListener = () => void;

const listeners = new Set<NotificationListener>();

export function subscribeNotificationsChanged(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyNotificationsChanged(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // ignora
    }
  }
}
