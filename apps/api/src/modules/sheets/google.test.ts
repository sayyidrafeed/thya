import { describe, expect, test } from "bun:test";
import {
  createAccessTokenProvider,
  createSheetsClient,
  parseServiceAccount,
  signServiceAccountJwt,
  type Fetch,
  type ServiceAccount,
  type SheetsFailure,
} from "./google";

type Call = { url: string; init: RequestInit };

function recordingFetch(respond: (call: Call) => Response) {
  const calls: Call[] = [];

  const fetcher: Fetch = async (url, init) => {
    const call = { url, init };
    calls.push(call);

    return respond(call);
  };

  return { calls, fetcher };
}

const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

async function createTestAccount(): Promise<{ account: ServiceAccount; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString(
    "base64",
  );

  const pem = `-----BEGIN PRIVATE KEY-----\n${der.replaceAll(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;

  return {
    account: { client_email: "thya@demo.iam.gserviceaccount.com", private_key: pem },
    publicKey: pair.publicKey,
  };
}

// RSA key generation is slow; one key serves every test.
const sharedAccount = createTestAccount();
const testAccount = () => sharedAccount;

describe("service account", () => {
  test("signs an RS256 JWT for the Sheets scope that verifies with the public key", async () => {
    const { account, publicKey } = await testAccount();
    const jwt = await signServiceAccountJwt(account, new Date("2026-10-25T00:00:00Z"));
    const [header = "", claims = "", signature = ""] = jwt.split(".");

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      Buffer.from(signature, "base64url"),
      new TextEncoder().encode(`${header}.${claims}`),
    );

    expect(valid).toBe(true);
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: "thya@demo.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_792_886_400,
      exp: 1_792_890_000,
    });
  });

  test("rejects a malformed key file without echoing it", () => {
    const secret = '{"client_email":"x@y.z","private_key":"super-secret"';

    expect(() => parseServiceAccount(secret)).toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON/);
    expect(() => parseServiceAccount(secret)).not.toThrow(/super-secret/);
  });

  test("caches the access token until shortly before it expires", async () => {
    const { account } = await testAccount();
    let now = new Date("2026-10-25T00:00:00Z");

    const { calls, fetcher } = recordingFetch(() =>
      json(JSON.stringify({ access_token: `token-${calls.length}`, expires_in: 3600 })),
    );

    const getToken = createAccessTokenProvider(account, fetcher, () => now);

    expect(await getToken()).toBe("token-1");
    expect(await getToken()).toBe("token-1");

    now = new Date("2026-10-25T00:59:30Z");

    expect(await getToken()).toBe("token-2");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(String(calls[0]?.init.body)).toContain(
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer",
    );
  });

  test("returns null when Google refuses the service account", async () => {
    const { account } = await testAccount();
    const { fetcher } = recordingFetch(() => json('{"error":"invalid_grant"}', 400));

    expect(await createAccessTokenProvider(account, fetcher)()).toBeNull();
  });
});

describe("sheets client", () => {
  const token = async () => "tok";

  test("lists tabs in sheet order", async () => {
    const { calls, fetcher } = recordingFetch(() =>
      json(
        JSON.stringify({
          properties: { title: "Laporan Kopi Senja" },
          sheets: [
            { properties: { sheetId: 9, title: "Oktober", index: 1 } },
            { properties: { sheetId: 0, title: "September", index: 0 } },
          ],
        }),
      ),
    );

    const result = await createSheetsClient(token, fetcher).getSpreadsheet("abc");

    expect(result).toEqual({
      status: "ok",
      value: {
        title: "Laporan Kopi Senja",
        tabs: [
          { id: 0, title: "September" },
          { id: 9, title: "Oktober" },
        ],
      },
    });
    expect(calls[0]?.url).toStartWith("https://sheets.googleapis.com/v4/spreadsheets/abc?fields=");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer tok");
  });

  test("reads values unformatted with dates as text and parses cells", async () => {
    const { calls, fetcher } = recordingFetch(() =>
      json(JSON.stringify({ values: [["23 Okt", 3260000, true]] })),
    );

    const result = await createSheetsClient(token, fetcher).getValues("abc", "'Okt 26'!A:A");

    expect(result).toEqual({
      status: "ok",
      value: [
        [
          { text: "23 Okt", number: null },
          { text: "3260000", number: 3_260_000 },
          { text: "true", number: null },
        ],
      ],
    });
    expect(calls[0]?.url).toBe(
      "https://sheets.googleapis.com/v4/spreadsheets/abc/values/'Okt%2026'!A%3AA?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING",
    );
  });

  test("returns no rows for an empty range", async () => {
    const { fetcher } = recordingFetch(() => json('{"range":"A1:A1"}'));

    expect(await createSheetsClient(token, fetcher).getValues("abc", "A:A")).toEqual({
      status: "ok",
      value: [],
    });
  });

  test("appends rows as RAW input so formulas stay text", async () => {
    const { calls, fetcher } = recordingFetch(() =>
      json(JSON.stringify({ updates: { updatedRows: 1 } })),
    );

    const rows = [["2026-10-24", '=IMPORTXML("http://x")']];
    const result = await createSheetsClient(token, fetcher).appendRows("abc", "'S'!A:B", rows);

    expect(result).toEqual({ status: "ok", value: { updatedRows: 1 } });
    expect(calls[0]?.url).toEndWith(":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      majorDimension: "ROWS",
      values: rows,
    });
  });

  const statusCases: [number, SheetsFailure][] = [
    [401, "no_access"],
    [403, "no_access"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "unavailable"],
    [503, "unavailable"],
    [400, "rejected"],
  ];

  test.each(statusCases)("maps HTTP %i to %s", async (status, reason) => {
    const { fetcher } = recordingFetch(() => json("{}", status));

    expect(await createSheetsClient(token, fetcher).getValues("abc", "A:A")).toEqual({
      status: "error",
      reason,
    });
  });

  test("treats a network failure as unavailable", async () => {
    const fetcher: Fetch = async () => {
      throw new TypeError("fetch failed");
    };

    expect(await createSheetsClient(token, fetcher).getSpreadsheet("abc")).toEqual({
      status: "error",
      reason: "unavailable",
    });
  });

  test("does not call the API without a token", async () => {
    const { calls, fetcher } = recordingFetch(() => json("{}"));

    expect(await createSheetsClient(async () => null, fetcher).getSpreadsheet("abc")).toEqual({
      status: "error",
      reason: "no_access",
    });
    expect(calls).toHaveLength(0);
  });
});
