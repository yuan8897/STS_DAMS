const BASE_URL = '/api';

function getToken(): string | null {
  try {
    const auth = JSON.parse(localStorage.getItem('sts_dams_auth') || 'null');
    return auth?.token || null;
  } catch { return null; }
}

async function downloadCSV(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPayments(from: string, to: string): Promise<void> {
  const qs = `?from=${from}&to=${to}`;
  return downloadCSV(`/exports/payments${qs}`, `payments_${from}_${to}.csv`);
}

export function exportInventory(from: string, to: string): Promise<void> {
  const qs = `?from=${from}&to=${to}`;
  return downloadCSV(`/exports/inventory${qs}`, `inventory_${from}_${to}.csv`);
}

export function exportAuditLogs(from: string, to: string): Promise<void> {
  const qs = `?from=${from}&to=${to}`;
  return downloadCSV(`/exports/audit-logs${qs}`, `audit_logs_${from}_${to}.csv`);
}
