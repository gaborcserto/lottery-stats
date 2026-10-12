---
name: frontend-code-quality
description: Review React and TypeScript frontend code for correctness, maintainability, accessibility, and unnecessary complexity. Use for read-only code quality audits or targeted refactoring of identified findings.
---

# Frontend code quality

## Invocation and scope

Invoke `$frontend-code-quality` with the frontend path, review scope (whole application, feature, or diff), and mode. Default to a **read-only audit**. Refactor only when requested, limited to the selected findings; an audit does not authorize fixes.

Example: "Use $frontend-code-quality for a read-only audit of the frontend. Report prioritized findings and a targeted refactoring plan; do not edit files."

Agents without skill discovery can read this file directly and follow the same workflow. The skill folder is portable: it has no repository-specific paths, tools, or dependencies.

Follow applicable repository instructions and documented product requirements. Resolve local layout, naming, styling, and verification conventions there instead of imposing this project's conventions on another project. Review implemented behavior, not features reserved for later phases.

## Review workflow

1. Establish scope and current changes. Read applicable agent guidance, setup documentation, package scripts, TypeScript/lint configuration, and relevant runtime assumptions (routing, client rendering, SSR or prerendering).
2. Map components, state owners, API boundaries, shared code, styles, and tests. Trace representative user flows through callers and consumers; a suspicious snippet alone is insufficient evidence.
3. Apply the checklist below where relevant. For each candidate finding, establish the trigger, consequence, and smallest useful correction. Inspect nearby tests and exceptions before reporting it.
4. Use existing non-mutating checks or runtime inspection when they resolve uncertainty. Check scripts for generated output or other side effects first; do not run formatters or automatic fixes during an audit. Report static-only conclusions and unverified visual/runtime behavior explicitly.
5. Return the structured report. Do not create a report file unless requested. Group duplicate symptoms under their shared cause and prioritize by impact, not checklist coverage.

## Review checklist

Use these as diagnostic questions, not mandatory abstractions or reasons to rewrite working code.

| Area | Questions to investigate |
| --- | --- |
| Components | Are responsibilities and prop contracts coherent? Does mixing orchestration, transformation, and rendering make a concrete change difficult? Check stable identity/keys, conditional rendering, and ownership of interactions before proposing extraction. |
| Hooks and state | Is each state value necessary, with one clear owner? Can derived or duplicated state drift? Check hook ordering, stale closures, dependency correctness, effect cleanup, and repeated mount/unmount behavior. Effects should synchronize external systems; investigate chains that merely copy state or handle user events. |
| Data fetching | Does the existing router/query/client mechanism own fetching consistently? Can a stale response overwrite newer intent? Trace cancellation or stale-result guards, request identity, retries, cache invalidation, and transitions between filters/routes. Memoization or a new fetching library needs a demonstrated benefit. |
| TypeScript and naming | Do types express real domain states and nullability? Are untrusted values validated rather than merely cast? Trace unsafe assertions, `any`, suppressions, and duplicated contract types to their consequences. Names should reveal domain meaning, units, and boolean intent; follow established conventions rather than renaming for taste. |
| Organization | Can callers find the public entry point without importing private details? Are exclusive styles, tests, and helpers near their owner under local conventions? Check circular dependencies, broad barrels, client/server boundary leaks, and unrelated responsibilities hidden in generic files. |
| Reuse and abstractions | Do shared components, hooks, and utilities capture actual shared behavior? Examine inconsistent duplicated logic, but also wrappers, option-heavy interfaces, and single-use abstractions that add indirection. Recommend sharing only when it reduces demonstrated maintenance cost without coupling unrelated features. |
| API and errors | Are request serialization and response contracts consistent with the implemented API? Trace loading, empty, success, partial failure, and refresh failure states. Check that failed requests do not masquerade as valid empty data, retained data is identified appropriately, recovery is usable, and internal errors or secrets stay out of UI/logs. |
| SCSS Modules and tokens | Where modules are used, are selectors locally owned and overrides predictable? Trace missing or inconsistent semantic tokens across supported themes, including chart styles. Distinguish deliberate one-off values from repeated values causing drift; do not require tokenizing every number or changing the styling stack. |
| Accessibility and responsiveness | Can users operate controls with keyboard and discern names, focus, errors, and status changes? Check semantic elements, focus management, disabled states, meaningful alternatives for charts, contrast, and reduced motion. Inspect narrow/wide layouts, zoom, long content, and overflow; mark visual checks unverified when not exercised. |
| Tests | Do tests protect observable behavior and realistic failure boundaries with deterministic fixtures? Investigate implementation-coupled assertions, excessive mocks, flaky timing, and misleading snapshots. Propose regression cases for identified risks, not arbitrary coverage percentages or tests that repeat implementation. |
| Complexity | Does each layer, effect, generic, configuration option, and comment earn its place? Flag dead paths, placeholder behavior, redundant defensive checks, and boilerplate only with evidence of confusion or maintenance cost. Do not infer code quality from suspected AI authorship or impose line-count limits. |

## Evidence and severity

Classify each finding separately from its severity:

- **Confirmed defect:** A traced code path, contract violation, reproduction, or failing check demonstrates incorrect behavior. State the conditions; distinguish static proof from runtime reproduction.
- **Maintenance risk:** Concrete coupling, duplication, or complexity makes a named change/error more likely. Explain the affected callers and cost; do not present a hypothetical failure as reproduced.
- **Preference:** Equally valid alternatives without demonstrated harm. Keep optional suggestions separate from actionable findings and omit them unless useful to the requested review.

Severity reflects consequence and reach, not confidence or how easy a fix is:

| Severity | Impact |
| --- | --- |
| Critical | Severe exposure of sensitive data or destructive behavior affecting users; needs immediate attention. |
| High | A core user flow fails, materially incorrect results appear, or a key task is inaccessible under realistic conditions. |
| Medium | A bounded functional problem or evidenced maintenance risk has meaningful cost, with a workaround or limited reach. |
| Low | A localized issue has minor impact or small demonstrated maintenance cost. |

Unresolved suspicions belong in open questions with the evidence needed to decide, not in confirmed defects. Do not inflate severity for a local convention violation without explaining its impact. No findings is a valid result; passing checks alone does not establish absence of defects.

## Audit output

Return these sections, omitting empty optional suggestions:

1. **Scope and context:** Mode, reviewed paths/flows, relevant conventions, and exclusions. State whether coverage was complete or sampled.
2. **Prioritized findings:** Stable IDs (F1, F2, ...), severity, classification, descriptive title, precise file/line locations, trigger/evidence, consequence, smallest recommended correction, and a meaningful verification/regression case. Label what was reproduced versus inferred from code.
3. **Refactoring plan:** Ordered finding IDs, cohesive change boundaries, expected behavior to preserve, and relevant checks. Keep this a plan in audit mode; do not invent work if there are no actionable findings.
4. **Verification and limits:** Commands actually run and their results, checks not run and why, runtime/visual gaps, and open questions. In refactoring mode, also report changed files and unresolved findings.

## Targeted refactoring

Confirm the selected finding still applies to the current code. Implement the smallest cohesive correction using existing capabilities, preserve behavior outside the identified defect, and update focused tests when behavior changes. Avoid bundling preferences or unrelated cleanup. Use the repository's verification procedure for affected code, review the final diff, and report which finding IDs are resolved with supporting evidence.
