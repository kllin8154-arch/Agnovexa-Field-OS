import { useState, type ReactNode } from "react";
import type { RiskLevel, VerificationStatus } from "../types";

export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || eyebrow || actions) && (
        <header className="panel-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge risk-${level.toLowerCase()}`}>{level}</span>;
}

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const label: Record<VerificationStatus, string> = {
    draft: "草稿",
    reviewed: "已审核",
    verified: "已验证",
    deprecated: "已停用",
  };
  return <span className={`badge status-${status}`}>{label[status]}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}

export function CodeBlock({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="code-shell">
      <div className="code-toolbar">
        <span>{label ?? "命令预览"}</span>
        <button className="text-button" type="button" onClick={copy}>
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
    </div>
  );
}

export function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}
