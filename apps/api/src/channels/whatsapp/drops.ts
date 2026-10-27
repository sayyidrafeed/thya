// Why the webhook refused a request, or dropped one change inside a signed one.
const NO_DROPS = {
  bad_verify_token: 0,
  bad_signature: 0,
  bad_json: 0,
  schema_mismatch: 0,
  other_phone_number: 0,
  other_field: 0,
};

export type DropReason = keyof typeof NO_DROPS;

export type WebhookDrops = { since: string; counts: Record<DropReason, number> };

let counted: WebhookDrops | null = null;

// Only the process that mounts the webhook (the API) counts; the worker's /health says null, not 0.
export function countWebhookDrops() {
  const drops = counted ?? { since: new Date().toISOString(), counts: { ...NO_DROPS } };

  counted = drops;

  // The reason is the whole line: no message text, phone number, wamid or signature.
  return function recordDrop(reason: DropReason) {
    drops.counts[reason] += 1;
    console.log(JSON.stringify({ event: "webhook-drop", reason }));
  };
}

export function webhookDrops(): WebhookDrops | null {
  if (counted === null) return null;

  return { since: counted.since, counts: { ...counted.counts } };
}
