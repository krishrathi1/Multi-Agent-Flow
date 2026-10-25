import { create } from 'zustand';

interface AuthUser { id: string; email: string; name: string }
interface AuthOrg { id: string; name: string; slug: string }
type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface AuthState {
  user: AuthUser | null;
  organization: AuthOrg | null;
  orgRole: OrgRole | null;
  organizations: Array<AuthOrg & { role?: OrgRole; isCurrent?: boolean }>;
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
  switchOrganization: (orgId: string) => Promise<void>;
  fetchOrganizations: () => Promise<void>;
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  organization: null,
  orgRole: null,
  organizations: [],
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pinggy-No-Screen': 'true' },
        credentials: 'include', // send/receive httpOnly cookies
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const data = await res.json();
      set({
        user: data.user,
        organization: data.organization,
        orgRole: data.role,
        accessToken: data.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      get().fetchOrganizations().catch(() => {});
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  signup: async (email, password, name, orgName) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pinggy-No-Screen': 'true' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, orgName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Signup failed');
      }
      const data = await res.json();
      set({ isLoading: false });
      return data;
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    const { accessToken } = get();
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });
    } catch {}
    set({
      user: null,
      organization: null,
      orgRole: null,
      organizations: [],
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initialize: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pinggy-No-Screen': 'true' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();

      const meRes = await fetch(`${API_BASE}/auth/me`, {
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
      get().fetchOrganizations().catch(() => {});
    } catch {
      set({ isLoading: false });
    }
  },

  switchOrganization: async (orgId: string) => {
    const { accessToken } = get();
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          'X-Organization-Id': orgId,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to switch organization');
      const meData = await res.json();
      set({
        user: meData.user,
        organization: meData.organization,
        orgRole: meData.role,
      });
      const currentOrgs = get().organizations.map((o) => ({
        ...o,
        isCurrent: o.id === orgId,
      }));
      set({ organizations: currentOrgs });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchOrganizations: async () => {
    const { accessToken, organization } = get();
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/auth/organizations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.organizations)) {
          set({
            organizations: data.organizations.map((o: any) => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              role: o.role,
              isCurrent: o.id === organization?.id,
            })),
          });
        }
      }
    } catch {}
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  clearAuth: () => {
    set({ user: null, organization: null, orgRole: null, organizations: [], accessToken: null, isAuthenticated: false });
  },
}));
