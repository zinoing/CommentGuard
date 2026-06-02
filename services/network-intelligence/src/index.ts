import Fastify from "fastify";
import { Kafka } from "kafkajs";
import { aggregateRoute } from "./routes/aggregate";
import { deidentify } from "./pipeline/deidentify";
import { bufferEvent, flushAggregates } from "./pipeline/aggregator";

const app = Fastify({ logger: true });

app.setErrorHandler((error, req, reply) => {
  app.log.error({ err: error }, "Request error");
  if (error.statusCode && error.statusCode < 500) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  return reply.code(500).send({ error: "Internal server error" });
});

app.get("/health", async () => ({ status: "ok", service: "network-intelligence" }));
app.register(aggregateRoute, { prefix: "/api/v1/network" });

// Kafka consumer: receives classified comment events
const kafka = new Kafka({
  clientId: "network-intelligence",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});
const consumer = kafka.consumer({ groupId: "network-intelligence-group" });

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: "classified-comments", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString()) as {
        commentId: string;
        channelId: string;
        riskTypes: string[];
        urgencyScore: number;
        patternType: string;
        createdAt: string;
      };

      // CHECKLIST §7: de-identification runs BEFORE any cross-channel computation
      const deidentified = deidentify(
        event.commentId,
        event.riskTypes,
        event.urgencyScore,
        [event.patternType],
        new Date(event.createdAt)
      );

      // channelId used only for k-anonymity count — never persisted
      bufferEvent(event.channelId, event.patternType, deidentified);
    },
  });
}

async function bootstrap() {
  await startConsumer();
  await app.listen({ port: Number(process.env.PORT ?? 3006), host: "0.0.0.0" });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
