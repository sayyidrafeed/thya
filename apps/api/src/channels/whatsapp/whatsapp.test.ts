import { describe, expect, test } from "bun:test";
import { createWhatsAppClient, WhatsAppError } from "./client";
import { splitText, toWhatsAppText } from "./format";
import { inboundMessages, readContent, webhookSchema } from "./inbound";
import { verifySignature } from "./signature";
import { graph, signWebhook, textMessage, webhookBody } from "./testing";

const SECRET = "app-secret";

describe("verifySignature", () => {
  const body = webhookBody([textMessage("wamid.1", "omzet kemarin?")]);
  const signed = signWebhook(body, SECRET);

  test("accepts Meta's HMAC of the raw body", () => {
    expect(verifySignature(body, signed, SECRET)).toBe(true);
  });

  test("rejects a missing, malformed, or foreign signature and an edited body", () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, "sha1=abc", SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=00", SECRET)).toBe(false);
    expect(verifySignature(body, signed, "other-secret")).toBe(false);
    expect(verifySignature(body.replace("omzet", "laba"), signed, SECRET)).toBe(false);
  });
});

describe("inbound", () => {
  test("reads text and button replies, and ignores delivery statuses", () => {
    const payload = JSON.parse(
      webhookBody([
        textMessage("wamid.1", "omzet kemarin?"),
        {
          from: "6281200000001",
          id: "wamid.2",
          timestamp: "1793088001",
          type: "interactive",
          interactive: { type: "button_reply", button_reply: { id: "draft:abc:yes", title: "Ya" } },
          context: { id: "wamid.card" },
        },
      ]),
    );

    payload.entry[0].changes.push({
      field: "messages",
      value: {
        metadata: { phone_number_id: "PNID" },
        statuses: [{ id: "wamid.x", status: "read" }],
      },
    });

    const messages = inboundMessages(webhookSchema.parse(payload), "PNID");

    expect(messages.map((message) => [message.wamid, message.phone])).toEqual([
      ["wamid.1", "6281200000001"],
      ["wamid.2", "6281200000001"],
    ]);

    expect(messages.map((message) => readContent(message.payload))).toEqual([
      { kind: "text", text: "omzet kemarin?" },
      { kind: "button", id: "draft:abc:yes", title: "Ya", contextWamid: "wamid.card" },
    ]);
  });

  test("drops messages addressed to another phone number id", () => {
    const payload = webhookSchema.parse(JSON.parse(webhookBody([textMessage("wamid.1", "hai")])));

    expect(inboundMessages(payload, "OTHER")).toEqual([]);
  });

  test("voice notes are unsupported for now", () => {
    expect(readContent({ from: "62", id: "w", timestamp: "1", type: "audio" })).toEqual({
      kind: "unsupported",
      type: "audio",
    });
  });
});

describe("toWhatsAppText (decision U4)", () => {
  test("turns Markdown into WhatsApp markup", () => {
    expect(toWhatsAppText("Omzet kemarin **Rp4.100.000**.")).toBe("Omzet kemarin *Rp4.100.000*.");
    expect(toWhatsAppText("## Rekap minggu ini\n* Kopi\n+ Teh")).toBe(
      "*Rekap minggu ini*\n- Kopi\n- Teh",
    );
    expect(toWhatsAppText("Lihat [panduan](https://thya.veterantech.id/demo)")).toBe(
      "Lihat panduan (https://thya.veterantech.id/demo)",
    );
  });

  test("flattens tables and keeps WhatsApp's own markup as is", () => {
    expect(toWhatsAppText("| Menu | Terjual |\n|---|---:|\n| Kopi | 20 |")).toBe(
      "Menu - Terjual\nKopi - 20",
    );
    expect(toWhatsAppText("*Rp1.250.000* naik _sedikit_\n\n\n\n- Kopi")).toBe(
      "*Rp1.250.000* naik _sedikit_\n\n- Kopi",
    );
  });
});

describe("splitText", () => {
  test("keeps short text whole and cuts long text at a paragraph", () => {
    expect(splitText("halo", 10)).toEqual(["halo"]);

    const pieces = splitText(`${"a".repeat(30)}\n\n${"b".repeat(30)}`, 40);

    expect(pieces).toEqual(["a".repeat(30), "b".repeat(30)]);
  });

  test("never returns a piece above the limit", () => {
    const pieces = splitText("kata ".repeat(2_000), 4_096);

    expect(pieces.every((piece) => piece.length <= 4_096)).toBe(true);
    expect(pieces.join(" ").replace(/\s+/g, " ").trim()).toBe("kata ".repeat(2_000).trim());
  });
});

const config = { accessToken: "token", phoneNumberId: "PNID", graphVersion: "v23.0" };
const sent = (id: string) => Response.json({ messages: [{ id }] });

describe("createWhatsAppClient", () => {
  test("sends text, buttons and an uploaded image to the phone number's endpoint", async () => {
    const { calls, fetcher } = graph([
      sent("w1"),
      sent("w2"),
      Response.json({ id: "media-1" }),
      sent("w3"),
    ]);

    const client = createWhatsAppClient(config, fetcher);

    expect(await client.sendText("628", "halo")).toBe("w1");
    expect(await client.sendButtons("628", "Catat?", [{ id: "draft:1:yes", title: "Ya" }])).toBe(
      "w2",
    );
    expect(
      await client.sendImage("628", await client.uploadImage(new Uint8Array([1])), "cap"),
    ).toBe("w3");

    expect(calls.map((call) => call.url)).toEqual([
      "https://graph.facebook.com/v23.0/PNID/messages",
      "https://graph.facebook.com/v23.0/PNID/messages",
      "https://graph.facebook.com/v23.0/PNID/media",
      "https://graph.facebook.com/v23.0/PNID/messages",
    ]);

    expect(JSON.parse(calls[1]?.body ?? "")).toMatchObject({
      to: "628",
      type: "interactive",
      interactive: { action: { buttons: [{ type: "reply", reply: { id: "draft:1:yes" } }] } },
    });
    expect(JSON.parse(calls[3]?.body ?? "")).toMatchObject({
      image: { id: "media-1", caption: "cap" },
    });
  });

  test("a closed 24-hour window is final, a 5xx or 429 is retryable", async () => {
    const { fetcher } = graph([
      Response.json(
        { error: { message: "Re-engagement message", code: 131_047 } },
        { status: 400 },
      ),
      new Response("bad gateway", { status: 502 }),
    ]);

    const client = createWhatsAppClient(config, fetcher);
    const closed = await client.sendText("628", "halo").catch((error) => error);
    const flaky = await client.sendText("628", "halo").catch((error) => error);

    expect(closed).toBeInstanceOf(WhatsAppError);
    expect([closed.code, closed.retryable]).toEqual([131_047, false]);
    expect([flaky.code, flaky.retryable]).toEqual([null, true]);
  });

  test("template with an image header", async () => {
    const { calls, fetcher } = graph([sent("w1")]);

    await createWhatsAppClient(config, fetcher).sendTemplate("628", {
      name: "rekap_mingguan",
      language: "id",
      bodyParams: ["Kopi Senja"],
      headerImageId: "media-1",
    });

    expect(JSON.parse(calls[0]?.body ?? "").template.components).toEqual([
      { type: "header", parameters: [{ type: "image", image: { id: "media-1" } }] },
      { type: "body", parameters: [{ type: "text", text: "Kopi Senja" }] },
    ]);
  });
});
