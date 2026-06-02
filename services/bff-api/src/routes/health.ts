import { FastifyInstance } from "fastify";

export async function healthRoute(app: FastifyInstance) {
  // No auth on /health (CHECKLIST §6)
  app.get("/", async () => ({ status: "ok", service: "bff-api" }));
}
