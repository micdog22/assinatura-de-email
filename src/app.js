import {
  prepareSignature, buildSignatureHtml, buildSignatureText, normalizeColor, DEFAULT_COLOR, LAYOUTS,
} from './signature.js';

const STORAGE_KEY = 'assinatura-de-email';
const TEXT_FIELDS = ['nome', 'cargo', 'empresa', 'telefone', 'whatsapp', 'email', 'site', 'endereco',
  'linkedin', 'instagram', 'github', 'foto', 'aviso'];
const EXAMPLE = {
  nome: 'Maria Exemplo',
  cargo: 'Analista de Marketing',
  empresa: 'Lanchonete Exemplo',
  telefone: '(19) 3333-4444',
  whatsapp: '(19) 99999-9999',
  email: 'maria@example.com',
  site: 'example.com',
  endereco: 'Rua Exemplo, 100, Centro, São Paulo/SP',
  linkedin: 'maria-exemplo',
  instagram: '@lanchonete.exemplo',
  github: '',
  foto: '',
  aviso: '',
  cor: DEFAULT_COLOR,
  layout: 'classico',
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $('form'),
  color: $('cor'),
  colorValue: $('cor-valor'),
  layouts: document.querySelectorAll('input[name="layout"]'),
  preview: $('preview'),
  copyRich: $('copy-rich'),
  copyHtml: $('copy-html'),
  status: $('status'),
  warnings: $('warnings'),
  example: $('example'),
  clear: $('clear'),
};

let state = { ...EXAMPLE };
let current = { html: '', text: '' };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return;
    for (const key of TEXT_FIELDS) if (typeof saved[key] === 'string') state[key] = saved[key];
    state.cor = normalizeColor(saved.cor) || DEFAULT_COLOR;
    if (LAYOUTS[saved.layout]) state.layout = saved.layout;
  } catch {
    // Sem armazenamento: começa com o exemplo.
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Armazenamento indisponível: os dados valem só nesta visita.
  }
}

function fillForm() {
  for (const key of TEXT_FIELDS) $(key).value = state[key];
  els.color.value = state.cor;
  els.colorValue.textContent = state.cor;
  for (const radio of els.layouts) radio.checked = radio.value === state.layout;
}

function readForm() {
  for (const key of TEXT_FIELDS) state[key] = $(key).value;
  state.cor = normalizeColor(els.color.value) || DEFAULT_COLOR;
  const checked = [...els.layouts].find((r) => r.checked);
  state.layout = checked ? checked.value : 'classico';
}

function previewDocument(html) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light">'
    + '<style>body{margin:16px;background:#fff;color:#374151}a{pointer-events:none}</style></head>'
    + `<body>${html}</body></html>`;
}

function fitPreview() {
  const doc = els.preview.contentDocument;
  if (!doc || !doc.documentElement) return;
  els.preview.style.height = `${Math.max(160, doc.documentElement.scrollHeight)}px`;
}

function renderWarnings(warnings) {
  if (!warnings.length) {
    els.warnings.replaceChildren();
    return;
  }
  const title = document.createElement('p');
  title.textContent = warnings.length === 1 ? 'Confira 1 ponto:' : `Confira ${warnings.length} pontos:`;
  const list = document.createElement('ul');
  for (const warning of warnings) {
    const li = document.createElement('li');
    li.textContent = warning;
    list.appendChild(li);
  }
  els.warnings.replaceChildren(title, list);
}

function isEmpty({ data: d }) {
  return !d.name && !d.role && !d.company && !d.contacts.length && !d.address && !d.social.length && !d.photo && !d.disclaimer;
}

function render() {
  const prepared = prepareSignature(state);
  const empty = isEmpty(prepared);
  current = {
    html: empty ? '' : buildSignatureHtml(prepared, state.layout),
    text: empty ? '' : buildSignatureText(prepared),
  };
  // A pré-visualização roda num iframe isolado, sem scripts, para o estilo da página não interferir.
  els.preview.srcdoc = previewDocument(empty
    ? '<p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:14px;color:#6b7280;">Preencha o formulário para ver a assinatura.</p>'
    : current.html);
  els.copyRich.disabled = empty;
  els.copyHtml.disabled = empty;
  els.colorValue.textContent = state.cor;
  renderWarnings(prepared.warnings);
  save();
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle('error', isError);
}

// Copia HTML + texto puro; o programa de e-mail escolhe o formato que entende.
async function copyRich(html, text) {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      return true;
    } catch {
      // Cai no método alternativo abaixo.
    }
  }
  let copied = false;
  const onCopy = (event) => {
    event.clipboardData.setData('text/html', html);
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
    copied = true;
  };
  document.addEventListener('copy', onCopy);
  try {
    document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.removeEventListener('copy', onCopy);
  return copied;
}

async function copyPlain(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

els.form.addEventListener('input', () => {
  readForm();
  setStatus('');
  render();
});
els.form.addEventListener('change', () => {
  readForm();
  render();
});
els.form.addEventListener('submit', (e) => e.preventDefault());
els.preview.addEventListener('load', fitPreview);
window.addEventListener('resize', fitPreview);

els.copyRich.addEventListener('click', async () => {
  const ok = await copyRich(current.html, current.text);
  setStatus(ok ? 'Assinatura copiada! Agora cole nas configurações do seu e-mail.' : 'Não foi possível copiar. Tente “Copiar código HTML”.', !ok);
});
els.copyHtml.addEventListener('click', async () => {
  const ok = await copyPlain(current.html);
  setStatus(ok ? 'Código HTML copiado.' : 'Não foi possível copiar o código.', !ok);
});
els.example.addEventListener('click', () => {
  state = { ...EXAMPLE, cor: state.cor, layout: state.layout };
  fillForm();
  setStatus('');
  render();
});
els.clear.addEventListener('click', () => {
  for (const key of TEXT_FIELDS) state[key] = '';
  fillForm();
  setStatus('');
  render();
  $('nome').focus();
});

load();
fillForm();
render();
