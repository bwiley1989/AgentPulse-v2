const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.message || err.error || `API error ${res.status}`);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  seats?: number;
  source?: "live" | "mock";
  connected?: boolean;
  real?: boolean;
  connected_at?: string;
}

export interface ConnectTenantPayload {
  display_name: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
}

export interface TestResult {
  success: boolean;
  message: string;
}

export type Period = "D7" | "D30" | "D90";

export const api = {
  tenants: () => get<Tenant[]>("/tenants"),
  overview: (tid: string, period: Period = "D7") => get<any>(`/tenants/${tid}/overview?period=${period}`),
  agents: (tid: string, period: Period = "D7") => get<any>(`/tenants/${tid}/agents?period=${period}`),
  usage: (tid: string) => get<any>(`/tenants/${tid}/usage`),
  health: (tid: string) => get<any>(`/tenants/${tid}/health`),
  security: (tid: string) => get<any>(`/tenants/${tid}/security`),
  status: () => get<any>("/debug/status"),

  // Tenant management
  connectTenant: (payload: ConnectTenantPayload) =>
    post<Tenant>("/tenants", payload),
  disconnectTenant: (tid: string) =>
    del<{ status: string }>(`/tenants/${tid}`),
  testTenant: (tid: string, payload?: Partial<ConnectTenantPayload>) =>
    post<TestResult>(`/tenants/${tid}/test`, payload),
};
