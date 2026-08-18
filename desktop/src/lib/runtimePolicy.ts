import { invoke } from "@tauri-apps/api/core";
import type { RuntimePolicy } from "../types";

export const DEFAULT_RUNTIME_POLICY: RuntimePolicy = {
  executionMode: "manual-only",
  networkAssumption: "offline-first",
  sshCapability: "disabled",
  remoteWriteCapability: "disabled",
  localDatabase: "browser-preview",
  knowledgeIsolation: "inner-first",
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadRuntimePolicy(): Promise<RuntimePolicy> {
  if (!isTauriRuntime()) {
    return DEFAULT_RUNTIME_POLICY;
  }

  try {
    return await invoke<RuntimePolicy>("get_runtime_policy");
  } catch {
    return DEFAULT_RUNTIME_POLICY;
  }
}
