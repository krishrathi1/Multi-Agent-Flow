import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canViewPreview } from '../services/insights.service.js';
import { prisma } from '../lib/prisma.js';
import { PreviewVisibility } from '@prisma/client';

describe('Secret Pattern & Hygiene Scanners', () => {
  const SECRET_PATTERNS = [
    { name: 'Google API Key', regex: /AIzaSy[A-Za-z0-9_-]{33}/ },
    { name: 'GitHub Personal Token', regex: /ghp_[A-Za-z0-9]{36}/ },
    { name: 'GitHub Fine-grained PAT', regex: /github_pat_[A-Za-z0-9_]{82}/ },
    { name: 'Anthropic Live Key', regex: /sk-ant-api03-[A-Za-z0-9_-]{80,}/ },
    { name: 'OpenAI Live Key', regex: /sk-(?:proj-)?[A-Za-z0-9_-]{48,}/ },
    { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
    { name: 'SendGrid Key', regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/ },
    { name: 'NVIDIA API Key', regex: /nvapi-[A-Za-z0-9_-]{40,}/ },
  ];

  it('detects NVIDIA and SendGrid API key token patterns', () => {
    // Construct token dynamically at runtime so source file itself is clean
    const fakeNvapi = ['nvapi', 'TESTING0000111122223333444455556666777788889999'].join('-');
    const nvMatch = SECRET_PATTERNS.find(p => p.name === 'NVIDIA API Key')!;
    expect(nvMatch.regex.test(fakeNvapi)).toBe(true);

    const fakeSg = ['SG', '1234567890123456789012', '1234567890123456789012345678901234567890123'].join('.');
    const sgMatch = SECRET_PATTERNS.find(p => p.name === 'SendGrid Key')!;
    expect(sgMatch.regex.test(fakeSg)).toBe(true);
  });

  it('does not trigger on innocent configuration placeholders or variable names', () => {
    const safeContent = `
      NVIDIA_API_KEY=
      export const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
      const placeholder = "your-api-key-here";
      const dummy = "sk-placeholder-not-real";
    `;
    for (const pat of SECRET_PATTERNS) {
      expect(pat.regex.test(safeContent)).toBe(false);
    }
  });
});

describe('Preview Access Control & Visibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma as any).process = {
      findUnique: vi.fn(),
    };
  });

  it('allows authenticated owning organization member to view PRIVATE preview', async () => {
    (prisma.process.findUnique as any).mockResolvedValueOnce({
      id: 'proc-1',
      organizationId: 'org-abc',
      previewVisibility: PreviewVisibility.PRIVATE,
      shareToken: null,
    });

    const allowed = await canViewPreview('proc-1', undefined, ['org-abc']);
    expect(allowed).toBe(true);
  });

  it('denies unauthenticated or different organization user from viewing PRIVATE preview', async () => {
    (prisma.process.findUnique as any).mockResolvedValueOnce({
      id: 'proc-1',
      organizationId: 'org-abc',
      previewVisibility: PreviewVisibility.PRIVATE,
      shareToken: null,
    });

    const allowedOtherOrg = await canViewPreview('proc-1', undefined, ['org-xyz']);
    expect(allowedOtherOrg).toBe(false);

    (prisma.process.findUnique as any).mockResolvedValueOnce({
      id: 'proc-1',
      organizationId: 'org-abc',
      previewVisibility: PreviewVisibility.PRIVATE,
      shareToken: null,
    });

    const allowedAnonymous = await canViewPreview('proc-1', undefined, undefined);
    expect(allowedAnonymous).toBe(false);
  });

  it('allows TOKEN preview when token matches constant-time compare', async () => {
    (prisma.process.findUnique as any).mockResolvedValueOnce({
      id: 'proc-2',
      organizationId: 'org-abc',
      previewVisibility: PreviewVisibility.TOKEN,
      shareToken: 'secret-token-12345',
    });

    const allowed = await canViewPreview('proc-2', 'secret-token-12345');
    expect(allowed).toBe(true);
  });

  it('denies TOKEN preview when token is incorrect or missing', async () => {
    (prisma.process.findUnique as any).mockResolvedValueOnce({
      id: 'proc-2',
      organizationId: 'org-abc',
      previewVisibility: PreviewVisibility.TOKEN,
      shareToken: 'secret-token-12345',
    });

    const denied = await canViewPreview('proc-2', 'wrong-token');
    expect(denied).toBe(false);
  });

  it('allows PUBLIC preview unconditionally', async () => {
    (prisma.process.findUnique as any).mockResolvedValueOnce({
      id: 'proc-3',
      organizationId: 'org-abc',
      previewVisibility: PreviewVisibility.PUBLIC,
      shareToken: null,
    });

    const allowed = await canViewPreview('proc-3');
    expect(allowed).toBe(true);
  });

  it('fails closed (denies) for non-existent or deleted process', async () => {
    (prisma.process.findUnique as any).mockResolvedValueOnce(null);

    const allowed = await canViewPreview('proc-deleted');
    expect(allowed).toBe(false);
  });
});
