import { describe, it, expect } from 'vitest';
import { runA2AInteroperability } from '../services/a2a-orchestrator.service.js';

describe('A2A Protocol & CrewAI / ADK Interoperability Engine', () => {
  it('executes end-to-end task delegation between CrewAI and Google ADK', async () => {
    const result = await runA2AInteroperability('Build and verify user management API');
    
    expect(result.status).toBe('success');
    expect(result.protocol).toBe('A2A/v1');
    expect(result.frameworks_used).toContain('CrewAI');
    expect(result.frameworks_used).toContain('Google ADK');
    
    // Check A2A Envelopes
    expect(result.a2a_messages_count).toBeGreaterThanOrEqual(2);
    expect(result.a2a_trace[0].sender.framework).toBe('CrewAI');
    expect(result.a2a_trace[0].recipient.framework).toBe('ADK');
    expect(result.a2a_trace[0].intent).toBe('DELEGATE_TASK');
    
    expect(result.a2a_trace[1].sender.framework).toBe('ADK');
    expect(result.a2a_trace[1].recipient.framework).toBe('CrewAI');
    expect(result.a2a_trace[1].intent).toBe('RETURN_RESULT');
    
    // Check CrewAI and ADK events
    expect(result.crewai_events.length).toBeGreaterThan(0);
    expect(result.adk_events.length).toBeGreaterThan(0);
    expect(result.final_output).toContain('100% Interoperability achieved between CrewAI and Google ADK');
  }, 30000);
});
