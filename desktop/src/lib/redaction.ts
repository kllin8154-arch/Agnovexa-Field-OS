export interface RedactionFinding {
  kind: string;
  count: number;
}

export interface RedactionResult {
  text: string;
  findings: RedactionFinding[];
  total: number;
}

interface RedactionRule {
  kind: string;
  pattern: RegExp;
  replacement: string | ((substring: string, ...args: string[]) => string);
}

const RULES: RedactionRule[] = [
  {
    kind: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "<PRIVATE_KEY_REDACTED>",
  },
  {
    kind: "database-credential-url",
    pattern: /\b((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?):\/\/)([^\s:@/]+):([^\s@/]+)@/gi,
    replacement: "$1<USER>:<PASSWORD>@",
  },
  {
    kind: "jdbc-credential-url",
    pattern: /\b(jdbc:[a-z0-9]+:\/\/[^\s/:]+(?::\d+)?\/[^\s?]+\?[^\s]*?(?:user|username)=)([^&\s]+)(&[^\s]*?(?:password|passwd|pwd)=)([^&\s]+)/gi,
    replacement: "$1<USER>$3<PASSWORD>",
  },
  {
    kind: "secret-assignment",
    pattern: /\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|private[_-]?key)\s*([:=])\s*([^\s,;]+)/gi,
    replacement: (_match, name, separator) => `${name}${separator}<REDACTED>`,
  },
  {
    kind: "authorization-header",
    pattern: /\b(authorization\s*:\s*(?:bearer|basic)\s+)[A-Za-z0-9+/._=-]+/gi,
    replacement: "$1<REDACTED>",
  },
  {
    kind: "provider-token",
    pattern: /\b(?:sk|ghp|gho|ghu|ghs|glpat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/g,
    replacement: "<TOKEN_REDACTED>",
  },
  {
    kind: "private-ip",
    pattern: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
    replacement: "<PRIVATE_IP>",
  },
];

export function redactSensitiveText(input: string): RedactionResult {
  let text = input;
  const findings: RedactionFinding[] = [];

  for (const rule of RULES) {
    const count = text.match(rule.pattern)?.length ?? 0;
    if (count === 0) continue;

    text = typeof rule.replacement === "function"
      ? text.replace(rule.pattern, rule.replacement)
      : text.replace(rule.pattern, rule.replacement);
    findings.push({ kind: rule.kind, count });
  }

  return {
    text,
    findings,
    total: findings.reduce((sum, finding) => sum + finding.count, 0),
  };
}
