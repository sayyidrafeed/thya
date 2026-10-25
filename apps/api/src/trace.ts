import { AsyncLocalStorage } from "node:async_hooks";

// Decision Q8: one id per turn, created where the turn starts and readable anywhere below it
// (jobs, sends, logs) without passing it through every call.
const current = new AsyncLocalStorage<string>();

export function newTraceId(): string {
  return Bun.randomUUIDv7();
}

export function withTrace<T>(traceId: string, run: () => T): T {
  return current.run(traceId, run);
}

export function currentTraceId(): string | undefined {
  return current.getStore();
}
