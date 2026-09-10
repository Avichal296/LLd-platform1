import { loadEnv } from "./load-env.ts";
loadEnv();

import { buildApp } from "./app.ts";

const port = Number(process.env.PORT ?? 43124);

const app = await buildApp();
app.listen(port, "0.0.0.0", () => {
  console.log(`lld-practice api on :${port}`);
});
