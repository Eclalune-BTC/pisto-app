import { realtimeServerMessageSchema } from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

export type RealtimeStatus = "connecting" | "live" | "offline";

const heartbeatMs = 25_000;
const maxRetryMs = 30_000;
// Several notices from one burst of writes become one refetch.
const coalesceMs = 300;

export function realtimeUrl(apiUrl: string): string {
  return `${apiUrl.replace(/^http/, "ws")}/v1/realtime`;
}

function parseMessage(data: unknown) {
  if (typeof data !== "string") return null;
  try {
    const parsed = realtimeServerMessageSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function openSocket(url: string): Promise<WebSocket> {
  if (Platform.OS === "web") return new WebSocket(url);
  // Native requests have no browser cookie jar; React Native's WebSocket accepts headers instead.
  const cookie = await authClient.getCookie();
  const NativeWebSocket = WebSocket as unknown as new (
    url: string,
    protocols: undefined,
    options: { headers: Record<string, string> },
  ) => WebSocket;
  return new NativeWebSocket(url, undefined, { headers: cookie ? { Cookie: cookie } : {} });
}

/**
 * Keeps one socket open for the active business. When any device commits a change to that
 * business, its cached queries (keyed `[area, businessId, ...]`) are refetched.
 */
export function useBusinessChanges(businessId: string | undefined): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("offline");

  useEffect(() => {
    if (!businessId) return;
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refetch: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let stopped = false;

    const connect = async () => {
      setStatus("connecting");
      const opened = await openSocket(realtimeUrl(env.apiUrl));
      if (stopped) {
        opened.close(1000);
        return;
      }
      socket = opened;
      opened.onopen = () => {
        attempts = 0;
        heartbeat = setInterval(() => opened.send(JSON.stringify({ type: "ping" })), heartbeatMs);
      };
      opened.onmessage = (event) => {
        const message = parseMessage(event.data);
        if (!message || message.type === "pong" || message.businessId !== businessId) return;
        if (message.type === "ready") {
          setStatus("live");
          return;
        }
        clearTimeout(refetch);
        refetch = setTimeout(() => {
          void queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[1] === businessId,
          });
        }, coalesceMs);
      };
      opened.onclose = () => {
        clearInterval(heartbeat);
        setStatus("offline");
        if (!stopped) retry = setTimeout(connect, Math.min(maxRetryMs, 1_000 * 2 ** attempts++));
      };
    };

    void connect();
    return () => {
      stopped = true;
      clearInterval(heartbeat);
      clearTimeout(retry);
      clearTimeout(refetch);
      socket?.close(1000);
      setStatus("offline");
    };
  }, [businessId, queryClient]);

  return status;
}
