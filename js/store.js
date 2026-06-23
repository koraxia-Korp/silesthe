/*
 * store.js — camada de dados (persistência local) do Silesthe.
 *
 * Tudo fica salvo no próprio aparelho (localStorage), funciona offline e
 * não precisa de login. Há exportar/importar (JSON) para backup.
 *
 * Modelo de dados (espelha a planilha "Calculadora de Sabonetes"):
 *   premissas: configurações globais (embalagem, margem, taxa, mão de obra, arredondamento)
 *   insumos:   catálogo de materiais  { id, nome, precoPacote, tamanhoPacote, unidade }
 *   receitas:  lotes de produção      { id, nome, tempoMin, ingredientes[], formas[] }
 *     ingredientes: { insumoId, quantidade }
 *     formas:       { id, nome, peso, qtd }   (peso em g, qtd = unidades no lote)
 */
(function (global) {
  'use strict';

  var KEY = 'silesthe_v1';

  // Premissas padrão = os mesmos valores da planilha da Mayra.
  var PREMISSAS_PADRAO = {
    custoEmbalagemUn: 1.325, // R$ por unidade (caixinha + etiqueta)
    margem: 60,              // % de lucro desejado (sobre o preço de venda)
    taxa: 0,                 // % de taxa de plataforma
    valorHora: 0,            // R$/hora de mão de obra
    arredondamento: 5        // arredonda o preço pra cima nesse múltiplo (0 = não arredonda)
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // Dados de exemplo = a planilha real, para abrir o app e já reconhecer tudo.
  function seed() {
    var base = { id: uid(), nome: 'Base', precoPacote: 24.9, tamanhoPacote: 1000, unidade: 'g' };
    var framb = { id: uid(), nome: 'Extrato de framboesa', precoPacote: 50.9, tamanhoPacote: 250, unidade: 'g' };
    var ess = { id: uid(), nome: 'Essência', precoPacote: 31.4, tamanhoPacote: 100, unidade: 'g' };
    var lauril = { id: uid(), nome: 'Lauril', precoPacote: 22.4, tamanhoPacote: 500, unidade: 'ml' };
    var poEx = { id: uid(), nome: 'Extrato em pó', precoPacote: 53.8, tamanhoPacote: 200, unidade: 'g' };
    var colza = { id: uid(), nome: 'Semente de Colza', precoPacote: 6.3, tamanhoPacote: 100, unidade: 'g' };

    var insumos = [base, framb, ess, lauril, poEx, colza];

    var receitas = [{
      id: uid(),
      nome: 'Sabonete de Framboesa',
      tempoMin: 30,
      ingredientes: [
        { insumoId: base.id, quantidade: 1000 },
        { insumoId: framb.id, quantidade: 100 },
        { insumoId: ess.id, quantidade: 70 },
        { insumoId: lauril.id, quantidade: 140 },
        { insumoId: poEx.id, quantidade: 75 },
        { insumoId: colza.id, quantidade: 20 }
      ],
      formas: [
        { id: uid(), nome: 'Folhas', peso: 50, qtd: 4 },
        { id: uid(), nome: 'Retangular', peso: 100, qtd: 1 },
        { id: uid(), nome: 'Massageadora', peso: 180, qtd: 1 },
        { id: uid(), nome: 'Redonda', peso: 110, qtd: 1 }
      ]
    }];

    return { premissas: clone(PREMISSAS_PADRAO), insumos: insumos, receitas: receitas };
  }

  // Garante que dados carregados/importados tenham todos os campos esperados.
  function migrate(data) {
    data = data || {};
    data.premissas = Object.assign({}, PREMISSAS_PADRAO, data.premissas || {});
    data.insumos = Array.isArray(data.insumos) ? data.insumos : [];
    data.receitas = Array.isArray(data.receitas) ? data.receitas : [];
    data.receitas.forEach(function (r) {
      r.ingredientes = Array.isArray(r.ingredientes) ? r.ingredientes : [];
      r.formas = Array.isArray(r.formas) ? r.formas : [];
      r.formas.forEach(function (f) { if (!f.id) f.id = uid(); });
    });
    return data;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('Falha ao ler dados salvos:', e);
    }
    return seed();
  }

  var state = load();

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Falha ao salvar:', e);
    }
  }

  persist(); // grava o seed na primeira abertura

  var Store = {
    get state() { return state; },
    get premissas() { return state.premissas; },
    get insumos() { return state.insumos; },
    get receitas() { return state.receitas; },

    savePremissas: function (patch) {
      state.premissas = Object.assign({}, state.premissas, patch);
      persist();
    },

    insumoById: function (id) {
      for (var i = 0; i < state.insumos.length; i++) {
        if (state.insumos[i].id === id) return state.insumos[i];
      }
      return null;
    },
    receitaById: function (id) {
      for (var i = 0; i < state.receitas.length; i++) {
        if (state.receitas[i].id === id) return state.receitas[i];
      }
      return null;
    },

    novoInsumo: function () {
      var ins = { id: uid(), nome: '', precoPacote: 0, tamanhoPacote: 1, unidade: 'g' };
      state.insumos.push(ins);
      persist();
      return ins;
    },
    saveInsumo: function (insumo) {
      var idx = state.insumos.findIndex(function (i) { return i.id === insumo.id; });
      if (idx >= 0) state.insumos[idx] = insumo; else state.insumos.push(insumo);
      persist();
    },
    removeInsumo: function (id) {
      state.insumos = state.insumos.filter(function (i) { return i.id !== id; });
      // remove referências nas receitas
      state.receitas.forEach(function (r) {
        r.ingredientes = r.ingredientes.filter(function (it) { return it.insumoId !== id; });
      });
      persist();
    },

    novaReceita: function () {
      var primeiro = state.insumos[0] ? state.insumos[0].id : null;
      var r = {
        id: uid(),
        nome: 'Nova receita',
        tempoMin: 30,
        ingredientes: primeiro ? [{ insumoId: primeiro, quantidade: 0 }] : [],
        formas: [{ id: uid(), nome: 'Unidade', peso: 100, qtd: 1 }]
      };
      state.receitas.push(r);
      persist();
      return r;
    },
    saveReceita: function (receita) {
      var idx = state.receitas.findIndex(function (r) { return r.id === receita.id; });
      if (idx >= 0) state.receitas[idx] = receita; else state.receitas.push(receita);
      persist();
    },
    removeReceita: function (id) {
      state.receitas = state.receitas.filter(function (r) { return r.id !== id; });
      persist();
    },

    exportJSON: function () {
      return JSON.stringify(
        { app: 'silesthe', versao: 1, exportadoEm: new Date().toISOString(), dados: state },
        null, 2
      );
    },
    importJSON: function (text) {
      var parsed = JSON.parse(text);
      var dados = parsed && parsed.dados ? parsed.dados : parsed;
      state = migrate(dados);
      persist();
    },
    restaurarExemplo: function () {
      state = seed();
      persist();
    },
    apagarTudo: function () {
      state = { premissas: clone(PREMISSAS_PADRAO), insumos: [], receitas: [] };
      persist();
    },

    uid: uid
  };

  global.Store = Store;
})(window);
