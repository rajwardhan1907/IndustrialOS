// lib/paddle.ts
// Lazy helper — returns base URL and auth header for Paddle Billing REST API.
// Set PADDLE_SANDBOX=true in .env.local to hit the sandbox environment.

export function getPaddleConfig(): { baseUrl: string; apiKey: string } {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is not set. Add it to your environment variables.");
  }
  const sandbox = process.env.PADDLE_SANDBOX === "true";
  const baseUrl = sandbox
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
  return { baseUrl, apiKey };
}
