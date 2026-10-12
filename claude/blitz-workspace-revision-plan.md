# Blitz Workspace — Full Revision & Fix Plan

**Date:** 2026-10-12 · **Code audited:** `origin/main` @ `9fd37d6` plus the unmerged
`fix-dashboard-gg` branch (one commit, the tidy g–g empty state) · **Mode:** plan only —
no code was changed in this pass.

> **Decisions & first changes applied (2026-10-12, branch `feat-iterations`).** Tahmid's calls: P0-2 sign-up **turned off** (done in the dashboard); **P1-8 points** and **P2-11 Task Map CSV** deferred; **P2-13** settled as *only frozen edits are change-logged* (current behaviour — no code change, recorded as the convention); **P2-14 lap sim → shared values done**. Plus a **new feature** (outside the freeze, explicitly requested): a per-calculator **iteration/scenario manager** — save up to 15 setups, compare them (table + chart), download, delete, and mark one *final* to load + share. See the note at the end of §5.

**Feature freeze honoured.** Every finding below is a bug, correctness error,
data-integrity issue, security gap, UX/consistency/accessibility problem, performance
issue or code-health item *inside an existing feature*. Anything that would add a tool,
page, route, Master key or scope is in [Deferred](#7-deferred--out-of-scope).

---

## How this was verified

| Check | Method | Result |
|---|---|---|
| Walkthrough numbers | Scratch harness (outside the repo) driving the **same pure `compute()` functions the pages mount**, called the way each page calls them, with the walkthrough's sample car | **119 / 124 match**; the 5 non-matches are triaged in §2 (1 real bug, 3 stale walkthrough values, 1 unit-label inconsistency) |
| Empty / zero inputs | Same harness, 14 edge cases | NaN renders "—" correctly; **`Infinity` does not** (P2-1) |
| RLS — reads | `GET` every table as an anonymous client | All **15 tables return `[]`** ✓ |
| RLS — writes | Anonymous `INSERT` on 11 tables with a **NULL primary key**, so it could not succeed even if RLS were off; the error code shows which barrier fired | All **42501 — blocked by RLS** ✓ |
| RPCs | Anonymous call to `edit_param` / `edit_param_text` with a **key that does not exist**, so nothing can change | **Function body executed** (P0-1) |
| Auth | Public `GET /auth/v1/settings` | **`disable_signup: false`** (P0-2) — I did **not** create an account to prove it |
| Storage | Anonymous list + public-URL fetch on all 3 buckets | Private ✓ |
| Secrets | Grep of the built bundle | Only the anon key (role `anon`) ✓ |
| Routes & islands | Dev server: every route + every script module it loads | **35 routes 200, all island modules compile** ✓ |
| Links | Every `href`/`src` in the build + every `#anchor` | **766 links, 0 broken, 0 missing anchors** ✓ |
| CSV | Shared parser with 12 hostile rows; then each list tool's export vs import columns | Parser round-trips all 12 ✓; 2 tools are lossy (P2-9, P2-10) |
| Contrast | WCAG ratio computed from the actual tokens, both themes | 4 token pairs below AA (P2-2) |
| Health | `astro check`, `vitest`, `astro build` | **0 errors · 0 warnings · 0 hints · 152/152 tests · no build warnings** ✓ |

**Limits, stated plainly.** (1) The UI is magic-link only and I have no session, so I could
not drive the *signed-in* pages in a browser. Numbers were verified through the exact compute
functions plus a code trace of each page's adapter between DOM and compute — which is where
P1-1 and P1-2 were found. (2) Headless Chrome would not start in this environment (sandboxed
or not), so visual items (legend fills, mobile layout) were checked by reading CSS/markup and
are marked accordingly. (3) Anything I could only trace in code, not reproduce, is marked
**suspected**.

---

## 1. Inventory (Phase 0)

### 1.1 Routes (35, all return 200)

| Group | Routes |
|---|---|
| Discipline cockpits | `/vehicle-dynamics` · `/powertrain` · `/electronics` · `/chassis` · `/aerodynamics` · `/ergonomics` |
| Standalone calculators | `/massbudget` · `/geometry` · `/springs` · `/brakes` · `/balance` · `/gg` · `/lapsim` · `/daq` · `/events` · `/measurement` · `/points` |
| Planning / cost | `/taskmap` · `/gantt` · `/budget` · `/cost` · `/readiness` · `/setup-sheet` |
| Platform | `/` (dashboard) · `/vehicle-spec` · `/validation` · `/tyre` · `/gates` · `/snapshots` · `/report` · `/sensitivity` · `/resources` · `/change-log` |
| Auth / infra | `/login` · `/auth/callback` · `/manifest.webmanifest` |

### 1.2 Calculators and the compute each runs

| Page | Tool (`tool_state` id) | Compute | Reads Master | Contributes |
|---|---|---|---|---|
| vehicle-dynamics | `vd_setup` | none (targets only) | track F/R, wheelbase, μ_lat | — |
| | `vd_loads` | `loadsCompute` | mass, ff, wheelbase, CoG | pushrod F/R, anti % F/R |
| | `vd_steering` | `steeringCompute` | wheelbase, track_front | ackermann_split |
| | `vd_steereffort` | `steeringEffortCompute` | μ_lat, axle_load_front, rolling_radius | steering_wheel_torque, rack_force |
| | `vd_loadtransfer` | `loadTransfer` | mass, ff, CoG, tracks, unsprung, rear_rc_height | **writes Master** `tlltd_front` |
| | (R&P sweep) | `rpSweep` | — | — |
| powertrain | `pt_traction` | `tractionCompute` | rolling_radius, axle_load_rear, μ_long→μ_lat, mass | engine_peak_power, final_drive, max_wheel_torque |
| | `pt_gearspeed` | `gearSpeedCompute` | rolling_radius | — |
| | `pt_restrictor` | `restrictorCompute` (+Master Ø) | restrictor_dia | — |
| | Cooling (iframe) | external app | rolling_radius, final_drive | — |
| electronics | `elec_power` · `elec_battery` · `elec_wiredrop` · DAQ plan · wiring list | `powerCompute` · `batteryCompute` · `wireDropCompute` · `channelBusLoad` | — | battery_mass, total_current_draw, bus_utilisation |
| chassis | `chassis_tube` · `chassis_mass` · `chassis_buckling` · `chassis_bolt` | `tubeCompute` · `massCompute` · `tubeBucklingCompute` · `boltedJointCompute` | — | torsional_stiffness, chassis_mass_built |
| aerodynamics | `aero` · `aero_balance` | `aeroCompute` · `aeroBalanceCompute` | mass, ff | cl_a, cd_a, aero_balance_front |
| ergonomics | `erg_fit` | pass-through | wheelbase | driver_mass, driver_cog_height, seat_back_angle |
| events | `ev_accel` · `ev_skidpad` · `ev_grip` | `accelCompute` · `skidpadCompute` · `gripBudgetCompute` | — | — |
| measurement | `ms_cog` · `ms_corner` · `ms_quarter` · `ms_trifilar` | tilt / corner / quarter-car / trifilar | — | **writes Master** `yaw_inertia` |
| massbudget | `massbudget` | `massBudget` | wheelbase, tracks | **writes Master** mass, ff, CoG, Izz |
| geometry | `geometry` | `geometrySweep/Summary`, synthesis | CoG, wheelbase | rc_height_static, rc_migration, camber_gain_bump; **writes Master** `rear_rc_height` |
| springs | `springs` | `springsCompute` | mass, ff, Kt, CoG, tracks | spring_rate F/R, roll_gradient |
| brakes | `brakes` | `computeBrakeSystem`, `biasSweep`, lock-up, thermal | ff, CoG, wheelbase, μ_long→μ_lat, rolling_radius, mass, decel target | brake torque F/R, achieved_front_bias |
| balance | `balance` | `understeer`, `rollDistribution`, `arbForTarget` | mass, ff, wheelbase, Cα, tlltd_front | understeer_gradient, static_margin, arb_front_needed |
| gg | `gg` | `ggLimits`, `ggCurve` | μ_lat, mass | — |
| lapsim | `lapsim` | `simulateLap` | mass | lap_time_s, endurance_fuel_l |
| daq | (log upload) | `interpretLog` | track_front, steering ratio, MR, wheelbase | — |
| points · budget · gantt · cost · readiness · taskmap | own ids | `relativePoints` · budget · gantt · cost FCA · readiness · taskmap graph | — | — |
| sensitivity | reads 8 tools | `sensitivity()` | all its downstream keys | — |

### 1.3 Supabase

- **Tables (15):** `vehicle_spec`, `change_log`, `gates`, `tyre_results`, `tool_state`, `tool_outputs`, `resource_folders`, `resources`, `members`, `spec_snapshots`, `taskmap_buckets`, `taskmap_phases`, `taskmap_loops`, `taskmap_activities`, `taskmap_dependencies`. All present (migrations 0001–0013 applied).
- **RPCs:** `edit_param`, `edit_param_text` (SECURITY DEFINER), `is_lead()`.
- **Triggers:** `guard_frozen`, `log_freeze_toggle`, `guard_freeze_role`, `touch_updated_at`, `members_fill_email`, `snapshot_stamp`.
- **Storage (private):** `workbooks`, `tyre`, `resources`.
- **Realtime publication:** shared tables + taskmap tables.
- **Auth:** magic link; invite-only **intended** (client sends `shouldCreateUser: false`).

### 1.4 Shared keys

- **Master (`vehicle_spec`):** 32 seeded keys, 4 computed (`avg_track`, `weight`, `axle_load_front`, `axle_load_rear`). Master writers: Vehicle Spec editor, MassBudget, Measurement (Izz), Geometry (rear RC), Load transfer (TLLTD), Tyre (.tir).
- **`tool_outputs`:** 38 registry keys; 35 produced; 3 never produced (P1-7).

### 1.5 Build & deploy

Astro 5 static, `base: /blitz-technical-house`, `format: directory`; GitHub Pages via Actions;
deps `@supabase/supabase-js`, `astro`, `chart.js`; dev deps `@astrojs/check`, `typescript`,
`vitest`. PWA: generated manifest + `public/sw.js`.

---

## 2. Walkthrough result (Phase 1 oracle)

**119 of 124 expected values reproduce.** The five that don't:

| Value | Site | Walkthrough | Verdict |
|---|---|---|---|
| Gear speed, 1st at redline | **NaN → "—"** | 36.3 km/h | **Real bug → P1-1** |
| Roll gradient | 1.16 deg/g | 1.64 deg/g | **Walkthrough stale.** The harness reproduces 1.64 *only* with the pre-P1.1 formula (total mass × full CoG height). The site uses sprung mass × lever above the roll axis, matching WORKSPACE_REFERENCE. Consequence: deliberate finding #3 ("roll a bit high") **no longer triggers** with the default RC heights 30/45 mm. Using Geometry's own RC (≈6.5 mm) gives **1.30 > 1.2** and restores it → P3-2 |
| DAQ bus load | 125,616 bit/s (25.1 % of 500 k) | 339,200 bit/s (67.8 %) | **Walkthrough stale** — written before the real 35-channel plan replaced the old default set. Still passes Validation (≤ 70 %) → P3-2 |
| Brake effective radius | 0.0773 **m** | 77.3 **mm** | Same number, but the page shows metres while every brake input is mm → P3-1 |

The other three deliberate findings (oversteer K = −0.067, bias 0.667 vs Olley 0.761,
electrical margin −3.9 A) reproduce exactly and are **not** treated as bugs.

---

## 3. Findings

Severity: **P0** broken/unusable or security · **P1** wrong number / data integrity ·
**P2** UX / consistency / accessibility · **P3** polish.
Confidence: **Confirmed** (reproduced or proven by harness/probe) · **Code** (proven by
reading the code path end to end) · **Suspected** (likely, not proven).

### P0 — Security

| ID | Area | Conf. | What's wrong | How reproduced | Evidence | Proposed fix | Effort | Regression risk |
|---|---|---|---|---|---|---|---|---|
| **P0-1** | DB · RPC | Confirmed | An **anonymous** client can execute `edit_param` and `edit_param_text`. Both are SECURITY DEFINER (bypass RLS), so anyone holding the public anon key — which ships in the site's JS — can **overwrite any non-frozen Master value without signing in**. Frozen keys stay protected by the lead check. Writes would log with a null actor. | `POST /rest/v1/rpc/edit_param` with the anon key and `p_key = "__revision_probe_nonexistent__"` → `P0001 "unknown parameter…"`. That error is raised *inside* the function body, so anon has EXECUTE. Not tested with a real key on purpose. | `0011_roles.sql:128,156`; `0004_freeze_and_log.sql:41` grants to `authenticated` but nothing revokes Postgres's default EXECUTE-to-PUBLIC | Migration **0014**: `revoke execute on function public.edit_param(text,numeric,text), public.edit_param_text(text,text,text) from public, anon;` and, as defence in depth, `if auth.uid() is null then raise exception 'Sign in required';` at the top of both. Re-probe → expect `42501`. | S | Low — signed-in path unchanged; re-test a frozen edit in Vehicle Spec |
| **P0-2** | Auth | Confirmed | **Public self-signup is enabled.** "Invite-only" is enforced only by the login form (`shouldCreateUser: false`), which is a client-side flag anyone can bypass with the public anon key. Every RLS policy grants full access to *any* authenticated user, so a stranger could sign up and read/edit the whole workspace. | `GET /auth/v1/settings` → `disable_signup: false`. I did not create an account to prove it. | `login.astro:58–64`; `supabase/README.md §2` says to switch it off | **Dashboard config, no code:** Authentication → Sign In / Providers → turn off *Allow new users to sign up*. Invites keep working. Re-check the settings endpoint shows `true`. | S | Low |

### P1 — Wrong numbers / data integrity

| ID | Area | Conf. | What's wrong | How reproduced | Evidence | Proposed fix | Effort | Regression risk |
|---|---|---|---|---|---|---|---|---|
| **P1-1** | Powertrain · Gear speed | Confirmed | **Road speed is always "—".** The compute reads `i.rollingRadius`, but the engine passes the Master separately (`m.rolling_radius`) and the page hands the compute over unadapted. Wheel rpm is right; speed is NaN. | Harness, called exactly as mounted: wheel rpm 422 ✓, speed **NaN** (walkthrough 36.3 km/h). | `extras.ts:32`; `powertrain.astro:167` | Adapter `(inp, m) => gearSpeedCompute({ ...inp, rollingRadius: m.rolling_radius })` — the pattern the restrictor already uses. Add a test calling it the way the page does. | S | Low |
| **P1-2** | Sensitivity | Code | **4 of 8 downstream tools load no inputs.** It reads `tool_state` for `vd_brakes`, `vd_springs`, `vd_steering_effort`, `aero_balance`; the pages save as `brakes`, `springs`, `vd_steereffort`, `aero`. Those rows compute with empty inputs → NaN → **silently dropped**. The aero adapter also runs the downforce compute against the *balance* tool's inputs. | `/sensitivity` → CoG height shows no Brakes (Olley) or Springs (roll gradient) rows, although both read CoG. My own tests passed only because they inject inputs directly. | `sensitivity.astro:70`; `sensitivity.ts:58` ff. vs each page's `TOOL` constant | Correct the four ids in both lists; add a test that every `DOWNSTREAM[].tool` is a real page tool id. | S | Low |
| **P1-3** | Vehicle Spec · derived keys | Code | `weight`, `avg_track`, `axle_load_front/rear` are only recomputed when someone **edits on Vehicle Spec** — not on load, and not when MassBudget contributes a new mass/ff. Traction limit (reads `axle_load_rear`) and steering effort (reads `axle_load_front`) then run on **stale loads**. | After the walkthrough: MassBudget, engine 55 → 65 kg, Contribute. Powertrain's traction limit stays 1950 N instead of tracking the new rear load. (Walkthrough order happens to hide this, because Stage 4 edits Vehicle Spec after Stage 2.) | `vehicle-spec.astro:196` (only called from edits/realtime); `massbudget.astro:318` | Recompute derived keys **where the Master lives**: a DB trigger on `vehicle_spec` that refreshes the four rows when `mass_total`, `mass_frac_front`, `track_front` or `track_rear` change (migration **0015**). Remove the client-side derived writes; keep the display. Fixes P1-4 too. | M | Medium — re-run walkthrough Stage 4 values and traction/steering-effort |
| **P1-4** | Vehicle Spec · realtime | Suspected (code trace) | **Write ping-pong.** On any change from another member, Vehicle Spec calls `recomputeDerived()`, which writes all four derived keys **unconditionally**. With two members on that page, each one's derived writes are "theirs" to the other, which rewrites them, forever — continuous DB writes and repeating toasts. I introduced this with Realtime. | Needs two accounts, so not reproduced live. Trace: `vehicle-spec.astro:275` → `:196–210` writes → realtime UPDATE → the other tab's `:275`… | as listed | Resolved by P1-3 (the client stops writing derived keys). Minimum stop-gap: skip writes whose value hasn't changed. | S | Low |
| **P1-5** | g–g · lateral μ | Code | **Master overwritten by a stale private copy.** The page pre-fills μy from `mu_lat_peak`, then the tool's saved state overwrites it. After the first save, the green chip shows the live Master value while the envelope uses the old one. | Open `/gg` (saves μy = 1.5). Set `mu_lat_peak` = 1.6 in Vehicle Spec. Reopen `/gg`: chip says 1.6, maths uses 1.5. | `gg.astro:144–150` | Compute uses the Master value when set, local only as fallback (the P1.5/P1.6 pattern); render μy as linked. | S | Low |
| **P1-6** | Balance · Cαf / Cαr | Code | Same pattern: seeded from 2 × `corner_stiffness`, then overwritten by saved state, so a new tyre fit never reaches the balance maths. | As P1-5, with `corner_stiffness`. | `balance.astro:134–136` | **Decision:** axle Cα can legitimately differ from 2 × tyre Cα. Recommended: keep the inputs, but store the Master value they were seeded from and re-seed (with a visible note) when the Master has moved. | S–M | Low |
| **P1-7** | Readiness / output registry | Code | The registry lists **3 keys nothing produces** in `tool_outputs`: `tlltd_front` (actually a **Master** key written by Load transfer — so it appears **twice** in the picker and the tool-output copy can never go green), `radiator_area` and `heat_rejection_kw` (the Cooling iframe never contributes). Breaks the rule that the picker offers only keys the workspace really produces. | Readiness → add requirement → "Tool outputs" offers all three; a requirement on them stays grey forever. | `config.ts:171, 181–182` | Remove the three from `TOOL_OUTPUT_KEYS` (TLLTD stays selectable as a Master key). Migrate any saved requirement on `tlltd_front` to `source_type: master`. Add a test that every registry key has a producer. | S | Low |
| **P1-8** | Points predictor | Suspected | Formula is `P_max·(T_max/T_team−1)/(T_max/T_min−1)`, documented as "exact". FSAE/FS rules, as I understand them, give each dynamic event a **completion floor** (e.g. accel `95.5·(…)+4.5`) and score skidpad on **squared** time ratios — so a team finishing at T_max scores 0 here instead of its completion points. The FS-UK ceilings are also still placeholders. | Not reproducible without the 2026 rulebooks, which aren't in the repo. | `points.ts:15–20`, header comment | Per-event `{ pMax, completion, exponent }` confirmed against the **2026 rulebook excerpts** (needs Tahmid — "never invent a formula"); keep editable. | M | Low — pure + tests |
| **P1-9** | Snapshots · restore | Code | Restoring **non-frozen** values goes through plain `setMasterValue`, which writes **no Change Log row** — yet the page promises "each restored value … appears in the Change Log". | Restore any unfrozen key → Change Log unchanged. | `snapshots.ts:142`; `snapshots.astro:57` | Route every restore through `edit_param` (it logs any value change; a reason is only *required* when frozen). Safe once P0-1 is fixed. | S | Low |
| **P1-10** | Springs · RC height | Code | The roll-centre inputs are **local copies** labelled "(from Geometry)", while Geometry writes `rear_rc_height` to the Master. The roll gradient can disagree with the geometry the team froze. The same gap was fixed for Load transfer in P1.6; my P1.1 fix reintroduced it here. | Set `rear_rc_height` via Geometry → Springs still uses its own 45 mm. | `springs.astro:22` | Rear RC = Master `rear_rc_height` when set (fallback local), shown linked. Front has no Master key — relabel it honestly. | S | Low |

### P2 — UX, consistency, accessibility, security hygiene

| ID | Area | Conf. | What's wrong | How reproduced | Evidence | Proposed fix | Effort | Regression risk |
|---|---|---|---|---|---|---|---|---|
| **P2-1** | Render rule (all engine tools) | Confirmed | `fmt()` catches NaN but **not ±Infinity**, so a divide-by-zero shows the literal text **"Infinity"**. Violates the "—" rule. | Events → Skidpad, μ = 0 → lap time "Infinity". Electronics → Wire drop, area 0 → "Infinity". 7 tools affected in the harness. | `store.ts:413` | `if (v == null \|\| !Number.isFinite(v)) return '—'` — one line, fixes every page. | S | Low |
| **P2-2** | Colour contrast | Confirmed | Below WCAG AA 4.5:1 — **light:** `--ink-3` 3.84–4.21 (almost all small meta text: units, annotations, footnotes), `--amber-text` 4.09–4.32 (every warning banner); **dark:** `--heritage` 3.71 (every "Save failed" message), `--ink-3` on surface-2 4.37. | Ratios computed from the token values. | `tokens.css:54, 26, 101, 93` | Darken light `--ink-3` and `--amber-deep`; lighten dark `--heritage` and `--ink-3`; re-run the ratio script to ≥ 4.5 on every pair. | S | Low–Med (visual change) |
| **P2-3** | Accessibility · labels | Confirmed (scan) | **~40 inputs have no accessible name** — Balance (8), Brakes Advanced tab (13) + target decel, Geometry (anti-geometry + rear RC), Measurement trifilar (4), VD Load transfer (6), Lap-sim track grid, Points grid. | Static scan for `<input>` with neither `aria-label` nor a wrapping `<label>`. | per page | Add `aria-label`s (mechanical). | S–M | Low |
| **P2-4** | Legend coverage | Confirmed (scan) | **13 calculator pages render no colour legend**: Balance, Brakes, Springs, Geometry, g–g, MassBudget, DAQ, Cost, Budget, Sensitivity, Setup sheet, Validation, Points — several with green linked cells. (The swatch CSS itself looks correct by reading: solid fills, sized as flex items. Not visually confirmed — see Limits.) | Scan for `LegendKey`. | — | Add `<LegendKey />` to each. | S | Low |
| **P2-5** | Degraded / offline banner | Code | **7 pages load the Master but never show the banner** that says it's degraded or offline-cached: Home, **Vehicle Spec**, Validation, Setup sheet, DAQ, Sensitivity, Gates. Offline, Vehicle Spec would show cached values as if live and let you edit them. | Scan: `loadMaster()` without `decorateLinkedCells`/`showMasterAlert`. | per page | Call `showMasterAlert()` after `loadMaster()` on those pages. | S | Low |
| **P2-6** | Escaping | Code | Member-entered text inserted into `innerHTML` unescaped: Budget item names (`budget.astro:157, 159`); gate names and parameter labels on Gates (`gates.astro:72, 119`, lower risk). | Scan. | as listed | Wrap in `esc()`. | S | Low |
| **P2-7** | URL scheme | Code | Resources links and Tyre `.tir` links are HTML-escaped but their **scheme isn't checked**, so a `javascript:` URL saves and renders as a live link. Members are trusted, but with P0-2 open anyone could plant one. | Read the save and render paths. | `resources.astro:111`; `tyre.astro:153, 194` | Accept only `http(s):` / `mailto:` at save **and** at render. | S | Low |
| **P2-8** | Service worker | Code | `/data/`, `/templates/`, `/tools/`, `/icons/` are served **cache-first under a never-changing cache name**, and none are fingerprinted. Once a device caches `cooling.html` or a seed file, **it never sees an update**. (My bug, from the PWA work.) | Read the strategy. | `public/sw.js:51` | Cache-first only for `/_astro/` (fingerprinted); stale-while-revalidate for the rest; bump `VERSION`. | S | Low |
| **P2-9** | Readiness · CSV | Code | Export → import is **lossy**: no `subassembly` column, and a component with zero prerequisites isn't exported at all, so it vanishes on reimport. | Read `flatten()` / `rebuild()`. | `readiness.astro:105–120` | Add `subassembly`; emit one row per empty component. | S | Low |
| **P2-10** | Cost · CSV | Code | The simple export has no cost-block columns, but the importer reads them — so export → import turns FCA/block-costed parts into flat manual costs and the official FSAE-J export then shows blank blocks. | Read `getCsv` vs `applyCsv`. | `cost.astro:230–238` | Export the material/process/fastener/tooling (and code/asm/rev/description) columns the importer already accepts. FCA line detail travels via presets — say so. | S | Low |
| **P2-11** | Task Map · CSV & presets | Code | The only list tool with add/delete but **no CSV import and no presets** (export only) — breaks the list-tool convention. | Read. | `taskmap.astro` | Add `mountListControls` — best folded into the parked Task Map rework. | M | Low |
| **P2-12** | Steering · dead inputs | Code | `kingpinDist`, `steeringArm`, `rackTravel`, `swTurns` are shown, saved and **never used**. The reference formula uses the turning radius and front track, so these mislead. | Harness: changing them changes nothing. | `vehicle-dynamics.astro:67–70` | Label them "reference — not used in this calculation". No formula invented. | S | Low |
| **P2-13** | Governance · **decision** | Code | Unfrozen Master edits are **not** change-logged (direct update); only frozen edits go through `edit_param`. The house convention as you stated it is "all Master writes through `edit_param()`". | Edit any unfrozen value → no Change Log row. | `vehicle-spec.astro` save path | **Decide:** (A) route every write through `edit_param` — complete audit trail, more rows, debounce matters; or (B) keep, and record the convention as "frozen writes are logged". | S | Low |
| **P2-14** | Lap sim · **decision** | Code | Keeps private copies of μ_lat, μ_long, power, Cl·A, Cd·A — all of which exist as shared values. Golden rule vs a deliberate what-if tool. | Read. | `lapsim.astro:8–14` | **Decide:** link them (shared value if set, local fallback, override clearly marked), or document the tool as an intentional what-if. | S–M | Low |

### P3 — Polish, code health, docs

| ID | Area | Conf. | What's wrong | Evidence | Proposed fix | Effort | Risk |
|---|---|---|---|---|---|---|---|
| **P3-1** | Brakes | Confirmed | Effective radius shown in **m** while rotor OD and pad depth are entered in mm. | `brakes.astro:32` | Display in mm (display-only conversion). | S | Low |
| **P3-2** | Docs | Confirmed | **Walkthrough stale:** roll gradient (old formula), DAQ total (old seed), and Part E lists none of the v2 pages. **TOOL_SPECS §7f** writes `ATAN(L/(L−t/2))` — L where the turning radius R belongs; the code and the pinned workbook test (7.41°) both use R. | `TOOL_SPECS.md:168` | Regenerate the walkthrough (set Springs RC from Geometry ≈ 6.5 mm so roll gradient 1.30 > 1.2 keeps deliberate finding #3); fix the typo. | S | None |
| **P3-3** | Dead code | Confirmed | `ToolCard.astro` is never imported. | — | Delete. | S | None |
| **P3-4** | Performance | Confirmed | `chart.js/auto` registers every chart type → **203 KB** chunk, loaded on Home too (plus 219 KB supabase-js). | build output | Register only line/scatter/bar + needed scales. | S | Low |
| **P3-5** | CSV injection | Confirmed | Text cells beginning `=`, `+`, `@` export raw, so Excel would run them as formulas. | `csv.ts:8` | Prefix `'` on **text** cells only — never on numbers (negative values start with `-`). | S | Low |
| **P3-6** | Privacy | Code | The offline Master cache survives sign-out (shared lab computers). | `offline.ts:20` | Clear it on sign-out. | S | Low |
| **P3-7** | Cooling iframe | Code | Imports supabase-js from **esm.sh** at runtime with its own hard-coded URL and anon key: third-party CDN dependency, breaks offline, a second config source to drift. | `cooling.html:1993` | Bridge from the parent page (it already has the client), or bundle. | M | Low |
| **P3-8** | UX | Code | Frozen-edit reasons use `window.prompt`; errors use `alert()` — blocking and poor for accessibility. | `master-write.ts`, `vehicle-spec.astro`, `gates.astro`, `resources.astro` | Inline reason field / non-blocking status. | M | Low |
| **P3-9** | Tube stress | Confirmed | Wall = 0 → FoS shows "0" rather than "—". | `chassis-tube.ts:14` | Guard non-positive section area. | S | Low |
| **P3-10** | Number formatting | Code | `fmt()` trims trailing zeros (2 · 2.25 · 1.5 in one column), and nothing sets `tabular-nums` for sans-serif numerals (KPI tiles). Mono numerals are already fixed-width. | `store.ts` | Fixed decimals per column; `font-variant-numeric: tabular-nums` on numeric cells and KPIs. | S | Low |
| **P3-11** | Concurrency edge | Code | Same user in two tabs: own-uid `tool_state` events count as "my own write", so no conflict bar, and the stale tab's next save silently overwrites the other. | `engine.ts:230` | Use a per-tab id, not the user id. | S | Low |
| **P3-12** | Orphan key | Code | `slip_peak` is produced (Vehicle Spec) but read by nothing. Workbook-faithful, so keep. | `master.ts` | Note it as display-only in the reference. | S | None |

---

## 4. Grouped views

### By tool

| Tool / area | Findings |
|---|---|
| Supabase · RPC / Auth | P0-1, P0-2 |
| Powertrain | P1-1, P3-7 |
| Sensitivity | P1-2 |
| Vehicle Spec | P1-3, P1-4, P2-5, P2-13 |
| g–g | P1-5 |
| Balance | P1-6, P2-3 |
| Readiness | P1-7, P2-9 |
| Points | P1-8, P2-3 |
| Snapshots | P1-9 |
| Springs | P1-10 |
| Brakes | P2-3, P3-1 |
| Steering | P2-12, P3-2 |
| Cost | P2-10 |
| Budget | P2-6 |
| Gates | P2-6, P3-8 |
| Resources · Tyre | P2-7 |
| Task Map | P2-11 (+ parked rework) |
| Lap sim | P2-14, P2-3 |
| PWA / service worker | P2-8, P3-6 |
| Cross-cutting | P2-1, P2-2, P2-4, P3-4, P3-5, P3-10, P3-11 |
| Docs | P3-2, P3-12 |

### By severity

| Severity | Count | IDs |
|---|---|---|
| **P0** | **2** | P0-1, P0-2 |
| **P1** | **10** | P1-1 … P1-10 (P1-4 and P1-8 are *suspected*; P1-6 needs a decision) |
| **P2** | **14** | P2-1 … P2-14 (P2-13 and P2-14 are decisions) |
| **P3** | **12** | P3-1 … P3-12 |
| **Total** | **38** | |

### Biggest risks

1. **Anyone on the internet can change the Master today** (P0-1), and **anyone can create an account** (P0-2). Each takes minutes to close and neither needs a code change to the pages.
2. **Silent wrong or missing numbers** that look like valid output: gear speed (P1-1), stale axle loads feeding traction and steering effort (P1-3), private copies overriding the Master in g–g, Balance and Springs (P1-5, P1-6, P1-10), and sensitivity rows that quietly don't appear (P1-2).
3. **Governance promises the code doesn't keep**: snapshot restores that aren't logged (P1-9), and readiness requirements that can never turn green (P1-7).
4. Three of these were introduced by my own earlier work — Realtime (P1-4), the PWA worker (P2-8) and the P1.1 springs fix (P1-10). The fix plan covers them like everything else.

---

## 5. Recommended fix sequence

Each batch is small, re-verified before the next, and committed separately.

| Batch | Contents | Files touched | What could regress | Re-verify |
|---|---|---|---|---|
| **0 — Dashboard config (you, ~5 min)** | P0-2 turn off public sign-up | Supabase dashboard only | Nothing — invites still work | `GET /auth/v1/settings` → `disable_signup: true` |
| **1 — Security SQL** | P0-1 revoke anon EXECUTE + sign-in guard | `supabase/migrations/0014_rpc_lockdown.sql` | Signed-in frozen edits | Re-run the anon RPC probe → `42501`; frozen edit in Vehicle Spec still works and logs |
| **2 — Central one-liners** | P2-1 `fmt` Infinity · P1-1 gear speed · P1-2 sensitivity ids · P2-6 esc · P2-7 URL scheme · P2-8 SW strategy · P2-5 banners · P3-9 | `store.ts`, `powertrain.astro`, `sensitivity.astro/.ts`, `budget.astro`, `gates.astro`, `resources.astro`, `tyre.astro`, `public/sw.js`, 7 pages (banner) | Number display everywhere (fmt) | Harness: 120/124 with gear speed 36.3; new tests for gear-speed mounting and sensitivity ids; edge cases show "—" |
| **3 — Shared-state integrity** | P1-3 + P1-4 derived-key trigger · P1-7 registry · P1-9 restore via `edit_param` · P1-5 g–g · P1-10 springs rear RC | `0015_derived_keys.sql`, `vehicle-spec.astro`, `config.ts`, `snapshots.ts`, `gg.astro`, `springs.astro` | Vehicle Spec derived values; readiness saved requirements | Walkthrough Stage 4 values (1235 / 2452.5 / 1153 / 1300); traction after a MassBudget change; readiness picker; restore writes a Change Log row |
| **4 — Accessibility & consistency** | P2-2 contrast · P2-3 labels · P2-4 legends · P2-9 / P2-10 CSV round-trips · P2-12 steering labels · P3-1 brake radius mm · P3-10 | `tokens.css` + ~15 pages | Visual appearance (contrast) | Contrast script ≥ 4.5 on all pairs; CSV export → import identical for Readiness and Cost; label scan empty |
| **5 — Decisions, then build** | P1-6 Balance Cα · P1-8 points (needs rulebook) · P2-13 logging scope · P2-14 lap sim · P2-11 Task Map CSV (with the rework) | per decision | — | per decision |
| **6 — Polish & docs** | P3-2 walkthrough regen + TOOL_SPECS typo · P3-3 · P3-4 · P3-5 · P3-6 · P3-7 · P3-8 · P3-11 · P3-12 | docs, `chart-theme.ts`, `csv.ts`, `offline.ts`, `cooling.html`, `engine.ts` | Chart rendering (P3-4) | `npm run check/test/build`; Home and two chart pages render |

Already done, waiting on you: **`fix-dashboard-gg`** (the tidy g–g empty state) is pushed but not merged.

---

## 6. Coverage checklist

From the walkthrough's Part E, plus every v2 page. ✅ = audited (compute and/or wiring and/or probe). Finding IDs in brackets.

**Platform:** ✅ Login [P0-2] · ✅ Vehicle Spec editor [P1-3, P1-4, P2-5, P2-13] · ✅ Freeze a value (trigger + lead check traced; user-tested earlier) · ✅ Change Log (escaping ✓) · ✅ Dashboard + g–g snapshot [P2-5] · ✅ Tyre results upload [P2-7] · ✅ Resources upload [P2-7] · ✅ Gates / Phases sign-off [P2-6]

**Vehicle Dynamics:** ✅ Setup (targets) · ✅ Suspension geometry (RC 6.5 ✓) · ✅ Springs & dampers [P1-10] · ✅ Suspension loads ✓ · ✅ Steering [P2-12] · ✅ R&P gear sweep ✓ · ✅ Brakes, Sizing + Bias sweep [P3-1] · ✅ Balance [P1-6] · ✅ Load transfer · ✅ Steering effort

**MassBudget / standalone:** ✅ MassBudget ✓ · ✅ Geometry · ✅ Springs · ✅ Brakes · ✅ Balance · ✅ g–g [P1-5]

**Powertrain:** ✅ Traction ✓ · ✅ Cooling [P3-7] · ✅ Gear speed [P1-1] · ✅ Restrictor ✓
**Electronics:** ✅ Power budget ✓ · ✅ Wiring list · ✅ DAQ [P3-2] · ✅ Battery ✓ · ✅ Wire drop ✓
**Chassis:** ✅ Tube stress [P3-9] · ✅ Mass tracker ✓ · ✅ Buckling ✓ · ✅ Bolted joint ✓
**Aero:** ✅ Downforce / drag ✓ · ✅ Aero balance ✓
**Ergonomics:** ✅ Driver fit (pass-through) ✓
**Predictors / helpers:** ✅ Accel ✓ · ✅ Skidpad ✓ · ✅ Grip budget ✓ · ✅ CoG tilt ✓ · ✅ Corner-weight ✓ · ✅ Quarter-car ✓ · ✅ Validation (all achieved keys produced ✓)

**v2 additions (not in Part E):** ✅ Readiness [P1-7, P2-9] · ✅ Gantt ✓ · ✅ Budget [P2-6] · ✅ Cost [P2-10] · ✅ Points [P1-8] · ✅ Lap sim [P2-14] · ✅ DAQ interpretation ✓ · ✅ Setup sheet [P2-5] · ✅ Snapshots [P1-9] · ✅ Report ✓ · ✅ Sensitivity [P1-2] · ✅ Task Map [P2-11] · ✅ Command palette ✓ · ✅ Roles / Members ✓ · ✅ Realtime [P1-4, P3-11] · ✅ PWA / offline [P2-8, P3-6] · ✅ 3D hardpoint view ✓

### Verified correct — no action

All 119 matching walkthrough values (MassBudget, Vehicle Spec derived formulas, Geometry static RC, every Springs rate/damping/roll-stiffness value, Loads, Steering, R&P sweep, Brakes torque/bias/Olley/dynamic loads/sweep, Balance K/SM/critical speed/roll split/ARB, g–g, Aero + balance, Traction, Restrictor, Power, Battery, Wire drop, Tube, Buckling, Bolt, Accel, Skidpad, Grip, CoG tilt, Corner-weight, Quarter-car). RLS on all 15 tables, private storage, anon-only key in the bundle, 35 routes and their modules, 766 links, CSV parser, MassBudget/Gantt/Lap-sim/Budget/mass-tracker CSV round-trips, compute purity, Validation wiring, corner-weight adapter, Change Log escaping, Tyre-card escaping, global `:focus-visible`, global `prefers-reduced-motion`, no hard-coded base paths.

---

## 7. Deferred / out of scope

New features or scope, parked — not planned here:

- **Task Map visual rework** to match the reference HTML's look (you parked this).
- Ackermann from **kingpin distance**, and a steering-ratio output from rack travel and wheel turns (new formulas — need the workbook).
- **Olley optimum as a Validation target** row (a new row).
- **Two-account Realtime test** harness and **browser E2E tests** (new tooling) — would let P1-4 and the visual items be proven automatically.
- **Membership-based RLS** (only rows in `members` may read/write) as defence in depth beyond P0-2.
- **Security headers / CSP** — GitHub Pages can't set them; would need a proxy or a host change.
- Per-member private scenarios for the shared tools.
