const recordKey = 'kaleidoscope-owner-passkey-v1';
const context = new TextEncoder().encode('Kanishk’s Kaleidoscope studio token v1');

type PrfOutput = { enabled?: boolean; results?: { first?: ArrayBuffer } };

interface SavedPasskey {
  id: string;
  salt: string;
  iv: string;
  encryptedToken: string;
}

const random = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const encode = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

export function supportsPasskeys() {
  return window.isSecureContext && 'PublicKeyCredential' in window && !!navigator.credentials && !!crypto.subtle;
}

export function savedPasskey(): SavedPasskey | undefined {
  try {
    const text = localStorage.getItem(recordKey);
    if (!text) return;
    const value: SavedPasskey = JSON.parse(text);
    if (typeof value.id === 'string' && typeof value.salt === 'string' &&
        typeof value.iv === 'string' && typeof value.encryptedToken === 'string') return value;
  } catch {
    // The token form remains available when local storage is blocked or cleared.
  }
}

export function forgetPasskey() {
  localStorage.removeItem(recordKey);
}

function prfOutput(credential: PublicKeyCredential | null) {
  const results = credential?.getClientExtensionResults() as
    (AuthenticationExtensionsClientOutputs & { prf?: PrfOutput }) | undefined;
  return results?.prf;
}

async function passkeySecret(id: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ id, type: 'public-key' }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt } } },
    },
  }) as PublicKeyCredential | null;
  const key = prfOutput(credential)?.results?.first;
  if (!key) throw new Error('This passkey provider could not unlock the saved token. Use the token sign-in or try another passkey provider.');
  return key;
}

export async function saveTokenWithPasskey(token: string, existing?: SavedPasskey) {
  const salt = existing ? decode(existing.salt) : random(32);
  let id: Uint8Array<ArrayBuffer>;
  let secret: ArrayBuffer | undefined;
  if (existing) {
    id = decode(existing.id);
    secret = await passkeySecret(id, salt);
  } else {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: 'Kanishk’s Kaleidoscope' },
        user: { id: random(32), name: 'kanishkmunot', displayName: 'Kanishk’s Kaleidoscope studio' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        attestation: 'none',
        extensions: { prf: { eval: { first: salt } } },
      },
    }) as PublicKeyCredential | null;
    const prf = prfOutput(credential);
    if (!credential || (!prf?.enabled && !prf?.results?.first)) {
      throw new Error('This passkey provider does not support encrypted token storage. Try a different provider or use token sign-in.');
    }
    id = new Uint8Array(credential.rawId);
    secret = prf.results?.first || await passkeySecret(id, salt);
  }
  const key = await crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['encrypt']);
  const iv = random(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context }, key, new TextEncoder().encode(token),
  );
  localStorage.setItem(recordKey, JSON.stringify({
    id: encode(id), salt: encode(salt), iv: encode(iv), encryptedToken: encode(encrypted),
  } satisfies SavedPasskey));
}

export async function tokenFromPasskey(record: SavedPasskey) {
  const secret = await passkeySecret(decode(record.id), decode(record.salt));
  const key = await crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['decrypt']);
  const token = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(record.iv), additionalData: context }, key, decode(record.encryptedToken),
  );
  return new TextDecoder().decode(token);
}
