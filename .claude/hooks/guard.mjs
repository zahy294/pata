// PreToolUse guard for Bash, Edit, Write and MultiEdit.
// Exit 2 blocks the tool call; the message on stderr goes back to Claude.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = process.env.CLAUDE_PROJECT_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function block(reason) {
  process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${reason}\n`);
  process.exit(2);
}

// ---- Bash ----

// Splits on ; && || | & and newlines. Quote-unaware, which is enough for a guard.
const segmentsOf = (command) => command.split(/&&|\|\||[;|&\n]/).map((s) => s.trim()).filter(Boolean);

function tokensOf(segment) {
  const tokens = [];
  for (const m of segment.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  // Drop leading sudo, env and VAR=value prefixes so the real command comes first.
  while (tokens.length && (/^(sudo|env|command|exec)$/.test(tokens[0]) || /^[A-Za-z_]\w*=/.test(tokens[0]))) {
    tokens.shift();
  }
  return tokens;
}

const slashes = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
const rootForms = new Set(
  [projectRoot, projectRoot.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)]
    .map((p) => slashes(p).toLowerCase()),
);
const dangerousTargets = new Set(['/', '/*', '~', '~/', '~/*', '$home', '${home}', '.', './', './*',
  '$claude_project_dir', '${claude_project_dir}']);

function isDangerousRmTarget(target) {
  const t = target.toLowerCase();
  if (dangerousTargets.has(t)) return true;
  const normalized = slashes(t.replace(/^([a-z]):/, (_, d) => `/${d}`));
  if (normalized === '/' || normalized === '~') return true;
  return rootForms.has(slashes(t)) || rootForms.has(normalized);
}

function checkRm(tokens) {
  let recursive = false;
  let force = false;
  const targets = [];
  for (const tok of tokens.slice(1)) {
    if (tok === '--recursive') recursive = true;
    else if (tok === '--force') force = true;
    else if (/^-[A-Za-z]+$/.test(tok)) {
      if (/[rR]/.test(tok)) recursive = true;
      if (/f/.test(tok)) force = true;
    } else if (!tok.startsWith('--')) targets.push(tok);
  }
  if (recursive && force) {
    const hit = targets.find(isDangerousRmTarget);
    if (hit) block(`rm -rf on "${hit}" (filesystem root, home or the project root).`);
  }
}

// git's global options that take a separate value, as in `git -C dir push`.
const gitValueOptions = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);

function checkGit(tokens) {
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) i += gitValueOptions.has(tokens[i]) ? 2 : 1;
  const sub = tokens[i];
  const args = tokens.slice(i + 1);
  if (sub === 'push' && args.some((t) => t === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(t))) {
    block('git push --force. Use --force-with-lease if you really mean it, and ask the user first.');
  }
  if (sub === 'reset' && args.includes('--hard')) block('git reset --hard discards work. Ask the user first.');
  if (sub === 'clean' && args.some((t) => t === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(t))) {
    block('git clean -f deletes untracked files. Ask the user first.');
  }
}

const readers = new Set(['cat', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep', 'sed']);
const isEnvFile = (arg) => {
  const base = path.basename(arg.replace(/\\/g, '/').replace(/^<+/, ''));
  return /^\.env(\..+)?$/.test(base) && base !== '.env.example';
};

function checkBash(command, depth = 0) {
  for (const segment of segmentsOf(command)) {
    const tokens = tokensOf(segment);
    if (!tokens.length) continue;
    const cmd = path.basename(tokens[0]);
    if (cmd === 'rm') checkRm(tokens);
    if (cmd === 'git') checkGit(tokens);
    if (readers.has(cmd) && tokens.slice(1).some(isEnvFile)) {
      block('reading a .env file. Secrets stay in .env.local; read names from .env.example.');
    }
    if (segment.match(/<\s*\S*\.env(\.\w+)?\b/) && !segment.includes('.env.example')) {
      block('reading a .env file through a redirect.');
    }
    // Look inside quoted strings too, such as bash -c "...".
    if (depth < 2) for (const tok of tokens) if (/\s/.test(tok)) checkBash(tok, depth + 1);
  }
}

// ---- Edit, Write, MultiEdit ----

// A 64-hex value assigned to a name containing private key, secret, mnemonic or api key.
// A bare 32-byte constant (an ENS namehash or labelhash) has no such name, so it passes.
const namedSecret = /(private[\s_-]?key|secret|mnemonic|api[\s_-]?key)[\w-]*["'`]?\s*[:=]\s*["'`]?(0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])/i;
const anthropicKey = /sk-ant-[A-Za-z0-9_-]{16,}/;

function checkContent(text, file) {
  if (!text) return;
  if (anthropicKey.test(text)) block(`an Anthropic API key (sk-ant-...) in ${file}. Put it in .env.local.`);
  if (namedSecret.test(text)) block(`a 64-hex secret assigned to a key, secret, mnemonic or API-key name in ${file}. Put it in .env.local.`);
}

// ---- main ----

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // Never block on a malformed payload.
}
const { tool_name: tool, tool_input: args = {} } = input;

if (tool === 'Bash') checkBash(args.command ?? '');
if (tool === 'Write') checkContent(args.content, args.file_path);
if (tool === 'Edit') checkContent(args.new_string, args.file_path);
if (tool === 'MultiEdit') for (const e of args.edits ?? []) checkContent(e.new_string, args.file_path);
process.exit(0);
