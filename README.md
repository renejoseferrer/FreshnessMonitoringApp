# Expiration Monitoring App

This app now runs as a React frontend backed by Supabase Auth, Postgres, Storage, and an Edge Function for operator account management.

The old JSON-file backend is no longer the primary data path. The Node server in [server/index.js](server/index.js) now only serves the built frontend for simple hosting.

## What moved to Supabase

- Auth: developer and operator sign-in now use Supabase Auth email/password accounts.
- Database: dashboard items, product catalog, profiles, and activity history now live in Supabase Postgres.
- Storage: product photos upload to a public Supabase Storage bucket.
- Admin actions: creating, disabling, and deleting operator auth users now run through a Supabase Edge Function.

## Local setup

1. Install dependencies.

```bash
npm install
```

2. Create a Supabase project.

3. Run the SQL migration in [supabase/migrations/20260405_initial_supabase.sql](supabase/migrations/20260405_initial_supabase.sql).

4. Decide whether you want to use the default Edge Function admin key or a custom secret key.

Hosted Supabase Edge Functions already expose `SUPABASE_SERVICE_ROLE_KEY` by default. That means you can deploy this app without adding any extra admin secret first.

Only add a custom secret if you specifically want this function to use a newer `sb_secret_...` key instead of the built-in default.

```bash
supabase secrets set SUPABASE_SECRET_KEY=your-supabase-secret-key
```

If your project still uses the older naming, `SUPABASE_SERVICE_ROLE_KEY` also works. Newer Supabase projects often show this as a secret key that starts with `sb_secret_`.

Set the shared password used for newly created operator accounts in the Edge Function secret store:

```bash
supabase secrets set OPERATOR_SHARED_PASSWORD=your-shared-staff-password
```

5. Deploy the operator admin function.

```bash
supabase functions deploy admin-operators --no-verify-jwt
```

6. Copy [.env.example](.env.example) to `.env.local` and fill in the Supabase values.

Required variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PRODUCT_BUCKET`
- `VITE_SUPABASE_ADMIN_OPERATORS_FUNCTION`

Do not put your `sb_secret_...` admin key in `.env.local` or any `VITE_*` variable. That key is only for the Edge Function secret store.

7. Create the first developer user in Supabase Auth.

Use the Supabase dashboard or CLI to create the user, then promote that profile in SQL:

```sql
update public.profiles
set role = 'developer', display_name = 'Developer'
where email = 'your-developer-email@example.com';
```

8. Start the frontend.

```bash
npm run dev:shared
```

## Production build

```bash
npm run build
npm run start
```

Then open `http://localhost:4000`.

## Install as a PWA

The app is configured as an installable Progressive Web App. On a supported phone or desktop browser, open the deployed HTTPS site and use the browser's **Install app** or **Add to Home Screen** option.

The service worker caches the built app shell and static assets for faster startup and basic offline loading. Supabase authentication and data still require a network connection; user data and API responses are not cached offline.

## Deploy on Vercel

Import this GitHub repository into Vercel. Vercel detects Vite automatically; use:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm ci`

Set these environment variables for the Vercel deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PRODUCT_BUCKET=product-photos`
- `VITE_SUPABASE_ADMIN_OPERATORS_FUNCTION=admin-operators`

Set the variables for Production (and Preview if you want preview deployments to connect to Supabase), then redeploy. Do not put a Supabase service-role or secret key in Vercel frontend variables. Add the deployed Vercel domain to the Supabase Auth site's allowed URL and redirect URL settings.

The included [vercel.json](vercel.json) provides SPA route fallback and avoids stale service-worker and manifest responses. The service worker only precaches static build assets.

## Other hosting

The app can still be hosted on Render or another static host that supports build-time `VITE_*` environment variables. The [render.yaml](render.yaml) configuration is retained for existing Render deployments.

## Supabase notes

- The SQL migration creates a public storage bucket called `product-photos`.
- Product photos are uploaded from the browser, so the bucket policies must remain in place.
- Activity history shows the last 7 days.
- Operator creation, disable/enable, and deletion require the deployed `admin-operators` Edge Function.
- Newly created operator accounts use the `OPERATOR_SHARED_PASSWORD` Edge Function secret automatically.
- The `admin-operators` function verifies the developer session itself, so deploy it with `--no-verify-jwt`.
- The Edge Function accepts either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.

## Development notes

- `npm run dev:shared` now runs Vite with `--host` for device testing on the local network.
- `npm run start` only serves the built frontend. It does not run a custom application API anymore.

### Local credentials

Keep your actual credentials in `.env.local`, which is ignored by git.

You can start from `.env.example`, then set your own values for:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PRODUCT_BUCKET`
- `VITE_SUPABASE_ADMIN_OPERATORS_FUNCTION`

The developer account signs in with a Supabase Auth email/password account. Operator accounts are also Supabase Auth users, and new operators automatically receive the shared password configured in the `OPERATOR_SHARED_PASSWORD` Edge Function secret.

### Local network testing

Because the frontend runs with `--host`, you can also open the Vite URL from another device on the same network and test shared data there.

### Deploy on Render

This repo includes `render.yaml` for a single Render web service.

Render should be configured with:

- build command: `npm ci && npm run build`
- start command: `npm run start`
- health check path: `/health`

Set these environment variables in Render:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PRODUCT_BUCKET=product-photos`
- `VITE_SUPABASE_ADMIN_OPERATORS_FUNCTION=admin-operators`
- `PORT=4000`

Render is only hosting the app shell. Auth, database, storage, and operator management all run through Supabase.

Do not set the old local-backend variables like `DEV_USERNAME`, `DEV_PASSWORD`, `STAFF_PASSWORD`, `JWT_SECRET`, or `DATA_DIR` for this Supabase deployment.

The old GitHub Pages flow is not the intended default anymore, but any static host that can inject the `VITE_*` values at build time will also work.

- Render will give you a public URL after the first successful deploy.

Because the data now lives in Supabase, Render restarts do not wipe your expiration data.
