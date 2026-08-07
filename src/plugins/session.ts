import cookie from "@fastify/cookie";
import session from "@fastify/session";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export async function registerSession(app: FastifyInstance) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET belum diatur (minimal 32 karakter).");
  }

  await app.register(cookie);
  await app.register(session, {
    secret,
    cookie: { secure: false, httpOnly: true, path: "/" },
    saveUninitialized: false,
  });
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session.username) {
    reply.redirect("/login");
  }
}

export function requireDivisi(divisi: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session.username) {
      reply.redirect("/login");
      return;
    }
    if ((req.session.divisi ?? "") !== divisi) {
      reply.code(403).send("403 - Access denied");
    }
  };
}

/** Case-insensitive match against a set of allowed divisi, mirroring the
 * sidebar's `canAccess()` visibility rule (see includes/sidebar.php). */
export function requireAnyDivisi(divisiList: string[]) {
  const allowed = divisiList.map((d) => d.toUpperCase());
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session.username) {
      reply.redirect("/login");
      return;
    }
    if (!allowed.includes((req.session.divisi ?? "").toUpperCase())) {
      reply.code(403).send("403 - Access denied");
    }
  };
}
