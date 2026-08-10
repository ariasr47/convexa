# Owner device review checklist (backlog 5.6)

**Purpose:** Sign-off on real phones after recent widgets (notch / &lt;375 / coarse pointer).  
**App changes shipped with this checklist:** `viewport-fit=cover`, safe-area insets on AppShell, overflow clip on main.

## Devices

| Device                     | OS      | Browser | Width | Pass? | Notes                  |
| -------------------------- | ------- | ------- | ----- | ----- | ---------------------- |
| iPhone SE (or 375 logical) | iOS     | Safari  | ≤375  | ☐     |                        |
| iPhone 14/15 notch         | iOS     | Safari  | ~390  | ☐     | Home indicator / notch |
| Small Android              | Android | Chrome  | ≤360  | ☐     |                        |
| Desktop md+                | —       | Chrome  | ≥900  | ☐     | Regression             |

## Surfaces to exercise

1. **Landing** — hero, CTAs, no horizontal scroll.
2. **Ticker** — command deck stacks; open sim CTA / refused; board scrolls; sticky bar.
3. **Scanner** — filters wrap; table/cards usable; structure as-of readable.
4. **Positions** — cards not cut off; toolbars wrap; 44px targets.
5. **Alerts** — composer + rules usable with one thumb.
6. **Settings / Methodology** — prose readable, no overflow.

## Pass criteria

- No horizontal page scroll at 320–375 width.
- Primary CTAs ≥ 44×44 CSS px on coarse pointers.
- Content clear of notch / home indicator (`safe-area`).
- Skip link still first tab stop on keyboard desktop.

**Owner sign-off:** _________________ date ________
