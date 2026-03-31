# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local Shared Login Test Mode

This project now includes a local Express API so you can test shared data and username login before deploying anything.

### Start the app locally

Run:

```bash
npm run dev:shared
```

This starts:

- the Vite frontend
- the local API on port `4000`

### Local credentials

Keep your actual credentials in `.env.local`, which is ignored by git.

You can start from `.env.example`, then set your own values for:

- `DEV_USERNAME`
- `DEV_PASSWORD`
- `STAFF_PASSWORD`

The developer account can create operator usernames inside the app. Operators sign in with their own username and the shared staff password.

### Local network testing

Because the frontend runs with `--host`, you can also open the Vite URL from another device on the same network and test shared data there.

### Important

This setup is for local testing only. GitHub Pages cannot run the backend in `server/`, so deployment will need a hosted backend later.
