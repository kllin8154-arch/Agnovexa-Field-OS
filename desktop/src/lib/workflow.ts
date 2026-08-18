import type { WorkflowPhase } from "../types";

export const phaseLabels: Record<WorkflowPhase, string> = {
  DISCOVER: "环境采集",
  DEFINE: "目标定义",
  RETRIEVE: "知识检索",
  PLAN: "方案生成",
  APPROVE: "人工审阅",
  MANUAL_EXECUTE: "人工执行",
  VERIFY: "证据验证",
  KNOWLEDGE: "知识沉淀",
};

export const phaseOrder: WorkflowPhase[] = [
  "DISCOVER",
  "DEFINE",
  "RETRIEVE",
  "PLAN",
  "APPROVE",
  "MANUAL_EXECUTE",
  "VERIFY",
  "KNOWLEDGE",
];

const allowedTransitions: Record<WorkflowPhase, WorkflowPhase[]> = {
  DISCOVER: ["DEFINE"],
  DEFINE: ["DISCOVER", "RETRIEVE"],
  RETRIEVE: ["DEFINE", "PLAN"],
  PLAN: ["RETRIEVE", "APPROVE"],
  APPROVE: ["PLAN", "MANUAL_EXECUTE"],
  MANUAL_EXECUTE: ["APPROVE", "VERIFY"],
  VERIFY: ["MANUAL_EXECUTE", "KNOWLEDGE"],
  KNOWLEDGE: [],
};

export function canTransition(from: WorkflowPhase, to: WorkflowPhase): boolean {
  return allowedTransitions[from].includes(to);
}
