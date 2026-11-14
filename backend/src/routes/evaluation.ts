import { Router } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export const evaluationRouter = Router();

evaluationRouter.get('/summary', async (_req, res) => {
  try {
    const csvPath = path.resolve(process.cwd(), 'backend', 'evaluation', 'benchmark_dataset.csv');
    const altPath = path.resolve(process.cwd(), 'evaluation', 'benchmark_dataset.csv');
    let content = '';
    try {
      content = await fs.readFile(csvPath, 'utf-8');
    } catch {
      content = await fs.readFile(altPath, 'utf-8');
    }

    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    const rows = lines.slice(1).map(line => {
      const parts = line.split(',');
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = parts[idx] ? parts[idx].trim() : '';
      });
      return obj;
    });

    const totalRuns = rows.length;
    const avgDuration = rows.reduce((acc, r) => acc + (parseFloat(r.duration_seconds) || 0), 0) / (totalRuns || 1);
    const avgCost = rows.reduce((acc, r) => acc + (parseFloat(r.cost_usd) || 0), 0) / (totalRuns || 1);
    const avgConfidence = rows.reduce((acc, r) => acc + (parseFloat(r.confidence_score) || 0), 0) / (totalRuns || 1);

    res.json({
      ok: true,
      total_runs: totalRuns,
      summary: {
        avg_duration_seconds: Number(avgDuration.toFixed(2)),
        avg_cost_usd: Number(avgCost.toFixed(4)),
        avg_confidence_score: Number(avgConfidence.toFixed(2)),
        architectures_tested: ['ReAct (Tool-Centric)', 'Sequential Pipeline', 'Hierarchical Supervisor', 'Hybrid Staged'],
        personas_variances: ['Analytical Auditor', 'Fast Pragmatist', 'Inquisitive Explorer', 'Detail Specialist']
      },
      boxplot_url: '/evaluation/boxplot.png',
      dataset_sample: rows.slice(0, 10)
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
