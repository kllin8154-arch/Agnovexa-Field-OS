import { useSyncExternalStore } from "react";

const SELECTED_PROVIDER_KEY = "agnovexa.opsdesk.ai.selected-provider.v1";
const EVENT_NAME = "agnovexa:ai-runtime-change";
const sessionKeys = new Map<string, string>();
let selectedProviderId = typeof window === "undefined"
  ? "deepseek"
  : window.localStorage.getItem(SELECTED_PROVIDER_KEY) || "deepseek";

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getSelectedProviderId(): string {
  return selectedProviderId;
}

export function setSelectedProviderId(providerId: string): void {
  selectedProviderId = providerId;
  if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_PROVIDER_KEY, providerId);
  emit();
}

export function getSessionApiKey(providerId: string): string {
  return sessionKeys.get(providerId) ?? "";
}

export function setSessionApiKey(providerId: string, apiKey: string): void {
  if (apiKey) sessionKeys.set(providerId, apiKey);
  else sessionKeys.delete(providerId);
  emit();
}

export function clearSessionApiKey(providerId: string): void {
  sessionKeys.delete(providerId);
  emit();
}

export function clearAllSessionApiKeys(): void {
  sessionKeys.clear();
  emit();
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

function snapshot(): string {
  return `${selectedProviderId}:${Array.from(sessionKeys.keys()).sort().join(",")}`;
}

export function useAiRuntime(): {
  selectedProviderId: string;
  selectProvider: (providerId: string) => void;
  getApiKey: (providerId: string) => string;
  setApiKey: (providerId: string, apiKey: string) => void;
  clearApiKey: (providerId: string) => void;
  clearAllApiKeys: () => void;
} {
  useSyncExternalStore(subscribe, snapshot, () => "deepseek:");
  return {
    selectedProviderId,
    selectProvider: setSelectedProviderId,
    getApiKey: getSessionApiKey,
    setApiKey: setSessionApiKey,
    clearApiKey: clearSessionApiKey,
    clearAllApiKeys: clearAllSessionApiKeys,
  };
}
