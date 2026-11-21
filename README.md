# Kanishk's Kaleidoscope

A single-author publication built with Astro and GitHub Pages. The public site and writing studio are served from the same website.

## Write and publish on the website

1. Open **Write** from the website footer. Start writing immediately. The editor saves drafts automatically on this device, including uploaded images. Use **Save draft** to save explicitly and **Preview** to review your work in desktop or mobile mode. Select text to format it, use **Insert** or type `/` on an empty line to add blocks, and use **Markdown** to edit the source. **Focus mode** hides the sidebar. The article outline links to your headings. Keep a copy of important drafts before clearing browser data or changing devices.
2. For publishing, create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new) as `kanishkmunot`. Select **Only select repositories**, choose `kanishk-kaleidoscope`, and grant **Contents: Read and write**. Choose an expiry. The studio uses the token for direct GitHub API requests and holds it in memory until you disconnect or leave the page. Keep it private.
3. In the studio, enter the token under **Publishing access**. Choose **Publish**. The studio commits the article and its images together to `main`, then GitHub Actions rebuilds the site. The studio uses today's date when you leave the publication date blank.
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
