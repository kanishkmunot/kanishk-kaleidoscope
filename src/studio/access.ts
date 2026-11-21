import { StudioGitHub } from './github';
import { forgetPasskey, savedPasskey, saveTokenWithPasskey, supportsPasskeys, tokenFromPasskey } from './passkey';

const gate = document.getElementById('owner-access')!;
const form = document.getElementById('connect-form') as HTMLFormElement;
const input = document.getElementById('github-token') as HTMLInputElement;
const button = form.querySelector('button')!;
const status = document.getElementById('access-status')!;
const mount = document.getElementById('workspace-mount')!;
const template = document.getElementById('workspace-template') as HTMLTemplateElement;
const passkeyOptions = document.getElementById('passkey-options')!;
const unlockPasskey = document.getElementById('passkey-unlock') as HTMLButtonElement;
const forget = document.getElementById('passkey-forget') as HTMLButtonElement;
const tokenOptions = document.getElementById('token-options') as HTMLDetailsElement;

function updateGate() {
  const hasPasskey = supportsPasskeys() && !!savedPasskey();
  passkeyOptions.hidden = !hasPasskey;
  tokenOptions.open = !hasPasskey;
}

function problem(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Passkey verification was canceled or unavailable.';
  }
  if (error instanceof DOMException && error.name === 'OperationError') {
    return 'This passkey could not decrypt the saved token. Unlock with your GitHub token to set it up again.';
  }
  return error instanceof Error ? error.message : 'Could not verify access.';
}

async function openStudio(token: string, usedPasskey: boolean) {
  if (!/^github_pat_[A-Za-z0-9_]+$/.test(token)) {
    throw new Error('Enter a fine-grained GitHub token for this repository.');
  }
  const client = new StudioGitHub(token);
  const files = await client.verifyOwner();
  const { startStudio } = await import('./editor');
  mount.replaceChildren(template.content.cloneNode(true));
  mount.hidden = false;
  startStudio(client, files);
  gate.hidden = true;
  document.title = document.title.replace('Owner access', 'Writing studio');
  mount.querySelector('h1')?.setAttribute('tabindex', '-1');
  mount.querySelector('h1')?.focus();

  const setup = document.getElementById('passkey-setup') as HTMLButtonElement;
  const studioStatus = document.getElementById('studio-status')!;
  const existing = savedPasskey();
  setup.hidden = usedPasskey || !supportsPasskeys();
  setup.textContent = existing ? 'Update passkey token' : 'Set up passkey';
  setup.addEventListener('click', async () => {
    setup.disabled = true;
    try {
      await saveTokenWithPasskey(token, existing);
      studioStatus.textContent = 'Passkey ready. Use it to unlock the studio on your next visit.';
      studioStatus.dataset.error = 'false';
      setup.textContent = 'Passkey ready';
      setup.hidden = true;
    } catch (error) {
      studioStatus.textContent = problem(error);
      studioStatus.dataset.error = 'true';
    } finally {
      setup.disabled = false;
    }
  });
}

async function unlock(getToken: () => string | Promise<string>, usedPasskey: boolean) {
  const controls = [button, input, unlockPasskey, forget];
  for (const control of controls) control.disabled = true;
  status.textContent = usedPasskey ? 'Waiting for your passkey…' : 'Verifying access…';

  try {
    await openStudio(await getToken(), usedPasskey);
  } catch (error) {
    mount.replaceChildren();
    mount.hidden = true;
    gate.hidden = false;
    if (!usedPasskey) tokenOptions.open = true;
    status.textContent = problem(error);
  } finally {
    for (const control of controls) control.disabled = false;
    if (!gate.hidden) (usedPasskey ? unlockPasskey : input).focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const token = input.value.trim();
  input.value = '';
  void unlock(() => token, false);
});

unlockPasskey.addEventListener('click', () => {
  const record = savedPasskey();
  if (record) void unlock(() => tokenFromPasskey(record), true);
  else updateGate();
});

forget.addEventListener('click', () => {
  try {
    forgetPasskey();
    updateGate();
    status.textContent = 'Saved token removed from this browser.';
    input.focus();
  } catch (error) {
    status.textContent = problem(error);
  }
});

window.addEventListener('pageshow', event => {
  if (event.persisted && gate.hidden) window.location.reload();
});

updateGate();
