# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Single-Service Deployment

This app is now set up to run the React frontend and the Express API together in one Node service.

Recommended host: Render.

The production deployment flow is:

- Render builds the frontend with `npm run build`
- the Express server in `server/index.js` serves the built `dist/` files
- API routes continue to run from the same service under `/api`
- shared data is stored in `store.json` on a persistent disk mounted by the host

### Start the app locally

Run:

```bash
npm run dev:shared
```

This starts:

- the Vite frontend
- the local API on port `4000`

### Start the production-style server locally

Run:

```bash
npm run build
npm run start
```

Then open `http://localhost:4000`.

### Local credentials

Keep your actual credentials in `.env.local`, which is ignored by git.

You can start from `.env.example`, then set your own values for:

- `DEV_USERNAME`
- `DEV_PASSWORD`
- `STAFF_PASSWORD`

The developer account can create operator usernames inside the app. Operators sign in with their own username and the shared staff password.

### Storage used by the hosted backend

For the one-platform deployment, the backend keeps using the current JSON store, but it writes it to a persistent disk instead of your local workspace.

- local development storage: `server/data/store.json`
- hosted storage: `store.json` on the platform disk mounted through `DATA_DIR`

This is the quickest way to get both frontend and backend live on one platform with the current code.

For a higher-reliability production setup later, move the data layer to Postgres.

### Local network testing

Because the frontend runs with `--host`, you can also open the Vite URL from another device on the same network and test shared data there.

### Deploy on Render

This repo includes `render.yaml` for a single Render web service.

Render should be configured with:

- build command: `npm ci && npm run build`
- start command: `npm run start`
- health check path: `/api/health`
- persistent disk mounted at `/var/data`

Set these environment variables in Render:

- `DEV_USERNAME`
- `DEV_PASSWORD`
- `STAFF_PASSWORD`
- `JWT_SECRET`
- `DATA_DIR=/var/data`

The old GitHub Pages flow is no longer the intended deployment target for this app because the backend must run with the frontend.
