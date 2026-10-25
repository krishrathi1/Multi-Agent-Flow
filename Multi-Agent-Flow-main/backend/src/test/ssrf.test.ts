import { describe, it, expect } from 'vitest';
import { isPrivateAddress, safeFetch, validateExternalUrl } from '../lib/url-validator.js';

/**
 * Outbound-request safety for webhooks.
 *
 * Two gaps were demonstrated against the sender before this existed:
 *
 *   - `fetch` follows redirects by default, so a target that passed validation
 *     could answer 307 and carry the POST — body included — to an internal
 *     address. Proven against a local server: the internal service was hit.
 *   - Validation only inspected literal IPs, so any DNS name resolving to a
 *     private address passed. `localtest.me` resolves to 127.0.0.1 and was
 *     accepted.
 *
 * The redirect and DNS-resolution behaviours need real sockets and real DNS,
 * so they are verified by running servers rather than here; what follows is
 * the part that can be asserted hermetically — the decision each of those
 * paths depends on.
 */

describe('private address detection', () => {
  it('catches every range a request must never reach', () => {
    for (const ip of [
      '127.0.0.1',
      '127.1.2.3',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata — the classic SSRF target
      '0.0.0.0',
      '100.64.0.1', // carrier-grade NAT
      '::1',
      'fe80::1',
      'fd00::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('sees through an IPv4-mapped IPv6 address in either spelling', () => {
    // `new URL()` rewrites ::ffff:127.0.0.1 into hex, so matching only the
    // dotted spelling let loopback through in an IPv6 costume.
    for (const ip of [
      '::ffff:127.0.0.1',
      '::ffff:7f00:1', // the same address, as URL normalises it
      '::ffff:169.254.169.254',
      '::ffff:a9fe:a9fe', // 169.254.169.254 in hex
      '0:0:0:0:0:ffff:7f00:1', // fully expanded
      '::ffff:10.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('blocks the IPv6 unspecified address', () => {
    expect(isPrivateAddress('::')).toBe(true);
  });

  it('does not mistake a public address for a mapped private one', () => {
    // ::ffff:8.8.8.8 is public; only the embedded IPv4 decides.
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });

  it('leaves public addresses alone', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '93.184.216.34']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe('safeFetch refuses before it connects', () => {
  it('rejects literal private addresses', async () => {
    // undici skips the connect-time lookup when the host is already an IP, so
    // these have to be caught by validation or they sail straight through.
    for (const url of [
      'http://127.0.0.1:9098/hook',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/internal',
      // URL keeps the brackets on an IPv6 host, so isIP() called it "not an
      // IP" and every IPv6 literal fell through to accepted.
      'http://[::1]:8080/x',
      'http://[fd00::1]/admin',
      'http://[::ffff:127.0.0.1]/x',
      'http://[::ffff:169.254.169.254]/latest/meta-data/',
    ]) {
      await expect(safeFetch(url, { method: 'POST' }), url).rejects.toThrow(
        /private\/internal/i,
      );
    }
  });

  it('rejects non-HTTP protocols', async () => {
    for (const url of ['file:///etc/passwd', 'gopher://x/', 'ftp://host/f']) {
      await expect(safeFetch(url), url).rejects.toThrow(/protocol/i);
    }
  });

  it('rejects embedded credentials', async () => {
    await expect(safeFetch('http://user:pass@example.com/hook')).rejects.toThrow(
      /credentials/i,
    );
  });

  it('rejects hostnames that name the loopback directly', async () => {
    for (const url of ['http://localhost/hook', 'http://metadata.google.internal/x']) {
      await expect(safeFetch(url), url).rejects.toThrow(/private\/internal/i);
    }
  });
});

describe('validateExternalUrl', () => {
  it('still accepts an ordinary public webhook target', () => {
    expect(() => validateExternalUrl('https://hooks.example.com/nexus')).not.toThrow();
  });

  it('rejects a malformed URL rather than passing it to fetch', () => {
    expect(() => validateExternalUrl('not a url')).toThrow(/not a valid URL/i);
  });
});
