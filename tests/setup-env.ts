// Vitest global setup: load .env.local (then .env) into process.env so tests
// that import the validated `@/env` accessor (e.g. live integration tests that
// construct the Redis or engine client) have the required vars. dotenv does NOT
// override variables already present in process.env, so CI — which injects vars
// via the job environment / $GITHUB_ENV — takes precedence and a missing file is
// a harmless no-op. Pure/unit tests that mock `@/env` are unaffected.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
