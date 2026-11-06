/**
 * Canal leve de eventos da camada de adapters (OFF-02, ordem 4 — checklist
 * T28): quando o pull do servidor completa, o cache local muda e as telas
 * que já estão abertas precisam re-consultar. Isso é _observação de UI_,
 * não lógica de domínio — a camada `application` permanece pura.
 *
 * `pull` → `notifyPullCompleted()` (disparado pelo ciclo de sync)
 * `tela` → `onPullCompleted(listener)` refaz a última consulta.
 */
const listeners = new Set<() => void>();

export function onPullCompleted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPullCompleted(): void {
  for (const listener of listeners) {
    listener();
  }
}
