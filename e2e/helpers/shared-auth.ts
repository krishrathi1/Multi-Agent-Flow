import { request } from '@playwright/test';

// Single shared auth cache per worker process
let cached: { accessToken: string; user: any; organization: any; role: string } | null = null;
let pending: Promise<typeof cached> | null = null;

async function doLogin() {
  const ctx = await request.newContext({ baseURL: process.env.E2E_API_URL || 'http://localhost:4000' });
  // Retry up to 3 times to handle transient 401 errors
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await ctx.post('/api/auth/login', {
      data: { email: process.env.E2E_TEST_EMAIL || 'test@nexus.local', password: process.env.E2E_TEST_PASSWORD || 'TestPass123' },
    });
    if (res.ok()) {
      const data = await res.json();
      await ctx.dispose();
      return {
        accessToken: data.accessToken,
        user: data.user,
        organization: data.organization,
        role: data.role,
      };
    }
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    } else {
      const text = await res.text();
      await ctx.dispose();
      throw new Error(`Shared auth login failed after 3 attempts (${res.status()}): ${text}`);
    }
  }
  throw new Error('Unreachable');
}

export async function getSharedAuth() {
  if (cached) return cached;
  // Deduplicate concurrent calls within the same worker
  if (!pending) {
    pending = doLogin();
  }
  cached = await pending;
  return cached!;
}
