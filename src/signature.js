// Lógica pura do gerador: validação dos campos e montagem do HTML da
// assinatura (tabelas, estilos inline, fontes seguras). Sem DOM.

export const LAYOUTS = {
  classico: 'Clássico, com foto à esquerda',
  compacto: 'Compacto',
  moderno: 'Moderno, com barra colorida',
};
export const DEFAULT_COLOR = '#0f766e';

const FONT = 'Arial, Helvetica, sans-serif';
const STRONG = '#111827';
const TEXT = '#374151';
const SOFT = '#6b7280';
const FIELD_LIMIT = 200;

const DDD_RANGES = [
  [11, 19], [21, 22], [24, 24], [27, 28], [31, 35], [37, 38], [41, 49], [51, 51], [53, 55],
  [61, 69], [71, 71], [73, 75], [77, 77], [79, 79], [81, 89], [91, 99],
];
const VALID_DDDS = new Set(DDD_RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)));

const EMAIL_RE = /^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
// O navegador ignora tabulações e quebras de linha em qualquer ponto da URL e
// caracteres de controle nas pontas: "java\tscript:" vira "javascript:".
const URL_IGNORED = /[\t\n\r]+/g;
const URL_EDGES = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function clean(value, max = FIELD_LIMIT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Normaliza um endereço: acrescenta https:// quando falta e aceita só os
 * esquemas permitidos (http e https por padrão; mailto e tel quando pedidos).
 */
export function normalizeUrl(input, { allow = ['http', 'https'] } = {}) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, url: '' };
  let s = raw.replace(URL_IGNORED, '').replace(URL_EDGES, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  const hostAndPort = /^[a-z0-9.-]+:\d+(?:[/?#]|$)/i.test(s);
  if (scheme && !hostAndPort) {
    const name = scheme[1].toLowerCase();
    if (!allow.includes(name)) {
      return { ok: false, error: `Endereço com "${name}:" não é permitido. Use um endereço que comece com https://.` };
    }
    if (name === 'mailto') {
      let email = '';
      try {
        email = decodeURIComponent(s.slice(7).split('?')[0]);
      } catch {
        email = '';
      }
      return EMAIL_RE.test(email) ? { ok: true, url: `mailto:${email}` } : { ok: false, error: 'E-mail inválido.' };
    }
    if (name === 'tel') {
      const tel = s.slice(4).replace(/[^\d+]/g, '');
      return /^\+?\d{8,15}$/.test(tel) ? { ok: true, url: `tel:${tel}` } : { ok: false, error: 'Telefone inválido.' };
    }
  } else if (s.startsWith('//')) {
    s = `https:${s}`;
  } else {
    s = `https://${s}`;
  }
  let url;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, error: 'Endereço inválido.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'Endereço inválido.' };
  if (!/^[^.]+(?:\.[^.]+)+$/.test(url.hostname)) return { ok: false, error: 'Endereço sem domínio válido (exemplo: https://example.com).' };
  if (url.username || url.password) return { ok: false, error: 'Endereço com usuário e senha não é aceito.' };
  return { ok: true, url: url.href };
}

export function displayUrl(href) {
  try {
    const url = new URL(href);
    return (url.host + url.pathname + url.search).replace(/\/$/, '');
  } catch {
    return href;
  }
}

export function normalizeEmail(input) {
  const email = clean(input, 254);
  if (!email) return null;
  return EMAIL_RE.test(email) ? { ok: true, email, href: `mailto:${email}` } : { ok: false, error: `E-mail inválido: ${email}` };
}

/** Lê um telefone brasileiro com DDD (com ou sem +55). */
export function parseBrazilianPhone(input) {
  const raw = clean(input, 40);
  if (!raw || /[^\d\s().+\-/]/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') || digits.startsWith('00')) {
    digits = digits.replace(/^00/, '');
    if (!digits.startsWith('55')) return null;
    digits = digits.slice(2);
  } else if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (!VALID_DDDS.has(Number(digits.slice(0, 2)))) return null;
  const number = digits.slice(2);
  if (number.length === 9 && number[0] !== '9') return null;
  if (number.length === 8 && !/^[2-5]/.test(number)) return null;
  const cut = number.length === 9 ? 5 : 4;
  return {
    national: digits,
    display: `(${digits.slice(0, 2)}) ${number.slice(0, cut)}-${number.slice(cut)}`,
    e164: `+55${digits}`,
    mobile: number.length === 9,
  };
}

// Telefone: formato brasileiro quando reconhecido; senão, mantém como digitado.
export function phoneContact(input) {
  const raw = clean(input, 40);
  if (!raw) return null;
  const br = parseBrazilianPhone(raw);
  if (br) return { ok: true, text: br.display, href: `tel:${br.e164}` };
  const digits = raw.replace(/\D/g, '');
  if (/^[\d\s().+\-/]+$/.test(raw) && digits.length >= 8 && digits.length <= 15) {
    return {
      ok: true,
      text: raw,
      href: `tel:${raw.startsWith('+') ? '+' : ''}${digits}`,
      warning: 'Telefone fora do padrão brasileiro com DDD: ficou como você digitou.',
    };
  }
  return { ok: false, error: 'Telefone inválido: use DDD + número, como (19) 3333-4444.' };
}

export function whatsappContact(input) {
  const raw = clean(input, 40);
  if (!raw) return null;
  const br = parseBrazilianPhone(raw);
  if (br) return { ok: true, text: br.display, href: `https://wa.me/55${br.national}` };
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && /^[\d\s().+\-/]+$/.test(raw) && digits.length >= 8 && digits.length <= 15) {
    return { ok: true, text: raw, href: `https://wa.me/${digits}` };
  }
  return { ok: false, error: 'WhatsApp inválido: use DDD + número, como (19) 99999-9999 (ou +código do país, se for de fora).' };
}

const SOCIAL = {
  linkedin: { host: 'linkedin.com', base: 'https://www.linkedin.com/in/', handle: /^[A-Za-z0-9_-][A-Za-z0-9_%-]{1,99}$/, label: 'LinkedIn' },
  instagram: { host: 'instagram.com', base: 'https://www.instagram.com/', handle: /^[A-Za-z0-9._]{1,30}$/, label: 'Instagram' },
  github: { host: 'github.com', base: 'https://github.com/', handle: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, label: 'GitHub' },
};

/** Perfil em rede social: aceita o endereço completo ou só o usuário (@ opcional). */
export function socialLink(kind, input) {
  const conf = SOCIAL[kind];
  const raw = clean(input, 300);
  if (!raw) return null;
  if (raw.toLowerCase().includes(conf.host)) {
    const r = normalizeUrl(raw);
    if (!r.ok) return { ok: false, error: `${conf.label}: ${r.error}` };
    const host = new URL(r.url).hostname.toLowerCase();
    if (host !== conf.host && !host.endsWith(`.${conf.host}`)) {
      return { ok: false, error: `${conf.label}: o endereço precisa ser do ${conf.host}.` };
    }
    return { ok: true, label: conf.label, url: r.url };
  }
  let handle = raw.replace(/^@/, '');
  if (kind === 'linkedin') handle = handle.replace(/^in\//i, '').replace(/\/$/, '');
  if (!conf.handle.test(handle)) {
    return { ok: false, error: `${conf.label}: informe o endereço do perfil ou só o nome de usuário.` };
  }
  return { ok: true, label: conf.label, url: conf.base + handle };
}

export function normalizeColor(value) {
  const v = String(value ?? '').trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Valida e normaliza os campos do formulário. Campos vazios ficam de fora. */
export function prepareSignature(input = {}) {
  const warnings = [];
  const use = (result) => {
    if (!result) return null;
    if (!result.ok) {
      warnings.push(result.error);
      return null;
    }
    if (result.warning) warnings.push(result.warning);
    return result;
  };

  const name = clean(input.nome);
  const role = clean(input.cargo);
  const company = clean(input.empresa);
  if (!name) warnings.push('Preencha o nome.');

  let color = normalizeColor(input.cor);
  if (!color) {
    if (String(input.cor ?? '').trim()) warnings.push('Cor inválida: usando a cor padrão.');
    color = DEFAULT_COLOR;
  }
  if (contrastRatio(color, '#ffffff') < 4.5) {
    warnings.push('A cor escolhida tem pouco contraste com fundo branco: links e cargo podem ficar difíceis de ler.');
  }

  const contacts = [];
  const phone = use(phoneContact(input.telefone));
  if (phone) contacts.push({ key: 'phone', label: 'Tel.', text: phone.text, href: phone.href });
  const whatsapp = use(whatsappContact(input.whatsapp));
  if (whatsapp) contacts.push({ key: 'whatsapp', label: 'WhatsApp', text: whatsapp.text, href: whatsapp.href });
  const email = use(normalizeEmail(input.email));
  if (email) contacts.push({ key: 'email', label: 'E-mail', text: email.email, href: email.href });
  const siteRaw = clean(input.site, 300);
  if (siteRaw) {
    const site = normalizeUrl(siteRaw);
    if (site.ok) contacts.push({ key: 'site', label: 'Site', text: displayUrl(site.url), href: site.url });
    else warnings.push(`Site: ${site.error}`);
  }

  const social = ['linkedin', 'instagram', 'github']
    .map((kind) => use(socialLink(kind, input[kind])))
    .filter(Boolean)
    .map(({ label, url }) => ({ label, url }));

  let photo = null;
  const photoRaw = String(input.foto ?? '').trim();
  if (photoRaw) {
    if (/^(?:data|blob|file):/i.test(photoRaw) || /^[a-z]:\\/i.test(photoRaw) || photoRaw.startsWith('/')) {
      warnings.push('A foto precisa ser um endereço público na internet (https://…). Arquivos do computador e imagens coladas não aparecem para quem recebe o e-mail.');
    } else {
      const r = normalizeUrl(photoRaw);
      if (!r.ok) warnings.push(`Foto: ${r.error}`);
      else {
        if (r.url.startsWith('http:')) warnings.push('Foto: prefira um endereço https://, alguns programas de e-mail bloqueiam imagens http.');
        photo = { src: r.url, alt: name || company || 'Foto' };
      }
    }
  }

  return {
    data: {
      name,
      role,
      company,
      address: clean(input.endereco, 300),
      disclaimer: clean(input.aviso, 800),
      color,
      contacts,
      social,
      photo,
    },
    warnings,
  };
}

// ---------- Montagem do HTML ----------

const table = (style = '') => `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;${style}">`;

function link(href, text, style) {
  return `<a href="${escapeHtml(href)}" style="${style}">${escapeHtml(text)}</a>`;
}

function contactValue(item, color) {
  return item.href ? link(item.href, item.text, `color:${color};text-decoration:none;`) : escapeHtml(item.text);
}

function roleLine(d) {
  return [d.role, d.company].filter(Boolean).map(escapeHtml).join(' · ');
}

function socialLine(d) {
  return d.social
    .map((s) => link(s.url, s.label, `color:${d.color};text-decoration:none;font-weight:bold;`))
    .join(` <span style="color:${SOFT};">·</span> `);
}

function image(photo, size) {
  return `<img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0;border-radius:${size / 2}px;">`;
}

function paragraph(content, style) {
  return `<p style="margin:0;font-family:${FONT};${style}">${content}</p>`;
}

function classicLayout(d) {
  const rows = [];
  if (d.name) rows.push(paragraph(escapeHtml(d.name), `font-size:18px;line-height:24px;font-weight:bold;color:${STRONG};`));
  if (roleLine(d)) rows.push(paragraph(roleLine(d), `font-size:14px;line-height:20px;color:${d.color};`));
  const details = [];
  for (const item of d.contacts) {
    details.push(paragraph(`<span style="color:${SOFT};">${item.label}:</span> ${contactValue(item, TEXT)}`, `font-size:13px;line-height:20px;color:${TEXT};`));
  }
  if (d.address) details.push(paragraph(escapeHtml(d.address), `font-size:13px;line-height:20px;color:${TEXT};`));
  if (details.length) rows.push(`<div style="margin:8px 0 0 0;">${details.join('')}</div>`);
  if (d.social.length) rows.push(paragraph(socialLine(d), 'margin-top:8px;font-size:13px;line-height:20px;'));
  const photoCell = d.photo
    ? `<td valign="top" style="padding:0 16px 0 0;vertical-align:top;">${image(d.photo, 96)}</td>`
    : '';
  return `${table()}<tr>${photoCell}<td valign="top" style="padding:0 0 0 16px;border-left:3px solid ${d.color};vertical-align:top;">${rows.join('')}</td></tr></table>`;
}

function compactLayout(d) {
  const lines = [];
  const head = [];
  if (d.name) head.push(`<strong style="font-size:14px;color:${STRONG};">${escapeHtml(d.name)}</strong>`);
  if (roleLine(d)) head.push(`<span style="color:${d.color};">${roleLine(d)}</span>`);
  if (head.length) lines.push(head.join(` <span style="color:${SOFT};">|</span> `));
  const contacts = d.contacts.map((item) => {
    const prefix = item.key === 'phone' || item.key === 'whatsapp' ? `<span style="color:${SOFT};">${item.label}</span> ` : '';
    return prefix + contactValue(item, TEXT);
  });
  if (contacts.length) lines.push(contacts.join(` <span style="color:${SOFT};">|</span> `));
  if (d.address) lines.push(escapeHtml(d.address));
  if (d.social.length) lines.push(socialLine(d));
  const photoCell = d.photo
    ? `<td valign="middle" style="padding:0 12px 0 0;vertical-align:middle;">${image(d.photo, 56)}</td>`
    : '';
  return `${table()}<tr>${photoCell}<td valign="middle" style="font-family:${FONT};font-size:13px;line-height:20px;color:${TEXT};vertical-align:middle;">${lines.join('<br>')}</td></tr></table>`;
}

function modernLayout(d) {
  const head = [];
  if (d.name) head.push(paragraph(escapeHtml(d.name), `font-size:20px;line-height:26px;font-weight:bold;color:${STRONG};`));
  if (d.role) head.push(paragraph(escapeHtml(d.role), `font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${d.color};`));
  if (d.company) head.push(paragraph(escapeHtml(d.company), `font-size:13px;line-height:19px;color:${TEXT};`));
  const headCells = (d.photo ? `<td valign="middle" style="padding:0 14px 0 0;vertical-align:middle;">${image(d.photo, 72)}</td>` : '')
    + `<td valign="middle" style="vertical-align:middle;">${head.join('')}</td>`;
  const parts = [`${table()}<tr>${headCells}</tr></table>`];

  const rows = d.contacts.map((item) => `<tr><td style="padding:1px 10px 1px 0;font-family:${FONT};font-size:11px;line-height:19px;font-weight:bold;text-transform:uppercase;color:${d.color};vertical-align:top;">${item.label}</td><td style="padding:1px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${TEXT};vertical-align:top;">${contactValue(item, TEXT)}</td></tr>`);
  if (d.address) rows.push(`<tr><td style="padding:1px 10px 1px 0;font-family:${FONT};font-size:11px;line-height:19px;font-weight:bold;text-transform:uppercase;color:${d.color};vertical-align:top;">Endereço</td><td style="padding:1px 0;font-family:${FONT};font-size:13px;line-height:19px;color:${TEXT};vertical-align:top;">${escapeHtml(d.address)}</td></tr>`);
  if (rows.length) parts.push(`${table('margin-top:10px;')}${rows.join('')}</table>`);
  if (d.social.length) parts.push(paragraph(socialLine(d), 'margin-top:10px;font-size:13px;line-height:20px;'));
  return `${table()}<tr><td width="6" bgcolor="${d.color}" style="width:6px;background-color:${d.color};font-size:1px;line-height:1px;">&nbsp;</td><td style="padding:4px 0 4px 16px;">${parts.join('')}</td></tr></table>`;
}

/** HTML pronto para colar no programa de e-mail. */
export function buildSignatureHtml(prepared, layout = 'classico') {
  const d = prepared.data;
  const builders = { classico: classicLayout, compacto: compactLayout, moderno: modernLayout };
  const body = (builders[layout] || classicLayout)(d);
  const disclaimer = d.disclaimer
    ? paragraph(escapeHtml(d.disclaimer), `margin-top:14px;max-width:560px;font-size:11px;line-height:16px;color:${SOFT};`)
    : '';
  return `<div style="font-family:${FONT};font-size:13px;line-height:20px;color:${TEXT};">${body}${disclaimer}</div>`;
}

/** Versão em texto puro (usada junto com o HTML na área de transferência). */
export function buildSignatureText(prepared) {
  const d = prepared.data;
  const lines = [];
  if (d.name) lines.push(d.name);
  const role = [d.role, d.company].filter(Boolean).join(' · ');
  if (role) lines.push(role);
  for (const item of d.contacts) lines.push(`${item.label}: ${item.text}`);
  if (d.address) lines.push(d.address);
  for (const s of d.social) lines.push(`${s.label}: ${s.url}`);
  if (d.disclaimer) lines.push('', d.disclaimer);
  return lines.join('\n');
}
