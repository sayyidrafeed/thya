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
function boot(extra: Record<string, string>) {
  const run = Bun.spawnSync(
    [
      "bun",
      "-e",
      `const { whatsapp } = await import("${import.meta.dir}/env.ts"); console.log(whatsapp ? "on" : "off");`,
    ],
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
