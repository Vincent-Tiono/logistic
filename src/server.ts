import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.PORT) || 3000;

try {
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`Listening on http://127.0.0.1:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
