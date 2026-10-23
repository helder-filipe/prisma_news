# Decisões

2026-10-11: o utilizador prefere mais notícias, mesmo sem imagem. Revertida a seleção exclusiva de artigos com miniatura introduzida no commit 66cab7f. Falhas de imagem deixam de retirar artigos; recupera-se a pesquisa progressiva de miniaturas. Mantêm-se lista contínua e imagens maiores.

Feeds RSS diretos podem incluir imagens no próprio XML. O Prisma também usa RSS; a diferença é o conteúdo fornecido por cada fonte, sobretudo pesquisas Google Notícias versus feeds dos editores. O código já lê enclosure, media:content, miniaturas e imagens do conteúdo.

2026-10-23: a extensão do parser de imagens não resolveu o principal problema. Amostra da API Água: 17/154 com imagem; 134 falhas vinham de Google Notícias. Introduzida resolução da ligação original, antes do fallback à homepage/RSS. Amostra real de oito notícias sem imagem: 8 URLs originais resolvidos e 6 imagens encontradas; dois editores devolveram HTTP 403. Caches antigas invalidadas, cache negativa reduzida de dez para dois minutos. Não prometer 100% de cobertura nem confundir build Ready com confirmação visual.
