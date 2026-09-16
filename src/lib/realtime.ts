type ClientController = ReadableStreamDefaultController<Uint8Array>;

interface RealtimeGlobal {
  _realtimeClients?: Map<string, ClientController>;
  _realtimePingInterval?: NodeJS.Timeout;
}

const globalForRealtime = globalThis as unknown as RealtimeGlobal;

function getClientsMap(): Map<string, ClientController> {
  if (!globalForRealtime._realtimeClients) {
    globalForRealtime._realtimeClients = new Map<string, ClientController>();
  }
  return globalForRealtime._realtimeClients;
}

// Start a 15-second heartbeat ping if not already running
if (!globalForRealtime._realtimePingInterval) {
  const encoder = new TextEncoder();
  const pingPayload = encoder.encode(': ping\n\n');

  globalForRealtime._realtimePingInterval = setInterval(() => {
    const clients = getClientsMap();
    if (clients.size === 0) return;

    for (const [id, controller] of clients.entries()) {
      try {
        controller.enqueue(pingPayload);
      } catch {
        clients.delete(id);
      }
    }
  }, 15000);
}

export const realtimeHub = {
  subscribe(id: string, controller: ClientController) {
    const clients = getClientsMap();
    clients.set(id, controller);
  },

  unsubscribe(id: string) {
    const clients = getClientsMap();
    clients.delete(id);
  },

  getClientCount(): number {
    return getClientsMap().size;
  },

  broadcast(event: string, data: unknown) {
    const clients = getClientsMap();
    if (clients.size === 0) return;

    const encoder = new TextEncoder();
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = encoder.encode(payload);

    for (const [id, controller] of clients.entries()) {
      try {
        controller.enqueue(encoded);
      } catch {
        clients.delete(id);
      }
    }
  },
};
