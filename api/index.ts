let appPromise: Promise<any> | undefined;

export default async function handler(req: any, res: any) {
  try {
    if (!appPromise) {
      appPromise = import("../server/dist/src/app.js").then((mod) => {
        return mod.buildApp();
      });
    }

    const app = await appPromise;

    return app(req, res);
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
