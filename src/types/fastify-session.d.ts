import "@fastify/session";

declare module "@fastify/session" {
  interface FastifySessionObject {
    username?: string;
    jabatan?: string | null;
    divisi?: string | null;
  }
}
