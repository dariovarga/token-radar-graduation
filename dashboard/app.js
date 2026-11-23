// Graduation Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail view with
// the model's own inputs and the protocol's farm plan, and a separate Live token view. No
// network: every byte it shows is in data.js. The page recomputes each row's implied value
// and readiness from the snapshot figures and checks them against the board, so the page's
// code and the board's data are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', band: 'all', watchlist: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  // Deep-linking for screenshots and sharing: #detail=<slug>, #band=<band>, #category=<cat>,
  // #q=<text>, #tab=live. Read once on load.
  (function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var k = kv.slice(0, i);
      var v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      if (k === 'detail') state.selected = v;
      else if (k === 'band') state.band = v;
      else if (k === 'category') state.category = v;
      else if (k === 'q') state.q = v;
      else if (k === 'tab') state.tab = v;
    });
  })();

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtNum(n, digits) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(digits === undefined ? 2 : digits);
  }

  // The model in two functions: the page recomputes a row from the snapshot figures and checks
  // the numbers board.json carries, so the page and the data are visibly the same arithmetic.
  function readinessOf(row, model) {
    var age = row.age_days;
    var season;
    if (age === null || age === undefined) season = 20;
    else if (age <= 0) season = 0;
    else if (age < model.season_peak_days) season = (40 * age) / model.season_peak_days;
    else {
      var past = age - model.season_peak_days;
      var span = 1845 - model.season_peak_days;
      season = Math.max(model.season_floor, 40 - ((40 - model.season_floor) * Math.min(past, span)) / span);
    }
    var momentum;
    if (row.change_7d === null || row.change_7d === undefined) momentum = 10;
    else {
      var c = Math.min(model.momentum_cap, Math.max(model.momentum_floor, row.change_7d));
      momentum = (30 * (c - model.momentum_floor)) / (model.momentum_cap - model.momentum_floor);
    }
    var breadth = row.chains && row.chains.length > 0 ? [9, 12, 14, 15][Math.min(row.chains.length, 4) - 1] : 3;
    var scale = 0;
    if (row.tvl_usd > 0) {
      var log = Math.log10(row.tvl_usd);
      scale = 15 * Math.min(1, Math.max(0, (log - Math.log10(5000000)) / (Math.log10(1000000000) - Math.log10(5000000))));
    }
    return Math.min(100, Math.max(0, season + momentum + breadth + scale));
  }
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var ready = readinessOf(row, model);
    var readyMult = model.ready_floor + (ready / 100) * model.ready_range;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * readyMult));
  }
  function bandClass(band) {
    if (band === 'Graduating soon') return 'soon';
    if (band === 'Warming up') return 'warming';
    if (band === 'On the runway') return 'runway';
    return 'early';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    function addChild(child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) { child.forEach(addChild); return; }
      if (typeof child === 'string' || typeof child === 'number') { node.appendChild(document.createTextNode(String(child))); return; }
      node.appendChild(child);
    }
    for (var i = 2; i < arguments.length; i++) addChild(arguments[i]);
    return node;
  }

  function bandChip(band) {
    return el('span', { class: 'chip ' + bandClass(band), text: band });
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watchlist && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.band !== 'all' && r.band !== state.band) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var va = key === 'implied' ? a.implied_value_usd : key === 'readiness' ? a.readiness : key === 'tvl' ? a.tvl_usd : key === 'change' ? (a.change_7d === null ? -Infinity : a.change_7d) : key === 'age' ? (a.age_days === null ? -1 : a.age_days) : a.rank;
      var vb = key === 'implied' ? b.implied_value_usd : key === 'readiness' ? b.readiness : key === 'tvl' ? b.tvl_usd : key === 'change' ? (b.change_7d === null ? -Infinity : b.change_7d) : key === 'age' ? (b.age_days === null ? -1 : b.age_days) : b.rank;
      if (va !== vb) return (va < vb ? -1 : 1) * dir;
      return a.rank - b.rank;
    });
    return rows;
  }

  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ▼' : ' ▲') : '';
    return el('button', {
      type: 'button',
      text: label + arrow,
      onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        render();
      },
    });
  }

  function renderBoard() {
    var rows = filteredRows();
    var wrap = el('div');
    var soon = DATA.rows.filter(function (r) { return r.band === 'Graduating soon'; }).length;
    wrap.appendChild(el('p', { class: 'countline' }, [
      el('b', { text: String(rows.length) }), ' of ' + DATA.rows.length + ' rows shown · ',
      el('b', { text: String(DATA.watchlist_size) }), ' on the watchlist · ',
      el('b', { text: String(soon) }), ' graduating soon · ',
      'rank 1 is the highest implied value',
    ]));
    if (rows.length === 0) {
      wrap.appendChild(el('div', { class: 'empty', text: 'No rows match these filters. Clear the search or widen the band.' }));
      return wrap;
    }
    var table = el('table', { class: 'board' });
    var thead = el('thead', null, el('tr', null,
      el('th', null, sortButton('Rank', 'rank')),
      el('th', null, 'Protocol'),
      el('th', null, sortButton('Implied value', 'implied')),
      el('th', null, sortButton('TVL', 'tvl')),
      el('th', null, sortButton('7d', 'change')),
      el('th', null, sortButton('Age', 'age')),
      el('th', null, sortButton('Readiness', 'readiness')),
      el('th', null, 'Window')));
    table.appendChild(thead);
    var tbody = el('tbody');
    rows.forEach(function (r) {
      var pct = r.change_7d;
      var tr = el('tr', {
        class: state.selected === r.slug ? 'selected' : '',
        onclick: function () { selectRow(r.slug); },
        tabindex: '0',
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRow(r.slug); } },
      },
        el('td', { class: 'num rank', text: '#' + r.rank }),
        el('td', { class: 'name' }, el('b', { text: r.name }), el('span', { text: (r.category || 'Uncategorised') + ' · ' + (r.chains.length > 0 ? r.chains.slice(0, 2).join(', ') : 'no chain named') + (r.watchlist ? ' · watchlist' : '') })),
        el('td', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (pct === null ? '' : pct >= 0 ? 'pos' : 'neg'), text: fmtPct(pct) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('span', { class: 'ready' }, [
          el('span', { class: 'bar' }, el('i', { style: 'width:' + Math.round(r.readiness) + '%;background:' + (r.band === 'Graduating soon' ? '#3fb97f' : r.band === 'Warming up' ? '#5aa2e6' : r.band === 'On the runway' ? '#9b7ede' : '#8a94a3') })),
          el('b', { text: fmtNum(r.readiness, 0) }),
          bandChip(r.band),
        ])),
        el('td', { text: r.window + (r.stale ? ' · long wait' : '') }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderLive() {
    var wrap = el('div');
    wrap.appendChild(el('p', { class: 'countline' }, [
      'These protocols already trade, so the board shows the market\u2019s own values for them and never mixes them into the pre-token ranking. ',
      el('b', { text: String(DATA.live.length) }), ' largest by market cap.',
    ]));
    var table = el('table', { class: 'board' });
    table.appendChild(el('thead', null, el('tr', null,
      el('th', null, 'Protocol'),
      el('th', { class: 'num', text: 'Market cap' }),
      el('th', { class: 'num', text: 'TVL' }),
      el('th', { class: 'num', text: '7d' }))));
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'name' }, el('b', { text: r.name }), el('span', { text: (r.category || 'Uncategorised') + ' · ' + (r.chains.length > 0 ? r.chains.slice(0, 2).join(', ') : 'no chain named') })),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) })));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderDetail() {
    if (!state.selected) return null;
    var r = null;
    DATA.rows.forEach(function (row) { if (row.slug === state.selected) r = row; });
    if (!r) return null;
    var recomputed = impliedOf(r, DATA.model);
    var reReady = readinessOf(r, DATA.model);
    var impliedOk = recomputed === r.implied_value_usd;
    var readyOk = Math.abs(Math.round(reReady * 100) / 100 - r.readiness) < 0.011;
    var parts = r.readiness_parts;
    var section = el('section', { class: 'detail', 'aria-label': 'Protocol detail' });
    section.appendChild(el('h2', { text: '#' + r.rank + ' · ' + r.name }));
    section.appendChild(el('p', { class: 'sub', text: (r.category || 'Uncategorised') + ' · ' + (r.chains.length > 0 ? r.chains.join(', ') : 'no chain named') + ' · tracked since ' + (r.listed_at || 'unknown') + ' · records no token' }));
    var kv = el('div', { class: 'kv' });
    kv.appendChild(el('div', null, el('b', { text: fmtUsd(r.implied_value_usd) }), el('span', { text: 'implied value' })));
    kv.appendChild(el('div', null, el('b', { text: fmtNum(r.readiness, 1) + ' / 100' }), el('span', { text: 'graduation readiness' })));
    kv.appendChild(el('div', null, el('b', { text: r.band }), el('span', { text: 'window: ' + r.window })));
    kv.appendChild(el('div', null, el('b', { text: fmtUsd(r.tvl_usd) }), el('span', { text: 'TVL' })));
    kv.appendChild(el('div', null, el('b', { text: fmtPct(r.change_7d) }), el('span', { text: 'TVL change, 7 days' })));
    kv.appendChild(el('div', null, el('b', { text: fmtAge(r.age_days) }), el('span', { text: 'age with no token on record' })));
    section.appendChild(kv);
    section.appendChild(el('h3', { text: 'Why this readiness' }));
    var partRows = [
      ['Seasoning', parts.seasoning, 40],
      ['Momentum', parts.momentum, 30],
      ['Breadth', parts.breadth, 15],
      ['Scale', parts.scale, 15],
    ];
    var partsEl = el('div', { class: 'parts' });
    partRows.forEach(function (p) {
      partsEl.appendChild(el('div', { class: 'part' }, [
        el('span', { text: p[0] }),
        el('span', { class: 'bar' }, el('i', { style: 'width:' + Math.round((p[1] / p[2]) * 100) + '%' })),
        el('b', { text: fmtNum(p[1], 1) + ' / ' + p[2] }),
      ]));
    });
    section.appendChild(partsEl);
    section.appendChild(el('h3', { text: 'The arithmetic' }));
    section.appendChild(el('p', { class: 'formula' }, [
      el('b', { text: fmtUsd(r.implied_value_usd) }),
      ' = ' + fmtUsd(r.tvl_usd) + ' TVL × ' + r.category_multiple + ' (' + (r.category || 'no category') + ') × ' +
      fmtNum(r.growth_multiplier) + ' growth × ' + fmtNum(r.maturity_multiplier) + ' maturity × ' + fmtNum(r.readiness_multiplier) + ' readiness',
    ]));
    section.appendChild(el('p', { class: 'checkline' }, [
      'The page recomputes ',
      el('b', { text: fmtUsd(recomputed) + ' implied, ' + fmtNum(reReady, 1) + ' readiness' }),
      ' from the snapshot figures — ' + (impliedOk && readyOk ? 'matches the board.' : 'DOES NOT MATCH the board.'),
    ]));
    if (r.stale) {
      section.appendChild(el('p', { class: 'checkline', text: 'Long wait: no token on record after more than four years tracked, so seasoning counts less here than for a younger protocol.' }));
    }
    section.appendChild(el('h3', { text: 'Farm plan · hold ' + (r.band === 'Graduating soon' ? '45' : r.band === 'Warming up' ? '90' : r.band === 'On the runway' ? '180' : '365') + ' days, window ' + r.window }));
    var ol = el('ol', { class: 'steps' });
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    section.appendChild(ol);
    return section;
  }

  function selectRow(slug) {
    state.selected = state.selected === slug ? null : slug;
    if (window.history && window.history.replaceState) {
      var h = state.selected ? '#detail=' + encodeURIComponent(state.selected) : '#';
      window.history.replaceState(null, '', h);
    }
    render();
    if (state.selected) {
      var d = document.querySelector('.detail');
      if (d) d.scrollIntoView({ block: 'nearest' });
    }
  }

  function render() {
    app.setAttribute('aria-busy', 'false');
    app.textContent = '';
    var wrap = el('div', { class: 'wrap' });
    var hero = el('header', { class: 'hero' });
    hero.appendChild(el('p', { class: 'eyebrow', text: 'Token launch radar · model ' + DATA.model_version }));
    hero.appendChild(el('h1', { text: 'Graduation Radar' }));
    hero.appendChild(el('p', { class: 'lede' }, [
      el('strong', { text: 'Which pre-token protocol looks most ready to graduate to a token launch — and what would that token be worth?' }),
      ' The board ranks ' + DATA.board_size + ' protocols by implied value, with each row\u2019s graduation readiness folded in: seasoning with no token on record, seven-day momentum, chain breadth and scale.',
    ]));
    hero.appendChild(el('p', { class: 'honest' }, [
      el('strong', { text: 'Read this first: ' }),
      'readiness is this radar\u2019s ranking signal, computed from the snapshot\u2019s own figures. It is not a prediction that a token will be issued, or when. A protocol on this board records no token in the snapshot; that is the record, not proof it has none.',
    ]));
    var soon = DATA.rows.filter(function (r) { return r.band === 'Graduating soon'; }).length;
    var stats = el('div', { class: 'stats' });
    stats.appendChild(el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'rows ranked' })));
    stats.appendChild(el('div', { class: 'stat' }, el('b', { text: String(DATA.watchlist_size) }), el('span', { text: 'watchlist covered' })));
    stats.appendChild(el('div', { class: 'stat' }, el('b', { text: String(soon) }), el('span', { text: 'graduating soon' })));
    stats.appendChild(el('div', { class: 'stat' }, el('b', { text: fmtUsd(DATA.rows[0].implied_value_usd) }), el('span', { text: 'top implied value' })));
    stats.appendChild(el('div', { class: 'stat' }, el('b', { text: DATA.as_of }), el('span', { text: 'snapshot date' })));
    hero.appendChild(stats);
    wrap.appendChild(hero);

    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    tabs.appendChild(el('button', {
      class: 'tab', role: 'tab', 'aria-selected': state.tab === 'pre-token' ? 'true' : 'false',
      text: 'Pre-token board (' + DATA.board_size + ')',
      onclick: function () { state.tab = 'pre-token'; render(); },
    }));
    tabs.appendChild(el('button', {
      class: 'tab', role: 'tab', 'aria-selected': state.tab === 'live' ? 'true' : 'false',
      text: 'Live tokens (' + DATA.live.length + ')',
      onclick: function () { state.tab = 'live'; render(); },
    }));
    wrap.appendChild(tabs);

    // A selected row's detail sits directly under the tabs, so a deep link (#detail=<slug>)
    // opens on the detail itself and a click brings it into view.
    if (state.tab === 'pre-token' && state.selected) {
      var detailTop = renderDetail();
      if (detailTop) wrap.appendChild(detailTop);
    }

    if (state.tab === 'pre-token') {
      var categories = [];
      DATA.rows.forEach(function (r) {
        var c = r.category || 'Uncategorised';
        if (categories.indexOf(c) < 0) categories.push(c);
      });
      categories.sort();
      var controls = el('div', { class: 'controls' });
      var qField = el('div', { class: 'field' });
      qField.appendChild(el('label', { for: 'q', text: 'Search' }));
      var qInput = el('input', { id: 'q', type: 'search', placeholder: 'Name, slug or category', value: state.q });
      qInput.addEventListener('input', function () { state.q = qInput.value; renderBoardOnly(); });
      qField.appendChild(qInput);
      controls.appendChild(qField);
      var catField = el('div', { class: 'field' });
      catField.appendChild(el('label', { for: 'cat', text: 'Category' }));
      var catSel = el('select', { id: 'cat' });
      catSel.appendChild(el('option', { value: 'all', text: 'All categories' }));
      categories.forEach(function (c) {
        var o = el('option', { value: c, text: c });
        if (state.category === c) o.selected = true;
        catSel.appendChild(o);
      });
      catSel.addEventListener('change', function () { state.category = catSel.value; render(); });
      catField.appendChild(catSel);
      controls.appendChild(catField);
      var bandField = el('div', { class: 'field' });
      bandField.appendChild(el('label', { for: 'band', text: 'Readiness band' }));
      var bandSel = el('select', { id: 'band' });
      ['all', 'Graduating soon', 'Warming up', 'On the runway', 'Early'].forEach(function (b) {
        var o = el('option', { value: b, text: b === 'all' ? 'All bands' : b });
        if (state.band === b) o.selected = true;
        bandSel.appendChild(o);
      });
      bandSel.addEventListener('change', function () { state.band = bandSel.value; render(); });
      bandField.appendChild(bandSel);
      controls.appendChild(bandField);
      var wl = el('label', { class: 'check' });
      var wlBox = el('input', { type: 'checkbox' });
      wlBox.checked = state.watchlist;
      wlBox.addEventListener('change', function () { state.watchlist = wlBox.checked; render(); });
      wl.appendChild(wlBox);
      wl.appendChild(document.createTextNode(' Watchlist only'));
      controls.appendChild(wl);
      wrap.appendChild(controls);
      var boardHost = el('div', { id: 'board-host' });
      boardHost.appendChild(renderBoard());
      wrap.appendChild(boardHost);
    } else {
      wrap.appendChild(renderLive());
    }

    wrap.appendChild(el('section', null,
      el('h3', { text: 'How the model works' }),
      el('p', { class: 'modelnote' }, [
        'implied = TVL × category multiple (0.20–0.34 by line of business) × growth (7-day change clamped to −60…+120%, weighted 0.5) × maturity (0.6 + up to 0.4 over 1,095 days) × readiness multiplier (0.7 + up to 0.9). ',
        'Readiness (0–100) = seasoning (40, peaks near 900 days with no token, then falls) + momentum (30, from the 7-day change) + breadth (15, from chain count) + scale (15, from log TVL). ',
        'Bands: 65+ Graduating soon (window next 90 days) · 50–64 Warming up (90–180 days) · 35–49 On the runway (180–365 days) · below 35 Early (over a year out). ',
        'The same function scores every row; no protocol name is special-cased.',
      ])));
    var foot = el('footer', { class: 'foot' });
    foot.appendChild(el('p', { text: 'Snapshot as of ' + DATA.as_of + ', fetched once from DefiLlama\u2019s public API. Floor: ' + fmtUsd(DATA.floor_usd) + '. The board covers the whole ' + DATA.watchlist_size + '-protocol watchlist plus ' + DATA.early_size + ' early pre-token protocols below the floor.' }));
    foot.appendChild(el('p', { text: 'Farm plans are this radar\u2019s own derivation from each protocol\u2019s category, chains, TVL, age and readiness band. They are not investment advice, and a token launch is never promised.' }));
    wrap.appendChild(foot);
    app.appendChild(wrap);
  }

  function renderBoardOnly() {
    var host = document.getElementById('board-host');
    if (!host) { render(); return; }
    host.textContent = '';
    host.appendChild(renderBoard());
    var q = document.getElementById('q');
    if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  render();
})();
