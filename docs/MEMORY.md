# Decisões

2026-10-11: o utilizador prefere mais notícias, mesmo sem imagem. Revertida a seleção exclusiva de artigos com miniatura introduzida no commit 66cab7f. Falhas de imagem deixam de retirar artigos; recupera-se a pesquisa progressiva de miniaturas. Mantêm-se lista contínua e imagens maiores.

Feeds RSS diretos podem incluir imagens no próprio XML. O Prisma também usa RSS; a diferença é o conteúdo fornecido por cada fonte, sobretudo pesquisas Google Notícias versus feeds dos editores. O código já lê enclosure, media:content, miniaturas e imagens do conteúdo.
