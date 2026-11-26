# Vercel multi-service deployment

This repository is configured as one Vercel project with two services:

- `web` (`apps/web`, Next.js): public frontend, served for all paths not claimed by the API rewrite.
- `api` (`apps/api`, FastAPI): public backend at `/api/*`; the FastAPI app already defines its endpoints under `/api/v1`, including `/api/docs`.

The API rewrite is ordered first and the web catch-all last. Frontend API requests use same-origin `/api/v1/...` URLs by default, so Vercel's top-level rewrite routes them to the API service. The browser-facing web code does not make server-to-server calls; therefore there are no service bindings. The API's PostgreSQL and Supabase integrations are external resources, not Vercel services, and do not get service bindings.

## Environment setup

Configure the API service's required secrets/settings in the Vercel project environment, including `DATABASE_URL` and any Supabase or feed credentials used by your deployment. Do not define `NEXT_PUBLIC_API_URL` in Vercel: leaving it unset keeps the web client on same-origin `/api/v1` and uses the public service rewrite. For local development with separately started Next.js and FastAPI processes, set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1` in the web build environment and allow the web origin in the API's `ALLOWED_ORIGINS`; alternatively, use `vercel dev` to exercise the configured service routing locally.

Vercel service bindings are runtime-only for functions, not build-time variables or middleware inputs. This setup does not use a binding because neither service makes a private server-to-server request to the other.

## Confirm deployment assumptions

Before treating this as final, confirm that the service names `api` and `web` are right, that both should be public (API on `/api/*`, web on all remaining paths), and that no API endpoints should remain internal. There are currently no service-to-service bindings. If the public API prefix or service visibility should differ, adjust `vercel.json` and the frontend API base path together.
