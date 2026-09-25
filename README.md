# PRISMA — Notícias em perspetiva

Plataforma de notícias em português de Portugal, com interface HTML/CSS/JavaScript e um serviço JavaScript de recolha RSS. Esta pasta está preparada para ser colocada num repositório GitHub.

## Colocar no GitHub

1. Descompacte o ZIP.
2. Crie um repositório no GitHub, por exemplo `prisma-noticias`.
3. Escolha **Add file → Upload files**. Num repositório vazio, utilize a opção para carregar ficheiros existentes.
4. Arraste **o conteúdo da pasta `prisma-noticias`**, mantendo as subpastas. O `package.json`, o `README.md` e o `wrangler.jsonc` devem ficar na raiz do repositório.
5. Confirme em **Commit changes**.

Carregue os ficheiros extraídos, não apenas o ZIP. Não é necessário carregar a pasta `node_modules`: as dependências são instaladas a partir do `package-lock.json`.

## Alojamento: GitHub + Cloudflare Workers

O GitHub guarda e versiona o código. O serviço `/api/news` precisa de um ambiente de execução: **esta versão não funciona integralmente apenas com GitHub Pages**, nem abrindo `public/index.html` diretamente no computador.

A configuração incluída permite alojar a interface e a API juntas em **Cloudflare Workers**, sem ter de configurar outro endereço de API. Não é necessário Apps Script. Não existem chaves de notícias ou credenciais no projeto.

### Publicar ligando o GitHub à Cloudflare

1. Entre na sua conta Cloudflare e abra **Workers & Pages**.
2. Crie um **Worker** com integração Git e selecione o repositório GitHub.
3. Utilize o nome `prisma-noticias`, igual ao campo `name` de `wrangler.jsonc`. Se escolher outro, altere também esse campo.
4. Na configuração de construção, indique:

| Opção | Valor |
|---|---|
| Diretório do projeto | Raiz do repositório |
| Comando de construção | `npm ci && npm run build` |
| Comando de publicação | `npx wrangler deploy` |
| Ramo principal | O ramo principal do seu repositório, normalmente `main` |

5. Conclua a configuração para publicar no endereço atribuído pela Cloudflare.

As alterações enviadas ao ramo configurado podem ser publicadas automaticamente pela integração Git. Consulte os limites e as condições do seu plano Cloudflare. Esta exportação não inclui o controlo de acesso do ChatGPT: o Worker não tem autenticação própria. Se quiser limitar o acesso, configure-o no alojamento antes de divulgar o endereço.

### Utilizar no computador

Instale Node.js 22 ou superior. Abra um terminal nesta pasta e execute:

```bash
npm ci
npm run dev
```

Abra o endereço local indicado pelo Wrangler. A recolha RSS necessita de acesso à Internet. Termine o servidor com `Ctrl+C`.

### Publicar pelo terminal, como alternativa

```bash
npm ci
npx wrangler login
npm run deploy
```

O login é feito na sua conta Cloudflare; não coloque tokens no repositório.

## Funcionalidades incluídas

- Notícias dos últimos 30 dias e projetos/iniciativas do último ano.
- Recolha ao abrir, mudar de tema e a cada 15 minutos enquanto a página está aberta. Não existe uma tarefa de recolha contínua com a página fechada.
- Pesquisas RSS no Google Notícias em português e inglês, complementadas pelos feeds diretos da Ambiente Magazine e do The Guardian.
- Pesquisa por texto, ordenação por data e filtro por língua. «Internacional» refere-se à língua do título, não ao país. Em títulos ambíguos, utiliza-se a língua do feed, assinalada com um asterisco.
- Remoção de duplicados e consulta do estado das fontes. A versão anterior de um feed pode ser utilizada, durante até 24 horas, em caso de falha; essa situação é identificada.
- Partilha no LinkedIn, Facebook, WhatsApp e X, cópia da ligação e partilha nativa quando suportada pelo navegador.
- Ficha PDF através da janela de impressão: título, excerto disponível, fonte, data e ligação. Não equivale ao texto integral de uma publicação externa.

### Temas

Ambiente; Água; Resíduos / reciclagem; Biorresíduos; Infraestruturas; Espaços verdes; Planeamento urbanístico; Mobilidade; Sustentabilidade; Ciência; Tecnologia; Cultura; Engenharia aplicada à água e infraestruturas; Arquitetura Paisagística; Higiene e Segurança no Trabalho; Normas.

O tema **Normas** está limitado a **NP 4552, ISO 14001, ISO 50001 e ISO 9001**. A filtragem verifica os códigos nos títulos e excertos disponibilizados pelos feeds e exclui referências explícitas a outras normas. Não analisa o texto integral de cada publicação.

## Onde editar

| Ficheiro | Função |
|---|---|
| `public/index.html` | Estrutura e textos da interface |
| `public/style.css` | Design, apresentação em telemóvel e impressão |
| `public/app.js` | Navegação, pesquisa, filtros e atualização |
| `public/article-actions.js` | Partilha e ficha PDF |
| `src/topics.js` | Temas, termos de pesquisa, fontes e normas |
| `src/feed.js` | Leitura RSS, classificação, língua e duplicados |
| `src/worker.js` | Serviço `/api/news`, cache e entrega da interface |
| `build.mjs` | Compilação da interface e do Worker |
| `wrangler.jsonc` | Configuração Cloudflare Workers |
| `test/` | Testes automáticos |

A pasta `dist/` é gerada por `npm run build`; não deve ser editada manualmente. A exportação não depende de ficheiros privados de configuração do ChatGPT.

## Validação

```bash
npm test
npm run check:deploy
```

O primeiro comando compila e executa os testes. O segundo valida o pacote com o Wrangler em modo `--dry-run`: **não publica o site**.

Os testes cobrem processamento RSS, língua, datas, duplicados, cache, falhas de fontes, restrição das normas, ligações de partilha e conteúdo da ficha PDF. Não substituem uma verificação visual nem confirmam a disponibilidade futura dos serviços externos.

## Sobre os conteúdos

As notícias pertencem às publicações de origem. A plataforma apresenta títulos, pequenos excertos quando fornecidos e ligações para leitura; não contorna subscrições. Os projetos e boas práticas são encontrados automaticamente e não constituem um ranking ou uma certificação de eficácia. A cobertura depende da disponibilidade dos feeds e da indexação no Google Notícias.

## Documentação do alojamento

- [Configuração Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Configuração das construções ligadas ao Git](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
