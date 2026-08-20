import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyFormbody from "@fastify/formbody";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import Fastify, { type FastifyInstance } from "fastify";
import {
  dbPool,
  ensureCoalBargingDatabase,
  ensureFuelKursTables,
  ensureFuelTables,
  ensureJisdorTable,
  ensureKursTengahTable,
  ensureShipperLaytimeColumn,
  ensureSpalTable,
  ensureVendorTable,
  ensureVesselScheduleColumns,
} from "./config/database.js";
import { registerSession } from "./plugins/session.js";
import { authRoutes } from "./routes/auth.js";
import { bargesRoutes } from "./routes/barges.js";
import { coalBargingRoutes } from "./routes/coal-barging.js";
import { flfRoutes } from "./routes/flf.js";
import { fuelRoutes } from "./routes/fuel.js";
import { fuelKursRoutes } from "./routes/fuel-kurs.js";
import { jettyRoutes } from "./routes/jetty.js";
import { jisdorRoutes } from "./routes/jisdor.js";
import { kursTengahRoutes } from "./routes/kurs-tengah.js";
import { shipperRoutes } from "./routes/shipper.js";
import { sibargesRoutes } from "./routes/sibarges.js";
import { spalRoutes } from "./routes/spal.js";
import { tluOperationRoutes } from "./routes/tlu-operation.js";
import { userRoutes } from "./routes/users.js";
import { vendorRoutes } from "./routes/vendor.js";
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
  await app.register(fastifyMultipart, { attachFieldsToBody: "keyValues" });

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(vesselRoutes);
  await app.register(shipperRoutes);
  await app.register(vendorRoutes);
  await app.register(bargesRoutes);
  await app.register(jettyRoutes);
  await app.register(flfRoutes);
  await app.register(sibargesRoutes);
  await app.register(tluOperationRoutes);
  await app.register(coalBargingRoutes);
  await app.register(jisdorRoutes);
  await app.register(kursTengahRoutes);
  await app.register(fuelRoutes);
  await app.register(fuelKursRoutes);
  await app.register(spalRoutes);

  await ensureVesselScheduleColumns(dbPool("databarging"));
  await ensureShipperLaytimeColumn(dbPool("databarging"));
  await ensureVendorTable(dbPool("databarging"));
  await ensureCoalBargingDatabase();
  await ensureFuelTables(dbPool("databarging"));
  await ensureFuelKursTables(dbPool("databarging"));
  await ensureJisdorTable(dbPool("databarging"));
  await ensureKursTengahTable(dbPool("databarging"));
  await ensureSpalTable(dbPool("databarging"));

  return app;
}
