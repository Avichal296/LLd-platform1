import { buildApp } from "../server/src/app.ts";

let appPromise: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = buildApp();
    }

    const app = await appPromise;

    return app(req, res);
  } catch (error) {
    console.error("API handler error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}
