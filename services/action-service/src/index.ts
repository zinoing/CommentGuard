import Fastify from "fastify";
import { actionsRoute } from "./routes/actions";

const app = Fastify({ logger: true });

app.setErrorHandler((error, req, reply) => {
  app.log.error({ err: error }, "Request error");
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  return reply.code(500).send({ error: "Internal server error" });
});

app.get("/health", async () => ({ status: "ok", service: "action-service" }));
app.register(actionsRoute, { prefix: "/api/v1/actions" });

app.listen({ port: Number(process.env.PORT ?? 3004), host: "0.0.0.0" }).catch((err) => {
  console.error(err);
  process.exit(1);
});
