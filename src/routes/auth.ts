import type { FastifyInstance } from "fastify";
import { dbPool } from "../config/database.js";
import { verifyCredentials } from "../services/auth.service.js";
import { requireAuth } from "../plugins/session.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/login", async (req, reply) => {
    if (req.session.username) {
      return reply.redirect("/home");
    }
    return reply.view("login.ejs", { error: "" });
  });

  app.post<{ Body: { username?: string; password?: string } }>(
    "/login",
    async (req, reply) => {
      const username = (req.body.username ?? "").trim();
      const password = (req.body.password ?? "").trim();

      const pool = dbPool("databasemlp");
      const result = await verifyCredentials(pool, username, password);

      if (result.status === "not_found") {
        return reply.view("login.ejs", { error: "Username tidak ditemukan." });
      }
      if (result.status === "bad_password") {
        return reply.view("login.ejs", { error: "Password salah." });
      }

      req.session.username = result.user.username;
      req.session.jabatan = result.user.jabatan;
      req.session.divisi = result.user.divisi;

      return reply.redirect("/home");
    }
  );

  app.get("/logout", async (req, reply) => {
    await req.session.destroy();
    return reply.redirect("/login");
  });

  app.get("/home", { preHandler: requireAuth }, async (req, reply) => {
    return reply.view("home.ejs", {
      username: req.session.username,
      divisi: req.session.divisi,
      jabatan: req.session.jabatan,
    });
  });
}
