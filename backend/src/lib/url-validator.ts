import { URL } from 'url';
import { isIP } from 'net';
import dns from 'node:dns';
import { Agent } from 'undici';

// Private/internal IP ranges that should be blocked for SSRF protection
const PRIVATE_RANGES = [
  /^127\./,                         // Loopback
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^169\.254\./,                    // Link-local
  /^0\./,                           // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT
  /^::1$/,                          // IPv6 loopback
  /^fe80:/i,                        // IPv6 link-local
  /^fc00:/i,                        // IPv6 unique local
  /^fd/i,                           // IPv6 unique local
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',       // GCP metadata
  'metadata.google',
  'instance-data',                  // Generic cloud metadata
];

/**
 * Extracts the IPv4 address from an IPv4-mapped IPv6 one, or null.
 *
 * Needed because `new URL()` rewrites `::ffff:127.0.0.1` into its hex form
 * `::ffff:7f00:1`, so matching on the dotted spelling alone misses loopback
 * arriving in an IPv6 costume.
 */
function mappedIpv4(address: string): string | null {
  if (!address.includes(':')) return null;

  // Expand the "::" shorthand into a full eight-group address.
  const [head, tail] = address.toLowerCase().split('::', 2);
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail ? tail.split(':') : [];

  // A trailing dotted quad occupies the final two groups.
  let dotted: string | null = null;
  const last = tailParts.length > 0 ? tailParts[tailParts.length - 1] : headParts[headParts.length - 1];
  if (last && /^\d{1,3}(\.\d{1,3}){3}$/.test(last)) {
    dotted = last;
    if (tailParts.length > 0) tailParts.pop();
    else headParts.pop();
  }

  const fillTo = dotted ? 6 : 8;
  const groups =
    tail !== undefined
      ? [...headParts, ...Array(Math.max(0, fillTo - headParts.length - tailParts.length)).fill('0'), ...tailParts]
      : headParts;
  if (groups.length !== fillTo) return null;

  // IPv4-mapped means the first five groups are zero and the sixth is ffff.
  const isMapped =
    groups.slice(0, 5).every((g) => parseInt(g || '0', 16) === 0) &&
    parseInt(groups[5] || '0', 16) === 0xffff;
  if (!isMapped) return null;

  if (dotted) return dotted;
  const a = parseInt(groups[6] || '0', 16);
  const b = parseInt(groups[7] || '0', 16);
  return `${(a >> 8) & 255}.${a & 255}.${(b >> 8) & 255}.${b & 255}`;
}

/** True for an address literal inside a range we must never dial. */
export function isPrivateAddress(address: string): boolean {
  const bare = address.toLowerCase().replace(/^\[|\]$/g, '');

  // The IPv6 unspecified address behaves like 0.0.0.0.
  if (bare === '::' || bare === '0:0:0:0:0:0:0:0') return true;

  if (PRIVATE_RANGES.some((re) => re.test(bare))) return true;

  // Check the IPv4 hiding inside an IPv4-mapped IPv6 address too.
  const mapped = mappedIpv4(bare);
  return mapped !== null && PRIVATE_RANGES.some((re) => re.test(mapped));
}

function isPrivateIpOrHostname(hostname: string): boolean {
  // Check blocked hostnames
  const lowerHost = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.some(b => lowerHost === b || lowerHost.endsWith('.' + b))) {
    return true;
  }

  // `new URL("http://[::1]/").hostname` keeps the brackets, and isIP() says
  // "[::1]" is not an IP — so every IPv6 literal, loopback included, used to
  // fall through to the "unknown hostname" branch and be accepted.
  const bare = lowerHost.startsWith('[') && lowerHost.endsWith(']')
    ? lowerHost.slice(1, -1)
    : lowerHost;

  // Check if it's a direct IP address in private ranges
  if (isIP(bare)) {
    return isPrivateAddress(bare);
  }

  // A bare hostname tells us nothing on its own — only resolution does, and
  // that happens at connect time in `safeFetchAgent`.
  return false;
}

/**
 * Validate a user-provided URL for SSRF safety.
 * Allows only http/https/ws/wss and blocks internal/private addresses.
 */
export function validateExternalUrl(urlString: string, label = 'URL', allowPrivate = false): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid ${label}: not a valid URL`);
  }

  // Only allow safe protocols
  const allowedProtocols = ['http:', 'https:', 'ws:', 'wss:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(`Invalid ${label}: protocol must be http, https, ws, or wss`);
  }

  // Block private/internal addresses unless explicitly permitted (e.g. local MCP or gateway)
  if (!allowPrivate && isPrivateIpOrHostname(parsed.hostname)) {
    throw new Error(`Invalid ${label}: cannot point to private/internal addresses`);
  }

  // Block URLs with credentials
  if (parsed.username || parsed.password) {
    throw new Error(`Invalid ${label}: URLs with embedded credentials are not allowed`);
  }

  return parsed;
}

/* ---- Outbound request safety --------------------------------------------
   Validating a URL string is not the same as controlling where the request
   lands. Two gaps were demonstrated against the webhook sender:

     1. `fetch` follows redirects by default, so a target that passed
        validation could answer 307 and carry the POST — body included — to
        http://169.254.169.254/. Validation of the first hop said nothing
        about the second.

     2. `validateExternalUrl` only inspects literal IPs, so any DNS name
        resolving to a private address passed untouched. `localtest.me`
        resolves to 127.0.0.1 and was accepted.

   Resolving the name up front and then calling fetch would still leave a
   window where the name resolves differently between the check and the
   connection. Validating inside the lookup closes that: the address that is
   approved is the address that gets dialled.
   ------------------------------------------------------------------------ */

/**
 * Dispatcher that refuses to connect to a private address, whichever name
 * pointed at it. Pass as `{ dispatcher: safeFetchAgent }`.
 */
export const safeFetchAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, '', 0);

        const list = Array.isArray(addresses) ? addresses : [addresses];
        const blocked = list.find((a) => isPrivateAddress(a.address));
        if (blocked) {
          return callback(
            new Error(`Blocked: ${hostname} resolves to private address ${blocked.address}`),
            '',
            0,
          );
        }
        // Cast: Node's callback type is the single-address overload, but `all`
        // makes this the list form, which undici handles.
        callback(null, list as unknown as string, 0);
      });
    },
  },
});

/**
 * POSTs to an untrusted URL without letting it reach anything internal.
 *
 * Redirects are surfaced rather than followed — a 3xx is reported to the
 * caller as the outcome, so a target cannot use one to change the
 * destination after validation.
 */
export async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  // The connect-time lookup does not run when the host is already an IP
  // literal — undici has nothing to resolve — so 127.0.0.1 would sail past it.
  // Validating here makes safeFetch safe on its own rather than only when the
  // caller remembered to check first.
  validateExternalUrl(url, 'Request URL');

  const { timeoutMs = 10_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      // Never chase a redirect: the new location was never validated.
      redirect: 'manual',
      // @ts-expect-error -- undici accepts `dispatcher`; the DOM types do not.
      dispatcher: safeFetchAgent,
    });
  } finally {
    clearTimeout(timer);
  }
}
