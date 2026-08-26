import { QueryClient } from "@tanstack/react-query";
import { BACKEND_URL } from "../config";

export const queryClient = new QueryClient();

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) message = parsed.error;
      else if (parsed.message) message = parsed.message;
    } catch (e) {
      // ignore
    }
    throw new Error(message);
  }
  return res;
}
