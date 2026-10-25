import type { EvalCase } from "./cases";
import type { Trial } from "./run";

const OUTPUT_CHARS = 600;

const quote = (text: string) =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

const clip = (text = "undefined") =>
  text.length > OUTPUT_CHARS ? `${text.slice(0, OUTPUT_CHARS)}…` : text;

function transcript(trial: Trial): string {
  return trial.turns
    .map((turn, index) => {
      const check = trial.checks[index];

      return [
        `**Pemilik:**\n${quote(turn.user)}`,
        ...turn.calls.map(
          (call, position) =>
            `- \`${call.name}\` ${clip(JSON.stringify(call.args))}\n  → ${clip(JSON.stringify(turn.toolOutputs[position]))}`,
        ),
        `**Thya**${check && check.action !== "none" ? ` (cek angka: ${check.action})` : ""}:\n${quote(turn.reply)}`,
      ].join("\n\n");
    })
    .join("\n\n");
}

// U3: only failed trials, so reading ten failures (the §5.3 ritual) does not mean opening JSONL.
// Tone cases are listed in full for the advisory judge (Q10), pass or fail.
export function writeReport({
  meta,
  totals,
  trials,
  cases,
}: {
  meta: Record<string, string | boolean>;
  totals: {
    status: string;
    byTag: Record<string, { cases: number; passAll: number; passHat3: number }>;
  };
  trials: Trial[];
  cases: EvalCase[];
}): string {
  const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));

  const failed = trials
    .filter((trial) => trial.error !== null || trial.grades.some((grade) => !grade.pass))
    .toSorted((a, b) => a.id.localeCompare(b.id) || a.trial - b.trial);

  const header = [
    `# Eval ${totals.status}`,
    "",
    ...Object.entries(meta).map(([key, value]) => `- ${key}: ${String(value)}`),
    "",
    "| Tag | Kasus lulus semua | pass^3 |",
    "|---|---|---|",
    ...Object.entries(totals.byTag).map(
      ([tag, row]) => `| ${tag} | ${row.passAll}/${row.cases} | ${row.passHat3.toFixed(2)} |`,
    ),
  ];

  const failures = failed.map((trial) => {
    const testCase = byId.get(trial.id);

    const checks = trial.grades
      .filter((grade) => !grade.pass)
      .map((grade) => `- ${grade.check}${grade.detail ? ` (${grade.detail})` : ""}`);

    return [
      `## ${trial.id} · percobaan ${trial.trial + 1} · ${testCase?.suite}/${testCase?.category}`,
      "",
      ...(trial.error ? [`- error: ${trial.error}`] : checks),
      "",
      transcript(trial),
    ].join("\n");
  });

  const judged = cases
    .filter((testCase) => testCase.expect.judge === "tone")
    .flatMap((testCase) => trials.filter((trial) => trial.id === testCase.id))
    .map((trial) => `### ${trial.id} · percobaan ${trial.trial + 1}\n\n${transcript(trial)}`);

  return [
    ...header,
    "",
    `# Percobaan gagal (${failed.length} dari ${trials.length})`,
    "",
    ...failures.flatMap((block) => [block, ""]),
    "# Untuk judge nada (advisory, E13)",
    "",
    "Rubrik biner: santai dan sopan, memanggil Kak, tanpa istilah Inggris, penjelasan ≤ ~3 kalimat. PASS/FAIL/CANNOT_EVALUATE + alasan.",
    "",
    ...judged.flatMap((block) => [block, ""]),
  ].join("\n");
}
