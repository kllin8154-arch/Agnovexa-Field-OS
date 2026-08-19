export const VERIFICATION_CATEGORIES = [
  "files",
  "service",
  "network",
  "business",
] as const;

export type VerificationCategory = typeof VERIFICATION_CATEGORIES[number];
export type VerificationLayerStatus =
  | "pending"
  | "passed"
  | "failed"
  | "human_exempt";

export type VerificationOverallStatus =
  | "pending"
  | "verified"
  | "failed"
  | "human_exempt";

export interface VerificationLayer {
  category: VerificationCategory;
  status: VerificationLayerStatus;
  evidence: string;
  exemptionReason: string;
  successCriteria: string;
  verifier: string;
  recordedAt?: string;
}

export interface VerificationGateResult {
  canClose: boolean;
  overallStatus: VerificationOverallStatus;
  issues: string[];
}

export const VERIFICATION_CATEGORY_META: Record<
  VerificationCategory,
  { label: string; description: string; defaultCriteria: string }
> = {
  files: {
    label: "文件、包与配置",
    description: "核对安装包、目录、版本、权限、配置内容与备份点。",
    defaultCriteria: "目标文件/包/配置存在且版本、属主、权限、校验结果符合任务要求。",
  },
  service: {
    label: "服务、进程与日志",
    description: "核对进程、服务状态、开机自启、启动日志和稳定运行情况。",
    defaultCriteria: "目标服务状态符合要求，关键日志无未处理 ERROR/FATAL，启动方式已确认。",
  },
  network: {
    label: "网络、解析与端口",
    description: "核对监听地址、端口、路由、DNS/hosts 和依赖连通性。",
    defaultCriteria: "监听地址和端口符合最小暴露要求，名称解析和必要链路验证通过。",
  },
  business: {
    label: "业务功能与人工验收",
    description: "核对健康检查、接口、登录、地图、数据库连接和核心业务流程。",
    defaultCriteria: "任务定义中的业务验收标准均有人工证据通过，或由责任人明确豁免。",
  },
};

export function validateVerificationLayer(layer: VerificationLayer): string[] {
  const issues: string[] = [];
  const label = VERIFICATION_CATEGORY_META[layer.category].label;

  if (layer.status === "pending") {
    issues.push(`${label}仍未验证。`);
    return issues;
  }

  if (layer.verifier.trim().length < 2) {
    issues.push(`${label}缺少验证人员。`);
  }

  if (layer.successCriteria.trim().length < 6) {
    issues.push(`${label}缺少明确成功标准。`);
  }

  if (layer.status === "human_exempt") {
    if (layer.exemptionReason.trim().length < 10) {
      issues.push(`${label}的人工豁免必须填写至少 10 个字符的原因和责任说明。`);
    }
    if (layer.evidence.trim().length < 10) {
      issues.push(`${label}的人工豁免仍需保存判断依据。`);
    }
  } else if (layer.evidence.trim().length < 10) {
    issues.push(`${label}缺少至少 10 个字符的验证证据。`);
  }

  return issues;
}

export function evaluateVerificationGate(
  layers: Record<VerificationCategory, VerificationLayer>,
): VerificationGateResult {
  const issues = VERIFICATION_CATEGORIES.flatMap((category) =>
    validateVerificationLayer(layers[category]),
  );

  const statuses = VERIFICATION_CATEGORIES.map(
    (category) => layers[category].status,
  );

  if (statuses.includes("failed")) {
    return { canClose: false, overallStatus: "failed", issues };
  }

  if (issues.length > 0 || statuses.includes("pending")) {
    return { canClose: false, overallStatus: "pending", issues };
  }

  const overallStatus: VerificationOverallStatus = statuses.includes(
    "human_exempt",
  )
    ? "human_exempt"
    : "verified";

  return { canClose: true, overallStatus, issues: [] };
}

export function verificationCompletion(
  layers: Record<VerificationCategory, VerificationLayer>,
): number {
  const complete = VERIFICATION_CATEGORIES.filter(
    (category) => layers[category].status !== "pending",
  ).length;
  return Math.round((complete / VERIFICATION_CATEGORIES.length) * 100);
}
