---
name: spire-tech-react-a11y
description: Use when writing or reviewing React accessibility — semantics, keyboard, focus, labels, or ARIA. Triggers on a11y defects in React UI. Skip non-React stacks.
when-to-use: React accessibility, keyboard navigation, focus, ARIA, accessible names, labels
---

# React accessibility — semantics first

Own **a11y craft for React/Next UIs**. Project canon and legal/product a11y floors outrank generic tips.
Prefer this over generic `spire-tech-design-review` when the defect class is a11y.

## Critical procedure

1. Confirm React/Next; stop if non-React.
2. Prefer **semantic HTML** before ARIA; no ARIA when native elements suffice.
3. **Keyboard:** all interactive controls operable; visible focus; no keyboard traps.
4. **Names:** icons/buttons have accessible names; form fields have labels.
5. **Errors:** associate messages with fields; announce critical updates when appropriate.
6. **Contrast/motion:** respect project tokens; avoid conveying meaning by color alone.
7. Record findings in the role artifact (`design-review` / QA_REPORT / done-report) — no parallel A11Y.md.

## Reference routing

| Read when | Reference |
| --- | --- |
| Common defect classes | [A11y checklist](references/a11y-checklist.md) |

## Stop conditions

Stop when the surface cannot be observed, or when product canon forbids a required accessible pattern
without an alternative. Report the conflict.

## Do not

- Do not bolt ARIA onto broken structure as a first move.
- Do not claim WCAG certification without a project mandate and method.
- Do not invent brand-only color systems that fail contrast without flagging.
