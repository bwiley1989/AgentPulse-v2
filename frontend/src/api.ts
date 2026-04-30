const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  seats: number;
}

export const api = {
  tenants: () => get<Tenant[]>("/tenants"),
  overview: (tid: string) => get<any>(`/tenants/${tid}/overview`),
  agents: (tid: string) => get<any>(`/tenants/${tid}/agents`),
  usage: (tid: string) => get<any>(`/tenants/${tid}/usage`),
  health: (tid: string) => get<any>(`/tenants/${tid}/health`),
  security: (tid: string) => get<any>(`/tenants/${tid}/security`),
  status: () => get<any>("/debug/status"),
};
