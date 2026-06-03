// Thin fetch wrapper. In dev, requests are same-origin (Vite proxies /api to the
// backend). For a split-origin deploy (web on Vercel, API on Railway) set
// VITE_API_URL to the API origin; requests still send cookies (credentials:
// include) so the httpOnly JWT rides along cross-site.
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = (payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
