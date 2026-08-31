import { EventEmitter } from 'events';
import { logger } from '../../lib/logger.js';

export type MemoryTier = 'working' | 'episodic' | 'semantic';

export interface MemoryRecord {
  id: string;
  orgId: string;
  namespace: string;
  tier: MemoryTier;
  agentId?: string;
  content: string;
  vector: number[];
  metadata: Record<string, any>;
  tags: string[];
  accessCount: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  record: MemoryRecord;
  similarity: number;
  rank: number;
}

export interface RVFExport {
  version: '1.2.0';
  exportedAt: string;
  namespace: string;
  recordCount: number;
  records: MemoryRecord[];
  checksum: string;
}

export class MemoryService extends EventEmitter {
  private records: Map<string, MemoryRecord> = new Map();
  private vectorDimensions = 64;

  constructor() {
    super();
    this.seedDefaultKnowledge();
  }

  private generatePseudoEmbedding(text: string): number[] {
    // Deterministic embedding vector generator based on text hashing
    const vector: number[] = new Array(this.vectorDimensions).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < this.vectorDimensions; i++) {
      const val = Math.sin(hash + i * 137.5) * 0.5 + Math.cos(text.length * (i + 1)) * 0.5;
      vector[i] = Number(val.toFixed(6));
    }
    // Normalize vector
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => Number((v / norm).toFixed(6)));
  }

  private cosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) return 0;
    let dot = 0;
    let n1 = 0;
    let n2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      n1 += v1[i] * v1[i];
      n2 += v2[i] * v2[i];
    }
    const denom = Math.sqrt(n1) * Math.sqrt(n2);
    return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
  }

  private seedDefaultKnowledge() {
    const defaultEntries = [
      {
        namespace: 'global',
        tier: 'semantic' as MemoryTier,
        content: 'System architecture utilizes Prisma ORM with PostgreSQL, Express 5 backend, and React 19 frontend.',
        tags: ['architecture', 'tech-stack', 'system'],
        metadata: { category: 'core_docs' }
      },
      {
        namespace: 'global',
        tier: 'semantic' as MemoryTier,
        content: 'OpenClaw WebSocket RPC gateway runs on port 18789 for live agent runtime interaction.',
        tags: ['gateway', 'openclaw', 'rpc'],
        metadata: { category: 'networking' }
      },
      {
        namespace: 'security',
        tier: 'semantic' as MemoryTier,
        content: 'Zero-trust federation requires Ed25519 signature checks and mandatory 14-pattern PII scrubbing before egress.',
        tags: ['security', 'federation', 'pii'],
        metadata: { category: 'compliance' }
      },
      {
        namespace: 'workflows',
        tier: 'episodic' as MemoryTier,
        content: 'Run #1042 successfully built and verified the auth module across 4 parallel agent stages.',
        tags: ['run-history', 'auth', 'verification'],
        metadata: { runId: 'run-1042', status: 'success' }
      }
    ];

    defaultEntries.forEach((entry, idx) => {
      const id = `mem-seed-${idx + 1}`;
      const vector = this.generatePseudoEmbedding(entry.content);
      this.records.set(id, {
        id,
        orgId: 'default',
        namespace: entry.namespace,
        tier: entry.tier,
        agentId: 'system',
        content: entry.content,
        vector,
        metadata: entry.metadata,
        tags: entry.tags,
        accessCount: 5,
        confidence: 0.98,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  }

  async store(params: {
    orgId?: string;
    namespace?: string;
    tier?: MemoryTier;
    agentId?: string;
    content: string;
    tags?: string[];
    metadata?: Record<string, any>;
    customVector?: number[];
  }): Promise<MemoryRecord> {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const vector = params.customVector || this.generatePseudoEmbedding(params.content);

    const record: MemoryRecord = {
      id,
      orgId: params.orgId || 'default',
      namespace: params.namespace || 'default',
      tier: params.tier || 'working',
      agentId: params.agentId || 'system',
      content: params.content,
      vector,
      metadata: params.metadata || {},
      tags: params.tags || [],
      accessCount: 0,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.records.set(id, record);
    this.emit('memory:stored', record);
    return record;
  }

  async search(params: {
    query: string;
    orgId?: string;
    namespace?: string;
    tier?: MemoryTier;
    limit?: number;
    threshold?: number;
  }): Promise<MemorySearchResult[]> {
    const queryVector = this.generatePseudoEmbedding(params.query);
    const limit = params.limit || 10;
    const threshold = params.threshold ?? 0.45;

    const candidates: MemorySearchResult[] = [];

    for (const record of this.records.values()) {
      if (params.orgId && params.orgId !== 'default' && record.orgId !== params.orgId) continue;
      if (params.namespace && record.namespace !== params.namespace) continue;
      if (params.tier && record.tier !== params.tier) continue;

      const similarity = this.cosineSimilarity(queryVector, record.vector);
      if (similarity >= threshold) {
        // Increment access count
        record.accessCount++;
        candidates.push({
          record,
          similarity: Number(similarity.toFixed(4)),
          rank: 0
        });
      }
    }

    candidates.sort((a, b) => b.similarity - a.similarity);
    const results = candidates.slice(0, limit);
    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return results;
  }

  async listNamespaces(orgId?: string): Promise<Array<{ namespace: string; count: number; tiers: Record<string, number> }>> {
    const counts = new Map<string, { count: number; tiers: Record<string, number> }>();

    for (const record of this.records.values()) {
      if (orgId && orgId !== 'default' && record.orgId !== orgId) continue;
      if (!counts.has(record.namespace)) {
        counts.set(record.namespace, { count: 0, tiers: { working: 0, episodic: 0, semantic: 0 } });
      }
      const data = counts.get(record.namespace)!;
      data.count++;
      data.tiers[record.tier] = (data.tiers[record.tier] || 0) + 1;
    }

    return Array.from(counts.entries()).map(([namespace, data]) => ({
      namespace,
      count: data.count,
      tiers: data.tiers
    }));
  }

  async listRecords(params: {
    orgId?: string;
    namespace?: string;
    tier?: MemoryTier;
    limit?: number;
  }): Promise<MemoryRecord[]> {
    const list: MemoryRecord[] = [];
    const limit = params.limit || 50;

    for (const record of this.records.values()) {
      if (params.orgId && params.orgId !== 'default' && record.orgId !== params.orgId) continue;
      if (params.namespace && record.namespace !== params.namespace) continue;
      if (params.tier && record.tier !== params.tier) continue;
      list.push(record);
      if (list.length >= limit) break;
    }

    return list;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const deleted = this.records.delete(id);
    if (deleted) this.emit('memory:deleted', { id });
    return deleted;
  }

  async exportRVF(namespace: string): Promise<RVFExport> {
    const records = Array.from(this.records.values()).filter(r => r.namespace === namespace);
    return {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      namespace,
      recordCount: records.length,
      records,
      checksum: `rvf-chk-${Date.now().toString(16)}`
    };
  }

  async importRVF(exportData: RVFExport): Promise<{ importedCount: number }> {
    let count = 0;
    if (Array.isArray(exportData.records)) {
      for (const rec of exportData.records) {
        this.records.set(rec.id, {
          ...rec,
          updatedAt: new Date().toISOString()
        });
        count++;
      }
    }
    this.emit('memory:imported', { namespace: exportData.namespace, count });
    return { importedCount: count };
  }
}

export const memoryService = new MemoryService();
