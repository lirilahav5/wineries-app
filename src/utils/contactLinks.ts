export function normalizeUrl(url: string): string {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function formatPhoneForTel(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

export function openWazeNavigation(lat: number, lng: number): void {
  window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
}
