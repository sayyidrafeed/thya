import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { scriptedModel, type ScriptStep } from "../agent/testing";
import { createWhatsAppClient } from "../channels/whatsapp/client";
import { deliverPending } from "../channels/whatsapp/deliver";
import { fakeGraph, textMessage } from "../channels/whatsapp/testing";
import { handleAgentTurn } from "../jobs/agent-turn";
import { fireDueSchedules, type Templates } from "../jobs/schedule-fire";
import { loadAttachment } from "../modules/attachments";
import { createPhoneBusiness } from "../modules/business";
import { pendingOutbound, recordInbound } from "../modules/conversation";
import { createSchedule } from "../modules/schedules";
import { demoBusiness } from "../sales/demo-shop";
import { seedDemoSales } from "../sales/repository";
import type { Db } from "./client";
import { schedules } from "./schema";
import { freshTestDb, integration } from "./testing";

const NOW = new Date("2026-10-25T14:00:00+07:00");
const OWNER = "6281200000003";
const config = { accessToken: "t", phoneNumberId: "PNID", graphVersion: "v23.0" };
const noTemplates: Templates = { recap: null, reminder: null, language: "id" };

const dailyRecap = {
  kind: "recap",
  frequency: "daily",
  time: "21:00",
  dayOfWeek: null,
  date: null,
  recapKind: "daily",
  reminderText: null,
} as const;

describe.if(integration)("schedules", () => {
  let db: Db;
  let businessId: string;
  let wamid = 0;

  beforeAll(async () => {
    db = await freshTestDb();
    businessId = (await createPhoneBusiness(db, demoBusiness, OWNER)).id;
    await seedDemoSales(db, businessId, NOW);
  }, 60_000);

  afterAll(async () => {
    await db.$client.end();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE schedules, outbound_messages, inbound_messages, drafts, attachments CASCADE`,
    );
  });

  async function say(text: string, script: ScriptStep[], at: Date) {
    const graph = fakeGraph();
    const message = textMessage(`wamid.s${++wamid}`, text, OWNER);
    const client = createWhatsAppClient(config, graph.fetcher);

    await recordInbound(db, [
      { wamid: message.id, phone: OWNER, type: "text", payload: message, receivedAt: at },
    ]);
    await handleAgentTurn(
      {
        db,
        model: scriptedModel(script),
        delivery: { db, client, loadImage: async () => null },
        now: () => at,
        paymentsImport: false,
      },
      OWNER,
    );

    return graph;
  }

  async function tick(at: Date, templates = noTemplates) {
    const flushed: string[] = [];

    await fireDueSchedules({
      db,
      now: () => at,
      templates,
      flush: async (phone) => void flushed.push(phone),
    });

    return { flushed, pending: await pendingOutbound(db, OWNER) };
  }

  test("a schedule made in chat waits for Ya, then runs at 21:00 WIB (S4-AC1, AC2)", async () => {
    const graph = await say(
      "tiap hari kirim rekap jam 9 malam",
      [
        { tool: "createSchedule", input: { ...dailyRecap, timeWords: "jam 9 malam" } },
        { text: "Cek dulu ya Kak." },
      ],
      NOW,
    );

    const card = graph.sent().find((body) => body.type === "interactive");

    expect(card.interactive.body.text).toBe(
      "Kirim rekap harian tiap hari jam 21.00 WIB\nYang pertama: Minggu, 25 Okt 2026 jam 21.00 WIB",
    );
    expect(await db.$count(schedules)).toBe(0);

    const tap = {
      from: OWNER,
      id: `wamid.s${++wamid}`,
      timestamp: "1",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: card.interactive.action.buttons[0].reply.id, title: "Ya" },
      },
    };

    const confirm = fakeGraph();

    await recordInbound(db, [
      { wamid: tap.id, phone: OWNER, type: "interactive", payload: tap, receivedAt: NOW },
    ]);
    await handleAgentTurn(
      {
        db,
        model: scriptedModel([]),
        delivery: {
          db,
          client: createWhatsAppClient(config, confirm.fetcher),
          loadImage: async () => null,
        },
        now: () => NOW,
        paymentsImport: false,
      },
      OWNER,
    );

    expect(confirm.sent()[0].text.body).toBe(
      "Siap, Kak. Kirim rekap harian tiap hari jam 21.00 WIB. Yang pertama Minggu, 25 Okt 2026 jam 21.00 WIB.",
    );

    const [row] = await db.select().from(schedules);

    expect(row?.nextRunAt).toEqual(new Date("2026-10-25T21:00:00+07:00"));
  });

  test("a due recap is sent once, even when the tick runs twice (S4-AC3)", async () => {
    await createSchedule(db, { businessId, spec: dailyRecap, now: NOW });
    await say("halo", [{ text: "Halo Kak." }], NOW);

    const due = new Date("2026-10-25T21:00:30+07:00");
    const first = await tick(due);
    const second = await tick(due);

    expect(first.flushed).toEqual([OWNER]);
    expect(second.flushed).toEqual([]);
    expect(first.pending).toHaveLength(1);
    expect(first.pending[0]?.payload).toMatchObject({ type: "text", to: OWNER });
    expect(JSON.stringify(first.pending[0]?.payload)).toContain("Rekap kemarin, Sabtu 24 Okt 2026");

    const [row] = await db.select().from(schedules);

    expect(row?.nextRunAt).toEqual(new Date("2026-10-26T21:00:00+07:00"));
  });

  test("a weekly recap goes as its card image with the text as caption", async () => {
    await createSchedule(db, {
      businessId,
      spec: {
        ...dailyRecap,
        frequency: "weekly",
        dayOfWeek: "mon",
        time: "08:00",
        recapKind: "weekly",
      },
      now: NOW,
    });
    await say("halo", [{ text: "Halo Kak." }], NOW);

    const { pending } = await tick(new Date("2026-10-26T08:00:10+07:00"));
    const [image] = pending;

    expect(image?.payload).toMatchObject({ type: "image", to: OWNER });

    if (image?.payload.type !== "image") throw new Error("expected an image");

    const png = await loadAttachment(db, image.payload.attachmentId, NOW);

    expect(png?.byteLength).toBeGreaterThan(10_000);

    const graph = fakeGraph();

    const delivery = {
      db,
      client: createWhatsAppClient(config, graph.fetcher),
      loadImage: async () => png,
    };

    await deliverPending(delivery, OWNER);

    expect(graph.calls.map((call) => call.url.split("/").at(-1))).toEqual(["media", "messages"]);
  });

  test("outside the 24-hour window only a template goes out, and none without one", async () => {
    await createSchedule(db, { businessId, spec: dailyRecap, now: NOW });

    const due = new Date("2026-10-25T21:00:30+07:00");
    const silent = await tick(due);

    expect(silent.pending).toEqual([]);

    await db.update(schedules).set({ nextRunAt: due });

    const templated = await tick(due, { recap: "thya_rekap", reminder: null, language: "id" });

    expect(templated.pending[0]?.payload).toMatchObject({
      type: "template",
      name: "thya_rekap",
      bodyParams: ["harian", expect.stringContaining("Rekap kemarin, Sabtu 24 Okt 2026*")],
    });
    expect(JSON.stringify(templated.pending[0]?.payload)).not.toContain("\\n");
  });

  test("a late reminder says so, and a recap more than 2 hours late is skipped once", async () => {
    await say("halo", [{ text: "Halo Kak." }], NOW);
    await createSchedule(db, {
      businessId,
      spec: {
        ...dailyRecap,
        kind: "reminder",
        time: "15:00",
        recapKind: null,
        reminderText: "belanja susu",
      },
      now: NOW,
    });
    await createSchedule(db, { businessId, spec: { ...dailyRecap, time: "15:00" }, now: NOW });

    const { pending } = await tick(new Date("2026-10-25T17:30:00+07:00"));

    expect(pending.map((row) => row.payload)).toEqual([
      {
        type: "text",
        to: OWNER,
        text: "(Terlambat, maaf Kak) Pengingat yang Kakak minta: belanja susu",
      },
    ]);
    expect(await db.$count(schedules, eq(schedules.status, "active"))).toBe(2);
  });
});
