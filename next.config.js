const nextConfig = {
  reactStrictMode: true,
  // FIX: removed output: "standalone" — that setting is for Docker/self-hosting only.
  // On Vercel it's unnecessary and can cause unexpected edge cases.
  serverExternalPackages: ['@react-pdf/renderer'],
};
module.exports = nextConfig;
