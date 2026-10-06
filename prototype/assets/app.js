(function () {
  const D = window.MB_DATA;
  const I = window.MB_I18N;
  const ICONS = window.MB_ICONS;

  // ---------- State ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mb_' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mb_' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const S = {
    lang: store.get('lang', 'no'),
    car: null, plate: '', looking: false, euPlate: '', euCar: null, plateErr: '',
    cat: 'service', after: null,
    items: [], symptoms: [], issueText: '', attached: 0,
    city: 'gjovik', loc: null, day: 0, slot: null, handover: 'drop',
    contact: { name: '', phone: '', email: '', km: '', comment: '', sms: true }, err: '',
    booking: null, editing: false,
    cart: [], checkout: { delivery: 'pickup', store: 'gjovik', address: '', zip: '', city: '' }, order: null,
    shopCat: 'alle', shopFit: false,
    user: null, mineCar: 'EL12345', garageCars: D.garage.cars.slice(), extraCars: {},
    pdp: { id: null, qty: 4, delivery: 'fit', hotel: true, plate: '', car: null },
    modal: null, chat: [], chatTyping: false, addPlate: '', notify: { sms: true, email: true },
    lastRoute: '',
  };

  // ---------- Helpers ----------
  const t = (k, vars) => {
    let s = (I[S.lang] && I[S.lang][k]) || I.no[k] || k;
    if (vars && typeof s === 'string') Object.keys(vars).forEach((v) => { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  };
  const L = (o) => (o && typeof o === 'object' && 'no' in o ? o[S.lang] || o.no : o);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kr = (n) => Math.round(n).toLocaleString('nb-NO') + ' kr';
  const locale = () => (S.lang === 'no' ? 'nb-NO' : 'en-GB');
  const fmt = (d, o) => new Date(d).toLocaleDateString(locale(), o);
  const dShort = (d) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });
  const dur = (m) => (m < 60 ? m + ' ' + t('mins') : Math.floor(m / 60) + ' ' + t('hours') + (m % 60 ? ' ' + (m % 60) + ' ' + t('mins') : ''));
  const normPlate = (p) => String(p || '').toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, '');
  const prettyPlate = (p) => normPlate(p).replace(/^([A-ZÆØÅ]{2})(\d+)$/, '$1 $2');
  const validPlate = (p) => /^[A-ZÆØÅ]{2}\d{4,5}$/.test(normPlate(p));
  const weeksTo = (iso) => Math.round((new Date(iso) - new Date()) / (7 * 864e5));
  const euSoon = (car) => weeksTo(car.euDue) <= 12;
  const locById = (id) => D.locations.find((l) => l.id === id);
  const carName = (c) => c.make + ' ' + c.model;
  const first = (name) => esc(String(name || '').split(' ')[0]);

  function lookup(plate) {
    if (!validPlate(plate)) return null;
    const key = normPlate(plate);
    const c = D.cars[key] || S.extraCars[key] || Object.assign({}, D.cars._default);
    return Object.assign({}, c, { key, plate: c.plate || prettyPlate(plate) });
  }
  const getCar = (k) => (D.cars[k] ? Object.assign({ key: k }, D.cars[k]) : S.extraCars[k]);
  const garageOf = (k) => D.garage[k] || { km: null, nextService: { label: { no: 'Ikke registrert', en: 'Not recorded' }, pct: 0 }, falck: null, hotel: null, recos: [], history: [] };

  function svc(item) {
    if (item.custom) return item;
    const s = D.services[item.id];
    let price = s.price;
    if (s.bySize && S.car) price = D.wheelPrice(S.car.wheel) + (s.hotel ? D.hotelPrice(S.car.wheel) : 0);
    return Object.assign({ id: item.id }, s, { price });
  }
  const has = (id) => S.items.some((i) => i.id === id);
  const fitsCar = (s) => {
    const c = S.car; if (!c) return true;
    if (s.fuel && s.fuel.indexOf(c.fuel) < 0) return false;
    if (s.maxWeight && c.weight > s.maxWeight) return false;
    if (s.minWeight && c.weight <= s.minWeight) return false;
    return true;
  };
  const totals = (items) => (items || S.items).reduce((a, i) => { const s = svc(i); a.price += s.price || 0; a.mins += s.mins || 0; if (s.from) a.from = true; if (s.mode === 'request') a.request = true; return a; }, { price: 0, mins: 0, from: false, request: false });
  const priceTxt = (s) => (s.quote ? t('price_quote') : (s.from ? t('from') + ' ' : '') + kr(s.price));
  const totalTxt = (tot) => (tot.from ? t('from') + ' ' : '') + kr(tot.price);
  const cartCount = () => S.cart.reduce((n, c) => n + c.qty, 0);
  const cartSum = () => S.cart.reduce((n, c) => n + D.products[c.id].price * c.qty, 0);

  // ---------- Icons + assets ----------
  const ic = (n, cls) => '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  const IMG = {
    logoDark: 'assets/img/logo-dark.png', logoWhite: 'assets/img/logo-white.png',
    hero: 'assets/img/hero.jpg', hakka: 'assets/img/hakka.jpg', hotel: 'assets/img/tyrehotel.jpg', facade: 'assets/img/facade.jpg',
  };
  const bg = (src) => 'style="background-image:url(\'' + src + '\')"';
  const plateChip = (p, lg) => '<span class="chip-plate' + (lg ? ' lg' : '') + '"><b>N</b><span>' + esc(p) + '</span></span>';
  // Side-profile car illustration, coloured via `color`.
  const carArt = (fuel, cls) => '<svg class="car-art ' + (cls || '') + '" viewBox="0 0 320 120" fill="none" aria-hidden="true">' +
    '<ellipse cx="160" cy="108" rx="140" ry="7" fill="currentColor" opacity=".12"/>' +
    '<path d="M22 86c0-12 6-20 20-23l38-8c16-15 38-27 74-27h40c26 0 48 11 66 26l28 5c13 2 20 10 20 22v9H22z" fill="currentColor" opacity=".9"/>' +
    '<path d="M92 56c13-12 32-20 60-20h34c19 0 36 7 50 20z" fill="#fff" opacity=".22"/>' +
    '<path d="M168 36v20" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>' +
    '<circle cx="82" cy="93" r="17" fill="#0d1820"/><circle cx="82" cy="93" r="8" fill="#c9d1d6"/>' +
    '<circle cx="246" cy="93" r="17" fill="#0d1820"/><circle cx="246" cy="93" r="8" fill="#c9d1d6"/>' +
    (fuel === 'ev' ? '<path d="M150 62l-8 12h7l-3 9 10-13h-7l3-8z" fill="#8fdbe6"/>' : '') + '</svg>';

  const CATS = [
    { id: 'service', icon: 'wrench' }, { id: 'eu', icon: 'clipboard-check' }, { id: 'tyre', icon: 'circle-dot' },
    { id: 'issue', icon: 'triangle-alert' }, { id: 'other', icon: 'ellipsis' },
  ];
  const SYM_ICON = { alert: 'triangle-alert', sound: 'volume-2', disc: 'disc', steer: 'car-front', snow: 'snowflake', bolt: 'zap', key: 'key', dots: 'ellipsis' };
  const SVC_ICON = { brakes: 'disc', wipers: 'sparkles', battery: 'battery-charging', pre_pkk: 'clipboard-check', align: 'gauge', ac: 'snowflake' };

  // ---------- Router ----------
  const route = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const query = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const go = (h) => { S.modal = null; if (location.hash === '#' + h) render(); else location.hash = h; };
  window.addEventListener('hashchange', () => { S.modal = null; render(); if (location.hash.indexOf('#/#') !== 0) window.scrollTo(0, 0); });

  // ---------- Chrome ----------
  const ribbon = () => '<div class="ribbon">' + t('proto_note') + '</div>';
  const langToggle = () => '<div class="lang" role="group" aria-label="Language"><button data-a="lang" data-v="no" aria-pressed="' + (S.lang === 'no') + '">NO</button><button data-a="lang" data-v="en" aria-pressed="' + (S.lang === 'en') + '">EN</button></div>';
  const logo = (white) => '<a class="logo" href="#/" aria-label="Mjøsbil"><img src="' + (white ? IMG.logoWhite : IMG.logoDark) + '" alt="Mjøsbil"></a>';
  const cartBtn = () => '<button class="icon-btn" data-a="open" data-v="cart" aria-label="' + t('cart_title') + '">' + ic('shopping-bag') + (cartCount() ? '<span class="dot">' + cartCount() + '</span>' : '') + '</button>';
  const NAV = () => [['#/bestill/bil?k=service', 'nav_workshop', 'wrench'], ['#/bestill/bil?k=tyre', 'nav_tyres', 'circle-dot'], ['#/butikk', 'nav_shop', 'shopping-bag'], ['#/avdeling/gjovik', 'nav_locations', 'map-pin']];

  function header() {
    const r = route();
    const cur = (href) => (href.indexOf('#/butikk') === 0 && (r === '/butikk' || r.indexOf('/produkt') === 0)) || (href.indexOf('#/avdeling') === 0 && r.indexOf('/avdeling') === 0);
    return ribbon() + '<header class="hdr"><div class="wrap">' + logo() +
      '<nav class="nav">' + NAV().map((n) => '<a href="' + n[0] + '"' + (cur(n[0]) ? ' aria-current="page"' : '') + '>' + t(n[1]) + '</a>').join('') + '</nav>' +
      '<div class="hdr-right">' + langToggle() +
      '<a class="icon-btn me" href="#/min-bil"' + (r === '/min-bil' ? ' aria-current="page"' : '') + '>' + ic('user') + (S.user ? first(S.user.name) : t('nav_mine')) + '</a>' +
      cartBtn() +
      '<a class="btn btn-ink btn-sm hdr-book" href="#/bestill/bil">' + t('nav_book') + '</a>' +
      '<button class="icon-btn mob" data-a="open" data-v="menu" aria-label="' + t('menu') + '">' + ic('menu') + '</button>' +
      '</div></div></header>';
  }
  function bookHeader() {
    return ribbon() + '<header class="hdr"><div class="wrap">' + logo() +
      '<a class="hdr-help" href="tel:+4761138888">' + ic('phone') + '<span class="t">' + t('help') + '</span> ' + D.phone + '</a>' +
      langToggle() + '</div></header>';
  }
  function footer() {
    return '<footer class="footer"><div class="wrap">' +
      '<div class="cols"><img src="' + IMG.logoWhite + '" alt="Mjøsbil"><span style="margin-top:12px">BilXtra verksted · Fagdekk · BilXtra butikk</span><a href="tel:+4761138888">' + D.phone + '</a><a href="mailto:post@mjosbil.no">post@mjosbil.no</a></div>' +
      '<div class="cols"><b>' + t('nav_workshop') + '</b>' + CATS.map((c) => '<a href="#/bestill/bil?k=' + c.id + '">' + t('i_' + c.id) + '</a>').join('') + '</div>' +
      '<div class="cols"><b>' + t('nav_locations') + '</b>' + D.locations.map((l) => '<a href="#/avdeling/' + l.id + '">' + esc(l.name) + '</a>').join('') + '</div>' +
      '<div class="cols"><b>' + t('nav_shop') + '</b>' + D.shopCats.slice(1).map((c) => '<a href="#/butikk?c=' + c.id + '">' + L(c.name) + '</a>').join('') + '<a href="#/min-bil" style="margin-top:8px">' + t('nav_mine') + ' →</a></div>' +
      '</div><div class="wrap foot-note">' + t('proto_note') + '</div></footer>';
  }
  function plateInput(name, val, form) {
    const err = S.plateErr === form;
    return '<label class="plate' + (err ? ' err' : '') + '"><span class="plate-eu"><i></i>N</span><span class="sr">Reg.nr</span>' +
      '<input data-in="' + name + '" data-plate="1" value="' + esc(val) + '" placeholder="' + t('plate_placeholder') + '" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8"' + (err ? ' aria-invalid="true"' : '') + '></label>';
  }
  const plateErr = (form) => (S.plateErr === form ? '<p class="field-err" role="alert">' + ic('circle-alert') + t('plate_err') + '</p>' : '');
  const tryPlates = (action) => '<div class="try">' + t('hero_try') + ' ' + ['EL 12345', 'DN 54321', 'BR 11223'].map((p) => '<button data-a="' + action + '" data-v="' + p + '">' + plateChip(p) + '</button>').join('') + '</div>';

  // ---------- Availability (mock, deterministic) ----------
  const SLOT_TIMES = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '12:30', '13:00', '14:00', '14:30'];
  const DAYS = (() => { const out = []; const d = new Date(); d.setHours(12, 0, 0, 0); while (out.length < 12) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) out.push(new Date(d)); } return out; })();
  function slotsFor(loc, di) {
    if ((loc.seed * 31 + di * 17) % 11 === 0 && di < 3) return SLOT_TIMES.map(() => false);
    return SLOT_TIMES.map((_, i) => ((loc.seed + i * 7 + di * 5) % 10) > (di < 2 ? 6 : 3));
  }
  function firstFree(loc) { for (let d = 0; d < DAYS.length; d++) { const i = slotsFor(loc, d).indexOf(true); if (i >= 0) return { d, time: SLOT_TIMES[i] }; } return null; }
  const dayLabel = (i) => ((DAYS[0] - new Date()) < 2 * 864e5 && i === 0 ? t('tomorrow') : fmt(DAYS[i], { weekday: 'short', day: 'numeric', month: 'short' }));
  const firstFreeLabel = (loc) => { const f = firstFree(loc); return f ? dayLabel(f.d) + ' ' + f.time : '–'; };
  const whenText = (b) => { const day = b ? b.day : S.day; const slot = b ? b.slot : S.slot; return slot ? fmt(DAYS[day], { weekday: 'long', day: 'numeric', month: 'long' }) + ' ' + slot : ''; };
  const mapsUrl = (l) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.name + ' ' + l.addr);

  // ---------- Home ----------
  function productCard(id) {
    const p = D.products[id];
    return '<div class="pcard"><a class="pimg" href="#/produkt/' + id + '" ' + bg(p.img) + ' aria-label="' + esc(p.brand + ' ' + L(p.name)) + '">' + (p.was ? '<span class="tag tag-err sale">' + t('sale') + '</span>' : '') + '</a>' +
      '<div class="pbody"><span class="brand">' + esc(p.brand) + '</span><a class="name" href="#/produkt/' + id + '">' + esc(L(p.name)) + '</a><span class="spec">' + esc(L(p.spec)) + '</span>' +
      '<span class="price">' + kr(p.price) + (p.was ? ' <s>' + kr(p.was) + '</s>' : '') + ' <small>' + L(p.unit) + '</small></span>' +
      (p.tyre ? '<span class="tag tag-mjos">' + ic('wrench') + t('shop_fit') + '</span>' : '') +
      '<button class="btn btn-ghost btn-sm add" data-a="cart-add" data-v="' + id + '">' + ic('plus') + t('add_cart') + '</button></div></div>';
  }

  function home() {
    const gj = locById('gjovik');
    let euRes = '';
    if (S.euCar) {
      const w = weeksTo(S.euCar.euDue);
      euRes = '<div class="eu-res ' + (w > 12 ? 'ok' : '') + '">' + ic(w > 12 ? 'circle-check' : 'clock') + '<span><b>' + esc(carName(S.euCar)) + '</b> · ' + t('eu_due_in', { date: fmt(S.euCar.euDue, { day: 'numeric', month: 'long', year: 'numeric' }) }) + '</span><button class="btn btn-ink btn-sm" data-a="eu-book">' + t('nav_book') + '</button></div>';
    }
    const g = D.garage.EL12345;
    return header() + '<main class="page">' +
      '<section class="hero on-dark"><div class="wrap"><div>' +
      '<span class="kicker">' + t('hero_kicker') + '</span><h1>' + t('hero_title').replace('<br>', ' ') + '</h1><p class="sub">' + t('hero_sub') + '</p>' +
      '<form class="plate-row" data-form="hero" novalidate>' + plateInput('plate', S.plate, 'hero') + '<button class="btn btn-mjos" type="submit">' + t('hero_cta') + ic('arrow-right') + '</button></form>' + plateErr('hero') +
      tryPlates('hero-try') +
      '<div class="usps"><span>' + ic('circle-check') + t('usp_price') + '</span><span>' + ic('zap') + t('usp_ev') + '</span><span>' + ic('shield-check') + t('usp_falck') + '</span></div>' +
      '</div><div class="hero-photo" ' + bg(IMG.hero) + '><a class="float-card" href="#/avdeling/gjovik"><span class="tile">' + ic('calendar-check') + '</span><span><small>' + t('hero_first', { loc: gj.name }) + '</small><b>' + firstFreeLabel(gj) + '</b></span></a></div></div></section>' +

      seasonStrip() +
      '<section class="section"><div class="wrap"><div class="sec-h"><h2>' + t('intent_title') + '</h2></div><div class="intents">' +
      CATS.map((c) => '<button class="intent" data-a="home-cat" data-v="' + c.id + '"><span class="tile-ico">' + ic(c.icon) + '</span><span><b>' + t('i_' + c.id) + '</b><small>' + t('i_' + c.id + '_sub') + '</small></span><span class="go">' + ic('arrow-right') + '</span></button>').join('') +
      '</div></div></section>' +

      '<section class="section"><div class="wrap"><div class="how"><div class="how-h"><span class="kicker">' + t('how_kicker') + '</span><h2>' + t('how_title') + '</h2></div>' +
      [1, 2, 3].map((n) => '<div class="how-step"><span class="how-n">' + n + '</span><b>' + t('how' + n + '_t') + '</b><p>' + t('how' + n) + '</p></div>').join('') + '</div></div></section>' +

      '<section class="section"><div class="wrap promos">' +
      '<div class="promo promo-winter with-photo"><span class="kicker">' + ic('snowflake') + t('season_kicker') + '</span><h3>' + t('season_title') + '</h3><p>' + t('season_text') + '</p><button class="btn btn-ink" data-a="home-cat" data-v="tyre">' + t('season_cta') + ic('arrow-right') + '</button><div class="promo-photo" ' + bg(IMG.hakka) + '></div></div>' +
      '<div class="promo promo-ev on-dark"><span class="kicker">' + ic('zap') + t('ev_kicker') + '</span><h3>' + t('ev_title') + '</h3><p>' + t('ev_text') + '</p><button class="btn btn-white" data-a="home-ev">' + t('ev_cta') + ic('arrow-right') + '</button>' + carArt('ev', 'promo-car') + '</div>' +
      '</div></section>' +

      '<section class="section"><div class="wrap"><div class="eu-check"><div><span class="kicker">' + ic('clipboard-check') + t('i_eu') + '</span><h3 style="margin-top:8px">' + t('eu_check_title') + '</h3><p class="muted" style="margin-top:6px">' + t('eu_check_text') + '</p></div>' +
      '<div><form class="plate-row" data-form="eu" novalidate>' + plateInput('euPlate', S.euPlate, 'eu') + '<button class="btn btn-ink" type="submit">' + t('eu_check_cta') + '</button></form>' + plateErr('eu') + '</div>' + euRes + '</div></div></section>' +

      '<section class="section"><div class="wrap"><div class="mycar-teaser on-dark"><div style="display:grid;gap:14px;justify-items:start"><span class="kicker">' + ic('car') + t('mt_kicker') + '</span><h3>' + t('mt_title') + '</h3><p>' + t('mt_text') + '</p><a class="btn btn-mjos" href="#/min-bil">' + t('mt_cta') + ic('arrow-right') + '</a></div>' +
      '<div class="mini-stack">' +
      '<div class="mini"><span class="tile-ico">' + ic('clipboard-check') + '</span><span><small>' + t('mt_eu') + ' · EL 12345</small><b>' + fmt(D.cars.EL12345.euDue, { day: 'numeric', month: 'long', year: 'numeric' }) + '</b></span></div>' +
      '<div class="mini"><span class="tile-ico">' + ic('package') + '</span><span><small>' + t('mt_hotel') + '</small><b>' + L(g.hotel.stored) + ' · ' + esc(locById(g.hotel.loc).name) + '</b></span></div>' +
      '<div class="mini"><span class="tile-ico">' + ic('history') + '</span><span><small>' + t('mt_hist') + ' · ' + dShort(g.history[0].date) + '</small><b>' + esc(L(g.history[0].items)[0]) + '</b></span></div>' +
      '</div></div></div></section>' +

      '<section class="section" id="shop"><div class="wrap"><div class="sec-h"><div><h2>' + t('shop_title') + '</h2><p>' + t('shop_sub') + '</p></div><a class="link" href="#/butikk">' + t('shop_all') + ic('arrow-right') + '</a></div><div class="products">' +
      ['hakka10', 'hakkar5', 'edge', 'blaster'].map(productCard).join('') + '</div></div></section>' +

      '<section class="section" id="locs"><div class="wrap"><div class="sec-h"><div><h2>' + t('loc_title') + '</h2><p>' + t('loc_sub') + '</p></div><a class="link" href="#/avdeling/gjovik">' + t('loc_all') + ic('arrow-right') + '</a></div>' +
      '<div class="locs">' + D.locations.map((l) => '<a class="loc-card" href="#/avdeling/' + l.id + '"><span class="tile-ico">' + ic('map-pin') + '</span><span><b>' + esc(l.name) + '</b><span class="meta">' + t('first_free') + ': <b>' + firstFreeLabel(l) + '</b></span></span><span class="go">' + ic('arrow-right') + '</span></a>').join('') +
      '</div></div></section></main>' + footer();
  }

  // ---------- Tyre season ----------
  function weekLoad() {
    let free = 0, all = 0;
    D.locations.forEach((l) => { for (let d = 0; d < 5; d++) { const sl = slotsFor(l, d); all += sl.length; free += sl.filter(Boolean).length; } });
    return Math.round(100 - (free / all) * 100);
  }
  const hotelOf = (key) => (S.user && D.garage[key] && D.garage[key].hotel) ? D.garage[key].hotel : null;
  function seasonStrip() {
    const h = hotelOf('EL12345');
    if (h) {
      const loc = locById(h.loc);
      return '<section class="season"><div class="wrap"><div class="season-card me"><div class="season-photo" ' + bg(IMG.hotel) + '></div><div class="season-body"><span class="kicker">' + ic('snowflake') + t('ss_kicker') + '</span>' +
        '<h3>' + t('ss_me_title', { name: first(S.user.name) }) + '</h3><p>' + t('ss_me_text', { what: esc(L(h.stored)), loc: esc(loc.name), shelf: esc(h.shelf), when: firstFreeLabel(loc) }) + '</p>' +
        '<div class="season-cta"><button class="btn btn-ink" data-a="express" data-v="EL12345">' + ic('zap') + t('express') + '</button><a class="link" href="#/min-bil">' + t('nav_mine') + ic('arrow-right') + '</a></div></div></div></div></section>';
    }
    return '<section class="season"><div class="wrap"><div class="season-card"><div class="season-body"><span class="kicker">' + ic('snowflake') + t('ss_kicker') + '</span>' +
      '<h3>' + t('ss_title') + '</h3><p>' + t('ss_text', { pct: weekLoad() }) + ' ' + t('ss_hotel') + '.</p>' +
      '<div class="meter warn" aria-hidden="true"><i style="width:' + weekLoad() + '%"></i></div>' +
      '<div class="season-cta"><button class="btn btn-ink" data-a="home-cat" data-v="tyre">' + t('season_cta') + ic('arrow-right') + '</button><span class="muted">' + t('ss_login') + ' <button class="link" data-a="season-login">' + t('ss_login_cta') + '</button></span></div></div></div></div></section>';
  }

  // ---------- Reminders ----------
  function reminders(key) {
    const car = getCar(key); const g = garageOf(key); const name = first(S.user ? S.user.name : '');
    const today = new Date(); const out = [];
    const add = (o) => out.push(o);
    const days = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
    if (g.hotel) add({ ch: 'sms', when: days(-1), sent: true, title: t('rem_tyre_t'), text: t('rem_tyre', { name, what: L(g.hotel.stored), shelf: g.hotel.shelf, loc: locById(g.hotel.loc).name, plate: normPlate(car.plate) }), cta: { a: 'express', v: key } });
    if (S.booking && S.booking.car.key === key) {
      const b = S.booking; const loc = locById(b.loc);
      add({ ch: 'sms', when: today, sent: true, now: true, title: t('rem_conf_t'), text: t('rem_conf', { name: first(b.contact.name), what: b.items.map((i) => L(svc(i).name)).join(', '), loc: loc.name, when: whenText(b), ref: b.ref }), cta: { a: 'nav', v: '/min-bil' } });
      const dayBefore = new Date(DAYS[b.day]); dayBefore.setDate(dayBefore.getDate() - 1);
      add({ ch: 'sms', when: dayBefore, sent: false, title: t('rem_day_t'), text: t('rem_day', { loc: loc.name, time: b.slot, bring: bringList(b).join(', ').toLowerCase(), phone: D.phone }) });
    }
    const reco = g.recos.find((r) => r.level === 'warn');
    if (reco) add({ ch: 'email', when: days(-21), sent: true, title: t('rem_reco_t'), text: t('rem_reco', { name, what: L(reco.title).toLowerCase() }), cta: reco.add ? { a: 'mine-add', v: reco.add } : null });
    if (g.nextService && g.nextService.pct >= 90) add({ ch: 'email', when: days(-14), sent: true, title: t('rem_service_t'), text: t('rem_service', { since: L(car.lastService).replace(/ siden| ago/, ''), plate: car.plate, svc: L(D.services[car.fuel === 'ev' ? 'ev_eco_brk' : 'eco20'].name).toLowerCase() }), cta: { a: 'mine-book', v: 'service' } });
    const euWarn = new Date(car.euDue); euWarn.setDate(euWarn.getDate() - 56);
    add({ ch: 'sms', when: euWarn < today ? days(-3) : euWarn, sent: euWarn < today, title: t('rem_eu_t'), text: t('rem_eu', { plate: car.plate, date: fmt(car.euDue, { day: 'numeric', month: 'long', year: 'numeric' }) }), cta: { a: 'mine-book', v: 'eu' } });
    return out.sort((a, b) => (a.sent === b.sent ? (a.sent ? b.when - a.when : a.when - b.when) : a.sent ? -1 : 1));
  }
  function remindersPanel(key) {
    const list = reminders(key);
    const tog = (k) => '<label class="switch sm"><input type="checkbox" data-in="notify.' + k + '" ' + (S.notify[k] ? 'checked' : '') + '><span></span>' + t('rem_' + k) + '</label>';
    return '<div class="panel"><div class="panel-h"><div><h2>' + t('rem_title') + '</h2><p class="muted" style="font-size:13px">' + t('rem_sub') + '</p></div></div><div class="panel-b">' +
      '<div class="notify-toggles">' + tog('sms') + tog('email') + '</div><div class="rem-list">' +
      list.map((r, i) => { const off = !S.notify[r.ch]; return '<button class="rem' + (off && !r.sent ? ' off' : '') + '" data-a="open" data-v="msg:' + i + '"><span class="tile-ico">' + ic(r.ch === 'sms' ? 'message-square' : 'file-text') + '</span><span class="t"><b>' + esc(r.title) + '</b><small>' + (r.ch === 'sms' ? t('rem_sms') : t('rem_email')) + ' · ' + (r.now ? t('rem_now') : dShort(r.when)) + '</small></span>' +
        (r.sent ? '<span class="tag tag-ok">' + t('rem_sent') + '</span>' : off ? '<span class="tag">' + t('rem_off') + '</span>' : '<span class="tag tag-mjos">' + t('rem_planned') + '</span>') + '</button>'; }).join('') + '</div></div></div>';
  }
  function linkify(text) { return esc(text).replace(/(mjosbil\.no\/b\/[\w-]+)/g, '<u>$1</u>'); }

  // ---------- Shop ----------
  function shop() {
    const q = query(); if (q.get('c')) S.shopCat = q.get('c'); if (q.get('fit')) S.shopFit = true;
    const car = S.car;
    let ids = Object.keys(D.products).filter((id) => S.shopCat === 'alle' || D.products[id].cat === S.shopCat);
    const fitOn = S.shopFit && car && (S.shopCat === 'dekk' || S.shopCat === 'alle');
    if (fitOn) ids = ids.filter((id) => !D.products[id].tyre || D.products[id].tyre.inch === car.wheel);
    return header() + '<main class="page shop"><div class="wrap">' +
      '<nav class="crumbs"><a href="#/">Mjøsbil</a>/<span>' + t('shop_page_title') + '</span></nav>' +
      '<div class="sec-h" style="margin-top:12px"><div><h1 class="page-h">' + t('shop_page_title') + '</h1><p>' + t('shop_page_sub') + '</p></div></div>' +
      '<div class="shop-bar"><div class="cats">' + D.shopCats.map((c) => '<button class="chip ' + (S.shopCat === c.id ? 'on' : '') + '" data-a="shop-cat" data-v="' + c.id + '">' + L(c.name) + '</button>').join('') + '</div>' +
      (car && (S.shopCat === 'dekk' || S.shopCat === 'alle') ? '<label class="switch"><input type="checkbox" data-in="shopFit" ' + (S.shopFit ? 'checked' : '') + '><span></span>' + t('shop_fit_filter', { plate: esc(car.plate) }) + '</label>' : '') +
      '</div><p class="muted count">' + t('shop_count', { n: ids.length }) + '</p>' +
      (ids.length ? '<div class="products wide">' + ids.map(productCard).join('') + '</div>' : '<div class="card empty">' + ic('circle-dot') + '<p>' + t('shop_no_fit', { plate: esc(car.plate) }) + '</p></div>') +
      '</div></main>' + footer();
  }

  // ---------- Product page ----------
  function pdp(id) {
    const p = D.products[id]; if (!p) { go('/butikk'); return ''; }
    if (S.pdp.id !== id) Object.assign(S.pdp, { id, qty: p.tyre ? 4 : 1, delivery: p.tyre ? 'fit' : 'pickup' });
    const st = S.pdp; const car = st.car || S.car; const tyre = p.tyre;
    let fitRes = '';
    if (car && tyre) {
      fitRes = car.wheel === tyre.inch ? '<div class="fit-res ok">' + ic('circle-check') + t('pdp_fits', { car: esc(carName(car)) }) + '</div>'
        : '<div class="fit-res no">' + ic('circle-alert') + '<span style="flex:1">' + t('pdp_no_fit', { car: esc(carName(car)), inch: car.wheel }) + '</span><a class="link" href="#/butikk?c=dekk&fit=1">' + t('pdp_no_fit_cta') + '</a></div>';
    }
    const fitPrice = tyre ? D.wheelPrice(tyre.inch) : 0;
    const total = p.price * st.qty + (tyre && st.delivery === 'fit' ? fitPrice + (st.hotel ? D.hotelPrice(tyre.inch) : 0) : 0);
    const radio = (v, title, sub, extra) => '<button class="radio-row ' + (st.delivery === v ? 'on' : '') + '" data-a="pdp-del" data-v="' + v + '"><span class="radio"></span><span class="t"><b>' + title + '</b><small>' + sub + '</small></span>' + (extra ? '<span class="p">' + extra + '</span>' : '') + '</button>';
    const more = Object.keys(D.products).filter((k) => k !== id && D.products[k].cat === p.cat).slice(0, 4);
    const catName = L(D.shopCats.find((c) => c.id === p.cat).name);
    return header() + '<main class="page pdp"><div class="wrap">' +
      '<nav class="crumbs"><a href="#/">Mjøsbil</a>/<a href="#/butikk">' + t('nav_shop') + '</a>/<a href="#/butikk?c=' + p.cat + '">' + catName + '</a></nav>' +
      '<div class="pdp-img" ' + bg(p.img) + '>' + (p.was ? '<span class="tag tag-err sale">' + t('sale') + '</span>' : '') + '</div>' +
      '<div class="pdp-info"><div><span class="kicker" style="color:var(--muted)">' + esc(p.brand) + '</span><h1 style="margin-top:6px">' + esc(L(p.name)) + '</h1><div class="muted" style="margin-top:6px">' + esc(L(p.spec)) + (tyre ? ' · ' + L(tyre.type) : '') + '</div></div>' +
      '<div class="pdp-price">' + kr(p.price) + (p.was ? ' <s>' + kr(p.was) + '</s>' : '') + ' <small>' + L(p.unit) + (p.example ? ' · ' + t('example_price') : '') + '</small></div>' +
      '<div class="bullets">' + L(p.bullets).map((b) => '<div>' + ic('check') + '<span>' + esc(b) + '</span></div>').join('') + '</div>' +
      (tyre ? '<div class="card fit-box"><b>' + t('pdp_fit_check') + '</b>' + (car ? fitRes : '<form class="plate-row" data-form="pdp" novalidate>' + plateInput('pdpPlate', st.plate, 'pdp') + '<button class="btn btn-ink" type="submit">' + t('car_lookup') + '</button></form>' + plateErr('pdp') + tryPlates('pdp-try')) + '</div>' : '') +
      '<div class="qty-row"><span class="muted">' + t('pdp_qty') + '</span><div class="qty"><button data-a="qty" data-v="-1" aria-label="-">' + ic('minus') + '</button><span>' + st.qty + '</span><button data-a="qty" data-v="1" aria-label="+">' + ic('plus') + '</button></div></div>' +
      (tyre ? '<div class="sub-h">' + t('pdp_delivery') + '</div><div class="radios">' +
        radio('fit', t('pdp_fit'), t('pdp_fit_sub') + ' · ' + t('first_free') + ' ' + firstFreeLabel(D.locations[0]), '+ ' + kr(fitPrice)) +
        radio('pickup', t('pdp_pickup'), t('pdp_pickup_sub')) + radio('ship', t('pdp_ship'), t('pdp_ship_sub')) + '</div>' +
        (st.delivery === 'fit' ? '<label class="check"><input type="checkbox" data-in="pdp.hotel" ' + (st.hotel ? 'checked' : '') + '>' + t('pdp_hotel') + ' (+ ' + kr(D.hotelPrice(tyre.inch)) + ' ' + t('tyre_season') + ')</label>' : '')
        : '<div class="note">' + ic('package') + '<span>' + t('co_pickup') + ': ' + t('co_pickup_sub').toLowerCase() + ' · ' + t('co_ship') + ': ' + t('co_ship_sub') + '</span></div>') +
      '<div class="card buy"><div class="buy-tot"><span>' + t('pdp_total') + '</span><b class="num">' + kr(total) + '</b></div>' +
      (tyre && st.delivery === 'fit' ? '<button class="btn btn-ink btn-block" data-a="pdp-fit" data-v="' + id + '">' + t('pdp_buy_fit') + ic('arrow-right') + '</button>' : '<button class="btn btn-ink btn-block" data-a="pdp-cart" data-v="' + id + '">' + ic('shopping-bag') + t('pdp_buy') + '</button>') + '</div>' +
      '</div>' +
      (more.length ? '<div class="pdp-more"><div class="sec-h"><h2>' + t('pdp_more', { cat: catName.toLowerCase() }) + '</h2></div><div class="products">' + more.map(productCard).join('') + '</div></div>' : '') +
      '</div></main>' + footer();
  }

  // ---------- Checkout ----------
  function checkout(sub) {
    if (sub === 'ferdig') {
      const o = S.order; if (!o) { go('/'); return ''; }
      return header() + '<main class="page book"><div class="wrap" style="display:block"><div class="done"><div class="done-ico">' + ic('check') + '</div><h1>' + t('co_paid_title', { name: first(o.name) }) + '</h1><p class="muted">' + t('co_paid_sub') + '</p>' +
        '<div class="ref"><small>' + t('co_order') + '</small><b>' + o.ref + '</b></div><div class="card rows done-card">' +
        o.lines.map((l) => '<div class="row"><span class="thumb" ' + bg(D.products[l.id].img) + '></span><div class="t">' + l.qty + ' × ' + esc(D.products[l.id].brand + ' ' + L(D.products[l.id].name)) + '</div><b class="num">' + kr(D.products[l.id].price * l.qty) + '</b></div>').join('') +
        '<div class="row">' + ic(o.delivery === 'pickup' ? 'map-pin' : 'package') + '<div class="t">' + (o.delivery === 'pickup' ? t('co_ready', { loc: esc(locById(o.store).name) }) : t('co_shipped')) + '</div></div>' +
        '<div class="row"><div class="t"><b>' + t('receipt_total') + '</b></div><b class="num">' + kr(o.total) + '</b></div></div>' +
        '<div class="done-actions"><a class="btn btn-ink" href="#/butikk">' + t('cart_more') + '</a><a class="link" href="#/" style="justify-self:center">' + t('done_home') + '</a></div></div></div></main>' + footer();
    }
    if (!S.cart.length) { go('/butikk'); return ''; }
    const co = S.checkout; const c = S.contact; const ship = co.delivery === 'ship' ? 99 : 0;
    const f = (k, label, key, type, mode) => '<div class="field"><label for="co_' + k + '">' + label + '</label><input class="input" id="co_' + k + '" type="' + (type || 'text') + '" data-in="' + key + '" value="' + esc(key.indexOf('contact.') === 0 ? c[key.slice(8)] : co[key.slice(3)]) + '"' + (mode ? ' inputmode="' + mode + '"' : '') + '></div>';
    return header() + '<main class="page book"><div class="wrap"><div class="main">' +
      '<button class="back-btn" data-a="open" data-v="cart">' + ic('chevron-left') + t('cart_title') + '</button>' +
      '<div class="step-h"><h1>' + t('co_title') + '</h1></div><div class="stack">' +
      '<div class="sub-h" style="margin-top:0">' + t('co_delivery') + '</div><div class="radios">' +
      '<button class="radio-row ' + (co.delivery === 'pickup' ? 'on' : '') + '" data-a="co-del" data-v="pickup"><span class="radio"></span><span class="t"><b>' + t('co_pickup') + '</b><small>' + t('co_pickup_sub') + '</small></span><span class="p">' + t('co_free') + '</span></button>' +
      '<button class="radio-row ' + (co.delivery === 'ship' ? 'on' : '') + '" data-a="co-del" data-v="ship"><span class="radio"></span><span class="t"><b>' + t('co_ship') + '</b><small>' + t('co_ship_sub') + '</small></span><span class="p">99 kr</span></button></div>' +
      (co.delivery === 'pickup' ? '<div class="sub-h">' + t('co_store') + '</div><div class="loc-chips">' + D.locations.map((l) => '<button class="chip ' + (co.store === l.id ? 'on' : '') + '" data-a="co-store" data-v="' + l.id + '">' + esc(l.name.replace('Mjøsbil ', '')) + '</button>').join('') + '</div>'
        : '<div class="form">' + f('addr', t('co_address'), 'co.address') + '<div class="two">' + f('zip', t('co_zip'), 'co.zip', 'text', 'numeric') + f('city', t('co_city'), 'co.city') + '</div></div>') +
      '<div class="sub-h">' + t('co_contact') + '</div><div class="form"><button class="btn btn-vipps btn-block" data-a="vipps">' + t('vipps') + '</button><div class="divider">' + t('or_manual') + '</div>' +
      f('name', t('f_name'), 'contact.name') + f('phone', t('f_phone'), 'contact.phone', 'tel', 'tel') + f('email', t('f_email'), 'contact.email', 'email', 'email') + (S.err ? '<div class="err" role="alert">' + S.err + '</div>' : '') + '</div></div></div>' +
      '<aside class="summary always"><div class="card sum"><div class="sum-h"><h3>' + t('cart_title') + '</h3><span class="muted">' + cartCount() + '</span></div>' +
      '<div class="sum-items">' + S.cart.map((l) => { const p = D.products[l.id]; return '<div class="sum-item"><span class="thumb" ' + bg(p.img) + '></span><span class="n">' + l.qty + ' × ' + esc(p.brand + ' ' + L(p.name)) + '</span><span class="p">' + kr(p.price * l.qty) + '</span></div>'; }).join('') + '</div>' +
      '<div class="sum-meta"><div class="between">' + t('co_shipping') + '<span>' + (ship ? kr(ship) : t('co_free')) + '</span></div></div>' +
      '<div class="sum-tot"><span>' + t('receipt_total') + '<small>' + t('sum_vat') + '</small></span><b>' + kr(cartSum() + ship) + '</b></div>' +
      '<button class="btn btn-vipps btn-block" data-a="co-pay">' + t('co_pay') + '</button></div></aside></div></main>';
  }

  // ---------- Location page ----------
  function locationPage(id) {
    const l = locById(id); if (!l) { go('/'); return ''; }
    const ff = firstFree(l);
    const groups = CATS.map((c) => ({ c, list: Object.keys(D.services).filter((k) => D.services[k].cat === c.id && l.no.indexOf(k) < 0) })).filter((g) => g.list.length);
    return header() + '<main class="page"><section class="loc-hero on-dark"><div class="wrap">' +
      '<div class="loc-tabs">' + D.locations.map((x) => '<a class="chip ' + (x.id === id ? 'on' : '') + '" href="#/avdeling/' + x.id + '">' + esc(x.area === 'Hunndalen' ? 'Gjøvik' : x.area) + '</a>').join('') + '</div>' +
      '<div class="loc-head"><div><span class="kicker">BilXtra verksted · Fagdekk · ' + t('loc_shop') + '</span><h1>' + esc(l.name) + '</h1><p class="sub">' + esc(l.addr) + '</p>' +
      '<div class="loc-cta"><button class="btn btn-mjos" data-a="loc-book" data-v="' + id + '">' + t('loc_book') + ic('arrow-right') + '</button><a class="btn btn-white" target="_blank" rel="noopener" href="' + mapsUrl(l) + '">' + ic('map-pin') + t('loc_directions') + '</a></div></div>' +
      (ff ? '<div class="float-card static"><span class="tile">' + ic('calendar-check') + '</span><span><small>' + t('first_free') + '</small><b>' + dayLabel(ff.d) + ' ' + ff.time + '</b></span></div>' : '') + '</div></div></section>' +
      '<div class="wrap loc-body"><div class="col">' + (id === 'gjovik' ? '<div class="loc-photo" ' + bg(IMG.facade) + '></div>' : '') +
      '<div class="panel"><div class="panel-h"><h2>' + t('loc_services') + '</h2></div><div class="panel-b svc-groups">' + groups.map((g) => '<div><div class="grp-h">' + ic(g.c.icon) + t('i_' + g.c.id) + '</div><div class="svc-list">' + g.list.map((k) => '<button class="svc-pill" data-a="loc-svc" data-v="' + id + '|' + g.c.id + '"><span>' + esc(L(D.services[k].name)) + '</span><b>' + priceTxt(D.services[k].bySize ? Object.assign({}, D.services[k], { price: D.wheelPrice(16), from: true }) : D.services[k]) + '</b></button>').join('') + '</div></div>').join('') + '</div></div></div>' +
      '<div class="col"><div class="panel"><div class="panel-h"><h2>' + t('loc_contact') + '</h2></div><div class="panel-b">' +
      '<div class="kv">' + ic('clock') + '<span><small>' + t('loc_ws') + '</small>' + L(D.hours.workshop) + '</span></div><div class="kv">' + ic('shopping-bag') + '<span><small>' + t('loc_shop') + '</small>' + L(D.hours.shop) + '</span></div>' +
      '<div class="kv">' + ic('phone') + '<span><small>' + t('f_phone') + '</small><a href="tel:+4761138888">' + D.phone + '</a></span></div><div class="kv">' + ic('message-square') + '<span><small>' + t('f_email') + '</small><a href="mailto:post@mjosbil.no">post@mjosbil.no</a></span></div></div></div>' +
      '<div class="panel"><div class="panel-h"><h2>' + t('loc_other') + '</h2></div><div class="panel-b">' + D.locations.filter((x) => x.id !== id).map((x) => '<a class="loc-mini" href="#/avdeling/' + x.id + '"><span><b>' + esc(x.name) + '</b><small>' + x.km[id] + ' km · ' + t('first_free').toLowerCase() + ' ' + firstFreeLabel(x) + '</small></span>' + ic('chevron-right') + '</a>').join('') + '</div></div></div></div></main>' + footer();
  }

  // ---------- Booking ----------
  const STEPS = ['bil', 'behov', 'tid', 'deg', 'bekreft'];
  const STEP_LBL = { bil: 'step_car', behov: 'step_need', tid: 'step_time', deg: 'step_you', bekreft: 'step_confirm' };
  const stepper = (cur) => { const ci = STEPS.indexOf(cur); return '<div class="stepper">' + STEPS.map((s, i) => '<div class="s ' + (i < ci ? 'past' : i === ci ? 'on' : '') + '"><div class="bar"></div><span class="t">' + t(STEP_LBL[s]) + '</span></div>').join('') + '</div>'; };

  function carCard(withChange) {
    const c = S.car;
    return '<div class="card car-card"><span class="car-thumb' + (c.fuel === 'ev' ? ' ev' : '') + '">' + carArt(c.fuel) + '</span><div class="t"><b>' + esc(carName(c)) + '</b><small>' + c.year + ' · ' + t('car_' + c.fuel) + ' · ' + c.wheel + '" ' + (S.lang === 'no' ? 'hjul' : 'wheels') + ' · ' + t('car_last_service') + ' ' + L(c.lastService) + '</small></div>' +
      '<div class="r">' + plateChip(c.plate) + (withChange ? '<button class="link" data-a="car-reset">' + t('car_not_you') + '</button>' : '') + '</div></div>';
  }

  function stepCar() {
    if (S.looking) return '<div class="step-h"><h1>' + t('car_title') + '</h1><p>' + t('car_sub') + '</p></div><div class="card car-card skeleton"><span class="car-thumb"></span><div class="t"><i></i><i></i></div></div>';
    if (S.car) {
      const c = S.car;
      return '<div class="step-h"><h1>' + t('car_found') + '</h1><p>' + t('car_sub') + '</p></div><div class="stack">' + carCard(true) +
        '<div class="car-facts"><div class="fact"><small>' + t('car_eu') + '</small><b>' + dShort(c.euDue) + '</b>' + (euSoon(c) ? '<div><span class="tag tag-warn" style="margin-top:6px">' + ic('clock') + t('car_eu_soon') + '</span></div>' : '') + '</div>' +
        '<div class="fact"><small>' + t('car_last_service') + '</small><b>' + L(c.lastService) + '</b></div><div class="fact"><small>' + t('car_wheels') + '</small><b>' + c.wheel + '"</b></div></div></div>';
    }
    return '<div class="step-h"><h1>' + t('car_title') + '</h1><p>' + t('car_sub') + '</p></div>' +
      '<form class="plate-row" data-form="car" novalidate>' + plateInput('plate', S.plate, 'car') + '<button class="btn btn-ink" type="submit">' + t('car_lookup') + '</button></form>' + plateErr('car') + tryPlates('car-try');
  }

  function optCard(id, recommended, single) {
    const s = svc({ id }); const on = has(id); const incl = L(s.incl);
    return '<button class="opt ' + (on ? 'on' : '') + '" data-a="toggle" data-v="' + id + '" data-single="' + (single ? s.cat : '') + '" aria-pressed="' + on + '">' +
      '<div class="opt-top"><span class="box">' + ic('check') + '</span><span class="opt-title">' + esc(L(s.name)) + '</span><span class="opt-price">' + priceTxt(s) + (s.example ? '<small>' + t('example_price') + '</small>' : '') + (s.hotel ? '<small>' + t('tyre_season') + '</small>' : '') + '</span></div>' +
      '<div class="opt-desc">' + esc(L(s.desc)) + '</div>' +
      '<div class="opt-meta">' + (recommended ? '<span class="tag tag-mjos">' + ic('sparkles') + t('recommended') + '</span>' : '') + '<span class="tag">' + ic('timer') + dur(s.mins) + '</span>' +
      (s.mode === 'live' ? '<span class="tag tag-ok">' + ic('zap') + t('live') + '</span>' : '<span class="tag tag-warn">' + ic('clock') + t('request') + '</span>') + '</div>' +
      (incl && on ? '<div class="opt-incl">' + incl.map((x) => '<div>' + ic('check') + '<span>' + esc(x) + '</span></div>').join('') + '</div>' : '') +
      '</button>';
  }

  function addonList(mainIds) {
    const ids = [];
    mainIds.forEach((m) => (D.addons[m] || []).forEach((a) => { if (ids.indexOf(a) < 0 && mainIds.indexOf(a) < 0 && fitsCar(D.services[a])) ids.push(a); }));
    if (!ids.length) return '';
    return '<div class="sub-h">' + t('addons_title') + '</div><div class="addons">' + ids.slice(0, 3).map((id) => {
      const s = svc({ id }); const on = has(id);
      return '<button class="addon ' + (on ? 'on' : '') + '" data-a="toggle" data-v="' + id + '">' + (on ? '<span class="box">' + ic('check') + '</span>' : '<span class="tile-ico">' + ic(SVC_ICON[id] || 'plus') + '</span>') +
        '<span class="t"><b>' + esc(L(s.name)) + '</b><small>' + esc(L(s.desc)) + '</small></span><span class="p">' + (on ? t('added') : '+ ' + priceTxt(s)) + '</span></button>';
    }).join('') + '</div>';
  }

  function catBody(cat) {
    const c = S.car;
    const pick = (ids, rec, single) => ids.filter((id) => fitsCar(D.services[id])).map((id) => optCard(id, id === rec, single)).join('');
    const sel = (ids) => ids.filter(has);
    if (cat === 'service') {
      const ids = c.fuel === 'ev' ? ['ev_eco', 'ev_eco_brk', 'maker'] : ['eco20', 'maker', 'oil'];
      const rec = c.fuel === 'ev' ? 'ev_eco_brk' : (c.year < 2020 ? 'eco20' : 'maker');
      return '<div class="opts">' + pick(ids, rec, true) + '</div>' + addonList(sel(ids));
    }
    if (cat === 'eu') {
      const ids = ['pkk', 'pkk_heavy', 'recheck'];
      const due = fmt(c.euDue, { day: 'numeric', month: 'long', year: 'numeric' });
      return '<div class="note ' + (euSoon(c) ? 'warn' : '') + '">' + ic(euSoon(c) ? 'clock' : 'info') + '<span>' + t('eu_due_text', { date: due }) + (euSoon(c) ? ' ' + t('eu_due_soon_text', { weeks: weeksTo(c.euDue) }) : '') + '</span></div>' +
        '<div class="opts">' + pick(ids, c.weight > 3500 ? 'pkk_heavy' : 'pkk', true) + '</div>' + addonList(sel(ids));
    }
    if (cat === 'tyre') {
      const ids = ['hotel', 'swap'];
      return '<div class="note">' + ic('info') + '<span>' + t('tyre_size', { inch: c.wheel }) + '. ' + t('tyre_hotel_note') + '</span></div>' +
        '<div class="opts">' + pick(ids, 'hotel', true) + '</div>' + addonList(sel(ids)) +
        '<a class="card upsell" href="#/butikk?c=dekk&fit=1"><span class="tile-ico">' + ic('circle-dot') + '</span><b>' + t('tyre_new') + '</b><span class="link">' + t('tyre_new_cta') + ic('arrow-right') + '</span></a>';
    }
    if (cat === 'issue') {
      const syms = D.symptoms.filter((s) => !s.fuel || s.fuel.indexOf(c.fuel) >= 0);
      const sugg = S.symptoms.map((id) => (D.symptoms.find((x) => x.id === id) || {}).suggest).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      return '<div class="sub-h" style="margin-top:0">' + t('issue_title') + '</div><p class="muted" style="margin-top:-8px">' + t('issue_sub') + '</p>' +
        '<div class="symptoms">' + syms.map((s) => '<button class="sym ' + (S.symptoms.indexOf(s.id) >= 0 ? 'on' : '') + '" data-a="sym" data-v="' + s.id + '" aria-pressed="' + (S.symptoms.indexOf(s.id) >= 0) + '">' + ic(SYM_ICON[s.icon] || 'ellipsis') + esc(L(s.name)) + '</button>').join('') + '</div>' +
        (S.symptoms.length ? '<div class="field"><label for="issue">' + t('issue_desc') + '</label><textarea id="issue" data-in="issueText" placeholder="' + esc(t('issue_desc_ph')) + '">' + esc(S.issueText) + '</textarea></div>' +
          '<label class="attach">' + ic('camera') + '<span>' + t('issue_attach') + (S.attached ? ' · <b>' + S.attached + ' ' + t('issue_attached') + '</b>' : '') + '</span><input type="file" accept="image/*,video/*,audio/*" multiple data-file="1" class="sr"></label>' +
          '<div class="opts">' + optCard('diag', true, false) + '</div><div class="note">' + ic('phone') + '<span>' + t('issue_promise') + '</span></div>' +
          (sugg.length ? '<div class="sub-h">' + t('issue_suggest') + '</div><div class="opts">' + sugg.map((id) => optCard(id, false, false)).join('') + '</div>' : '') : '');
    }
    return '<div class="opts">' + pick(['ac', 'align', 'flush', 'rv'], c.weight > 3500 ? 'rv' : null, false) + '</div>';
  }

  function stepNeed() {
    const counts = {};
    S.items.forEach((i) => { const c = svc(i).cat; if (c && c !== 'addon' && c !== 'shop') counts[c] = (counts[c] || 0) + 1; });
    const nudge = euSoon(S.car) && S.cat !== 'eu' && !counts.eu ? '<button class="note warn as-btn" data-a="cat" data-v="eu">' + ic('clock') + '<span>' + t('eu_due_text', { date: fmt(S.car.euDue, { day: 'numeric', month: 'long' }) }) + ' <b>' + t('eu_due_soon_text', { weeks: weeksTo(S.car.euDue) }) + '</b></span>' + ic('chevron-right') + '</button>' : '';
    return '<div class="step-h"><h1>' + t('need_title') + '</h1><p>' + t('need_sub') + '</p></div><div class="stack">' + carCard(true) + nudge +
      '<div class="cats" role="tablist">' + CATS.map((c) => '<button class="chip ' + (S.cat === c.id ? 'on' : '') + '" data-a="cat" data-v="' + c.id + '" role="tab" aria-selected="' + (S.cat === c.id) + '">' + ic(c.icon) + t('i_' + c.id) + (counts[c.id] ? '<span class="n">' + counts[c.id] + '</span>' : '') + '</button>').join('') + '</div>' +
      '<div class="cat-body">' + catBody(S.cat) + '</div></div>';
  }

  const unavailableAt = (loc) => S.items.map((i) => i.id).filter((id) => loc.no.indexOf(id) >= 0);

  function stepTime() {
    const locs = D.locations.slice().sort((a, b) => a.km[S.city] - b.km[S.city]);
    if (!S.loc || unavailableAt(locById(S.loc)).length) { const f = locs.find((l) => !unavailableAt(l).length); S.loc = f ? f.id : null; S.slot = null; }
    const loc = locById(S.loc);
    if (loc && !slotsFor(loc, S.day).some(Boolean)) { const ff = firstFree(loc); if (ff) { S.day = ff.d; S.slot = null; } }
    const tot = totals();
    const canWait = tot.mins <= 90;
    if (!canWait && S.handover === 'wait') S.handover = 'drop';
    const slots = loc ? slotsFor(loc, S.day) : [];
    return '<div class="step-h"><h1>' + (S.editing ? t('edit_title') : t('time_title')) + '</h1><p>' + (S.editing ? t('edit_sub') : t('time_sub')) + '</p></div><div class="stack">' +
      '<div><div class="lbl muted" style="font-size:12px;font-weight:600;margin-bottom:8px">' + t('near_pick') + '</div><div class="loc-chips">' +
      D.locations.map((l) => '<button class="chip ' + (S.city === l.id ? 'on' : '') + '" data-a="city" data-v="' + l.id + '">' + (l.id === 'gjovik' ? 'Gjøvik' : esc(l.area)) + '</button>').join('') + '</div></div>' +
      '<div class="loc-list">' + locs.map((l) => {
        const no = unavailableAt(l); const ff = firstFree(l);
        return '<button class="loc ' + (S.loc === l.id ? 'on' : '') + '" data-a="loc" data-v="' + l.id + '" ' + (no.length ? 'disabled' : '') + '><span class="radio"></span><span class="t"><b>' + esc(l.name) + '</b><small>' +
          (no.length ? t('cant_do', { service: esc(L(svc({ id: no[0] }).name).toLowerCase()) }) : esc(l.area) + ' · ' + l.km[S.city] + ' ' + t('km')) + '</small></span>' +
          (no.length || !ff ? '' : '<span class="first">' + t('first_free') + '<b>' + dayLabel(ff.d) + ' ' + ff.time + '</b></span>') + '</button>';
      }).join('') + '</div>' +
      (loc ? '<div class="sub-h">' + t('pick_day') + '</div><div class="days">' + DAYS.map((d, i) => {
        const free = slotsFor(loc, i).filter(Boolean).length;
        return '<button class="day ' + (S.day === i ? 'on' : '') + (free ? '' : ' full') + '" data-a="day" data-v="' + i + '" ' + (free ? '' : 'disabled') + '><small>' + fmt(d, { weekday: 'short' }) + '</small><b>' + d.getDate() + '</b><i>' + (free ? free + ' ' + (S.lang === 'no' ? 'ledige' : 'free') : (S.lang === 'no' ? 'fullt' : 'full')) + '</i></button>';
      }).join('') + '</div>' +
        '<div class="sub-h">' + t('pick_time') + ' <span class="muted" style="font-weight:500;font-size:14px">· ' + fmt(DAYS[S.day], { weekday: 'long', day: 'numeric', month: 'long' }) + '</span></div>' + '<div class="slots">' + SLOT_TIMES.map((tm, i) => '<button class="slot ' + (S.slot === tm ? 'on' : '') + '" data-a="slot" data-v="' + tm + '" ' + (slots[i] ? '' : 'disabled') + '>' + tm + '</button>').join('') + '</div>' +
        (tot.request ? '<div class="note warn">' + ic('info') + '<span>' + t('req_note') + '</span></div>' : '') +
        (has('hotel') && hotelOf(S.car.key) ? '<div class="note ok">' + ic('package') + '<span>' + t('express_note', { shelf: esc(hotelOf(S.car.key).shelf) }) + '</span></div>' : '') +
        (S.editing ? '' : '<div class="sub-h">' + t('handover') + '</div><div class="radios">' +
        '<button class="radio-row ' + (S.handover === 'drop' ? 'on' : '') + '" data-a="handover" data-v="drop"><span class="radio"></span><span class="t"><b>' + t('h_drop') + '</b><small>' + t('h_drop_sub') + '</small></span></button>' +
        '<button class="radio-row ' + (S.handover === 'wait' ? 'on' : '') + '" data-a="handover" data-v="wait" ' + (canWait ? '' : 'disabled') + '><span class="radio"></span><span class="t"><b>' + t('h_wait') + '</b><small>' + (canWait ? t('h_wait_sub') : t('h_wait_long')) + '</small></span></button>' +
        '</div>') : '') + '</div>';
  }

  function stepYou() {
    const c = S.contact;
    const f = (k, type, mode, ac) => '<div class="field"><label for="f_' + k + '">' + t('f_' + k) + '</label><input class="input" id="f_' + k + '" type="' + type + '" data-in="contact.' + k + '" value="' + esc(c[k]) + '"' + (mode ? ' inputmode="' + mode + '"' : '') + (ac ? ' autocomplete="' + ac + '"' : '') + '></div>';
    return '<div class="step-h"><h1>' + t('you_title') + '</h1><p>' + t('you_sub') + '</p></div><div class="form">' +
      '<button class="btn btn-vipps btn-block" data-a="vipps">' + t('vipps') + '</button><div class="divider">' + t('or_manual') + '</div>' +
      f('name', 'text', '', 'name') + '<div class="two">' + f('phone', 'tel', 'tel', 'tel') + f('email', 'email', 'email', 'email') + '</div>' + f('km', 'text', 'numeric') +
      '<div class="field"><label for="f_comment">' + t('f_comment') + '</label><textarea id="f_comment" data-in="contact.comment">' + esc(c.comment) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" data-in="contact.sms" ' + (c.sms ? 'checked' : '') + '>' + t('f_sms') + '</label>' +
      (S.err ? '<div class="err" role="alert">' + S.err + '</div>' : '') + '</div>';
  }

  function stepConfirm() {
    const loc = locById(S.loc);
    const row = (icon, label, val, step) => '<div class="row">' + ic(icon) + '<div class="t"><small>' + label + '</small>' + val + '</div>' + (step ? '<button class="link" data-a="nav" data-v="/bestill/' + step + '">' + t('edit') + '</button>' : '') + '</div>';
    return '<div class="step-h"><h1>' + t('confirm_title') + '</h1><p>' + t('confirm_sub') + '</p></div><div class="card rows">' +
      row('car', t('step_car'), esc(carName(S.car)) + ' · ' + plateChip(S.car.plate), 'bil') +
      row('wrench', t('step_need'), S.items.map((i) => esc(L(svc(i).name))).join('<br>'), 'behov') +
      row('map-pin', t('step_time'), esc(loc.name) + '<br><b>' + whenText() + '</b><br><span class="muted">' + (S.handover === 'wait' ? t('h_wait') : t('h_drop')) + '</span>', 'tid') +
      row('user', t('step_you'), esc(S.contact.name) + '<br>' + esc(S.contact.phone) + ' · ' + esc(S.contact.email), 'deg') + '</div>';
  }

  function summary(btn, step) {
    const tot = totals(); const loc = S.loc && locById(S.loc);
    return '<div class="card sum"><div class="sum-h"><h3>' + t('sum_title') + '</h3>' + (S.car ? plateChip(S.car.plate) : '') + '</div>' +
      '<div class="sum-items">' + (S.items.length ? S.items.map((i, idx) => { const s = svc(i); return '<div class="sum-item"><span class="n">' + esc(L(s.name)) + '</span><span class="p">' + (s.quote ? '–' : priceTxt(s)) + '</span>' + (S.editing ? '' : '<button class="x" data-a="remove" data-v="' + idx + '" aria-label="' + t('remove') + '">' + ic('x') + '</button>') + '</div>'; }).join('') : '<span class="muted" style="font-size:14px">' + t('sum_empty') + '</span>') + '</div>' +
      (S.items.length ? '<div class="sum-meta">' + (loc && STEPS.indexOf(step) >= 2 ? '<div>' + ic('map-pin') + esc(loc.name) + '</div>' : '') + (S.slot ? '<div>' + ic('calendar') + whenText() + '</div>' : '') + '<div>' + ic('timer') + t('sum_time') + ' ' + dur(tot.mins) + '</div></div>' +
        '<div class="sum-tot"><span>' + t('sum_total') + '<small>' + t('sum_vat') + '</small></span><b>' + totalTxt(tot) + '</b></div>' : '') + btn + '</div>' +
      '<div class="note sum-note">' + ic('shield-check') + '<span>' + t('confirm_sub') + '</span></div>';
  }

  function primaryFor(step) {
    const tot = totals();
    if (step === 'bil') return S.car && !S.looking ? { label: t('continue'), ok: true, a: 'to-need' } : null;
    if (step === 'behov') return { label: t('next'), ok: S.items.length > 0, a: 'to-time' };
    if (step === 'tid') return S.editing ? { label: t('save_new_time'), ok: !!(S.loc && S.slot), a: 'save-time' } : { label: t('next'), ok: !!(S.loc && S.slot), a: 'to-you' };
    if (step === 'deg') return { label: t('next'), ok: true, a: 'to-confirm' };
    if (step === 'bekreft') return { label: tot.request ? t('request_cta') : t('book_cta'), ok: true, a: 'submit' };
    return null;
  }
  const validContact = () => { const c = S.contact; return c.name.trim() && c.phone.trim() && /\S+@\S+\.\S+/.test(c.email); };

  function booking(sub) {
    if (sub === 'ferdig') return bookHeader() + doneView();
    if (!S.car && sub !== 'bil') { go('/bestill/bil'); return ''; }
    if ((sub === 'tid' || sub === 'deg' || sub === 'bekreft') && !S.items.length) { go('/bestill/behov'); return ''; }
    if ((sub === 'deg' || sub === 'bekreft') && !S.slot) { go('/bestill/tid'); return ''; }
    if (sub === 'bekreft' && !validContact()) { go('/bestill/deg'); return ''; }
    if (S.editing && sub !== 'tid') S.editing = false;
    const body = { bil: stepCar, behov: stepNeed, tid: stepTime, deg: stepYou, bekreft: stepConfirm }[sub]();
    const p = primaryFor(sub);
    const btn = p ? '<button class="btn btn-ink btn-block" data-a="' + p.a + '" ' + (p.ok ? '' : 'disabled') + '>' + p.label + ic('arrow-right') + '</button>' : '';
    const side = sub !== 'bil';
    const tot = totals();
    const mbar = p ? '<div class="mbar' + (side ? ' side' : '') + '"><div class="tot">' + (S.items.length ? '<small>' + (S.slot && sub !== 'behov' ? whenText() : S.items.length + ' · ' + dur(tot.mins)) + '</small><b>' + totalTxt(tot) + '</b>' : S.car ? '<small>' + esc(S.car.plate) + '</small><b style="font-size:15px">' + esc(carName(S.car)) + '</b>' : '') + '</div><button class="btn btn-ink" data-a="' + p.a + '" ' + (p.ok ? '' : 'disabled') + '>' + p.label + '</button></div>' : '';
    const backTo = S.editing ? '/min-bil' : { behov: '/bestill/bil', tid: '/bestill/behov', deg: '/bestill/tid', bekreft: '/bestill/deg' }[sub];
    return bookHeader() + '<main class="page book"><div class="wrap"><div class="main">' + (S.editing ? '' : stepper(sub)) +
      (backTo ? '<button class="back-btn" data-a="' + (S.editing ? 'edit-cancel' : 'nav') + '" data-v="' + backTo + '">' + ic('chevron-left') + (S.editing ? t('nav_mine') : t('back')) + '</button>' : '') + body + '</div>' +
      (side ? '<aside class="summary">' + summary(btn, sub) + '</aside>' : '') + '</div></main>' + mbar;
  }

  function bringList(b) {
    const out = [t('bring_key')];
    if (b.items.some((i) => i.id === 'swap' || i.id === 'hotel')) out.unshift(t('bring_wheels'));
    if (b.car.fuel === 'ev' && b.symptoms.indexOf('charge') >= 0) out.push(t('bring_charge'));
    return out;
  }

  function doneView() {
    const b = S.booking; if (!b) { go('/'); return ''; }
    const loc = locById(b.loc);
    return '<main class="page book"><div class="wrap" style="display:block"><div class="done">' +
      '<div class="done-ico">' + ic('check') + '</div><h1>' + (b.request ? t('done_title_req', { name: first(b.contact.name) }) : t('done_title', { name: first(b.contact.name) })) + '</h1><p class="muted">' + (b.request ? t('done_sub_req') : t('done_sub')) + '</p>' +
      '<div class="ref"><small>' + t('done_ref') + '</small><b>' + b.ref + '</b></div>' +
      '<div class="card rows done-card">' +
      '<div class="row">' + ic('calendar') + '<div class="t"><small>' + (S.lang === 'no' ? 'Tid' : 'Time') + '</small><b>' + whenText(b) + '</b></div></div>' +
      '<div class="row">' + ic('map-pin') + '<div class="t"><small>' + (S.lang === 'no' ? 'Sted' : 'Place') + '</small>' + esc(loc.name) + '<br><span class="muted">' + esc(loc.addr) + '</span></div><a class="link" target="_blank" rel="noopener" href="' + mapsUrl(loc) + '">' + t('loc_directions') + '</a></div>' +
      '<div class="row">' + ic('wrench') + '<div class="t"><small>' + t('step_need') + '</small>' + b.items.map((i) => esc(L(svc(i).name))).join('<br>') + '<br><b>' + t('sum_total') + ': ' + totalTxt(b.tot) + '</b></div></div>' +
      '<div class="row">' + ic('package') + '<div class="t"><small>' + t('done_bring') + '</small>' + bringList(b).map(esc).join('<br>') + '</div></div></div>' +
      '<div class="done-actions"><button class="btn btn-ink" data-a="ics">' + ic('calendar') + t('done_cal') + '</button>' +
      '<button class="btn btn-ghost" data-a="done-mine">' + ic('car') + t('done_mine') + '</button><button class="link" data-a="restart" style="justify-self:center;margin-top:4px">' + t('done_home') + '</button></div>' +
      '<p class="muted" style="font-size:14px">' + t('done_change') + '</p></div></div></main>';
  }

  // ---------- Min bil ----------
  function mine() {
    if (!S.user) {
      return header() + '<main class="page"><div class="wrap"><div class="card login">' + carArt('ev', 'login-car') + '<h1>' + t('login_title') + '</h1><p class="muted">' + t('login_sub') + '</p>' +
        '<button class="btn btn-vipps" data-a="login">' + t('login_vipps') + '</button><button class="btn bankid" data-a="login">' + t('login_bankid') + '</button><small class="muted">' + t('login_note') + '</small></div></div></main>' + footer();
    }
    const key = S.mineCar; const car = getCar(key); const g = garageOf(key);
    const euW = weeksTo(car.euDue);
    const b = S.booking && S.booking.car.key === key ? S.booking : null;
    const stat = (icon, label, value, sub, tag, meter) => '<div class="stat"><div class="top"><span class="tile-ico">' + ic(icon) + '</span>' + (tag || '') + '</div><div><small>' + label + '</small><b>' + value + '</b><div class="sub">' + sub + '</div></div>' + (meter || '') + '</div>';
    const euPct = Math.max(4, Math.min(100, 100 - (euW / 104) * 100));

    const upcoming = '<div class="panel"><div class="panel-h"><h2>' + t('up_title') + '</h2>' + (b ? '<span class="tag ' + (b.request ? 'tag-warn' : 'tag-ok') + '">' + ic(b.request ? 'clock' : 'circle-check') + (b.request ? t('request') : t('live')) + '</span>' : '') + '</div><div class="panel-b">' +
      (b ? '<div class="upcoming"><div class="date-tile"><small>' + fmt(DAYS[b.day], { month: 'short' }) + '</small><b>' + DAYS[b.day].getDate() + '</b></div><div style="flex:1;min-width:0"><b>' + whenText(b) + '</b><div class="muted" style="font-size:14px">' + esc(locById(b.loc).name) + ' · ' + b.items.map((i) => esc(L(svc(i).name))).join(', ') + '</div><div class="lbl muted" style="font-size:12px;font-weight:700;margin-top:4px">' + b.ref + ' · ' + totalTxt(b.tot) + '</div></div></div>' +
        '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-a="edit-booking">' + ic('calendar') + t('up_change') + '</button><button class="btn btn-ghost btn-sm" data-a="ics">' + ic('calendar-check') + t('done_cal') + '</button><button class="btn btn-ghost btn-sm danger" data-a="open" data-v="cancel">' + ic('x') + t('cancel_booking') + '</button></div>'
        : '<div class="upcoming"><span class="tile-ico">' + ic('calendar') + '</span><div style="flex:1"><b>' + t('up_none') + '</b><div class="muted" style="font-size:14px">' + t('up_none_sub') + '</div></div><button class="btn btn-ink btn-sm" data-a="mine-book" data-v="service">' + t('nav_book') + '</button></div>') + '</div></div>';

    const recos = '<div class="panel"><div class="panel-h"><h2>' + t('reco_title') + '</h2></div><div class="panel-b">' + (g.recos.length ? g.recos.map((r) =>
      '<div class="reco"><span class="dot" style="background:' + (r.level === 'warn' ? 'var(--warn)' : 'var(--ok)') + '"></span><div class="t"><b>' + esc(L(r.title)) + '</b><small>' + esc(L(r.text)) + '</small></div>' + (r.add ? '<button class="btn btn-ghost btn-sm" data-a="mine-add" data-v="' + r.add + '">' + ic('plus') + t('reco_book') + '</button>' : '') + '</div>').join('') : '<p class="muted">' + t('new_car_reco') + '</p>') + '</div></div>';

    let hotel;
    if (g.hotel) {
      const h = g.hotel; const pos = ['fl', 'fr', 'rl', 'rr'];
      hotel = '<div class="panel tyre-panel"><div class="tyre-photo" ' + bg(IMG.hotel) + '></div><div><div class="panel-h"><h2>' + t('hotel_title') + '</h2><span class="tag tag-mjos">' + ic('package') + esc(h.shelf) + '</span></div><div class="panel-b">' +
        '<div><b>' + esc(L(h.stored)) + '</b> · <span class="muted">' + esc(h.brand) + '</span><div class="muted" style="font-size:14px">' + t('hotel_stored', { loc: esc(locById(h.loc).name), shelf: esc(h.shelf) }) + '<br>' + t('hotel_on', { what: esc(L(h.on).toLowerCase()) }) + '</div></div>' +
        '<div><div class="lbl muted" style="font-size:12px;font-weight:700;margin-bottom:6px">' + t('hotel_tread') + '</div><div class="tread">' + h.tread.map((v, i) => '<div><small>' + t('tread_' + pos[i]) + '</small><b class="' + (v < 5.5 ? 'w' : '') + '">' + v.toLocaleString('nb-NO') + '</b></div>').join('') + '</div></div>' +
        '<div class="note warn">' + ic('snowflake') + '<span><b>' + t('hotel_swap') + '.</b> ' + t('season_text') + '</span></div>' +
        '<div class="btn-row"><button class="btn btn-ink" data-a="express" data-v="' + key + '">' + ic('zap') + t('express') + '</button><button class="btn btn-ghost" data-a="mine-book" data-v="tyre">' + t('hotel_swap_cta') + '</button></div></div></div></div>';
    } else {
      hotel = '<div class="panel"><div class="panel-h"><h2>' + t('hotel_title') + '</h2></div><div class="panel-b"><div class="upcoming"><span class="tile-ico">' + ic('package') + '</span><div style="flex:1"><b>' + t('hotel_none') + '</b></div><button class="btn btn-ghost btn-sm" data-a="mine-book" data-v="tyre">' + t('hotel_none_cta') + '</button></div></div></div>';
    }

    const history = '<div class="panel"><div class="panel-h"><h2>' + t('hist_title') + '</h2></div><div class="panel-b">' + (g.history.length ? '<div class="timeline">' + g.history.map((h, i) =>
      '<div class="tl"><i></i><div class="t"><small>' + dShort(h.date) + ' · ' + esc(locById(h.loc).name) + ' · ' + h.km.toLocaleString('nb-NO') + ' km</small><b>' + L(h.items).map(esc).join(', ') + '</b><div class="line"><span class="num" style="font-size:14px">' + kr(h.price) + '</span><button class="link" data-a="open" data-v="receipt:' + i + '">' + ic('receipt-text') + t('hist_receipt') + '</button>' + (h.doc ? '<button class="link" data-a="open" data-v="cert:' + i + '">' + ic('file-text') + t('hist_doc') + '</button>' : '') + '</div></div></div>').join('') + '</div>' : '<p class="muted">' + t('new_car_hist') + '</p>') + '</div></div>';

    const quick = '<div class="quick">' + [['service', 'wrench', 'q_service'], ['issue', 'triangle-alert', 'q_issue'], ['tyre', 'circle-dot', 'q_tyre'], ['chat', 'message-square', 'q_chat']].map((q) => '<button data-a="' + (q[0] === 'chat' ? 'open' : 'mine-book') + '" data-v="' + q[0] + '"><span class="tile-ico">' + ic(q[1]) + '</span>' + t(q[2]) + '</button>').join('') + '</div>';

    return header() + '<main class="page mine"><section class="mine-hero on-dark"><div class="wrap">' +
      '<div class="mine-top"><span class="hello">' + ic('user') + t('hi', { name: first(S.user.name) }) + '</span><button class="link" data-a="logout" style="color:var(--isbre)">' + ic('log-out') + t('logout') + '</button></div>' +
      '<div class="car-switch">' + S.garageCars.map((k) => { const c = getCar(k); return '<button class="chip ' + (k === key ? 'on' : '') + '" data-a="mine-car" data-v="' + k + '">' + esc(c.plate) + ' · ' + esc(c.make) + '</button>'; }).join('') + '<button class="chip" data-a="open" data-v="addcar">' + ic('plus') + t('add_car') + '</button></div>' +
      '<div class="mine-car"><div><span class="kicker">' + t('nav_mine') + '</span><h1>' + esc(carName(car)) + '</h1><div class="meta">' + car.year + ' · ' + t('car_' + car.fuel) + ' · ' + car.wheel + '"' + (g.km ? ' · ' + g.km.toLocaleString('nb-NO') + ' km' : '') + '</div><div style="margin-top:14px">' + plateChip(car.plate, true) + '</div></div>' + carArt(car.fuel, 'hero-car') + '</div>' +
      '</div></section><div class="wrap" style="margin-top:20px"><div class="stat-grid">' +
      stat('clipboard-check', t('s_eu'), dShort(car.euDue), t('s_eu_left', { weeks: euW }), euW <= 12 ? '<span class="tag tag-warn">' + t('car_eu_soon') + '</span>' : '<span class="tag tag-ok">OK</span>', '<div class="meter' + (euW <= 12 ? ' warn' : '') + '"><i style="width:' + euPct + '%"></i></div>') +
      stat('wrench', t('s_service'), L(g.nextService.label), t('car_last_service') + ' ' + L(car.lastService), g.nextService.warn ? '<span class="tag tag-warn">!</span>' : '', '<div class="meter' + (g.nextService.warn ? ' warn' : '') + '"><i style="width:' + g.nextService.pct + '%"></i></div>') +
      stat('life-buoy', t('s_falck'), g.falck ? 'Falck 24/7' : '–', g.falck ? t('s_falck_until', { date: dShort(g.falck) }) : t('new_car_hist'), g.falck ? '<span class="tag tag-ok">' + ic('circle-check') + '</span>' : '') +
      stat('gauge', t('s_km'), g.km ? g.km.toLocaleString('nb-NO') + ' km' : '–', t('s_km_sub')) +
      '</div></div>' +
      '<div class="wrap grid"><div class="col">' + upcoming + recos + hotel + '</div><div class="col">' + quick + remindersPanel(key) + history + '</div></div></main>' + footer();
  }

  // ---------- Modals ----------
  function modal() {
    const m = S.modal; if (!m) return '';
    const [type, arg] = m.split(':');
    const shell = (cls, title, body, foot) => '<div class="overlay" data-a="close-bg"><div class="sheet ' + cls + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-h"><h2>' + title + '</h2><button class="icon-btn" data-a="close" aria-label="' + t('close') + '">' + ic('x') + '</button></div><div class="sheet-b">' + body + '</div>' + (foot ? '<div class="sheet-f">' + foot + '</div>' : '') + '</div></div>';
    if (type === 'menu') {
      return shell('drawer', t('menu'), '<nav class="mnav"><a href="#/">' + ic('car-front') + t('nav_home') + '</a>' + NAV().map((n) => '<a href="' + n[0] + '">' + ic(n[2]) + t(n[1]) + '</a>').join('') + '<a href="#/min-bil">' + ic('user') + t('nav_mine') + '</a></nav>' +
        '<div class="mnav-foot"><a class="btn btn-ink btn-block" href="#/bestill/bil">' + t('nav_book') + '</a><a class="btn btn-ghost btn-block" href="tel:+4761138888">' + ic('phone') + D.phone + '</a>' + langToggle() + '</div>');
    }
    if (type === 'cart') {
      const tyres = S.cart.filter((c) => D.products[c.id].tyre);
      const body = S.cart.length ? '<div class="cart-lines">' + S.cart.map((c, i) => { const p = D.products[c.id]; return '<div class="cart-line"><a class="thumb" href="#/produkt/' + c.id + '" ' + bg(p.img) + ' aria-label="' + esc(p.brand + ' ' + L(p.name)) + '"></a><div class="t"><b>' + esc(p.brand + ' ' + L(p.name)) + '</b><small>' + esc(L(p.spec)) + '</small><div class="qty sm"><button data-a="cart-qty" data-v="' + i + '|-1" aria-label="-">' + ic('minus') + '</button><span>' + c.qty + '</span><button data-a="cart-qty" data-v="' + i + '|1" aria-label="+">' + ic('plus') + '</button></div></div><div class="r"><b class="num">' + kr(p.price * c.qty) + '</b><button class="link" data-a="cart-rm" data-v="' + i + '">' + t('remove') + '</button></div></div>'; }).join('') + '</div>' +
        (tyres.length ? '<div class="note">' + ic('wrench') + '<span><b>' + t('cart_fit_hint') + '</b><br>' + t('cart_fit_sub') + '</span></div><button class="btn btn-ghost btn-block" data-a="cart-fit">' + t('cart_fit_cta') + ic('arrow-right') + '</button>' : '')
        : '<div class="empty">' + ic('shopping-bag') + '<b>' + t('cart_empty') + '</b><p class="muted">' + t('cart_empty_sub') + '</p><a class="btn btn-ink" href="#/butikk">' + t('shop_page_title') + '</a></div>';
      const foot = S.cart.length ? '<div class="buy-tot"><span>' + t('cart_sum') + '</span><b class="num">' + kr(cartSum()) + '</b></div><a class="btn btn-ink btn-block" href="#/kasse">' + t('cart_checkout') + ic('arrow-right') + '</a><button class="link" data-a="close" style="justify-self:center">' + t('cart_more') + '</button>' : '';
      return shell('drawer', t('cart_title') + (cartCount() ? ' (' + cartCount() + ')' : ''), body, foot);
    }
    if (type === 'cancel' && S.booking) {
      const b = S.booking;
      return shell('dialog', t('cancel_q'), '<p>' + t('cancel_text', { when: '<b>' + whenText(b) + '</b>', loc: esc(locById(b.loc).name) }) + '</p>', '<button class="btn btn-ghost" data-a="close">' + t('cancel_no') + '</button><button class="btn btn-danger" data-a="cancel-yes">' + t('cancel_yes') + '</button>');
    }
    if (type === 'receipt' || type === 'cert') {
      const g = garageOf(S.mineCar); const h = g.history[+arg]; const car = getCar(S.mineCar); const loc = locById(h.loc);
      const head = '<div class="doc-h"><img src="' + IMG.logoDark + '" alt="Mjøsbil"><div><b>' + esc(loc.name) + '</b><small>' + esc(loc.addr) + '</small></div></div>' +
        '<div class="doc-meta"><span><small>' + (S.lang === 'no' ? 'Dato' : 'Date') + '</small>' + dShort(h.date) + '</span><span><small>Reg.nr</small>' + esc(car.plate) + '</span><span><small>' + t('s_km') + '</small>' + h.km.toLocaleString('nb-NO') + ' km</span></div>';
      if (type === 'receipt') {
        const items = L(h.items); const each = Math.round(h.price / items.length);
        const lines = items.map((it, i) => '<div class="doc-line"><span>' + esc(it) + '</span><span class="num">' + kr(i === items.length - 1 ? h.price - each * (items.length - 1) : each) + '</span></div>').join('');
        return shell('dialog doc', t('receipt_title'), head + lines + '<div class="doc-line tot"><span>' + t('receipt_total') + '</span><span class="num">' + kr(h.price) + '</span></div><div class="doc-line muted"><span>' + t('receipt_vat') + '</span><span class="num">' + kr(h.price * 0.2) + '</span></div><div><span class="tag tag-ok">' + ic('circle-check') + t('receipt_paid') + '</span></div>',
          '<button class="btn btn-ghost" data-a="print">' + ic('file-text') + t('print') + '</button><button class="btn btn-ink" data-a="close">' + t('close') + '</button>');
      }
      return shell('dialog doc', t('cert_title'), head + '<div class="cert-res">' + ic('circle-check') + '<span><small>' + t('cert_result') + '</small><b>' + t('cert_pass') + '</b></span></div>' +
        '<div class="doc-sub">' + t('cert_checked') + '</div><div class="cert-items">' + t('cert_items').map((x) => '<span>' + ic('check') + esc(x) + '</span>').join('') + '</div>' +
        '<div class="doc-meta"><span><small>' + t('cert_next') + '</small>' + dShort(car.euDue) + '</span><span><small>' + t('cert_by') + '</small>' + esc(loc.name) + '</span></div><p class="muted" style="font-size:13px">' + t('cert_note') + '</p>',
        '<button class="btn btn-ghost" data-a="print">' + ic('file-text') + t('print') + '</button><button class="btn btn-ink" data-a="close">' + t('close') + '</button>');
    }
    if (type === 'chat') {
      if (!S.chat.length) S.chat.push({ from: 'agent', text: t('chat_hello', { name: first(S.user ? S.user.name : '') }) });
      const body = '<div class="chat-agent"><span class="avatar">' + ic('wrench') + '</span><span><b>' + t('chat_agent') + '</b><small><i class="online"></i>' + t('chat_online') + '</small></span></div><div class="chat-log" id="chatlog">' +
        S.chat.map((c) => '<div class="msg ' + c.from + '">' + esc(c.text) + (c.action ? '<button class="btn btn-white btn-sm" data-a="mine-add" data-v="' + c.action + '">' + ic('plus') + esc(L(D.services[c.action].name)) + '</button>' : '') + '</div>').join('') +
        (S.chatTyping ? '<div class="msg agent typing"><i></i><i></i><i></i></div>' : '') + '</div>' +
        '<div class="chat-qs">' + [1, 2, 3].map((n) => '<button class="chip" data-a="chat-q" data-v="' + n + '">' + t('chat_q' + n) + '</button>').join('') + '</div>';
      return shell('drawer chat', t('chat_title'), body, '<form class="chat-in" data-form="chat"><input class="input" id="chat-input" placeholder="' + t('chat_ph') + '" autocomplete="off"><button class="btn btn-ink" type="submit" aria-label="Send">' + ic('arrow-right') + '</button></form>');
    }
    if (type === 'msg') {
      const r = reminders(S.mineCar)[+arg]; if (!r) return '';
      const cta = r.cta ? '<button class="btn btn-ink btn-block" data-a="' + r.cta.a + '" data-v="' + r.cta.v + '">' + t('rem_open') + ic('arrow-right') + '</button>' : '';
      if (r.ch === 'sms') {
        return shell('dialog phone-wrap', r.title, '<div class="phone"><div class="phone-top"><span>9:41</span><span class="notch"></span><span>' + ic('zap') + '</span></div><div class="phone-h"><span class="avatar">' + ic('wrench') + '</span><b>' + t('sms_sender') + '</b><small>' + (r.now ? t('today') : dShort(r.when)) + '</small></div><div class="phone-b"><div class="bubble">' + linkify(r.text) + '<small>' + t('rem_stop') + '</small></div></div></div>', cta);
      }
      return shell('dialog doc', r.title, '<div class="mail"><div class="doc-h"><img src="' + IMG.logoDark + '" alt="Mjøsbil"><div><b>' + esc(r.title) + '</b><small>' + t('rem_from') + ' · ' + dShort(r.when) + '</small></div></div><p>' + linkify(r.text) + '</p></div>', cta);
    }
    if (type === 'addcar') {
      return shell('dialog', t('addcar_title'), '<p class="muted">' + t('addcar_sub') + '</p><form class="plate-row" data-form="addcar" novalidate>' + plateInput('addPlate', S.addPlate, 'addcar') + '<button class="btn btn-ink" type="submit">' + t('addcar_cta') + '</button></form>' + plateErr('addcar'));
    }
    return '';
  }

  // ---------- Render ----------
  const app = document.getElementById('app');
  let toastTimer;
  function toast(msg, icon) {
    clearTimeout(toastTimer);
    let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = ic(icon || 'circle-check') + '<span>' + msg + '</span>';
    toastTimer = setTimeout(() => el.remove(), 2400);
  }
  function render() {
    document.documentElement.lang = S.lang === 'no' ? 'nb' : 'en';
    const r = route(); const parts = r.split('/').filter(Boolean);
    const k = query().get('k'); if (k) S.cat = k;
    const focusId = document.activeElement && document.activeElement.id;
    let html;
    if (parts[0] === 'bestill') html = booking(parts[1] || 'bil');
    else if (parts[0] === 'produkt') html = pdp(parts[1]);
    else if (parts[0] === 'butikk') html = shop();
    else if (parts[0] === 'kasse') html = checkout(parts[1]);
    else if (parts[0] === 'avdeling') html = locationPage(parts[1]);
    else if (parts[0] === 'min-bil') html = mine();
    else html = home();
    if (!html) return;
    const fresh = r !== S.lastRoute; S.lastRoute = r;
    app.innerHTML = html + modal();
    document.body.classList.toggle('locked', !!S.modal);
    if (fresh) { const m = app.querySelector('.page'); if (m) m.classList.add('enter'); }
    if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
    const log = document.getElementById('chatlog'); if (log) log.scrollTop = log.scrollHeight;
    if (r === '/' && location.hash.indexOf('#/#') === 0) { const el = document.getElementById(location.hash.slice(3)); if (el) el.scrollIntoView(); }
  }
  window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.modal) { S.modal = null; render(); } });

  // ---------- Actions ----------
  function doLookup(plate, form, then) {
    if (!validPlate(plate)) { S.plateErr = form; render(); const inp = document.querySelector('.plate.err input'); if (inp) inp.focus(); return; }
    S.plateErr = ''; S.plate = prettyPlate(plate); const c = lookup(plate);
    if (!S.car || S.car.key !== c.key) S.items = S.items.filter((i) => i.custom);
    S.car = c; S.looking = true; render();
    setTimeout(() => { S.looking = false; if (then) then(); else render(); }, 700);
  }
  function afterCar() { if (S.after) { const a = S.after; S.after = null; go(a); return; } go('/bestill/behov'); }
  function toggle(id, single) {
    const idx = S.items.findIndex((i) => i.id === id);
    if (idx >= 0) { S.items.splice(idx, 1); toast(t('toast_removed'), 'x'); return; }
    if (single) S.items = S.items.filter((i) => svc(i).cat !== single);
    S.items.push({ id }); toast(t('toast_added'));
  }
  function fillContact() { Object.assign(S.contact, { name: S.user ? S.user.name : 'Kari Nordmann', phone: '912 34 567', email: 'kari.nordmann@example.no' }); S.err = ''; }
  function startFor(carKey, cat) {
    S.car = getCar(carKey); S.plate = S.car.plate; S.cat = cat; S.editing = false;
    if (S.user && !S.contact.name) fillContact();
    go('/bestill/behov');
  }
  function addToCart(id, qty) {
    const line = S.cart.find((c) => c.id === id);
    if (line) line.qty += qty; else S.cart.push({ id, qty });
    S.modal = 'cart'; render(); toast(t('cart_added'), 'shopping-bag');
  }
  function fitFromProduct(id, qty, hotel) {
    const p = D.products[id];
    if (S.pdp.car && (!S.car || S.car.key !== S.pdp.car.key)) { S.car = S.pdp.car; S.items = []; }
    S.items = S.items.filter((i) => !i.custom && svc(i).cat !== 'tyre');
    S.items.unshift({ id: 'shop_' + id, custom: true, cat: 'shop', name: { no: qty + ' × ' + p.brand + ' ' + L(p.name), en: qty + ' × ' + p.brand + ' ' + L(p.name) }, price: p.price * qty, mins: 0, mode: 'live' });
    S.items.push({ id: hotel ? 'hotel' : 'swap' });
    if (S.car) go('/bestill/tid'); else { S.after = '/bestill/tid'; go('/bestill/bil'); }
  }
  function downloadIcs(b) {
    const loc = locById(b.loc); const d = DAYS[b.day]; const hm = b.slot.split(':').map(Number);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hm[0], hm[1]); const end = new Date(start.getTime() + Math.max(30, b.tot.mins) * 60000);
    const z = (x) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mjosbil prototype//NO', 'BEGIN:VEVENT', 'UID:' + b.ref + '@mjosbil-prototype', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(start), 'DTEND:' + z(end),
      'SUMMARY:Mjøsbil: ' + b.items.map((i) => L(svc(i).name)).join(', '), 'LOCATION:' + loc.name + ', ' + loc.addr, 'DESCRIPTION:' + t('done_ref') + ' ' + b.ref, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'mjosbil-' + b.ref + '.ics'; document.body.appendChild(a); a.click(); a.remove();
    toast(t('cal_done'), 'calendar-check');
  }
  function chatReply(text, action) {
    S.chatTyping = true; render();
    setTimeout(() => { S.chatTyping = false; S.chat.push({ from: 'agent', text, action }); if (S.modal === 'chat') render(); }, 900);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) { if (S.modal && e.target.closest('.sheet a[href^="#"]')) { S.modal = null; document.body.classList.remove('locked'); } return; }
    const a = el.dataset.a; const v = el.dataset.v;
    if (a === 'close-bg') { if (e.target === el) { S.modal = null; render(); } return; }
    switch (a) {
      case 'lang': S.lang = v; store.set('lang', v); render(); break;
      case 'nav': go(v); break;
      case 'open': S.modal = v; render(); { const f = document.querySelector('.sheet input'); if (f) f.focus(); } break;
      case 'close': S.modal = null; render(); break;
      case 'hero-try': doLookup(v, 'hero', () => go('/bestill/behov')); break;
      case 'home-cat': S.cat = v; go(S.car ? '/bestill/behov' : '/bestill/bil'); break;
      case 'home-ev': S.cat = 'service'; doLookup('EL 12345', 'hero', afterCar); break;
      case 'eu-book': S.car = S.euCar; S.plate = S.euCar.plate; S.items = S.items.filter((i) => svc(i).cat !== 'eu'); S.items.push({ id: S.euCar.weight > 3500 ? 'pkk_heavy' : 'pkk' }); S.cat = 'eu'; go('/bestill/behov'); break;
      case 'car-try': doLookup(v, 'car', afterCar); break;
      case 'car-reset': S.car = null; S.plate = ''; S.items = S.items.filter((i) => i.custom); go('/bestill/bil'); break;
      case 'to-need': afterCar(); break;
      case 'cat': S.cat = v; render(); break;
      case 'toggle': toggle(v, el.dataset.single); render(); break;
      case 'sym': {
        const i = S.symptoms.indexOf(v); if (i >= 0) S.symptoms.splice(i, 1); else S.symptoms.push(v);
        if (S.symptoms.length && !has('diag')) { S.items.push({ id: 'diag' }); toast(t('toast_added')); }
        if (!S.symptoms.length) S.items = S.items.filter((x) => x.id !== 'diag');
        render(); break;
      }
      case 'remove': { const it = S.items[+v]; S.items.splice(+v, 1); if (it && it.id === 'diag') S.symptoms = []; toast(t('toast_removed'), 'x'); render(); break; }
      case 'to-time': if (S.items.length) go('/bestill/tid'); break;
      case 'city': S.city = v; S.loc = null; S.slot = null; render(); break;
      case 'loc': S.loc = v; S.slot = null; render(); break;
      case 'day': S.day = +v; S.slot = null; render(); break;
      case 'slot': S.slot = v; render(); break;
      case 'handover': S.handover = v; render(); break;
      case 'to-you': if (S.slot) { if (S.user && !S.contact.name) fillContact(); go('/bestill/deg'); } break;
      case 'vipps': fillContact(); render(); break;
      case 'to-confirm': if (validContact()) { S.err = ''; go('/bestill/bekreft'); } else { S.err = t('f_required'); render(); } break;
      case 'submit': {
        const tot = totals();
        S.booking = { ref: 'MB-' + (48000 + Math.floor(Math.random() * 1900)), car: S.car, items: S.items.slice(), symptoms: S.symptoms.slice(), loc: S.loc, day: S.day, slot: S.slot, handover: S.handover, contact: Object.assign({}, S.contact), tot, request: tot.request };
        if (!S.user) S.user = { name: S.contact.name };
        if (S.garageCars.indexOf(S.car.key) < 0) { S.garageCars.push(S.car.key); if (!D.cars[S.car.key]) S.extraCars[S.car.key] = S.car; }
        S.mineCar = S.car.key;
        go('/bestill/ferdig'); break;
      }
      case 'ics': if (S.booking) downloadIcs(S.booking); break;
      case 'express': { S.car = getCar(v); S.plate = S.car.plate; S.items = [{ id: 'hotel' }]; S.symptoms = []; S.editing = false; S.cat = 'tyre'; const h = D.garage[v] && D.garage[v].hotel; if (h) { S.loc = h.loc; S.city = h.loc; } if (S.user && !S.contact.name) fillContact(); go('/bestill/tid'); break; }
      case 'season-login': S.user = { name: D.garage.owner }; render(); toast(t('hi', { name: first(S.user.name) }), 'user'); break;
      case 'done-mine': go('/min-bil'); break;
      case 'restart': Object.assign(S, { items: [], symptoms: [], issueText: '', attached: 0, slot: null, day: 0 }); go('/'); break;
      case 'login': S.user = { name: D.garage.owner }; render(); break;
      case 'logout': S.user = null; render(); break;
      case 'mine-car': S.mineCar = v; render(); break;
      case 'mine-book': startFor(S.mineCar, v); break;
      case 'mine-add': { startFor(S.mineCar, 'service'); if (!has(v)) S.items.push({ id: v }); toast(t('toast_added')); render(); break; }
      case 'edit-booking': {
        const b = S.booking; Object.assign(S, { car: b.car, items: b.items.slice(), loc: b.loc, city: b.loc, day: b.day, slot: b.slot, editing: true });
        go('/bestill/tid'); break;
      }
      case 'edit-cancel': S.editing = false; go('/min-bil'); break;
      case 'save-time': Object.assign(S.booking, { loc: S.loc, day: S.day, slot: S.slot }); S.editing = false; go('/min-bil'); toast(t('moved') + ': ' + whenText(S.booking), 'calendar-check'); break;
      case 'cancel-yes': S.booking = null; S.modal = null; render(); toast(t('cancelled'), 'x'); break;
      case 'print': window.print(); break;
      case 'chat-q': { const n = +v; S.chat.push({ from: 'me', text: t('chat_q' + n) }); chatReply(t('chat_a' + n), n === 2 ? 'brakes' : null); break; }
      case 'shop-cat': S.shopCat = v; if (location.hash.indexOf('?') > 0) go('/butikk'); else render(); break;
      case 'cart-add': addToCart(v, D.products[v].tyre ? 4 : 1); break;
      case 'cart-qty': { const p = v.split('|').map(Number); S.cart[p[0]].qty = Math.max(1, S.cart[p[0]].qty + p[1]); render(); break; }
      case 'cart-rm': S.cart.splice(+v, 1); render(); break;
      case 'cart-fit': {
        const line = S.cart.find((c) => D.products[c.id].tyre); S.cart = S.cart.filter((c) => c !== line);
        fitFromProduct(line.id, line.qty, false); break;
      }
      case 'co-del': S.checkout.delivery = v; render(); break;
      case 'co-store': S.checkout.store = v; render(); break;
      case 'co-pay': {
        if (!validContact()) { S.err = t('co_err'); render(); break; }
        const ship = S.checkout.delivery === 'ship' ? 99 : 0;
        S.order = { ref: 'NB-' + (310000 + Math.floor(Math.random() * 9000)), lines: S.cart.slice(), total: cartSum() + ship, delivery: S.checkout.delivery, store: S.checkout.store, name: S.contact.name };
        S.cart = []; S.err = ''; go('/kasse/ferdig'); break;
      }
      case 'loc-book': S.city = v; S.loc = v; go(S.car ? '/bestill/behov' : '/bestill/bil'); break;
      case 'loc-svc': { const p = v.split('|'); S.city = p[0]; S.loc = p[0]; S.cat = p[1]; go(S.car ? '/bestill/behov' : '/bestill/bil'); break; }
      case 'pdp-try': S.pdp.car = lookup(v); if (!S.car) S.car = S.pdp.car; render(); break;
      case 'qty': S.pdp.qty = Math.max(1, Math.min(8, S.pdp.qty + +v)); render(); break;
      case 'pdp-del': S.pdp.delivery = v; render(); break;
      case 'pdp-cart': addToCart(v, S.pdp.qty); break;
      case 'pdp-fit': fitFromProduct(v, S.pdp.qty, S.pdp.hotel); break;
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form;
    if (kind === 'hero') doLookup(S.plate, 'hero', () => go('/bestill/behov'));
    else if (kind === 'car') doLookup(S.plate, 'car', afterCar);
    else if (kind === 'eu') { if (!validPlate(S.euPlate)) { S.plateErr = 'eu'; S.euCar = null; } else { S.plateErr = ''; S.euCar = lookup(S.euPlate); } render(); }
    else if (kind === 'pdp') { if (!validPlate(S.pdp.plate)) { S.plateErr = 'pdp'; } else { S.plateErr = ''; S.pdp.car = lookup(S.pdp.plate); if (!S.car) S.car = S.pdp.car; } render(); }
    else if (kind === 'addcar') {
      if (!validPlate(S.addPlate)) { S.plateErr = 'addcar'; render(); return; }
      const c = lookup(S.addPlate); S.plateErr = ''; S.addPlate = '';
      if (S.garageCars.indexOf(c.key) < 0) { S.garageCars.push(c.key); if (!D.cars[c.key]) S.extraCars[c.key] = c; }
      S.mineCar = c.key; S.modal = null; render(); toast(t('addcar_done', { car: esc(carName(c)) }), 'car');
    } else if (kind === 'chat') {
      const inp = f.querySelector('input'); const text = inp.value.trim(); if (!text) return;
      S.chat.push({ from: 'me', text }); chatReply(t('chat_auto'));
      const ni = document.getElementById('chat-input'); if (ni) ni.focus();
    }
  });

  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.in; if (!k) return;
    let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.dataset.plate) {
      const f = normPlate(val).replace(/^([A-ZÆØÅ]{2})(\d)/, '$1 $2');
      if (f !== val) e.target.value = f;
      val = f;
      if (S.plateErr) { S.plateErr = ''; const box = e.target.closest('.plate'); box.classList.remove('err'); const err = box.closest('form').parentNode.querySelector('.field-err'); if (err) err.remove(); }
    }
    if (k.indexOf('contact.') === 0) S.contact[k.slice(8)] = val;
    else if (k.indexOf('co.') === 0) S.checkout[k.slice(3)] = val;
    else if (k.indexOf('notify.') === 0) { S.notify[k.slice(7)] = val; render(); }
    else if (k === 'pdp.hotel') { S.pdp.hotel = val; render(); }
    else if (k === 'pdpPlate') S.pdp.plate = val;
    else if (k === 'shopFit') { S.shopFit = val; render(); }
    else S[k] = val;
  });
  document.addEventListener('change', (e) => {
    if (e.target.dataset && e.target.dataset.file) { S.attached += e.target.files.length; render(); }
  });

  render();
})();
