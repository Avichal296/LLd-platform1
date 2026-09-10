import { buildApp } from "../server/src/app.ts";

let appPromise: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = buildApp();
  }

  const app = await appPromise;

  return app(req, res);
}
