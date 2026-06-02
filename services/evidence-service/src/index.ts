import Fastify from "fastify";
import { evidenceRoute } from "./routes/evidence";

const app = Fastify({ logger: true });

app.setErrorHandler((error, req, reply) => {
  app.log.error({ err: error }, "Request error");
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  return reply.code(500).send({ error: "Internal server error" });
});

app.get("/health", async () => ({ status: "ok", service: "evidence-service" }));
app.register(evidenceRoute, { prefix: "/api/v1/evidence" });

app.listen({ port: Number(process.env.PORT ?? 3003), host: "0.0.0.0" }).catch((err) => {
  console.error(err);
  process.exit(1);
});
