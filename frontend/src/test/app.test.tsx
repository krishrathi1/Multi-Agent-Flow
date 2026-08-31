import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// A. Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

import { cn, timeAgo, statusColors, statusTextColors } from '../lib/utils';

describe('Utility Functions', () => {
  // cn — class name merging
  describe('cn', () => {
    it('merges classes correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
    });

    it('resolves Tailwind conflicts (last wins)', () => {
      // tailwind-merge keeps the later padding value
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('resolves conflicting text colors', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('returns empty string for no arguments', () => {
      expect(cn()).toBe('');
    });

    it('handles arrays of classes', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('filters out falsy values', () => {
      expect(cn('a', null, undefined, false, 'b')).toBe('a b');
    });
  });

  // timeAgo — relative time formatting
  describe('timeAgo', () => {
    it('returns "Never" for null', () => {
      expect(timeAgo(null)).toBe('Never');
    });

    it('returns a relative string containing "ago" for a recent date', () => {
      const now = new Date();
      const result = timeAgo(now.toISOString());
      // date-fns formatDistanceToNow with addSuffix returns "less than a minute ago" or similar
      expect(result).toContain('ago');
    });

    it('returns a string with "minute" for a date a few minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      const result = timeAgo(date.toISOString());
      expect(result).toContain('minute');
      expect(result).toContain('ago');
    });

    it('returns a string with "hour" for a date a few hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = timeAgo(date.toISOString());
      expect(result).toContain('hour');
      expect(result).toContain('ago');
    });

    it('returns a string with "day" for a date a day ago', () => {
      const date = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const result = timeAgo(date.toISOString());
      expect(result).toContain('day');
      expect(result).toContain('ago');
    });
  });

  // statusColors — mapping agent statuses to bg classes
  describe('statusColors', () => {
    it('has all 4 agent statuses', () => {
      expect(statusColors).toHaveProperty('ONLINE');
      expect(statusColors).toHaveProperty('IDLE');
      expect(statusColors).toHaveProperty('OFFLINE');
      expect(statusColors).toHaveProperty('ERROR');
    });

    it('maps ONLINE to an emerald bg class', () => {
      expect(statusColors.ONLINE).toMatch(/bg-emerald-/);
    });

    it('maps IDLE to an amber bg class', () => {
      expect(statusColors.IDLE).toMatch(/bg-amber-/);
    });

    it('maps OFFLINE to a neutral bg class', () => {
      // Neutral resolves to the semantic ink token rather than a raw gray.
      expect(statusColors.OFFLINE).toMatch(/bg-(ink|gray|slate)/);
    });

    it('maps ERROR to a red bg class', () => {
      expect(statusColors.ERROR).toMatch(/bg-red-/);
    });
  });

  // statusTextColors — mapping agent statuses to text classes
  describe('statusTextColors', () => {
    it('has all 4 agent statuses', () => {
      expect(statusTextColors).toHaveProperty('ONLINE');
      expect(statusTextColors).toHaveProperty('IDLE');
      expect(statusTextColors).toHaveProperty('OFFLINE');
      expect(statusTextColors).toHaveProperty('ERROR');
    });

    it('maps ONLINE to an emerald text class', () => {
      expect(statusTextColors.ONLINE).toMatch(/text-emerald-/);
    });

    it('maps IDLE to an amber text class', () => {
      expect(statusTextColors.IDLE).toMatch(/text-amber-/);
    });

    it('maps OFFLINE to a neutral text class', () => {
      expect(statusTextColors.OFFLINE).toMatch(/text-(ink|gray|slate)/);
    });

    it('maps ERROR to a red text class', () => {
      expect(statusTextColors.ERROR).toMatch(/text-red-/);
    });

    it('provides a light and a dark step for coloured statuses', () => {
      // Each themed tone must carry a dark: override so contrast holds in both
      // themes rather than being tuned for one.
      expect(statusTextColors.ONLINE).toMatch(/dark:/);
      expect(statusTextColors.ERROR).toMatch(/dark:/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Type Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Agent,
  Task,
  TaskStatus,
  Priority,
  Board,
  Approval,
  AgentStatus,
  ApprovalStatus,
} from '../types';

describe('Type Validation', () => {
  it('Agent interface has all required fields', () => {
    const agent: Agent = {
      id: '1',
      name: 'test-agent',
      displayName: 'Test Agent',
      workspace: '/workspace',
      description: 'A test agent',
      status: 'ONLINE',
      lastHeartbeat: null,
      heartbeatInterval: 30,
      currentTask: null,
      processId: null,
      processRole: null,
      processStage: 0,
      avatar: null,
      enabled: true,
      soulMd: null,
      gatewayId: null,
      gatewayAgentId: null,
      boardId: null,
      isBoardLead: false,
      agentToAgent: false,
      soulTemplateId: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(agent.id).toBe('1');
    expect(agent.name).toBe('test-agent');
    expect(agent.displayName).toBe('Test Agent');
    expect(agent.status).toBe('ONLINE');
    expect(agent.enabled).toBe(true);
    expect(agent.isBoardLead).toBe(false);
  });

  it('TaskStatus type has correct values', () => {
    const statuses: TaskStatus[] = ['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain('BACKLOG');
    expect(statuses).toContain('ASSIGNED');
    expect(statuses).toContain('IN_PROGRESS');
    expect(statuses).toContain('REVIEW');
    expect(statuses).toContain('DONE');
  });

  it('Priority type has correct values', () => {
    const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(priorities).toHaveLength(4);
    expect(priorities).toContain('LOW');
    expect(priorities).toContain('MEDIUM');
    expect(priorities).toContain('HIGH');
    expect(priorities).toContain('CRITICAL');
  });

  it('Board interface has all required fields', () => {
    const board: Board = {
      id: '1',
      name: 'Test Board',
      slug: 'test-board',
      description: 'A test board',
      gatewayId: null,
      boardGroupId: null,
      boardType: 'DEFAULT',
      objective: null,
      successMetrics: null,
      targetDate: null,
      maxAgents: 10,
      requireApprovalForDone: false,
      requireReviewBeforeDone: false,
      blockStatusChangesWithPendingApproval: false,
      onlyLeadCanChangeStatus: false,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(board.id).toBe('1');
    expect(board.name).toBe('Test Board');
    expect(board.slug).toBe('test-board');
    expect(board.boardType).toBe('DEFAULT');
    expect(board.maxAgents).toBe(10);
    expect(board.requireApprovalForDone).toBe(false);
  });

  it('Approval interface has all required fields', () => {
    const approval: Approval = {
      id: '1',
      boardId: 'board-1',
      taskId: null,
      agentId: null,
      actionType: 'TASK_COMPLETE',
      payload: null,
      confidence: 0.95,
      status: 'PENDING',
      resolvedAt: null,
      createdAt: '2025-01-01T00:00:00Z',
    };
    expect(approval.id).toBe('1');
    expect(approval.boardId).toBe('board-1');
    expect(approval.actionType).toBe('TASK_COMPLETE');
    expect(approval.confidence).toBe(0.95);
    expect(approval.status).toBe('PENDING');
  });

  it('AgentStatus has all 4 valid values', () => {
    const statuses: AgentStatus[] = ['ONLINE', 'IDLE', 'OFFLINE', 'ERROR'];
    expect(statuses).toHaveLength(4);
  });

  it('ApprovalStatus has all 3 valid values', () => {
    const statuses: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    expect(statuses).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. API Client Tests (mock fetch)
// ─────────────────────────────────────────────────────────────────────────────

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

describe('API Client', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Replace global fetch
    global.fetch = mockFetch;

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      status: 200,
    });

    // Reset the auth store state for each test
    useAuthStore.setState({
      user: null,
      organization: null,
      orgRole: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  // --- Agents ---
  describe('agents', () => {
    it('list() calls GET /api/agents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.agents.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/agents',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
      // Default request is GET (no method override)
      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.method).toBeUndefined();
    });

    it('create() calls POST /api/agents', async () => {
      const data = { name: 'new-agent', displayName: 'New Agent' };
      await api.agents.create(data);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/agents',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    });

    it('delete() calls DELETE /api/agents/:id', async () => {
      await api.agents.delete('agent-123');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/agents/agent-123',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  // --- Boards ---
  describe('boards', () => {
    it('list() calls GET /api/boards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.boards.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/boards',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });

    it('create() calls POST /api/boards', async () => {
      const data = { name: 'My Board', description: 'Test' };
      await api.boards.create(data);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/boards',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    });
  });

  // --- Approvals ---
  describe('approvals', () => {
    it('list() calls GET /api/approvals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.approvals.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/approvals',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });

    it('approve() calls POST /api/approvals/:id/approve', async () => {
      await api.approvals.approve('approval-1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/approvals/approval-1/approve',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('stats() calls GET /api/approvals/stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pending: 5, approved: 10, rejected: 2, total: 17 }),
        status: 200,
      });
      await api.approvals.stats();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/approvals/stats',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });

  // --- Auth ---
  describe('auth', () => {
    it('login() calls POST /api/auth/login', async () => {
      const creds = { email: 'user@test.com', password: 'secret' };
      await api.auth.login(creds);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(creds),
        }),
      );
    });

    it('signup() calls POST /api/auth/signup', async () => {
      const data = { email: 'new@test.com', password: 'secret', name: 'New User', orgName: 'Org' };
      await api.auth.signup(data);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/signup',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    });
  });

  // --- Gateways ---
  describe('gateways', () => {
    it('list() calls GET /api/gateways', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.gateways.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gateways',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });

  // --- LLM Providers ---
  describe('llmProviders', () => {
    it('list() calls GET /api/llm-providers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.llmProviders.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/llm-providers',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });

  // --- Tasks ---
  describe('tasks', () => {
    it('list() calls GET /api/tasks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.tasks.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
  });

  // --- Authorization header ---
  describe('authorization', () => {
    it('includes Authorization header when access token exists', async () => {
      useAuthStore.setState({ accessToken: 'my-token-123' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.agents.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/agents',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token-123',
          }),
        }),
      );
    });

    it('does not include Authorization header when no token exists', async () => {
      useAuthStore.setState({ accessToken: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        status: 200,
      });
      await api.agents.list();
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  // --- 401 handling ---
  describe('401 handling', () => {
    it('attempts token refresh on 401 response (cookie-based)', async () => {
      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
        status: 401,
        statusText: 'Unauthorized',
      });

      // Refresh call succeeds (refresh token is in httpOnly cookie, sent automatically)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: 'new-token' }),
        status: 200,
      });

      // Retry call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1' }],
        status: 200,
      });

      await api.agents.list();

      // Should have made 3 calls: original, refresh, retry
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Second call should be the refresh endpoint with credentials: include
      expect(mockFetch.mock.calls[1][0]).toBe('/api/auth/refresh');
      expect(mockFetch.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    it('clears auth state when refresh fails', async () => {
      // The client deliberately does NOT set window.location.href — it clears
      // auth and lets <ProtectedRoute> redirect, preserving SPA navigation.
      useAuthStore.setState({
        accessToken: 'stale-token',
        isAuthenticated: true,
      });

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
        status: 401,
        statusText: 'Unauthorized',
      });

      // Refresh call also fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid refresh token' }),
        status: 401,
      });

      await expect(api.agents.list()).rejects.toThrow('Session expired');

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Auth Store Tests (Zustand)
// ─────────────────────────────────────────────────────────────────────────────

describe('Auth Store', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();

    // Reset store to initial-like state
    useAuthStore.setState({
      user: null,
      organization: null,
      orgRole: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    localStorage.clear();
  });

  it('initial state is not authenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.orgRole).toBeNull();
  });

  it('login sets user, org, accessToken (refresh token in httpOnly cookie)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
        organization: { id: 'org1', name: 'Test Org', slug: 'test-org' },
        role: 'OWNER',
        accessToken: 'access-token-123',
        // No refreshToken in response body — it's in Set-Cookie header
      }),
      status: 200,
    });

    await useAuthStore.getState().login('test@example.com', 'password');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: 'u1', email: 'test@example.com', name: 'Test User' });
    expect(state.organization).toEqual({ id: 'org1', name: 'Test Org', slug: 'test-org' });
    expect(state.orgRole).toBe('OWNER');
    expect(state.accessToken).toBe('access-token-123');
    // Refresh token is NOT in localStorage — it's in httpOnly cookie
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('logout clears state', async () => {
    // Set up an authenticated state first
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@example.com', name: 'Test' },
      organization: { id: 'org1', name: 'Org', slug: 'org' },
      orgRole: 'OWNER',
      accessToken: 'token',
      isAuthenticated: true,
    });

    // Mock the logout API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
      status: 200,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.orgRole).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('isAuthenticated returns true when accessToken exists', () => {
    useAuthStore.setState({
      accessToken: 'some-token',
      isAuthenticated: true,
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBeTruthy();
  });

  it('isAuthenticated returns false when accessToken is cleared', () => {
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it('setAccessToken updates accessToken', () => {
    useAuthStore.getState().setAccessToken('new-access');
    expect(useAuthStore.getState().accessToken).toBe('new-access');
  });

  it('clearAuth removes all auth state', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'e', name: 'n' },
      organization: { id: 'o1', name: 'o', slug: 's' },
      orgRole: 'ADMIN',
      accessToken: 'token',
      isAuthenticated: true,
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.organization).toBeNull();
    expect(state.orgRole).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('login throws and sets error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
      status: 401,
    });

    await expect(useAuthStore.getState().login('bad@test.com', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );

    const state = useAuthStore.getState();
    expect(state.error).toBe('Invalid credentials');
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. Component Rendering Tests
// ─────────────────────────────────────────────────────────────────────────────

import { Sidebar } from '../components/layout/Sidebar';

describe('Component Rendering', () => {
  beforeEach(() => {
    // Set up authenticated user so Sidebar renders user info
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@example.com', name: 'Alice' },
      organization: { id: 'org1', name: 'Test Org', slug: 'test-org' },
      orgRole: 'OWNER',
      accessToken: 'token',
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('Sidebar', () => {
    it('renders navigation sections', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );

      // The sidebar should render all section labels
      expect(screen.getByText('Monitor')).toBeInTheDocument();
      expect(screen.getByText('Manage')).toBeInTheDocument();
      expect(screen.getByText('Observe')).toBeInTheDocument();
    });

    it('renders all nav items', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );

      // Monitor section items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Activity Feed')).toBeInTheDocument();
      expect(screen.getByText('Mother Chat')).toBeInTheDocument();
      expect(screen.getByText('Communications')).toBeInTheDocument();
      expect(screen.getByText('Timeline')).toBeInTheDocument();

      // Manage section items
      expect(screen.getByText('Boards')).toBeInTheDocument();
      expect(screen.getByText('Approvals')).toBeInTheDocument();
      expect(screen.getByText('Task Board')).toBeInTheDocument();
      expect(screen.getByText('Network Graph')).toBeInTheDocument();
      expect(screen.getByText('Agent Controls')).toBeInTheDocument();
      expect(screen.getByText('Gateways')).toBeInTheDocument();

      // Ruflo Intelligence section items
      expect(screen.getByText('Swarm Studio')).toBeInTheDocument();
      expect(screen.getByText('Vector Memory (AgentDB)')).toBeInTheDocument();
      expect(screen.getByText('GOAP Goal Planner')).toBeInTheDocument();
      expect(screen.getByText('Zero-Trust Federation')).toBeInTheDocument();
      expect(screen.getByText('SONA Neural Hub')).toBeInTheDocument();
      expect(screen.getByText('AIDefence Center')).toBeInTheDocument();
      expect(screen.getByText('MetaHarness Readiness')).toBeInTheDocument();
      expect(screen.getByText('Specialized Personas')).toBeInTheDocument();

      // Observe section items
      expect(screen.getByText('Metrics & Cost')).toBeInTheDocument();
      expect(screen.getByText('Alerts')).toBeInTheDocument();
      expect(screen.getByText('Search & Audit')).toBeInTheDocument();

      // The primary action creates a production chain.
      expect(screen.getByText('New Production')).toBeInTheDocument();
    });

    it('renders the MyceliumOps brand title', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );

      expect(screen.getByText((_, el) => el?.textContent === 'MyceliumOps')).toBeInTheDocument();
      expect(screen.getByText('Mission Control')).toBeInTheDocument();
    });

    it('renders user name and organization', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Test Org')).toBeInTheDocument();
    });

    it('exposes sign out from the account menu', async () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );

      // Destructive actions sit behind the account menu, not on the rail.
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);

      expect(
        await screen.findByRole('menuitem', { name: /sign out/i }),
      ).toBeInTheDocument();
    });

    it('nav items are links with correct paths', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');

      const boardsLink = screen.getByText('Boards').closest('a');
      expect(boardsLink).toHaveAttribute('href', '/boards');

      const gatewaysLink = screen.getByText('Gateways').closest('a');
      expect(gatewaysLink).toHaveAttribute('href', '/gateways');

      const productionsLink = screen.getByText('Productions').closest('a');
      expect(productionsLink).toHaveAttribute('href', '/processes');
    });
  });
});
