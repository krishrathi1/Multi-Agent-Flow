import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { ToastProvider } from './components/ui/Toast';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuthStore } from './stores/auth-store';
import { Dashboard } from './pages/Dashboard';
import { Processes } from './pages/Processes';
import { Runs } from './pages/Runs';
import { Automation } from './pages/Automation';
import { PromptPlayground } from './pages/PromptPlayground';
import { CodeIntelligence } from './pages/CodeIntelligence';
import { CustomFields } from './pages/CustomFields';
import { ActivityFeed } from './pages/ActivityFeed';
import { KanbanBoard } from './pages/KanbanBoard';
import { AgentProfile } from './pages/AgentProfile';
import { Communications } from './pages/Communications';
import { Timeline } from './pages/Timeline';
import { Topology } from './pages/Topology';
import { AgentControls } from './pages/AgentControls';
import { Metrics } from './pages/Metrics';
import { Alerts } from './pages/Alerts';
import { SearchAudit } from './pages/SearchAudit';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { CheckEmail } from './pages/CheckEmail';
import { VerifyEmail } from './pages/VerifyEmail';
import { AgentCreate } from './pages/AgentCreate';
import { Settings } from './pages/Settings';
import { Gateways } from './pages/Gateways';
import { Chat } from './pages/Chat';
import { Boards } from './pages/Boards';
import { BoardDetail } from './pages/BoardDetail';
import { Approvals } from './pages/Approvals';
import { SkillsMarketplace } from './pages/SkillsMarketplace';
import { McpHub } from './pages/McpHub';
import { SoulTemplates } from './pages/SoulTemplates';
import { Invitations } from './pages/Invitations';
import { MasArchitectureLab } from './pages/MasArchitectureLab';
import { DocsLayout } from './pages/docs/DocsLayout';
import { DocsGettingStarted } from './pages/docs/DocsGettingStarted';
import { DocsMcpIntegration } from './pages/docs/DocsMcpIntegration';
import { DocsRemoteAgents } from './pages/docs/DocsRemoteAgents';
import { DocsAgentManagement } from './pages/docs/DocsAgentManagement';
import { DocsAlerts } from './pages/docs/DocsAlerts';
import { DocsApiReference } from './pages/docs/DocsApiReference';
import { DocsOrganizations } from './pages/docs/DocsOrganizations';
import { DocsWebSocketEvents } from './pages/docs/DocsWebSocketEvents';

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center text-white font-bold text-2xl animate-glow">
            N
          </div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

export function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <Routes>
      {/* Root redirect: Authenticated -> /dashboard, Guest -> Landing Page */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/check-email" element={<CheckEmail />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Public Documentation routes */}
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<DocsGettingStarted />} />
        <Route path="mcp-integration" element={<DocsMcpIntegration />} />
        <Route path="remote-agents" element={<DocsRemoteAgents />} />
        <Route path="agent-management" element={<DocsAgentManagement />} />
        <Route path="alerts" element={<DocsAlerts />} />
        <Route path="api-reference" element={<DocsApiReference />} />
        <Route path="organizations" element={<DocsOrganizations />} />
        <Route path="websocket-events" element={<DocsWebSocketEvents />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/processes" element={<Processes />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/prompts" element={<PromptPlayground />} />
          <Route path="/code-intelligence" element={<CodeIntelligence />} />
          <Route path="/code" element={<Navigate to="/code-intelligence" replace />} />
          <Route path="/custom-fields" element={<CustomFields />} />
          <Route path="/activity" element={<ActivityFeed />} />
          <Route path="/comms" element={<Communications />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/tasks" element={<KanbanBoard />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/controls" element={<AgentControls />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/search" element={<SearchAudit />} />
          <Route path="/agents/new" element={<AgentCreate />} />
          <Route path="/agents/:id/edit" element={<AgentCreate />} />
          <Route path="/agents/:id" element={<AgentProfile />} />
          <Route path="/gateways" element={<Gateways />} />
          <Route path="/mcp" element={<McpHub />} />
          <Route path="/boards" element={<Boards />} />
          <Route path="/boards/:id" element={<BoardDetail />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/skills" element={<SkillsMarketplace />} />
          <Route path="/soul-templates" element={<SoulTemplates />} />
          <Route path="/invitations" element={<Invitations />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/mas-architecture" element={<MasArchitectureLab />} />
          <Route path="/architecture" element={<Navigate to="/mas-architecture" replace />} />

        </Route>
      </Route>

      {/* Unknown URLs fall back to the dashboard instead of a blank page. */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </ToastProvider>
    </ThemeProvider>
  );
}
