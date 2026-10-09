# Assinatura de E-mail: gere assinaturas profissionais em HTML (HTML + JS)

Montar uma assinatura de e-mail bonita costuma terminar em imagem colada (que vira anexo) ou em HTML que quebra no Outlook. Este gerador cria a assinatura do jeito que os programas de e-mail entendem: tabelas, estilos inline, fontes seguras e nenhum script. Você preenche o formulário, confere a pré-visualização e cola no Gmail, Outlook, Apple Mail ou Thunderbird.

**Acesse online:** https://micdog22.github.io/assinatura-de-email/

## Recursos

- Campos para nome, cargo, empresa, telefone, WhatsApp, e-mail, site, endereço, LinkedIn, Instagram, GitHub, foto ou logo e um aviso legal opcional.
- Três modelos: clássico (foto à esquerda), compacto e moderno (com barra colorida).
- Cor de destaque à sua escolha, com aviso quando ela fica difícil de ler em fundo branco.
- Pré-visualização ao vivo, isolada do resto da página.
- **Copiar assinatura**: copia o HTML formatado (com versão em texto puro junto), pronto para colar.
- **Copiar código HTML**: para programas que pedem o código, como o Thunderbird.
- Passo a passo para Gmail, Outlook (web e Windows), Apple Mail e Thunderbird.
- Telefones no formato brasileiro, com links `tel:` e `https://wa.me/`.
- Os dados ficam só no seu navegador.

## Como usar

1. Preencha os campos (os vazios simplesmente não aparecem na assinatura).
2. Escolha o modelo e a cor.
3. Clique em **Copiar assinatura** e siga o passo a passo do seu programa de e-mail, na própria página.

### Sobre a foto

Programas de e-mail não levam arquivos do seu computador junto com a assinatura: a foto precisa estar publicada na internet, com um endereço `https://` (por exemplo, no seu site). Prefira uma imagem quadrada com pelo menos 192×192 px. Alguns programas só mostram imagens depois que o destinatário permite.

## Como funciona

- **HTML próprio para e-mail:** layout em tabelas, todos os estilos inline, tamanhos em px, fontes Arial/Helvetica, `alt` em todas as imagens. Nada de classes, CSS externo ou scripts.
- **Segurança:** todo texto digitado é escapado antes de entrar no HTML. Endereços ganham `https://` quando faltam e só `http`, `https`, `mailto` e `tel` são aceitos; `javascript:`, `data:` e afins são recusados, inclusive com truques como maiúsculas, espaços ou quebras de linha no meio.
- **Telefones:** números com DDD válido viram `(19) 3333-4444` ou `(19) 99999-9999`, com link `tel:+55…`; o WhatsApp vira `https://wa.me/55…`. Números de fora do Brasil (com `+` e o código do país) ficam como você digitou.
- **Redes sociais:** aceita o endereço completo do perfil ou só o usuário (`@lanchonete.exemplo`, `maria-exemplo`). Endereços de outros sites nesses campos são recusados.

## Como rodar localmente

Módulos ES não carregam via `file://`, então sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

E abra http://localhost:8000.

## Testes

```bash
npm test
```

(ou `node --test`, com Node 18 ou mais recente). Os testes cobrem o escape de HTML (com tentativas de injeção), a normalização de endereços e a recusa de `javascript:`, a formatação de telefones, as partes de cada modelo (sem `<script>` e sem `class=`) e a omissão dos campos vazios.

## Contribuindo

Issues e pull requests são bem-vindos.

## Licença

MIT. Veja [LICENSE](LICENSE).
