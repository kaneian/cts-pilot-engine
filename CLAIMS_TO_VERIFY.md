# Claims to verify

This demo contains only mock data. The placeholder CTS references are embedded in `src/lib/knowledge.ts`, and none is approved, so the app treats every claim below as unverified. Each one needs an approved, dated Cosmos reference before it is used with a customer.

| # | Claim or term | Where it appears | Who confirms | Reference to fill in |
|---|---|---|---|---|
| 1 | CTS consists of a Tokenization Engine, a Permissioned Cosmos Ledger and IBC | Demo knowledge pack; `knowledge/cts-capabilities.md` heading | Product | `cts-capabilities.md` |
| 2 | Which capabilities are supported today and which are roadmap | Every "capability" finding | Product + Engineering | `cts-capabilities.md` |
| 3 | Support for extended-hours intra-bank (entity-to-entity) transfers | Northstar phase-one scope | Engineering | `cts-capabilities.md` |
| 4 | Support for cross-institution 24/7 settlement, including finality | Northstar scope disagreement | Engineering | `cts-capabilities.md` |
| 5 | Custody model and compliance requirements for cross-institution transfers | Northstar blocker "No technical review…" | Engineering + Legal | `cts-capabilities.md` |
| 6 | Support for programmable / conditional release rules (escrow) | Lakeshore finding "Programmable-trigger capability is unverified" | Product | `cts-capabilities.md` |
| 7 | Whether a simulated-deposit pilot can run without core integration | Lakeshore blocker "Integration dependencies not validated" | Engineering | `integrations.md` |
| 8 | CTS is listed in the Fiserv AppMarket and the Jack Henry marketplace | Pipeline Intake "Core provider" factor text | Partnerships | `integrations.md` |
| 9 | Depth and scope of the Fiserv and Jack Henry integrations | Pipeline Intake; any integration finding | Engineering | `integrations.md` |
| 10 | Positioning of CTS/IBC as a complementary interoperability layer | `integrations.md` | Commercial | `integrations.md` |
| 11 | CTS pricing, pilot fees | Every `COMMERCIAL_TERMS` field; brief "Commercial terms" | Commercial (Eran) | `commercial-offers.md` |
| 12 | Any free-pilot or promotional offer, and its expiry | Not stated anywhere in the app | Commercial (Eran) | `commercial-offers.md`, with `APPROVED_FOR_OUTREACH` |
| 13 | The pilot MOU / LOI template | Pilot Package → MOU | Legal | Upload in the app; Legal role approves |
| 14 | Provider legal entity name, governing law, signatories, pilot term | MOU `[TO CONFIRM]` fields | Legal | Confirm per opportunity in the app |

The Pipeline Intake scoring weights (30 / 20 / 15 / 20 / 15) are a starting assumption, not a validated qualification model. Commercial should review them.
