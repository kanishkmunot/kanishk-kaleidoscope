export interface CoverCredit {
  author: string;
  profile: string;
  page: string;
}

export function unsplashLink(value: string, path: 'profile' | 'photo') {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'unsplash.com' || url.username || url.password || url.port) return;
    if (path === 'profile' && !/^\/@[\w-]+\/?$/.test(url.pathname)) return;
    if (path === 'photo' && !/^\/photos\/[\w-]+\/?$/.test(url.pathname)) return;
    url.search = new URLSearchParams({ utm_source: 'kanishks_kaleidoscope', utm_medium: 'referral' }).toString();
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

export function readCoverCredit(value: unknown): CoverCredit | undefined {
  if (!value || typeof value !== 'object') return;
  const { author, profile, page } = value as Partial<CoverCredit>;
  if (typeof author !== 'string' || !author.trim() || typeof profile !== 'string' || typeof page !== 'string') return;
  const authorLink = unsplashLink(profile, 'profile');
  const photoLink = unsplashLink(page, 'photo');
  if (authorLink && photoLink) return { author: author.trim(), profile: authorLink, page: photoLink };
}

export function unsplashCover(value: string, width: number) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== 'images.unsplash.com' || url.username || url.password ||
        !/^\/photo-[\w-]+$/.test(url.pathname)) return;
    url.search = new URLSearchParams({
      auto: 'format', fit: 'crop', w: String(width), h: String(Math.round(width * 9 / 16)), q: '80',
    }).toString();
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}
