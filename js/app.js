/*
 * app.js — interface e interações do Silesthe.
 * Vanilla JS, sem framework. Salva tudo automaticamente (Store) e recalcula ao vivo.
 */
(function () {
  'use strict';

  // ---------- Helpers ----------
  var $ = function (s) { return document.querySelector(s); };

  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var fmtN = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  var fmt4 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  var fmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

  function money(v) { v = Number(v); return isFinite(v) ? fmtBRL.format(v) : '—'; }
  function numLabel(v) { v = Number(v); if (!isFinite(v)) v = 0; return fmtN.format(v); }
  function pct(frac) { frac = Number(frac); if (!isFinite(frac)) frac = 0; return fmtPct.format(frac * 100) + '%'; }
  function custoUnLabel(v, unidade) { v = Number(v); if (!isFinite(v)) v = 0; return 'R$ ' + fmt4.format(v) + ' / ' + (unidade || 'un'); }
  function custoComparavelLabel(insumo) {
    var norm = Pricing.custoNormalizado(insumo);
    if (!isFinite(norm)) norm = 0;
    return 'R$ ' + fmt4.format(norm) + ' / ' + Pricing.baseUnidade(insumo ? insumo.unidade : 'un');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, a, b) { return n === 1 ? a : b; }

  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var s = String(v).trim().replace(/[^\d.,-]/g, '');
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function toField(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return isFinite(v) ? String(v).replace('.', ',') : '';
    return String(v);
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function emptyHTML(emoji, title, sub) {
    return '<div class="empty"><div class="empty-emoji">' + emoji + '</div>' +
      '<div class="empty-title">' + esc(title) + '</div>' +
      '<div class="empty-sub">' + esc(sub) + '</div></div>';
  }

  // ---------- Navegação ----------
  var VIEWS = ['receitas', 'insumos', 'ajustes', 'detalhe'];
  var currentView = 'receitas';
  var currentReceitaId = null;

  function showOnly(name) {
    VIEWS.forEach(function (v) { $('#view-' + v).classList.toggle('hidden', v !== name); });
  }

  function setView(name) {
    currentView = name;
    currentReceitaId = null;
    showOnly(name);
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === name);
    });
    var titles = { receitas: 'Receitas', insumos: 'Insumos', ajustes: 'Ajustes' };
    $('#viewTitle').textContent = titles[name] || '';
    $('#backBtn').classList.add('hidden');
    $('#addBtn').classList.toggle('hidden', name === 'ajustes');
    if (name === 'receitas') renderReceitas();
    else if (name === 'insumos') renderInsumos();
    else if (name === 'ajustes') renderAjustes();
    window.scrollTo(0, 0);
  }

  function openDetalhe(id) {
    var r = Store.receitaById(id);
    if (!r) { setView('receitas'); return; }
    currentView = 'detalhe';
    currentReceitaId = id;
    showOnly('detalhe');
    $('#viewTitle').textContent = 'Receita';
    $('#backBtn').classList.remove('hidden');
    $('#addBtn').classList.add('hidden');
    renderDetalhe();
    window.scrollTo(0, 0);
  }

  function goBack() { setView('receitas'); }

  function onAdd() {
    if (currentView === 'receitas') {
      var r = Store.novaReceita();
      openDetalhe(r.id);
      toast('Receita criada');
    } else if (currentView === 'insumos') {
      var i = Store.novoInsumo();
      renderInsumos();
      var card = document.querySelector('.ins-card[data-insumo="' + i.id + '"]');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var inp = card.querySelector('.ins-nome');
        if (inp) inp.focus();
      }
    }
  }

  // ---------- Render: Receitas ----------
  function renderReceitas() {
    var host = $('#view-receitas');
    var rs = Store.receitas;
    if (!rs.length) {
      host.innerHTML = emptyHTML('🧼', 'Nenhuma receita ainda', 'Toque em + para criar a primeira receita de sabonete.');
      return;
    }
    var h = '<div class="list">';
    rs.forEach(function (r) {
      var c = Pricing.calcReceita(r, Store.premissas, Store.insumoById);
      var precos = c.formas.map(function (f) { return f.precoSugerido; }).filter(function (p) { return isFinite(p); });
      var faixa = '—';
      if (precos.length) {
        var mn = Math.min.apply(null, precos), mx = Math.max.apply(null, precos);
        faixa = mn === mx ? money(mn) : money(mn) + '–' + money(mx);
      }
      var nIng = r.ingredientes.length, nForm = r.formas.length;
      h += '<div class="card rec-card" data-receita="' + r.id + '">' +
        '<div class="rec-card-body">' +
        '<div class="rec-name">' + esc(r.nome || 'Sem nome') + '</div>' +
        '<div class="rec-meta">' + nIng + ' ' + plural(nIng, 'ingrediente', 'ingredientes') +
        ' · ' + numLabel(c.unidadesTotal) + ' un/lote · ' + nForm + ' ' + plural(nForm, 'forma', 'formas') + '</div>' +
        '</div>' +
        '<div class="rec-card-side"><div class="rec-price-box">' +
        '<div class="rec-price">' + faixa + '</div><div class="rec-price-lbl">preço sugerido</div></div>' +
        '<div class="chevron">›</div></div></div>';
    });
    h += '</div>';
    host.innerHTML = h;
  }

  // ---------- Render: Insumos ----------
  var UNIDADES = ['g', 'kg', 'ml', 'L', 'un'];

  function insumoCardHTML(i) {
    var opts = UNIDADES.map(function (u) {
      return '<option' + (i.unidade === u ? ' selected' : '') + '>' + u + '</option>';
    }).join('');
    return '<div class="ins-card" data-insumo="' + i.id + '">' +
      '<input class="inp ins-nome" data-f="nome" placeholder="Nome do insumo" value="' + esc(i.nome) + '">' +
      '<div class="ins-grid">' +
      '<label class="field"><span class="field-lbl">Preço do pacote</span>' +
      '<div class="inp-wrap"><span class="prefix">R$</span><input class="inp num" data-f="precoPacote" inputmode="decimal" value="' + toField(i.precoPacote) + '"></div></label>' +
      '<label class="field"><span class="field-lbl">Tamanho</span>' +
      '<input class="inp num" data-f="tamanhoPacote" inputmode="decimal" value="' + toField(i.tamanhoPacote) + '"></label>' +
      '<label class="field"><span class="field-lbl">Unidade</span>' +
      '<select class="inp sel" data-f="unidade">' + opts + '</select></label>' +
      '</div>' +
      '<div class="ins-foot"><span class="ins-custo">' + custoComparavelLabel(i) + '</span>' +
      '<button class="btn-del" data-del-insumo="' + i.id + '">Excluir</button></div>' +
      '</div>';
  }

  function renderInsumos() {
    var host = $('#view-insumos');
    var list = Store.insumos;
    var h = '<p class="ins-intro">Materiais das receitas. O custo é mostrado por <b>g/ml/un</b> (preço ÷ tamanho), pra comparar fornecedores mesmo com pacotes de tamanhos diferentes.</p>';
    if (!list.length) {
      h += emptyHTML('🧪', 'Nenhum insumo ainda', 'Toque em + para cadastrar um material (base, essência, embalagem...).');
    } else {
      list.forEach(function (i) { h += insumoCardHTML(i); });
    }
    host.innerHTML = h;
  }

  // ---------- Render: Ajustes ----------
  function premRow(label, key, prefix, suffix, val) {
    var input = '<input class="inp num" data-p="' + key + '" inputmode="decimal" value="' + toField(val) + '">';
    var wrap = '<div class="inp-wrap">' + (prefix ? '<span class="prefix">' + prefix + '</span>' : '') +
      input + (suffix ? '<span class="suffix">' + suffix + '</span>' : '') + '</div>';
    return '<label class="prem-row"><span class="prem-lbl">' + label + '</span>' + wrap + '</label>';
  }

  function selRow(label, key, val, optA, optB) {
    val = val === 'peso' ? 'peso' : 'unidade';
    return '<label class="prem-row"><span class="prem-lbl">' + label + '</span>' +
      '<select class="inp sel selauto" data-ps="' + key + '">' +
      '<option value="unidade"' + (val === 'unidade' ? ' selected' : '') + '>' + optA + '</option>' +
      '<option value="peso"' + (val === 'peso' ? ' selected' : '') + '>' + optB + '</option>' +
      '</select></label>';
  }

  function renderAjustes() {
    var host = $('#view-ajustes');
    var p = Store.premissas;
    var metodo = p.metodoMargem === 'divisor' ? 'divisor' : 'markup';
    var margemLbl = metodo === 'divisor' ? 'Margem (sobre o preço de venda)' : 'Margem (markup sobre o custo)';
    var margemHint = metodo === 'divisor'
      ? 'Preço = custo ÷ (1 − margem − taxa). A margem precisa ser <b>menor que 100%</b>. Ex.: 60% → preço 2,5× o custo.'
      : 'Preço = custo × (1 + margem). Ex.: <b>100% → o dobro</b> do custo; 50% → 1,5×.';
    host.innerHTML =
      '<div class="alert"><div class="alert-title">💡 Como o preço é calculado</div>' +
      '<p>Custo/un = insumos (rateados por peso) + embalagem + mão de obra. Depois aplica a margem e arredonda pra cima.</p></div>' +

      '<div class="sec"><div class="sec-title">Margem e preço</div><div class="premissas">' +
      '<label class="prem-row"><span class="prem-lbl">Método da margem</span>' +
      '<select class="inp sel selauto" data-ps="metodoMargem">' +
      '<option value="markup"' + (metodo === 'markup' ? ' selected' : '') + '>Markup (sobre o custo)</option>' +
      '<option value="divisor"' + (metodo === 'divisor' ? ' selected' : '') + '>Sobre o preço de venda</option>' +
      '</select></label>' +
      premRow(margemLbl, 'margem', null, '%', p.margem) +
      premRow('Taxa de plataforma', 'taxa', null, '%', p.taxa) +
      premRow('Arredondar preço (múltiplo)', 'arredondamento', 'R$', null, p.arredondamento) +
      '</div><p class="muted small" style="margin-top:10px">' + margemHint + ' Arredondamento 0 = não arredonda.</p></div>' +

      '<div class="sec"><div class="sec-title">Custos</div><div class="premissas">' +
      premRow('Custo de embalagem (por unidade)', 'custoEmbalagemUn', 'R$', null, p.custoEmbalagemUn) +
      premRow('Valor da hora de trabalho', 'valorHora', 'R$', null, p.valorHora) +
      selRow('Ratear mão de obra', 'maoObraPor', p.maoObraPor, 'Igual por unidade', 'Por peso') +
      selRow('Ratear embalagem', 'embalagemPor', p.embalagemPor, 'Igual por unidade', 'Por peso') +
      '</div><p class="muted small" style="margin-top:10px">“Igual por unidade” = mesmo valor pra toda forma. “Por peso” = proporcional ao tamanho de cada forma.</p></div>' +

      '<div class="sec"><div class="sec-title">Dados</div><div class="data-actions">' +
      '<button class="btn primary block" data-export>Exportar backup (.json)</button>' +
      '<button class="btn ghost block" data-import>Importar backup</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '<button class="btn ghost block" data-restaurar>Restaurar dados de exemplo</button>' +
      '<button class="btn danger block" data-apagar>Apagar tudo</button>' +
      '</div><p class="muted small" style="margin-top:10px">Seus dados ficam só neste aparelho. Faça backup antes de trocar de celular ou limpar o navegador.</p></div>' +

      '<div class="app-foot">Silesthe 💜</div>';
  }

  // ---------- Render: Detalhe (receita) ----------
  function renderDetalhe() {
    var host = $('#view-detalhe');
    var r = Store.receitaById(currentReceitaId);
    if (!r) { goBack(); return; }
    host.innerHTML =
      '<input class="inp detail-title" data-r="nome" value="' + esc(r.nome) + '" placeholder="Nome da receita">' +
      '<section class="sec"><div class="sec-title">Preços sugeridos</div><div id="formaResults" class="forma-results"></div></section>' +
      '<section class="sec"><div class="sec-title">Resumo do lote</div><div id="resumoLote" class="resumo"></div></section>' +
      '<section class="sec"><div class="sec-title">Ingredientes do lote</div><div id="ingList" class="ing-list"></div>' +
      '<button class="add-row" data-add-ing>+ ingrediente</button>' +
      '<div class="total-line"><span>Custo total dos insumos</span><strong id="custoLoteVal">—</strong></div></section>' +
      '<section class="sec"><div class="sec-title">Formas / sabonetes</div><div id="formaList" class="forma-edit"></div>' +
      '<button class="add-row" data-add-forma>+ forma</button></section>' +
      '<section class="sec"><div class="sec-title">Produção</div>' +
      '<label class="field row-field"><span class="field-lbl">Tempo de produção do lote</span>' +
      '<div class="inp-wrap"><input class="inp num" data-r="tempoMin" inputmode="decimal" value="' + toField(r.tempoMin) + '"><span class="suffix">min</span></div></label>' +
      '<button class="btn danger block" data-del-receita style="margin-top:16px">Excluir receita</button></section>';
    renderIngList();
    renderFormaList();
    refreshComputed();
  }

  function ingRowHTML(it, idx) {
    var opts = Store.insumos.map(function (i) {
      return '<option value="' + i.id + '"' + (i.id === it.insumoId ? ' selected' : '') + '>' + esc(i.nome || '(sem nome)') + '</option>';
    }).join('');
    var ins = Store.insumoById(it.insumoId);
    var unit = ins ? ins.unidade : '';
    return '<div class="edit-card ing-row" data-ing-idx="' + idx + '">' +
      '<select class="inp sel" data-ing-insumo="' + idx + '">' + opts + '</select>' +
      '<div class="ing-line2">' +
      '<div class="inp-wrap"><input class="inp num" data-ing-qtd="' + idx + '" inputmode="decimal" value="' + toField(it.quantidade) + '">' +
      '<span class="suffix" data-ing-unit="' + idx + '">' + esc(unit) + '</span></div>' +
      '<span class="ing-sub" data-ing-sub="' + idx + '">—</span>' +
      '<button class="icon-del" data-del-ing="' + idx + '" aria-label="Remover">×</button>' +
      '</div></div>';
  }

  function renderIngList() {
    var r = Store.receitaById(currentReceitaId);
    if (!r) return;
    var host = $('#ingList');
    if (!Store.insumos.length) {
      host.innerHTML = '<p class="muted small">Cadastre insumos na aba Insumos para montar a receita.</p>';
      return;
    }
    if (!r.ingredientes.length) {
      host.innerHTML = '<p class="muted small">Nenhum ingrediente ainda. Toque em “+ ingrediente”.</p>';
      return;
    }
    host.innerHTML = r.ingredientes.map(function (it, idx) { return ingRowHTML(it, idx); }).join('');
  }

  function formaRowHTML(f, idx) {
    return '<div class="edit-card forma-row" data-forma-idx="' + idx + '">' +
      '<input class="inp" data-forma-nome="' + idx + '" placeholder="Nome da forma" value="' + esc(f.nome) + '">' +
      '<div class="forma-line">' +
      '<div class="inp-wrap"><input class="inp num" data-forma-peso="' + idx + '" inputmode="decimal" value="' + toField(f.peso) + '"><span class="suffix">g</span></div>' +
      '<div class="inp-wrap"><input class="inp num" data-forma-qtd="' + idx + '" inputmode="decimal" value="' + toField(f.qtd) + '"><span class="suffix">un</span></div>' +
      '</div>' +
      '<div class="forma-foot"><span class="forma-price" data-forma-price="' + idx + '">—</span>' +
      '<button class="icon-del" data-del-forma="' + idx + '" aria-label="Remover">×</button></div>' +
      '</div>';
  }

  function renderFormaList() {
    var r = Store.receitaById(currentReceitaId);
    if (!r) return;
    var host = $('#formaList');
    if (!r.formas.length) {
      host.innerHTML = '<p class="muted small">Nenhuma forma ainda. Toque em “+ forma”.</p>';
      return;
    }
    host.innerHTML = r.formas.map(function (f, idx) { return formaRowHTML(f, idx); }).join('');
  }

  function rItem(lbl, valHTML) {
    return '<div class="r-item"><div class="r-lbl">' + lbl + '</div><div class="r-val">' + valHTML + '</div></div>';
  }

  function avisoBox(msg) {
    return '<div class="alert" style="margin:0 0 10px"><p style="margin:0">⚠️ ' + msg + '</p></div>';
  }

  function refreshComputed() {
    var r = Store.receitaById(currentReceitaId);
    if (!r) return;
    var c = Pricing.calcReceita(r, Store.premissas, Store.insumoById);

    var fr = $('#formaResults');
    if (fr) {
      var avisos = '';
      if (c.semIngredientes) avisos += avisoBox('Sem ingredientes nesta receita — adicione insumos para o custo fazer sentido.');
      if (c.rendimentoAlerta) avisos += avisoBox('Rendimento incomum: ingredientes ≈ ' + numLabel(c.massaEntrada) + ' g, mas as formas somam ' + numLabel(c.pesoTotalLote) + ' g (' + c.rendimentoRatio.toFixed(1) + '×). Confira as quantidades e as unidades.');
      if (!c.precoCalculavel) avisos += avisoBox('Não dá pra calcular o preço: no método “sobre o preço de venda”, margem + taxa precisa ser menor que 100%. Ajuste em Ajustes.');
      if (!c.formas.length) {
        fr.innerHTML = avisos + '<p class="muted small">Adicione formas para ver os preços.</p>';
      } else {
        fr.innerHTML = avisos + c.formas.map(function (f) {
          var preco = isFinite(f.precoSugerido) ? money(f.precoSugerido) : '—';
          var min = isFinite(f.precoMinimo) ? money(f.precoMinimo) : '—';
          var lucroUn = isFinite(f.precoSugerido) ? money(f.precoSugerido - f.custoTotalUn) : '—';
          return '<div class="fr-card"><div class="fr-top"><div>' +
            '<div class="fr-name">' + esc(f.nome || 'Forma') + '</div>' +
            '<div class="fr-peso">' + numLabel(f.peso) + ' g · ' + numLabel(f.qtd) + ' un</div></div>' +
            '<div class="fr-price-box"><div class="fr-price">' + preco + '</div><div class="fr-price-lbl">sugerido</div></div></div>' +
            '<div class="fr-break"><span>Custo <b>' + money(f.custoTotalUn) + '</b>/un</span>' +
            '<span>Mínimo <b>' + min + '</b></span>' +
            '<span>Lucro <b class="good">' + lucroUn + '</b>/un</span></div></div>';
        }).join('');
      }
    }

    var rl = $('#resumoLote');
    if (rl) {
      var hasTempo = parseNum(r.tempoMin) > 0;
      rl.innerHTML =
        rItem('Receita bruta do lote', money(c.receitaBrutaLote)) +
        rItem('Custo total do lote', money(c.custoTotalLote)) +
        rItem('Lucro do lote', '<span class="' + (c.lucroLote >= 0 ? 'good' : 'bad') + '">' + money(c.lucroLote) + '</span>') +
        rItem('Margem real', c.receitaBrutaLote > 0 ? pct(c.margemRealLote) : '—') +
        rItem('Equivale a (por hora)', hasTempo ? money(c.rhEquivalente) + ' / h' : '—');
    }

    var cl = $('#custoLoteVal');
    if (cl) cl.textContent = money(c.custoLoteInsumos);

    c.ingredientes.forEach(function (ing, idx) {
      var sub = document.querySelector('[data-ing-sub="' + idx + '"]');
      if (sub) sub.textContent = money(ing.subtotal);
      var un = document.querySelector('[data-ing-unit="' + idx + '"]');
      if (un) un.textContent = ing.unidade || '';
    });
    c.formas.forEach(function (f, idx) {
      var pe = document.querySelector('[data-forma-price="' + idx + '"]');
      if (pe) pe.innerHTML = (isFinite(f.precoSugerido) ? money(f.precoSugerido) : '—') + ' <small>sugerido</small>';
    });
  }

  // ---------- Dados: export / import ----------
  function doExport() {
    var data = Store.exportJSON();
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    a.href = url;
    a.download = 'silesthe-backup-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Backup exportado');
  }

  function handleImportFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        Store.importJSON(String(reader.result));
        toast('Backup importado');
        setView('receitas');
      } catch (err) {
        alert('Não consegui ler esse arquivo de backup. Verifique se é um .json exportado pelo app.');
      }
      input.value = '';
    };
    reader.onerror = function () { alert('Erro ao ler o arquivo.'); input.value = ''; };
    reader.readAsText(file);
  }

  // ---------- Eventos (delegação no #app) ----------
  function wireEvents() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { setView(t.dataset.view); });
    });
    $('#backBtn').addEventListener('click', goBack);
    $('#addBtn').addEventListener('click', onAdd);

    var app = $('#app');

    app.addEventListener('input', function (e) {
      var t = e.target;

      var insCard = t.closest && t.closest('.ins-card');
      if (insCard && t.dataset.f) {
        var ins = Store.insumoById(insCard.dataset.insumo);
        if (!ins) return;
        if (t.dataset.f === 'nome') ins.nome = t.value;
        else if (t.dataset.f === 'precoPacote') ins.precoPacote = parseNum(t.value);
        else if (t.dataset.f === 'tamanhoPacote') ins.tamanhoPacote = parseNum(t.value);
        Store.saveInsumo(ins);
        var lbl = insCard.querySelector('.ins-custo');
        if (lbl) lbl.textContent = custoComparavelLabel(ins);
        return;
      }

      if (t.dataset.p) {
        var patch = {};
        patch[t.dataset.p] = parseNum(t.value);
        Store.savePremissas(patch);
        return;
      }

      if (currentView === 'detalhe') {
        var r = Store.receitaById(currentReceitaId);
        if (!r) return;
        if (t.dataset.r === 'nome') { r.nome = t.value; Store.saveReceita(r); return; }
        if (t.dataset.r === 'tempoMin') { r.tempoMin = parseNum(t.value); Store.saveReceita(r); refreshComputed(); return; }
        if (t.hasAttribute('data-ing-qtd')) {
          var i1 = +t.dataset.ingQtd;
          if (r.ingredientes[i1]) { r.ingredientes[i1].quantidade = parseNum(t.value); Store.saveReceita(r); refreshComputed(); }
          return;
        }
        if (t.hasAttribute('data-forma-nome')) {
          var i2 = +t.dataset.formaNome;
          if (r.formas[i2]) { r.formas[i2].nome = t.value; Store.saveReceita(r); refreshComputed(); }
          return;
        }
        if (t.hasAttribute('data-forma-peso')) {
          var i3 = +t.dataset.formaPeso;
          if (r.formas[i3]) { r.formas[i3].peso = parseNum(t.value); Store.saveReceita(r); refreshComputed(); }
          return;
        }
        if (t.hasAttribute('data-forma-qtd')) {
          var i4 = +t.dataset.formaQtd;
          if (r.formas[i4]) { r.formas[i4].qtd = parseNum(t.value); Store.saveReceita(r); refreshComputed(); }
          return;
        }
      }
    });

    app.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'importFile') { handleImportFile(t); return; }

      if (t.dataset.ps) {
        var pp = {};
        pp[t.dataset.ps] = t.value;
        Store.savePremissas(pp);
        renderAjustes();
        return;
      }

      var insCard = t.closest && t.closest('.ins-card');
      if (insCard && t.dataset.f === 'unidade') {
        var ins = Store.insumoById(insCard.dataset.insumo);
        if (ins) {
          ins.unidade = t.value;
          Store.saveInsumo(ins);
          var lbl = insCard.querySelector('.ins-custo');
          if (lbl) lbl.textContent = custoComparavelLabel(ins);
        }
        return;
      }

      if (currentView === 'detalhe' && t.hasAttribute('data-ing-insumo')) {
        var idx = +t.dataset.ingInsumo;
        var r = Store.receitaById(currentReceitaId);
        if (r && r.ingredientes[idx]) {
          r.ingredientes[idx].insumoId = t.value;
          Store.saveReceita(r);
          refreshComputed();
        }
      }
    });

    app.addEventListener('click', function (e) {
      var t = e.target;

      var recCard = t.closest && t.closest('.rec-card');
      if (recCard) { openDetalhe(recCard.dataset.receita); return; }

      var delIns = t.closest && t.closest('[data-del-insumo]');
      if (delIns) {
        var ins = Store.insumoById(delIns.dataset.delInsumo);
        if (confirm('Excluir o insumo "' + (ins ? ins.nome : '') + '"? Ele será removido das receitas que o usam.')) {
          Store.removeInsumo(delIns.dataset.delInsumo);
          renderInsumos();
          toast('Insumo excluído');
        }
        return;
      }

      if (t.closest && t.closest('[data-add-ing]')) {
        var r1 = Store.receitaById(currentReceitaId);
        if (r1) {
          var first = Store.insumos[0];
          r1.ingredientes.push({ insumoId: first ? first.id : null, quantidade: 0 });
          Store.saveReceita(r1);
          renderIngList();
          refreshComputed();
        }
        return;
      }

      var delIng = t.closest && t.closest('[data-del-ing]');
      if (delIng) {
        var r2 = Store.receitaById(currentReceitaId);
        if (r2) { r2.ingredientes.splice(+delIng.dataset.delIng, 1); Store.saveReceita(r2); renderIngList(); refreshComputed(); }
        return;
      }

      if (t.closest && t.closest('[data-add-forma]')) {
        var r3 = Store.receitaById(currentReceitaId);
        if (r3) {
          r3.formas.push({ id: Store.uid(), nome: 'Nova forma', peso: 100, qtd: 1 });
          Store.saveReceita(r3);
          renderFormaList();
          refreshComputed();
        }
        return;
      }

      var delForma = t.closest && t.closest('[data-del-forma]');
      if (delForma) {
        var r4 = Store.receitaById(currentReceitaId);
        if (r4) { r4.formas.splice(+delForma.dataset.delForma, 1); Store.saveReceita(r4); renderFormaList(); refreshComputed(); }
        return;
      }

      if (t.closest && t.closest('[data-del-receita]')) {
        var r5 = Store.receitaById(currentReceitaId);
        if (r5 && confirm('Excluir a receita "' + r5.nome + '"?')) {
          Store.removeReceita(r5.id);
          toast('Receita excluída');
          goBack();
        }
        return;
      }

      if (t.closest && t.closest('[data-export]')) { doExport(); return; }
      if (t.closest && t.closest('[data-import]')) { $('#importFile').click(); return; }
      if (t.closest && t.closest('[data-restaurar]')) {
        if (confirm('Restaurar os dados de exemplo? Isso substitui tudo que está salvo agora.')) {
          Store.restaurarExemplo();
          toast('Exemplo restaurado');
          setView('receitas');
        }
        return;
      }
      if (t.closest && t.closest('[data-apagar]')) {
        if (confirm('Apagar TODOS os dados (insumos e receitas)? Não dá pra desfazer.')) {
          Store.apagarTudo();
          toast('Tudo apagado');
          setView('receitas');
        }
        return;
      }
    });
  }

  // ---------- Service worker (offline / instalável) ----------
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  // ---------- Init ----------
  function init() {
    wireEvents();
    registerSW();
    setView('receitas');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
