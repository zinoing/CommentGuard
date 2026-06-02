import Fastify from "fastify";
import { custodyLogRoute } from "./routes/custody-log";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok", service: "case-management" }));
app.register(custodyLogRoute);

app.listen({ port: Number(process.env.PORT ?? 3005), host: "0.0.0.0" }).catch((err) => {
  console.error(err);
  process.exit(1);
});
