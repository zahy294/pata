// UserPromptSubmit: blocks a prompt that looks like it holds a secret (exit 2), so it never reaches the model.
import fs from 'node:fs';

const secretPatterns = [
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // "private key", "mnemonic" or "seed phrase", then a long value:
  // 32+ key-like characters, or 12+ short words as in a BIP-39 phrase.
  /(private[\s_-]?key|mnemonic|seed[\s_-]?phrase)\W{0,6}(is\s+)?["'`]?((0x)?[A-Za-z0-9+/_-]{32,}|([a-z]{3,8}\s+){11,}[a-z]{3,8})/i,
];

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (secretPatterns.some((re) => re.test(String(input.prompt ?? '')))) {
  process.stderr.write('This prompt looks like it contains a secret (an API key, a private key or a seed phrase). It was not sent. Put the value in .env.local and refer to it by name.\n');
  process.exit(2);
}
process.exit(0);
