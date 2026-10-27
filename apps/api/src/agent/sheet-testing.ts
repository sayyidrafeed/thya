import {
  createSheetsAccess,
  type Fetch,
  type ServiceAccount,
  type SheetPort,
  type SheetsAccess,
  type StoredConnection,
} from "../modules/sheets";

// Test helpers: an in-memory Google (token endpoint + the Sheets API v4 calls Thya makes), passed
// in as `fetch`, so tests run the real client, JWT signing included, without the network.

export type FakeCell = string | number;

export type FakeTab = { id: number; title: string; rows: FakeCell[][] };

export type FakeSpreadsheet = {
  title: string;
  access: "editor" | "viewer" | "none";
  tabs: FakeTab[];
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN = "fake-google-token";
const SHEETS_PATH = /^\/v4\/spreadsheets\/([^/]+)(?:\/values\/(.+?)(:append)?)?$/;
const QUOTED_RANGE = /^'((?:[^']|'')+)'(?:!(.+))?$/;

const fail = (status: number) => Response.json({ error: { code: status } }, { status });

const letterIndex = (letters: string) =>
  [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;

// Like Google: trailing empty cells and trailing empty rows are left out.
function trimmed(rows: FakeCell[][]): FakeCell[][] {
  const cut = rows.map((row) => row.slice(0, row.findLastIndex((cell) => cell !== "") + 1));

  return cut.slice(0, cut.findLastIndex((row) => row.length > 0) + 1);
}

function select(rows: FakeCell[][], a1: string | undefined): FakeCell[][] {
  if (a1 === undefined) return rows;

  const byRows = /^(\d+):(\d+)$/.exec(a1);

  if (byRows) return rows.slice(Number(byRows[1]) - 1, Number(byRows[2]));

  const byColumns = /^([A-Z]+):([A-Z]+)$/.exec(a1);

  if (!byColumns?.[1] || !byColumns[2]) throw new Error(`fake Sheets cannot read range ${a1}`);

  const from = letterIndex(byColumns[1]);
  const to = letterIndex(byColumns[2]);

  return rows.map((row) => row.slice(from, to + 1));
}

export function fakeGoogle(spreadsheets: Map<string, FakeSpreadsheet>) {
  const requests: { method: string; url: string }[] = [];
  // HTTP statuses the next Sheets calls answer with, before touching any data.
  const failures: number[] = [];
  // Appends that land in the sheet but still answer 503, like a timeout after the write.
  let landThenFail = 0;

  function sheetsCall(url: URL, init: RequestInit): Response {
    const [, id = "", range, append] = SHEETS_PATH.exec(url.pathname) ?? [];
    const spreadsheet = spreadsheets.get(decodeURIComponent(id));
    const failure = failures.shift();

    if (failure !== undefined) return fail(failure);

    if (spreadsheet === undefined) return fail(404);

    if (spreadsheet.access === "none") return fail(403);

    if (range === undefined)
      return Response.json({
        properties: { title: spreadsheet.title },
        sheets: spreadsheet.tabs.map((tab, index) => ({
          properties: { sheetId: tab.id, title: tab.title, index },
        })),
      });

    const [, quoted = "", a1] = QUOTED_RANGE.exec(decodeURIComponent(range)) ?? [];

    const tab = spreadsheet.tabs.find(
      (candidate) => candidate.title === quoted.replaceAll("''", "'"),
    );

    if (tab === undefined) return fail(400);

    if (append === undefined) return Response.json({ values: trimmed(select(tab.rows, a1)) });

    if (spreadsheet.access !== "editor") return fail(403);

    const body: { values: FakeCell[][] } = JSON.parse(String(init.body));

    tab.rows.push(...body.values);

    if (landThenFail > 0) {
      landThenFail--;

      return fail(503);
    }

    return Response.json({ updates: { updatedRows: body.values.length } });
  }

  const fetcher: Fetch = async (url, init) => {
    requests.push({ method: init.method ?? "GET", url });

    if (url === TOKEN_URL) return Response.json({ access_token: TOKEN, expires_in: 3600 });

    if (new Headers(init.headers).get("authorization") !== `Bearer ${TOKEN}`) return fail(401);

    return sheetsCall(new URL(url), init);
  };

  return {
    fetcher,
    requests,
    failNext: (status: number) => failures.push(status),
    landThenFail: () => landThenFail++,
    appends: () => requests.filter(({ url }) => url.includes(":append")).length,
  };
}

async function createTestAccount(): Promise<ServiceAccount> {
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

  return {
    client_email: "thya-sheets@thya-test.iam.gserviceaccount.com",
    private_key: `-----BEGIN PRIVATE KEY-----\n${der.replaceAll(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`,
  };
}

let sharedAccount: Promise<ServiceAccount> | null = null;

// RSA key generation is slow; one throwaway key serves every test in the process.
export function testServiceAccount(): Promise<ServiceAccount> {
  sharedAccount ??= createTestAccount();

  return sharedAccount;
}

export async function fakeSheetsAccess(fetcher: Fetch): Promise<SheetsAccess> {
  return createSheetsAccess(await testServiceAccount(), fetcher, async () => {});
}

// A SheetPort without Postgres: the connection lives in memory, imported rows and costs are given.
export function memorySheetPort(
  access: SheetsAccess,
  known: { imported?: number[]; costSince?: Map<string, string> } = {},
) {
  const saved: StoredConnection[] = [];

  const port: SheetPort = {
    access,
    activeConnection: async () => saved.at(-1) ?? null,
    saveConnection: async (connection) => {
      saved.push(connection);
    },
    importedRows: async () => new Set(known.imported),
    costSince: async () => known.costSince ?? new Map(),
  };

  return { port, saved };
}
