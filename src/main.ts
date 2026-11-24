import { EXAMPLES } from './examples.ts';
import { RegexSyntaxError } from './parser/ast.ts';
import { parse } from './parser/parser.ts';
import { renderSvg } from './render/svg.ts';
import { decodeHash, encodeHash, type RegexInput } from './url.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header>
    <h1>rubexper</h1>
    <p>Railroad diagrams for Ruby (Onigmo) regular expressions.</p>
  </header>
  <form id="form">
    <span class="slash">/</span>
    <input id="source" type="text" spellcheck="false" autocomplete="off" autofocus aria-label="Regular expression" />
    <span class="slash">/</span>
    <input id="flags" type="text" spellcheck="false" autocomplete="off" maxlength="4" pattern="[mixn]*" aria-label="Flags" />
  </form>
  <div id="error" role="alert" hidden></div>
  <div id="diagram" aria-live="polite"></div>
  <div class="actions">
    <button type="button" id="copy-link">Copy link as comment</button>
    <button type="button" id="download-svg">Download SVG</button>
    <button type="button" id="download-png">Download PNG</button>
  </div>
  <section id="examples">
    <h2>Examples</h2>
    <ul></ul>
  </section>
`;

const sourceInput = app.querySelector<HTMLInputElement>('#source')!;
const flagsInput = app.querySelector<HTMLInputElement>('#flags')!;
const errorBox = app.querySelector<HTMLDivElement>('#error')!;
const diagram = app.querySelector<HTMLDivElement>('#diagram')!;
let currentSvg = '';

function currentInput(): RegexInput {
  return { source: sourceInput.value, flags: flagsInput.value.replace(/[^mixn]/g, '') };
}

function render(): void {
  const input = currentInput();
  history.replaceState(null, '', `#${encodeHash(input)}`);
  try {
    currentSvg = renderSvg(parse(input.source, input.flags), input.flags);
    diagram.innerHTML = currentSvg;
    errorBox.hidden = true;
  } catch (error) {
    if (!(error instanceof RegexSyntaxError)) throw error;
    currentSvg = '';
    diagram.innerHTML = '';
    errorBox.hidden = false;
    errorBox.textContent = `${error.message} (at position ${error.position})`;
  }
}

function renderExamples(): void {
  const list = app.querySelector('#examples ul')!;
  for (const { title, source, flags, note } of EXAMPLES) {
    const item = document.createElement('li');
    const link = Object.assign(document.createElement('a'), {
      href: `#${encodeHash({ source, flags })}`,
      textContent: title,
    });
    link.addEventListener('click', () => window.scrollTo({ top: 0 }));
    const code = Object.assign(document.createElement('code'), { textContent: `/${source}/${flags}` });
    const caption = Object.assign(document.createElement('p'), { textContent: note });
    item.append(link, code, caption);
    list.append(item);
  }
}

function load(): void {
  const { source, flags } = decodeHash(location.hash);
  sourceInput.value = source;
  flagsInput.value = flags;
  render();
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

sourceInput.addEventListener('input', render);
flagsInput.addEventListener('input', render);
app.querySelector('#form')!.addEventListener('submit', (event) => event.preventDefault());
window.addEventListener('hashchange', load);

app.querySelector('#copy-link')!.addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  await navigator.clipboard.writeText(`# ${location.origin}${location.pathname}#${encodeHash(currentInput())}`);
  button.textContent = 'Copied';
  setTimeout(() => (button.textContent = 'Copy link as comment'), 1500);
});

app.querySelector('#download-svg')!.addEventListener('click', () => {
  if (currentSvg) download('regex.svg', new Blob([currentSvg], { type: 'image/svg+xml' }));
});

app.querySelector('#download-png')!.addEventListener('click', () => {
  if (!currentSvg) return;
  const image = new Image();
  image.onload = () => {
    const scale = 2;
    const canvas = Object.assign(document.createElement('canvas'), {
      width: image.width * scale,
      height: image.height * scale,
    });
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && download('regex.png', blob));
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(currentSvg)}`;
});

renderExamples();
load();
