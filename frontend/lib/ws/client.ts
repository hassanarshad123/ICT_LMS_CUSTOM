const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(path: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    this.url = `${WS_BASE}${path}${token ? `?token=${token}` : ''}`;
  }

  connect() {
    if (typeof window === 'undefined') return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type;
          const handlers = this.handlers.get(type) || [];
          handlers.forEach((handler) => handler(data));
        } catch {}
      };

      this.ws.onclose = () => {
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        }
      };

      this.ws.onerror = () => {};
    } catch {}
  }

  on(type: string, handler: (data: any) => void) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: (data: any) => void) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      this.handlers.set(type, handlers.filter((h) => h !== handler));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
