// PostToolUse: runs Prettier on the edited file once Prettier is installed.
// Never fails and never blocks: every error ends in exit 0.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = process.env.CLAUDE_PROJECT_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const prettier = path.join(projectRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const formatted = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.md']);

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const file = input.tool_input?.file_path;
  if (file && formatted.has(path.extname(file).toLowerCase()) && fs.existsSync(prettier) && fs.existsSync(file)) {
    spawnSync(process.execPath, [prettier, '--write', '--log-level', 'silent', file], { cwd: projectRoot, timeout: 20000, stdio: 'ignore' });
  }
} catch {
  // Ignore everything.
}
process.exit(0);
