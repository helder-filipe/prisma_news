# Arquitetura

Interface HTML/CSS/JavaScript em public/, compilada por build.mjs. API Vercel em api/news.js, serviço em src/worker.js. Parsing RSS/Atom em src/feed.js e imagens em src/images.js. Categorias em src/topics.js.

Feeds diretos e pesquisas Google Notícias. Cache de respostas e URLs de imagens no servidor; cache de miniaturas no navegador. Recuperação progressiva junto da área visível, com duas consultas simultâneas. Fotografias alojadas nas fontes originais.
