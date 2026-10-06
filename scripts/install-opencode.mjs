import { execFileSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npm, ['install', '-g', 'opencode-ai@latest'], { stdio: 'inherit', shell: false });
