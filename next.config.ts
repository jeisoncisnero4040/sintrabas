import type { NextConfig } from 'next';

const config: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  logging: {
    incomingRequests: { ignore: [/^\/api\/v1\/auth\/oauth\/[^/]+\/callback(?:\?|$)/] },
  },
};

export default config;
