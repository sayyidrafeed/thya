// Every table has one owning module (engine-plan §5.1, business-features-plan §8). Column names are
// snake_case in SQL through Drizzle's `casing` option.
import type { ModelMessage } from "ai";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { DELIVERY_CHANNELS, MENU_CATEGORIES } from "../sales/report";
import { CONCEPT_IDS } from "../semantic/concepts";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

// modules/business
export const businesses = pgTable("businesses", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  kind: text().notNull(),
  city: text().notNull(),
  openHour: smallint().notNull(),
  closeHour: smallint().notNull(),
  whatsappPhone: text().unique(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
});

// modules/menu
export const menuCategory = pgEnum("menu_category", MENU_CATEGORIES);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    name: text().notNull(),
    category: menuCategory().notNull(),
    price: integer().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex().on(table.businessId, table.name),
    check("price_positive", sql`${table.price} > 0`),
  ],
);

export const costSource = pgEnum("cost_source", ["owner", "recipe", "estimate", "seed"]);

// Cost per portion with a start date, so last month's profit never changes when sugar gets dearer.
export const menuCosts = pgTable(
  "menu_costs",
  {
    id: uuid().primaryKey().defaultRandom(),
    menuItemId: uuid()
      .notNull()
      .references(() => menuItems.id),
    amount: integer().notNull(),
    source: costSource().notNull(),
    includesPackaging: boolean(),
    validFrom: date().notNull(),
    draftId: uuid(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.menuItemId, table.validFrom),
    check("amount_not_negative", sql`${table.amount} >= 0`),
  ],
);

// modules/sales
export const transactionSource = pgEnum("transaction_source", ["seed", "chat", "sheet"]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    menuItemId: uuid()
      .notNull()
      .references(() => menuItems.id),
    soldOn: date().notNull(),
    // Seed and imported rows know the hour; a chat entry ("tadi laku 20") may not.
    soldAt: timestamp({ withTimezone: true }),
    quantity: integer().notNull(),
    unitPrice: integer().notNull(),
    source: transactionSource().notNull(),
    sourceSheetId: text(),
    sourceRow: integer(),
    draftId: uuid(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.businessId, table.soldOn),
    // S6-AC2: importing the same sheet row twice is a no-op.
    uniqueIndex("transactions_sheet_row_unique")
      .on(table.businessId, table.sourceSheetId, table.sourceRow)
      .where(sql`${table.sourceSheetId} IS NOT NULL`),
    // Re-running the seed never doubles the demo history.
    uniqueIndex("transactions_seed_unique")
      .on(table.businessId, table.menuItemId, table.soldAt)
      .where(sql`${table.source} = 'seed'`),
    check("quantity_positive", sql`${table.quantity} > 0`),
  ],
);

// modules/payments-import (business-features-plan S9, G10 default): money in from QRIS/GoPay,
// kept apart from per-menu sales so menu revenue is never counted twice.
export const paymentMethod = pgEnum("payment_method", ["qris", "gopay", "transfer", "lainnya"]);
export const paymentSource = pgEnum("payment_source", ["screenshot", "sheet", "chat"]);

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    paidAt: timestamp({ withTimezone: true }).notNull(),
    amount: integer().notNull(),
    method: paymentMethod().notNull(),
    source: paymentSource().notNull(),
    sourceRef: text(),
    imageSha256: text(),
    // Row index within one extraction; a safety net only, since row order can shift between reads.
    sourceRow: integer(),
    draftId: uuid(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.businessId, table.paidAt),
    uniqueIndex("payments_source_ref_unique")
      .on(table.businessId, table.source, table.sourceRef)
      .where(sql`${table.sourceRef} IS NOT NULL`),
    uniqueIndex("payments_image_row_unique")
      .on(table.businessId, table.imageSha256, table.sourceRow)
      .where(sql`${table.imageSha256} IS NOT NULL`),
    check("payment_amount_positive", sql`${table.amount} > 0`),
  ],
);

// modules/channel-sales (decided 2026-10-27): one delivery app's sales per WIB day, read from the
// owner's screenshot. Apart from menu revenue for the same reason as payments.
export const deliveryChannel = pgEnum("delivery_channel", DELIVERY_CHANNELS);
export const channelSaleSource = pgEnum("channel_sale_source", ["screenshot"]);

export const channelSales = pgTable(
  "channel_sales",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    channel: deliveryChannel().notNull(),
    soldOn: date().notNull(),
    grossSales: integer().notNull(),
    netReceived: integer(),
    orderCount: integer(),
    source: channelSaleSource().notNull(),
    imageSha256: text(),
    sourceRow: integer(),
    draftId: uuid(),
    createdAt: createdAt(),
  },
  (table) => [
    // A second screenshot of the same app and day never counts twice.
    uniqueIndex("channel_sales_day_unique").on(table.businessId, table.channel, table.soldOn),
    index().on(table.businessId, table.imageSha256),
    check("channel_gross_not_negative", sql`${table.grossSales} >= 0`),
    check(
      "channel_net_within_gross",
      sql`${table.netReceived} IS NULL OR (${table.netReceived} >= 0 AND ${table.netReceived} <= ${table.grossSales})`,
    ),
    check(
      "channel_orders_not_negative",
      sql`${table.orderCount} IS NULL OR ${table.orderCount} >= 0`,
    ),
  ],
);

// The commission the owner says one app takes, used for days whose screenshot shows no net amount.
export const channelCommissions = pgTable(
  "channel_commissions",
  {
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    channel: deliveryChannel().notNull(),
    rateBps: integer().notNull(),
    feePerOrder: integer().notNull(),
    draftId: uuid(),
    updatedAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.channel] }),
    check("commission_rate_range", sql`${table.rateBps} >= 0 AND ${table.rateBps} <= 10000`),
    check("commission_fee_not_negative", sql`${table.feePerOrder} >= 0`),
  ],
);

// modules/conversation (inbound WhatsApp first, so a redelivered webhook is dropped by wamid)
export const inboundMessages = pgTable(
  "inbound_messages",
  {
    wamid: text().primaryKey(),
    businessId: uuid().references(() => businesses.id),
    phone: text().notNull(),
    type: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: createdAt(),
    processedAt: timestamp({ withTimezone: true }),
    traceId: uuid(),
  },
  (table) => [
    index("inbound_messages_unprocessed")
      .on(table.phone)
      .where(sql`${table.processedAt} IS NULL`),
  ],
);

export const messageSource = pgEnum("message_source", ["whatsapp", "demo", "system"]);

// One long thread per business, stored as AI SDK model messages (decision Q8).
export const messages = pgTable(
  "messages",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    traceId: uuid().notNull(),
    message: jsonb().$type<ModelMessage>().notNull(),
    source: messageSource().notNull(),
    wamid: text(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.businessId, table.id)],
);

export const conversationSummaries = pgTable("conversation_summaries", {
  businessId: uuid()
    .primaryKey()
    .references(() => businesses.id),
  revision: integer().notNull(),
  coversThroughMessageId: bigint({ mode: "number" }).notNull(),
  summary: jsonb().notNull(),
  updatedAt: createdAt(),
});

// modules/semantic (ConceptExposure, decision D5)
export const conceptId = pgEnum("concept_id", CONCEPT_IDS);

export const conceptEventKind = pgEnum("concept_event_kind", [
  "explained",
  "confused",
  "correct_use",
]);

export const conceptEvents = pgTable(
  "concept_events",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    concept: conceptId().notNull(),
    kind: conceptEventKind().notNull(),
    traceId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.businessId, table.concept)],
);

// modules/drafts (decision Q1, widened by business-features-plan §4.3)
export const draftStatus = pgEnum("draft_status", [
  "pending",
  "executing",
  "done",
  "failed",
  "cancelled",
  "expired",
]);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    kind: text().notNull(),
    args: jsonb().notNull(),
    summary: text().notNull(),
    status: draftStatus().notNull().default("pending"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    traceId: uuid().notNull(),
    cardWamid: text(),
    outcome: jsonb(),
    createdAt: createdAt(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("drafts_open")
      .on(table.businessId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

// modules/traces (engine-plan B6): one row per turn plus one per tool call.
export const agentTurns = pgTable(
  "agent_turns",
  {
    traceId: uuid().primaryKey(),
    businessId: uuid().references(() => businesses.id),
    channel: messageSource().notNull(),
    action: text().notNull(),
    attempts: smallint().notNull(),
    ungrounded: jsonb().notNull(),
    inputTokens: integer().notNull(),
    cachedInputTokens: integer().notNull(),
    outputTokens: integer().notNull(),
    durationMs: integer().notNull(),
    outboundMessages: smallint().notNull().default(0),
    // Decision U1: which model and which prompt + tool definitions answered, for eval and trials.
    model: text(),
    promptHash: text(),
    // Set when the turn failed before a reply was decided; the trace id the client got still resolves.
    error: text(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.businessId, table.createdAt)],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    traceId: uuid()
      .notNull()
      .references(() => agentTurns.traceId),
    position: smallint().notNull(),
    toolName: text().notNull(),
    input: jsonb().notNull(),
    output: jsonb(),
  },
  (table) => [index().on(table.traceId)],
);

// modules/conversation (sent by channels/whatsapp): one row per send, keyed so a retried job never
// sends twice (engine-plan A13).
export const outboundStatus = pgEnum("outbound_status", ["pending", "sent", "failed"]);

export const outboundMessages = pgTable("outbound_messages", {
  id: uuid().primaryKey().defaultRandom(),
  // Insert order: rows written in one transaction share created_at, and a reply goes before its card.
  sequence: bigint({ mode: "number" }).generatedAlwaysAsIdentity(),
  idempotencyKey: text().notNull().unique(),
  businessId: uuid().references(() => businesses.id),
  traceId: uuid(),
  kind: text().notNull(),
  payload: jsonb().notNull(),
  status: outboundStatus().notNull().default("pending"),
  wamid: text(),
  error: text(),
  createdAt: createdAt(),
  sentAt: timestamp({ withTimezone: true }),
  // From Meta's status webhooks; a failure after send lands in status/error instead.
  deliveredAt: timestamp({ withTimezone: true }),
  readAt: timestamp({ withTimezone: true }),
});

// modules/schedules (business-features-plan S4)
export const scheduleKind = pgEnum("schedule_kind", ["recap", "reminder"]);
export const scheduleFrequency = pgEnum("schedule_frequency", ["once", "daily", "weekly"]);
export const scheduleStatus = pgEnum("schedule_status", ["active", "cancelled", "done"]);

export const schedules = pgTable(
  "schedules",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    kind: scheduleKind().notNull(),
    frequency: scheduleFrequency().notNull(),
    time: text().notNull(),
    dayOfWeek: text(),
    date: date(),
    recapKind: text(),
    reminderText: text(),
    nextRunAt: timestamp({ withTimezone: true }).notNull(),
    status: scheduleStatus().notNull().default("active"),
    createdAt: createdAt(),
  },
  (table) => [
    index("schedules_due")
      .on(table.nextRunAt)
      .where(sql`${table.status} = 'active'`),
    check("time_format", sql`${table.time} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

// modules/attachments (business-features-plan §4.2)
export const attachments = pgTable(
  "attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    kind: text().notNull(),
    png: bytea().notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index().on(table.expiresAt)],
);

// modules/sheets (business-features-plan S5, columns from the features hand-over)
export const sheetConnectionStatus = pgEnum("sheet_connection_status", ["active", "broken"]);

export const sheetConnections = pgTable(
  "sheet_connections",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    spreadsheetId: text().notNull(),
    sheetTitle: text().notNull(),
    tabId: integer().notNull(),
    tabTitle: text().notNull(),
    columnMap: jsonb(),
    status: sheetConnectionStatus().notNull().default("active"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sheet_connections_one_active")
      .on(table.businessId)
      .where(sql`${table.status} = 'active'`),
  ],
);

// modules/customers and modules/campaigns (business-features-plan S7)
export const customers = pgTable(
  "customers",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id),
    name: text().notNull(),
    email: text().notNull(),
    consentSource: text().notNull(),
    consentedAt: timestamp({ withTimezone: true }),
    optedOutAt: timestamp({ withTimezone: true }),
    unsubscribeToken: text().notNull().unique(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex().on(table.businessId, table.email)],
);

export const campaignStatus = pgEnum("campaign_status", ["draft", "sending", "sent"]);

export const campaigns = pgTable("campaigns", {
  id: uuid().primaryKey().defaultRandom(),
  businessId: uuid()
    .notNull()
    .references(() => businesses.id),
  subject: text().notNull(),
  bodyText: text().notNull(),
  status: campaignStatus().notNull().default("draft"),
  traceId: uuid(),
  createdAt: createdAt(),
});

export const recipientStatus = pgEnum("recipient_status", ["pending", "sent", "failed"]);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    status: recipientStatus().notNull().default("pending"),
    sesMessageId: text(),
    error: text(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.customerId] })],
);
