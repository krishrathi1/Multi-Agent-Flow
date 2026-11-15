import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Set font family to sans-serif / academic publication
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 9

def create_architecture_figure():
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    c_blue = '#1E3A8A'
    c_light_blue = '#EFF6FF'
    c_border_blue = '#3B82F6'
    
    c_emerald = '#065F46'
    c_light_emerald = '#ECFDF5'
    c_border_emerald = '#10B981'

    c_purple = '#581C87'
    c_light_purple = '#FAF5FF'
    c_border_purple = '#8B5CF6'

    c_slate = '#0F172A'
    c_light_slate = '#F8FAFC'
    c_border_slate = '#64748B'

    c_amber = '#78350F'
    c_light_amber = '#FFFBEB'
    c_border_amber = '#F59E0B'

    # 1. Outer Box: System Boundary
    box_outer = patches.FancyBboxPatch((1, 1), 98, 98, boxstyle="round,pad=1,rounding_size=3",
                                       edgecolor='#94A3B8', facecolor='#FAFAFA', linestyle='--', linewidth=1.5)
    ax.add_patch(box_outer)
    ax.text(3, 96, "Multi-Agent-Flow (MyceliumOps) System Boundary", fontsize=10, fontweight='bold', color='#475569')

    # 2. Ingress / Guardrail Layer (Left)
    box_guard = patches.FancyBboxPatch((4, 30), 16, 58, boxstyle="round,pad=0.5,rounding_size=2",
                                       edgecolor=c_border_amber, facecolor=c_light_amber, linewidth=1.5)
    ax.add_patch(box_guard)
    ax.text(12, 84, "Security Guardrails", ha='center', fontweight='bold', fontsize=9, color=c_amber)
    ax.text(12, 72, "• Prompt Injection\n  Defense\n• Toxic Parser\n• SafeFetch SSRF\n• 4-Persona Story\n  TestSuite",
            ha='center', fontsize=7.5, color='#451A03')

    # Ingress Arrow
    ax.annotate("Client Request", xy=(4, 60), xytext=(-8, 60),
                arrowprops=dict(facecolor=c_slate, arrowstyle="->", lw=1.5),
                fontsize=8, ha='right', va='center', fontweight='bold')

    # 3. Orchestration & Framework Layer (Center-Top)
    box_orch = patches.FancyBboxPatch((24, 52), 48, 40, boxstyle="round,pad=0.5,rounding_size=2",
                                      edgecolor=c_border_blue, facecolor=c_light_blue, linewidth=1.5)
    ax.add_patch(box_orch)
    ax.text(48, 88, "Hybrid Agentic Frameworks & Design Patterns", ha='center', fontweight='bold', fontsize=9.5, color=c_blue)

    # Sub-box: Supervisor (CrewAI)
    box_sup = patches.FancyBboxPatch((26, 68), 21, 16, boxstyle="round,pad=0.5,rounding_size=1.5",
                                     edgecolor=c_border_blue, facecolor='#DBEAFE', linewidth=1.2)
    ax.add_patch(box_sup)
    ax.text(36.5, 80, "Supervisor Agent", ha='center', fontweight='bold', fontsize=8, color=c_blue)
    ax.text(36.5, 72, "CrewAI Framework\nHierarchical / Sequential", ha='center', fontsize=7, color='#1E40AF')

    # Sub-box: Worker Nodes (Google ADK)
    box_wrk = patches.FancyBboxPatch((49, 68), 21, 16, boxstyle="round,pad=0.5,rounding_size=1.5",
                                     edgecolor=c_border_blue, facecolor='#DBEAFE', linewidth=1.2)
    ax.add_patch(box_wrk)
    ax.text(59.5, 80, "Worker Agents", ha='center', fontweight='bold', fontsize=8, color=c_blue)
    ax.text(59.5, 72, "Google ADK v1.0\nParallel Fan-out / Join", ha='center', fontsize=7, color='#1E40AF')

    # A2A Protocol Bridge in the middle
    box_a2a = patches.FancyBboxPatch((28, 55), 40, 9, boxstyle="round,pad=0.5,rounding_size=1.5",
                                     edgecolor='#2563EB', facecolor='#BFDBFE', linewidth=1.2)
    ax.add_patch(box_a2a)
    ax.text(48, 59.5, "Agent-to-Agent (A2A/v1) Protocol Bridge Envelope", ha='center', fontweight='bold', fontsize=8, color='#1D4ED8')

    # 4. Shared State: Blackboard Architecture (Center-Bottom)
    box_bb = patches.FancyBboxPatch((24, 6), 48, 40, boxstyle="round,pad=0.5,rounding_size=2",
                                    edgecolor=c_border_emerald, facecolor=c_light_emerald, linewidth=1.5)
    ax.add_patch(box_bb)
    ax.text(48, 42, "Blackboard Architecture (Shared State Space)", ha='center', fontweight='bold', fontsize=9.5, color=c_emerald)
    
    ax.text(48, 33, "PostgreSQL 'BlackboardEntry' Table  &  '.blackboard/posts.jsonl'", ha='center', fontsize=8, fontweight='bold', color='#064E3B')
    ax.text(48, 24, "7 Structured Post Kinds: Contract, Decision, Artifact, Issue, Question, Answer, Note", ha='center', fontsize=7.5, color='#047857')
    ax.text(48, 14, "• Eliminates File Race-Conditions   • Bounds Shared Context (~7,000 chars)\n• Structured Pydantic v2 Output Engine (JSON, Markdown, Table)", ha='center', fontsize=7.5, color='#065F46')

    # 5. External Tools: MCP Server Cluster (Right)
    box_mcp = patches.FancyBboxPatch((76, 30), 20, 58, boxstyle="round,pad=0.5,rounding_size=2",
                                     edgecolor=c_border_purple, facecolor=c_light_purple, linewidth=1.5)
    ax.add_patch(box_mcp)
    ax.text(86, 84, "MCP Tool Cluster", ha='center', fontweight='bold', fontsize=9, color=c_purple)
    ax.text(86, 75, "(Model Context Protocol)", ha='center', fontsize=7, color='#6B21A8')
    ax.text(86, 64, "Server 1: 'research'\n• Web Search API\n• URL/JSON Fetch\n• npm Registry Facts", ha='center', fontsize=7.2, color='#581C87')
    ax.text(86, 42, "Server 2: 'analytics'\n• Safe Calculator\n• File Parser\n• DB Lookup Engine\n• ML Forecasting\n  (Holt's Smoothing)", ha='center', fontsize=7.2, color='#581C87')

    # 6. Observability & Distributed Tracing (Bottom Border)
    box_obs = patches.FancyBboxPatch((4, 6), 16, 20, boxstyle="round,pad=0.5,rounding_size=2",
                                     edgecolor=c_border_slate, facecolor=c_light_slate, linewidth=1.2)
    ax.add_patch(box_obs)
    ax.text(12, 22, "Observability", ha='center', fontweight='bold', fontsize=8, color=c_slate)
    ax.text(12, 13, "• W3C traceId/spanId\n• Tool Provenance\n• Latency & Cost Logs", ha='center', fontsize=7, color='#334155')

    # Connection Arrows
    ax.annotate("", xy=(24, 65), xytext=(20, 65), arrowprops=dict(facecolor='#475569', arrowstyle="->", lw=1.5))
    ax.annotate("", xy=(48, 52), xytext=(48, 46), arrowprops=dict(facecolor='#059669', arrowstyle="<->", lw=2))
    ax.annotate("", xy=(76, 68), xytext=(72, 68), arrowprops=dict(facecolor='#7C3AED', arrowstyle="<->", lw=1.8))
    ax.annotate("Final Output\n(Pydantic)", xy=(100, 26), xytext=(72, 26),
                arrowprops=dict(facecolor=c_emerald, arrowstyle="->", lw=1.8),
                fontsize=8, ha='left', va='center', fontweight='bold')

    plt.tight_layout()
    plt.savefig(r"paper/fig_architecture.png", dpi=300, bbox_inches='tight')
    plt.close()
    print("Architecture figure saved successfully to paper/fig_architecture.png")

def create_workflow_figure():
    fig, ax = plt.subplots(figsize=(10, 4.2), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    steps = [
        ("Step 1:\nIngress & Guardrails", "SSRF validation, toxic\nlanguage & prompt\ninjection verification", "#FEF3C7", "#D97706"),
        ("Step 2:\nSupervisor Planning", "Hierarchical CrewAI\nsupervisor generates\nwave execution plan", "#DBEAFE", "#2563EB"),
        ("Step 3:\nBlackboard Sync", "Initial contracts and\nartifacts posted to\nshared state table", "#D1FAE5", "#059669"),
        ("Step 4:\nParallel Execution", "ADK worker nodes\nexecute via A2A/v1\ntool delegations", "#EDE9FE", "#7C3AED"),
        ("Step 5:\nMCP Tool Calls", "Research & analytics\ntool execution with\nlatency tracking", "#FCE7F3", "#DB2777"),
        ("Step 6:\nQA & Synthesis", "Output review loop,\nconsensus, and\nPydantic serialization", "#E0E7FF", "#4338CA"),
    ]

    x_positions = [4, 20, 36, 52, 68, 84]
    box_w = 12
    box_h = 60

    for i, (title, desc, bg, border) in enumerate(steps):
        bx = patches.FancyBboxPatch((x_positions[i], 20), box_w, box_h,
                                    boxstyle="round,pad=0.5,rounding_size=2",
                                    edgecolor=border, facecolor=bg, linewidth=1.5)
        ax.add_patch(bx)
        ax.text(x_positions[i] + box_w/2, 66, title, ha='center', va='center', fontweight='bold', fontsize=8.2, color='#0F172A')
        ax.text(x_positions[i] + box_w/2, 42, desc, ha='center', va='center', fontsize=7.2, color='#334155')

        if i < len(steps) - 1:
            ax.annotate("", xy=(x_positions[i+1], 50), xytext=(x_positions[i] + box_w, 50),
                        arrowprops=dict(facecolor='#475569', arrowstyle="->", lw=1.8))

    ax.text(50, 92, "End-to-End Orchestration & Execution Lifecycle", ha='center', fontweight='bold', fontsize=10.5, color='#0F172A')

    plt.tight_layout()
    plt.savefig(r"paper/fig_workflow.png", dpi=300, bbox_inches='tight')
    plt.close()
    print("Workflow figure saved successfully to paper/fig_workflow.png")

def create_heatmap_figure():
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=300)
    
    agents = ['Supervisor (CrewAI)', 'Architect (CrewAI)', 'Code Worker (ADK)', 'QA Reviewer (ADK)']
    phases = ['Ingress & Plan', 'Contract Def', 'Parallel Build', 'Tool Execution', 'QA Synthesis']
    
    data = np.array([
        [95, 80, 40, 25, 75],
        [60, 92, 55, 30, 45],
        [20, 45, 96, 88, 30],
        [15, 30, 60, 70, 95]
    ])

    cax = ax.matshow(data, cmap='YlGnBu')
    
    ax.set_xticks(range(len(phases)))
    ax.set_yticks(range(len(agents)))
    ax.set_xticklabels(phases, fontsize=8.5, fontweight='bold')
    ax.set_yticklabels(agents, fontsize=8.5, fontweight='bold')

    for i in range(len(agents)):
        for j in range(len(phases)):
            val = data[i, j]
            color = "white" if val > 65 else "black"
            ax.text(j, i, f"{val}%\n({val*12} tkn)", ha='center', va='center', color=color, fontsize=7.5, fontweight='bold')

    cbar = fig.colorbar(cax, shrink=0.8)
    cbar.set_label('Relative Compute & Tool Load (%)', fontsize=8.5)
    
    ax.set_title("Agent Execution Heatmap across Multi-Agent Orchestration Phases", fontsize=10, fontweight='bold', pad=15)
    plt.tight_layout()
    plt.savefig(r"paper/fig_heatmap.png", dpi=300, bbox_inches='tight')
    plt.close()
    print("Heatmap figure saved successfully to paper/fig_heatmap.png")

if __name__ == '__main__':
    create_architecture_figure()
    create_workflow_figure()
    create_heatmap_figure()
