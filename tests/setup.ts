// Runs before every test file.
// Uses the real DATABASE_URL from .env.local — tests hit a real DB.
// Each test cleans up after itself so they don't pollute each other.
import { config } from "dotenv";
config({ path: ".env.local" });
