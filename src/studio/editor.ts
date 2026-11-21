import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { parse, stringify } from 'yaml';
import { freshDraft, getDrafts, removeDraft, saveDraft, type Draft } from './drafts';
import { rawMediaUrl, StudioGitHub, type ArticleFile } from './github';
import { videoEmbed } from '../lib/video.mjs';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const textField = (id: string) => element<HTMLInputElement | HTMLTextAreaElement>(id);
const stringValue = (value: unknown) => typeof value === 'string' ? value : '';
const mediaFormats = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
  ['image/gif', 'gif'], ['image/avif', 'avif'],
]);

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function postFromMarkdown(source: string, file: ArticleFile): Draft {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  const raw = match ? parse(match[1]) : {};
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...freshDraft(),
    path: file.path, sha: file.sha, published: data.status === 'Published',
    title: stringValue(data.title), subtitle: stringValue(data.subtitle),
    description: stringValue(data.description), date: stringValue(data.published).slice(0, 10),
    body: match ? source.slice(match[0].length).trim() : source,
    cover: stringValue(data.cover), coverAlt: stringValue(data.coverAlt),
    coverCaption: stringValue(data.coverCaption), featured: data.featured === true,
    videos: Array.isArray(data.videos) ? data.videos.filter(video =>
      typeof video?.url === 'string' && typeof video?.title === 'string') : [],
    frontMatter: data,
  };
}

function markdownFromPost(draft: Draft, published: boolean) {
  const data = {
    ...draft.frontMatter,
    title: draft.title,
    subtitle: draft.subtitle || undefined,
    description: draft.description || undefined,
    status: published ? 'Published' : 'Draft',
    published: draft.date || undefined,
    cover: draft.cover || undefined,
    coverAlt: draft.coverAlt || undefined,
    coverCaption: draft.coverCaption || undefined,
    featured: draft.featured || undefined,
    videos: draft.videos.length ? draft.videos : undefined,
  };
  return `---\n${stringify(data, { lineWidth: 0 })}---\n\n${draft.body.trim()}\n`;
}

export function startStudio() {
  let draft = freshDraft();
  let api: StudioGitHub | undefined;
  let localDrafts: Draft[] = [];
  let remoteFiles: ArticleFile[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let focusConnect = false;
  let isPreview = false;
  let editVersion = 0;
  let savedVersion = 0;
  const objectUrls = new Map<string, string>();
  const form = element<HTMLFormElement>('article-form');
  const preview = element('article-preview');
  const status = element('studio-status');
  const coverFile = element<HTMLInputElement>('cover-file');
  const inlineFile = element<HTMLInputElement>('inline-file');
  const featured = element<HTMLInputElement>('article-featured');
  const publishButton = element<HTMLButtonElement>('publish');
  const unpublishButton = element<HTMLButtonElement>('unpublish');
  const deleteButton = element<HTMLButtonElement>('delete-post');
  const previewButton = element<HTMLButtonElement>('preview');
  const draftButton = element<HTMLButtonElement>('save-draft');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-editor-action]'));
  const fields = {
    title: textField('article-title'), subtitle: textField('article-subtitle'),
    description: textField('article-description'), date: textField('article-date'),
    coverAlt: textField('cover-alt'), coverCaption: textField('cover-caption'),
  };
  const videoField = textField('article-videos');

  function tell(message: string, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function showError(error: unknown) {
    tell(error instanceof Error ? error.message : 'Something went wrong. Please try again.', true);
  }

  function imageUrl(src: string) {
    const local = draft.files[src];
    if (local) {
      if (!objectUrls.has(src)) objectUrls.set(src, URL.createObjectURL(local));
      return objectUrls.get(src)!;
    }
    if (/^\/media\/[a-z0-9._-]+$/i.test(src)) return rawMediaUrl(src);
    return /^https:\/\//i.test(src) ? src : '';
  }

  const StudioImage = Image.extend({
    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement('img');
        dom.src = imageUrl(node.attrs.src);
        dom.alt = node.attrs.alt || '';
        if (node.attrs.title) dom.title = node.attrs.title;
        return { dom };
      };
    },
  });

  const editor = new Editor({
    element: element('editor'),
    editorProps: { attributes: { 'aria-label': 'Article body', role: 'textbox', 'aria-multiline': 'true' } },
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, defaultProtocol: 'https' },
      }),
      StudioImage, Markdown,
    ],
    onUpdate: queueSave,
    onSelectionUpdate: updateToolbar,
  });

  function capture() {
    for (const [key, input] of Object.entries(fields)) {
      draft[key as keyof typeof fields] = input.value.trim();
    }
    draft.body = editor.getMarkdown();
    draft.featured = featured.checked;
    draft.videos = [...new Set(videoField.value.split('\n').map(line => line.trim()).filter(Boolean))]
      .map(url => draft.videos.find(video => video.url === url) ??
        { url, title: videoEmbed(url)?.provider === 'Vimeo' ? 'Vimeo video' : 'YouTube video' });
    draft.changed = Date.now();
  }

  function hasEdits() {
    return Boolean(draft.title || draft.subtitle || draft.description || draft.body || draft.cover || draft.videos.length);
  }

  async function persist(showMessage = false) {
    clearTimeout(saveTimer);
    capture();
    const version = editVersion;
    if (!hasEdits()) {
      await removeDraft(draft.id);
      if (showMessage) tell('Add a title or some text before saving a draft.');
    } else if (version !== savedVersion || showMessage) {
      await saveDraft(draft);
      if (showMessage) tell('Draft saved on this device.');
    }
    savedVersion = version;
    updateButtons();
    localDrafts = await getDrafts();
    renderLists();
  }

  function queueSave() {
    editVersion += 1;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist().catch(showError), 350);
  }

  function appendListItem(parent: HTMLElement, name: string, action: () => void) {
    const entry = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'studio-link';
    button.textContent = name;
    button.addEventListener('click', action);
    entry.append(button);
    parent.append(entry);
  }

  function renderLists() {
    const localList = element('draft-list');
    const remoteList = element('remote-list');
    localList.replaceChildren();
    remoteList.replaceChildren();
    for (const item of localDrafts) {
      appendListItem(localList, item.title || 'Untitled draft', () => task(async () => {
        if (draft.id === item.id) return;
        await persist();
        load(item);
      }));
    }
    if (!localDrafts.length) {
      const empty = document.createElement("li");
      empty.textContent = "No local drafts yet.";
      localList.append(empty);
    }
    for (const file of remoteFiles) {
      appendListItem(remoteList, file.name.replace(/\.md$/, '').replaceAll('-', ' '), () => task(async () => {
        if (draft.path === file.path) return;
        await persist();
        const saved = localDrafts.find(item => item.path === file.path && item.sha === file.sha);
        load(saved || postFromMarkdown(await requireApi().read(file), file));
      }));
    }
    if (!remoteFiles.length) {
      const empty = document.createElement('li');
      empty.textContent = api ? 'No articles yet.' : 'Connect to view your articles.';
      remoteList.append(empty);
    }
  }

  function load(value: Draft) {
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear();
    draft = structuredClone(value);
    editVersion = savedVersion = 0;
    for (const [key, input] of Object.entries(fields)) input.value = draft[key as keyof typeof fields];
    featured.checked = draft.featured;
    videoField.value = draft.videos.map(video => video.url).join('\n');
    editor.commands.setContent(draft.body, { contentType: 'markdown', emitUpdate: false });
    setPreview(false);
    updateCover();
    updateButtons();
    tell('');
  }

  function updateCover() {
    element('cover-status').textContent = draft.cover ? draft.cover.split('/').pop()! : 'No cover selected.';
    element('remove-cover').hidden = !draft.cover;
  }

  function updateButtons() {
    publishButton.textContent = draft.published ? 'Update article' : 'Publish';
    unpublishButton.hidden = !draft.published;
    deleteButton.hidden = !draft.path && !hasEdits();
  }

  function updateToolbar() {
    for (const button of buttons) {
      const action = button.dataset.editorAction!;
      const active = action === 'heading' ? editor.isActive('heading', { level: 2 }) :
        action === 'subheading' ? editor.isActive('heading', { level: 3 }) : editor.isActive(action);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  function setPreview(on: boolean) {
    isPreview = on;
    form.hidden = on;
    preview.hidden = !on;
    previewButton.textContent = on ? 'Back to editor' : 'Preview';
    previewButton.setAttribute('aria-pressed', String(on));
    if (!on) return;
    capture();
    element('preview-title').textContent = draft.title || 'Untitled article';
    element('preview-subtitle').textContent = draft.subtitle;
    element('preview-date').textContent = draft.date || today();
    const cover = element<HTMLImageElement>('preview-image');
    const coverSrc = imageUrl(draft.cover);
    element('preview-cover').hidden = !coverSrc;
    if (coverSrc) cover.src = coverSrc;
    cover.alt = draft.coverAlt;
    element('preview-caption').textContent = draft.coverCaption;
    // The visible preview is cloned from ProseMirror's rendered DOM.
    const body = element('preview-body');
    body.replaceChildren(...Array.from(editor.view.dom.childNodes, node => node.cloneNode(true)));
    const videos = element('preview-videos');
    videos.replaceChildren();
    for (const video of draft.videos) {
      if (!videoEmbed(video.url)) continue;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = video.url;
      link.textContent = video.title;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      videos.append(item);
    }
  }

  function requireApi() {
    if (!api) {
      element<HTMLDetailsElement>('connect-details').open = true;
      focusConnect = true;
      throw new Error('Connect your GitHub account to publish or manage online articles.');
    }
    return api;
  }

  function setBusy(value: boolean) {
    busy = value;
    for (const control of document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>(
      '.studio :is(button, input, textarea)',
    )) control.disabled = value;
    editor.setEditable(!value, false);
  }

  function task(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    void action().catch(showError).finally(() => {
      setBusy(false);
      if (focusConnect) element('github-token').focus();
      focusConnect = false;
    });
  }

  function addImage(file: File) {
    const format = mediaFormats.get(file.type);
    if (!format || !file.size || file.size > 8 * 1024 * 1024) {
      throw new Error('Choose a JPG, PNG, WebP, GIF, or AVIF image up to 8 MB.');
    }
    const path = `/media/${crypto.randomUUID()}.${format}`;
    draft.files[path] = file;
    return path;
  }

  function articlePath() {
    if (draft.path) return draft.path;
    const slug = draft.title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
    return `content/posts/${slug || `article-${draft.id.slice(0, 8)}`}.md`;
  }

  async function sendPost(published: boolean) {
    const client = requireApi();
    capture();
    if (!draft.title || !draft.body.trim()) throw new Error('Add a title and article body before publishing.');
    if (published && draft.cover && !draft.coverAlt) throw new Error('Add alt text for your cover image in Article settings.');
    if (draft.videos.some(video => !videoEmbed(video.url))) throw new Error('Use a valid YouTube or Vimeo link in Article settings.');
    if (!draft.date && published) {
      draft.date = today();
      fields.date.value = draft.date;
    }
    await persist();
    const path = articlePath();
    const assets = Object.entries(draft.files)
      .filter(([name]) => name === draft.cover || draft.body.includes(name))
      .map(([name, blob]) => ({ path: name.slice(1), blob }));
    const action = published ? (draft.published ? 'Update' : 'Publish') : 'Unpublish';
    tell(`${action} in progress…`);
    await client.commitArticle(path, draft.sha, markdownFromPost(draft, published), assets, `${action}: ${draft.title}`);
    await removeDraft(draft.id);
    localDrafts = await getDrafts();
    load(freshDraft());
    tell(`${action === 'Publish' ? 'Article published' : action === 'Update' ? 'Article updated' : 'Article unpublished'}. GitHub Pages is rebuilding the website.`);
    try {
      remoteFiles = await client.list();
      renderLists();
      const file = remoteFiles.find(file => file.path === path);
      if (file) {
        const current = postFromMarkdown(await client.read(file), file);
        load(current);
        tell(`${action === 'Publish' ? 'Article published' : action === 'Update' ? 'Article updated' : 'Article unpublished'}. GitHub Pages is rebuilding the website.`);
      }
    } catch {
      tell('Saved on GitHub. Reconnect to refresh the list of articles.');
    }
  }

  element<HTMLFormElement>('connect-form').addEventListener('submit', event => {
    event.preventDefault();
    task(async () => {
      const input = element<HTMLInputElement>('github-token');
      const token = input.value.trim();
      input.value = '';
      if (!/^github_pat_[A-Za-z0-9_]+$/.test(token)) throw new Error('Enter a fine-grained GitHub token for this repository.');
      const client = new StudioGitHub(token);
      await client.verifyOwner();
      remoteFiles = await client.list();
      api = client;
      element('connect-details').hidden = true;
      element('connected').hidden = false;
      renderLists();
      tell('GitHub connected.');
    });
  });

  element('disconnect').addEventListener('click', () => {
    api = undefined;
    remoteFiles = [];
    element('connect-details').hidden = false;
    element('connected').hidden = true;
    renderLists();
    tell('GitHub disconnected.');
  });

  element('new-post').addEventListener('click', () => task(async () => {
    await persist();
    load(freshDraft());
    fields.title.focus();
  }));
  coverFile.addEventListener('change', () => {
    try {
      if (coverFile.files?.[0]) draft.cover = addImage(coverFile.files[0]);
      updateCover();
      queueSave();
    } catch (error) {
      showError(error);
    } finally {
      coverFile.value = '';
    }
  });
  element('remove-cover').addEventListener('click', () => {
    draft.cover = '';
    updateCover();
    queueSave();
  });
  inlineFile.addEventListener('change', () => {
    const file = inlineFile.files?.[0];
    inlineFile.value = '';
    if (!file) return;
    const alt = window.prompt('Describe the image for readers using a screen reader.');
    if (alt === null) return;
    try {
      const caption = window.prompt('Optional image caption') || '';
      editor.chain().focus().setImage({ src: addImage(file), alt, title: caption || undefined }).run();
    } catch (error) {
      showError(error);
    }
  });

  const commands: Record<string, () => void> = {
    bold: () => { editor.chain().focus().toggleBold().run(); },
    italic: () => { editor.chain().focus().toggleItalic().run(); },
    heading: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); },
    subheading: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); },
    bulletList: () => { editor.chain().focus().toggleBulletList().run(); },
    orderedList: () => { editor.chain().focus().toggleOrderedList().run(); },
    blockquote: () => { editor.chain().focus().toggleBlockquote().run(); },
    codeBlock: () => { editor.chain().focus().toggleCodeBlock().run(); },
    image: () => inlineFile.click(),
    link: () => {
      const href = window.prompt('Link URL (https://)', editor.getAttributes('link').href || '');
      if (href === null) return;
      if (!href.trim()) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else if (/^https?:\/\//i.test(href.trim())) {
        const link = editor.chain().focus().extendMarkRange('link');
        if (editor.state.selection.empty && !editor.isActive('link')) {
          link.insertContent([{ type: 'text', text: href.trim(), marks: [{ type: 'link', attrs: { href: href.trim() } }] }]).run();
        } else {
          link.setLink({ href: href.trim() }).run();
        }
      } else {
        tell('Enter a link that starts with https:// or http://.', true);
      }
    },
  };
  for (const button of buttons) {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => {
      commands[button.dataset.editorAction!]?.();
      updateToolbar();
    });
  }
  form.addEventListener('input', queueSave);
  previewButton.addEventListener('click', () => setPreview(!isPreview));
  draftButton.addEventListener('click', () => task(() => persist(true)));
  form.addEventListener('submit', event => {
    event.preventDefault();
    task(() => sendPost(true));
  });
  unpublishButton.addEventListener('click', () => {
    if (window.confirm('Unpublish this article from the website? Its source stays in the public repository.')) {
      task(() => sendPost(false));
    }
  });
  deleteButton.addEventListener('click', () => {
    const message = draft.path ? 'Delete this article from the website and the current branch? Earlier copies may remain in Git history.' :
      'Delete this draft from this browser?';
    if (!window.confirm(message)) return;
    task(async () => {
      clearTimeout(saveTimer);
      if (draft.path) {
        const client = requireApi();
        await client.commitArticle(draft.path, draft.sha, null, [], `Delete: ${draft.title}`);
        remoteFiles = remoteFiles.filter(file => file.path !== draft.path);
      }
      const online = Boolean(draft.path);
      await removeDraft(draft.id);
      localDrafts = await getDrafts();
      load(freshDraft());
      renderLists();
      tell(online ? 'Article deleted. GitHub Pages is rebuilding the website.' : 'Local draft deleted.');
    });
  });

  window.addEventListener('beforeunload', event => {
    if (editVersion === savedVersion) return;
    event.preventDefault();
  });

  task(async () => {
    try {
      localDrafts = await getDrafts();
      load(localDrafts[0] || freshDraft());
    } finally {
      renderLists();
    }
  });
}
