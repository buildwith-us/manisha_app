# UI refresh — what is left

Continues the pass in `.claude/skills/emil-design-eng`. Motion, press feedback,
skeletons and reduce-motion gating are **done app-wide**. What remains is the
visual/consistency refresh on the screens below.

## Rules that still apply

- **Do not change `theme/index.ts`** — no new colours, no new spacing values.
- Reuse `ui.tsx` primitives rather than hand-rolling equivalents.
- Motion values come from `theme/motion.ts`, never invented.
- Work **screen by screen**, not with a regex sweep. Two sweeps in the last
  session broke things (`PressableScale` swallowing function styles;
  `AdminDashboard` losing a closing tag) because the edits were mechanical.
- After each screen: `npx tsc --noEmit`, then look at it on a device.

## Remaining screens

| Screen | What to do |
| --- | --- |
| `AdminProductsScreen` | Header nests a row with a trailing action. Convert to `LargeTitle` using its `right` prop — a substitution will not work, it needs a restructure. |
| `ProductDetailScreen` | Hero is full-bleed with `edges={[]}`, so scrolled content passes under the status bar and the title collides with the clock. Needs a scrim or a collapsing bar. |
| `CartScreen` | Already on `LargeTitle`. Check the line-item rows use `ListRow` rather than bespoke markup. |
| `CheckoutScreen` | Address / payment / summary blocks are hand-built; `Group` + `Row` cover most of it. |
| `OrderDetailScreen`, `AdminOrderDetailScreen` | Status timeline is bespoke. Consider `StatusPill` + `ListRow` for the item lines. |
| `AddressesScreen`, `AddressFormScreen` | Selection rows should be `SelectRow`; the form should use `FieldRow` throughout. |
| `FiltersScreen` | Modal sheet — check the grabber, spacing scale and that it uses `Segmented`/`Chip`. |
| `ProfileScreen` | The form behind Account. Should mirror `AddressFormScreen` once that is settled. |
| `OrderConfirmationScreen` | One-off success layout; align its spacing to the 8px scale. |
| `WholesalePendingScreen` | Bespoke timeline; same treatment as order detail. |
| `AdminCategoriesScreen`, `AdminProductFormScreen` | Consistency only — admin redesign is out of scope. |

## Not visually verified

Everything except Home, Orders, Saved and the catalogue grid. Nothing after
commit `b6704ef` has been seen running.

## Blocking

**Redeploy Render from `pavi`.** Sign-in on the deployed backend is refused
because the OTP allowlist is committed but not deployed, so no signed-in screen
— Cart, Checkout, Orders, Account, or anything admin — can be reached to check.
The same deploy also switches on reviews, storefront visibility and the
hardcoded admin numbers, all committed and tested but currently unobservable.

Do this before more UI work: adding unverified UI on top of an unverifiable
stack is how the `PressableScale` layout bug reached a device.
