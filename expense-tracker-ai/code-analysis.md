# Data Export Implementations: Technical Analysis

## Scope and method

This document compares the three export branches against their common ancestor, `master` at commit `d2335a1`. Each branch was checked out and its complete branch diff, modified files, added files, component structure, state flow, browser APIs, and failure paths were inspected.

One baseline detail materially affects the comparison: `master` already contains a small `exportCsv` function that exports the currently filtered dashboard rows. The three branches are therefore alternative replacements or revisions of an existing export action, not additions to a baseline with literally no export code.

All three branches use the same application stack:

- Next.js 14.2.31 and React 18.3.1
- TypeScript 5.6
- Tailwind CSS 3.4
- Browser-local expense storage via `localStorage`
- No export-specific third-party dependency

## Executive comparison

| Dimension | Version 1 | Version 2 | Version 3 |
|---|---|---|---|
| Primary goal | Immediate CSV download | Configurable local export | Cloud/collaboration concept |
| Actual data export | CSV | CSV, JSON, PDF | None; integrations are simulated |
| Files changed/added | 1 modified | 1 modified, 2 added | 1 modified, 1 added |
| Architectural separation | Low | Good | Moderate at dashboard boundary, low internally |
| UI complexity | Very low | Medium/high | High |
| Data filtering | None; all expenses | Date range and categories | None |
| Persistence | Existing expense storage only | Existing expense storage only | History and schedule in `localStorage` |
| Error handling | Minimal | Minimal | Partial read recovery; simulated writes are fragile |
| Security posture | Local-only, CSV injection risk | Local-only, CSV injection and JSON over-export risks | Security is mostly visual language, not implemented controls |
| Best use | Small personal tracker | Strongest foundation for production export | Product prototype for future cloud roadmap |

## Version 1: `feature-data-export-v1`

Commit: `606972e` (`Add CSV data export`)

### Files created or modified

- Modified: `components/expense-tracker.tsx`
- Created: none
- Diff relative to `master`: 6 insertions, 4 deletions

### Architecture overview

Version 1 keeps export logic directly inside the existing `ExpenseTracker` client component. The dashboard owns the expense state, constructs the CSV, creates the browser download, and reports success through the existing toast system.

There is no export domain module, serializer abstraction, hook, service, or dedicated component. This is deliberately a vertical, inline implementation optimized for minimum code and minimum surface area.

### Key components and responsibilities

- `ExpenseTracker`
  - Owns the full `expenses` array.
  - Renders the **Export Data** button.
  - Implements `exportCsv()`.
  - Escapes CSV values.
  - Creates and clicks a temporary object-URL-backed anchor.
  - Displays the existing `CSV exported` toast.

No new components are introduced.

### Libraries and dependencies

No new libraries are used. File creation relies on standard browser APIs:

- `Blob`
- `URL.createObjectURL()` / `URL.revokeObjectURL()`
- `document.createElement("a")`
- The anchor `download` attribute

### Technical deep dive

#### Export mechanics

`exportCsv()` builds an array whose first element is the exact header `Date,Category,Amount,Description`. Each expense becomes one comma-separated row. Date, category, and description are quoted; amount is emitted using `toFixed(2)`. Rows use CRLF (`\r\n`), which is appropriate for broad spreadsheet compatibility.

All expenses are exported from the source `expenses` state. Dashboard search, category, and date filters do not affect the export.

The complete CSV string is wrapped in a UTF-8 `Blob`, exposed through an object URL, and downloaded as `pennywise-expenses-YYYY-MM-DD.csv`.

#### User interaction

The flow is one click with no configuration or confirmation. The button is colocated with the recent-expenses heading. A toast is displayed immediately after `link.click()`.

#### State management

No export-specific state exists. The function closes over the dashboard's `expenses` state and calls the existing `showToast` helper.

### Implementation patterns

- Inline event-handler/domain logic
- Synchronous in-memory serialization
- Native browser download
- Existing parent-component feedback mechanism
- Full-dataset export independent of dashboard filters

### Code complexity assessment

Cyclomatic and conceptual complexity are very low. The implementation adds one helper closure and one button binding. It is easy to understand in isolation.

The cost of this simplicity is coupling: serialization, browser I/O, naming policy, and UI feedback all live in an already large dashboard component. Unit testing `exportCsv()` independently would require component/browser setup or refactoring.

### Error handling and edge cases

Handled:

- Embedded double quotes are doubled according to CSV rules.
- Commas and newlines are safe because string fields are quoted.
- Amounts consistently use two decimal places.
- An empty expense list still downloads a valid header-only CSV.

Not handled:

- `Blob`, object URL, or synthetic click failures.
- A browser that does not honor the `download` attribute.
- Success is announced before the application can know whether a download completed.
- Object URL revocation is immediate; generally accepted after a synchronous click, but delayed cleanup is safer across browser implementations.
- No UTF-8 BOM is added, so some older spreadsheet applications may mis-detect non-ASCII text.
- No explicit ordering is applied; exported order is whatever the source state currently uses.
- No protection against spreadsheet formula injection.

### Security considerations

The export stays entirely on the user's device and does not introduce network or credential exposure.

The principal issue is CSV injection. Quoting a field is valid CSV escaping, but spreadsheet programs may still interpret a description beginning with `=`, `+`, `-`, or `@` as a formula. Because descriptions are user-controlled, a production CSV exporter should neutralize formula-leading values according to the product's compatibility policy.

The downloaded file naturally contains the complete expense dataset. There is no warning, redaction, or selective export.

### Performance implications

- Time complexity: O(n) over expenses.
- Memory complexity: O(n) for row strings, joined CSV, and Blob storage.
- UI work is synchronous; a very large dataset could briefly block the main thread.
- For a personal tracker with hundreds or low thousands of rows, this is unlikely to matter.

### Extensibility and maintainability

Strengths:

- Smallest regression surface.
- No dependency maintenance.
- Straightforward to debug.

Constraints:

- Adding formats would create conditional logic in `ExpenseTracker`.
- Filtering, progress, tests, and reusable export policies have no natural home.
- CSV concerns are not reusable elsewhere.
- The dashboard component remains responsible for too many domains.

Version 1 is appropriate when CSV is the stable final requirement and dataset size is small. It is not a strong base for a larger export subsystem.

## Version 2: `feature-data-export-v2`

Commit: `d783e10` (`Add advanced multi-format data export`)

### Files created or modified

- Modified: `components/expense-tracker.tsx`
- Created: `components/export-dialog.tsx`
- Created: `lib/export-data.ts`
- Diff relative to `master`: 177 insertions, 7 deletions

### Architecture overview

Version 2 introduces three layers:

1. `ExpenseTracker` remains the source of expense data and owns only the dialog-open state.
2. `ExportDialog` owns export configuration, derives the preview dataset, and coordinates user interaction.
3. `lib/export-data.ts` owns serialization, filename sanitation, Blob construction, and browser download behavior.

This is the clearest separation of concerns among the three versions. `buildExportFile()` is especially useful because it returns `{ blob, filename }` without triggering browser I/O, making serializer output directly testable.

### Key components and responsibilities

- `ExpenseTracker`
  - Adds `exportOpen` state.
  - Opens the dedicated export dialog.
  - Passes expenses, category definitions, close callback, and toast callback.

- `ExportDialog`
  - Selects CSV, JSON, or PDF.
  - Selects start and end dates.
  - Maintains a `Set` of selected categories.
  - Accepts a custom filename.
  - Derives sorted, filtered preview data with `useMemo`.
  - Shows up to 12 preview records and the total export count.
  - Owns the loading state and invokes the export service.

- `lib/export-data.ts`
  - Defines `ExportFormat` and `ExportableExpense`.
  - Serializes CSV.
  - Serializes JSON.
  - Constructs a PDF 1.4 document manually.
  - Sanitizes filenames and normalizes extensions.
  - Builds Blobs separately from initiating downloads.

### Libraries and dependencies

No export-specific dependency is added. The implementation uses React state/memoization plus browser primitives.

The PDF is generated manually rather than with a library such as pdf-lib, jsPDF, or a server-side renderer. This avoids bundle and licensing overhead but transfers PDF correctness, layout, encoding, pagination, and testing responsibility to application code.

### Technical deep dive

#### Filtering and preview

The dialog filters expenses with ISO-style `YYYY-MM-DD` string comparisons. Given the application's normalized date format, lexicographic comparison is valid. An empty start or end date acts as an open boundary. Category membership is tested through a `Set`.

The filtered array is sorted descending by date. The preview table renders the first 12 entries while the footer reports the complete filtered count. Export uses the entire filtered array, not only previewed rows.

#### CSV generation

The serializer emits `Date,Category,Amount,Description`, quotes every cell, doubles embedded quotes, formats amount to two decimals, and uses CRLF rows. This is structurally stronger than selectively quoting only string fields.

#### JSON generation

JSON uses `JSON.stringify(expenses, null, 2)`.

There is a subtle but important type/runtime mismatch: `Expense[]` is structurally assignable to `ExportableExpense[]`, but passing it does not remove extra properties. The filtered preview retains each original object's `id` and `createdAt`. Consequently, JSON exports those internal fields even though `ExportableExpense` declares only date, category, amount, and description. CSV and PDF explicitly select fields and do not have this leak.

The fix is to map records to an explicit export DTO before serialization.

#### PDF generation

The PDF builder creates:

- A catalog and pages tree.
- One built-in Helvetica font object.
- Page/content-stream pairs.
- A cross-reference table and trailer.
- Pagination at 34 rows per page.

Text is normalized with NFKD, non-ASCII characters are removed, and PDF control characters are escaped. Descriptions are truncated to 48 characters and categories to 18. The document uses a landscape 792×612 point media box.

This produces a small, dependency-free PDF but has limitations:

- International characters are silently lost rather than embedded with a Unicode font.
- Helvetica is proportional, so space-padding does not create reliable table-column alignment.
- Long values are truncated without user indication.
- There is no wrapping, totals section, branding abstraction, metadata, accessibility tagging, or locale/currency selection.
- The serializer repeatedly encodes the accumulated PDF when computing offsets. With many pages this adds avoidable cumulative work.

#### Download flow

`buildExportFile()` sanitizes Windows-invalid/control filename characters, strips a recognized existing extension, selects the serializer, and returns a Blob and normalized filename. `exportExpenses()` creates an object URL and clicks an anchor.

The dialog waits for two animation frames before generation so React can paint the loading state. This is a visual scheduling technique, not real background processing; serialization still executes synchronously on the main thread.

### State management patterns

- Parent-owned open/close state.
- Dialog-local `useState` for configuration.
- Derived preview state through `useMemo`, avoiding redundant stored data.
- Immutable `Set` replacement for category changes, ensuring React detects updates.
- Callback props for toast reporting and closure.

This is idiomatic local React state for the current scope. A reducer would become useful if more options, validation states, or asynchronous destinations were added.

### User interface implementation

The responsive modal has:

- Format option cards.
- Date controls with reciprocal `min`/`max` constraints.
- Multi-category selection and select-all/clear-all behavior.
- Custom filename input with live extension display.
- Sticky-style preview table header.
- Empty-result messaging.
- Record summary and disabled export states.
- Loading spinner and changing export button label.
- Mobile bottom-sheet styling and desktop centered-dialog styling.

Accessibility basics include `role="dialog"`, `aria-modal`, an associated title, and close-button labeling. Missing pieces include focus trapping, initial focus management, focus restoration, and Escape-key handling.

### Code complexity assessment

Complexity is moderate and proportionate to the feature set. The domain boundary is good, but both new files contain dense one-line JSX and compact statements that reduce reviewability.

The PDF builder is the highest-risk algorithmic code. It is concise but implements a non-trivial file format that normally benefits from a mature library and focused automated tests.

### Error handling and edge cases

Handled:

- Empty results disable export and show guidance.
- Empty filenames disable export.
- Invalid filename characters are replaced.
- Existing `.csv`, `.json`, or `.pdf` extensions are normalized.
- Start/end date controls constrain contradictory selections.
- Category selection can be empty.
- PDF paginates and can represent an empty dataset internally.
- Export cannot be triggered twice while loading.

Not handled:

- No `try/catch/finally` around file generation or browser download.
- An exception leaves `exporting` true and the dialog effectively locked.
- No user-visible error state.
- Immediate object URL revocation has the same cross-browser concern as Version 1.
- CSV formula injection is not neutralized.
- JSON unintentionally includes internal fields.
- Very large files are fully buffered and generated on the main thread.
- The apparent loading state does not measure progress.
- Date/time formatting inside the PDF depends on the current locale, reducing deterministic output.

### Security considerations

All output remains local, so there are no service tokens, uploads, or server authorization concerns.

Risks:

- CSV formula injection from user-controlled descriptions.
- JSON data minimization failure (`id` and `createdAt` are included at runtime).
- Custom filenames are sanitized for common filesystem-invalid characters, which is a positive control.
- PDF text is escaped for parentheses and backslashes, reducing malformed-content-stream risk.
- No size limits protect against client-side memory exhaustion.

### Performance implications

- Filtering and sorting: O(n log n), recomputed only when relevant dependencies change.
- CSV/JSON generation: O(n) time and memory.
- PDF: O(n) records plus additional repeated-encoding overhead as page count grows.
- Preview DOM is capped at 12 rows, which is efficient.
- All generation remains on the main thread.

For normal personal-expense datasets, performance is acceptable. For tens of thousands of rows, a Web Worker, streaming CSV path, or server job would be preferable.

### Extensibility and maintainability

Strengths:

- Serializer/UI separation.
- Explicit format union.
- Testable Blob builder.
- Format selection has a natural extension point.
- Filtering is centralized in the dialog.
- The dashboard is minimally changed.

Constraints:

- Serializer selection is an `if/else` chain rather than a format registry/strategy map.
- Export DTO mapping is missing.
- PDF layout is hard-coded.
- Dialog props and export types are separate from the application's `Expense` type; a deliberate mapping boundary would make this an advantage rather than a structural-typing accident.
- No automated tests are committed.

Version 2 is the strongest technical base for a production local-export feature after addressing data minimization, error handling, CSV injection, accessibility, and PDF strategy.

## Version 3: `feature-data-export-v3`

Commit: `daad3b6` (`Add cloud-integrated export workspace`)

### Files created or modified

- Modified: `components/expense-tracker.tsx`
- Created: `components/cloud-export-hub.tsx`
- Diff relative to `master`: 145 insertions, 7 deletions
- `cloud-export-hub.tsx`: approximately 23.8 KB across 141 physical lines, reflecting very dense JSX

### Architecture overview

Version 3 removes the baseline CSV action and opens a full-screen `CloudExportHub`. The dashboard boundary is clean: the parent passes expenses and close/toast callbacks. Inside the hub, however, product UI, service simulation, persistence, validation, history construction, scheduling, share-link generation, and QR-like rendering all live in one module.

This is best characterized as a high-fidelity front-end concept prototype. It does not generate an export file, send email, create a remotely accessible report, authenticate with a provider, schedule a background job, encrypt data, or communicate with a cloud service.

### Key components and responsibilities

- `ExpenseTracker`
  - Owns `cloudOpen`.
  - Opens the full-screen cloud workspace.
  - Supplies expenses and existing toast behavior.

- `CloudExportHub`
  - Owns the active workspace view.
  - Owns template, email, message, busy, integration, sharing, history, and schedule state.
  - Loads history and schedule settings from `localStorage`.
  - Simulates asynchronous operations using an 850 ms timeout.
  - Creates history records.
  - Renders the workspace shell and dispatches subviews.

- `DeliverView`
  - Simulated email form.
  - Simulated share-link generation and clipboard copy.
  - Displays a QR-like visual.

- `IntegrationsView`
  - Displays Google Sheets, Dropbox, OneDrive, and Slack cards.
  - Simulates connect/disconnect and sync states.

- `AutomateView`
  - Configures frequency, destination, time, and fixed timezone.
  - Persists a schedule configuration locally.

- `ActivityView`
  - Displays up to 12 locally stored activity records.
  - Clears export history.

- Presentational helpers
  - `NavButton`, `PageHeading`, `Card`, `CardTitle`, `Spinner`, `SelectField`, `SummaryLine`, and `QrCode`.

### Libraries and dependencies

No cloud SDK, email provider, OAuth library, scheduler, QR library, data-export library, or API route is used.

The implementation relies on:

- React hooks.
- `localStorage`.
- `crypto.randomUUID()`.
- `navigator.clipboard` when available.
- `setTimeout()` for simulated latency.
- Tailwind utility classes.

### Technical deep dive

#### Email flow

The email address is checked with a simple `/^\S+@\S+\.\S+$/` regex. Clicking send invokes `simulate()`, waits 850 ms, records an `Email delivered` history entry, and displays a success toast. No report payload is created and no email is sent.

The message field is UI-only: its value is never included in history, persisted, or sent anywhere.

#### Share links and QR visual

The share link is a string shaped like `https://share.pennywise.app/r/{8-character UUID prefix}`. There is no route, backend record, access control, expiration record, or hosted report behind it.

The `QrCode` component creates a 15×15 deterministic black/white grid from a custom hash and draws finder-like corner patterns. It does not implement the QR standard, data encoding, error correction, masking, or format information. It should therefore be treated as a decorative mockup and is not expected to scan, despite the UI text saying “Scan to open.” A real implementation must use a standards-compliant QR encoder.

Clipboard writing is optional-chained, but success/failure is neither awaited nor reported.

#### Integration flow

Google Sheets starts visually connected on every component mount. Connecting another provider waits 850 ms and updates in-memory state. Syncing creates a history entry. Disconnecting is immediate and does not create history.

There is no OAuth redirect, provider token, token storage, refresh flow, permission scope, remote folder/sheet selection, API request, retry, webhook, conflict handling, or revocation.

Connected-service state is not persisted, so it resets when the workspace closes.

#### Scheduling

The chosen frequency, time, and destination are saved to `localStorage`, and a scheduled history entry is created. No timer, service worker, server job, queue, or background process reads the configuration. Closing the browser therefore eliminates any possibility of execution.

The timezone is hard-coded to `Africa/Johannesburg`. The UI does not calculate or display an actual next-run timestamp.

#### Templates

Tax Report, Monthly Summary, and Category Analysis change selected styling and descriptive text. The selection influences history labels and some UI copy, but no template transforms, aggregates, filters, columns, or report layouts are implemented.

#### History

History is stored as JSON under `pennywise-cloud-export-history-v1`, capped at 12 records, and loaded on mount. Timestamps are ISO strings rendered with `Intl.DateTimeFormat`.

History is a local UI activity feed, not an immutable audit log. Users can edit browser storage, clear it, or lose it. It has no user identity, remote job ID, request parameters, result URL, checksum, or failure record.

### State management patterns

- Parent-owned open state.
- Numerous local `useState` values in the hub.
- `useMemo` for total amount and QR-like cell generation.
- Effect-based local persistence hydration.
- A string-valued global `busy` state to identify the simulated operation.
- Callback functions passed to view components.

The global busy token prevents many overlapping interactions and simplifies loading indicators. However, the subview props are typed as `any`, discarding much of TypeScript's value at the most interaction-heavy boundaries.

As functionality grows, this state model should become a reducer or state machine, and service operations should move behind typed adapters.

### User interface implementation

Version 3 has the richest visual/product design:

- Full-screen cloud workspace with responsive desktop/mobile navigation.
- System-status, demo-workspace, connection, and sync indicators.
- Template cards.
- Email and secure-link panels.
- Integration destination cards.
- Automation configuration and next-run summary.
- Activity history with completion/scheduled states.
- Loading spinners and disabled controls.
- Escape-to-close and body-scroll locking.

The UI clearly labels the workspace as a demo and explicitly calls integrations simulated in one explanatory paragraph. However, claims such as “Secure,” “7-day access,” “Encrypted,” “All systems operational,” “Live,” and “Expires automatically” are not backed by implementation. A prototype should consistently label those states as illustrative to avoid false assurance.

Accessibility includes dialog semantics, a labeled close control, Escape handling, and native form controls. Missing elements include focus trapping, focus restoration, navigation semantics for tab-like controls, live announcements for view changes, and comprehensive labels/status descriptions.

### Code complexity assessment

Product-state complexity is high. The component file combines four workflows and several infrastructure concepts in dense JSX. Although helper view components exist, their props use `any`, and most workflow logic remains captured in the parent closure.

The code is compact in line count but not simple: very long physical lines increase merge-conflict risk, make review harder, and hide individual control-flow paths.

### Error handling and edge cases

Handled:

- Corrupt/unavailable `localStorage` reads fall back to defaults through a broad `try/catch`.
- Invalid email disables sending and is checked again in the handler.
- Busy operations disable closing and many conflicting actions.
- History is capped at 12 records.
- The clipboard API is feature-detected through optional chaining.
- Escape closes the workspace only while idle.

Not handled:

- `localStorage` writes can throw due to privacy settings or quota.
- `simulate()` has no `try/finally`; any task exception leaves `busy` set indefinitely.
- Saved schedule JSON is not schema-validated; valid JSON with missing or wrong properties can inject invalid state.
- Clipboard rejection is ignored and no copy confirmation is shown.
- Timeout work is not cancelled on unmount.
- History updates use the closed-over `history` array rather than a functional state update, which is vulnerable to lost updates if operations become concurrent.
- Email validation is intentionally shallow.
- There are no failed-history states, retries, cancellation, or offline states despite the cloud framing.
- The share URL and QR-like image are non-functional.

### Security considerations

Because no network communication occurs, Version 3 currently exposes no OAuth tokens or real remote data. That also means its displayed security properties do not exist.

A production version would need, at minimum:

- Server-side authentication and per-user authorization.
- OAuth 2.0/OIDC with least-privilege provider scopes.
- Encrypted token storage, refresh, rotation, and revocation.
- Server-generated high-entropy share tokens stored as hashes.
- Expiration and revocation enforced server-side.
- Access logging and rate limiting.
- Data minimization and explicit template schemas.
- CSRF/state validation for provider callbacks.
- SSRF-safe provider interactions and strict redirect allowlists.
- Auditable background-job ownership and tenant isolation.
- Standards-compliant QR encoding of the real authorized URL.

The eight-character UUID prefix used in the mock URL would be insufficient as the sole authorization secret for a sensitive public share link. Truncating UUID entropy and exposing the token in the URL also requires careful threat modeling.

Local history contains recipient email addresses in plaintext browser storage. On a shared device, another user with browser/profile access could read them.

### Performance implications

Current data processing is light:

- Expense totals are O(n) and memoized.
- History is capped at 12.
- The QR-like visual renders 225 spans each time a link is created.
- Full-screen subviews are conditionally rendered, limiting inactive-view DOM.

The 225-element decorative QR grid is heavier than using a single SVG/canvas generated by a QR library but still small in absolute terms.

Real cloud behavior would move expensive export generation and provider I/O to background workers. The front end should poll or subscribe to job status rather than simulate work with timers.

### Extensibility and maintainability

Strengths:

- Clean dashboard-to-workspace boundary.
- Services and templates are data-driven arrays.
- Distinct subviews create an initial product-information architecture.
- Local history/schedule persistence supports realistic prototyping.
- A single busy token provides a starting operation model.

Constraints:

- No service interface or adapter layer.
- No export/report-generation layer to feed destinations.
- No API contract or job model.
- Extensive `any` weakens refactoring safety.
- Template definitions are labels rather than behavior.
- Integration state, business state, and rendering are tightly coupled.
- Dense JSX reduces reviewability.
- No tests are committed.

Version 3 should be mined for UX concepts, not promoted as a cloud-export implementation without a substantial backend and architecture redesign.

## Cross-version technical findings

### File generation approaches

- Version 1: direct CSV string → Blob → object URL → anchor click.
- Version 2: format-specific in-memory serializers → testable Blob builder → object URL → anchor click.
- Version 3: no file or report artifact is generated.

### User interaction approaches

- Version 1: immediate command with toast feedback.
- Version 2: modal configuration workflow with live preview and loading state.
- Version 3: full-screen destination/collaboration workspace with simulated asynchronous service flows.

### State approaches

- Version 1: no export state; closes over parent expense state.
- Version 2: parent boolean plus dialog-local configuration and memoized derived data.
- Version 3: parent boolean plus a large hub state model, effect hydration, and local persistence.

### Error-handling maturity

None of the versions has production-grade operational error handling.

- Version 1 has no failure branch.
- Version 2 models loading but not errors and can become stuck after an exception.
- Version 3 catches storage reads but not writes or simulated task failures; it cannot model provider failures because no providers exist.

### Testing posture

No branch commits automated tests. Version 2 has the most testable seam through `buildExportFile()`. Versions 1 and 3 require more refactoring for focused unit tests.

Recommended test layers:

1. Serializer unit tests: headers, escaping, Unicode, formulas, empty data, large data, and explicit DTO shape.
2. Filter unit tests: inclusive date boundaries, no categories, and ordering.
3. Component tests: disabled states, preview count, focus behavior, and error recovery.
4. Browser tests: actual download filename/MIME/content.
5. Cloud contract tests: job creation, authorization, expiry, provider adapter errors, retries, and idempotency.
6. Security tests: CSV injection, share-token authorization, tenant isolation, and OAuth callback validation.

## Recommended adoption strategy

### Recommended foundation

Use Version 2 as the engineering foundation because it is the only implementation that combines real multi-format output with a meaningful separation between UI and file generation.

Before production adoption:

1. Introduce an explicit `toExportExpense(expense)` mapper so every format receives the same allowlisted schema.
2. Neutralize CSV formula-leading values or provide a clearly documented raw-data policy.
3. Wrap generation/download in `try/catch/finally` and present actionable errors.
4. Add focus trapping, Escape handling, and focus restoration.
5. Replace or rigorously test the handwritten PDF builder; use a Unicode-capable solution if international data matters.
6. Move large exports to a Web Worker or server job.
7. Add serializer and browser-download tests.

### Features worth combining

- Retain Version 1's one-click action as a **Quick CSV** shortcut for repeat users.
- Use Version 2's dialog, filtering, preview, filename controls, and serializer boundary for local exports.
- Reuse Version 3's destination-oriented navigation, templates, scheduling concepts, and activity presentation only after introducing real backend contracts.

### Target architecture for a combined system

```text
Dashboard
  ├─ Quick CSV command
  └─ Export workspace
       ├─ Export configuration reducer/state machine
       ├─ Explicit ExpenseExportRecord mapper
       ├─ Template registry
       ├─ Local format strategies (CSV / JSON / PDF)
       ├─ Destination adapters (download / email / Sheets / storage)
       └─ Export job API
            ├─ Authenticated background queue
            ├─ Encrypted provider credentials
            ├─ Retry/idempotency policy
            ├─ Share-link authorization and expiry
            └─ Durable audit history
```

This preserves the strongest user-facing idea from each branch while avoiding a single component that conflates report definition, serialization, cloud transport, scheduling, and presentation.

## Final assessment

- Version 1 is the best solution for the original narrow requirement: it is small, understandable, dependency-free, and functional.
- Version 2 is the best implementation to evolve: it provides real value, the strongest separation of concerns, and a testable file-generation seam, but needs several correctness and hardening fixes.
- Version 3 is the strongest product-design exploration and the weakest actual export implementation. It usefully demonstrates future workflows, but all connectivity, security, sharing, QR, scheduling, and background-processing behavior is simulated.

For a production decision, adopt Version 2's architecture, preserve Version 1 as an optional fast path, and treat Version 3 as a UX specification for a later server-backed phase.
