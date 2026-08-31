import { LandingNav } from './components/LandingNav';
import { HeroSection } from './components/HeroSection';
import { FeatureGrid } from './components/FeatureGrid';
import { CapabilitiesGrid } from './components/CapabilitiesGrid';
import { HowItWorks } from './components/HowItWorks';
import { DashboardPreview } from './components/DashboardPreview';
import { IntegrationSection } from './components/IntegrationSection';
import { FaqSection } from './components/FaqSection';
import { CtaSection } from './components/CtaSection';
import { LandingFooter } from './components/LandingFooter';
import { SEO } from '../../components/SEO';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950">
      <SEO
        title="MyceliumOps by Blostem — AI Agent Orchestration & Mission Control Platform"
        description="MyceliumOps is an AI agent orchestration platform by Blostem. Deploy autonomous AI agents, build agentic workflows with human-in-the-loop approvals, manage enterprise multi-agent systems, and monitor everything from a real-time mission control dashboard. Features include a skills marketplace, soul templates, board policies, agent-to-agent communication, custom fields, webhooks, and team invitations."
        canonical="https://nexus.blostem.com/"
        keywords="AI agent platform, agentic workflow, AI agent orchestration, enterprise AI agents, autonomous AI agents, AI mission control, Blostem AI, MyceliumOps, MyceliumOps AI, human-in-the-loop AI, AI agent dashboard, multi-agent orchestration, AI agent management, AI agent skills marketplace, soul templates, agent-to-agent communication, A2A protocol, custom fields AI agents, board policies, webhook integration AI, task tags, task fingerprints, board onboarding, team invitations, AI agent governance, board group memory"
      />
      <LandingNav />
      <main>
        <HeroSection />
        <FeatureGrid />
        <CapabilitiesGrid />
        <DashboardPreview />
        <HowItWorks />
        <IntegrationSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
