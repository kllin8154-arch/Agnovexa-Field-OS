import { useSyncExternalStore } from "react";

const sessionKeys = new Map<string, string>();
const listeners = new Set<() => void>();
let revision = 0;

function emitChange() {
  revision += 1;
  for (const listener of listeners) listener();
}

export function setSessionApiKey(providerId: string, apiKey: string): void {
  const normalized = apiKey.trim();
  if (normalized) sessionKeys.set(providerId, normalized);
  else sessionKeys.delete(providerId);
  emitChange();
}

export function getSessionApiKey(providerId: string): string {
  return sessionKeys.get(providerId) ?? "";
}

export function clearSessionApiKey(providerId: string): void {
  if (sessionKeys.delete(providerId)) emitChange();
}

export function clearAllSessionApiKeys(): void {
  if (sessionKeys.size === 0) return;
  sessionKeys.clear();
  emitChange();
}

export function hasSessionApiKey(providerId: string): boolean {
  return sessionKeys.has(providerId);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return revision;
}

export function useSessionApiKeyStatus(providerId: string): boolean {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return hasSessionApiKey(providerId);
}
