import { ConnectivityGateway } from '../../../domain/ports/ConnectivityGateway';

class MockGateway implements ConnectivityGateway {
  private connected = true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    for (const listener of this.listeners) {
      listener(connected);
    }
  }
}

describe('ConnectivityGateway (mock)', () => {
  it('deve reportar estado inicial de conectividade', async () => {
    const gateway = new MockGateway();
    gateway.setConnected(false);
    const isConnected = await gateway.isConnected();
    expect(isConnected).toBe(false);
  });

  it('deve notificar listeners quando a conectividade muda', async () => {
    const gateway = new MockGateway();
    gateway.setConnected(false);

    const notifications: boolean[] = [];
    const unsubscribe = gateway.subscribe((online) => notifications.push(online));

    gateway.setConnected(true);
    expect(notifications).toContain(true);

    gateway.setConnected(false);
    expect(notifications).toContain(false);

    unsubscribe();
    gateway.setConnected(true);
    expect(notifications.length).toBe(2);
  });
});
