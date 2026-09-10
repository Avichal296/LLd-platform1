import { buildApp } from "./app.ts";

let appPromise: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = buildApp();
  }

  const app = await appPromise;

  const forwarded =
    req.headers?.["x-forwarded-uri"] ||
    req.headers?.["x-invoke-path"];

  if (
    typeof forwarded === "string" &&
    forwarded.startsWith("/api")
  ) {
    req.url = forwarded;
  }

  console.log("Vercel request:", req.method, req.url);

  return app(req, res);
}
