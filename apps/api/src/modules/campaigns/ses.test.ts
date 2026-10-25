import { describe, expect, test } from "bun:test";
import { createSesClient, signRequest, type Fetch, type OutgoingEmail } from "./ses";

describe("signRequest", () => {
  // Worked example from the AWS SigV4 documentation (IAM ListUsers, 2015-08-30).
  test("matches the AWS documentation signature", () => {
    const headers = signRequest(
      {
        method: "GET",
        url: "https://iam.amazonaws.com/?Version=2010-05-08&Action=ListUsers",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
        body: "",
      },
      { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" },
      { region: "us-east-1", service: "iam" },
      new Date("2015-08-30T12:36:00Z"),
    );

    expect(Object.entries(headers).toSorted()).toEqual(
      Object.entries({
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        host: "iam.amazonaws.com",
        "x-amz-date": "20150830T123600Z",
        authorization:
          "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
          "SignedHeaders=content-type;host;x-amz-date, " +
          "Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
      }).toSorted(),
    );
  });
});

const email: OutgoingEmail = {
  from: "Kopi Senja <promo@thya.veterantech.id>",
  to: "tim@example.com",
  subject: "Paket pagi",
  text: "Es Kopi Susu + Pisang Goreng",
  unsubscribeUrl: "https://api.thya.veterantech.id/email/unsubscribe/abc",
};

const credentials = { accessKeyId: "AKIDTEST", secretAccessKey: "secret" };
const clock = () => new Date("2026-10-25T03:00:00Z");

function fakeFetch(response: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];

  const fetcher: Fetch = async (url, init) => {
    calls.push({ url, init });

    return response();
  };

  return { calls, fetcher };
}

describe("ses client", () => {
  test("sends SendEmail v2 to the Jakarta endpoint with a signed request", async () => {
    const { calls, fetcher } = fakeFetch(() => Response.json({ MessageId: "msg-1" }));

    const result = await createSesClient(credentials, fetcher, clock).sendEmail(email);

    expect(result).toEqual({ status: "sent", messageId: "msg-1" });
    expect(calls[0]?.url).toBe(
      "https://email.ap-southeast-3.amazonaws.com/v2/email/outbound-emails",
    );

    const headers = new Headers(calls[0]?.init.headers);

    expect(headers.get("authorization")).toStartWith(
      "AWS4-HMAC-SHA256 Credential=AKIDTEST/20261025/ap-southeast-3/ses/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=",
    );
    expect(headers.get("x-amz-date")).toBe("20261025T030000Z");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      FromEmailAddress: email.from,
      Destination: { ToAddresses: ["tim@example.com"] },
      Content: {
        Simple: {
          Subject: { Data: "Paket pagi", Charset: "UTF-8" },
          Body: { Text: { Data: "Es Kopi Susu + Pisang Goreng", Charset: "UTF-8" } },
          Headers: [{ Name: "List-Unsubscribe", Value: `<${email.unsubscribeUrl}>` }],
        },
      },
    });
  });

  test.each([
    [
      400,
      "MessageRejected:http://internal.amazon.com/coral/x",
      "rejected",
      false,
      "MessageRejected",
    ],
    [403, null, "unauthorized", false, null],
    [429, "TooManyRequestsException", "throttled", true, "TooManyRequestsException"],
    [500, null, "unavailable", true, null],
  ] as const)("maps HTTP %i", async (status, errorHeader, reason, retryable, errorType) => {
    const headers = errorHeader === null ? undefined : { "x-amzn-errortype": errorHeader };
    const { fetcher } = fakeFetch(() => Response.json({ message: "x" }, { status, headers }));

    expect(await createSesClient(credentials, fetcher, clock).sendEmail(email)).toEqual({
      status: "failed",
      reason,
      retryable,
      errorType,
    });
  });

  test("treats a network failure as retryable", async () => {
    const fetcher: Fetch = async () => {
      throw new TypeError("fetch failed");
    };

    expect(await createSesClient(credentials, fetcher, clock).sendEmail(email)).toMatchObject({
      status: "failed",
      retryable: true,
    });
  });
});
