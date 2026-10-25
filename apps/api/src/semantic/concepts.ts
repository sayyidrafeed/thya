// Plain-language definitions for every concept Thya may explain. Owner: docs/semantic-education.md §3.1.
// Copy here is shown to shop owners, so it stays short, casual Indonesian and free of numbers.

export const CONCEPT_IDS = [
  "revenue",
  "cogs",
  "gross_profit",
  "gross_margin",
  "net_profit",
  "items_sold",
  "menu_cost",
  "operating_expense",
  "cash",
] as const;

export type ConceptId = (typeof CONCEPT_IDS)[number];

// Thya has no data for these yet, so explanations must say they cannot be computed.
export const NOT_RECORDED: ConceptId[] = ["net_profit", "operating_expense", "cash"];

export type Concept = {
  label: string;
  plain: string;
  whyItMatters: string;
  related: ConceptId[];
};

export const CONCEPTS: Record<ConceptId, Concept> = {
  revenue: {
    label: "omzet",
    plain:
      "Omzet itu semua uang yang masuk dari jualan, sebelum dipotong modal atau biaya apa pun.",
    whyItMatters:
      "Omzet besar belum tentu untung besar, karena modal bahan dan biaya lain belum dikurangi.",
    related: ["gross_profit", "cogs"],
  },
  cogs: {
    label: "modal bahan (HPP)",
    plain: "Modal bahan atau HPP itu total biaya bahan dan kemasan untuk semua porsi yang terjual.",
    whyItMatters:
      "Makin besar modal bahan dibanding harga jual, makin tipis sisa buat bayar sewa, gaji, dan untung.",
    related: ["menu_cost", "gross_profit"],
  },
  gross_profit: {
    label: "laba kotor",
    plain: "Laba kotor itu omzet dikurangi modal bahan. Sewa, gaji, dan listrik belum dipotong.",
    whyItMatters:
      "Dari laba kotor inilah sewa, gaji, dan listrik dibayar. Sisanya baru jadi untung bersih.",
    related: ["net_profit", "gross_margin"],
  },
  gross_margin: {
    label: "margin kotor",
    plain: "Margin kotor itu berapa persen dari omzet yang tersisa setelah dikurangi modal bahan.",
    whyItMatters: "Pakai persen, menu atau periode yang omzetnya beda-beda jadi bisa dibandingkan.",
    related: ["gross_profit", "cogs"],
  },
  net_profit: {
    label: "laba bersih",
    plain:
      "Laba bersih itu laba kotor dikurangi biaya operasional seperti sewa, gaji, dan listrik.",
    whyItMatters: "Ini uang yang benar-benar jadi hasil usaha setelah semua biaya dibayar.",
    related: ["gross_profit", "operating_expense"],
  },
  items_sold: {
    label: "jumlah terjual",
    plain: "Jumlah terjual itu total porsi atau gelas yang laku, dari semua menu.",
    whyItMatters: "Kalau jumlahnya naik tapi omzet tidak, berarti yang laku menu yang lebih murah.",
    related: ["revenue"],
  },
  menu_cost: {
    label: "modal per porsi",
    plain: "Modal per porsi itu biaya bahan dan kemasan untuk membuat satu porsi atau satu gelas.",
    whyItMatters: "Dari modal per porsi, Thya bisa hitung sisa uang tiap porsi dan laba kotor.",
    related: ["cogs", "gross_profit"],
  },
  operating_expense: {
    label: "biaya operasional",
    plain:
      "Biaya operasional itu biaya rutin di luar bahan, misalnya sewa, gaji, listrik, dan gas.",
    whyItMatters: "Biaya ini dibayar dari laba kotor, jadi menentukan untung bersih.",
    related: ["net_profit", "gross_profit"],
  },
  cash: {
    label: "uang kas",
    plain:
      "Uang kas itu uang yang benar-benar ada di laci atau rekening usaha, dari mana pun asalnya.",
    whyItMatters:
      "Kas bisa beda dengan untung. Usaha bisa untung tapi kasnya habis karena belanja stok.",
    related: ["net_profit"],
  },
};
