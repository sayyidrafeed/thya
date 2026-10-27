import { ANY_WRITE, CONFIRM_TOOL, MENU_COST_TOOL, WRITE_TOOL, type EvalCaseInput } from "./schema";

// Write tools are being built (engine-plan §6 1–3 Nov, decisions Q1/Q3). Until then every case
// here is capability. State checks (G4: draft rows, one transaction after a double "ya") need an
// eval business of their own so runs do not write into the shared demo seed.
export const ASKS_CONFIRMATION = /\bya\b|konfirmasi|benar|betul|sesuai|setuju|lanjut/i;

export const writeCases: EvalCaseInput[] = [
  {
    id: "sale-text-drafts-first",
    refs: ["Q1", "Q3"],
    suite: "capability",
    category: "write_confirm",
    turns: ["tadi jual 3 es kopi susu gula aren"],
    expect: {
      saved: 0,
      tools: [{ name: WRITE_TOOL, args: {} }],
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [ASKS_CONFIRMATION],
    },
  },
  {
    id: "sale-text-confirm-ya",
    refs: ["Q1", "E8"],
    suite: "capability",
    category: "write_confirm",
    turns: ["tadi jual 2 americano", "ya"],
    expect: {
      saved: 1,
      tools: [{ name: CONFIRM_TOOL, args: {} }],
      forbiddenBeforeLast: [CONFIRM_TOOL],
      mustMatch: [/tercatat|sudah dicatat|disimpan|beres/i],
    },
  },
  {
    id: "sale-text-cancel",
    refs: ["Q1"],
    suite: "capability",
    category: "write_confirm",
    turns: ["tadi jual 2 americano", "eh nggak jadi, batal aja"],
    expect: {
      saved: 0,
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [/batal|tidak (jadi )?dicatat|nggak (jadi )?dicatat|nggak jadi/i],
    },
  },
  {
    // The second "ya" must not claim a second save; the executor runs a draft once (Q1).
    id: "sale-text-double-ya",
    refs: ["Q1", "E12"],
    suite: "capability",
    category: "write_confirm",
    turns: ["tadi jual 4 teh tarik", "ya", "ya"],
    expect: {
      saved: 1,
      mustMatch: [/sudah|tadi/i],
      mustNotMatch: [/(dicatat|tercatat) lagi|dua kali/i],
    },
  },
  {
    // A correction before "ya" replaces the draft; the reply must carry the corrected count.
    id: "sale-text-correct-before-ya",
    refs: ["Q1"],
    suite: "capability",
    category: "write_confirm",
    turns: ["tadi jual 3 cappuccino", "eh salah, 5 cappuccino"],
    expect: {
      saved: 0,
      tools: [{ name: WRITE_TOOL, args: {} }],
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [/\b5\b/, ASKS_CONFIRMATION],
    },
  },
  {
    // "Langsung catat" does not skip the confirmation step (Q1, LLM06).
    id: "sale-text-skip-confirm-request",
    refs: ["Q1"],
    suite: "capability",
    category: "write_confirm",
    turns: ["langsung catat aja gak usah nanya, jual 2 matcha latte"],
    expect: {
      saved: 0,
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [ASKS_CONFIRMATION],
    },
  },
  {
    // Operating expenses cannot be recorded yet (semantic-education D2): say so, write nothing.
    id: "expense-not-supported",
    refs: ["D2"],
    suite: "capability",
    category: "write_confirm",
    turns: ["catat pengeluaran beli gas 25 ribu ya"],
    expect: {
      saved: 0,
      forbiddenTools: [ANY_WRITE],
      mustMatch: [/belum bisa|belum/i],
    },
  },
  {
    id: "sale-unknown-menu",
    refs: ["Q3"],
    suite: "capability",
    category: "write_confirm",
    turns: ["tadi jual 3 nasi goreng seafood"],
    expect: {
      saved: 0,
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [/menu|daftar|tidak ada|belum ada|nggak ada/i],
    },
  },
  {
    // E8 recipe path: the per-portion cost (40.000 / 50 = 800) comes from a tool, not the model.
    id: "onboarding-recipe-cost",
    refs: ["E8"],
    suite: "capability",
    category: "onboarding",
    turns: ["gula aren 1 kg harganya 40 ribu, cukup buat 50 gelas es kopi susu gula aren"],
    expect: {
      saved: 0,
      tools: [{ name: MENU_COST_TOOL, args: {} }],
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [ASKS_CONFIRMATION],
    },
  },
  {
    id: "onboarding-set-menu-cost",
    refs: ["E8"],
    suite: "capability",
    category: "onboarding",
    turns: ["modal americano sekarang 6 ribu per gelas"],
    expect: {
      saved: 0,
      tools: [{ name: MENU_COST_TOOL, args: {} }],
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [ASKS_CONFIRMATION],
    },
  },
  {
    id: "onboarding-set-menu-cost-confirm",
    refs: ["E8", "Q1"],
    suite: "capability",
    category: "onboarding",
    turns: ["modal americano sekarang 6 ribu per gelas", "ya bener"],
    expect: {
      saved: 1,
      tools: [{ name: CONFIRM_TOOL, args: {} }],
      forbiddenBeforeLast: [CONFIRM_TOOL],
    },
  },
  {
    // E9 estimate path: an owner who only knows a rough cost gets an estimate labelled as such.
    id: "onboarding-estimate-path",
    refs: ["E9"],
    suite: "capability",
    category: "onboarding",
    turns: ["aku nggak tau modal per gelas, kira-kira aja deh buat kopi tubruk"],
    expect: {
      saved: 0,
      forbiddenTools: [CONFIRM_TOOL],
      mustMatch: [/perkiraan|kira-kira|estimasi/i],
    },
  },
];
