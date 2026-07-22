export const TAKOMI_SUBAGENT_HEARTBEAT_MS = 125;

type Timer = ReturnType<typeof setInterval>;

type HeartbeatState = {
  takomiSubagentHeartbeatTimer?: Timer;
  takomiSubagentHeartbeatFrame?: number;
};

export type TakomiSubagentRenderContext = {
  state: Record<string, unknown>;
  invalidate?: () => void;
};

const activeHeartbeatStates = new Set<HeartbeatState>();

export function clearTakomiSubagentResultHeartbeat(context: TakomiSubagentRenderContext): void {
  const state = context.state as HeartbeatState;
  if (state.takomiSubagentHeartbeatTimer !== undefined) {
    clearInterval(state.takomiSubagentHeartbeatTimer);
    state.takomiSubagentHeartbeatTimer = undefined;
  }
  activeHeartbeatStates.delete(state);
}

export function ensureTakomiSubagentResultHeartbeat(context: TakomiSubagentRenderContext): void {
  const state = context.state as HeartbeatState;
  if (state.takomiSubagentHeartbeatTimer !== undefined || typeof context.invalidate !== "function") return;

  state.takomiSubagentHeartbeatFrame ??= 0;
  state.takomiSubagentHeartbeatTimer = setInterval(() => {
    state.takomiSubagentHeartbeatFrame = ((state.takomiSubagentHeartbeatFrame ?? 0) + 1) % 10;
    try {
      context.invalidate?.();
    } catch {
      // A replaced session makes its row context stale. Stop immediately rather
      // than retaining the old UI through a failing interval callback.
      clearTakomiSubagentResultHeartbeat(context);
    }
  }, TAKOMI_SUBAGENT_HEARTBEAT_MS);
  state.takomiSubagentHeartbeatTimer.unref?.();
  activeHeartbeatStates.add(state);
}

export function getTakomiSubagentHeartbeatFrame(context: TakomiSubagentRenderContext): number {
  return (context.state as HeartbeatState).takomiSubagentHeartbeatFrame ?? 0;
}

export function clearAllTakomiSubagentResultHeartbeats(): void {
  for (const state of [...activeHeartbeatStates]) {
    if (state.takomiSubagentHeartbeatTimer !== undefined) clearInterval(state.takomiSubagentHeartbeatTimer);
    state.takomiSubagentHeartbeatTimer = undefined;
    activeHeartbeatStates.delete(state);
  }
}
