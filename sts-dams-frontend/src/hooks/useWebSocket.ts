/**
 * STS-DAMS WebSocket Hook
 *
 * 自动连接 WebSocket 服务器，接收实时推送通知。
 * 替代原来的 60s 轮询 refreshInterval 模式。
 * 重连策略：指数退避 (1s → 2s → 4s → 8s → ... → 30s max) + 随机 jitter
 *
 * 用法：
 *   const { lastMessage, connected } = useWebSocket();
 *   useEffect(() => { if (lastMessage) handlePush(lastMessage); }, [lastMessage]);
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentUser } from '../store/auth';

interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

interface UseWebSocketOptions {
  /** 初始重连间隔 (ms)，默认 1000 */
  initialReconnectInterval?: number;
  /** 最大重连间隔 (ms)，默认 30000 */
  maxReconnectInterval?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

/** 指数退避 + 随机 jitter（避免惊群效应） */
function backoffDelay(baseMs: number, attempt: number, maxMs: number): number {
  const exp = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  // 添加 ±25% 随机 jitter
  const jitter = exp * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { initialReconnectInterval = 1000, maxReconnectInterval = 30000, enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    const user = getCurrentUser();
    const auth = JSON.parse(localStorage.getItem('sts_dams_auth') || 'null');
    const token = auth?.token;
    if (!token || !user) return;

    // 用当前页面的 host 和 protocol 推导 WebSocket URL（自动适配反向代理场景）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = window.location.port ? `:${window.location.port}` : '';
    const wsUrl = `${protocol}//${window.location.hostname}${port}/ws?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        attemptRef.current = 0; // 连接成功，重置退避计数器
        console.log('[WebSocket] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          setLastMessage(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // 指数退避重连
        const delay = backoffDelay(initialReconnectInterval, attemptRef.current, maxReconnectInterval);
        attemptRef.current++;
        console.log(`[WebSocket] Disconnected, reconnecting in ${delay}ms (attempt ${attemptRef.current})`);
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      // WebSocket constructor can throw if URL is invalid
      const delay = backoffDelay(initialReconnectInterval, attemptRef.current, maxReconnectInterval);
      attemptRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    }
  }, [enabled, initialReconnectInterval, maxReconnectInterval]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected, lastMessage };
}
