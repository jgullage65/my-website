# Deterministic Specialist Architecture

The deterministic business brain is organized as a small research team operating on one shared evidence substrate.

Flow:

1. Crawl and normalize source evidence.
2. Route each source block into an evidence lane.
3. Extract candidate facts using the existing deterministic extractor.
4. Assign each candidate fact to exactly one knowledge owner.
5. Owners may accept facts only from evidence lanes allowed by their contract.
6. Downstream intelligence, brief writing, and auditing consume accepted owner facts; they do not silently reclassify another owner's facts.

Primary owners:

- Business & Identity: identity, company overview, contact, location, certification, partnership.
- Commercial: product, service, pricing, capabilities, integrations, technical commercial capabilities.
- Market & Customer: customers, industries, use cases, positioning language.
- Proof & Authority: differentiators, customer proof, case-study evidence.
- Operations & Context: FAQ, policy, compliance, onboarding/support context.

Authority rule:

A source block may mention concepts owned by another domain, but mention alone does not grant authority. For example, a refund policy that says "services" remains operations/policy evidence and cannot create a Commercial service fact.

The router and ownership gates are deliberately additive to the existing crawler, source substrate, extraction, provenance, deduplication, and API flow. They are not a replacement crawler or a rewrite of the deterministic engine.
