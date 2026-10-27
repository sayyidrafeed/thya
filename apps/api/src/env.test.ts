import { describe, expect, test } from "bun:test";

const base = {
  PATH: process.env.PATH ?? "",
  NETRA_API_KEY: "k",
  DATABASE_URL: "postgres://u@localhost/x",
};

const whatsappEnv = {
  WHATSAPP_ACCESS_TOKEN: "token",
  WHATSAPP_PHONE_NUMBER_ID: "pnid",
  WHATSAPP_APP_SECRET: "secret",
  WHATSAPP_VERIFY_TOKEN: "verify",
};

// env.ts parses on import and exits on bad config, so each case boots it in its own process.
function boot(extra: Record<string, string>, probe = "m.whatsapp ? 'on' : 'off'") {
  const run = Bun.spawnSync(
    ["bun", "-e", `const m = await import("${import.meta.dir}/env.ts"); console.log(${probe});`],
    { cwd: import.meta.dir, env: { ...base, ...extra } },
  );

  return { code: run.exitCode, out: run.stdout.toString().trim(), err: run.stderr.toString() };
}

describe("WhatsApp env", () => {
  test("none set keeps the channel off", () => {
    expect(boot({})).toMatchObject({ code: 0, out: "off" });
  });

  test("all four set turns it on", () => {
    expect(boot(whatsappEnv)).toMatchObject({ code: 0, out: "on" });
  });

  test("a partial set fails the boot and names what is missing", () => {
    const { WHATSAPP_APP_SECRET: _, WHATSAPP_VERIFY_TOKEN: __, ...partial } = whatsappEnv;
    const result = boot(partial);

    expect(result.code).toBe(1);
    expect(result.err).toContain("WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN belum diisi");
  });
});

describe("Google Sheets env", () => {
  const probe = "m.env.GOOGLE_SERVICE_ACCOUNT_JSON?.client_email ?? 'off'";
  const key = "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n";

  test("unset leaves the sheet tools off", () => {
    expect(boot({}, probe)).toMatchObject({ code: 0, out: "off" });
  });

  test("a service account key file turns them on", () => {
    const json = JSON.stringify({
      client_email: "thya@demo.iam.gserviceaccount.com",
      private_key: key,
    });

    expect(boot({ GOOGLE_SERVICE_ACCOUNT_JSON: json }, probe)).toMatchObject({
      code: 0,
      out: "thya@demo.iam.gserviceaccount.com",
    });
  });

  test("anything else fails the boot without echoing the value", () => {
    const truncated = JSON.stringify({ private_key: key }).slice(0, -1);
    const result = boot({ GOOGLE_SERVICE_ACCOUNT_JSON: truncated }, probe);

    expect(result.code).toBe(1);
    expect(result.err).toContain("GOOGLE_SERVICE_ACCOUNT_JSON harus JSON service account");
    expect(result.err).not.toContain("not-a-real-key");
  });
});
