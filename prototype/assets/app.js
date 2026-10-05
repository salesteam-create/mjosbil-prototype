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
    car: null, plate: '', looking: false, euPlate: '', euCar: null,
    cat: 'service', after: null,
    items: [],
    symptoms: [], issueText: '', attached: 0,
    city: 'gjovik', loc: null, day: 0, slot: null, handover: 'drop',
    contact: { name: '', phone: '', email: '', km: '', comment: '', sms: true }, err: '',
    booking: null, cart: 0,
    user: null, mineCar: 'EL12345',
    pdp: { qty: 4, delivery: 'fit', hotel: true, plate: '', car: null },
  };

  // ---------- Helpers ----------
  const t = (k, vars) => {
    let s = (I[S.lang] && I[S.lang][k]) || I.no[k] || k;
    if (vars) Object.keys(vars).forEach((v) => { s = s.replace('{' + v + '}', vars[v]); });
    return s;
  };
  const L = (o) => (o && typeof o === 'object' && 'no' in o ? o[S.lang] || o.no : o);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kr = (n) => n.toLocaleString('nb-NO') + ' kr';
  const locale = () => (S.lang === 'no' ? 'nb-NO' : 'en-GB');
  const fmt = (d, o) => new Date(d).toLocaleDateString(locale(), o);
  const dShort = (d) => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });
  const dur = (m) => (m < 60 ? m + ' ' + t('mins') : Math.floor(m / 60) + ' ' + t('hours') + (m % 60 ? ' ' + (m % 60) + ' ' + t('mins') : ''));
  const normPlate = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prettyPlate = (p) => normPlate(p).replace(/^([A-Z]{2})(\d+)$/, '$1 $2');
  const weeksTo = (iso) => Math.round((new Date(iso) - new Date()) / (7 * 864e5));
  const euSoon = (car) => weeksTo(car.euDue) <= 12;
  const locById = (id) => D.locations.find((l) => l.id === id);
  const carName = (c) => c.make + ' ' + c.model;

  function lookup(plate) {
    const key = normPlate(plate);
    if (key.length < 4) return null;
    const c = D.cars[key] || Object.assign({}, D.cars._default);
    return Object.assign({ key }, c, { plate: c.plate || prettyPlate(plate) });
  }

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
  const totals = () => S.items.reduce((a, i) => { const s = svc(i); a.price += s.price || 0; a.mins += s.mins || 0; if (s.from) a.from = true; if (s.mode === 'request') a.request = true; return a; }, { price: 0, mins: 0, from: false, request: false });
  const priceTxt = (s) => (s.quote ? t('price_quote') : (s.from ? t('from') + ' ' : '') + kr(s.price));
  const totalTxt = (tot) => (tot.from ? t('from') + ' ' : '') + kr(tot.price);

  // ---------- Icons + assets ----------
  const ic = (n, cls) => '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  const IMG = {
    logoDark: 'assets/img/logo-dark.png', logoWhite: 'assets/img/logo-white.png',
    hero: 'assets/img/hero.jpg', hakka: 'assets/img/hakka.jpg', hotel: 'assets/img/tyrehotel.jpg',
    facade: 'assets/img/facade.jpg',
  };
  const bg = (src) => 'style="background-image:url(\'' + src + '\')"';
  const plateChip = (p, lg) => '<span class="chip-plate' + (lg ? ' lg' : '') + '"><b>N</b><span>' + esc(p) + '</span></span>';

  const CATS = [
    { id: 'service', icon: 'wrench' }, { id: 'eu', icon: 'clipboard-check' }, { id: 'tyre', icon: 'circle-dot' },
    { id: 'issue', icon: 'triangle-alert' }, { id: 'other', icon: 'ellipsis' },
  ];
  const SYM_ICON = { alert: 'triangle-alert', sound: 'volume-2', disc: 'disc', steer: 'car-front', snow: 'snowflake', bolt: 'zap', key: 'key', dots: 'ellipsis' };
  const SVC_ICON = { brakes: 'disc', wipers: 'sparkles', battery: 'battery-charging', pre_pkk: 'clipboard-check', align: 'gauge', ac: 'snowflake' };

  // ---------- Router ----------
  const route = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const query = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = h; };
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  // ---------- Chrome ----------
  const ribbon = () => '<div class="ribbon">' + t('proto_note') + '</div>';
  const langToggle = () => '<div class="lang" role="group" aria-label="Language"><button data-a="lang" data-v="no" aria-pressed="' + (S.lang === 'no') + '">NO</button><button data-a="lang" data-v="en" aria-pressed="' + (S.lang === 'en') + '">EN</button></div>';
  const logo = (white) => '<a class="logo" href="#/" aria-label="Mjøsbil"><img src="' + (white ? IMG.logoWhite : IMG.logoDark) + '" alt="Mjøsbil"></a>';

  function header() {
    return ribbon() + '<header class="hdr"><div class="wrap">' + logo() +
      '<nav class="nav"><a href="#/bestill/bil?k=service">' + t('nav_workshop') + '</a><a href="#/bestill/bil?k=tyre">' + t('nav_tyres') + '</a><a href="#/#shop">' + t('nav_shop') + '</a><a href="#/#locs">' + t('nav_locations') + '</a></nav>' +
      '<div class="hdr-right">' + langToggle() +
      '<a class="icon-btn me" href="#/min-bil">' + ic('user') + (S.user ? esc(S.user.name.split(' ')[0]) : t('nav_mine')) + '</a>' +
      '<a class="icon-btn mob" href="#/min-bil" aria-label="' + t('nav_mine') + '">' + ic('car') + '</a>' +
      '<button class="icon-btn" aria-label="Cart">' + ic('shopping-bag') + (S.cart ? '<span class="dot">' + S.cart + '</span>' : '') + '</button>' +
      '<a class="btn btn-ink btn-sm hdr-book" href="#/bestill/bil">' + t('nav_book') + '</a>' +
      '</div></div></header>';
  }
  function bookHeader() {
    return ribbon() + '<header class="hdr"><div class="wrap">' + logo() +
      '<button class="hdr-help link" data-a="toast" data-v="' + esc(t('help_toast', { phone: D.phone })) + '" style="color:var(--ink-2)">' + ic('phone') + '<span class="t">' + t('help') + '</span> ' + D.phone + '</button>' +
      langToggle() + '</div></header>';
  }
  function footer() {
    return '<footer class="footer"><div class="wrap"><div class="cols"><img src="' + IMG.logoWhite + '" alt="Mjøsbil"><span style="margin-top:10px">BilXtra verksted · Fagdekk · BilXtra butikk</span></div>' +
      '<div class="cols"><b style="color:#fff">' + t('nav_locations') + '</b><span>Gjøvik · Lillehammer · Dokka · Fåvang · Otta</span><span>' + D.phone + ' · post@mjosbil.no</span></div>' +
      '<div class="cols"><b style="color:#fff">' + t('nav_mine') + '</b><a href="#/min-bil">' + t('mt_cta') + ' →</a><span>' + t('proto_note') + '</span></div></div></footer>';
  }
  function plateInput(name, val) {
    return '<label class="plate"><span class="plate-eu"><i></i>N</span><span class="sr">Reg.nr</span>' +
      '<input data-in="' + name + '" value="' + esc(val) + '" placeholder="' + t('plate_placeholder') + '" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9"></label>';
  }
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

  // ---------- Home ----------
  function home() {
    const gj = locById('gjovik');
    let euRes = '';
    if (S.euCar) {
      const w = weeksTo(S.euCar.euDue);
      euRes = '<div class="eu-res ' + (w > 12 ? 'ok' : '') + '">' + ic(w > 12 ? 'circle-check' : 'clock') + '<span><b>' + esc(carName(S.euCar)) + '</b> · ' + t('eu_due_in', { date: fmt(S.euCar.euDue, { day: 'numeric', month: 'long', year: 'numeric' }) }) + '</span><button class="btn btn-ink btn-sm" data-a="eu-book">' + t('nav_book') + '</button></div>';
    }
    const g = D.garage.EL12345;
    return header() +
      '<section class="hero on-dark"><div class="wrap"><div>' +
      '<span class="kicker">' + t('hero_kicker') + '</span><h1>' + t('hero_title').replace('<br>', ' ') + '</h1><p class="sub">' + t('hero_sub') + '</p>' +
      '<form class="plate-row" data-form="hero">' + plateInput('plate', S.plate) + '<button class="btn btn-mjos" type="submit">' + t('hero_cta') + ic('arrow-right') + '</button></form>' +
      tryPlates('hero-try') +
      '<div class="usps"><span>' + ic('circle-check') + t('usp_price') + '</span><span>' + ic('zap') + t('usp_ev') + '</span><span>' + ic('shield-check') + t('usp_falck') + '</span></div>' +
      '</div><div class="hero-photo" ' + bg(IMG.hero) + '><div class="float-card"><span class="tile">' + ic('calendar-check') + '</span><span><small>' + t('hero_first', { loc: gj.name }) + '</small><b>' + firstFreeLabel(gj) + '</b></span></div></div></div></section>' +

      '<section class="section"><div class="wrap"><div class="sec-h"><h2>' + t('intent_title') + '</h2></div><div class="intents">' +
      CATS.map((c) => '<button class="intent" data-a="home-cat" data-v="' + c.id + '"><span class="tile-ico">' + ic(c.icon) + '</span><span><b>' + t('i_' + c.id) + '</b><small>' + t('i_' + c.id + '_sub') + '</small></span></button>').join('') +
      '</div></div></section>' +

      '<section class="section"><div class="wrap promos">' +
      '<div class="promo promo-winter with-photo"><span class="kicker">' + ic('snowflake') + t('season_kicker') + '</span><h3>' + t('season_title') + '</h3><p>' + t('season_text') + '</p><button class="btn btn-ink" data-a="home-cat" data-v="tyre">' + t('season_cta') + '</button><div class="promo-photo" ' + bg(IMG.hakka) + '></div></div>' +
      '<div class="promo promo-ev on-dark"><span class="kicker">' + ic('zap') + t('ev_kicker') + '</span><h3>' + t('ev_title') + '</h3><p>' + t('ev_text') + '</p><button class="btn btn-white" data-a="home-ev">' + t('ev_cta') + '</button></div>' +
      '</div></section>' +

      '<section class="section"><div class="wrap"><div class="eu-check"><div><h3>' + t('eu_check_title') + '</h3><p class="muted" style="margin-top:6px">' + t('eu_check_text') + '</p></div>' +
      '<form class="plate-row" data-form="eu">' + plateInput('euPlate', S.euPlate) + '<button class="btn btn-ink" type="submit">' + t('eu_check_cta') + '</button></form>' + euRes + '</div></div></section>' +

      '<section class="section"><div class="wrap"><div class="mycar-teaser on-dark"><div style="display:grid;gap:14px;justify-items:start"><span class="kicker">' + ic('car') + t('mt_kicker') + '</span><h3>' + t('mt_title') + '</h3><p>' + t('mt_text') + '</p><a class="btn btn-mjos" href="#/min-bil">' + t('mt_cta') + ic('arrow-right') + '</a></div>' +
      '<div class="mini-stack">' +
      '<div class="mini"><span class="tile-ico">' + ic('clipboard-check') + '</span><span><small>' + t('mt_eu') + ' · ' + plateChip('EL 12345') + '</small><b>' + fmt(D.cars.EL12345.euDue, { day: 'numeric', month: 'long', year: 'numeric' }) + '</b></span></div>' +
      '<div class="mini"><span class="tile-ico">' + ic('package') + '</span><span><small>' + t('mt_hotel') + '</small><b>' + L(g.hotel.stored) + ' · ' + esc(locById(g.hotel.loc).name) + '</b></span></div>' +
      '<div class="mini"><span class="tile-ico">' + ic('history') + '</span><span><small>' + t('mt_hist') + ' · ' + dShort(g.history[0].date) + '</small><b>' + esc(L(g.history[0].items)[0]) + '</b></span></div>' +
      '</div></div></div></section>' +

      '<section class="section" id="shop"><div class="wrap"><div class="sec-h"><div><h2>' + t('shop_title') + '</h2><p>' + t('shop_sub') + '</p></div><a class="link" href="#/produkt/hakka10">' + t('shop_all') + ic('arrow-right') + '</a></div><div class="products">' +
      Object.keys(D.products).map((id) => {
        const p = D.products[id];
        return '<a class="pcard" href="#/produkt/' + id + '"><div class="pimg' + (p.cover ? ' cover' : '') + '" ' + (p.img ? bg(p.img) : '') + '>' + (p.img ? '' : tyreArt(120)) + '</div><div class="pbody"><span class="brand">' + esc(p.brand) + '</span><span class="name">' + esc(p.name) + '</span><span class="spec">' + esc(L(p.spec)) + '</span><span class="price">' + kr(p.price) + ' <small>' + L(p.unit) + '</small></span>' + (p.fitting ? '<span class="tag tag-mjos">' + ic('wrench') + t('shop_fit') + '</span>' : '') + '</div></a>';
      }).join('') + '</div></div></section>' +

      '<section class="section" id="locs"><div class="wrap"><div class="sec-h"><div><h2>' + t('loc_title') + '</h2><p>' + t('loc_sub') + '</p></div></div>' +
      '<div class="loc-photo" ' + bg(IMG.facade) + ' style="margin-bottom:10px"></div><div class="locs">' +
      D.locations.map((l) => '<div class="loc-card"><span class="tile-ico">' + ic('map-pin') + '</span><div><b>' + esc(l.name) + '</b><div class="meta">' + t('first_free') + ': <b>' + firstFreeLabel(l) + '</b></div></div><a class="btn btn-ghost btn-sm" href="#/bestill/bil" data-a="pick-city" data-v="' + l.id + '">' + t('nav_book') + '</a></div>').join('') +
      '</div></div></section>' + footer();
  }

  function tyreArt(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="#1d2a33"/>' +
      Array.from({ length: 24 }, (_, i) => '<rect x="96" y="6" width="8" height="18" rx="2" fill="#0d1820" transform="rotate(' + (i * 15) + ' 100 100)"/>').join('') +
      '<circle cx="100" cy="100" r="56" fill="#c9d1d6"/><circle cx="100" cy="100" r="46" fill="#e8ecef"/>' +
      Array.from({ length: 5 }, (_, i) => '<rect x="95" y="58" width="10" height="34" rx="5" fill="#b5bfc5" transform="rotate(' + (i * 72) + ' 100 100)"/>').join('') +
      '<circle cx="100" cy="100" r="12" fill="#8d999f"/></svg>';
  }

  // ---------- Booking ----------
  const STEPS = ['bil', 'behov', 'tid', 'deg', 'bekreft'];
  const STEP_LBL = { bil: 'step_car', behov: 'step_need', tid: 'step_time', deg: 'step_you', bekreft: 'step_confirm' };
  const stepper = (cur) => { const ci = STEPS.indexOf(cur); return '<div class="stepper">' + STEPS.map((s, i) => '<div class="s ' + (i < ci ? 'past' : i === ci ? 'on' : '') + '"><div class="bar"></div><span class="t">' + t(STEP_LBL[s]) + '</span></div>').join('') + '</div>'; };

  function carCard(withChange) {
    const c = S.car;
    return '<div class="card car-card"><span class="car-thumb' + (c.fuel === 'ev' ? ' ev' : '') + '">' + ic(c.fuel === 'ev' ? 'zap' : 'car') + '</span><div class="t"><b>' + esc(carName(c)) + '</b><small>' + c.year + ' · ' + t('car_' + c.fuel) + ' · ' + c.wheel + '" ' + (S.lang === 'no' ? 'hjul' : 'wheels') + ' · ' + t('car_last_service') + ' ' + L(c.lastService) + '</small></div>' +
      '<div class="r">' + plateChip(c.plate) + (withChange ? '<button class="link" data-a="car-reset">' + t('car_not_you') + '</button>' : '') + '</div></div>';
  }

  function stepCar() {
    const found = S.car && !S.looking;
    if (found) {
      const c = S.car;
      return '<div class="step-h"><h1>' + t('car_found') + '</h1><p>' + t('car_sub') + '</p></div><div class="stack">' + carCard(true) +
        '<div class="car-facts"><div class="fact"><small>' + t('car_eu') + '</small><b>' + dShort(c.euDue) + '</b>' + (euSoon(c) ? '<div><span class="tag tag-warn" style="margin-top:6px">' + ic('clock') + t('car_eu_soon') + '</span></div>' : '') + '</div>' +
        '<div class="fact"><small>' + t('car_last_service') + '</small><b>' + L(c.lastService) + '</b></div><div class="fact"><small>' + t('car_wheels') + '</small><b>' + c.wheel + '"</b></div></div></div>';
    }
    return '<div class="step-h"><h1>' + t('car_title') + '</h1><p>' + t('car_sub') + '</p></div>' +
      '<form class="plate-row" data-form="car">' + plateInput('plate', S.plate) + '<button class="btn btn-ink" type="submit">' + t('car_lookup') + '</button></form>' +
      (S.looking ? '<div class="loading"></div>' : tryPlates('car-try'));
  }

  function optCard(id, recommended, single) {
    const s = svc({ id }); const on = has(id); const incl = L(s.incl);
    return '<button class="opt ' + (on ? 'on' : '') + '" data-a="toggle" data-v="' + id + '" data-single="' + (single ? s.cat : '') + '" aria-pressed="' + on + '">' +
      '<div class="opt-top"><span class="box">' + (on ? ic('check') : '') + '</span><span class="opt-title">' + esc(L(s.name)) + '</span><span class="opt-price">' + priceTxt(s) + (s.example ? '<small>' + t('example_price') + '</small>' : '') + (s.hotel ? '<small>' + t('tyre_season') + '</small>' : '') + '</span></div>' +
      '<div class="opt-desc">' + esc(L(s.desc)) + '</div>' +
      '<div class="opt-meta">' + (recommended ? '<span class="tag tag-mjos">' + ic('sparkles') + t('recommended') + '</span>' : '') + '<span class="tag">' + ic('timer') + dur(s.mins) + '</span>' +
      (s.mode === 'live' ? '<span class="tag tag-ok">' + ic('zap') + t('live') + '</span>' : '<span class="tag tag-warn">' + ic('clock') + t('request') + '</span>') + '</div>' +
      (on && incl ? '<div class="opt-incl">' + incl.map((x) => '<div>' + ic('check') + '<span>' + esc(x) + '</span></div>').join('') + '</div>' : '') +
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
        '<div class="card" style="padding:14px 16px;display:flex;gap:12px;align-items:center"><span class="tile-ico">' + ic('circle-dot') + '</span><b style="flex:1">' + t('tyre_new') + '</b><a class="btn btn-ghost btn-sm" href="#/produkt/hakka10">' + t('tyre_new_cta') + '</a></div>';
    }
    if (cat === 'issue') {
      const syms = D.symptoms.filter((s) => !s.fuel || s.fuel.indexOf(c.fuel) >= 0);
      const sugg = S.symptoms.map((id) => (D.symptoms.find((x) => x.id === id) || {}).suggest).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      return '<div class="sub-h" style="margin-top:0">' + t('issue_title') + '</div><p class="muted" style="margin-top:-8px">' + t('issue_sub') + '</p>' +
        '<div class="symptoms">' + syms.map((s) => '<button class="sym ' + (S.symptoms.indexOf(s.id) >= 0 ? 'on' : '') + '" data-a="sym" data-v="' + s.id + '">' + ic(SYM_ICON[s.icon] || 'ellipsis') + esc(L(s.name)) + '</button>').join('') + '</div>' +
        (S.symptoms.length ? '<div class="field"><label for="issue">' + t('issue_desc') + '</label><textarea id="issue" data-in="issueText" placeholder="' + esc(t('issue_desc_ph')) + '">' + esc(S.issueText) + '</textarea></div>' +
          '<button class="attach" data-a="attach">' + ic('camera') + '<span>' + t('issue_attach') + (S.attached ? ' · <b>' + S.attached + ' ' + t('issue_attached') + '</b>' : '') + '</span></button>' +
          '<div class="opts">' + optCard('diag', true, false) + '</div><div class="note">' + ic('phone') + '<span>' + t('issue_promise') + '</span></div>' +
          (sugg.length ? '<div class="sub-h">' + t('issue_suggest') + '</div><div class="opts">' + sugg.map((id) => optCard(id, false, false)).join('') + '</div>' : '') : '');
    }
    return '<div class="opts">' + pick(['ac', 'align', 'flush', 'rv'], c.weight > 3500 ? 'rv' : null, false) + '</div>';
  }

  function stepNeed() {
    const counts = {};
    S.items.forEach((i) => { const c = svc(i).cat; if (c && c !== 'addon' && c !== 'shop') counts[c] = (counts[c] || 0) + 1; });
    const nudge = euSoon(S.car) && S.cat !== 'eu' && !counts.eu ? '<button class="note warn" data-a="cat" data-v="eu" style="border:0;text-align:left;width:100%">' + ic('clock') + '<span>' + t('eu_due_text', { date: fmt(S.car.euDue, { day: 'numeric', month: 'long' }) }) + ' <b>' + t('eu_due_soon_text', { weeks: weeksTo(S.car.euDue) }) + '</b></span></button>' : '';
    return '<div class="step-h"><h1>' + t('need_title') + '</h1><p>' + t('need_sub') + '</p></div><div class="stack">' + carCard(true) + nudge +
      '<div class="cats" role="tablist">' + CATS.map((c) => '<button class="chip ' + (S.cat === c.id ? 'on' : '') + '" data-a="cat" data-v="' + c.id + '" role="tab" aria-selected="' + (S.cat === c.id) + '">' + t('i_' + c.id) + (counts[c.id] ? '<span class="n">' + counts[c.id] + '</span>' : '') + '</button>').join('') + '</div>' +
      catBody(S.cat) + '</div>';
  }

  const unavailableAt = (loc) => S.items.map((i) => i.id).filter((id) => loc.no.indexOf(id) >= 0);

  function stepTime() {
    const locs = D.locations.slice().sort((a, b) => a.km[S.city] - b.km[S.city]);
    if (!S.loc || unavailableAt(locById(S.loc)).length) { const f = locs.find((l) => !unavailableAt(l).length); S.loc = f ? f.id : null; S.slot = null; }
    const loc = locById(S.loc);
    const tot = totals();
    const canWait = tot.mins <= 90;
    if (!canWait && S.handover === 'wait') S.handover = 'drop';
    const slots = loc ? slotsFor(loc, S.day) : [];
    return '<div class="step-h"><h1>' + t('time_title') + '</h1><p>' + t('time_sub') + '</p></div><div class="stack">' +
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
        return '<button class="day ' + (S.day === i ? 'on' : '') + (free ? '' : ' full') + '" data-a="day" data-v="' + i + '"><small>' + fmt(d, { weekday: 'short' }) + '</small><b>' + d.getDate() + '</b><i>' + (free ? free + ' ' + (S.lang === 'no' ? 'ledige' : 'free') : (S.lang === 'no' ? 'fullt' : 'full')) + '</i></button>';
      }).join('') + '</div>' +
        '<div class="sub-h">' + t('pick_time') + '</div>' + (slots.some(Boolean) ? '<div class="slots">' + SLOT_TIMES.map((tm, i) => '<button class="slot ' + (S.slot === tm ? 'on' : '') + '" data-a="slot" data-v="' + tm + '" ' + (slots[i] ? '' : 'disabled') + '>' + tm + '</button>').join('') + '</div>' : '<p class="muted">' + t('no_slots') + '</p>') +
        (tot.request ? '<div class="note warn">' + ic('info') + '<span>' + t('req_note') + '</span></div>' : '') +
        '<div class="sub-h">' + t('handover') + '</div><div class="radios">' +
        '<button class="radio-row ' + (S.handover === 'drop' ? 'on' : '') + '" data-a="handover" data-v="drop"><span class="radio"></span><span class="t"><b>' + t('h_drop') + '</b><small>' + t('h_drop_sub') + '</small></span></button>' +
        '<button class="radio-row ' + (S.handover === 'wait' ? 'on' : '') + '" data-a="handover" data-v="wait" ' + (canWait ? '' : 'disabled') + '><span class="radio"></span><span class="t"><b>' + t('h_wait') + '</b><small>' + (canWait ? t('h_wait_sub') : t('h_wait_long')) + '</small></span></button>' +
        '</div>' : '') + '</div>';
  }

  function stepYou() {
    const c = S.contact;
    const f = (k, type, mode) => '<div class="field"><label for="f_' + k + '">' + t('f_' + k) + '</label><input class="input" id="f_' + k + '" type="' + type + '" data-in="contact.' + k + '" value="' + esc(c[k]) + '"' + (mode ? ' inputmode="' + mode + '"' : '') + '></div>';
    return '<div class="step-h"><h1>' + t('you_title') + '</h1><p>' + t('you_sub') + '</p></div><div class="form">' +
      '<button class="btn btn-vipps btn-block" data-a="vipps">' + t('vipps') + '</button><div class="divider">' + t('or_manual') + '</div>' +
      f('name', 'text') + f('phone', 'tel', 'tel') + f('email', 'email', 'email') + f('km', 'text', 'numeric') +
      '<div class="field"><label for="f_comment">' + t('f_comment') + '</label><textarea id="f_comment" data-in="contact.comment">' + esc(c.comment) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" data-in="contact.sms" ' + (c.sms ? 'checked' : '') + '>' + t('f_sms') + '</label>' +
      (S.err ? '<div class="err">' + S.err + '</div>' : '') + '</div>';
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

  function summary(btn) {
    const tot = totals(); const loc = S.loc && locById(S.loc);
    return '<div class="card sum"><div class="sum-h"><h3>' + t('sum_title') + '</h3>' + (S.car ? plateChip(S.car.plate) : '') + '</div>' +
      '<div class="sum-items">' + (S.items.length ? S.items.map((i, idx) => { const s = svc(i); return '<div class="sum-item"><span class="n">' + esc(L(s.name)) + '</span><span class="p">' + (s.quote ? '–' : priceTxt(s)) + '</span><button class="x" data-a="remove" data-v="' + idx + '" aria-label="' + t('remove') + '">' + ic('x') + '</button></div>'; }).join('') : '<span class="muted" style="font-size:14px">' + t('sum_empty') + '</span>') + '</div>' +
      (S.items.length ? '<div class="sum-meta">' + (loc && STEPS.indexOf(route().split('/')[2]) >= 2 ? '<div>' + ic('map-pin') + esc(loc.name) + '</div>' : '') + (S.slot ? '<div>' + ic('calendar') + whenText() + '</div>' : '') + '<div>' + ic('timer') + t('sum_time') + ' ' + dur(tot.mins) + '</div></div>' +
        '<div class="sum-tot"><span>' + t('sum_total') + '<small>' + t('sum_vat') + '</small></span><b>' + totalTxt(tot) + '</b></div>' : '') + btn + '</div>' +
      '<div class="note sum-note">' + ic('shield-check') + '<span>' + t('confirm_sub') + '</span></div>';
  }

  function primaryFor(step) {
    const tot = totals();
    if (step === 'bil') return S.car && !S.looking ? { label: t('continue'), ok: true, a: 'to-need' } : null;
    if (step === 'behov') return { label: t('next'), ok: S.items.length > 0, a: 'to-time' };
    if (step === 'tid') return { label: t('next'), ok: !!(S.loc && S.slot), a: 'to-you' };
    if (step === 'deg') return { label: t('next'), ok: true, a: 'to-confirm' };
    if (step === 'bekreft') return { label: tot.request ? t('request_cta') : t('book_cta'), ok: true, a: 'submit' };
    return null;
  }
  const validContact = () => { const c = S.contact; return c.name.trim() && c.phone.trim() && /\S+@\S+/.test(c.email); };

  function booking(sub) {
    if (sub === 'ferdig') return bookHeader() + doneView();
    if (!S.car && sub !== 'bil') { go('/bestill/bil'); return ''; }
    if ((sub === 'tid' || sub === 'deg' || sub === 'bekreft') && !S.items.length) { go('/bestill/behov'); return ''; }
    if ((sub === 'deg' || sub === 'bekreft') && !S.slot) { go('/bestill/tid'); return ''; }
    if (sub === 'bekreft' && !validContact()) { go('/bestill/deg'); return ''; }
    const body = { bil: stepCar, behov: stepNeed, tid: stepTime, deg: stepYou, bekreft: stepConfirm }[sub]();
    const p = primaryFor(sub);
    const btn = p ? '<button class="btn btn-ink btn-block" data-a="' + p.a + '" ' + (p.ok ? '' : 'disabled') + '>' + p.label + ic('arrow-right') + '</button>' : '';
    const side = sub !== 'bil';
    const tot = totals();
    const mbar = p ? '<div class="mbar' + (side ? ' side' : '') + '"><div class="tot">' + (S.items.length ? '<small>' + (S.slot && sub !== 'behov' ? whenText() : S.items.length + ' · ' + dur(tot.mins)) + '</small><b>' + totalTxt(tot) + '</b>' : S.car ? '<small>' + esc(S.car.plate) + '</small><b style="font-size:15px">' + esc(carName(S.car)) + '</b>' : '') + '</div><button class="btn btn-ink" data-a="' + p.a + '" ' + (p.ok ? '' : 'disabled') + '>' + p.label + '</button></div>' : '';
    const backTo = { behov: '/bestill/bil', tid: '/bestill/behov', deg: '/bestill/tid', bekreft: '/bestill/deg' }[sub];
    return bookHeader() + '<main class="book"><div class="wrap"><div class="main">' + stepper(sub) +
      (backTo ? '<button class="back-btn" data-a="nav" data-v="' + backTo + '">' + ic('chevron-left') + t('back') + '</button>' : '') + body + '</div>' +
      (side ? '<aside class="summary">' + summary(btn) + '</aside>' : '') + '</div></main>' + mbar;
  }

  function bringList(b) {
    const out = [t('bring_key')];
    if (b.items.some((i) => i.id === 'swap' || i.id === 'hotel')) out.unshift(t('bring_wheels'));
    if (b.car.fuel === 'ev' && b.symptoms.indexOf('charge') >= 0) out.push(t('bring_charge'));
    return out;
  }

  function doneView() {
    const b = S.booking; if (!b) { go('/'); return ''; }
    const loc = locById(b.loc); const first = esc(b.contact.name.split(' ')[0]);
    return '<main class="book"><div class="wrap" style="display:block"><div class="done">' +
      '<div class="done-ico">' + ic('check') + '</div><h1>' + (b.request ? t('done_title_req', { name: first }) : t('done_title', { name: first })) + '</h1><p class="muted">' + (b.request ? t('done_sub_req') : t('done_sub')) + '</p>' +
      '<div class="ref"><small>' + t('done_ref') + '</small><b>' + b.ref + '</b></div>' +
      '<div class="card rows done-card">' +
      '<div class="row">' + ic('calendar') + '<div class="t"><small>' + (S.lang === 'no' ? 'Tid' : 'Time') + '</small><b>' + whenText(b) + '</b></div></div>' +
      '<div class="row">' + ic('map-pin') + '<div class="t"><small>' + (S.lang === 'no' ? 'Sted' : 'Place') + '</small>' + esc(loc.name) + '<br><span class="muted">' + esc(loc.addr) + '</span></div></div>' +
      '<div class="row">' + ic('wrench') + '<div class="t"><small>' + t('step_need') + '</small>' + b.items.map((i) => esc(L(svc(i).name))).join('<br>') + '<br><b>' + t('sum_total') + ': ' + totalTxt(b.tot) + '</b></div></div>' +
      '<div class="row">' + ic('package') + '<div class="t"><small>' + t('done_bring') + '</small>' + bringList(b).map(esc).join('<br>') + '</div></div></div>' +
      '<div class="done-actions"><button class="btn btn-ink" data-a="toast" data-v="' + esc(t('done_cal')) + ' ✓">' + ic('calendar') + t('done_cal') + '</button>' +
      '<button class="btn btn-ghost" data-a="done-mine">' + ic('car') + t('done_mine') + '</button><button class="link" data-a="restart" style="justify-self:center;margin-top:4px">' + t('done_home') + '</button></div>' +
      '<p class="muted" style="font-size:14px">' + t('done_change') + '</p></div></div></main>';
  }

  // ---------- Product page ----------
  function pdp(id) {
    const p = D.products[id] || D.products.hakka10;
    const st = S.pdp; const car = st.car || S.car; const isTyre = p.fitting === 'swap';
    let fitRes = '';
    if (car && isTyre) {
      fitRes = car.wheel === p.fitsInch ? '<div class="fit-res ok">' + ic('circle-check') + t('pdp_fits', { car: esc(carName(car)) }) + '</div>'
        : '<div class="fit-res no">' + ic('circle-alert') + t('pdp_no_fit', { car: esc(carName(car)), inch: car.wheel }) + '</div>';
    }
    const fitPrice = isTyre ? D.wheelPrice(p.fitsInch) : 0;
    const total = p.price * st.qty + (isTyre && st.delivery === 'fit' ? fitPrice + (st.hotel ? D.hotelPrice(p.fitsInch) : 0) : 0);
    const radio = (v, title, sub, extra) => '<button class="radio-row ' + (st.delivery === v ? 'on' : '') + '" data-a="pdp-del" data-v="' + v + '"><span class="radio"></span><span class="t"><b>' + title + '</b><small>' + sub + '</small></span>' + (extra ? '<span class="p">' + extra + '</span>' : '') + '</button>';
    return header() + '<main class="pdp"><div class="wrap">' +
      '<nav class="crumbs"><a href="#/">Mjøsbil</a>/<a href="#/#shop">' + t('nav_shop') + '</a>/<span>' + L(p.cat) + '</span></nav>' +
      '<div class="pdp-img' + (p.cover ? '' : ' contain') + '" ' + (p.img ? bg(p.img) : '') + '>' + (p.img ? '' : tyreArt(280)) + '</div>' +
      '<div class="pdp-info"><div><span class="kicker" style="color:var(--muted)">' + esc(p.brand) + '</span><h1 style="margin-top:6px">' + esc(p.name) + '</h1><div class="muted" style="margin-top:6px">' + esc(L(p.spec)) + ' · ' + L(p.cat) + '</div></div>' +
      '<div class="pdp-price">' + kr(p.price) + ' <small>' + L(p.unit) + (p.example ? ' · ' + t('example_price') : '') + '</small></div>' +
      '<div class="bullets">' + L(p.bullets).map((b) => '<div>' + ic('check') + '<span>' + esc(b) + '</span></div>').join('') + '</div>' +
      (isTyre ? '<div class="card fit-box"><b>' + t('pdp_fit_check') + '</b>' + (car ? fitRes : '<form class="plate-row" data-form="pdp">' + plateInput('pdpPlate', st.plate) + '<button class="btn btn-ink" type="submit">' + t('car_lookup') + '</button></form>' + tryPlates('pdp-try')) + '</div>' : '') +
      '<div style="display:flex;align-items:center;gap:12px"><span class="muted">' + t('pdp_qty') + '</span><div class="qty"><button data-a="qty" data-v="-1" aria-label="-">' + ic('minus') + '</button><span>' + st.qty + '</span><button data-a="qty" data-v="1" aria-label="+">' + ic('plus') + '</button></div></div>' +
      (isTyre ? '<div class="sub-h">' + t('pdp_delivery') + '</div><div class="radios">' +
        radio('fit', t('pdp_fit'), t('pdp_fit_sub') + ' · ' + t('first_free') + ' ' + firstFreeLabel(D.locations[0]), '+ ' + kr(fitPrice)) +
        radio('pickup', t('pdp_pickup'), t('pdp_pickup_sub')) + radio('ship', t('pdp_ship'), t('pdp_ship_sub')) + '</div>' +
        (st.delivery === 'fit' ? '<label class="check"><input type="checkbox" data-in="pdp.hotel" ' + (st.hotel ? 'checked' : '') + '>' + t('pdp_hotel') + ' (+ ' + kr(D.hotelPrice(p.fitsInch)) + ' ' + t('tyre_season') + ')</label>' : '') : '') +
      '<div class="card" style="padding:16px;display:grid;gap:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span>' + t('pdp_total') + '</span><b class="num" style="font-size:24px">' + kr(total) + '</b></div>' +
      (isTyre && st.delivery === 'fit' ? '<button class="btn btn-ink btn-block" data-a="pdp-fit" data-v="' + id + '">' + t('pdp_buy_fit') + ic('arrow-right') + '</button>' : '<button class="btn btn-ink btn-block" data-a="pdp-cart">' + ic('shopping-bag') + t('pdp_buy') + '</button>') + '</div>' +
      '</div></div></main>' + footer();
  }

  // ---------- Min bil ----------
  function mine() {
    if (!S.user) {
      return header() + '<main class="wrap"><div class="card login"><span class="tile-ico" style="width:56px;height:56px;border-radius:16px">' + ic('car') + '</span><h1>' + t('login_title') + '</h1><p class="muted">' + t('login_sub') + '</p>' +
        '<button class="btn btn-vipps" data-a="login">' + t('login_vipps') + '</button><button class="btn bankid" data-a="login">' + t('login_bankid') + '</button><small class="muted">' + t('login_note') + '</small></div></main>' + footer();
    }
    const key = S.mineCar; const car = Object.assign({ key }, D.cars[key]); const g = D.garage[key];
    const euW = weeksTo(car.euDue);
    const b = S.booking && S.booking.car.key === key ? S.booking : null;
    const stat = (icon, label, value, sub, tag, meter) => '<div class="stat"><div class="top"><span class="tile-ico">' + ic(icon) + '</span>' + (tag || '') + '</div><div><small>' + label + '</small><b>' + value + '</b><div class="sub">' + sub + '</div></div>' + (meter || '') + '</div>';
    const euPct = Math.max(4, Math.min(100, 100 - (euW / 104) * 100));

    const upcoming = '<div class="panel"><div class="panel-h"><h2>' + t('up_title') + '</h2>' + (b ? '<span class="tag ' + (b.request ? 'tag-warn' : 'tag-ok') + '">' + ic(b.request ? 'clock' : 'circle-check') + (b.request ? t('request') : t('live')) + '</span>' : '') + '</div><div class="panel-b">' +
      (b ? '<div class="upcoming"><div class="date-tile"><small>' + fmt(DAYS[b.day], { month: 'short' }) + '</small><b>' + DAYS[b.day].getDate() + '</b></div><div style="flex:1;min-width:0"><b>' + whenText(b) + '</b><div class="muted" style="font-size:14px">' + esc(locById(b.loc).name) + ' · ' + b.items.map((i) => esc(L(svc(i).name))).join(', ') + '</div><div class="lbl muted" style="font-size:12px;font-weight:700;margin-top:4px">' + b.ref + ' · ' + totalTxt(b.tot) + '</div></div><button class="btn btn-ghost btn-sm" data-a="toast" data-v="' + esc(t('done_change')) + '">' + t('up_change') + '</button></div>'
        : '<div class="upcoming"><span class="tile-ico">' + ic('calendar') + '</span><div style="flex:1"><b>' + t('up_none') + '</b><div class="muted" style="font-size:14px">' + t('up_none_sub') + '</div></div><button class="btn btn-ink btn-sm" data-a="mine-book" data-v="service">' + t('nav_book') + '</button></div>') + '</div></div>';

    const recos = '<div class="panel"><div class="panel-h"><h2>' + t('reco_title') + '</h2></div><div class="panel-b">' + g.recos.map((r) =>
      '<div class="reco"><span class="dot" style="background:' + (r.level === 'warn' ? 'var(--warn)' : 'var(--ok)') + '"></span><div class="t"><b>' + esc(L(r.title)) + '</b><small>' + esc(L(r.text)) + '</small></div>' + (r.add ? '<button class="btn btn-ghost btn-sm" data-a="mine-add" data-v="' + r.add + '">' + ic('plus') + t('reco_book') + '</button>' : '') + '</div>').join('') + '</div></div>';

    let hotel;
    if (g.hotel) {
      const h = g.hotel; const pos = ['fl', 'fr', 'rl', 'rr'];
      hotel = '<div class="panel tyre-panel"><div class="tyre-photo" ' + bg(IMG.hotel) + '></div><div><div class="panel-h"><h2>' + t('hotel_title') + '</h2><span class="tag tag-mjos">' + ic('package') + esc(h.shelf) + '</span></div><div class="panel-b">' +
        '<div><b>' + esc(L(h.stored)) + '</b> · <span class="muted">' + esc(h.brand) + '</span><div class="muted" style="font-size:14px">' + t('hotel_stored', { loc: esc(locById(h.loc).name), shelf: esc(h.shelf) }) + '<br>' + t('hotel_on', { what: esc(L(h.on).toLowerCase()) }) + '</div></div>' +
        '<div><div class="lbl muted" style="font-size:12px;font-weight:700;margin-bottom:6px">' + t('hotel_tread') + '</div><div class="tread">' + h.tread.map((v, i) => '<div><small>' + t('tread_' + pos[i]) + '</small><b class="' + (v < 5.5 ? 'w' : '') + '">' + v.toLocaleString('nb-NO') + '</b></div>').join('') + '</div></div>' +
        '<div class="note warn">' + ic('snowflake') + '<span><b>' + t('hotel_swap') + '.</b> ' + t('season_text') + '</span></div>' +
        '<button class="btn btn-ink" data-a="mine-book" data-v="tyre">' + t('hotel_swap_cta') + ic('arrow-right') + '</button></div></div></div>';
    } else {
      hotel = '<div class="panel"><div class="panel-h"><h2>' + t('hotel_title') + '</h2></div><div class="panel-b"><div class="upcoming"><span class="tile-ico">' + ic('package') + '</span><div style="flex:1"><b>' + t('hotel_none') + '</b></div><button class="btn btn-ghost btn-sm" data-a="mine-book" data-v="tyre">' + t('hotel_none_cta') + '</button></div></div></div>';
    }

    const history = '<div class="panel"><div class="panel-h"><h2>' + t('hist_title') + '</h2></div><div class="panel-b"><div class="timeline">' + g.history.map((h) =>
      '<div class="tl"><i></i><div class="t"><small>' + dShort(h.date) + ' · ' + esc(locById(h.loc).name) + ' · ' + h.km.toLocaleString('nb-NO') + ' km</small><b>' + L(h.items).map(esc).join(', ') + '</b><div class="line"><span class="num" style="font-size:14px">' + kr(h.price) + '</span><button class="link" data-a="toast" data-v="' + esc(t('hist_opened')) + '">' + ic('receipt-text') + t('hist_receipt') + '</button>' + (h.doc ? '<button class="link" data-a="toast" data-v="' + esc(t('hist_opened')) + '">' + ic('file-text') + t('hist_doc') + '</button>' : '') + '</div></div></div>').join('') + '</div></div></div>';

    const quick = '<div class="quick">' + [['service', 'wrench', 'q_service'], ['issue', 'triangle-alert', 'q_issue'], ['tyre', 'circle-dot', 'q_tyre'], ['chat', 'message-square', 'q_chat']].map((q) => '<button data-a="' + (q[0] === 'chat' ? 'toast' : 'mine-book') + '" data-v="' + (q[0] === 'chat' ? esc(t('chat_toast')) : q[0]) + '"><span class="tile-ico">' + ic(q[1]) + '</span>' + t(q[2]) + '</button>').join('') + '</div>';

    return header() + '<main class="mine"><section class="mine-hero on-dark"><div class="wrap">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span class="hello">' + ic('user') + t('hi', { name: esc(S.user.name.split(' ')[0]) }) + '</span><button class="link" data-a="logout" style="color:var(--isbre)">' + ic('log-out') + t('logout') + '</button></div>' +
      '<div class="car-switch">' + D.garage.cars.map((k) => '<button class="chip ' + (k === key ? 'on' : '') + '" data-a="mine-car" data-v="' + k + '">' + esc(D.cars[k].plate) + ' · ' + esc(D.cars[k].make) + '</button>').join('') + '<button class="chip" data-a="nav" data-v="/bestill/bil">' + ic('plus') + t('add_car') + '</button></div>' +
      '<div style="display:flex;gap:16px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap"><div><span class="kicker">' + t('nav_mine') + '</span><h1 style="margin-top:8px">' + esc(carName(car)) + '</h1><div class="meta">' + car.year + ' · ' + t('car_' + car.fuel) + ' · ' + car.wheel + '" · ' + g.km.toLocaleString('nb-NO') + ' km</div></div>' + plateChip(car.plate, true) + '</div>' +
      '</div></section><div class="wrap" style="margin-top:20px"><div class="stat-grid">' +
      stat('clipboard-check', t('s_eu'), dShort(car.euDue), t('s_eu_left', { weeks: euW }), euW <= 12 ? '<span class="tag tag-warn">' + t('car_eu_soon') + '</span>' : '<span class="tag tag-ok">OK</span>', '<div class="meter' + (euW <= 12 ? ' warn' : '') + '"><i style="width:' + euPct + '%"></i></div>') +
      stat('wrench', t('s_service'), L(g.nextService.label), t('car_last_service') + ' ' + L(car.lastService), g.nextService.warn ? '<span class="tag tag-warn">!</span>' : '', '<div class="meter' + (g.nextService.warn ? ' warn' : '') + '"><i style="width:' + g.nextService.pct + '%"></i></div>') +
      stat('life-buoy', t('s_falck'), 'Falck 24/7', t('s_falck_until', { date: dShort(g.falck) }), '<span class="tag tag-ok">' + ic('circle-check') + '</span>') +
      stat('gauge', t('s_km'), g.km.toLocaleString('nb-NO') + ' km', t('s_km_sub')) +
      '</div></div>' +
      '<div class="wrap grid"><div class="col">' + upcoming + recos + hotel + '</div><div class="col">' + quick + history + '</div></div></main>' + footer();
  }

  // ---------- Render ----------
  const app = document.getElementById('app');
  let toastTimer;
  function toast(msg, icon) {
    clearTimeout(toastTimer);
    let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = ic(icon || 'circle-check') + '<span>' + esc(msg) + '</span>';
    toastTimer = setTimeout(() => el.remove(), 2200);
  }
  function render() {
    document.documentElement.lang = S.lang === 'no' ? 'nb' : 'en';
    const parts = route().split('/').filter(Boolean);
    const k = query().get('k'); if (k) S.cat = k;
    let html;
    if (parts[0] === 'bestill') html = booking(parts[1] || 'bil');
    else if (parts[0] === 'produkt') html = pdp(parts[1]);
    else if (parts[0] === 'min-bil') html = mine();
    else html = home();
    if (html) app.innerHTML = html;
    if (route() === '/' && location.hash.indexOf('#/#') === 0) { const el = document.getElementById(location.hash.slice(3)); if (el) el.scrollIntoView(); }
  }

  // ---------- Actions ----------
  function doLookup(plate, then) {
    S.plate = prettyPlate(plate); const c = lookup(plate); if (!c) return;
    if (!S.car || S.car.key !== c.key) S.items = S.items.filter((i) => i.custom);
    S.car = c; S.looking = true; render();
    setTimeout(() => { S.looking = false; if (then) then(); else render(); }, 650);
  }
  function afterCar() {
    if (S.after) { const a = S.after; S.after = null; go(a); return; }
    go('/bestill/behov');
  }
  function toggle(id, single) {
    const idx = S.items.findIndex((i) => i.id === id);
    if (idx >= 0) { S.items.splice(idx, 1); toast(t('toast_removed'), 'x'); return; }
    if (single) S.items = S.items.filter((i) => svc(i).cat !== single);
    S.items.push({ id }); toast(t('toast_added'));
  }
  function startFor(carKey, cat) {
    S.car = Object.assign({ key: carKey }, D.cars[carKey]); S.plate = S.car.plate; S.cat = cat;
    if (S.user && !S.contact.name) Object.assign(S.contact, { name: S.user.name, phone: '912 34 567', email: 'kari.nordmann@example.no' });
    go('/bestill/behov');
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a; const v = el.dataset.v;
    if (el.tagName === 'A' && a !== 'pick-city') e.preventDefault();
    switch (a) {
      case 'lang': S.lang = v; store.set('lang', v); render(); break;
      case 'nav': go(v); break;
      case 'hero-try': doLookup(v, () => go('/bestill/behov')); break;
      case 'home-cat': S.cat = v; go(S.car ? '/bestill/behov' : '/bestill/bil'); break;
      case 'home-ev': S.cat = 'service'; doLookup('EL 12345', afterCar); break;
      case 'eu-book': S.car = S.euCar; S.plate = S.euCar.plate; S.items = S.items.filter((i) => svc(i).cat !== 'eu'); S.items.push({ id: S.euCar.weight > 3500 ? 'pkk_heavy' : 'pkk' }); S.cat = 'eu'; go('/bestill/behov'); break;
      case 'pick-city': S.city = v; S.loc = v; break;
      case 'car-try': doLookup(v, afterCar); break;
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
      case 'attach': S.attached += 1; render(); break;
      case 'remove': { const it = S.items[+v]; S.items.splice(+v, 1); if (it && it.id === 'diag') S.symptoms = []; toast(t('toast_removed'), 'x'); render(); break; }
      case 'to-time': if (S.items.length) go('/bestill/tid'); break;
      case 'city': S.city = v; S.loc = null; S.slot = null; render(); break;
      case 'loc': S.loc = v; S.slot = null; render(); break;
      case 'day': S.day = +v; S.slot = null; render(); break;
      case 'slot': S.slot = v; render(); break;
      case 'handover': S.handover = v; render(); break;
      case 'to-you': if (S.slot) { if (S.user && !S.contact.name) Object.assign(S.contact, { name: S.user.name, phone: '912 34 567', email: 'kari.nordmann@example.no' }); go('/bestill/deg'); } break;
      case 'vipps': Object.assign(S.contact, { name: 'Kari Nordmann', phone: '912 34 567', email: 'kari.nordmann@example.no' }); S.err = ''; render(); break;
      case 'to-confirm': if (validContact()) { S.err = ''; go('/bestill/bekreft'); } else { S.err = t('f_required'); render(); } break;
      case 'submit': {
        const tot = totals();
        S.booking = { ref: 'MB-' + (48000 + Math.floor(Math.random() * 1900)), car: S.car, items: S.items.slice(), symptoms: S.symptoms.slice(), loc: S.loc, day: S.day, slot: S.slot, handover: S.handover, contact: Object.assign({}, S.contact), tot, request: tot.request };
        if (!S.user) S.user = { name: S.contact.name };
        if (D.garage[S.car.key]) S.mineCar = S.car.key;
        go('/bestill/ferdig'); break;
      }
      case 'done-mine': go('/min-bil'); break;
      case 'restart': Object.assign(S, { items: [], symptoms: [], issueText: '', attached: 0, slot: null, day: 0 }); go('/'); break;
      case 'toast': toast(v, 'info'); break;
      case 'login': S.user = { name: D.garage.owner }; render(); break;
      case 'logout': S.user = null; render(); break;
      case 'mine-car': S.mineCar = v; render(); break;
      case 'mine-book': startFor(S.mineCar, v); break;
      case 'mine-add': { startFor(S.mineCar, 'service'); if (!has(v)) S.items.push({ id: v }); toast(t('toast_added')); render(); break; }
      case 'pdp-try': S.pdp.car = lookup(v); if (!S.car) S.car = S.pdp.car; render(); break;
      case 'qty': S.pdp.qty = Math.max(1, Math.min(8, S.pdp.qty + +v)); render(); break;
      case 'pdp-del': S.pdp.delivery = v; render(); break;
      case 'pdp-cart': S.cart += S.pdp.qty; toast(t('pdp_added'), 'shopping-bag'); render(); break;
      case 'pdp-fit': {
        const p = D.products[v];
        if (S.pdp.car && (!S.car || S.car.key !== S.pdp.car.key)) { S.car = S.pdp.car; S.items = []; }
        S.items = S.items.filter((i) => !i.custom && svc(i).cat !== 'tyre');
        S.items.unshift({ id: 'shop_' + v, custom: true, cat: 'shop', name: { no: S.pdp.qty + ' × ' + p.brand + ' ' + p.name, en: S.pdp.qty + ' × ' + p.brand + ' ' + p.name }, price: p.price * S.pdp.qty, mins: 0, mode: 'live', example: true });
        S.items.push({ id: S.pdp.hotel ? 'hotel' : 'swap' });
        if (S.car) go('/bestill/tid'); else { S.after = '/bestill/tid'; go('/bestill/bil'); }
        break;
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form;
    if (kind === 'hero') doLookup(S.plate, () => go('/bestill/behov'));
    else if (kind === 'car') doLookup(S.plate, afterCar);
    else if (kind === 'eu') { S.euCar = lookup(S.euPlate); render(); }
    else if (kind === 'pdp') { S.pdp.car = lookup(S.pdp.plate); if (S.pdp.car && !S.car) S.car = S.pdp.car; render(); }
  });

  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.in; if (!k) return;
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k.indexOf('contact.') === 0) S.contact[k.slice(8)] = val;
    else if (k === 'pdp.hotel') { S.pdp.hotel = val; render(); }
    else if (k === 'pdpPlate') S.pdp.plate = val;
    else S[k] = val;
  });

  render();
})();
