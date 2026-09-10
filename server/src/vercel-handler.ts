import { buildMemoryApp } from "./app.ts";

let app : ReturnType<typeof buildMemoryApp> | undefined;

export default function handler(req: { url?: string; headers?: Record<string, unknown> }, res: unknown) {
  const forwarded = header(req, "x-forwarded-uri") || header(req, "x-invoke-path");
  if (forwarded && typeof forwarded === "string" && forwarded.startsWith("/api")) {
    req.url = forwarded;
  } else if (req.url && req.url.includes("[")) {
    req.url = forwarded || req.url;
  }
  return app(req as never, res as never);
}

function header(req: { headers?: Record<string, unknown> }, name: string): string | undefined {
  const v = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(v)) return String(v[0]);
  return typeof v === "string" ? v : undefined;
}
