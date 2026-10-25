# Chapter 10: Roadmap & Future Direction (technical part)

> Draft for the paper (English). Owner: Rafee for the technical items. Indy and Nawra own the business and market items of this chapter; merge this text with theirs. Timing after the final is a proposal, not a team decision yet.

Each step below removes one thing that stops an owner from using Thya every day.

## Phase 1: after the final (Nov 2026 – Q1 2027)

- **Production WhatsApp number.** Complete Meta business verification so Thya can message any owner, not only the 5 numbers a test number allows. This is the step from demo to real users.
- **Approved recap templates.** WhatsApp only allows free-form messages within 24 hours of the owner's last message. Daily and weekly recaps sent outside that window must use templates approved by Meta in the utility category, which Meta charges per message. We will register templates for daily recap, weekly recap, and reminders, and budget their cost per active owner.
- **Recording by chat.** Let owners log sales and expenses by typing them ("tadi beli gula 2 kg 36 ribu"). The agent parses the message, asks to confirm, then saves it.
- **Two-way spreadsheet sync.** Keep an owner's existing sheet as the source they already know, with Thya reading and writing it.

## Phase 2: less typing (2027)

- **Voice notes.** Many owners prefer speaking to typing. Thya will transcribe Indonesian voice notes and treat them like text messages. The speech-to-text provider must meet the same bar as the LLM: no data retention by default, and a published policy on where audio is processed.
- **Receipt photos.** Owners can send a photo of a supplier receipt or handwritten note. Thya reads the items and amounts, shows what it understood, and saves them after the owner confirms.
- **Calendar reminders.** Connect Google Calendar for supplier orders, payments, and other routine tasks.

## Phase 3: beyond F&B (2027 onward)

- **More sectors.** Start with retail and services. Each sector gets its own data template (for retail: stock per item and reorder points; for services: bookings and staff time) and its own tool set. The agent loop, channel, and database stay the same, so adding a sector means adding tools and sample data, not rebuilding the system.
- **Dashboard (optional).** A simple web view for owners who want to see charts or share numbers with a partner. WhatsApp remains the main channel. *(Open decision: the team has not agreed whether the dashboard belongs here or is dropped.)*

## Technical foundations that carry across phases

- Every provider sits behind one module (LLM, speech-to-text, messaging), so we can switch vendors if price, quality, or data rules change.
- Every number in an answer comes from a tool, never from the model's guess. New features add tools; they do not loosen this rule.
- If an approval step becomes necessary (for example, "confirm before sending a purchase order to a supplier"), we will evaluate a graph-based agent framework at that point.

<!--
Open items before export (remove this comment from the paper):
- Quote Meta's template message price only from Meta's official pricing page, with the date read.
- Phase dates are Rafee's proposal; Indy should align them with the business model and funding plan.
-->
