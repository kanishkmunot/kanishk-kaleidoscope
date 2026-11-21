import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkEditorialMedia } from './src/lib/remark-media.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://kanishkmunot.github.io',
  base: process.env.SITE_BASE ?? '/kanishk-kaleidoscope',
  trailingSlash: 'always',
  build: { format: 'directory' },
  image: { layout: 'constrained', responsiveStyles: true },
  markdown: { processor: unified({ remarkPlugins: [remarkEditorialMedia] }) },
});
