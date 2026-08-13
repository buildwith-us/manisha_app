# Manisha Fashions — Jewellery Ecommerce App

Implementation of **PRD v2.0 (React Native)**. Two packages:

| Package | Stack | What it is |
| --- | --- | --- |
| [`backend/`](backend/) | Node.js + Express + TypeScript, MongoDB (Mongoose), Redis | REST API — auth, catalog, cart, orders, payments, push, admin |
| [`mobile/`](mobile/) | Expo SDK 57 + React Native 0.86 + TypeScript, Redux Toolkit, React Navigation | Android + iOS client — customer flow *and* the in-app admin panel |

---

## Quick start

### 1. Dependencies

```bash
# MongoDB + Redis via Docker (or point .env at Atlas / a managed Redis)
docker compose up -d
```

No Docker? Install MongoDB locally, or leave `REDIS_URL` blank — the backend
falls back to an in-process store for OTP and rate-limit counters in
development (refused in production).

### 2. Backend

```bash
cd backend
cp .env.example .env      # then fill in the secrets — see "Configuration"
npm install
npm run seed              # categories, sample products, first admin account
npm run dev               # http://localhost:4000/api/v1
```

**Signing in.** `OTP_PROVIDER=fake` sends no SMS: `OTP_FAKE_CODE` (default
`123456`) is issued and accepted for *every* number, and is returned in the API
response as `devCode` so the app auto-fills it. This is a temporary stand-in
until the SMS module is chosen, and is refused when `NODE_ENV=production`.

**Admin access.** There is no separate admin login. Any number listed in
`ADMIN_PHONES` (default `+919345548984`) is signed in as an admin through the
ordinary **Retail** tab, and lands in the admin panel. To make some other number
an admin, add it to `ADMIN_PHONES`, or use `npm run set-role` (see below).

### 3. Mobile

```bash
cd mobile
npm install
npx expo start
```

The app resolves its API base URL in this order:

1. `extra.apiUrl` in [`mobile/app.json`](mobile/app.json)
2. `EXPO_PUBLIC_API_URL`
3. Platform default — `http://10.0.2.2:4000/api/v1` on the Android emulator,
   `http://localhost:4000/api/v1` elsewhere

> **Push notifications are currently unwired.** Firebase/FCM has been removed
> pending a replacement provider. Notifications are still created, stored and
> listed inside the app — only the OS-level banner is missing. Everything else
> works in Expo Go.

---

## Verifying it works

```bash
cd backend
npm run typecheck
npm run smoke
```

`npm run smoke` boots the real Express app against an **in-memory MongoDB** (no
Docker or Atlas needed) and asserts the PRD's rules end to end:

- OTP → JWT login; a wrong or expired code returns 401
- `wholesalePrice` is absent from every response for a retail account
- a pending wholesale account is blocked from browsing (403 `WHOLESALE_NOT_APPROVED`)
- approval unlocks wholesale pricing on the *existing* token
- staff are refused price changes but allowed stock changes
- COD checkout adds the flat shipping charge; `priceAtOrder` is frozen
- cancelling while "placed" restores stock; cancelling after "processing" is refused
- refresh-token rotation works and a reused token is rejected

The first run downloads a `mongod` binary (~270 MB) and is slow; later runs are fast.

```bash
cd mobile && npx tsc --noEmit
```

---

## First admin account

An account created by signing in through the app always starts as `retail`, and
every `/admin` route requires an admin to call it — so the first admin has to be
set from outside the API. Otherwise the admin panel is unreachable and each
admin write (adding a category, adding a product) comes back `403 FORBIDDEN`.

```bash
cd backend
npm run set-role -- +919999999999 admin
```

Roles are `admin`, `staff`, `retail`, `wholesale`. A bare 10-digit Indian number
is normalised to E.164. The account must exist first — sign in through the app
once, then run this. **Sign out and back in afterwards** so the app picks up the
new permission set.

`npm run seed` promotes `SEED_ADMIN_PHONE` too, but it upserts the sample
catalog at the same time — use `set-role` against a database that already holds
real products.

---

## Deployed backend (Render)

`https://manisha-fashion-backend.onrender.com/api/v1`

[`mobile/app.json`](mobile/app.json) points `extra.apiUrl` here, because an
installed APK cannot reach a laptop on `localhost`. Set it back to `null` for
local development.

### Environment variables to set on Render

| Key | Value | Why |
| --- | --- | --- |
| `UNSAFE_DEV_MODE` | `true` | **Required while `OTP_PROVIDER=fake`.** Production refuses the fake OTP and the in-process store without it, which is why sign-in returned `503 OTP provider is not configured for production`. |
| `OTP_PROVIDER` | `fake` | No SMS gateway is wired yet. |
| `OTP_FAKE_CODE` | `123456` | The code every number accepts. |
| `ADMIN_PHONES` | `+919345548984` | Signs that number in as admin — no separate admin login. |
| `MONGODB_URI` | Atlas SRV string | Render's DNS resolves SRV correctly, so the `mongodb+srv://` form is fine there. |
| `CLOUDINARY_*` | as in `.env` | Image upload. |

> ### ⚠️ `UNSAFE_DEV_MODE=true` means there is no real authentication
> Anyone who knows a phone number can sign in as that person with `123456` —
> **including the admin number**, which grants full control of the catalogue,
> orders and accounts. It is a pre-launch testing shortcut, not a login system.
> Set it to `false` the moment the SMS provider is wired, and treat the store as
> publicly writable until then.

Atlas must also allow Render's outbound IPs (or `0.0.0.0/0`) under
**Network Access**, or the API boots but every query times out.

---

## Troubleshooting

**`querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net`** — Node resolves
`mongodb+srv://` through c-ares using its *own* DNS server list, which can
differ from the system resolver. Compare them:

```bash
node -e "console.log(require('dns').getServers())"   # what Node uses
# PowerShell: Get-DnsClientServerAddress -AddressFamily IPv4
```

If Node reports something nothing is listening on (`127.0.0.1` is the usual
culprit), the SRV lookup fails even though `nslookup` resolves the record fine.
Use Atlas's **standard** (non-SRV) connection string — it names the shard hosts
directly and goes through the OS resolver, so it is unaffected:

```
mongodb://<user>:<pass>@<shard>-00-00.<id>.mongodb.net:27017,<shard>-00-01...:27017/<db>?ssl=true&replicaSet=<rs>&authSource=admin&retryWrites=true&w=majority
```

Atlas shows it under *Connect → Drivers → "I'll use the standard connection
string"*. The `replicaSet` and `authSource` values are also in the cluster's TXT
record (`Resolve-DnsName <cluster>.mongodb.net -Type TXT`).

**`EADDRINUSE :4000`** — a previous `npm run dev` is still holding the port.
`Get-NetTCPConnection -LocalPort 4000 -State Listen` gives you the PID to stop.

---

## Configuration

Everything lives in `backend/.env` (never committed — PRD §8.5). See
[`backend/.env.example`](backend/.env.example) for the full list.

| Group | Keys | Notes |
| --- | --- | --- |
| Database | `MONGODB_URI` | MongoDB Atlas M0 is sufficient at launch (PRD §8.2). |
| Cache | `REDIS_URL` | OTP storage + rate-limit counters. Required in production. |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS` | Long random values. `JWT_REFRESH_TTL_DAYS` is the admin-configurable idle period (default 90 — PRD §4.1). |
| OTP | `OTP_PROVIDER`, `OTP_FAKE_CODE`, `MSG91_*` | `fake` (no SMS, fixed code), `console` (random code, logged), `msg91` (live). See "OTP providers" below. |
| Admin | `ADMIN_PHONES` | Comma-separated numbers always signed in as admin. Removes the need for a separate admin login. |
| Images | `CLOUDINARY_*` | Without these, image upload returns 503; everything else works. |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Without these only COD is offered — the app hides the online option. |
| Push | *(none)* | Firebase removed. Notifications are persisted and shown in-app but not pushed to the OS. |
| Commerce | `COD_SHIPPING_CHARGE`, `PREPAID_SHIPPING_CHARGE` | **Integer paise** (`5000` = ₹50). Served to the app via `GET /config`. |

Every integration degrades gracefully: the API boots and reports what is wired
up at `GET /api/v1/health`.

### OTP providers

| Provider | Behaviour |
| --- | --- |
| `fake` | **Current default.** No SMS. `OTP_FAKE_CODE` (default `123456`) is issued for, and accepted from, every number. The per-number send cap is skipped so it does not get in the way of testing. Refused in production. |
| `console` | A random code, printed to the server log and returned as `devCode`. Refused in production. |
| `msg91` | Real SMS via MSG91. The only provider valid in production. |

`fake` is a deliberate placeholder until the SMS module is picked. Swapping
providers is a one-line `.env` change — nothing in the auth flow moves, because
send/verify stay server-side either way.

To add a provider, extend `dispatch()` in
[`services/otp.service.ts`](backend/src/services/otp.service.ts). A
*client-issued* scheme (where the SDK verifies the code on the device and hands
back an ID token) does not fit that seam — it needs a token-exchange endpoint
instead of `POST /auth/otp/verify`.

---

## Money

**Every monetary value in both packages is an integer number of paise** (₹1 =
100). No floats touch money anywhere. The mobile app converts at the edges only
—  [`mobile/src/utils/money.ts`](mobile/src/utils/money.ts).

---

## How the PRD maps to the code

### Request pipeline (§8.6)

The fixed order is assembled in [`backend/src/app.ts`](backend/src/app.ts) and
per-route in `backend/src/routes/*`:

```
Nginx (TLS, outside this process)
  → Express Router
  → Request Validation (Zod)         middleware/validate.ts
  → Rate Limiter                     middleware/rateLimiter.ts
  → JWT Authentication               middleware/authenticate.ts
  → Role & Permission Check (RBAC)   middleware/authorize.ts
  → Controller → Service → Repository → MongoDB
  → Response Formatter → JSON        middleware/responseFormatter.ts
```

### Price visibility (§4.2 / §8.4 / §8.8)

`wholesalePrice` is stripped **server-side** in exactly one place —
[`backend/src/serializers/product.serializer.ts`](backend/src/serializers/product.serializer.ts).
No route returns a raw Product document, so a modified client or an intercepted
request cannot surface wholesale pricing. Cart and order pricing read from the
same module, so the tier decision exists once.

### Role matrix (§8.9)

[`backend/src/utils/rbac.ts`](backend/src/utils/rbac.ts) is the single source of
truth, mirrored (for UI gating only) in
[`mobile/src/store/hooks.ts`](mobile/src/store/hooks.ts).

| Role | Access |
| --- | --- |
| Retail | Catalog, cart, checkout, own orders — retail pricing |
| Wholesale (approved) | As retail, plus wholesale pricing |
| Wholesale (pending/rejected) | **Login only** — empty permission set |
| Staff | Products, categories, order status, dashboard — no pricing, no approvals, no accounts |
| Admin | Everything, plus pricing, wholesale approvals, broadcasts, staff accounts |

A pending wholesale applicant's blocked state is enforced twice and
independently: the API returns 403 `WHOLESALE_NOT_APPROVED`, and
[`RootNavigator`](mobile/src/navigation/RootNavigator.tsx) mounts a stack that
has no route into the catalogue at all.

### Token lifecycle (§8.7 / §8.10)

- Tokens live in `expo-secure-store` (Keychain / Keystore), never AsyncStorage —
  [`mobile/src/api/tokenStorage.ts`](mobile/src/api/tokenStorage.ts)
- **The Axios interceptor attaches the access token to every request without
  exception** — the known gap in the previous Flutter client is closed by
  attaching centrally rather than per call:
  [`mobile/src/api/client.ts`](mobile/src/api/client.ts)
- On 401 `TOKEN_EXPIRED` the client refreshes once and retries; concurrent
  requests share one refresh promise rather than stampeding
- Refresh tokens **rotate** on use — a stolen token is usable at most once
- Logout revokes the refresh token server-side, not just on-device
- Role changes take effect on the next request: `authenticate` re-reads the user
  rather than trusting stale JWT claims

### Catalog performance (§8.3)

`expo-image` with explicit sizing, `cachePolicy="memory-disk"` and a blurhash
placeholder, inside a memoised `FlatList` cell with windowing — the PRD's stated
fix for the image lag in the Flutter build.

### Payments (§4.4)

Razorpay Checkout runs in a **WebView**
([`RazorpayCheckoutScreen`](mobile/src/screens/customer/RazorpayCheckoutScreen.tsx))
rather than a native module, so it works in Expo Go and a dev build alike. The
payment signature is verified server-side; the client never decides that a
payment succeeded. Stock is reserved at checkout and released if payment fails,
so a stalled payment cannot hold inventory. The webhook is idempotent and
authenticated by HMAC over the raw request body.

To swap in `react-native-razorpay` later, replace that one screen — the API
contract does not change.

---

## API surface

Base path `/api/v1`. All responses are `{ success, data, meta? }` or
`{ success: false, error: { code, message, details? } }`.

| Route | Purpose |
| --- | --- |
| `GET /health` | Liveness + which integrations are configured |
| `GET /config` | Currency, COD/prepaid shipping charges, Razorpay availability |
| `POST /auth/otp/send` · `/verify` · `/refresh` · `/logout` | Session lifecycle |
| `GET/PATCH /auth/me`, `/auth/addresses`, `/auth/devices` | Profile, addresses, FCM tokens |
| `GET/POST/PATCH/DELETE /products`, `/products/categories`, `/products/images` | Catalog + admin CRUD + Cloudinary upload |
| `GET/POST/PATCH/DELETE /cart`, `/wishlist` | Cart and save-for-later |
| `POST /orders/checkout`, `/orders/payment/confirm`, `GET /orders`, `POST /orders/:id/cancel` | Checkout and order tracking |
| `GET /notifications`, `POST /notifications/:id/read` | In-app notification list |
| `GET /admin/dashboard`, `/admin/orders`, `/admin/wholesale`, `/admin/users`, `POST /admin/notifications` | Admin panel |
| `POST /webhooks/razorpay` | Payment status webhook (HMAC-verified, outside the JWT pipeline) |

---

## Deviations from the PRD, and why

1. **The backend was built here, not carried over.** The PRD describes the
   Node/Express + MongoDB API as existing and "unchanged", but the repository
   was empty. It is implemented to match §8.2–§8.11 exactly. If a real deployed
   backend exists, reconcile the two before launch — §9 already calls for "a
   single canonical deployment".
2. **`fcmToken` is an array, not a single field** (§8.2). One customer with a
   phone and a tablet needs two tokens; a scalar silently drops the older
   device. Tokens are still collected so the replacement push provider has them
   ready, even though nothing delivers to them right now.
3. **Staff cannot *create* products, only edit them.** §8.9 gives staff "product
   management" but "no pricing changes", and creating a product always sets its
   retail price. Creation is therefore admin-only; staff retain stock, images,
   description, category and visibility. Flag this with the client alongside the
   other §6 open items.
4. **The wholesale price is optional, against §4.7's "both required".** The
   admin form adds a product at retail only, and a wholesale rate is set just
   for the products that have one — turned on by a toggle that then asks for the
   price. A product with no wholesale rate is not discounted: an approved
   wholesale buyer pays retail for it, and the order line records `retail` as
   the tier so the record matches what was charged. Retail price remains
   mandatory, and a supplied wholesale price still may not exceed it.
5. **Firebase/FCM has been removed** pending a replacement, so §4.6's push
   delivery is currently unwired. Notifications are still created, persisted and
   listed in-app; only the OS banner is missing. `deliver()` in
   `notification.service.ts` is the single seam a new provider plugs into.
6. **Addresses are embedded on the User document** rather than a separate
   collection — they are only ever read with their owner.
7. **`GET /config` was added** so the app can show the COD shipping charge
   before the order is placed, without hard-coding a figure the PRD lists as an
   open item.

## Still open (PRD §6 — needs client confirmation)

These are wired to be configurable rather than guessed:

- **COD shipping charge** — `COD_SHIPPING_CHARGE`, currently ₹50
- **Categories / products per category** — catalog is paginated and indexed for
  filter, sort and search, so the number is a capacity question, not a rebuild
- **Apple Developer Program account** — who owns and pays for it
- **Return/replacement policy text** — no in-app screen exists for it yet
- **Wholesale document upload** — `gstNumber` and `shopProofUrl` are accepted
  and shown to the approving admin, but not *required*; make them required in
  `auth.validator.ts` if the client wants that
- **Staff vs Admin split** — implemented as §8.9 recommends; confirm with client
- **Expo vs bare React Native** — built on Expo (managed, with dev builds for
  push); `npx expo prebuild` ejects to bare if a native module ever demands it

## Not built (explicitly out of scope, PRD §5)

Multi-vendor, in-app chat, multi-language, loyalty/referrals, web storefront,
and returns/refunds automation.
