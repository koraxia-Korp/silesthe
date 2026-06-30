/*
 * pricing.js — toda a matemática de precificação.
 *
 * Fluxo:
 *  1. Custo de cada insumo por unidade   = precoPacote / tamanhoPacote
 *     (e custo NORMALIZADO por g/ml/un, para comparar insumos de pacotes diferentes)
 *  2. Custo total do lote (insumos)       = Σ (quantidade × custoUnitário)   [todos os ingredientes]
 *  3. Rateio do insumo por PESO entre as formas = (peso_forma / pesoTotalLote) × custoLote
 *  4. Embalagem por unidade               = valor fixo (rateável por unidade OU por peso)
 *  5. Mão de obra                         = (tempo/60 × valorHora), rateada por unidade OU por peso
 *  6. Custo total/un                      = insumo + embalagem + mão de obra
 *  7. Preço — dois métodos:
 *       markup (sobre o custo):  preço = custo × (1 + margem) / (1 − taxa)
 *       divisor (sobre o preço): preço = custo / (1 − margem − taxa)   [margem+taxa < 100%]
 *  8. Preço sugerido = arredonda pra cima no múltiplo definido (CEILING)
 *
 * Também calcula um "alerta de rendimento": compara a massa de ingredientes
 * (g, e ml ≈ g) com o peso das formas, para pegar erros de unidade/digitação.
 */
(function (global) {
  'use strict';

  // Fatores para a unidade-base de cada dimensão (massa→g, volume→ml, contagem→un)
  var TO_BASE = { g: 1, kg: 1000, ml: 1, L: 1000, un: 1 };

  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }

  function baseUnidade(u) { return u === 'kg' ? 'g' : (u === 'L' ? 'ml' : (u || 'un')); }

  function custoUnInsumo(insumo) {
    if (!insumo) return 0;
    var tam = n(insumo.tamanhoPacote);
    if (tam <= 0) return 0;
    return n(insumo.precoPacote) / tam;
  }

  // Custo por unidade-base (R$/g, R$/ml, R$/un) — comparável entre pacotes diferentes.
  function custoNormalizado(insumo) {
    if (!insumo) return 0;
    var fator = TO_BASE[insumo.unidade] || 1;
    return custoUnInsumo(insumo) / fator;
  }

  function arredondaCima(valor, multiplo) {
    if (!isFinite(valor)) return valor;
    if (!multiplo || multiplo <= 0) return valor;
    return Math.ceil(valor / multiplo) * multiplo;
  }

  function calcReceita(receita, premissas, insumoById) {
    receita = receita || {};
    premissas = premissas || {};

    var metodo = premissas.metodoMargem === 'divisor' ? 'divisor' : 'markup';
    var margem = n(premissas.margem) / 100;
    var taxa = n(premissas.taxa) / 100;
    var valorHora = n(premissas.valorHora);
    var embalagemUn = n(premissas.custoEmbalagemUn);
    var arred = n(premissas.arredondamento);
    var maoObraPor = premissas.maoObraPor === 'peso' ? 'peso' : 'unidade';
    var embalagemPor = premissas.embalagemPor === 'peso' ? 'peso' : 'unidade';

    // 1 + 2 — ingredientes, custo do lote e massa de entrada estimada (g; ml ≈ g; 'un' fora)
    var massaEntrada = 0;
    var ingredientes = (receita.ingredientes || []).map(function (it) {
      var insumo = insumoById ? insumoById(it.insumoId) : null;
      var custoUn = custoUnInsumo(insumo);
      var quantidade = n(it.quantidade);
      var unidade = insumo ? insumo.unidade : '';
      if (insumo && unidade !== 'un') massaEntrada += quantidade * (TO_BASE[unidade] || 1);
      return {
        insumoId: it.insumoId,
        insumo: insumo,
        quantidade: quantidade,
        unidade: unidade,
        custoUn: custoUn,
        custoNormalizado: custoNormalizado(insumo),
        subtotal: custoUn * quantidade
      };
    });
    var custoLoteInsumos = ingredientes.reduce(function (s, i) { return s + i.subtotal; }, 0);

    var formasRaw = receita.formas || [];
    var pesoTotalLote = formasRaw.reduce(function (s, f) { return s + n(f.peso) * n(f.qtd); }, 0);
    var unidadesTotal = formasRaw.reduce(function (s, f) { return s + n(f.qtd); }, 0);
    var custoMaoObraLote = (n(receita.tempoMin) / 60) * valorHora;
    var embalagemTotalLote = embalagemUn * unidadesTotal;

    function precificar(custoTotalUn) {
      if (metodo === 'divisor') {
        var d = 1 - margem - taxa;
        return d > 0 ? { preco: custoTotalUn / d, ok: true } : { preco: Infinity, ok: false };
      }
      var t = 1 - taxa;
      return t > 0 ? { preco: custoTotalUn * (1 + margem) / t, ok: true } : { preco: Infinity, ok: false };
    }

    var precoCalculavel = true;

    var formas = formasRaw.map(function (f) {
      var peso = n(f.peso), qtd = n(f.qtd);
      var fracPeso = pesoTotalLote > 0 ? peso / pesoTotalLote : 0;

      var custoInsumoUn = fracPeso * custoLoteInsumos;
      var maoObraUn = unidadesTotal > 0
        ? (maoObraPor === 'peso' ? custoMaoObraLote * fracPeso : custoMaoObraLote / unidadesTotal)
        : 0;
      var embUn = (embalagemPor === 'peso' && pesoTotalLote > 0)
        ? embalagemTotalLote * fracPeso
        : embalagemUn;
      var custoTotalUn = custoInsumoUn + embUn + maoObraUn;

      var pr = precificar(custoTotalUn);
      if (!pr.ok) precoCalculavel = false;
      var precoMinimo = pr.preco;
      var precoSugerido = arredondaCima(precoMinimo, arred);

      var receitaBruta = isFinite(precoSugerido) ? precoSugerido * qtd : 0;
      var custoForma = custoTotalUn * qtd;
      var lucroForma = receitaBruta - custoForma;
      var margemForma = receitaBruta > 0 ? lucroForma / receitaBruta : 0;

      return {
        id: f.id, nome: f.nome, peso: peso, qtd: qtd,
        custoInsumoUn: custoInsumoUn, embalagemUn: embUn, maoObraUn: maoObraUn,
        custoTotalUn: custoTotalUn, precoMinimo: precoMinimo, precoSugerido: precoSugerido,
        receitaBruta: receitaBruta, custoForma: custoForma,
        lucroForma: lucroForma, margemForma: margemForma
      };
    });

    var receitaBrutaLote = formas.reduce(function (s, f) { return s + f.receitaBruta; }, 0);
    var custoTotalLote = formas.reduce(function (s, f) { return s + f.custoForma; }, 0);
    var lucroLote = receitaBrutaLote - custoTotalLote;
    var margemRealLote = receitaBrutaLote > 0 ? lucroLote / receitaBrutaLote : 0;
    var horas = n(receita.tempoMin) / 60;
    var rhEquivalente = horas > 0 ? lucroLote / horas : 0;

    var rendimentoRatio = (pesoTotalLote > 0 && massaEntrada > 0) ? massaEntrada / pesoTotalLote : null;
    var rendimentoAlerta = rendimentoRatio != null && (rendimentoRatio > 2 || rendimentoRatio < 0.5);

    return {
      metodo: metodo,
      ingredientes: ingredientes,
      custoLoteInsumos: custoLoteInsumos,
      semIngredientes: custoLoteInsumos <= 0,
      pesoTotalLote: pesoTotalLote,
      unidadesTotal: unidadesTotal,
      custoMaoObraLote: custoMaoObraLote,
      massaEntrada: massaEntrada,
      rendimentoRatio: rendimentoRatio,
      rendimentoAlerta: rendimentoAlerta,
      precoCalculavel: precoCalculavel,
      divisorOk: precoCalculavel,
      formas: formas,
      receitaBrutaLote: receitaBrutaLote,
      custoTotalLote: custoTotalLote,
      lucroLote: lucroLote,
      margemRealLote: margemRealLote,
      rhEquivalente: rhEquivalente
    };
  }

  global.Pricing = {
    custoUnInsumo: custoUnInsumo,
    custoNormalizado: custoNormalizado,
    baseUnidade: baseUnidade,
    arredondaCima: arredondaCima,
    calcReceita: calcReceita
  };
})(window);
