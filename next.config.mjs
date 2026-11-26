// Plain JavaScript on purpose: Hostinger's build server has an old glibc, so
// Next's native compiler cannot load there and a TypeScript config fails to load.

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
