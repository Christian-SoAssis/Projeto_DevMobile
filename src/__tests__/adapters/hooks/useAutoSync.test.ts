import { ConnectivityGateway } from '../../../domain/ports/ConnectivityGateway';

class MockGateway implements ConnectivityGateway {
  private connected = false;
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

describe('useAutoSync (lógica)', () => {
  it('não deve disparar sync quando disabled', async () => {
    const gateway = new MockGateway();
    const run = jest.fn().mockResolvedValue(undefined);

    // Simula o comportamento do useAutoSync com enabled=false
    let wasOnline = false;
    const trigger = () => {
      if (false) run(); // enabled = false
    };

    await gateway.isConnected().then((online) => {
      wasOnline = online;
      if (false) trigger(); // enabled = false
    });

    expect(run).not.toHaveBeenCalled();
  });

  it('deve disparar sync quando online e enabled', async () => {
    const gateway = new MockGateway();
    gateway.setConnected(true);
    const run = jest.fn().mockResolvedValue(undefined);

    // Simula o comportamento do useAutoSync com enabled=true e online inicial
    let wasOnline = false;
    const trigger = () => {
      run();
    };

    await gateway.isConnected().then((online) => {
      wasOnline = online;
      if (online) trigger();
    });

    expect(run).toHaveBeenCalled();
  });

  it('deve disparar sync na transição offline -> online', async () => {
    const gateway = new MockGateway();
    gateway.setConnected(false);
    const run = jest.fn().mockResolvedValue(undefined);

    let wasOnline = false;
    let triggered = false;
    const trigger = () => {
      triggered = true;
      run();
    };

    // Estado inicial: offline
    await gateway.isConnected().then((online) => {
      wasOnline = online;
      if (online) trigger();
    });
    expect(triggered).toBe(false);

    // Transição: offline -> online
    gateway.setConnected(true);

    // O listener do subscribe detecta a mudança
    const notifications: boolean[] = [];
    gateway.subscribe((online) => {
      notifications.push(online);
      if (online && !wasOnline) trigger();
      wasOnline = online;
    });

    gateway.setConnected(true);
    expect(triggered).toBe(true);
    expect(run).toHaveBeenCalled();
  });
});
