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
  // A chave da API fica num registro SEPARADO de propósito: assim ela nunca
  // entra no backup (exportJSON) e nem é tocada ao importar dados.
  var AKEY = 'silesthe_apikey';

  // Premissas padrão = os mesmos valores da planilha da Mayra.
  var PREMISSAS_PADRAO = {
    metodoMargem: 'markup',  // 'markup' (margem sobre o custo) | 'divisor' (margem sobre o preço de venda)
    custoEmbalagemUn: 1,     // R$ por unidade (caixinha + etiqueta)
    margem: 100,             // % de margem (markup: 100% = dobro do custo)
    taxa: 0,                 // % de taxa de plataforma
    valorHora: 0,            // R$/hora de mão de obra
    arredondamento: 5,       // arredonda o preço pra cima nesse múltiplo (0 = não arredonda)
    maoObraPor: 'unidade',   // 'unidade' (igual p/ todas) | 'peso' (proporcional ao tamanho)
    embalagemPor: 'unidade', // 'unidade' | 'peso'
    promptIA: ''             // instruções da marca pra IA (texto livre; entra no backup)
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // Dados de exemplo = a planilha real, para abrir o app e já reconhecer tudo.
  function seed() {
    // Dados de exemplo genéricos (não são dados reais de ninguém) — servem só
    // para demonstrar. Você pode editar/apagar e usar "Importar backup" nos Ajustes.
    var base = { id: uid(), nome: 'Base glicerinada', precoPacote: 20, tamanhoPacote: 1000, unidade: 'g' };
    var ess = { id: uid(), nome: 'Essência', precoPacote: 25, tamanhoPacote: 100, unidade: 'g' };
    var corante = { id: uid(), nome: 'Corante', precoPacote: 10, tamanhoPacote: 50, unidade: 'ml' };
    var oleo = { id: uid(), nome: 'Óleo essencial', precoPacote: 40, tamanhoPacote: 100, unidade: 'ml' };
    var esf = { id: uid(), nome: 'Esfoliante', precoPacote: 15, tamanhoPacote: 200, unidade: 'g' };

    var insumos = [base, ess, corante, oleo, esf];

    var receitas = [{
      id: uid(),
      nome: 'Sabonete (exemplo)',
      tempoMin: 30,
      ingredientes: [
        { insumoId: base.id, quantidade: 1000 },
        { insumoId: ess.id, quantidade: 50 },
        { insumoId: corante.id, quantidade: 10 },
        { insumoId: oleo.id, quantidade: 20 },
        { insumoId: esf.id, quantidade: 50 }
      ],
      formas: [
        { id: uid(), nome: 'Barra', peso: 100, qtd: 6 },
        { id: uid(), nome: 'Mini', peso: 50, qtd: 4 }
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
      if (!r.venda || typeof r.venda !== 'object') r.venda = {};
      ['historia', 'beneficios', 'modoUso', 'slogan'].forEach(function (k) {
        if (typeof r.venda[k] !== 'string') r.venda[k] = '';
      });
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
    return migrate(seed());
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

    // Chave da API da Claude — guardada só neste aparelho, fora do backup.
    getApiKey: function () {
      try { return localStorage.getItem(AKEY) || ''; } catch (e) { return ''; }
    },
    setApiKey: function (k) {
      try {
        k = (k || '').trim();
        if (k) localStorage.setItem(AKEY, k);
        else localStorage.removeItem(AKEY);
      } catch (e) { /* ignora storage indisponível */ }
    },
    apagarTudo: function () {
      state = { premissas: clone(PREMISSAS_PADRAO), insumos: [], receitas: [] };
      persist();
    },

    uid: uid
  };

  global.Store = Store;
})(window);
