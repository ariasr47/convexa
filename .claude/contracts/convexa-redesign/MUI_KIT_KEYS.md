# MUI-for-Figma kit — resolved component keys (Screens-in-MUI rebuild)

Library: **Material UI for Figma (and MUI X) (Community)**
libraryKey: `lk-087bc136fd70f838c3d74da2a42ab71e5d5819e4c64add570d0eed87d3481afee93239447ca7af785f403254f0d12da513ee06a05629112ad05aed7ea3e97ae5`
Target file: `4Njtm8QGWIgm4rA0UESg8n` · New page: **"Screens (MUI)"** (`73:2333`)

> Note: `search_design_system` for this community lib is unreliable (only ever returns Card*/ImageListItemBar).
> Base keys below were harvested by instantiating composites (CardHeader/Alert/EmailPassword/PlanItem/TableCell)
> and reading nested instances. `<Card>`/`<Typography>`/`<AppBar>` NOT exposed by search → build containers +
> Roboto text manually (standard figma-generate-design workflow). Roboto IS available — preload
> Regular/Medium/Bold/Light before any appendChild.

| Component | key | type |
|-----------|-----|------|
| `<Button>` | `9d7a8f78bcfe3c459f7369857550ca068b7ecc3f` | set (Size/Color/State/Variant; Label prop `Label#11069:169`, Start/End Icon booleans) |
| `<Chip>` | `1a6b333ed00a0bdefe223261dbb2de4afd7b0d9d` | set |
| `<IconButton>` | `07a8d814a820dffe32e61c4c1086a0d243c763c9` | set |
| `<TextField>` | `42221b546389320bf6c1a76c79823afb2675de80` | set |
| `<TextField> Multiline` | `33ba10d00c4892dc4f91bb7bccac04024e91f6c9` | set |
| `<Alert>` | `0d466d443e500cd8f499c1269cbb6a276241b99a` | set |
| `<Avatar>` | `1c18d1064dc56d7ec5ba0913e05f15c059b70b18` | set |
| `<Badge>` | `338392b46b0f260b84836d3696610738655d6007` | set |
| `<Checkbox>` | `d401f8bff0d7a07499384a9fd34ed23b8c1f8e3c` | set |
| `<Radio>` | `805679235c1dc39f0e91fcf0e3b5282bb5c56e3f` | set |
| `<Divider> Horizontal` | `c827878ff3f8cd10e4d0b6a25fbebcaacd79a70d` | comp |
| `<FormLabel>` | `8c5bef7bbccdc2838ed623f0295efd61265d9e27` | set |
| `<FormHelperText>` | `4d2f948c61af4d247937a2517c33f5062c2a8420` | set |
| `*Custom/Forms/Email & Password` | `e9ff014984324ed33bf58d97d49588501b42b3f9` | comp |
| `*Custom/Settings/Plan Item` | `df937cb423e6f410c31e8954d0bbcca095f05ee9` | set |
| `*Custom/Table/Custom Cell` | `575ba1d8fbdf9d9f7be5b0df1c1f018c3936282b` | set |
| `<CardHeader>` | `0dc5a33f08839378e0a7ae45030909e3fa1d620c` | set |
| `<CardMedia>` | `427ca3d34e088028b4a94562dec58d9bc9f8aa0c` | comp |
| icons | StarSharp `653e99…`, ErrorOutline `ad8058…`, CloseFilled `aef64e…`, CancelFilled `fab715…`, UploadFileFilled `ad3184…`, ChevronLeft `29001e…`, ChevronRight `f8f028…` | comp |

## Local Convexa components (owner convention: one per page under ——— Components ———)
Reuse by `(await figma.getNodeByIdAsync(id)).createInstance()` (or the specific variant child), append, set `layoutSizingHorizontal` (FILL/FIXED), then override named TEXT layers via `inst.findOne(n=>n.type==="TEXT"&&n.name===NM).characters=…`.
| Component | node id | page | notes |
|-----------|---------|------|-------|
| TopNav | SET `84:406` | TopNav `85:304` | 8 variants. `Active`=None/Ticker/Positions/Scanner · `State`=Signed out/Signed in. Signed-out → MUI outlined "Sign in"; Signed-in → `rod@convexa.io` + 32px gradient avatar "R". FILL width. `setProperties({Active,State})`. |
| Footer | COMP `83:48` | Footer `85:305` | logo + disclaimer. FILL width. |
| ComingSoonCard | SET `101:27` | ComingSoonCard | `Icon`=Radar (blue circle) / Lock (bare grey). TEXT layers `Heading`,`Body`,`Link`; hide `Link` (visible=false) for no-link. Used by Scanner (Radar) + Positions-Live (Lock). |
| PositionRow | SET `106:52` | PositionRow | `Direction`=Up(green)/Down(red) → P/L color + sparkline. TEXT layers: `Ticker,Sub,Strategy,Qty,Entry,Mark,PL,PLpct,dEntry,Expiry`. Col widths match table header. FILL width. |
| PositionCard | SET `108:58` | PositionCard | `Direction`=Up/Down. TEXT layers: `Ticker,Sub,Strategy,PL,PLpct,Expiry` + kv labels/values `QtyLbl/QtyVal,EntryLbl/EntryVal,MarkLbl/MarkVal`. 632 wide. |
| PositionsPanel | SET `113:838` | PositionsPanel | **Composite** = Toolbar + Filters + body. `View`=Table (10-col table of PositionRow) / Cards (grid of PositionCard). FILL width. The reusable positions data view — drop under Simulated OR **Live** tab later. Positions Table/Cards screens are each just Header+Tabs+`PositionsPanel` instance now. |
| AuthModal | SET `125:93` | AuthModal | `State`=Login / Signup (title, subtitle, primary-button label, bottom link baked per variant). email/password fields + MUI Sign-in/Create button + "Continue with Google". 380 wide. Auth Sign-in screen = Login instance; Create screen = Signup instance (both ABSOLUTE-positioned over the dimmed Landing backdrop). |

> **Settings dark-theme note:** input boxes (select/field/segmented) must be a RECESSED fill **darker than the card** (`~#0b0e14`), not the card color — else they flatten. Panel headings are Roboto **Medium** 15 (not heavy Bold). Active theme segment = blue-tint fill + blue stroke. (Fixed 2026-06-30.)

> **Naming gotcha (learned):** Figma auto-names a TEXT layer by its content, so a static label ("Qty") and its dynamic value collide on the same name → `findOne(name)` hits the wrong one. Give every override target a UNIQUE explicit name (e.g. `QtyVal`).

### Ticker section components (extracted 2026-06-30; each on its own `Ticker · …` page under Components)
Ticker Live (`135:3`) is now composed of instances of these:
`Ticker · Toolbar` 149:66 · `Ticker · Header` 149:96 · `Ticker · Live Tape` 149:112 · `Ticker · Dealer Positioning` 149:134 · `Ticker · GEX Strike Profile` 149:172 · `Ticker · Term Structure` 149:579 · `Ticker · AI Recommendation` 149:598 · `Ticker · Fresh Positioning` 149:624 · `Ticker · Off-Exchange Blocks` 149:642 · `Ticker · Setups` 149:670.
All 3 Ticker screens are now component-driven: **Live `135:3`**, **Offline `154:458`**, **Stale `154:473`** (rebuilt as clones of the componentized Live → all sections are instances). State deltas applied as INSTANCE OVERRIDES: Toolbar active segment (Live/Stale/Offline), Header chip (live / market-closed / offline), Live-Tape dim+caption (Offline), Stale banner. The upgraded Live-Tape/Dealer tile style (left accent bar + ⓘ + r12) propagates to all three via the components. (Future cleanup: convert Toolbar/Header/LiveTape to `State` variants so the deltas are variant-driven instead of per-instance overrides.)

Landing (`78:10`) uses TopNav+Footer instances; **Hero + "What works today" are plain frames** (reverted from components — single-use). Positions Table/Cards use PositionRow/PositionCard instances; Scanner + Positions-Live use ComingSoonCard instances.

## Source references (per screen, on disk — gitignored)
`figma_frames/01-landing.html` … `13-ai-sent-tray.html` ; existing Figma sections on page `0:1` (node ids in manifest).
14 screens: Landing signed-out (`3:280`) / signed-in (`3:474`); Ticker Live (`4:984`)/Stale (`4:1414`)/Offline (`4:1854`);
Positions Table (`4:2143`)/Cards (`4:2429`)/Live-locked (`4:2497`); Scanner (`4:2565`); Settings (`4:2679`);
Auth Create (`4:2941`)/Sign-in (`5:363`); Trade Dialog (`5:868`); Tray (`6:1353`).
