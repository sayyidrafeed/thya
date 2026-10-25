# Chapter 7: Current Status & Development Plan

> Draft for the paper (English). Owner: Rafee. Written on 25 October 2026 while the prototype is still being built. Recheck every "working" claim against the deployed demo before export.

## Current status: Prototype

Thya is at the **Prototype** stage. The core loop works end to end on sample data: an owner types a question in Indonesian, the AI agent picks a calculation, runs it, and answers in a short WhatsApp-style message.

What runs today:

- **Web demo at thya.veterantech.id.** A WhatsApp-style chat page on our .id domain. It calls the real agent, not scripted replies. *(Confirm the URL is live before export.)*
- **AI agent with four tools.** `queryMetric` (one metric per call: revenue, cost of goods sold, gross profit, gross margin, or items sold, with the change against the previous period and a plain-language explanation that uses the owner's own numbers), `explainConcept` (explains terms such as HPP or gross margin with the owner's numbers), `getTopMenuItems` (best and worst sellers by revenue, quantity, or profit), and `getDailySales` (daily trend up to 31 days). The agent runs on DeepSeek V4.1 Flash through NetraRuntime, which has zero data retention by default and primary GPU infrastructure in Indonesia.
- **Sample business.** Kopi Senja, a coffee shop in Yogyakarta with 11 menu items and generated sales history. No real customer data is used.
- **Automated tests.** Unit tests cover the sales calculations and the tool logic (31 tests passing on 25 October 2026).

What does not run yet:

- WhatsApp channel. The demo uses the web page instead.
- Database. Sample data lives in memory; nothing the owner says is stored.
- Scheduled recaps, spreadsheet import, and recording transactions by chat.
- Net profit. Operating costs are not recorded, so Thya says net profit is not available yet instead of giving a number.
- Setting up cost per menu item (HPP) through chat. The sample data already includes it.
- Storing which concepts an owner has already seen. The web demo rebuilds this from the chat history on each request.
- Testing with real F&B owners. *(Nawra: replace this line if any interviews or trials have happened.)*

## Development plan to the final (10 November 2026)

The goal for the final is a live demo on a real WhatsApp chat: the owner asks about sales, gets an answer, and receives an automatic daily recap.

| Dates | Work | Done when |
|---|---|---|
| 26 Oct – 1 Nov | Store data in PostgreSQL (Drizzle ORM): businesses, users, message history, transactions. Move the sample data into the database. Deploy API and database to the VPS with HTTPS. | The demo answers from the database and keeps conversation history between sessions |
| 26 Oct – 1 Nov | Connect a WhatsApp Cloud API test number: receive messages by webhook, reply through the send API. | A message sent from a registered phone gets an answer from the agent |
| 2 – 6 Nov | Scheduled recaps: `createSchedule` tool, worker with pg-boss, daily recap text. Submit a utility template message to Meta for recaps sent outside the 24-hour window. | "Tiap hari buatin rekapan ya" produces a recap at the requested time |
| 2 – 6 Nov | Spreadsheet import: read an owner's sales sheet into the transactions table. | A sample sheet loads and the agent answers questions about it |
| 7 – 9 Nov | Trial with F&B owners, fix issues found, prepare the demo script and backup recording. | *(Needs input from Nawra and Indy: number of owners and how they are recruited)* |
| 10 – 11 Nov | Final presentation and live demo. | |

Limits we accept for the final:

- A WhatsApp test number can message at most 5 registered phone numbers. This is enough for the live demo and trial users. A production number needs Meta business verification and is part of the Roadmap.
- Recording transactions by chat, voice notes, and receipt photos stay on the Roadmap.

<!--
Open items before export (remove this comment from the paper):
- Finalist announcement date is not published yet. If it lands after 1 Nov, the plan above still holds; adjust only the trial row.
- If the spreadsheet import slips, drop that row rather than claiming it.
-->
