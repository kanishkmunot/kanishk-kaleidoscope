import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { readCoverCredit } from './lib/cover-credit';
import { z } from 'astro/zod';

const optionalText = z.string().trim().nullish().transform(value => value || undefined);

const posts = defineCollection({
  loader: glob({ base: './content/posts', pattern: '*.md' }),
  schema: z.object({
    title: z.string().trim().min(1),
    subtitle: optionalText,
    description: optionalText,
    published: z.union([z.string(), z.date()]).nullish().transform((value, context) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        context.addIssue({ code: 'custom', message: 'Enter a valid publication date.' });
        return z.NEVER;
      }
      return date;
    }),
    status: z.enum(['Draft', 'Published']).default('Draft'),
    featured: z.boolean().nullish(),
    cover: optionalText,
    coverAlt: optionalText,
    coverCaption: optionalText,
    coverCredit: z.unknown().optional().transform(readCoverCredit),
    videos: z.array(z.object({ url: z.url(), title: z.string().trim().min(1) })).nullish(),
  }).superRefine((post, context) => {
    if (post.status === 'Published' && !post.published) {
      context.addIssue({ code: 'custom', path: ['published'], message: 'Published posts need a publication date.' });
    }
    if (post.status === 'Published' && post.cover && !post.coverAlt) {
      context.addIssue({ code: 'custom', path: ['coverAlt'], message: 'Describe the cover image before publishing.' });
    }
  }),
});

export const collections = { posts };
