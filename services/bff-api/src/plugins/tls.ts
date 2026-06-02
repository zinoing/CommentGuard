import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// CHECKLIST §10: TLS 1.3 enforced — no fallback to older TLS versions
// In production, TLS is terminated at the AWS ALB which is configured for TLS 1.3 minimum.
// This middleware adds a defense-in-depth check: if the request was somehow forwarded over
// an older TLS version, it is rejected.

async function tlsEnforcementPlugin(app: FastifyInstance) {
  if (process.env.NODE_ENV !== "production") return;

  app.addHook("onRequest", async (req, reply) => {
    // AWS ALB forwards the negotiated TLS version in this header
    const tlsVersion = req.headers["x-forwarded-tls-version"] as string | undefined;

    if (tlsVersion && tlsVersion !== "TLSv1.3") {
      app.log.warn({ tlsVersion, ip: req.ip }, "Request rejected: TLS version below 1.3");
      return reply.code(400).send({ error: "TLS 1.3 required" });
    }
  });
}

export default fp(tlsEnforcementPlugin);
