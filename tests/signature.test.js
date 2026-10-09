import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml, normalizeUrl, displayUrl, normalizeEmail, parseBrazilianPhone, phoneContact,
  whatsappContact, socialLink, normalizeColor, contrastRatio, prepareSignature,
  buildSignatureHtml, buildSignatureText, LAYOUTS, DEFAULT_COLOR,
} from '../src/signature.js';

const FULL = {
  nome: 'Maria Exemplo',
  cargo: 'Analista de Marketing',
  empresa: 'Lanchonete Exemplo',
  telefone: '(19) 3333-4444',
  whatsapp: '19999999999',
  email: 'maria@example.com',
  site: 'example.com',
  endereco: 'Rua Exemplo, 100 — Centro, São Paulo/SP',
  linkedin: 'maria-exemplo',
  instagram: '@lanchonete.exemplo',
  github: 'maria-exemplo',
  foto: 'https://example.com/foto.jpg',
  cor: '#0f766e',
  aviso: 'Esta mensagem pode conter informações confidenciais.',
};

test('escapa HTML', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("O'Neil & Cia"), 'O&#39;Neil &amp; Cia');
  assert.equal(escapeHtml(null), '');
});

test('tentativas de injeção viram texto', () => {
  const attack = {
    ...FULL,
    nome: '"><img src=x onerror=alert(1)>',
    cargo: '<script>alert(1)</script>',
    empresa: "'><svg onload=alert(1)>",
    endereco: '</td></tr></table><script>alert(1)</script>',
    aviso: '<iframe src="https://example.com"></iframe>',
  };
  for (const layout of Object.keys(LAYOUTS)) {
    const html = buildSignatureHtml(prepareSignature(attack), layout);
    assert.ok(!html.includes('<script'), layout);
    assert.ok(!html.includes('<img src=x'), layout);
    assert.ok(!html.includes('<svg'), layout);
    assert.ok(!html.includes('<iframe'), layout);
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), layout);
    assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'), layout);
    // O texto atacante também não escapa do atributo alt da foto.
    assert.ok(html.includes('alt="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'), layout);
  }
});

test('normaliza endereços e acrescenta https://', () => {
  assert.deepEqual(normalizeUrl('example.com'), { ok: true, url: 'https://example.com/' });
  assert.deepEqual(normalizeUrl('  www.example.com/contato '), { ok: true, url: 'https://www.example.com/contato' });
  assert.deepEqual(normalizeUrl('http://example.com/a?b=1'), { ok: true, url: 'http://example.com/a?b=1' });
  assert.deepEqual(normalizeUrl('//example.com/x'), { ok: true, url: 'https://example.com/x' });
  assert.deepEqual(normalizeUrl('example.com:8080/painel'), { ok: true, url: 'https://example.com:8080/painel' });
  assert.deepEqual(normalizeUrl('https://example.com/minha página'), { ok: true, url: 'https://example.com/minha%20p%C3%A1gina' });
  assert.deepEqual(normalizeUrl(''), { ok: true, url: '' });
  assert.equal(displayUrl('https://www.example.com/contato/'), 'www.example.com/contato');
  assert.equal(displayUrl('https://example.com/'), 'example.com');
});

test('rejeita javascript: e outros esquemas perigosos', () => {
  const attacks = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '   javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '\u0001javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ];
  for (const url of attacks) {
    const r = normalizeUrl(url);
    assert.equal(r.ok, false, JSON.stringify(url));
    assert.ok(r.error.length > 0);
  }
  // Nada que pareça esquema perigoso sobrevive como link.
  assert.equal(normalizeUrl('javascript&colon;alert(1)').ok, false);
  assert.equal(normalizeUrl('localhost').ok, false);
  assert.equal(normalizeUrl('https://usuario:senha@example.com').ok, false);
  assert.equal(normalizeUrl('https://').ok, false);
});

test('mailto e tel só quando permitidos', () => {
  const all = { allow: ['http', 'https', 'mailto', 'tel'] };
  assert.equal(normalizeUrl('mailto:maria@example.com').ok, false);
  assert.deepEqual(normalizeUrl('mailto:maria@example.com', all), { ok: true, url: 'mailto:maria@example.com' });
  assert.deepEqual(normalizeUrl('tel:+55 (19) 3333-4444', all), { ok: true, url: 'tel:+551933334444' });
  assert.equal(normalizeUrl('mailto:nao-e-email', all).ok, false);
  assert.equal(normalizeUrl('tel:123', all).ok, false);
  assert.equal(normalizeUrl('mailto:%E0%A4%A', all).ok, false);
});

test('valida e-mail', () => {
  assert.deepEqual(normalizeEmail(' maria@example.com '), { ok: true, email: 'maria@example.com', href: 'mailto:maria@example.com' });
  assert.equal(normalizeEmail('maria.exemplo+news@sub.example.com.br').ok, true);
  for (const bad of ['maria', 'maria@', '@example.com', 'maria@example', 'ma ria@example.com', 'maria@exa_mple.com', '"x"@example.com']) {
    assert.equal(normalizeEmail(bad).ok, false, bad);
  }
  assert.equal(normalizeEmail(''), null);
});

test('formata telefones brasileiros', () => {
  assert.deepEqual(parseBrazilianPhone('(19) 3333-4444'), { national: '1933334444', display: '(19) 3333-4444', e164: '+551933334444', mobile: false });
  assert.equal(parseBrazilianPhone('19999999999').display, '(19) 99999-9999');
  assert.equal(parseBrazilianPhone('+55 11 98765-4321').display, '(11) 98765-4321');
  assert.equal(parseBrazilianPhone('5511987654321').e164, '+5511987654321');
  assert.equal(parseBrazilianPhone('(011) 3333-4444').display, '(11) 3333-4444');
  assert.equal(parseBrazilianPhone('(20) 99999-9999'), null); // DDD inexistente
  assert.equal(parseBrazilianPhone('(19) 89999-9999'), null); // celular sem o 9
  assert.equal(parseBrazilianPhone('(19) 7333-4444'), null); // fixo começa com 2 a 5
  assert.equal(parseBrazilianPhone('3333-4444'), null); // sem DDD
});

test('links tel: e wa.me', () => {
  assert.deepEqual(phoneContact('(19) 3333-4444'), { ok: true, text: '(19) 3333-4444', href: 'tel:+551933334444' });
  assert.deepEqual(whatsappContact('(19) 99999-9999'), { ok: true, text: '(19) 99999-9999', href: 'https://wa.me/5519999999999' });
  // Número de fora do Brasil fica como digitado.
  const intl = phoneContact('+351 21 000 0000');
  assert.equal(intl.text, '+351 21 000 0000');
  assert.equal(intl.href, 'tel:+351210000000');
  assert.ok(intl.warning);
  assert.equal(phoneContact('0800 123 4567').href, 'tel:08001234567');
  assert.equal(whatsappContact('+351 912 345 678').href, 'https://wa.me/351912345678');
  assert.equal(whatsappContact('3333-4444').ok, false);
  assert.equal(phoneContact('abc').ok, false);
  assert.equal(phoneContact(''), null);
});

test('redes sociais aceitam usuário ou endereço completo', () => {
  assert.equal(socialLink('linkedin', 'maria-exemplo').url, 'https://www.linkedin.com/in/maria-exemplo');
  assert.equal(socialLink('linkedin', 'in/maria-exemplo/').url, 'https://www.linkedin.com/in/maria-exemplo');
  assert.equal(socialLink('linkedin', 'linkedin.com/company/lanchonete-exemplo').url, 'https://linkedin.com/company/lanchonete-exemplo');
  assert.equal(socialLink('instagram', '@lanchonete.exemplo').url, 'https://www.instagram.com/lanchonete.exemplo');
  assert.equal(socialLink('instagram', 'https://www.instagram.com/lanchonete.exemplo/').url, 'https://www.instagram.com/lanchonete.exemplo/');
  assert.equal(socialLink('github', 'maria-exemplo').url, 'https://github.com/maria-exemplo');
  assert.equal(socialLink('github', 'github.com/maria-exemplo').url, 'https://github.com/maria-exemplo');
  assert.equal(socialLink('instagram', 'https://instagram.com.example.com/x').ok, false);
  assert.equal(socialLink('linkedin', 'https://example.com/linkedin.com').ok, false);
  assert.equal(socialLink('linkedin', 'javascript:alert(1)//linkedin.com').ok, false);
  assert.equal(socialLink('github', '-invalido').ok, false);
  assert.equal(socialLink('instagram', 'nome com espaço').ok, false);
  assert.equal(socialLink('github', '  '), null);
});

test('cor e contraste', () => {
  assert.equal(normalizeColor('#0F766E'), '#0f766e');
  assert.equal(normalizeColor('red'), null);
  assert.equal(normalizeColor('#fff'), null);
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.ok(contrastRatio(DEFAULT_COLOR, '#ffffff') >= 4.5);
  const light = prepareSignature({ ...FULL, cor: '#fde68a' });
  assert.ok(light.warnings.some((w) => w.includes('contraste')));
  const invalid = prepareSignature({ ...FULL, cor: 'azul' });
  assert.equal(invalid.data.color, DEFAULT_COLOR);
  assert.ok(invalid.warnings.some((w) => w.includes('Cor inválida')));
});

test('cada layout tem as partes esperadas e é seguro para e-mail', () => {
  const prepared = prepareSignature(FULL);
  assert.deepEqual(prepared.warnings, []);
  for (const layout of Object.keys(LAYOUTS)) {
    const html = buildSignatureHtml(prepared, layout);
    for (const part of ['Maria Exemplo', 'Analista de Marketing', 'Lanchonete Exemplo', '(19) 3333-4444',
      'href="tel:+551933334444"', 'href="https://wa.me/5519999999999"', 'href="mailto:maria@example.com"',
      'href="https://example.com/"', 'Rua Exemplo, 100', 'href="https://www.linkedin.com/in/maria-exemplo"',
      'href="https://www.instagram.com/lanchonete.exemplo"', 'href="https://github.com/maria-exemplo"',
      'src="https://example.com/foto.jpg"', 'informações confidenciais', '#0f766e']) {
      assert.ok(html.includes(part), `${layout}: falta ${part}`);
    }
    assert.ok(html.includes('<table'), layout);
    assert.ok(!/class=/i.test(html), `${layout}: tem class=`);
    assert.ok(!/<script|<style|<link|<\/?html|<body/i.test(html), `${layout}: tag proibida`);
    assert.ok(!/\d(?:em|rem|pt)\b/.test(html), `${layout}: use px`);
    assert.ok(html.includes('font-family:Arial, Helvetica, sans-serif'), layout);
    // Toda imagem tem alt e tamanho em px.
    for (const img of html.match(/<img[^>]*>/g)) {
      assert.match(img, /alt="[^"]+"/);
      assert.match(img, /width="\d+"/);
      assert.match(img, /width:\d+px/);
    }
  }
  assert.ok(buildSignatureHtml(prepared, 'moderno').includes('bgcolor="#0f766e"'));
  assert.ok(buildSignatureHtml(prepared, 'classico').includes('border-left:3px solid #0f766e'));
  // Layout desconhecido cai no clássico.
  assert.equal(buildSignatureHtml(prepared, 'outro'), buildSignatureHtml(prepared, 'classico'));
});

test('campos opcionais vazios ficam de fora', () => {
  const prepared = prepareSignature({ nome: 'Maria Exemplo', email: 'maria@example.com', cor: '#0f766e' });
  assert.deepEqual(prepared.warnings, []);
  for (const layout of Object.keys(LAYOUTS)) {
    const html = buildSignatureHtml(prepared, layout);
    assert.ok(html.includes('Maria Exemplo'));
    assert.ok(html.includes('mailto:maria@example.com'));
    for (const absent of ['Tel.', 'WhatsApp', 'Site', 'LinkedIn', 'Instagram', 'GitHub', '<img', 'Endereço', ' · ', 'font-size:11px;line-height:16px']) {
      assert.ok(!html.includes(absent), `${layout}: não deveria ter ${absent}`);
    }
  }
  assert.equal(buildSignatureText(prepared), 'Maria Exemplo\nE-mail: maria@example.com');
});

test('avisos claros para campos inválidos', () => {
  const prepared = prepareSignature({
    nome: '', email: 'maria@', telefone: '123', whatsapp: '3333-4444', site: 'javascript:alert(1)',
    linkedin: 'https://example.com', foto: 'C:\\Users\\maria\\foto.png', cor: '#0f766e',
  });
  const text = prepared.warnings.join(' | ');
  for (const expected of ['Preencha o nome', 'E-mail inválido', 'Telefone inválido', 'WhatsApp inválido', 'Site:', 'LinkedIn', 'endereço público']) {
    assert.ok(text.includes(expected), `falta aviso: ${expected}`);
  }
  assert.deepEqual(prepared.data.contacts, []);
  assert.equal(prepared.data.photo, null);
  const dataUrl = prepareSignature({ nome: 'Maria', foto: 'data:image/png;base64,AAAA' });
  assert.equal(dataUrl.data.photo, null);
  const http = prepareSignature({ nome: 'Maria', foto: 'http://example.com/f.png' });
  assert.equal(http.data.photo.src, 'http://example.com/f.png');
  assert.ok(http.warnings.some((w) => w.includes('https')));
});

test('versão em texto puro', () => {
  const text = buildSignatureText(prepareSignature(FULL));
  assert.equal(text, [
    'Maria Exemplo',
    'Analista de Marketing · Lanchonete Exemplo',
    'Tel.: (19) 3333-4444',
    'WhatsApp: (19) 99999-9999',
    'E-mail: maria@example.com',
    'Site: example.com',
    'Rua Exemplo, 100 — Centro, São Paulo/SP',
    'LinkedIn: https://www.linkedin.com/in/maria-exemplo',
    'Instagram: https://www.instagram.com/lanchonete.exemplo',
    'GitHub: https://github.com/maria-exemplo',
    '',
    'Esta mensagem pode conter informações confidenciais.',
  ].join('\n'));
});
