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

// Neo Scientific OS — cold tech status colors
export const STATUS_COLORS: Record<string, string> = {
  '进行中': '#63b3ed',
  '暂停': '#ed8936',
  '已完成': '#48bb78',
  '待处理': '#718096',
  '待复验': '#b794f4',
  '成功': '#48bb78',
  '失败': '#fc8181',
  '高': '#fc8181',
  '中': '#ed8936',
  '低': '#718096',
};

export const STATUS_BG: Record<string, string> = {
  '进行中': 'rgba(99,179,237,0.12)',
  '暂停': 'rgba(237,137,54,0.12)',
  '已完成': 'rgba(72,187,120,0.12)',
  '待处理': 'rgba(113,128,150,0.12)',
  '待复验': 'rgba(183,148,244,0.12)',
  '成功': 'rgba(72,187,120,0.12)',
  '失败': 'rgba(252,129,129,0.12)',
  '高': 'rgba(252,129,129,0.12)',
  '中': 'rgba(237,137,54,0.12)',
  '低': 'rgba(113,128,150,0.12)',
};

export const FILE_ICONS: Record<string, string> = {
  xlsx: '📊', csv: '📊', pdf: '📕', docx: '📝', pptx: '📙',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', tiff: '🖼️', svg: '🖼️',
  py: '🐍', r: '📈', ipynb: '📓', fcs: '🔬', default: '📎',
};
