# Silesthe

Calculadora de precificação de **sabonetes artesanais**, feita para usar no celular. Substitui a planilha por uma interface simples, rápida e pensada para a palma da mão.

É um **PWA** (instalável e funciona **offline**) em HTML, CSS e JavaScript puro — sem framework e sem build. Os dados ficam **só no seu aparelho** (localStorage). Interface em português.

## Telas
- **Receitas** — preços sugeridos por forma, com custo, preço mínimo e lucro por unidade; e um resumo do lote (receita bruta, lucro, margem real e R$/hora). Edita e recalcula na hora.
- **Insumos** — catálogo de materiais; o custo por g/ml sai sozinho (preço do pacote ÷ tamanho).
- **Ajustes** — margem, taxa, embalagem, valor/hora, arredondamento e **backup** (exportar/importar).

## Estrutura
- `index.html` — telas do app
- `css/styles.css` — estilo mobile-first
- `js/store.js` — dados e persistência local (localStorage) + backup
- `js/pricing.js` — cálculo de preços
- `js/app.js` — interface
- `manifest.webmanifest`, `sw.js`, `icons/icon.svg` — PWA (instalável + offline)
- `.github/workflows/pages.yml` — publicação automática no GitHub Pages

## Como o preço é calculado
1. Custo de cada insumo por unidade = preço do pacote ÷ tamanho. Ex.: R$ 20,00 ÷ 1000 g = R$ 0,02/g.
2. Custo do lote (insumos) = soma de (quantidade × custo unitário) de **todos** os ingredientes.
3. Cada forma rateia o custo de insumo **por peso**: `custo_un = (peso_da_forma ÷ peso_total_do_lote) × custo_do_lote`.
4. Embalagem por unidade = valor fixo das premissas.
5. Mão de obra por unidade = `(tempo_do_lote_min ÷ 60 × valor_da_hora) ÷ total_de_unidades`.
6. Custo total/un = insumo + embalagem + mão de obra.
7. **Preço** — dois métodos (escolhidos em Ajustes):
   - **Markup** (padrão): `preço = custo × (1 + margem)`. Ex.: 100% → o dobro do custo.
   - **Sobre o preço de venda**: `preço = custo ÷ (1 − margem − taxa)` (aqui a margem precisa ser < 100%).
8. **Preço sugerido** = arredonda o preço **para cima** no múltiplo configurado (padrão: 5).

Resumo do lote: receita bruta, custo, lucro, margem real e equivalente em R$/hora.

## Premissas padrão (em Ajustes)
- Método da margem: **markup** (margem sobre o custo)
- Margem: 100% (markup → o dobro do custo)
- Taxa de plataforma: 0%
- Embalagem por unidade: R$ 1,00
- Valor da hora: R$ 0/h
- Ratear mão de obra e embalagem: por unidade (pode mudar para por peso)
- Arredondamento: múltiplo de 5 (use 0 para não arredondar)

> Os dados que vêm preenchidos são **apenas exemplos genéricos**. Para carregar seus próprios dados de uma vez, use **Ajustes → Importar backup**.

## Rodar localmente
`python3 -m http.server 8000` e abra `http://localhost:8000` (o modo offline/instalação só funciona via http/https).

## Publicar (GitHub Pages)
Há um workflow (`.github/workflows/pages.yml`) que publica automaticamente no GitHub Pages a cada push na branch padrão. A URL aparece no resumo da execução em **Actions** e em **Settings → Pages**.

## Instalar no celular
Abra a URL pública no navegador do celular e use **Adicionar à tela inicial** (Android/Chrome: menu ⋮; iPhone/Safari: botão Compartilhar). Depois funciona offline, como um app.

## Backup
Os dados ficam só no aparelho. Em **Ajustes** use **Exportar backup** (.json) e **Importar backup**. Útil ao trocar de celular ou limpar o navegador.
