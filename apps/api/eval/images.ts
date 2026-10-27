// Gate G11 harness: `bun run eval:images [folder] [--k 5]` from apps/api. Every JPEG/PNG in the
// folder (default eval/images/, gitignored) goes through the production extractPayments +
// planPaymentsImport K times and is graded against `<name>.expected.json` beside it. Output holds
// counts and key row ids only; amounts, references and pictures never reach the terminal.
// Exit 0 = PASS (S9-AC1 met), 1 = FAIL, 2 = INCOMPLETE (too few screenshots or runs, or errors).
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import { chatModel } from "../src/llm";
import { extractPayments } from "../src/modules/payments-import";
import { jakartaDate } from "../src/sales/report";
import {
  AC1,
  answerKeySchema,
  gradeRun,
  summarizeImage,
  verdict,
  type ImageRuns,
  type RunGrade,
} from "./images-grade";

// The two formats the WhatsApp path accepts (S9 flow step 1).
function mediaTypeOf(file: string) {
  const extension = extname(file).toLowerCase();

  if (extension === ".png") return "image/png";

  return extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : null;
}

const { values: flags, positionals } = parseArgs({
  options: { k: { type: "string" } },
  allowPositionals: true,
});

const folder = positionals[0] ?? "eval/images";
const k = Number(flags.k ?? AC1.runs);

if (!Number.isInteger(k) || k < 1) throw new Error("--k must be a positive whole number");

const images: ImageRuns[] = [];

for (const file of (await readdir(folder)).sort()) {
  const mediaType = mediaTypeOf(file);

  if (mediaType === null) continue;

  const name = file.slice(0, -extname(file).length);
  const keyText = await readFile(join(folder, `${name}.expected.json`), "utf8").catch(() => null);

  if (keyText === null) {
    console.log(`${file}: no ${name}.expected.json, skipped`);
    continue;
  }

  const key = answerKeySchema.safeParse(JSON.parse(keyText));

  if (!key.success) {
    const where = key.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");

    console.log(`${file}: answer key does not match the format at ${where}, skipped`);
    continue;
  }

  const today = key.data.today ?? jakartaDate(new Date());
  const bytes = new Uint8Array(await readFile(join(folder, file)));
  const runs: RunGrade[] = [];

  for (let run = 0; run < k; run += 1)
    runs.push(
      gradeRun(
        key.data,
        // G11 grades the QRIS/GoPay read exactly as production runs it with delivery import off.
        await extractPayments(bytes, { model: chatModel, mediaType, today, delivery: false }),
        today,
      ),
    );

  images.push({ name: file, runs });

  const s = summarizeImage(runs);

  console.log(
    [
      `${file} (${s.runs} runs${s.errors > 0 ? `, ${s.errors} errored` : ""})`,
      `  rows matched ${s.matched}/${s.rows} · missing ${s.missing} · extra ${s.extra} (would save ${s.extraImported}) · wrong amount ${s.wrongAmount} · wrong date/time ${s.wrongDate} · other ${s.other}`,
      `  amounts not on the picture ${s.unknownAmounts} · document kind wrong ${s.kindWrong} · reference differs ${s.referenceDiffers}`,
      ...s.issues.map((issue) => `  ${issue}`),
    ].join("\n"),
  );
}

const result = verdict(images);

console.log(
  [
    "",
    `S9-AC1: ${result.status} · money-in rows right ${(result.rowShare * 100).toFixed(1)}% · amounts not on the picture ${result.unknownAmounts}`,
    ...result.reasons.map((reason) => `  - ${reason}`),
  ].join("\n"),
);

process.exit(result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2);
