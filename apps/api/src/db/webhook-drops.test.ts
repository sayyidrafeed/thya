import { afterAll, expect, spyOn, test } from "bun:test";
import { webhookDrops, type DropReason, type WebhookDrops } from "../channels/whatsapp/drops";
import { signWebhook, textMessage, webhookBody } from "../channels/whatsapp/testing";
import { createDb } from "./client";
import { createBoss } from "../jobs";
import { healthRoute } from "../http/health";
import { whatsappWebhook } from "../http/whatsapp";

// Every request below is refused or dropped before anything is stored, so
// neither Postgres nor pg-boss is reached.
const NOWHERE = "postgres://u:p@127.0.0.1:1/none";
const db = createDb(NOWHERE);
const config = { appSecret: "app-secret", verifyToken: "verify", phoneNumberId: "PNID" };
const app = whatsappWebhook(db, createBoss(NOWHERE), config);

const OWNER = "6281200000077";
const WAMID = "wamid.HBgNNjI4MTIwMDAwMDA3Nw";
const TEXT = "omzet kemarin 4.100.000 ya";
const message = webhookBody([textMessage(WAMID, TEXT, OWNER)]);

afterAll(async () => {
  await db.$client.end();
});

function post(body: string, secret = config.appSecret) {
  return app.handle(
    new Request("http://thya/webhook/whatsapp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signWebhook(body, secret),
      },
      body,
    }),
  );
}

const drops: [DropReason, () => Promise<Response>, number][] = [
  [
    "bad_verify_token",
    () =>
      app.handle(
        new Request(
          "http://thya/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42",
        ),
      ),
    403,
  ],
  ["bad_signature", () => post(message, "not-the-app-secret"), 401],
  ["bad_json", () => post(message.slice(0, 40)), 400],
  ["schema_mismatch", () => post(message.replace(`"timestamp":"1793088000",`, "")), 200],
  [
    "other_phone_number",
    () => post(message.replace(`"phone_number_id":"PNID"`, `"phone_number_id":"PNID2"`)),
    200,
  ],
  [
    "other_field",
    () => post(message.replace(`"field":"messages"`, `"field":"account_update"`)),
    200,
  ],
];

test.each(drops)(
  "%s leaves one log line with its reason and nothing of the payload",
  async (reason, send, status) => {
    const log = spyOn(console, "log").mockImplementation(() => {});

    try {
      expect((await send()).status).toBe(status);
      expect(log.mock.calls).toEqual([[JSON.stringify({ event: "webhook-drop", reason })]]);
    } finally {
      log.mockRestore();
    }
  },
);

test("/health shows each reason's count since the webhook started", async () => {
  const before = webhookDrops();

  if (before === null) throw new Error("mounting the webhook starts the count");

  const log = spyOn(console, "log").mockImplementation(() => {});

  try {
    for (const [, send] of drops) await send();
  } finally {
    log.mockRestore();
  }

  const response = await healthRoute({ db, jobsStarted: true, whatsappConfigured: true }).handle(
    new Request("http://thya/health"),
  );

  // SAFETY: the route returns checkHealth's body plus webhookDrops as JSON.
  const body = (await response.json()) as { webhookDrops: WebhookDrops };

  expect(body.webhookDrops.since).toBe(before.since);
  expect(body.webhookDrops.counts).toEqual({
    bad_verify_token: before.counts.bad_verify_token + 1,
    bad_signature: before.counts.bad_signature + 1,
    bad_json: before.counts.bad_json + 1,
    schema_mismatch: before.counts.schema_mismatch + 1,
    other_phone_number: before.counts.other_phone_number + 1,
    other_field: before.counts.other_field + 1,
  });
});

test("a process that never mounts the webhook (the worker) reports null, not zero drops", () => {
  const probe = `
    const { healthRoute } = await import("${import.meta.dir}/../http/health.ts");
    const { createDb } = await import("${import.meta.dir}/client.ts");
    const db = createDb("${NOWHERE}");
    const response = await healthRoute({ db, jobsStarted: true, whatsappConfigured: true }).handle(new Request("http://thya/health"));
    console.log(JSON.stringify((await response.json()).webhookDrops));
    await db.$client.end();
  `;

  const run = Bun.spawnSync(["bun", "-e", probe], { cwd: import.meta.dir });

  expect(run.stdout.toString().trim()).toBe("null");
});
