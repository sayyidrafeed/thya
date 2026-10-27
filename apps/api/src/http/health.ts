import { Elysia } from "elysia";
import { webhookDrops } from "../channels/whatsapp/drops";
import { checkHealth, type HealthInput } from "../modules/health";

// 503 only when the database is gone: the Docker HEALTHCHECK restarts the container on a non-2xx,
// and a restart cannot bring back a missing worker, so "degraded" stays 200 and shows in the body.
export function healthRoute(input: HealthInput) {
  return new Elysia().get("/health", async ({ set }) => {
    const health = await checkHealth(input);

    if (health.status === "down") set.status = 503;

    return { ...health, webhookDrops: webhookDrops() };
  });
}
