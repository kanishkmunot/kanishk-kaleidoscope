function voiceScore(voice: SpeechSynthesisVoice, language: string) {
  const name = voice.name.toLowerCase();
  const natural = /natural|neural|premium|enhanced|online/.test(name);
  const female = /\b(female|aria|jenny|emma|ava|samantha|karen|neerja|sonia|natasha|tessa|zira|susan|aishwarya|siri female)\b/.test(name) ||
    name === 'google us english';
  return (voice.lang === language ? 4 : 0) + (natural ? 24 : 0) + (female ? 37 : 0) +
    (female && natural ? 20 : 0) + (voice.default ? 1 : 0);
}

function speechChunks(text: string, language: string) {
  const maxLength = 210;
  const sentences = typeof Intl.Segmenter === 'function' ?
    Array.from(new Intl.Segmenter(language, { granularity: 'sentence' }).segment(text), part => part.segment) :
    (text.match(/[^.!?]+[.!?]*|[.!?]+/g) || [text]);
  const chunks: string[] = [];
  let chunk = '';
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    if (chunk && (chunk.length + sentence.length > maxLength)) {
      chunks.push(chunk);
      chunk = '';
    }
    for (const word of words) {
      if (chunk && chunk.length + word.length + 1 > maxLength) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += chunk ? ` ${word}` : word;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function enableNarration() {
  const controls = document.querySelector<HTMLElement>('.narration');
  const article = document.querySelector<HTMLElement>('article.article');
  if (!controls || !article || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

  const play = controls.querySelector<HTMLButtonElement>('.narration-play')!;
  const stopButton = controls.querySelector<HTMLButtonElement>('.narration-stop')!;
  const label = controls.querySelector('.narration-label')!;
  const icon = controls.querySelector('.narration-icon')!;
  const status = controls.querySelector<HTMLElement>('.narration-status')!;
  const voicesMenu = controls.querySelector<HTMLDetailsElement>('.narration-voices')!;
  const picker = controls.querySelector<HTMLSelectElement>('select')!;
  const synth = window.speechSynthesis;
  const language = article.lang || document.documentElement.lang || 'en';
  let voices: SpeechSynthesisVoice[] = [];
  let state: 'idle' | 'playing' | 'paused' = 'idle';
  let sequence = 0;
  let current: SpeechSynthesisUtterance | undefined;
  const prose = article.querySelectorAll<HTMLElement>('.prose :is(p,h2,h3,h4,h5,h6,li)');
  const title = article.querySelector('h1')?.textContent || '';
  const subtitle = article.querySelector('.subtitle')?.textContent || '';
  const paragraphs = Array.from(prose)
    .filter(node => !node.closest('figure,pre,table,details,.article-end') &&
      (node.tagName !== 'LI' || !node.querySelector('p')))
    .map(node => {
      if (node.tagName !== 'LI') return node.textContent || '';
      const listItem = node.cloneNode(true) as HTMLElement;
      listItem.querySelectorAll('ul,ol').forEach(list => list.remove());
      return listItem.textContent || '';
    })
    .map(value => value.trim()).filter(Boolean);
  const chunks = [title, subtitle, ...paragraphs].filter(Boolean).flatMap(text => speechChunks(text, language));
  if (!chunks.length) return;

  function updateVoices() {
    const preferred = picker.value;
    voices = synth.getVoices().filter(voice => voice.lang.toLowerCase().startsWith(language.toLowerCase().split('-')[0]))
      .sort((first, second) => voiceScore(second, language) - voiceScore(first, language));
    picker.replaceChildren(...voices.map(voice => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = voice.name;
      return option;
    }));
    if (voices.some(voice => voice.voiceURI === preferred)) picker.value = preferred;
    voicesMenu.hidden = voices.length < 2;
  }

  function setState(value: typeof state) {
    state = value;
    const text = state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen';
    label.textContent = text;
    play.setAttribute('aria-label', state === 'idle' ? 'Listen to article' : `${text} narration`);
    icon.textContent = state === 'playing' ? 'Ⅱ' : '▶';
    stopButton.hidden = state === 'idle';
  }

  function stop(announce = false) {
    sequence += 1;
    current = undefined;
    synth.cancel();
    setState('idle');
    if (announce) status.textContent = 'Narration stopped.';
  }

  function speak(index: number, run: number, voice?: SpeechSynthesisVoice) {
    if (run !== sequence) return;
    if (index >= chunks.length) {
      setState('idle');
      current = undefined;
      status.textContent = 'Narration finished.';
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    current = utterance;
    utterance.lang = voice?.lang || language;
    if (voice) utterance.voice = voice;
    utterance.rate = .98;
    utterance.onend = () => speak(index + 1, run, voice);
    utterance.onerror = event => {
      if (run !== sequence) return;
      stop();
      status.textContent = event.error === 'not-allowed' ?
        'Press Listen to try again.' : 'This voice is unavailable. Choose another voice and try again.';
    };
    synth.speak(utterance);
  }

  play.addEventListener('click', () => {
    status.textContent = '';
    if (state === 'playing' && current) {
      synth.pause();
      setState('paused');
    } else if (state === 'paused' && current) {
      synth.resume();
      setState('playing');
    } else {
      stop();
      setState('playing');
      speak(0, sequence, voices.find(voice => voice.voiceURI === picker.value) || voices[0]);
    }
  });
  stopButton.addEventListener('click', () => {
    stop(true);
    play.focus();
  });
  window.addEventListener('pagehide', () => { if (current) stop(); });
  synth.addEventListener('voiceschanged', updateVoices);
  updateVoices();
  controls.hidden = false;
}
