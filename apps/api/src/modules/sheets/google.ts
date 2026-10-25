import { z } from "zod";
import { rowsSchema, type Cell, type WriteCell } from "./parse";

// The only code that knows Google. Service account + Sheets API v4 over fetch, no SDK (G5).

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_LIFETIME_S = 3600;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export const serviceAccountSchema = z.object({
  client_email: z.email(),
  private_key: z.string().includes("PRIVATE KEY"),
});

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

// Parses GOOGLE_SERVICE_ACCOUNT_JSON; the error never echoes the key.
export function parseServiceAccount(json: string): ServiceAccount {
  let parsed: ReturnType<typeof serviceAccountSchema.safeParse> | null = null;

  try {
    parsed = serviceAccountSchema.safeParse(JSON.parse(json));
  } catch {
    // JSON.parse messages can quote the input, so they are replaced below.
  }

  if (parsed === null || !parsed.success) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON harus JSON service account (client_email, private_key).",
    );
  }

  return parsed.data;
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replaceAll(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, "");

  return new Uint8Array(Buffer.from(body, "base64"));
}

export async function signServiceAccountJwt(account: ServiceAccount, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));

  const claims = base64Url(
    encoder.encode(
      JSON.stringify({
        iss: account.client_email,
        scope: SHEETS_SCOPE,
        aud: TOKEN_URL,
        iat: issuedAt,
        exp: issuedAt + TOKEN_LIFETIME_S,
      }),
    ),
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(`${header}.${claims}`),
  );

  return `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
}

const tokenResponseSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() });

export type AccessTokenProvider = () => Promise<string | null>;

// Caches the token until shortly before it expires. `null` = Google refused the service account.
export function createAccessTokenProvider(
  account: ServiceAccount,
  fetcher: Fetch = fetch,
  clock: () => Date = () => new Date(),
): AccessTokenProvider {
  let cached: { token: string; expiresAt: number } | null = null;

  return async () => {
    const now = clock();

    if (cached !== null && now.getTime() < cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return cached.token;
    }

    const response = await fetcher(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: await signServiceAccountJwt(account, now),
      }),
    });

    const parsed = tokenResponseSchema.safeParse(response.ok ? await response.json() : null);

    if (!parsed.success) return null;

    cached = {
      token: parsed.data.access_token,
      expiresAt: now.getTime() + parsed.data.expires_in * 1000,
    };

    return cached.token;
  };
}

export type SheetsFailure = "no_access" | "not_found" | "rate_limited" | "unavailable" | "rejected";

export type SheetsResult<T> =
  | { status: "ok"; value: T }
  | { status: "error"; reason: SheetsFailure };

export type SheetTab = { id: number; title: string };

export type SpreadsheetInfo = { title: string; tabs: SheetTab[] };

export type SheetsClient = {
  getSpreadsheet: (spreadsheetId: string) => Promise<SheetsResult<SpreadsheetInfo>>;
  getValues: (spreadsheetId: string, range: string) => Promise<SheetsResult<Cell[][]>>;
  appendRows: (
    spreadsheetId: string,
    range: string,
    rows: WriteCell[][],
  ) => Promise<SheetsResult<{ updatedRows: number }>>;
};

export function failureFor(status: number): SheetsFailure {
  if (status === 401 || status === 403) return "no_access";

  if (status === 404) return "not_found";

  if (status === 429) return "rate_limited";

  return status >= 500 ? "unavailable" : "rejected";
}

const spreadsheetSchema = z.object({
  properties: z.object({ title: z.string() }),
  sheets: z.array(
    z.object({
      properties: z.object({ sheetId: z.number(), title: z.string(), index: z.number() }),
    }),
  ),
});

const valuesSchema = z.object({ values: rowsSchema.optional() });

const appendSchema = z.object({
  updates: z.object({ updatedRows: z.number().optional() }),
});

export function createSheetsClient(
  getAccessToken: AccessTokenProvider,
  fetcher: Fetch = fetch,
): SheetsClient {
  async function call<T>(
    url: string,
    init: RequestInit,
    schema: z.ZodType<T>,
  ): Promise<SheetsResult<T>> {
    const token = await getAccessToken();

    if (token === null) return { status: "error", reason: "no_access" };

    let response: Response;

    try {
      response = await fetcher(url, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      });
    } catch {
      return { status: "error", reason: "unavailable" };
    }

    if (!response.ok) return { status: "error", reason: failureFor(response.status) };

    const parsed = schema.safeParse(await response.json());

    return parsed.success
      ? { status: "ok", value: parsed.data }
      : { status: "error", reason: "unavailable" };
  }

  const base = (spreadsheetId: string) => `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}`;

  return {
    async getSpreadsheet(spreadsheetId) {
      const fields = "properties.title,sheets.properties(sheetId,title,index)";

      const result = await call(
        `${base(spreadsheetId)}?fields=${encodeURIComponent(fields)}`,
        { method: "GET" },
        spreadsheetSchema,
      );

      if (result.status === "error") return result;

      const tabs = result.value.sheets
        .map(({ properties }) => properties)
        .toSorted((a, b) => a.index - b.index)
        .map(({ sheetId, title }) => ({ id: sheetId, title }));

      return { status: "ok", value: { title: result.value.properties.title, tabs } };
    },

    async getValues(spreadsheetId, range) {
      // Formula cells come back as their computed number; dates as the text the owner sees.
      const query = "valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING";
      const url = `${base(spreadsheetId)}/values/${encodeURIComponent(range)}?${query}`;
      const result = await call(url, { method: "GET" }, valuesSchema);

      return result.status === "error"
        ? result
        : { status: "ok", value: result.value.values ?? [] };
    },

    async appendRows(spreadsheetId, range, rows) {
      const query = "valueInputOption=RAW&insertDataOption=INSERT_ROWS";
      const url = `${base(spreadsheetId)}/values/${encodeURIComponent(range)}:append?${query}`;
      const body = JSON.stringify({ majorDimension: "ROWS", values: rows });
      const result = await call(url, { method: "POST", body }, appendSchema);

      return result.status === "error"
        ? result
        : { status: "ok", value: { updatedRows: result.value.updates.updatedRows ?? 0 } };
    },
  };
}
