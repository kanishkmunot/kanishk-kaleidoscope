# Kanishk's Kaleidoscope

A single-author publication built with Astro and GitHub Pages. The public site and writing studio are served from the same website.

## Write and publish on the website

1. Bookmark the [owner studio](https://kanishkmunot.github.io/kanishk-kaleidoscope/studio/). Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new) as `kanishkmunot` with **Only select repositories → kanishk-kaleidoscope** and **Contents: Read and write**. Choose an expiry.
2. Enter the token in the studio to unlock it. The studio holds the token in memory until you lock it or leave the page. Drafts autosave to this browser. Use **Save draft** to save explicitly, **Live preview** to review as you write, **Insert** or `/` to add blocks, **Markdown** to edit the source, and **Focus** to hide the sidebar.
3. Choose **Publish** to send your article and its images to `main`. GitHub Actions rebuilds the site. If the publication date is blank, the studio fills in today's date.
4. To edit, select an article under **On GitHub**, make your changes, and choose **Update article**. Use **Unpublish** to change its status to Draft, or **Delete** to remove the source file from the current branch.

The repository is public. Local drafts stay in your browser until you publish. Previously published articles, articles marked Draft in the repository, and uploaded media can be visible on GitHub even after an article is unpublished or deleted. Only the GitHub owner, authorized collaborators, and authorized apps can commit to this repository. GitHub enforces these permissions.

## Add media

- Choose **Insert → Image or GIF**, paste an image, or drop image files into the editor. Enter alternative text and an optional caption.
- In **Article settings and media**, upload a cover and add alternative text. Add YouTube or Vimeo links on separate lines to include video players below the article on the published site. The studio preview displays the same video players.
- If you choose to use Pages CMS as an alternative, the repository includes its existing configuration. It also supports editing articles and media directly on GitHub.

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
