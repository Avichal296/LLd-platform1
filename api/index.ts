let appPromise: Promise<any> | undefined;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = import("../server/dist/src/app.js").then((mod) => {
        return mod.buildApp();
      });
    }

    const app = await appPromise;

    // Vercel invokes this function for /api/*
    // Express routes are defined without the /api prefix.
    const originalUrl = req.url;

    if (req.url?.startsWith("/api")) {
      req.url = req.url.slice(4) || "/";
    }

    try {
      return await app(req, res);
    } finally {
      req.url = originalUrl;
    }
  } catch (error) {
    console.error("API handler error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
      });
    }

    throw error;
  }
}
