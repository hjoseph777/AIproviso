# CP1 vs AI Proviso

This document compares Canon CapturePerfect-style AP capture workflows with AI Proviso for invoice intake and extraction.

It is written for the actual target use case discussed in this project:

- most invoices arrive by email
- PDF is the dominant file format
- native digital PDFs are common
- scanned PDFs still exist but are not the majority path

## Executive View

If the dominant intake channel is email with PDF attachments, AI Proviso is the better architectural fit.

Scanner-first capture products are strongest when the document stream is mostly physical paper, scanner-fed batches, and stable vendor templates. AI Proviso is strongest when the document stream is already digital, arrives by email, and must be processed without heavy per-vendor template setup.

The simplest positioning line is:

**CP1 was built for scanners. AI Proviso is built for email-native AP processing.**

## What CP1 Is in AP Terms

CapturePerfect 1 is best understood as a scanner-led capture workflow tool. In AP scenarios it typically:

- acquires invoice images from scanner-driven input
- performs OCR and document capture operations
- outputs files and extracted text to downstream systems
- depends heavily on predefined capture rules or template setup for reliable structured extraction

In an M-Files-style AP deployment, the capture layer handles image acquisition and OCR, while the downstream platform handles classification, routing, and lifecycle control.

Exact OCR internals and benchmark figures for CP1 should be verified against vendor documentation and the customer's deployed configuration. The comparison below focuses on workflow fit and likely operational behavior, not on undocumented internals.

## AI Proviso OCR Approach

AI Proviso follows the OCR architecture locked in [AIproviso/Proviso_PRD_v9.md](AIproviso/Proviso_PRD_v9.md#L307):

- native PDF fast path first via `pdfplumber`
- OCR only when needed
- PaddleOCR plus PP-Structure for scanned documents
- deterministic parsing first
- vendor heuristics second
- narrow `phi4-mini` recovery prompts only for ambiguous fields
- human review when confidence remains below threshold

That means AI Proviso is not trying to OCR every document by default. It is trying to avoid OCR whenever the source document already contains usable text.

## Direct Comparison for AP Invoice Processing

| Capability | CP1 / Scanner-First Capture | AI Proviso | Practical Read |
| :--- | :--- | :--- | :--- |
| Email intake | Usually requires bolt-on workflow or downstream handling | Native intake path via MOD-01 email-driven flow | AI Proviso advantage when invoices arrive by email |
| Native digital PDF handling | Often treated as a captured document, not a fast-path text source | `pdfplumber` fast path skips OCR entirely | AI Proviso advantage |
| Scanned invoice OCR | Strong in scanner-led workflows, especially when tuned for a known setup | PaddleOCR + PP-Structure on demand | Depends on document quality and tuning |
| New vendor day one | Often higher setup burden for reliable field capture | Attempt extraction immediately, then route uncertainty to review | AI Proviso advantage |
| Known vendor repeat extraction | Strong when capture rules or templates are already defined | Strong once vendor profiles and corrections accumulate | Near tie |
| Table and line item extraction | Often depends on configured zones or downstream handling | PP-Structure plus deterministic reconstruction | AI Proviso advantage |
| Date, amount, and ID normalization | Typically rule-driven per deployment | `dateparser`, `babel`, `python-stdnum`, and validation pipeline | AI Proviso advantage |
| Field-level confidence | Often limited or product-specific | Explicit per-field confidence and routing policy | AI Proviso advantage |
| Exception routing | Usually manual queueing or downstream business process logic | Review queue and low-confidence exception queue with reason codes | AI Proviso advantage |
| Correction learning | Limited unless rules are manually maintained | Vendor profile feedback loop improves future extraction | AI Proviso advantage |
| Scanner integration | Mature and hardware-centric | Possible, but not the primary product strength | CP1 advantage |
| Cold start and local footprint | Native desktop-style workflow can feel instant | Containerized stack has startup overhead | CP1 advantage |

## Where CP1 Still Wins

CP1 or comparable scanner-first capture products remain strong when:

- the client processes mostly paper or scanned invoices
- Canon scanner integration is already deployed and trusted
- the vendor list is stable and template investment has already been made
- raw speed on clean, repeated scan layouts matters more than flexibility
- non-technical staff expect a polished scanning console rather than an email-native intake pipeline

In that environment, a mature scanner workflow can feel faster and simpler day to day.

## Where AI Proviso Wins

AI Proviso is stronger when:

- invoices arrive primarily by email as PDFs
- native digital PDFs are common
- new vendors appear regularly
- manual template building is too expensive
- the AP team needs confidence-aware review, not binary extraction success or failure
- extraction must connect directly to workflow, approval, exception handling, and ERP posting

This is the environment AI Proviso is built for.

## Why the Native PDF Path Matters

If most invoices arrive as emailed PDFs, the decisive advantage is not “better OCR.”

It is **not needing OCR for a large share of documents**.

That changes the economics of the pipeline:

- less compute per document
- fewer OCR errors on digitally generated text
- faster average processing time
- lower review burden
- better support for immediate day-one processing without vendor templates

In practical terms, scanner-first capture products solve the wrong primary problem when the dominant intake channel is already digital.

## Setup Cost Comparison

The strongest commercial argument for AI Proviso is reduced setup effort.

Scanner-first capture workflows often become reliable by investing time in rules, zones, or templates for recurring vendors. That can work well, but it pushes consultant effort upstream.

AI Proviso takes the opposite approach:

- attempt extraction immediately
- validate deterministically
- route uncertain fields to review
- learn from confirmed corrections through vendor profiles

That reduces initial deployment friction and shifts improvement into live operational learning rather than heavy pre-configuration.

## Honest Verdict

For greenfield AP deployments with mixed invoice types, heavy email intake, native PDFs, multilingual vendors, and a need to avoid consultant-heavy setup, AI Proviso is the better fit.

For highly stable, scanner-led environments with fixed vendors, mature templates, and an operations team already optimized around scan capture, CP1 can still be the simpler operational choice.

The market direction matters. As invoice intake shifts away from paper scanning and toward emailed PDFs generated by accounting systems, AI Proviso becomes more aligned with the real operational problem.

## Recommended Sales Position

Use this positioning carefully and only when the customer's intake profile supports it:

> Most invoices now arrive by email as PDFs. Legacy capture tools were built for scanners. AI Proviso was built for email-native AP processing.

## Final Position

AI Proviso is not trying to be a better scanner console.

It is trying to be a better AP intake and extraction platform for the modern document mix: email first, PDF first, workflow-aware, confidence-aware, and template-light.