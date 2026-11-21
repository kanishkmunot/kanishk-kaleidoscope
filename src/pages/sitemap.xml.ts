import type { APIRoute } from 'astro';
import { articleUrl, publishedPosts, url } from '../lib/posts';

export const GET: APIRoute = async ({ site }) => {
  const paths = [url(), ...(await publishedPosts()).map(articleUrl)];
  const entries = paths.map(path =>
    `<url><loc>${new URL(path, site).href.replaceAll('&', '&amp;')}</loc></url>`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
