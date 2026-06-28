import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'sts_dams_zoom';
const DEFAULT_ZOOM = 1.5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const CSS_VAR = '--app-zoom';

function getStoredZoom(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (isFinite(val) && val >= MIN_ZOOM && val <= MAX_ZOOM) return val;
    }
  } catch { /* localStorage blocked */ }
  return DEFAULT_ZOOM;
}

function applyZoom(level: number): void {
  document.documentElement.style.setProperty(CSS_VAR, String(level));
}

export function useZoom() {
  const [zoom, setZoomState] = useState(getStoredZoom);

  // 初始化 & zoom 变更时同步到 documentElement
  useEffect(() => {
    applyZoom(zoom);
  }, [zoom]);

  const persist = useCallback((val: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +val.toFixed(1)));
    setZoomState(clamped);
    try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch { /* noop */ }
  }, []);

  const zoomIn  = useCallback(() => persist(zoom + ZOOM_STEP), [zoom, persist]);
  const zoomOut = useCallback(() => persist(zoom - ZOOM_STEP), [zoom, persist]);
  const resetZoom = useCallback(() => persist(DEFAULT_ZOOM), [persist]);

  return { zoom, zoomIn, zoomOut, resetZoom };
}
