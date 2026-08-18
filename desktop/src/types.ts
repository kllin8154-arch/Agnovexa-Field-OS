export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkflowPhase =
  | "DISCOVER"
  | "DEFINE"
  | "RETRIEVE"
  | "PLAN"
  | "APPROVE"
  | "MANUAL_EXECUTE"
  | "VERIFY"
  | "KNOWLEDGE";

export type VerificationStatus =
  | "draft"
  | "reviewed"
  | "verified"
  | "deprecated";

export interface Asset {
  id: string;
  name: string;
  project: string;
  environment: "开发" | "测试" | "预生产" | "生产" | "演示";
  host: string;
  port: number;
  serverModel: string;
  operatingSystem: string;
  architecture: "x86_64" | "aarch64" | "unknown";
  connectionMode: "manual" | "read-only-planned";
  snapshotStatus: "完整" | "缺失" | "冲突" | "未采集";
  lastSnapshotAt?: string;
  tags: string[];
}

export interface ChangeStep {
  id: string;
  objective: string;
  prerequisites: string[];
  risk: RiskLevel;
  commands: string;
  expectedResult: string;
  evidenceRequired: string[];
  verificationCommands: string;
  rollbackCommands: string;
}

export interface ChangePlan {
  id: string;
  title: string;
  project: string;
  asset: string;
  phase: WorkflowPhase;
  risk: RiskLevel;
  facts: string[];
  missingFacts: string[];
  backupPath: string;
  diff: string;
  steps: ChangeStep[];
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  sourceScope: "inner" | "public";
  sourceType: "skill" | "sop" | "incident" | "official_doc" | "web_result";
  verificationStatus: VerificationStatus;
  environmentScope: "dev" | "test" | "staging" | "production" | "general";
  riskLevel: RiskLevel;
  applicableVersions: string[];
  summary: string;
  tags: string[];
  lastVerifiedAt?: string;
  requiresHumanApproval: boolean;
}

export interface DeploymentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: RiskLevel;
  offlineReady: boolean;
  verifiedStatus: VerificationStatus;
  requiredInputs: string[];
}

export interface RuntimePolicy {
  executionMode: "manual-only";
  networkAssumption: "offline-first";
  sshCapability: "disabled";
  remoteWriteCapability: "disabled";
  localDatabase: "sqlite" | "browser-preview";
  knowledgeIsolation: "inner-first";
}
