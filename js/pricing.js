/*
 * pricing.js — toda a matemática de precificação, replicando a planilha.
 *
 * Fluxo (igual à "Calculadora de Sabonetes"):
 *  1. Custo de cada insumo por unidade   = precoPacote / tamanhoPacote
 *  2. Custo total do lote (insumos)       = Σ (quantidade × custoUnitário)   [todos os ingredientes]
 *  3. Rateio por PESO entre as formas     = (peso_forma / pesoTotalLote) × custoLote
 *  4. Embalagem por unidade               = valor fixo das premissas
 *  5. Mão de obra por unidade             = (tempo/60 × valorHora) / unidadesTotal   [rateio por UNIDADE]
 *  6. Custo total/un                      = insumo + embalagem + mão de obra
 *  7. Preço mínimo                        = custoTotal / (1 − margem − taxa)
 *  8. Preço sugerido                      = arredonda pra cima no múltiplo definido (CEILING)
 *
 * Observação: a planilha original somava só 4 dos 6 ingredientes (=SUM(E14:E17)),
 * deixando "Extrato em pó" e "Semente de Colza" de fora. Aqui somamos TODOS,
 * que é o custo real do lote.
 */
(function (global) {
  'use strict';

  function n(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }

  function custoUnInsumo(insumo) {
    if (!insumo) return 0;
    var tam = n(insumo.tamanhoPacote);
    if (tam <= 0) return 0;
    return n(insumo.precoPacote) / tam;
  }

  function arredondaCima(valor, multiplo) {
    if (!isFinite(valor)) return valor;
    if (!multiplo || multiplo <= 0) return valor;
    return Math.ceil(valor / multiplo) * multiplo;
  }

  function calcReceita(receita, premissas, insumoById) {
    receita = receita || {};
    premissas = premissas || {};

    var margem = n(premissas.margem) / 100;
    var taxa = n(premissas.taxa) / 100;
    var valorHora = n(premissas.valorHora);
    var embalagemUn = n(premissas.custoEmbalagemUn);
    var arred = n(premissas.arredondamento);

    // 1 + 2 — ingredientes e custo total do lote
    var ingredientes = (receita.ingredientes || []).map(function (it) {
      var insumo = insumoById ? insumoById(it.insumoId) : null;
      var custoUn = custoUnInsumo(insumo);
      var quantidade = n(it.quantidade);
      return {
        insumoId: it.insumoId,
        insumo: insumo,
        quantidade: quantidade,
        unidade: insumo ? insumo.unidade : '',
        custoUn: custoUn,
        subtotal: custoUn * quantidade
      };
    });
    var custoLoteInsumos = ingredientes.reduce(function (s, i) { return s + i.subtotal; }, 0);

    // pesos e unidades do lote
    var formasRaw = receita.formas || [];
    var pesoTotalLote = formasRaw.reduce(function (s, f) { return s + n(f.peso) * n(f.qtd); }, 0);
    var unidadesTotal = formasRaw.reduce(function (s, f) { return s + n(f.qtd); }, 0);
    var custoMaoObraLote = (n(receita.tempoMin) / 60) * valorHora;

    var divisor = 1 - margem - taxa;
    var divisorOk = divisor > 0;

    // 3..8 — por forma
    var formas = formasRaw.map(function (f) {
      var peso = n(f.peso);
      var qtd = n(f.qtd);

      var custoInsumoUn = pesoTotalLote > 0 ? (peso / pesoTotalLote) * custoLoteInsumos : 0;
      var maoObraUn = unidadesTotal > 0 ? custoMaoObraLote / unidadesTotal : 0;
      var custoTotalUn = custoInsumoUn + embalagemUn + maoObraUn;

      var precoMinimo = divisorOk ? custoTotalUn / divisor : Infinity;
      var precoSugerido = arredondaCima(precoMinimo, arred);

      var receitaBruta = isFinite(precoSugerido) ? precoSugerido * qtd : 0;
      var custoForma = custoTotalUn * qtd;
      var lucroForma = receitaBruta - custoForma;
      var margemForma = receitaBruta > 0 ? lucroForma / receitaBruta : 0;

      return {
        id: f.id,
        nome: f.nome,
        peso: peso,
        qtd: qtd,
        custoInsumoUn: custoInsumoUn,
        embalagemUn: embalagemUn,
        maoObraUn: maoObraUn,
        custoTotalUn: custoTotalUn,
        precoMinimo: precoMinimo,
        precoSugerido: precoSugerido,
        receitaBruta: receitaBruta,
        custoForma: custoForma,
        lucroForma: lucroForma,
        margemForma: margemForma
      };
    });

    // Simulação do lote (totais)
    var receitaBrutaLote = formas.reduce(function (s, f) { return s + f.receitaBruta; }, 0);
    var custoTotalLote = formas.reduce(function (s, f) { return s + f.custoForma; }, 0);
    var lucroLote = receitaBrutaLote - custoTotalLote;
    var margemRealLote = receitaBrutaLote > 0 ? lucroLote / receitaBrutaLote : 0;
    var horas = n(receita.tempoMin) / 60;
    var rhEquivalente = horas > 0 ? lucroLote / horas : 0;

    return {
      ingredientes: ingredientes,
      custoLoteInsumos: custoLoteInsumos,
      pesoTotalLote: pesoTotalLote,
      unidadesTotal: unidadesTotal,
      custoMaoObraLote: custoMaoObraLote,
      divisorOk: divisorOk,
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
    arredondaCima: arredondaCima,
    calcReceita: calcReceita
  };
})(window);
