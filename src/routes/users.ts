import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { requireDivisi } from "../plugins/session.js";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "../services/user.service.js";

interface AjaxBody {
  ajax?: string;
  action?: string;
  q?: string;
  username?: string;
  old_username?: string;
  password?: string;
  jabatan?: string;
  divisi?: string;
}

export async function userRoutes(app: FastifyInstance) {
  const requireIT = requireDivisi("IT");

  app.get("/create-user", { preHandler: requireIT }, async (req, reply) => {
    return reply.view("create-user.ejs", {
      username: req.session.username,
      divisi: req.session.divisi,
    });
  });

  app.post<{ Body: AjaxBody }>(
    "/create-user",
    { preHandler: requireIT },
    async (req, reply) => {
      const pool = dbPool("databasemlp");
      const { action } = req.body;

      if (action === "list") {
        const data = await listUsers(pool, req.body.q ?? "");
        return reply.send({ ok: true, data });
      }

      if (action === "create") {
        const result = await createUser(
          pool,
          req.body.username ?? "",
          req.body.password ?? "",
          req.body.jabatan ?? "",
          req.body.divisi ?? ""
        );
        return reply.send(result);
      }

      if (action === "update") {
        const result = await updateUser(
          pool,
          req.body.old_username ?? "",
          req.body.username ?? "",
          req.body.password ?? "",
          req.body.jabatan ?? "",
          req.body.divisi ?? ""
        );
        return reply.send(result);
      }

      if (action === "delete") {
        const result = await deleteUser(
          pool,
          req.body.username ?? "",
          req.session.username ?? ""
        );
        return reply.send(result);
      }

      return reply.send({ ok: false, msg: "Action tidak dikenali." });
    }
  );
}
