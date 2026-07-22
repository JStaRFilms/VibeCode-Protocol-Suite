export const USER_GATE_AUTO_PROVENANCE_ENTRY = "takomi-user-gate-auto-provenance";

type SessionEntry = {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
};

function isAuthorizedData(value: unknown): value is { authorized: true } {
  return typeof value === "object" && value !== null && (value as { authorized?: unknown }).authorized === true;
}

/**
 * Reads the latest explicit user gate decision from session history.
 * This deliberately ignores generic runtime state and profile defaults.
 */
export function hasUserGateAutoProvenance(entries: readonly SessionEntry[]): boolean {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "custom" || entry.customType !== USER_GATE_AUTO_PROVENANCE_ENTRY) continue;
    return isAuthorizedData(entry.data);
  }
  return false;
}
