import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
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

export function startStudio(client: StudioGitHub, files: ArticleFile[]) {
  let draft = freshDraft();
  let localDrafts: Draft[] = [];
  let remoteFiles = files;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let isPreview = window.matchMedia('(min-width: 1000px)').matches;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let previewVideoKey = '';
  let markdownPreview: Editor | undefined;
  let editVersion = 0;
  let savedVersion = 0;
  let markdownMode = false;
  let visualSnapshot = '';
  let imageQueue: File[] = [];
  const objectUrls = new Map<string, string>();
  const form = element<HTMLFormElement>('article-form');
  const preview = element('article-preview');
  const editorElement = element('editor');
  const insertAtLine = element<HTMLButtonElement>('insert-at-line');
  const studio = form.closest('.studio')!;
  const sourceText = element<HTMLTextAreaElement>('markdown-source');
  const outline = element('article-outline');
  const selectionMenu = element('selection-menu');
  const blocksDialog = element<HTMLDialogElement>('blocks-dialog');
  const linkDialog = element<HTMLDialogElement>('link-dialog');
  const imageDialog = element<HTMLDialogElement>('image-dialog');
  const search = element<HTMLInputElement>('block-search');
  const blockOptions = element('block-options');
  const focusMode = element<HTMLButtonElement>('focus-mode');
  const markdownButton = element<HTMLButtonElement>('markdown-mode');
  const publishTop = element<HTMLButtonElement>('publish-top');
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
        const dom = document.createElement('figure');
        const image = document.createElement('img');
        const src = imageUrl(node.attrs.src);
        if (src) image.src = src;
        image.alt = node.attrs.alt || '';
        dom.append(image);
        if (node.attrs.title) {
          const caption = document.createElement('figcaption');
          caption.textContent = node.attrs.title;
          dom.append(caption);
        }
        return { dom };
      };
    },
  });

  const extensions = () => [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, defaultProtocol: 'https' },
    }),
    StudioImage, Markdown, TableKit, TaskList, TaskItem.configure({ nested: true }),
  ];

  const editor = new Editor({
    element: editorElement,
    editorProps: {
      attributes: { 'aria-label': 'Article body', role: 'textbox', 'aria-multiline': 'true' },
      handleKeyDown(view, event) {
        const selection = view.state.selection;
        if (event.key !== '/' || !selection.empty || selection.$from.parent.textContent) return false;
        event.preventDefault();
        openBlocks();
        return true;
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files || []).filter(file => mediaFormats.has(file.type));
        if (!files.length) return false;
        event.preventDefault();
        enqueueImages(files);
        return true;
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files || []).filter(file => mediaFormats.has(file.type));
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (position !== undefined) editor.commands.setTextSelection(position);
        enqueueImages(files);
        return true;
      },
    },
    injectCSS: false,
    extensions: extensions(),
    onUpdate: () => { queueSave(); updateOutline(); },
    onSelectionUpdate: updateToolbar,
    onFocus: updateToolbar,
    onBlur: () => { selectionMenu.hidden = true; insertAtLine.hidden = true; },
  });

  function capture() {
    for (const [key, input] of Object.entries(fields)) {
      draft[key as keyof typeof fields] = input.value.trim();
    }
    if (markdownMode) {
      draft.body = sourceText.value;
    } else {
      const serialized = editor.getMarkdown();
      if (serialized !== visualSnapshot) {
        draft.body = serialized;
        visualSnapshot = serialized;
      }
    }
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
      element('draft-state').textContent = 'Ready to write';
      if (showMessage) tell('Add a title or some text before saving a draft.');
    } else if (version !== savedVersion || showMessage) {
      const used = Object.fromEntries(Object.entries(draft.files).filter(([path]) =>
        path === draft.cover || draft.body.includes(path)));
      await saveDraft({ ...draft, files: used });
      element('draft-state').textContent = 'Saved on this device';
      if (showMessage) tell('Draft saved on this device.');
    }
    savedVersion = version;
    updateButtons();
    localDrafts = await getDrafts();
    renderLists();
  }

  function queueSave() {
    editVersion += 1;
    element('draft-state').textContent = 'Saving draft…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist().catch(showError), 350);
    if (isPreview) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, 100);
    }
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
        load(saved || postFromMarkdown(await client.read(file), file));
      }));
    }
    if (!remoteFiles.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No articles yet.';
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
    sourceText.value = draft.body;
    editor.commands.setContent(draft.body, { contentType: 'markdown', emitUpdate: false });
    visualSnapshot = editor.getMarkdown();
    setMarkdown(false);
    setPreview(isPreview);
    element('draft-state').textContent = hasEdits() ? 'Drafts autosave on this device' : 'Ready to write';
    updateOutline();
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
    publishTop.textContent = publishButton.textContent;
    unpublishButton.hidden = !draft.published;
    deleteButton.hidden = !draft.path && !hasEdits();
  }

  function updateToolbar() {
    for (const button of buttons) {
      const action = button.dataset.editorAction!;
      if (['bold', 'italic', 'underline', 'strike', 'code', 'link'].includes(action)) {
        button.setAttribute('aria-pressed', String(editor.isActive(action)));
      }
    }
    element('table-tools').hidden = markdownMode || !editor.isActive('table');
    const { from, to, empty, $from } = editor.state.selection;
    insertAtLine.hidden = markdownMode || !editor.isFocused || !empty ||
      $from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0;
    if (!insertAtLine.hidden) {
      const caret = editor.view.coordsAtPos(from);
      const region = editorElement.parentElement!.getBoundingClientRect();
      insertAtLine.style.top = `${caret.top - region.top - 2}px`;
    }
    selectionMenu.hidden = markdownMode || empty || !editor.isFocused;
    if (!selectionMenu.hidden) {
      const selection = editor.view.coordsAtPos(from);
      const right = editor.view.coordsAtPos(to);
      const area = editorElement.parentElement!.getBoundingClientRect();
      const center = (selection.left + right.right) / 2 - area.left;
      const left = Math.max(3, Math.min(area.width - selectionMenu.offsetWidth - 3, center - selectionMenu.offsetWidth / 2));
      selectionMenu.style.left = `${left}px`;
      selectionMenu.style.top = `${Math.max(1, selection.top - area.top - selectionMenu.offsetHeight - 6)}px`;
    }
  }

  function updateOutline() {
    outline.replaceChildren();
    editor.state.doc.descendants((node, position) => {
      if (node.type.name !== 'heading' || !node.textContent.trim()) return;
      const entry = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'studio-link';
      button.textContent = node.textContent;
      entry.dataset.level = String(node.attrs.level);
      button.addEventListener('click', () => {
        setMarkdown(false);
        const target = editor.view.nodeDOM(position);
        if (target instanceof HTMLElement) target.scrollIntoView({ block: 'center' });
        editor.chain().focus().setTextSelection(position + 1).run();
      });
      entry.append(button);
      outline.append(entry);
    });
    if (!outline.children.length) {
      const empty = document.createElement('li');
      empty.textContent = 'Headings appear here as you write.';
      outline.append(empty);
    }
    const words = editor.getText({ blockSeparator: ' ' }).trim().split(/\s+/u).filter(Boolean).length;
    element('writing-stats').textContent = `${words} ${words === 1 ? 'word' : 'words'}${words ? ` · ${Math.ceil(words / 220)} min read` : ''}`;
  }

  function setMarkdown(on: boolean) {
    if (markdownMode !== on) {
      if (on) {
        capture();
        sourceText.value = draft.body;
      } else {
        draft.body = sourceText.value;
        editor.commands.setContent(draft.body, { contentType: 'markdown', emitUpdate: false });
        visualSnapshot = editor.getMarkdown();
        updateOutline();
      }
    }
    markdownMode = on;
    sourceText.hidden = !on;
    editorElement.hidden = on;
    markdownButton.textContent = on ? 'Visual editor' : 'Markdown';
    markdownButton.setAttribute('aria-pressed', String(on));
    for (const button of buttons) button.hidden = on;
    element('insert-block').hidden = on;
    element('table-tools').hidden = on || !editor.isActive('table');
    selectionMenu.hidden = true;
    insertAtLine.hidden = true;
  }

  function setPreview(on: boolean) {
    isPreview = on;
    preview.hidden = !on;
    studio.classList.toggle('with-live-preview', on);
    previewButton.setAttribute('aria-pressed', String(on));
    clearTimeout(previewTimer);
    if (on) renderPreview();
  }

  function renderPreview() {
    if (!isPreview) return;
    capture();
    element('preview-title').textContent = draft.title || 'Untitled article';
    element('preview-subtitle').textContent = draft.subtitle;
    element('preview-date').textContent = draft.date || today();
    const cover = element<HTMLImageElement>('preview-image');
    const coverSrc = imageUrl(draft.cover);
    element('preview-cover').hidden = !coverSrc;
    if (coverSrc && cover.getAttribute('src') !== coverSrc) cover.src = coverSrc;
    cover.alt = draft.coverAlt;
    element('preview-caption').textContent = draft.coverCaption;
    let previewEditor = editor;
    if (markdownMode) {
      markdownPreview ??= new Editor({
        element: document.createElement('div'),
        extensions: extensions(),
        injectCSS: false,
        editable: false,
      });
      markdownPreview.commands.setContent(draft.body, { contentType: 'markdown', emitUpdate: false });
      previewEditor = markdownPreview;
    }
    const body = element('preview-body');
    body.replaceChildren(...Array.from(previewEditor.view.dom.childNodes, node => node.cloneNode(true)));
    for (const control of body.querySelectorAll<HTMLInputElement>('input')) control.disabled = true;
    for (const link of body.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    for (const handle of body.querySelectorAll('.ProseMirror-trailingBreak, .column-resize-handle')) handle.remove();
    const videos = element('preview-videos');
    const key = JSON.stringify(draft.videos);
    if (previewVideoKey === key) return;
    previewVideoKey = key;
    videos.replaceChildren();
    for (const video of draft.videos) {
      const embed = videoEmbed(video.url);
      if (!embed) continue;
      const figure = document.createElement('figure');
      figure.className = 'video';
      const player = document.createElement('iframe');
      player.src = embed.src;
      player.title = video.title;
      player.loading = 'lazy';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      const caption = document.createElement('figcaption');
      const link = document.createElement('a');
      link.href = video.url;
      link.textContent = video.title;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      caption.append(link);
      figure.append(player, caption);
      videos.append(figure);
    }
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
    void action().catch(showError).finally(() => setBusy(false));
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

  element('disconnect').addEventListener('click', () => task(async () => {
    await persist();
    window.location.reload();
  }));

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
  function openNextImage() {
    if (!imageQueue.length) return;
    const file = imageQueue[0];
    element('image-name').textContent = file.name;
    textField('inline-alt').value = '';
    textField('inline-caption').value = '';
    imageDialog.showModal();
    textField('inline-alt').focus();
  }

  function enqueueImages(files: File[]) {
    if (!files.length) return;
    imageQueue = files;
    openNextImage();
  }

  inlineFile.addEventListener('change', () => {
    const files = Array.from(inlineFile.files || []);
    inlineFile.value = '';
    enqueueImages(files);
  });

  element<HTMLFormElement>('image-form').addEventListener('submit', event => {
    event.preventDefault();
    const file = imageQueue[0];
    if (!file) return;
    try {
      const alt = textField('inline-alt').value.trim();
      const title = textField('inline-caption').value.trim();
      const src = addImage(file);
      imageQueue.shift();
      imageDialog.close('insert');
      editor.chain().focus().setImage({ src, alt, title: title || undefined }).run();
    } catch (error) {
      imageDialog.close();
      showError(error);
    }
  });
  imageDialog.addEventListener('close', () => {
    if (imageDialog.returnValue === 'insert') openNextImage();
    else imageQueue = [];
    imageDialog.returnValue = '';
  });

  function openLink() {
    textField('link-value').value = editor.getAttributes('link').href || '';
    linkDialog.showModal();
    textField('link-value').focus();
  }

  element<HTMLFormElement>('link-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = textField('link-value');
    const href = input.value.trim();
    input.setCustomValidity(/^https?:\/\//i.test(href) ? '' : 'Enter a valid http:// or https:// URL.');
    if (!input.reportValidity()) return;
    linkDialog.close();
    const link = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !editor.isActive('link')) {
      link.insertContent([{ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }]).run();
    } else {
      link.setLink({ href }).run();
    }
  });
  textField('link-value').addEventListener('input', event => (event.target as HTMLInputElement).setCustomValidity(''));
  element('unlink').addEventListener('click', () => {
    linkDialog.close();
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
  });

  const commands: Record<string, () => void> = {
    undo: () => { editor.chain().focus().undo().run(); },
    redo: () => { editor.chain().focus().redo().run(); },
    bold: () => { editor.chain().focus().toggleBold().run(); },
    italic: () => { editor.chain().focus().toggleItalic().run(); },
    underline: () => { editor.chain().focus().toggleUnderline().run(); },
    strike: () => { editor.chain().focus().toggleStrike().run(); },
    code: () => { editor.chain().focus().toggleCode().run(); },
    heading: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); },
    subheading: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); },
    bulletList: () => { editor.chain().focus().toggleBulletList().run(); },
    orderedList: () => { editor.chain().focus().toggleOrderedList().run(); },
    taskList: () => { editor.chain().focus().toggleTaskList().run(); },
    blockquote: () => { editor.chain().focus().toggleBlockquote().run(); },
    codeBlock: () => { editor.chain().focus().toggleCodeBlock().run(); },
    divider: () => { editor.chain().focus().setHorizontalRule().run(); },
    table: () => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); },
    addRow: () => { editor.chain().focus().addRowAfter().run(); },
    addColumn: () => { editor.chain().focus().addColumnAfter().run(); },
    deleteRow: () => { editor.chain().focus().deleteRow().run(); },
    deleteColumn: () => { editor.chain().focus().deleteColumn().run(); },
    deleteTable: () => { editor.chain().focus().deleteTable().run(); },
    image: () => inlineFile.click(),
    video: () => {
      videoField.closest('details')!.open = true;
      videoField.focus();
    },
    link: openLink,
  };
  const blocks: Array<[string, string]> = [
    ['heading', 'Heading'], ['subheading', 'Subheading'], ['image', 'Image or GIF'],
    ['video', 'YouTube or Vimeo'], ['blockquote', 'Quote'], ['bulletList', 'Bulleted list'],
    ['orderedList', 'Numbered list'], ['taskList', 'Checklist'], ['codeBlock', 'Code block'],
    ['table', 'Table'], ['divider', 'Divider'],
  ];

  function renderBlocks() {
    blockOptions.replaceChildren();
    for (const [key, name] of blocks) {
      if (!name.toLowerCase().includes(search.value.trim().toLowerCase())) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', () => {
        blocksDialog.close();
        commands[key]();
      });
      blockOptions.append(button);
    }
    if (!blockOptions.children.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No blocks match that search.';
      blockOptions.append(empty);
    }
  }

  function openBlocks() {
    search.value = '';
    renderBlocks();
    blocksDialog.showModal();
    search.focus();
  }

  element('insert-block').addEventListener('click', openBlocks);
  insertAtLine.addEventListener('mousedown', event => event.preventDefault());
  insertAtLine.addEventListener('click', openBlocks);
  search.addEventListener('input', renderBlocks);
  search.addEventListener('keydown', event => {
    const first = blockOptions.querySelector('button');
    if (!first || !['Enter', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Enter') first.click();
    else first.focus();
  });
  element('shortcut-help').addEventListener('click', () => element<HTMLDialogElement>('shortcuts-dialog').showModal());
  for (const close of document.querySelectorAll<HTMLButtonElement>('[data-close-dialog]')) {
    close.addEventListener('click', () => close.closest('dialog')?.close());
  }
  markdownButton.addEventListener('click', () => {
    setMarkdown(!markdownMode);
    if (markdownMode) sourceText.focus();
    else editor.commands.focus();
    renderPreview();
  });
  sourceText.addEventListener('input', () => {
    const words = sourceText.value.trim().split(/\s+/u).filter(Boolean).length;
    element('writing-stats').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  });
  focusMode.addEventListener('click', () => {
    const focused = studio.classList.toggle('compose-focus');
    focusMode.setAttribute('aria-pressed', String(focused));
    focusMode.textContent = focused ? 'Exit focus' : 'Focus';
  });
  for (const size of ['wide', 'narrow']) {
    element(`preview-${size}`).addEventListener('click', () => {
      element('preview-canvas').classList.toggle('preview-mobile', size === 'narrow');
      element('preview-wide').setAttribute('aria-pressed', String(size === 'wide'));
      element('preview-narrow').setAttribute('aria-pressed', String(size === 'narrow'));
    });
  }
  publishTop.addEventListener('click', () => form.requestSubmit());
  form.addEventListener('keydown', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      task(() => persist(true));
    }
    if (event.key.toLowerCase() === 'k' && !markdownMode) {
      event.preventDefault();
      openLink();
    }
  });
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
