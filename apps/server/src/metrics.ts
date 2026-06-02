// Lightweight in-process metrics. Reset on restart; good enough for a basic
// /api/metrics endpoint and local observability.

const startedAt = Date.now();
let requests = 0;
let totalMs = 0;
let errors = 0;

export function recordRequest(statusCode: number, ms: number): void {
  requests += 1;
  totalMs += ms;
  if (statusCode >= 500) errors += 1;
}

export function snapshot() {
  const uptimeMs = Date.now() - startedAt;
  const minutes = Math.max(uptimeMs / 60_000, 1 / 60);
  return {
    uptimeSec: Math.round(uptimeMs / 1000),
    requests,
    errors,
    avgLatencyMs: requests ? Math.round(totalMs / requests) : 0,
    requestsPerMin: Math.round(requests / minutes),
  };
}
