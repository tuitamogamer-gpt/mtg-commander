import { execFile } from "node:child_process";

/**
 * Some upstreams (notably Moxfield, behind Cloudflare) reject Node's undici
 * `fetch` based on its TLS/HTTP2 fingerprint, returning a 403 challenge even
 * with perfect browser headers. The system `curl` has a fingerprint Cloudflare
 * accepts, so we shell out to it for those hosts. `curl` ships with Windows 10+,
 * macOS, and virtually every Linux. We fall back to `fetch` if curl is missing.
 */

export interface CurlResult {
  status: number;
  body: string;
}

export function curlGet(url: string, headers: Record<string, string>): Promise<CurlResult> {
  const args: string[] = [
    "-s",
    "-S",
    "--compressed",
    "-L",
    "--max-time",
    "30",
    // Print the HTTP status on its own trailing line so we can split it off.
    "-w",
    "\n%{http_code}",
  ];
  for (const [k, v] of Object.entries(headers)) {
    args.push("-H", `${k}: ${v}`);
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    execFile("curl", args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      const text = stdout.toString();
      const idx = text.lastIndexOf("\n");
      const status = Number(text.slice(idx + 1).trim());
      const body = idx >= 0 ? text.slice(0, idx) : text;
      resolve({ status: Number.isFinite(status) ? status : 0, body });
    });
  });
}

/**
 * GET JSON, preferring curl (to clear Cloudflare) and falling back to fetch.
 * Returns null on any non-2xx or parse failure.
 */
export async function getJsonViaCurl<T>(
  url: string,
  headers: Record<string, string>
): Promise<T | null> {
  try {
    const { status, body } = await curlGet(url, headers);
    if (status >= 200 && status < 300) {
      return JSON.parse(body) as T;
    }
    return null;
  } catch {
    // curl unavailable — try undici fetch as a last resort.
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}
