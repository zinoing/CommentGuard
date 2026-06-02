import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@commentguard/db";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      role: string;
      tenantId: string;
      mfaVerified: boolean;
    };
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();

        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { id: true, email: true, role: true, tenantId: true, mfaEnabled: true },
        });

        if (!user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        // MFA enforcement: if user has MFA enabled, JWT must carry mfaVerified claim (CHECKLIST §10)
        if (user.mfaEnabled && !(req.user as any).mfaVerified) {
          return reply.code(403).send({ error: "MFA verification required" });
        }

        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          mfaVerified: (req.user as any).mfaVerified ?? false,
        };
      } catch (err) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );
}

export default fp(authPlugin);
