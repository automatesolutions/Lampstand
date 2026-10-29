// A real Postgres (PGlite, in process) with the app's migrations, for testing row-level
// security and the Lamplighters functions. A small stand-in plays Supabase's part:
// the anon / authenticated roles, auth.users and auth.uid().

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const SUPABASE_STANDIN = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export interface TestDb {
  db: PGlite;
  /** Adds a person with an email account; returns their id. */
  user(email: string): Promise<string>;
  /** Runs as this person (null = signed out), through row-level security. */
  as<T = Record<string, unknown>>(userId: string | null, sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs as the database owner, bypassing row-level security (for setting up a test). */
  admin<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STANDIN);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  // One query at a time, so a role switch never leaks into another test's query.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  const admin = <T>(sql: string, params: unknown[] = []) =>
    serial(async () => {
      await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
      return (await db.query<T>(sql, params)).rows;
    });

  const as = <T>(userId: string | null, sql: string, params: unknown[] = []) =>
    serial(async () => {
      await db.query("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
      await db.exec(userId ? "set role authenticated" : "set role anon");
      try {
        return (await db.query<T>(sql, params)).rows;
      } finally {
        await db.exec("reset role");
      }
    });

  const user = async (email: string) => {
    const [row] = await admin<{ id: string }>("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
    return row.id;
  };

  return { db, user, as, admin };
}
