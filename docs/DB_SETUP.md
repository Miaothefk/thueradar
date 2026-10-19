# ThueRadar — Database setup and safe migration guide

This document explains how to safely provision a PostgreSQL database, configure the project to use it, and run Prisma code generation and migrations without risking production data.

IMPORTANT: Never run migrations against a production database without backups and a migration plan. Prefer `prisma migrate deploy` in CI/CD targeting a controlled environment.

## 1) Choose a database

Options:
- Managed Postgres (recommended) — e.g. Cloud provider managed Postgres (AWS RDS, Azure Database for PostgreSQL, DigitalOcean Managed DB)
- Local Postgres for development — install Postgres and create a dev database

## 2) Provision a database and get a connection string

Example DATABASE_URL:

postgresql://<username>:<password>@<host>:5432/<database>?schema=public

Save it securely (do NOT commit to git). In development, create a `.env` file with:

DATABASE_URL="postgresql://user:pass@localhost:5432/thueradar_dev?schema=public"

## 3) Generate Prisma client (safe, read-only step)

With DATABASE_URL set in your environment, run:

npx prisma generate

This will create the Prisma client locally. This step does not modify the database.

## 4) Validate migration SQL and run safely

A non-destructive migration SQL has been prepared at `prisma/migrations/`.

To apply migrations on a disposable/dev DB:

1. Ensure `DATABASE_URL` points to a safe development DB.
2. Run `npx prisma migrate deploy` or `npx prisma migrate dev --name init` for interactive mode.

Do NOT run migrations against production unless you have:
- backups
- tested migrations on a staging environment
- a rollback plan

## 5) Seed / create admin user (opt-in)

Creating an initial admin user should be explicit and manual. A recommended approach:

1. Connect to the DB with psql or a GUI and insert a user with a hashed password (use the app's `hashPassword` util to prepare the password hash).
2. Or run a one-off script that checks for `ADMIN_SEED=true` and aborts otherwise.

## 6) Running the app locally

Once `DATABASE_URL` is set and `npx prisma generate` succeeded, start the app:

npm run dev

The server will connect to the DB. API routes are protected and will respond with 503 if the DB is not configured.

## 7) CI/CD recommendations

- Use `npx prisma migrate deploy` in your deployment pipeline.
- Keep migrations in source control; review SQL before applying.
- Run `npx prisma generate` as part of the build step.
- Store DATABASE_URL in the deployment platform's secret store.

If assistance is needed to provision a Postgres instance or an example `docker-compose.yml` for local development, reply and indicate preference (managed provider or local Docker).