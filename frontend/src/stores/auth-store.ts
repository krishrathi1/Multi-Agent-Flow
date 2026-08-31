import { create } from 'zustand';

interface AuthUser { id: string; email: string; name: string }
interface AuthOrg { id: string; name: string; slug: string }
type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface AuthState {
  user: AuthUser | null;
  organization: AuthOrg | null;
  orgRole: OrgRole | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, orgName: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  organization: null,
  orgRole: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send/receive httpOnly cookies
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const data = await res.json();
      // Refresh token is in httpOnly cookie (not in response body)
      set({
        user: data.user,
        organization: data.organization,
        orgRole: data.role,
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  signup: async (email, password, name, orgName) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, orgName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Signup failed');
      }
      // Signup no longer returns tokens — user must verify email first
      set({ isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    const { accessToken } = get();
    try {
      if (accessToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          credentials: 'include', // send httpOnly cookie so backend can invalidate it
        });
      }
    } catch {} // ignore errors
    set({ user: null, organization: null, orgRole: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  initialize: async () => {
    try {
      // Try to refresh using the httpOnly cookie (automatically sent)
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send httpOnly cookie
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();

      // Now get user info
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
        credentials: 'include',
      });
      if (!meRes.ok) throw new Error('Failed to get user');
      const meData = await meRes.json();

      set({
        user: meData.user,
        organization: meData.organization,
        orgRole: meData.role,
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  clearAuth: () => {
    set({ user: null, organization: null, orgRole: null, accessToken: null, isAuthenticated: false });
  },
}));
