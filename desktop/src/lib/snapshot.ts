export interface ParsedEnvironmentSnapshot {
  status: "complete" | "missing" | "conflict";
  facts: Record<string, string>;
  missingFacts: string[];
  conflictingFacts: string[];
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return "";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isValidIpv4(value: string): boolean {
  const octets = value.split(".").map(Number);
  return octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function isPrivateIpv4(value: string): boolean {
  if (!isValidIpv4(value)) return false;
  const [first, second] = value.split(".").map(Number);
  return first === 10
    || (first === 192 && second === 168)
    || (first === 172 && second >= 16 && second <= 31);
}

function extractPrivateIpv4(text: string): string[] {
  const candidates = [...text.matchAll(/\b(\d{1,3}(?:\.\d{1,3}){3})(?:\/\d{1,2})?\b/g)]
    .map((match) => match[1]);
  return unique(candidates.filter(isPrivateIpv4));
}

export function parseEnvironmentSnapshot(output: string): ParsedEnvironmentSnapshot {
  const normalized = output.replace(/\r\n/g, "\n");
  const facts: Record<string, string> = {};

  const hostname = firstMatch(normalized, [
    /^\s*Static hostname:\s*(\S+)/mi,
    /^\s*hostname:\s*(\S+)/mi,
    /^\s*([a-zA-Z0-9][a-zA-Z0-9._-]{1,62})\s*$/m,
  ]);
  const os = firstMatch(normalized, [
    /^PRETTY_NAME=["']?([^"'\n]+)["']?/mi,
    /^Operating System:\s*(.+)$/mi,
  ]);
  const architecture = firstMatch(normalized, [
    /^Architecture:\s*(\S+)/mi,
    /^\s*(x86_64|aarch64|arm64|amd64)\s*$/mi,
  ]).replace(/^amd64$/i, "x86_64").replace(/^arm64$/i, "aarch64");
  const kernel = firstMatch(normalized, [
    /^Kernel:\s*(.+)$/mi,
    /^Linux\s+\S+\s+(\S+)/mi,
  ]);
  const java = firstMatch(normalized, [/^(?:openjdk|java) version\s+["']([^"']+)["']/mi]);
  const docker = firstMatch(normalized, [/^Docker version\s+([^,\n]+)/mi]);
  const nginx = firstMatch(normalized, [/nginx version:\s*nginx\/([^\s]+)/mi]);
  const python = firstMatch(normalized, [/^Python\s+([0-9.]+)/mi]);
  const node = firstMatch(normalized, [/^v([0-9]+(?:\.[0-9]+){1,3})\s*$/mi]);

  if (hostname) facts.hostname = hostname;
  if (os) facts.operatingSystem = os;
  if (architecture) facts.architecture = architecture;
  if (kernel) facts.kernel = kernel;
  if (java) facts.java = java;
  if (docker) facts.docker = docker;
  if (nginx) facts.nginx = nginx;
  if (python) facts.python = python;
  if (node) facts.node = node;

  const ipv4 = extractPrivateIpv4(normalized);
  if (ipv4.length) facts.privateIpv4 = ipv4.join(", ");

  const defaultRoute = firstMatch(normalized, [/^default\s+via\s+([^\n]+)/mi]);
  if (defaultRoute) facts.defaultRoute = defaultRoute;

  const packageManager = /\b(?:dnf|yum)\b/i.test(normalized)
    ? "rpm / yum-dnf"
    : /\bapt(?:-get)?\b/i.test(normalized)
      ? "deb / apt"
      : "";
  if (packageManager) facts.packageManager = packageManager;

  const failedUnits = firstMatch(normalized, [/^(\d+)\s+loaded units listed\./mi]);
  if (failedUnits) facts.failedSystemdUnits = failedUnits;

  const missingFacts: string[] = [];
  if (!hostname) missingFacts.push("主机名");
  if (!os) missingFacts.push("操作系统版本");
  if (!architecture) missingFacts.push("CPU 架构");
  if (ipv4.length === 0) missingFacts.push("稳定内网 IPv4");
  if (!/Filesystem\s+Type\s+Size/i.test(normalized) && !/^NAME\s+FSTYPE/mi.test(normalized)) {
    missingFacts.push("磁盘与文件系统信息");
  }
  if (!/Mem:/i.test(normalized)) missingFacts.push("内存信息");

  const conflictingFacts: string[] = [];
  if (ipv4.length > 1) {
    conflictingFacts.push(`检测到多个内网 IPv4：${ipv4.join("、")}，需要人工确认主业务地址。`);
  }
  if (
    hostname
    && normalized.includes("127.0.0.1")
    && new RegExp(`127\\.0\\.0\\.1[^\\n]*\\b${hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalized)
  ) {
    conflictingFacts.push("当前业务主机名可能映射到 127.0.0.1，需要核对 /etc/hosts。");
  }

  const status = conflictingFacts.length > 0
    ? "conflict"
    : missingFacts.length > 0
      ? "missing"
      : "complete";

  return { status, facts, missingFacts, conflictingFacts };
}
