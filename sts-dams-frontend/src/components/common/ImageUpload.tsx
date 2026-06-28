import React, { useRef, useState } from 'react';
import { getToken } from '../../store/auth';
import { showToast } from './Toast';

interface ImageUploadProps {
  /** 当前图片 URL */
  currentUrl?: string;
  /** 上传目标端点: 'script-cover' | 'dm-avatar' */
  uploadType: 'script-cover' | 'dm-avatar';
  /** 目标实体 ID（剧本 ID 或 DM 用户 ID） */
  entityId: number;
  /** 上传成功回调 */
  onUploaded: (url: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 图片容器高度 */
  height?: string;
  /** 占位文案 */
  placeholder?: string;
}

const PLACEHOLDER_MAP: Record<string, string> = {
  'script-cover': '📚 上传剧本封面',
  'dm-avatar': '👤 上传 DM 头像',
};

export const ImageUpload: React.FC<ImageUploadProps> = ({
  currentUrl,
  uploadType,
  entityId,
  onUploaded,
  disabled = false,
  height = 'h-48',
  placeholder,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview || currentUrl;
  const defaultPlaceholder = placeholder || PLACEHOLDER_MAP[uploadType] || '📷 上传图片';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 客户端校验
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('仅支持 JPG/PNG/GIF/WebP/BMP 格式', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片大小不能超过 5MB', 'error');
      return;
    }

    // 本地预览
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // 上传
    setUploading(true);
    try {
      const formData = new FormData();
      const fieldName = uploadType === 'script-cover' ? 'cover' : 'avatar';
      formData.append(fieldName, file);

      const token = getToken();
      const endpoint =
        uploadType === 'script-cover'
          ? `/api/upload/script-cover/${entityId}`
          : `/api/upload/dm-avatar/${entityId}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.status === 401) {
        localStorage.removeItem('sts_dams_auth');
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any)?.error || `上传失败 (${res.status})`);
      }

      const data = await res.json();
      onUploaded(data.url);
      showToast('上传成功', 'success');
    } catch (err: any) {
      showToast(err.message || '上传失败', 'error');
      setPreview(null); // 清除失败预览
    } finally {
      setUploading(false);
      // 重置 input 以允许重复上传同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    try {
      const token = getToken();
      await fetch('/api/upload/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: currentUrl }),
      });
    } catch {
      // 删除失败不阻塞前端
    }
    setPreview(null);
    onUploaded('');
    showToast('已移除图片', 'success');
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 预览区域 */}
      <div
        className={`${height} w-full rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-gray-50 transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-accent-purple hover:bg-purple-50'
        } ${displayUrl ? 'border-solid border-gray-200' : 'border-gray-300'}`}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="预览"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="text-center text-gray-400">
            <div className="text-3xl mb-2">
              {uploadType === 'script-cover' ? '📚' : '👤'}
            </div>
            <p className="text-sm">{uploading ? '上传中...' : defaultPlaceholder}</p>
            <p className="text-xs mt-1 text-gray-300">支持 JPG/PNG/GIF/WebP，最大 5MB</p>
          </div>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary text-xs px-4 py-1.5"
          disabled={disabled || uploading}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          {uploading ? '⏳ 上传中...' : '📷 选择图片'}
        </button>
        {currentUrl && (
          <button
            type="button"
            className="btn-danger text-xs px-4 py-1.5"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
          >
            🗑️ 移除
          </button>
        )}
      </div>
    </div>
  );
};
