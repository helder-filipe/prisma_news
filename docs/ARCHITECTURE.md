# Arquitetura

Interface HTML/CSS/JavaScript em public/, compilada por build.mjs. API Vercel em api/news.js, serviço em src/worker.js. Parsing RSS/Atom em src/feed.js e imagens em src/images.js. Categorias em src/topics.js.

Feeds diretos e pesquisas Google Notícias. Cache de respostas e URLs de imagens no servidor; cache de miniaturas no navegador. Recuperação progressiva junto da área visível, com quatro consultas simultâneas. Fotografias alojadas nas fontes originais.

2026-10-23: src/google-news.js resolve ligações RSS do Google para o artigo original, usando os parâmetros públicos da página e a resposta JSON do redirecionador. Reutiliza resoluções concorrentes e guarda apenas URLs bem-sucedidos. Recuperação visível com quatro consultas simultâneas, uma repetição após falha transitória e cache negativa de dois minutos. Versões de cache renovadas.
