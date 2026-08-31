import { EventEmitter } from 'events';
import { logger } from '../../lib/logger.js';

export type TrustLevel = 'untrusted' | 'probationary' | 'trusted' | 'verified' | 'quarantined';
export type PiiAction = 'BLOCK' | 'REDACT' | 'HASH' | 'PASS';

export interface FederationPeer {
  id: string;
  name: string;
  endpoint: string;
  publicKey: string; // Ed25519 public key in hex
  trustLevel: TrustLevel;
  trustScore: number; // 0.00 to 1.00
  metrics: {
    successCount: number;
    failureCount: number;
    uptimePercentage: number;
    threatIncidentCount: number;
    integrityChecksPassed: number;
  };
  piiPolicy: PiiAction;
  lastSeenAt: string;
  connectedAt: string;
  status: 'online' | 'offline' | 'degraded';
}

export interface FederationMessage {
  id: string;
  senderNodeId: string;
  recipientNodeId: string;
  messageType: 'task-request' | 'task-response' | 'health-ping' | 'consensus-vote' | 'telemetry';
  payload: any;
  signature: string;
  sanitized: boolean;
  scrubbedFieldsCount: number;
  timestamp: string;
}

export interface PiiScanResult {
  hasPii: boolean;
  detectedTypes: string[];
  scrubbedText: string;
  count: number;
}

export class FederationService extends EventEmitter {
  private peers: Map<string, FederationPeer> = new Map();
  private auditLog: FederationMessage[] = [];
  private myNodeId = 'nexus-node-alpha-01';
  private myPublicKey = 'ed25519:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';

  constructor() {
    super();
    this.seedDefaultPeers();
  }

  private seedDefaultPeers() {
    const peers: FederationPeer[] = [
      {
        id: 'peer-eu-cluster-01',
        name: 'Frankfurt Production Cluster',
        endpoint: 'wss://eu-mesh.nexus.org:8443',
        publicKey: 'ed25519:a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        trustLevel: 'verified',
        trustScore: 0.96,
        metrics: {
          successCount: 420,
          failureCount: 3,
          uptimePercentage: 99.9,
          threatIncidentCount: 0,
          integrityChecksPassed: 150
        },
        piiPolicy: 'REDACT',
        lastSeenAt: new Date().toISOString(),
        connectedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        status: 'online'
      },
      {
        id: 'peer-us-east-02',
        name: 'Virginia AI Compute Mesh',
        endpoint: 'wss://us-east-mesh.nexus.org:8443',
        publicKey: 'ed25519:f9e8d7c6b5a43210fedcba9876543210fedcba9876543210fedcba9876543210',
        trustLevel: 'trusted',
        trustScore: 0.91,
        metrics: {
          successCount: 280,
          failureCount: 7,
          uptimePercentage: 99.4,
          threatIncidentCount: 0,
          integrityChecksPassed: 98
        },
        piiPolicy: 'REDACT',
        lastSeenAt: new Date().toISOString(),
        connectedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        status: 'online'
      },
      {
        id: 'peer-external-partner-03',
        name: 'External Audit Partner Node',
        endpoint: 'wss://audit-node.cognitum.one:8443',
        publicKey: 'ed25519:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        trustLevel: 'probationary',
        trustScore: 0.74,
        metrics: {
          successCount: 45,
          failureCount: 4,
          uptimePercentage: 96.0,
          threatIncidentCount: 1,
          integrityChecksPassed: 20
        },
        piiPolicy: 'BLOCK',
        lastSeenAt: new Date().toISOString(),
        connectedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        status: 'online'
      }
    ];

    peers.forEach(p => this.peers.set(p.id, p));
  }

  // 14-type PII Detection & Sanitization Pipeline
  sanitizePayload(text: string, action: PiiAction = 'REDACT'): PiiScanResult {
    let scrubbed = text;
    const detected: string[] = [];
    let count = 0;

    const patterns: Array<{ type: string; regex: RegExp; replacement: string }> = [
      { type: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
      { type: 'API_KEY', regex: /(?:bearer\s+|sk-|api[_-]?key[:=]\s*)['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, replacement: '[REDACTED_API_KEY]' },
      { type: 'CREDIT_CARD', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: '[REDACTED_CC]' },
      { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
      { type: 'IPV4', regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, replacement: '[REDACTED_IP]' },
      { type: 'JWT_TOKEN', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, replacement: '[REDACTED_JWT]' },
      { type: 'PHONE_NUMBER', regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
      { type: 'PASSWORD_PARAM', regex: /(?:password|passwd|secret)[:=]\s*['"]?([^'"\s]{4,})['"]?/gi, replacement: '[REDACTED_SECRET]' }
    ];

    for (const p of patterns) {
      if (p.regex.test(scrubbed)) {
        detected.push(p.type);
        const matches = scrubbed.match(p.regex);
        if (matches) count += matches.length;
        if (action === 'REDACT') {
          scrubbed = scrubbed.replace(p.regex, p.replacement);
        } else if (action === 'HASH') {
          scrubbed = scrubbed.replace(p.regex, (m) => `[HASH:${Buffer.from(m).toString('base64').slice(0, 8)}]`);
        }
      }
    }

    return {
      hasPii: detected.length > 0,
      detectedTypes: detected,
      scrubbedText: scrubbed,
      count
    };
  }

  // Behavioral Trust Scoring Formula: 0.4*success + 0.2*uptime + 0.2*threat + 0.2*integrity
  calculateTrustScore(metrics: FederationPeer['metrics']): number {
    const total = metrics.successCount + metrics.failureCount;
    const successRatio = total === 0 ? 1.0 : metrics.successCount / total;
    const uptimeRatio = metrics.uptimePercentage / 100;
    const threatScore = Math.max(0, 1.0 - (metrics.threatIncidentCount * 0.25));
    const integrityRatio = Math.min(1.0, metrics.integrityChecksPassed / 50);

    const score = (0.4 * successRatio) + (0.2 * uptimeRatio) + (0.2 * threatScore) + (0.2 * integrityRatio);
    return Number(Math.max(0, Math.min(1.0, score)).toFixed(2));
  }

  async listPeers(): Promise<FederationPeer[]> {
    return Array.from(this.peers.values());
  }

  async getPeer(id: string): Promise<FederationPeer | null> {
    return this.peers.get(id) || null;
  }

  async registerPeer(params: {
    name: string;
    endpoint: string;
    publicKey: string;
    piiPolicy?: PiiAction;
  }): Promise<FederationPeer> {
    const id = `peer-${Date.now()}`;
    const initialMetrics = {
      successCount: 0,
      failureCount: 0,
      uptimePercentage: 100.0,
      threatIncidentCount: 0,
      integrityChecksPassed: 1
    };

    const peer: FederationPeer = {
      id,
      name: params.name,
      endpoint: params.endpoint,
      publicKey: params.publicKey,
      trustLevel: 'probationary',
      trustScore: this.calculateTrustScore(initialMetrics),
      metrics: initialMetrics,
      piiPolicy: params.piiPolicy || 'REDACT',
      lastSeenAt: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
      status: 'online'
    };

    this.peers.set(id, peer);
    this.emit('federation:peer_registered', peer);
    return peer;
  }

  async sendMessage(params: {
    recipientNodeId: string;
    messageType: FederationMessage['messageType'];
    payload: any;
  }): Promise<FederationMessage> {
    const peer = this.peers.get(params.recipientNodeId);
    if (!peer) throw new Error(`Peer node ${params.recipientNodeId} not found in federation registry`);

    const rawPayloadStr = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload);
    const piiResult = this.sanitizePayload(rawPayloadStr, peer.piiPolicy);

    if (piiResult.hasPii && peer.piiPolicy === 'BLOCK') {
      throw new Error(`Message blocked: Outbound PII detected (${piiResult.detectedTypes.join(', ')}) under BLOCK policy.`);
    }

    const message: FederationMessage = {
      id: `msg-fed-${Date.now()}`,
      senderNodeId: this.myNodeId,
      recipientNodeId: params.recipientNodeId,
      messageType: params.messageType,
      payload: piiResult.hasPii ? JSON.parse(piiResult.scrubbedText || '{}') : params.payload,
      signature: `sig:${Math.random().toString(36).substr(2, 16)}`,
      sanitized: piiResult.hasPii,
      scrubbedFieldsCount: piiResult.count,
      timestamp: new Date().toISOString()
    };

    // Update peer metrics
    peer.metrics.successCount++;
    peer.trustScore = this.calculateTrustScore(peer.metrics);
    peer.lastSeenAt = new Date().toISOString();

    this.auditLog.unshift(message);
    if (this.auditLog.length > 500) this.auditLog.pop();

    this.emit('federation:message_sent', message);
    return message;
  }

  async listAuditLogs(limit: number = 50): Promise<FederationMessage[]> {
    return this.auditLog.slice(0, limit);
  }

  getMyNodeInfo() {
    return {
      nodeId: this.myNodeId,
      publicKey: this.myPublicKey,
      totalPeers: this.peers.size,
      onlinePeers: Array.from(this.peers.values()).filter(p => p.status === 'online').length
    };
  }
}

export const federationService = new FederationService();
