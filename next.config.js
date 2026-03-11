/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",   // ← this line is what was missing
};
module.exports = nextConfig;