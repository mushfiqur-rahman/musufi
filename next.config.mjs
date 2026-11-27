// Plain JavaScript on purpose: Hostinger's build server has an old glibc, so
// Next's native compiler cannot load there and a TypeScript config fails to load.

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentFeedback: false,
    // Product photos are uploaded through a Server Action; they are resized in the
    // browser first (max ~1.5 MB), so 2 MB leaves headroom without inviting abuse.
    serverActions: { bodySizeLimit: "2mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
