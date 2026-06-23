# Silesthe

Calculadora de precificação de **sabonetes artesanais**, pensada para usar no celular. O Silesthe substitui aquela planilha de Excel que era um sofrimento mexer no telefone, trazendo a mesma conta para uma interface simples, rápida e feita para a palma da sua mão.

É um **PWA (Progressive Web App)** feito em HTML, CSS e JavaScript puro — sem framework, sem build, sem complicação. Funciona **offline** e guarda os dados **apenas no próprio aparelho** (localStorage). A interface é 100% em português.

---

## ✨ Destaques

- 📱 **Mobile-first**: feito para o celular, mas funciona em qualquer navegador.
- 🔌 **Offline**: depois de aberto, roda mesmo sem internet.
- 📲 **Instalável**: dá para adicionar à tela inicial e usar como um app de verdade.
- 🔒 **Privado**: seus dados ficam só no seu aparelho.
- 🧮 **Cálculo completo**: insumos, embalagem, mão de obra, margem, taxas e arredondamento.

---

## 📂 Estrutura do projeto

- `index.html` — estrutura e telas do app
- `css/styles.css` — estilo (mobile-first)
- `js/store.js` — dados e persistência local (localStorage), exportar/importar backup
- `js/pricing.js` — toda a matemática de precificação
- `js/app.js` — interface e interações
- `manifest.webmanifest`, `sw.js`, `icons/icon.svg` — arquivos do PWA (instalável + offline)
- `README.md` — este arquivo

---

## 🧮 Como o cálculo funciona

O app espelha uma planilha de 3 partes: **Insumos**, **Precificação** e **Simulação de Receita**. O caminho do cálculo é o seguinte:

### 1. Custo de cada insumo por unidade

```
custo_unitário = preço_do_pacote ÷ peso_ou_volume_do_pacote
```

Exemplo: Base R$24,90 ÷ 1000 g = **R$0,0249/g**.

### 2. Receita do lote

Você monta uma lista de ingredientes com suas quantidades. O custo total dos insumos do lote é a soma de **todos** os ingredientes:

```
custo_total_do_lote = Σ (quantidade × custo_unitário)   ← para TODOS os ingredientes
```

### 3. Rateio por forma (por peso)

As **formas** (os tipos de sabonete — ex.: Folhas 50g, Retangular 100g, Massageadora 180g, Redonda 110g) dividem o lote. O custo de insumo de cada forma é rateado **por peso**:

```
peso_total_do_lote = Σ (peso_da_forma × quantidade)   ← de todas as formas

custo_insumo_un = (peso_da_forma ÷ peso_total_do_lote) × custo_total_do_lote
```

### 4. Embalagem por unidade

Valor fixo definido nas premissas (ex.: **R$1,325**).

### 5. Mão de obra por unidade

Rateio igual por unidade do lote:

```
mão_de_obra_un = (tempo_do_lote_em_minutos ÷ 60 × valor_da_hora) ÷ total_de_unidades_do_lote
```

### 6. Custo total por unidade

```
custo_total_un = custo_insumo_un + embalagem_un + mão_de_obra_un
```

### 7. Preço mínimo

A margem e a taxa entram como fração (ex.: margem 60% e taxa 0% → divide por 0,40):

```
preço_mínimo = custo_total_un ÷ (1 − margem − taxa)
```

### 8. Preço sugerido

Arredonda o preço mínimo **para cima** no múltiplo configurado (padrão: de 5 em 5 — equivalente à função `CEILING` do Excel):

```
preço_sugerido = arredonda_para_cima(preço_mínimo, múltiplo)
```

Exemplo: R$18,89 → **R$20**.

### Resumo do lote (simulação)

Além dos preços, o app mostra um resumo do lote:

- **Receita bruta**: Σ (preço × quantidade)
- **Custo total** do lote
- **Lucro**
- **Margem real** do lote
- **Equivalente em R$/hora trabalhada**: lucro ÷ horas do lote

---

## ⚙️ Premissas padrão

Todas configuráveis na tela **"Ajustes"**:

| Premissa | Valor padrão |
| --- | --- |
| Custo de embalagem por unidade | R$1,325 |
| Margem de lucro desejada | 60% |
| Taxa de plataforma | 0% |
| Valor da hora de trabalho | R$0/h |
| Arredondamento do preço | múltiplo de 5 (use **0** para não arredondar) |

---

## ⚠️ Atenção: diferença em relação à planilha original

> **A planilha original tinha um erro de soma.**
>
> A célula **"TOTAL DO LOTE (insumos)"** usava `=SUM(E14:E17)` e somava **apenas 4 dos 6 ingredientes**, deixando de fora **"Extrato em pó" (R$20,18)** e **"Semente de Colza" (R$1,26)**.
>
> Por causa disso, o custo do lote aparecia como **R$73,51**, quando o custo real é **R$94,95**.
>
> O Silesthe soma **todos** os ingredientes (custo real), então os preços sugeridos ficam um pouco mais altos que os da planilha.

Comparativo dos preços sugeridos:

| Forma | Planilha | App |
| --- | --- | --- |
| Folhas (50g) | R$20 | **R$25** |
| Retangular (100g) | R$35 | **R$45** |
| Massageadora (180g) | R$60 | **R$80** |
| Redonda (110g) | R$40 | **R$50** |

Na prática, isso pode significar que os sabonetes estavam sendo vendidos **um pouco abaixo do custo + margem ideal**. Se você quiser **reproduzir exatamente a planilha** (mesmo com o erro), é só ajustar as premissas em **"Ajustes"**.

---

## ▶️ Como rodar localmente

**Opção recomendada — servir a pasta com um servidor estático:**

```bash
python3 -m http.server 8000
```

Depois acesse [http://localhost:8000](http://localhost:8000) no navegador.

> 💡 Esse é o jeito recomendado porque o service worker (modo offline) só funciona via `http`/`https`, e **não** via `file://`.

**Opção simples — só abrir o arquivo:**

Você também pode apenas abrir o `index.html` no navegador para ver a interface. Porém, assim **não** terá o modo offline nem a instalação.

---

## 🚀 Como publicar de graça no GitHub Pages

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **"Build and deployment"**, defina **Source** = **"Deploy from a branch"**.
3. Selecione a **branch** e a pasta **`/(root)`**, e salve.
4. Em cerca de 1 minuto o app fica acessível numa URL pública `https://…` — ótima para abrir no celular.

---

## 📱 Como instalar no celular (adicionar à tela inicial)

1. Abra a URL pública no navegador do celular (Chrome no Android ou Safari no iPhone).
2. **Android / Chrome**: menu (⋮) → **"Adicionar à tela inicial"** / **"Instalar app"**.
3. **iPhone / Safari**: botão **Compartilhar** → **"Adicionar à Tela de Início"**.
4. Pronto! Agora é só abrir pelo ícone — funciona offline.

---

## 💾 Backup dos dados

Os dados ficam **só no seu aparelho**. Para não perdê-los ao trocar de celular ou limpar o navegador, use as opções na tela **"Ajustes"**:

- **Exportar backup**: baixa um arquivo `.json` com seus dados.
- **Importar backup**: restaura tudo a partir de um arquivo `.json`.

> Dica: faça um backup de tempos em tempos. É rápido e te salva de dores de cabeça. 😉
