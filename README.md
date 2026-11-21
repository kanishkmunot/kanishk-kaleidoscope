# Kanishk's Kaleidoscope

A single-author publication built with Astro and GitHub Pages. The public site consists of static files. GitHub and Pages CMS manage writing and publishing.

## Write and publish

1. Open [Pages CMS](https://app.pagescms.org/) and sign in as `kanishkmunot`. On first use, install the Pages CMS GitHub App for **only** `kanishk-kaleidoscope`, then open the `main` branch. Keep GitHub write access and Pages CMS collaborators limited to the owner.
2. Under **Articles**, create an article. Enter your title and write in the visual editor. Save with **Draft** selected to keep it off the website. Save manually as you work. The editor displays your formatted content. For a preview of the actual website, run Astro locally and temporarily use **Published** on an uncommitted copy.
3. Select a **Publication date**, switch the status to **Published**, and save. A commit to `main` triggers the **Publish blog** workflow in the repository’s **Actions** tab. Leave the filename in place when changing a title to preserve the article’s URL.
4. For edits, open the article and save it again. Switch back to **Draft** to unpublish, or use the article’s delete control to remove it from the next build.

**Draft privacy:** Drafts are excluded from the deployed site, RSS and sitemap, but the source code, Markdown, uploads and commit history are public on GitHub. Keep confidential drafts and images on your device until you want them public. Unpublishing or deleting an article removes its live page after deployment. Copies can remain in repository history and external caches.

## Add media

- Use the editor’s image control to insert or upload JPG, PNG, WebP, AVIF or GIF. Add alternative text. A Markdown image title can serve as its caption in Source mode, for example `![A view of the river](/media/river.jpg "At dusk")`. Save after editing Source mode to preserve caption syntax.
- Set an optional **Cover image** for the homepage and article header. Enter **Cover image alt text** and an optional caption.
- In **Videos**, add a YouTube or Vimeo link and an accessible title. The player appears below the article, alongside a link readers can open directly. Videos must allow external playback to work in the embedded player.

## Publish directly on GitHub

If the CMS is unavailable, create or edit `content/posts/<article-slug>.md` on GitHub. Add the Markdown body after the front matter below. Commit to `main`. Upload images into `media/` and refer to them as `/media/filename.jpg`.

```markdown
---
title: "My article title"
status: Draft
published: "2026-11-20"
---

Write your article here.
```

To publish, set the date to your publication date and change `status` to `Published`. Optional metadata fields live in `.pages.yml`. In Markdown use a fenced code block for code and `##` for section headings.

## Build and host

- Node.js 24 recommended. Run `npm ci`, then `npm run dev` or `npm run build`. The configured local path is `/kanishk-kaleidoscope/`.
- In **Settings → Pages**, set the source to **GitHub Actions**. Then run **Actions → Publish blog → Run workflow** on `main` for an initial or manual redeployment. Ordinary pushes to `main` deploy automatically.
- For other static hosting, build with `SITE_URL` set to your site origin and `SITE_BASE` set to the mount path, or an empty string for the domain root. Publish only `dist/`.
- GitHub Free supports public Pages repositories. The published site limit is 1 GB and the soft bandwidth limit is 100 GB/month. Use linked videos instead of committing large media. Hosting the generated files requires no ChatGPT account or subscription. GitHub and hosted CMS features are subject to their respective service policies.
