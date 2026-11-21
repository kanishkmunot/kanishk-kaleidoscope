export function videoEmbed(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;

  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  const youtube = host === 'youtu.be' ? segments[0] :
    ['youtube.com', 'm.youtube.com'].includes(host) ?
      (segments[0] === 'watch' ? url.searchParams.get('v') :
        ['shorts', 'embed', 'live'].includes(segments[0]) ? segments[1] : undefined) : undefined;

  if (youtube && /^[\w-]{11}$/.test(youtube)) {
    return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${youtube}` };
  }
  const vimeo = host === 'vimeo.com' ? segments[0] :
    host === 'player.vimeo.com' && segments[0] === 'video' ? segments[1] : undefined;
  const hash = url.searchParams.get('h') || (host === 'vimeo.com' ? segments[1] : undefined);
  if (vimeo && /^\d+$/.test(vimeo)) {
    const suffix = hash && /^[a-zA-Z0-9]+$/.test(hash) ? `?h=${hash}` : '';
    return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${vimeo}${suffix}` };
  }
  return undefined;
}
