import { FastifyRequest, FastifyReply } from "fastify";

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}
