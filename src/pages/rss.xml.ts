import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { articleUrl, description, name, publishedPosts, summary } from '../lib/posts';

export const GET: APIRoute = async ({ site }) => rss({
  title: name,
  description,
  site: site!,
  items: (await publishedPosts()).map(post => ({
    title: post.data.title,
    description: summary(post),
    pubDate: post.date,
    link: articleUrl(post),
  })),
});
