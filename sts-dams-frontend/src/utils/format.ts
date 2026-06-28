/**
 * 通用格式化工具函数
 * 从 mock/data.ts 提取，供页面组件使用
 */

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return `${d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}
