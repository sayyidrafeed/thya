import { createHash, createHmac } from "node:crypto";
import { z } from "zod";

// The only code that knows AWS: SES v2 SendEmail over HTTPS with a hand-written SigV4 signer (G6).

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const SES_REGION = "ap-southeast-3";

export type AwsCredentials = { accessKeyId: string; secretAccessKey: string };

// Lower-case header name -> value.
export type HttpHeaders = Record<string, string>;

export type SignableRequest = {
  method: string;
  url: string;
  headers: HttpHeaders;
  body: string;
};

export type SigningScope = { region: string; service: string };

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

// RFC 3986 encoding as SigV4 requires; encodeURIComponent leaves !'()* alone.
function rfc3986(text: string): string {
  return encodeURIComponent(text).replaceAll(
    /[!'()*]/g,
    (char) => `%${char.codePointAt(0)?.toString(16).toUpperCase()}`,
  );
}

function byCodeUnit(a: string, b: string): number {
  if (a === b) return 0;

  return a < b ? -1 : 1;
}

// Sorted by encoded name, then value, as SigV4 requires.
function canonicalQuery(url: URL): string {
  return [...url.searchParams]
    .map(([key, value]) => ({ key: rfc3986(key), value: rfc3986(value) }))
    .toSorted((a, b) => byCodeUnit(a.key, b.key) || byCodeUnit(a.value, b.value))
    .map(({ key, value }) => `${key}=${value}`)
    .join("&");
}

function amzDate(now: Date): string {
  return now
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

// Returns the request headers plus host, x-amz-date and authorization.
export function signRequest(
  request: SignableRequest,
  credentials: AwsCredentials,
  scope: SigningScope,
  now: Date,
) {
  const url = new URL(request.url);
  const timestamp = amzDate(now);
  const day = timestamp.slice(0, 8);

  const headers = new Map(
    Object.entries({ ...request.headers, host: url.host, "x-amz-date": timestamp }).map(
      ([name, value]) => [name.toLowerCase(), value.trim().replaceAll(/\s+/g, " ")],
    ),
  );

  const names = [...headers.keys()].toSorted();
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    request.method,
    url.pathname.split("/").map(rfc3986).join("/"),
    canonicalQuery(url),
    names.map((name) => `${name}:${headers.get(name)}\n`).join(""),
    signedHeaders,
    sha256Hex(request.body),
  ].join("\n");

  const credentialScope = `${day}/${scope.region}/${scope.service}/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), scope.region), scope.service),
    "aws4_request",
  );

  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...Object.fromEntries(headers),
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  unsubscribeUrl: string;
};

export type SesFailure = "rejected" | "throttled" | "unavailable" | "unauthorized";

export type SendResult =
  | { status: "sent"; messageId: string }
  | { status: "failed"; reason: SesFailure; retryable: boolean; errorType: string | null };

export type SesClient = { sendEmail: (email: OutgoingEmail) => Promise<SendResult> };

const sentSchema = z.object({ MessageId: z.string().min(1) });

function sesFailure(status: number): SesFailure {
  if (status === 429) return "throttled";

  if (status === 401 || status === 403) return "unauthorized";

  return status >= 500 ? "unavailable" : "rejected";
}

function failed(reason: SesFailure, errorType: string | null): SendResult {
  return {
    status: "failed",
    reason,
    retryable: reason === "throttled" || reason === "unavailable",
    errorType,
  };
}

export function sesRequestBody(email: OutgoingEmail): string {
  const utf8 = (data: string) => ({ Data: data, Charset: "UTF-8" });

  return JSON.stringify({
    FromEmailAddress: email.from,
    Destination: { ToAddresses: [email.to] },
    Content: {
      Simple: {
        Subject: utf8(email.subject),
        Body: { Text: utf8(email.text) },
        Headers: [{ Name: "List-Unsubscribe", Value: `<${email.unsubscribeUrl}>` }],
      },
    },
  });
}

export function createSesClient(
  credentials: AwsCredentials,
  fetcher: Fetch = fetch,
  clock: () => Date = () => new Date(),
  region: string = SES_REGION,
): SesClient {
  const url = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

  return {
    async sendEmail(email) {
      const body = sesRequestBody(email);

      const request = {
        method: "POST",
        url,
        headers: { "content-type": "application/json" },
        body,
      };

      const headers = signRequest(request, credentials, { region, service: "ses" }, clock());

      let response: Response;

      try {
        response = await fetcher(url, { method: "POST", headers, body });
      } catch {
        return failed("unavailable", null);
      }

      // e.g. "MessageRejected:http://internal.amazon.com/coral/..." -> "MessageRejected"
      const errorType = response.headers.get("x-amzn-errortype")?.split(":")[0] ?? null;

      if (!response.ok) return failed(sesFailure(response.status), errorType);

      const parsed = sentSchema.safeParse(await response.json());

      return parsed.success
        ? { status: "sent", messageId: parsed.data.MessageId }
        : failed("unavailable", null);
    },
  };
}
