const owner = 'kanishkmunot';
const repository = 'kanishk-kaleidoscope';
const branch = 'main';
const apiOrigin = 'https://api.github.com';
const repoPath = `/repos/${owner}/${repository}`;

export type ArticleFile = { path: string; sha: string; name: string };

function encodeBytes(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 16384) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 16384));
  }
  return btoa(binary);
}

function decodeText(value: string) {
  const bytes = Uint8Array.from(atob(value.replace(/\s+/g, '')), char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class StudioGitHub {
  constructor(private readonly token: string) {}

  private async api<T>(path: string, method = 'GET', body?: object): Promise<T> {
    const response = await fetch(apiOrigin + path, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
    const value = await response.json();
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your GitHub token is invalid or has expired.');
      if (response.status === 403 || response.status === 404) {
        throw new Error(`GitHub denied access (${response.status}). Check the selected repository and Contents permissions.`);
      }
      if (response.status === 409 || response.status === 422) {
        throw new Error('GitHub could not apply the commit. Reload the article list before retrying.');
      }
      throw new Error(`GitHub returned HTTP ${response.status}. Your edits are still in the studio.`);
    }
    return value;
  }

  async verifyOwner() {
    const account = await this.api<{ login: string }>('/user');
    if (account.login.toLowerCase() !== owner) throw new Error('Use the token from the blog owner’s GitHub account.');
    await this.list();
  }

  async list(): Promise<ArticleFile[]> {
    const files = await this.api<Array<ArticleFile & { type: string }>>(
      `${repoPath}/contents/content/posts?ref=${branch}`,
    );
    return files.filter(file => file.type === 'file' && file.name.endsWith('.md'));
  }

  async read(file: ArticleFile) {
    const result = await this.api<{ content: string }>(`${repoPath}/git/blobs/${file.sha}`);
    return decodeText(result.content);
  }

  async commitArticle(
    path: string, previousSha: string | undefined, body: string | null,
    assets: Array<{ path: string; blob: Blob }>, message: string,
  ) {
    const head = await this.api<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/${branch}`);
    const parent = await this.api<{ tree: { sha: string } }>(`${repoPath}/git/commits/${head.object.sha}`);
    const snapshot = await this.api<{ tree: Array<{ path: string; sha: string }>; truncated: boolean }>(
      `${repoPath}/git/trees/${parent.tree.sha}?recursive=1`,
    );
    if (snapshot.truncated) throw new Error('This repository is too large to check for concurrent edits safely.');
    const current = snapshot.tree.find(entry => entry.path === path);
    if (current?.sha !== previousSha) {
      throw new Error(previousSha ? 'This article changed on GitHub. Reopen the latest version before publishing.' :
        'An article already uses this URL. Try a different title.');
    }

    const objects = await Promise.all(assets.map(async asset => {
      const value = await this.api<{ sha: string }>(`${repoPath}/git/blobs`, 'POST', {
        encoding: 'base64',
        content: encodeBytes(new Uint8Array(await asset.blob.arrayBuffer())),
      });
      return { path: asset.path, mode: '100644', type: 'blob', sha: value.sha };
    }));
    const article = body === null ? { sha: null } : { content: body };
    const tree = await this.api<{ sha: string }>(`${repoPath}/git/trees`, 'POST', {
      base_tree: parent.tree.sha,
      tree: [...objects, { path, mode: '100644', type: 'blob', ...article }],
    });
    const commit = await this.api<{ sha: string }>(`${repoPath}/git/commits`, 'POST', {
      message, tree: tree.sha, parents: [head.object.sha],
    });
    await this.api(`${repoPath}/git/refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: false });
    return commit.sha;
  }
}

export const rawMediaUrl = (path: string) =>
  `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${path.slice(1)}`;
