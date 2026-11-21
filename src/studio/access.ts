import { StudioGitHub } from './github';

const gate = document.getElementById('owner-access')!;
const form = document.getElementById('connect-form') as HTMLFormElement;
const input = document.getElementById('github-token') as HTMLInputElement;
const button = form.querySelector('button')!;
const status = document.getElementById('access-status')!;
const mount = document.getElementById('workspace-mount')!;
const template = document.getElementById('workspace-template') as HTMLTemplateElement;

form.addEventListener('submit', async event => {
  event.preventDefault();
  const token = input.value.trim();
  input.value = '';
  if (!/^github_pat_[A-Za-z0-9_]+$/.test(token)) {
    status.textContent = 'Enter a fine-grained GitHub token for this repository.';
    input.focus();
    return;
  }

  button.disabled = true;
  input.disabled = true;
  status.textContent = 'Verifying access…';
  try {
    const client = new StudioGitHub(token);
    const files = await client.verifyOwner();
    const { startStudio } = await import('./editor');
    mount.replaceChildren(template.content.cloneNode(true));
    gate.hidden = true;
    mount.hidden = false;
    startStudio(client, files);
    document.title = document.title.replace('Owner access', 'Writing studio');
    mount.querySelector('h1')?.setAttribute('tabindex', '-1');
    mount.querySelector('h1')?.focus();
  } catch (error) {
    mount.replaceChildren();
    mount.hidden = true;
    gate.hidden = false;
    status.textContent = error instanceof Error ? error.message : 'Could not verify access.';
  } finally {
    button.disabled = false;
    input.disabled = false;
    if (!gate.hidden) input.focus();
  }
});

window.addEventListener('pageshow', event => {
  if (event.persisted && gate.hidden) window.location.reload();
});
