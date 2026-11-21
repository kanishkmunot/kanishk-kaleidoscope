import { getCollection, type CollectionEntry } from 'astro:content';
import { unsplashCover } from './cover-credit';
import type { ImageMetadata } from 'astro';

export const name = "Kanishk's Kaleidoscope";
export const description = 'A personal blog about ideas, experiences, and different ways of seeing things.';
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path = '') => `${base}/${path.replace(/^\/+/, '')}`;
export const articleUrl = (post: CollectionEntry<'posts'>) => url(`posts/${post.id}/`);
export const formatDate = (date: Date) => new Intl.DateTimeFormat('en', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
}).format(date);

export async function publishedPosts() {
  const posts = await getCollection('posts', ({ data }) => data.status === 'Published');
  return posts
    .map(post => ({ ...post, date: post.data.published! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));
}

export function summary(post: CollectionEntry<'posts'>) {
  return post.data.description || post.data.subtitle || undefined;
}

const media = import.meta.glob<{ default: ImageMetadata }>('/media/*.{png,jpg,jpeg,webp,gif,avif}', { eager: true });

export function coverImage(post: CollectionEntry<'posts'>) {
  if (!post.data.cover) return undefined;
  if (post.data.coverCredit && unsplashCover(post.data.cover, 1200)) return post.data.cover;
  const path = post.data.cover;
  const cover = media[path]?.default || Object.entries(media).find(([key]) => encodeURI(key) === path)?.[1].default;
  if (!cover && post.data.status === 'Published') {
    console.warn(`Missing cover for ${post.id}: ${post.data.cover}`);
  }
  return cover;
}
