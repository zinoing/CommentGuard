import Fastify from "fastify";
import { collectYouTubeComments } from "./collectors/youtube";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok", service: "collector-service" }));

app.post("/collect/youtube/:channelId", async (req, reply) => {
  const { channelId } = req.params as { channelId: string };
  const result = await collectYouTubeComments(channelId);
  return reply.code(202).send(result);
});

app.listen({ port: Number(process.env.PORT ?? 3002), host: "0.0.0.0" }).catch((err) => {
  console.error(err);
  process.exit(1);
});
