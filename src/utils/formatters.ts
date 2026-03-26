export const generateId = () => Math.random().toString(36).substr(2, 9);

export const now = () => new Date().toISOString().slice(0, 10);

export const formatDate = (d: string | undefined) => {
  if (!d) return '';
  const date = new Date(d);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

export const STATUS_COLORS: Record<string, string> = {
  '进行中': '#2563eb', '暂停': '#d97706', '已完成': '#059669',
  '待处理': '#6b7280', '待复验': '#8b5cf6', '成功': '#059669', '失败': '#dc2626',
  '高': '#dc2626', '中': '#d97706', '低': '#6b7280',
};

export const STATUS_BG: Record<string, string> = {
  '进行中': '#dbeafe', '暂停': '#fef3c7', '已完成': '#d1fae5',
  '待处理': '#f3f4f6', '待复验': '#ede9fe', '成功': '#d1fae5', '失败': '#fee2e2',
  '高': '#fee2e2', '中': '#fef3c7', '低': '#f3f4f6',
};

export const FILE_ICONS: Record<string, string> = {
  xlsx: '📊', csv: '📊', pdf: '📕', docx: '📝', pptx: '📙',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', tiff: '🖼️', svg: '🖼️',
  py: '🐍', r: '📈', ipynb: '📓', fcs: '🔬', default: '📎',
};
