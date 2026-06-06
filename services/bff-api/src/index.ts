import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyCors from "@fastify/cors";
import tlsEnforcement from "./plugins/tls";
import { healthRoute } from "./routes/health";
import { commentsRoute } from "./routes/comments";
import { casesRoute } from "./routes/cases";
import { shareLinksRoute } from "./routes/share-links";
import { dashboardRoute } from "./routes/dashboard";
import { collectRoute, internalCollectRoute } from "./routes/collect";
import { channelsRoute, devChannelsRoute } from "./routes/channels";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
  // TLS is terminated at the load balancer (AWS ALB); service-to-service uses mTLS in k8s
});

async function bootstrap() {
  await app.register(tlsEnforcement);

  await app.register(fastifyCors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: "8h" },
  });

  // Per-tenant rate limiting (CHECKLIST §6)
  await app.register(fastifyRateLimit, {
    max: 1000,
    timeWindow: "1 minute",
    keyGenerator: (req) => {
      const tenantId = (req as any).user?.tenantId ?? req.ip;
      return `tenant:${tenantId}`;
    },
  });

  // CHECKLIST §6: error responses must not leak internal stack traces or DB details
  app.setErrorHandler((error, req, reply) => {
    app.log.error({ err: error, url: req.url, method: req.method }, "Request error");

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }

    // Never expose internal details to the client
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.register(healthRoute, { prefix: "/health" });
  app.register(commentsRoute, { prefix: "/api/v1/comments" });
  app.register(casesRoute, { prefix: "/api/v1/cases" });
  app.register(shareLinksRoute, { prefix: "/api/v1/share-links" });
  app.register(dashboardRoute, { prefix: "/api/v1/dashboard" });
  app.register(collectRoute, { prefix: "/api/v1" });
  app.register(internalCollectRoute, { prefix: "/internal" });
  app.register(channelsRoute, { prefix: "/api/v1" });
  app.register(devChannelsRoute, { prefix: "/api/dev" });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`BFF API listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
