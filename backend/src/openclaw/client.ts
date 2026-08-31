import WebSocket from 'ws';
import { logger } from '../lib/logger.js';

interface RpcRequest {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

interface RpcResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

interface RpcEvent {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
}

type GatewayFrame = RpcResponse | RpcEvent;

interface GatewayClientOptions {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

type EventHandler = (event: string, payload: unknown) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private options: GatewayClientOptions;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout>; expectFinal?: boolean }>();
  private eventHandlers: EventHandler[] = [];
  private connected = false;
  private authenticated = false;
  private reconnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: GatewayClientOptions) {
    this.options = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 50,
      ...options,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Set origin to match gateway URL so the loopback origin check passes
        // (required when connecting as openclaw-control-ui client)
        const wsUrl = new URL(this.options.url);
        const origin = `http://${wsUrl.hostname}:${wsUrl.port}`;
        this.ws = new WebSocket(this.options.url, { origin });

        this.ws.on('open', () => {
          logger.info({ url: this.options.url }, 'GatewayClient connected');
          this.connected = true;
          this.reconnectAttempts = 0;
        });

        this.ws.on('message', async (data: WebSocket.RawData) => {
          try {
            const frame: GatewayFrame = JSON.parse(data.toString());
            if (frame.type === 'event') {
              if (frame.event === 'connect.challenge') {
                // Respond to challenge with connect request
                try {
                  await this.authenticate();
                  resolve();
                } catch (err) {
                  reject(err);
                }
              } else {
                // Forward events to handlers
                for (const handler of this.eventHandlers) {
                  try { handler(frame.event, frame.payload); } catch {}
                }
              }
            } else if (frame.type === 'res') {
              const pending = this.pendingRequests.get(frame.id);
              if (pending) {
                const payload = frame.payload as Record<string, unknown> | undefined;
                // Two-phase response: if expectFinal and this is just the "accepted" ack,
                // keep the handler registered and wait for the final response from the gateway.
                if (pending.expectFinal && frame.ok && payload?.status === 'accepted') {
                  clearTimeout(pending.timer);
                  pending.timer = setTimeout(() => {
                    this.pendingRequests.delete(frame.id);
                    pending.reject(new Error(`RPC timeout waiting for agent result: ${frame.id}`));
                  }, 120_000); // 2 minute timeout for LLM responses
                  return;
                }
                clearTimeout(pending.timer);
                this.pendingRequests.delete(frame.id);
                if (frame.ok) {
                  pending.resolve(frame.payload);
                } else {
                  pending.reject(new Error(frame.error?.message || 'RPC error'));
                }
              }
            }
          } catch (err) {
            logger.error({ err }, 'GatewayClient failed to parse message');
          }
        });

        this.ws.on('close', () => {
          logger.info('GatewayClient connection closed');
          this.connected = false;
          this.authenticated = false;
          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Connection closed'));
            this.pendingRequests.delete(id);
          }
          this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
          logger.error({ err }, 'GatewayClient WebSocket error');
          if (!this.connected) {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private async authenticate(): Promise<void> {
    const result = await this.rpc('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        displayName: 'MyceliumOps Backend',
        version: '1.0.0',
        platform: 'linux',
        mode: 'backend',
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
      auth: {
        token: this.options.token,
      },
    });
    this.authenticated = true;
    logger.info('GatewayClient authenticated successfully');
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts || 50)) {
      logger.error('GatewayClient max reconnect attempts reached');
      return;
    }
    this.reconnecting = true;
    const delay = Math.min(this.options.reconnectInterval! * Math.pow(1.5, this.reconnectAttempts), 30000);
    logger.info({ delayMs: Math.round(delay), attempt: this.reconnectAttempts + 1 }, 'GatewayClient reconnecting');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnecting = false;
      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch {
        // connect() failure will trigger another close -> scheduleReconnect
      }
    }, delay);
  }

  async rpc(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Not connected to gateway'));
      }
      const id = `nexus-${++this.requestId}`;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const req: RpcRequest = { type: 'req', id, method, params };
      this.ws.send(JSON.stringify(req));
    });
  }

  /**
   * Send an RPC that uses the OpenClaw two-phase response protocol.
   * The gateway sends an immediate "accepted" ack, then a final response
   * with the actual result after the agent finishes processing.
   */
  async rpcExpectFinal(method: string, params?: unknown, timeoutMs = 120_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Not connected to gateway'));
      }
      const id = `nexus-${++this.requestId}`;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer, expectFinal: true });

      const req: RpcRequest = { type: 'req', id, method, params };
      this.ws.send(JSON.stringify(req));
    });
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }
}

// ─── Gateway Pool (multi-gateway support) ───────────────

const gatewayPool = new Map<string, GatewayClient>();

export function getGatewayClient(gatewayId: string): GatewayClient | undefined {
  return gatewayPool.get(gatewayId);
}

export async function connectGateway(gatewayId: string, url: string, token: string): Promise<GatewayClient> {
  // Close existing connection if any
  const existing = gatewayPool.get(gatewayId);
  if (existing) {
    existing.close();
  }

  const client = new GatewayClient({ url, token });
  try {
    await client.connect();
    gatewayPool.set(gatewayId, client);
    return client;
  } catch (err) {
    logger.error({ gatewayId, err }, 'GatewayPool failed to connect');
    throw err;
  }
}

export function disconnectGateway(gatewayId: string): void {
  const client = gatewayPool.get(gatewayId);
  if (client) {
    client.close();
    gatewayPool.delete(gatewayId);
  }
}

export function disconnectAllGateways(): void {
  for (const [id, client] of gatewayPool) {
    client.close();
  }
  gatewayPool.clear();
}

// Helper to get a connected client or throw
export function requireGatewayClient(gatewayId: string): GatewayClient {
  const client = gatewayPool.get(gatewayId);
  if (!client || !client.isConnected()) {
    throw new Error(`Gateway ${gatewayId} is not connected`);
  }
  return client;
}
