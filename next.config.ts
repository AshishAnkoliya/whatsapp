import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - Next.js 15 might have type mismatches but this is the valid key for Dev Origins
  allowedDevOrigins: ['192.168.2.19', 'localhost:3000'],
};

export default nextConfig;
