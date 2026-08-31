# Code LLM Capabilities & Benchmark Evaluation

## 1. Executive Summary & Objective

In modern AIDevOps, selecting the appropriate AI code model requires balancing **accuracy (HumanEval / MBPP pass rates)**, **context length**, **inference latency**, **hosting privacy (local vs cloud)**, and **token cost**.

This document details the empirical evaluation of prominent open-weights and proprietary code models supported within the **Nexus AI** ecosystem.

---

## 2. Comprehensive Model Comparison Matrix

| Model | Provider / Origin | Parameters | Context Window | HumanEval Pass@1 | MBPP Pass@1 | Best Suited For | Deployment Mode |
|---|---|---|---|---|---|---|---|
| **Claude 3.5 Sonnet** | Anthropic | Proprietary | 200k tokens | **92.0%** | **90.5%** | Complex architecture, large refactors, multi-file reasoning | Cloud API |
| **GPT-4o / GPT-4 Turbo** | OpenAI | Proprietary | 128k tokens | **90.2%** | **88.4%** | Fast agent orchestration, code review, tool calling | Cloud API |
| **DeepSeek Coder V2** | DeepSeek | 236B MoE (21B active) | 128k tokens | **90.2%** | **87.6%** | High-performance open-weights, multi-lingual coding | Cloud / Self-Hosted |
| **Code Llama 34B** | Meta | 34B Dense | 100k tokens | **62.2%** | **61.8%** | On-premise air-gapped deployments, code completion | Ollama / Local GPU |
| **StarCoder2 15B** | BigCode / ServiceNow | 15B Dense | 16k tokens | **46.3%** | **52.2%** | Low-latency IDE fill-in-the-middle (FIM) | Ollama / Edge CPU/GPU |

---

## 3. Detailed Benchmark Analysis

```
                      HUMANEVAL (PASS@1 ACCURACY)
 Claude 3.5 Sonnet   ████████████████████████████████████████ 92.0%
 GPT-4o              ███████████████████████████████████████  90.2%
 DeepSeek Coder V2   ███████████████████████████████████████  90.2%
 Code Llama 34B      ███████████████████████████              62.2%
 StarCoder2 15B      ████████████████████                     46.3%
                     0%         25%         50%        75%       100%
```

### 3.1 Proprietary Frontier Models (Claude 3.5 Sonnet & GPT-4o)
- **Strengths**: Unmatched nuance in multi-step reasoning, strict adherence to complex system prompt constraints (e.g., formatting outputs as structured JSON or Mermaid diagrams), and exceptional syntax accuracy in modern frameworks (React 19, TypeScript 5.7).
- **Weaknesses**: Requires internet egress; recurring operational token costs; non-deterministic latency spikes during peak cloud demand.
- **Nexus Role**: Primary planner for multi-agent production chains and intricate security audits.

### 3.2 Open-Weights Powerhouse (DeepSeek Coder V2)
- **Strengths**: Performance matching GPT-4o across 300+ programming languages at a fraction of compute cost due to Mixture-of-Experts (MoE) architecture.
- **Weaknesses**: Requires high-VRAM hardware (e.g., 2x NVIDIA A100/H100) for full 236B parameter self-hosting.
- **Nexus Role**: High-volume automated CI code review and large-scale semantic indexing.

### 3.3 Local & Edge Models (Code Llama 34B & StarCoder2 15B)
- **Strengths**: Can be run locally via Ollama / OpenClaw Gateway on workstation hardware (M2/M3 Mac or RTX 4090); 100% privacy with zero data leakage.
- **Weaknesses**: Higher susceptibility to syntax errors on complex prompt templates; limited few-shot in-context learning bandwidth.
- **Nexus Role**: Low-latency single-file completions (`/* CURSOR */` fill-in-the-middle) and offline developer assistance.

---

## 4. Prompt Sensitivity & Parameter Tuning

Our experiments across Nexus prompt templates revealed clear operational thresholds:

### 4.1 Temperature Sensitivity
```
  Task                  Recommended Temp   Behavior Observed
  ──────────────────────────────────────────────────────────────────────────
  Bug Detection         0.1 - 0.2          Prevents hallucinated vulnerabilities
  Code Completion       0.2                Ensures deterministic syntax matching
  Code Review           0.3                Balances strictness with actionable advice
  Refactoring           0.4                Allows creative design pattern discovery
  Code Explanation      0.5                Produces natural, fluent pedagogical prose
```

### 4.2 Few-Shot Impact Across Model Sizes
- **Frontier Models (GPT-4o, Claude 3.5)**: 0-shot or 1-shot is sufficient; additional examples yield diminishing returns.
- **Small/Medium Models (StarCoder2, Code Llama)**: Require **2–3 explicit few-shot examples** to reliably maintain structured Markdown headings and avoid truncation.
