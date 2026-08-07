import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyFormbody from "@fastify/formbody";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import Fastify, { type FastifyInstance } from "fastify";
import { dbPool, ensureVesselScheduleColumns } from "./config/database.js";
import { registerSession } from "./plugins/session.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { vesselRoutes } from "./routes/vessel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await registerSession(app);

  await app.register(fastifyView, {
    engine: { ejs },
    root: path.join(projectRoot, "views"),
  });

  await app.register(fastifyStatic, {
    root: path.join(projectRoot, "assets"),
    prefix: "/assets/",
  });

  await app.register(fastifyFormbody);
  await app.register(fastifyMultipart);

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(vesselRoutes);

  await ensureVesselScheduleColumns(dbPool("databarging"));

  return app;
}
