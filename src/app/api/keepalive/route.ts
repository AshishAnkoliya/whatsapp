import { GET as healthGET, POST as healthPOST, HEAD as healthHEAD } from '../health/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  return healthGET(request);
}

export async function POST(request: Request) {
  return healthPOST(request);
}

export async function HEAD(request: Request) {
  return healthHEAD(request);
}
