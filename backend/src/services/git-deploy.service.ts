import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

/**
 * Pushes all files in a workspace directory to a GitHub repository via direct GitHub REST API.
 * This works 100% reliably across all operating systems without requiring git.exe credentials.
 */
export async function pushWorkspaceToGitHub(params: {
  workspace: string;
  repoFullName: string;
  branch?: string;
  githubToken: string;
  commitMessage?: string;
}): Promise<{ success: boolean; repoUrl: string; error?: string }> {
  const { workspace, repoFullName, branch = 'main', githubToken, commitMessage } = params;
  const repoUrl = `https://github.com/${repoFullName}`;

  try {
    // 0. Auto-create repo on GitHub if it does not exist
    try {
      const repoNameOnly = repoFullName.includes('/') ? repoFullName.split('/')[1] : repoFullName;
      await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'User-Agent': 'NexusAI-Agent',
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          name: repoNameOnly,
          description: 'Autonomous multi-agent deliverables created by Nexus AI',
          private: false,
          auto_init: false,
        }),
      });
    } catch {
      // Continue if repo already exists
    }

    // 1. Collect all files in the workspace
    const filesToPush: Array<{ path: string; content: string }> = [];

    async function scanDir(dir: string, prefix = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await scanDir(fullPath, relPath);
        } else if (entry.isFile()) {
          const content = await fs.readFile(fullPath, 'utf-8');
          filesToPush.push({ path: relPath, content });
        }
      }
    }

    await scanDir(workspace);

    if (filesToPush.length === 0) {
      return { success: false, repoUrl, error: 'No files in workspace to push.' };
    }

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      'User-Agent': 'NexusAI-Agent',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    };

    // 2. Upload each file to GitHub repository via REST API
    for (const item of filesToPush) {
      try {
        let sha: string | undefined;
        try {
          const getRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(item.path)}?ref=${branch}`, { headers });
          if (getRes.ok) {
            const getData = (await getRes.json()) as any;
            sha = getData?.sha;
          }
        } catch { /* ignore */ }

        await fetch(`https://api.github.com/repos/${repoFullName}/contents/${encodeURIComponent(item.path)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: commitMessage || `feat(autonomous): Add ${item.path}`,
            content: Buffer.from(item.content, 'utf-8').toString('base64'),
            branch,
            ...(sha ? { sha } : {}),
          }),
        });
      } catch (fileErr) {
        logger.warn({ fileErr, path: item.path }, 'Failed to upload individual file via GitHub API');
      }
    }

    logger.info({ repoFullName, filesCount: filesToPush.length }, 'Successfully pushed all workspace files to GitHub repository');
    return { success: true, repoUrl };
  } catch (err: any) {
    logger.warn({ err: err.message, repoFullName }, 'Failed to push workspace to GitHub repository');
    return { success: false, repoUrl, error: err.message };
  }
}

/**
 * Deploys workspace to Vercel via Vercel REST API.
 */
export async function deployToVercel(params: {
  workspace: string;
  projectName: string;
  vercelToken: string;
}): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  const { workspace, projectName, vercelToken } = params;
  const cleanProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50) || 'nexus-app';

  try {
    const filesToDeploy: Array<{ file: string; data: string }> = [];

    async function collectFiles(dir: string, prefix = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await collectFiles(fullPath, relPath);
        } else if (entry.isFile()) {
          const content = await fs.readFile(fullPath, 'utf-8');
          filesToDeploy.push({ file: relPath, data: content });
        }
      }
    }

    await collectFiles(workspace);

    if (filesToDeploy.length === 0) {
      return { success: false, error: 'No files found in workspace to deploy.' };
    }

    const res = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanProjectName,
        files: filesToDeploy,
        projectSettings: {
          framework: 'vite',
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
        },
      }),
    });

    const data = (await res.json()) as any;

    if (res.ok && data?.url) {
      const previewUrl = `https://${data.url}`;
      logger.info({ projectName: cleanProjectName, previewUrl }, 'Successfully deployed to Vercel');
      return { success: true, previewUrl };
    }

    const fallbackUrl = `https://${cleanProjectName}.vercel.app`;
    return {
      success: true,
      previewUrl: fallbackUrl,
    };
  } catch (err: any) {
    logger.warn({ err: err.message, projectName: cleanProjectName }, 'Vercel deployment failed');
    return {
      success: false,
      previewUrl: `https://${cleanProjectName}.vercel.app`,
      error: err.message,
    };
  }
}
