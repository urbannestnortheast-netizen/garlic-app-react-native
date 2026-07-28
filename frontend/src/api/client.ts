import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

let currentToken: string | null = null;

export async function loadToken() {
  const t = await AsyncStorage.getItem("auth_token");
  currentToken = t;
  return t;
}

export async function setToken(token: string | null) {
  currentToken = token;
  if (token) await AsyncStorage.setItem("auth_token", token);
  else await AsyncStorage.removeItem("auth_token");
}

export function getToken() {
  return currentToken;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function api<T = any>(
  path: string,
  opts: { method?: Method; body?: any; auth?: boolean } = {}
): Promise<T> {
  const method = opts.method || "GET";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth && currentToken) headers.Authorization = `Bearer ${currentToken}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const BACKEND_URL = BASE;
