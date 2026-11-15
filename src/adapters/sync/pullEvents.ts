type PullListener = () => void;

const listeners = new Set<PullListener>();

export function subscribePullCompleted(listener: PullListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPullCompleted(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // ignora erro em listener individual
    }
  }
}
