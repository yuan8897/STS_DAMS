import { get } from './client';

export interface HealthDetailed {
  status: string;
  timestamp: string;
  database: {
    name: string;
    recoveryModel: string;
    tables: number;
    triggers: number;
    views: number;
    estimatedRows: number;
    files: { FileName: string; FileType: string; SizeMB: number; MaxSize: string; Growth: string }[];
    activeConnections: number;
  };
  pool: {
    size: number | string;
    available: number | string;
    pending: number | string;
    borrowed: number | string;
  };
  websocket: {
    total_users: number;
    total_connections: number;
  };
  system: {
    platform: string;
    arch: string;
    cpus: number;
    totalMemoryMB: number;
    freeMemoryMB: number;
    memoryUsagePercent: number;
    uptime: string;
    nodeVersion: string;
    processMemoryMB: number;
  };
  alerts: {
    count: number;
    message: string;
  };
}

export interface HealthQuick {
  status: 'healthy' | 'degraded';
  checks: {
    database: boolean;
    websocket: boolean;
    uptime: string;
  };
  timestamp: string;
}

export function getHealthDetailed(): Promise<HealthDetailed> {
  return get('/health/detailed');
}

export function getHealthQuick(): Promise<HealthQuick> {
  return get('/health/quick');
}
