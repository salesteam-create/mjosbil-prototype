(function () {
  const D = window.MB_DATA;
  const I = window.MB_I18N;

  // ---------- State ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mb_' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mb_' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const S = {
    lang: store.get('lang', 'no'),
    car: null, plate: '', looking: false, euPlate: '', euCar: null,
    presetIntent: null, after: null,
    items: [],                 // [{id}] or custom {id, custom:true, name, price, mins, mode}
    symptoms: [], issueText: '', attached: 0,
    city: 'gjovik', loc: null, day: 0, slot: null, handover: 'drop',
    contact: { name: '', phone: '', email: '', km: '', comment: '', sms: true }, err: '',
    ref: null, cart: 0,
    pdp: { qty: 4, delivery: 'fit', hotel: true, plate: '', car: null, looking: false },
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
  const fmtDate = (d, opts) => d.toLocaleDateString(locale(), opts);
  const dur = (m) => (m < 60 ? m + ' ' + t('mins') : Math.floor(m / 60) + ' ' + t('hours') + (m % 60 ? ' ' + (m % 60) + ' ' + t('mins') : ''));
  const normPlate = (p) => p.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prettyPlate = (p) => { const n = normPlate(p); return n.replace(/^([A-Z]{2})(\d+)$/, '$1 $2'); };

  function lookup(plate) {
    const key = normPlate(plate);
    if (key.length < 4) return null;
    const c = D.cars[key] || Object.assign({}, D.cars._default);
    return Object.assign({}, c, { plate: c.plate || prettyPlate(plate) });
  }
  const fuelName = (f) => t('car_' + f);
  const weeksTo = (iso) => Math.round((new Date(iso) - new Date()) / (7 * 864e5));
  const euSoon = (car) => weeksTo(car.euDue) <= 12;

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
  const totals = () => S.items.reduce((a, i) => { const s = svc(i); a.price += s.price || 0; a.mins += s.mins || 0; if (s.from) a.from = true; if (s.mode === 'request') a.request = true; if (s.quote) a.quote = true; return a; }, { price: 0, mins: 0, from: false, request: false, quote: false });

  function priceLabel(s) {
    if (s.quote) return '<span>' + t('price_quote') + '</span>';
    return (s.from ? '<small>' + t('from') + '</small>' : '') + kr(s.price) + (s.example ? '<small>' + t('example_price') + '</small>' : '') + (s.hotel ? '<small>' + t('tyre_season') + '</small>' : '');
  }

  // ---------- Icons ----------
  const P = {
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    tyre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    car: '<path d="M3 16v-3l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v3"/><path d="M3 13h18M3 16h18v2h-3M6 18H3"/><circle cx="7" cy="16.5" r="1.5"/><circle cx="17" cy="16.5" r="1.5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cart: '<path d="M3 4h2l2.2 11h10.6L20 7H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 6.5l3 3"/>',
    steer: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.8 10.5L10 12M14 12l6.2-1.5M12 14v6.5"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l7-7"/>',
    phone: '<path d="M5 3.5h4l1.5 4.5-2.5 1.5a11 11 0 0 0 6.5 6.5l1.5-2.5 4.5 1.5v4A2 2 0 0 1 18.5 21 15.5 15.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  };
  const ic = (n, s) => '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';

  const INTENTS = [
    { id: 'service', icon: 'wrench' }, { id: 'eu', icon: 'shield' }, { id: 'tyre', icon: 'tyre' },
    { id: 'issue', icon: 'alert' }, { id: 'other', icon: 'dots' },
  ];

  // ---------- Router ----------
  const route = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = h; };
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  // ---------- Shared chrome ----------
  function header() {
    return '<div class="ribbon">' + t('proto_note') + '</div>' +
      '<header class="hdr"><div class="wrap">' +
      '<a class="logo" href="#/" aria-label="Mjøsbil"><span class="logo-mark">' + ic('car', 16).replace('stroke="currentColor"', 'stroke="#fff"') + '</span>MJØSBIL</a>' +
      '<nav class="nav"><a href="#/bestill/bil?i=service">' + t('nav_workshop') + '</a><a href="#/bestill/bil?i=tyre">' + t('nav_tyres') + '</a><a href="#/#shop">' + t('nav_shop') + '</a><a href="#/#locs">' + t('nav_locations') + '</a></nav>' +
      '<div class="hdr-right">' +
      '<div class="lang" role="group" aria-label="Language"><button data-a="lang" data-v="no" aria-pressed="' + (S.lang === 'no') + '">NO</button><button data-a="lang" data-v="en" aria-pressed="' + (S.lang === 'en') + '">EN</button></div>' +
      '<button class="icon-btn" aria-label="Cart">' + ic('cart', 22) + (S.cart ? '<span class="badge-dot">' + S.cart + '</span>' : '') + '</button>' +
      '<a class="btn btn-primary btn-sm" href="#/bestill/bil">' + t('nav_book') + '</a>' +
      '</div></div></header>';
  }
  const footer = () => '<footer class="footer"><div class="wrap"><b style="color:var(--ink)">Mjøsbil AS</b><span>BilXtra verksted · Fagdekk · BilXtra butikk</span><span>' + t('proto_note') + '</span></div></footer>';

  function plateInput(name, val, ph) {
    return '<label class="plate"><span class="plate-eu"><span class="stars"></span>N</span><span class="sr">Reg.nr</span>' +
      '<input data-in="' + name + '" value="' + esc(val) + '" placeholder="' + (ph || t('plate_placeholder')) + '" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" inputmode="text"></label>';
  }
  const tryPlates = (action) => '<div class="try">' + t('hero_try') + ' ' + ['EL 12345', 'DN 54321', 'BR 11223'].map((p) => '<button data-a="' + action + '" data-v="' + p + '"><span class="plate-chip">' + p + '</span></button>').join('') + '</div>';

  // ---------- Illustrations ----------
  const heroCar = '<svg class="hero-car" viewBox="0 0 520 220" fill="none" aria-hidden="true">' +
    '<defs><linearGradient id="hc" x1="0" x2="1"><stop offset="0" stop-color="#00a9c2" stop-opacity=".9"/><stop offset="1" stop-color="#8fdbe6" stop-opacity=".5"/></linearGradient></defs>' +
    '<ellipse cx="260" cy="196" rx="230" ry="12" fill="#000" opacity=".35"/>' +
    '<path d="M40 160c0-22 10-34 34-40l58-14c26-26 62-46 120-46h62c40 0 76 18 104 44l46 8c22 4 32 18 32 38v14H40z" fill="#13252f" stroke="url(#hc)" stroke-width="2.5"/>' +
    '<path d="M150 104c22-20 52-32 96-32h58c30 0 58 12 80 32z" fill="#0d1820" stroke="#2c4654" stroke-width="2"/>' +
    '<path d="M262 72v32" stroke="#2c4654" stroke-width="2"/>' +
    '<path d="M60 140h40M430 132h34" stroke="#8fdbe6" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="130" cy="170" r="30" fill="#0d1820" stroke="#3b5563" stroke-width="3"/><circle cx="130" cy="170" r="13" fill="#2c4654"/>' +
    '<circle cx="396" cy="170" r="30" fill="#0d1820" stroke="#3b5563" stroke-width="3"/><circle cx="396" cy="170" r="13" fill="#2c4654"/>' +
    '<path d="M0 196h520" stroke="#2c4654" stroke-dasharray="4 8"/></svg>';
  const tyreArt = (size, dark) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="' + (dark || '#1d2a33') + '"/>' +
    Array.from({ length: 24 }, (_, i) => { const a = (i * 15) * Math.PI / 180; return '<rect x="96" y="6" width="8" height="18" rx="2" fill="#0d1820" transform="rotate(' + (i * 15) + ' 100 100)"/>'; }).join('') +
    '<circle cx="100" cy="100" r="56" fill="#c9d1d6"/><circle cx="100" cy="100" r="46" fill="#e8ecef"/>' +
    Array.from({ length: 5 }, (_, i) => '<rect x="95" y="58" width="10" height="34" rx="5" fill="#b5bfc5" transform="rotate(' + (i * 72) + ' 100 100)"/>').join('') +
    '<circle cx="100" cy="100" r="12" fill="#8d999f"/></svg>';
  const canArt = (size, c) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 200 200" aria-hidden="true"><rect x="52" y="40" width="96" height="140" rx="14" fill="' + c + '"/><rect x="70" y="22" width="34" height="22" rx="4" fill="#c9a227"/><rect x="62" y="84" width="76" height="52" rx="6" fill="#fff" opacity=".9"/><rect x="72" y="96" width="56" height="8" rx="4" fill="' + c + '"/><rect x="72" y="112" width="36" height="6" rx="3" fill="#9aa5ab"/></svg>';
  const boxArt = (size, c) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 200 200" aria-hidden="true"><rect x="40" y="50" width="120" height="110" rx="14" fill="' + c + '"/><rect x="58" y="70" width="84" height="56" rx="8" fill="#ff8a3d" opacity=".85"/><path d="M66 140h68" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".6"/></svg>';
  const productArt = (id, size) => { const p = D.products[id]; return p.fitting === 'swap' ? tyreArt(size, p.color) : id === 'oil' ? canArt(size, p.color) : boxArt(size, p.color); };

  // ---------- Home ----------
  function home() {
    const euRes = S.euCar ? (() => {
      const w = weeksTo(S.euCar.euDue);
      const d = fmtDate(new Date(S.euCar.euDue), { day: 'numeric', month: 'long', year: 'numeric' });
      return '<div class="eu-result ' + (w > 12 ? 'ok' : '') + '">' + ic(w > 12 ? 'check' : 'alert') + '<span><b>' + esc(S.euCar.make + ' ' + S.euCar.model) + '</b> · ' + t('eu_due_in', { date: d }) + '</span><button class="btn btn-primary btn-sm" data-a="eu-book" style="margin-left:auto">' + t('nav_book') + '</button></div>';
    })() : '';
    return header() +
      '<section class="hero"><div class="wrap"><div>' +
      '<div class="kicker">' + t('hero_kicker') + '</div><h1>' + t('hero_title') + '</h1><p class="sub">' + t('hero_sub') + '</p>' +
      '<form class="plate-row" data-form="hero">' + plateInput('plate', S.plate) + '<button class="btn btn-teal" type="submit">' + t('hero_cta') + ' ' + ic('right', 18) + '</button></form>' +
      tryPlates('hero-try') +
      '<div class="usps"><span>' + ic('check', 16) + t('usp_price') + '</span><span>' + ic('bolt', 16) + t('usp_ev') + '</span><span>' + ic('shield', 16) + t('usp_falck') + '</span></div>' +
      '</div><div>' + heroCar + '</div></div></section>' +

      '<section class="section"><div class="wrap"><div class="section-h"><h2>' + t('intent_title') + '</h2></div><div class="intents">' +
      INTENTS.map((i) => '<button class="intent" data-a="home-intent" data-v="' + i.id + '"><span class="ico">' + ic(i.icon, 22) + '</span><span><b>' + t('i_' + i.id) + '</b><span>' + t('i_' + i.id + '_sub') + '</span></span></button>').join('') +
      '</div></div></section>' +

      '<section class="section" style="padding-top:0"><div class="wrap split">' +
      '<div class="promo promo-winter"><span class="kicker">' + t('season_kicker') + '</span><h3>' + t('season_title') + '</h3><p class="muted">' + t('season_text') + '</p><button class="btn btn-primary" data-a="home-intent" data-v="tyre">' + t('season_cta') + '</button><div class="promo-art" style="opacity:.18">' + tyreArt(220) + '</div></div>' +
      '<div class="promo promo-ev"><span class="kicker">' + ic('bolt', 14) + ' ' + t('ev_kicker') + '</span><h3>' + t('ev_title') + '</h3><p>' + t('ev_text') + '</p><button class="btn btn-light" data-a="home-ev">' + t('ev_cta') + '</button></div>' +
      '</div></section>' +

      '<section class="section" style="padding-top:0"><div class="wrap"><div class="eu-check"><div><h3 style="font-size:22px">' + t('eu_check_title') + '</h3><p class="muted" style="margin-top:6px">' + t('eu_check_text') + '</p></div>' +
      '<form class="plate-row" data-form="eu">' + plateInput('euPlate', S.euPlate) + '<button class="btn btn-primary" type="submit">' + t('eu_check_cta') + '</button></form>' + euRes + '</div></div></section>' +

      '<section class="section" id="shop" style="padding-top:0"><div class="wrap"><div class="section-h"><div><h2>' + t('shop_title') + '</h2><p class="muted">' + t('shop_sub') + '</p></div><a class="link" href="#/produkt/hakka10">' + t('shop_all') + ' →</a></div><div class="products">' +
      Object.keys(D.products).map((id) => { const p = D.products[id]; return '<a class="pcard" href="#/produkt/' + id + '"><div class="pimg">' + productArt(id, 130) + '</div><div class="pbody"><span class="brand">' + esc(p.brand) + '</span><span class="name">' + esc(p.name) + '</span><span class="muted" style="font-size:13px">' + esc(p.spec) + '</span><span class="price">' + kr(p.price) + ' <span class="muted" style="font-weight:500;font-size:13px">' + L(p.unit) + '</span></span>' + (p.fitting ? '<span class="tag tag-teal">' + ic('wrench', 12) + t('shop_fit') + '</span>' : '') + '</div></a>'; }).join('') +
      '</div></div></section>' +

      '<section class="section" id="locs" style="padding-top:0"><div class="wrap"><div class="section-h"><div><h2>' + t('loc_title') + '</h2><p class="muted">' + t('loc_sub') + '</p></div></div><div class="locs">' +
      D.locations.map((l) => '<div class="loc-row"><span class="pin">' + ic('pin') + '</span><div><b>' + esc(l.name) + '</b><div class="meta">' + t('first_free') + ': ' + firstFreeLabel(l) + '</div></div><a class="btn btn-ghost btn-sm" href="#/bestill/bil" data-a="pick-city" data-v="' + l.id + '">' + t('nav_book') + '</a></div>').join('') +
      '</div></div></section>' + footer();
  }

  // ---------- Availability (mock, deterministic) ----------
  const SLOT_TIMES = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '12:00', '12:30', '13:00', '13:30', '14:00'];
  function workdays(n) {
    const out = []; const d = new Date(); d.setHours(12, 0, 0, 0);
    while (out.length < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d)); }
    return out;
  }
  const DAYS = workdays(12);
  function slotsFor(loc, dayIdx) {
    const r = (loc.seed * 31 + dayIdx * 17) % 11;
    if (r === 0 && dayIdx < 3) return SLOT_TIMES.map(() => false); // a fully booked day
    return SLOT_TIMES.map((_, i) => ((loc.seed + i * 7 + dayIdx * 5) % 10) > (dayIdx < 2 ? 6 : 3));
  }
  function firstFree(loc) {
    for (let d = 0; d < DAYS.length; d++) { const s = slotsFor(loc, d); const i = s.indexOf(true); if (i >= 0) return { d, time: SLOT_TIMES[i] }; }
    return null;
  }
  function dayLabel(i) {
    if (i === 0 && (DAYS[0] - new Date()) < 2 * 864e5) return t('tomorrow');
    return fmtDate(DAYS[i], { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const firstFreeLabel = (loc) => { const f = firstFree(loc); return f ? dayLabel(f.d) + ' ' + f.time : '–'; };

  // ---------- Booking ----------
  const STEPS = ['bil', 'behov', 'tid', 'deg', 'bekreft'];
  const STEP_LBL = { bil: 'step_car', behov: 'step_need', tid: 'step_time', deg: 'step_you', bekreft: 'step_confirm' };
  function stepper(cur) {
    const ci = STEPS.indexOf(cur);
    return '<div class="stepper" aria-label="Progress">' + STEPS.map((s, i) => '<div class="s ' + (i < ci ? 'past' : i === ci ? 'on' : '') + '"><div class="bar"></div><span class="lbl">' + t(STEP_LBL[s]) + '</span></div>').join('') + '</div>';
  }

  function carCard(compact) {
    const c = S.car; if (!c) return '';
    const due = fmtDate(new Date(c.euDue), { day: 'numeric', month: 'short', year: 'numeric' });
    return '<div class="card car-card"><div class="car-top"><div class="car-ico">' + ic(c.fuel === 'ev' ? 'bolt' : 'car', 26) + '</div><div style="flex:1;min-width:0"><span class="plate-chip">' + esc(c.plate) + '</span><div class="car-name" style="margin-top:6px">' + esc(c.make + ' ' + c.model) + '</div><div class="muted" style="font-size:14px">' + c.year + ' · ' + fuelName(c.fuel) + ' · ' + c.weight.toLocaleString('nb-NO') + ' kg</div></div>' +
      (compact ? '<button class="link" data-a="car-reset">' + t('car_not_you') + '</button>' : '') + '</div>' +
      (compact ? '' : '<div class="car-facts"><div class="fact"><small>' + t('car_eu') + '</small><b>' + due + '</b>' + (euSoon(c) ? ' <span class="tag tag-amber">' + t('car_eu_soon') + '</span>' : '') + '</div><div class="fact"><small>' + t('car_last_service') + '</small><b>' + L(c.lastService) + '</b></div><div class="fact"><small>' + t('car_wheels') + '</small><b>' + c.wheel + '"</b></div></div>') +
      '</div>';
  }

  function stepCar() {
    const found = S.car && !S.looking;
    return '<div class="step-h"><h1>' + t('car_title') + '</h1><p class="muted">' + t('car_sub') + '</p></div>' +
      (found ? '<div class="stack"><div class="note">' + ic('check') + '<span><b>' + t('car_found') + '</b></span></div>' + carCard(false) + '<div><button class="link" data-a="car-reset">' + t('car_not_you') + '</button></div></div>'
        : '<form class="plate-row" data-form="car">' + plateInput('plate', S.plate) + '<button class="btn btn-primary" type="submit">' + t('car_lookup') + '</button></form>' + (S.looking ? '<div class="lookup-anim"></div>' : tryPlates('car-try')));
  }

  function stepNeed() {
    const counts = {};
    S.items.forEach((i) => { const c = svc(i).cat; const k = c === 'addon' ? null : c; if (k) counts[k] = (counts[k] || 0) + 1; });
    const nudges = [];
    if (S.car && euSoon(S.car)) nudges.push('<div class="note amber">' + ic('alert') + '<span>' + t('eu_due_text', { date: fmtDate(new Date(S.car.euDue), { day: 'numeric', month: 'long' }) }) + ' ' + t('eu_due_soon_text', { weeks: weeksTo(S.car.euDue) }) + '</span></div>');
    return '<div class="step-h"><h1>' + (S.items.length ? t('more_title') : t('need_title')) + '</h1><p class="muted">' + t('need_sub') + '</p></div>' +
      '<div class="stack">' + carCard(true) + nudges.join('') +
      '<div class="grid-intents">' + INTENTS.map((i) => '<button class="intent ' + (counts[i.id] ? 'selected' : '') + '" data-a="intent" data-v="' + i.id + '"><span class="ico">' + ic(i.icon, 22) + '</span><span><b>' + t('i_' + i.id) + '</b><span>' + t('i_' + i.id + '_sub') + '</span></span>' + (counts[i.id] ? '<span class="tag tag-dark count">' + ic('check', 12) + counts[i.id] + '</span>' : '') + '</button>').join('') + '</div></div>';
  }

  function optCard(id, recommended, single) {
    const s = svc({ id }); const on = has(id);
    const incl = L(s.incl);
    return '<button class="opt ' + (on ? 'on' : '') + '" data-a="toggle" data-v="' + id + '" data-single="' + (single ? s.cat : '') + '" aria-pressed="' + on + '">' +
      '<div class="opt-top"><span class="opt-check">' + (on ? ic('check', 16) : '') + '</span><span class="opt-title">' + esc(L(s.name)) + '</span><span class="opt-price">' + priceLabel(s) + '</span></div>' +
      '<div class="opt-desc">' + esc(L(s.desc)) + '</div>' +
      '<div class="opt-meta">' + (recommended ? '<span class="tag tag-teal">' + ic('star', 12) + t('recommended') + '</span>' : '') + '<span class="tag">' + ic('clock', 12) + dur(s.mins) + '</span>' + (s.mode === 'live' ? '<span class="tag tag-green">' + ic('cal', 12) + t('live') + '</span>' : '<span class="tag tag-amber">' + ic('phone', 12) + t('request') + '</span>') + '</div>' +
      (on && incl ? '<div class="opt-incl">' + incl.map((x) => '<div>' + ic('check', 14) + '<span>' + esc(x) + '</span></div>').join('') + '</div>' : '') +
      '</button>';
  }

  function addonList(mainIds) {
    const ids = [];
    mainIds.forEach((m) => (D.addons[m] || []).forEach((a) => { if (ids.indexOf(a) < 0 && mainIds.indexOf(a) < 0 && fitsCar(D.services[a])) ids.push(a); }));
    if (!ids.length) return '';
    return '<div class="sub-h">' + t('addons_title') + '</div><div class="addons">' + ids.slice(0, 3).map((id) => {
      const s = svc({ id }); const on = has(id);
      return '<button class="addon ' + (on ? 'on' : '') + '" data-a="toggle" data-v="' + id + '"><span class="t"><b>' + esc(L(s.name)) + '</b><span>' + esc(L(s.desc)) + '</span></span><span class="p">+ ' + (s.from ? t('from') + ' ' : '') + kr(s.price) + '</span><span class="btn btn-sm ' + (on ? 'btn-primary' : 'btn-ghost') + '">' + (on ? ic('check', 14) : ic('plus', 14)) + '</span></button>';
    }).join('') + '</div>';
  }

  function stepIntent(cat) {
    const c = S.car;
    let body = '';
    const head = '<button class="back-btn" data-a="nav" data-v="/bestill/behov">' + ic('back', 16) + t('back') + '</button>' +
      '<div class="step-h"><h1>' + t('i_' + cat) + '</h1><p class="muted">' + t('need_for', { car: esc(c.make + ' ' + c.model) }) + '</p></div>';
    const pick = (ids, rec, single) => ids.filter((id) => fitsCar(D.services[id])).map((id) => optCard(id, id === rec, single)).join('');
    const selMain = (ids) => ids.filter(has);

    if (cat === 'service') {
      const ids = c.fuel === 'ev' ? ['ev_eco_brk', 'ev_eco', 'maker'] : ['maker', 'eco20', 'oil'];
      const rec = c.fuel === 'ev' ? 'ev_eco_brk' : (c.year < 2020 ? 'eco20' : 'maker');
      body = '<div class="opts">' + pick(ids, rec, true) + '</div>' + addonList(selMain(ids));
    } else if (cat === 'eu') {
      const ids = ['pkk', 'pkk_heavy', 'recheck'];
      const due = fmtDate(new Date(c.euDue), { day: 'numeric', month: 'long', year: 'numeric' });
      body = '<div class="note ' + (euSoon(c) ? 'amber' : '') + '">' + ic('cal') + '<span>' + t('eu_due_text', { date: due }) + (euSoon(c) ? ' ' + t('eu_due_soon_text', { weeks: weeksTo(c.euDue) }) : '') + '</span></div>' +
        '<div class="opts">' + pick(ids, c.weight > 3500 ? 'pkk_heavy' : 'pkk', true) + '</div>' + addonList(selMain(ids));
    } else if (cat === 'tyre') {
      const ids = ['hotel', 'swap'];
      body = '<div class="note">' + ic('tyre') + '<span>' + t('tyre_size', { inch: c.wheel }) + '. ' + t('tyre_hotel_note') + '</span></div>' +
        '<div class="opts">' + pick(ids, 'hotel', true) + '</div>' + addonList(selMain(ids)) +
        '<div class="card" style="padding:16px;display:flex;gap:12px;align-items:center"><div style="flex:1"><b>' + t('tyre_new') + '</b></div><a class="btn btn-ghost btn-sm" href="#/produkt/' + (c.wheel <= 16 ? 'hakka10' : 'hakka10') + '">' + t('tyre_new_cta') + '</a></div>';
    } else if (cat === 'issue') {
      const syms = D.symptoms.filter((s) => !s.fuel || s.fuel.indexOf(c.fuel) >= 0);
      const sugg = S.symptoms.map((id) => (D.symptoms.find((x) => x.id === id) || {}).suggest).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      body = '<div class="sub-h" style="margin-top:0">' + t('issue_title') + '</div><p class="muted" style="margin-top:-8px">' + t('issue_sub') + '</p>' +
        '<div class="symptoms">' + syms.map((s) => '<button class="sym ' + (S.symptoms.indexOf(s.id) >= 0 ? 'on' : '') + '" data-a="sym" data-v="' + s.id + '"><span class="ico">' + ic(s.icon) + '</span>' + esc(L(s.name)) + '</button>').join('') + '</div>' +
        (S.symptoms.length ? '<div class="field"><label for="issue">' + t('issue_desc') + '</label><textarea id="issue" data-in="issueText" placeholder="' + esc(t('issue_desc_ph')) + '">' + esc(S.issueText) + '</textarea></div>' +
          '<button class="attach" data-a="attach">' + ic('camera') + '<span>' + t('issue_attach') + (S.attached ? ' · <b>' + S.attached + ' ' + t('issue_attached') + '</b>' : '') + '</span></button>' +
          '<div class="opts">' + optCard('diag', true, false) + '</div>' +
          '<div class="note">' + ic('phone') + '<span>' + t('issue_promise') + '</span></div>' +
          (sugg.length ? '<div class="sub-h">' + t('issue_suggest') + '</div><div class="opts">' + sugg.map((id) => optCard(id, false, false)).join('') + '</div>' : '') : '');
    } else if (cat === 'other') {
      body = '<div class="opts">' + pick(['ac', 'align', 'flush', 'rv'], c.weight > 3500 ? 'rv' : null, false) + '</div>';
    }
    return head + '<div class="stack">' + body + '</div>';
  }

  function unavailableAt(loc) { return S.items.map((i) => i.id).filter((id) => loc.no.indexOf(id) >= 0); }

  function stepTime() {
    const locs = D.locations.slice().sort((a, b) => a.km[S.city] - b.km[S.city]);
    if (!S.loc || unavailableAt(D.locations.find((l) => l.id === S.loc)).length) {
      const first = locs.find((l) => !unavailableAt(l).length); S.loc = first ? first.id : null; S.slot = null;
    }
    const loc = D.locations.find((l) => l.id === S.loc);
    const tot = totals();
    const canWait = tot.mins <= 90;
    if (!canWait && S.handover === 'wait') S.handover = 'drop';
    const slots = loc ? slotsFor(loc, S.day) : [];
    return '<div class="step-h"><h1>' + t('time_title') + '</h1><p class="muted">' + t('time_sub') + '</p></div><div class="stack">' +
      '<div><div class="muted" style="font-size:13px;margin-bottom:8px">' + ic('pin', 14).replace('<svg', '<svg style="display:inline;vertical-align:-2px"') + ' ' + t('near_pick') + '</div><div class="loc-pick">' +
      D.locations.map((l) => '<button class="chip ' + (S.city === l.id ? 'on' : '') + '" data-a="city" data-v="' + l.id + '">' + esc(l.area === 'Hunndalen' ? 'Gjøvik' : l.area) + '</button>').join('') + '</div></div>' +
      '<div class="loc-list">' + locs.map((l) => {
        const no = unavailableAt(l); const ff = firstFree(l);
        return '<button class="loc ' + (S.loc === l.id ? 'on' : '') + '" data-a="loc" data-v="' + l.id + '" ' + (no.length ? 'disabled' : '') + '><span class="radio"></span><span class="t"><b>' + esc(l.name) + '</b><span>' + (no.length ? t('cant_do', { service: esc(L(svc({ id: no[0] }).name).toLowerCase()) }) : l.km[S.city] + ' ' + t('km') + ' · ' + esc(l.area)) + '</span></span>' +
          (no.length || !ff ? '' : '<span class="first">' + t('first_free') + '<b>' + dayLabel(ff.d) + ' ' + ff.time + '</b></span>') + '</button>';
      }).join('') + '</div>' +
      (loc ? '<div class="sub-h">' + t('pick_day') + '</div><div class="days">' + DAYS.map((d, i) => {
        const free = slotsFor(loc, i).filter(Boolean).length;
        return '<button class="day ' + (S.day === i ? 'on' : '') + (free ? '' : ' full') + '" data-a="day" data-v="' + i + '"><small>' + fmtDate(d, { weekday: 'short' }) + '</small><b>' + d.getDate() + '</b><span class="dots">' + (free ? free + ' ' + (S.lang === 'no' ? 'ledige' : 'free') : t('no_slots')) + '</span></button>';
      }).join('') + '</div>' +
        '<div class="sub-h">' + t('pick_time') + '</div>' + (slots.some(Boolean) ? '<div class="slots">' + SLOT_TIMES.map((tm, i) => '<button class="slot ' + (S.slot === tm ? 'on' : '') + '" data-a="slot" data-v="' + tm + '" ' + (slots[i] ? '' : 'disabled') + '>' + tm + '</button>').join('') + '</div>' : '<p class="muted">' + t('no_slots') + '</p>') +
        (tot.request ? '<div class="note amber">' + ic('info') + '<span>' + t('req_note') + '</span></div>' : '') +
        '<div class="sub-h">' + t('handover') + '</div><div class="radios">' +
        '<button class="radio-row ' + (S.handover === 'drop' ? 'on' : '') + '" data-a="handover" data-v="drop"><span class="radio"></span><span><b>' + t('h_drop') + '</b><span>' + t('h_drop_sub') + '</span></span></button>' +
        '<button class="radio-row ' + (S.handover === 'wait' ? 'on' : '') + '" data-a="handover" data-v="wait" ' + (canWait ? '' : 'disabled') + '><span class="radio"></span><span><b>' + t('h_wait') + '</b><span>' + (canWait ? t('h_wait_sub') : t('h_wait_long')) + '</span></span></button>' +
        '</div>' : '') + '</div>';
  }

  function stepYou() {
    const c = S.contact;
    const f = (k, type, ph, mode) => '<div class="field"><label for="f_' + k + '">' + t('f_' + k) + '</label><input class="input" id="f_' + k + '" type="' + type + '" data-in="contact.' + k + '" value="' + esc(c[k]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + (mode ? ' inputmode="' + mode + '"' : '') + '></div>';
    return '<div class="step-h"><h1>' + t('you_title') + '</h1><p class="muted">' + t('you_sub') + '</p></div><div class="form">' +
      '<button class="btn vipps btn-block" data-a="vipps">' + t('vipps') + '</button><div class="divider">' + t('or_manual') + '</div>' +
      f('name', 'text', '', '') + f('phone', 'tel', '', 'tel') + f('email', 'email', '', 'email') + f('km', 'text', '', 'numeric') +
      '<div class="field"><label for="f_comment">' + t('f_comment') + '</label><textarea id="f_comment" data-in="contact.comment">' + esc(c.comment) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" data-in="contact.sms" ' + (c.sms ? 'checked' : '') + '>' + t('f_sms') + '</label>' +
      (S.err ? '<div class="err">' + S.err + '</div>' : '') + '</div>';
  }

  function whenText() {
    if (!S.slot) return '';
    return fmtDate(DAYS[S.day], { weekday: 'long', day: 'numeric', month: 'long' }) + ' ' + S.slot;
  }
  function stepConfirm() {
    const loc = D.locations.find((l) => l.id === S.loc);
    const row = (icon, label, val, step) => '<div class="review-row"><span class="ico">' + ic(icon) + '</span><div class="t"><small>' + label + '</small>' + val + '</div>' + (step ? '<button class="link" data-a="nav" data-v="/bestill/' + step + '">' + t('edit') + '</button>' : '') + '</div>';
    return '<div class="step-h"><h1>' + t('confirm_title') + '</h1><p class="muted">' + t('confirm_sub') + '</p></div>' +
      '<div class="card review">' +
      row('car', t('step_car'), esc(S.car.make + ' ' + S.car.model) + ' · <span class="plate-chip">' + esc(S.car.plate) + '</span>', 'bil') +
      row('wrench', t('step_need'), S.items.map((i) => esc(L(svc(i).name))).join('<br>'), 'behov') +
      row('pin', t('step_time'), esc(loc.name) + '<br>' + whenText() + '<br><span class="muted">' + (S.handover === 'wait' ? t('h_wait') : t('h_drop')) + '</span>', 'tid') +
      row('user', t('step_you'), esc(S.contact.name) + '<br>' + esc(S.contact.phone) + ' · ' + esc(S.contact.email), 'deg') +
      '</div>';
  }

  function summaryInner(primary) {
    const tot = totals();
    const loc = S.loc && D.locations.find((l) => l.id === S.loc);
    return '<div class="card sum-card"><h3>' + t('sum_title') + '</h3>' +
      (S.car ? '<div style="display:flex;gap:8px;align-items:center;font-size:14px"><span class="plate-chip">' + esc(S.car.plate) + '</span><span class="muted">' + esc(S.car.make + ' ' + S.car.model) + '</span></div>' : '') +
      '<div class="sum-items">' + (S.items.length ? S.items.map((i, idx) => { const s = svc(i); return '<div class="sum-item"><span class="n">' + esc(L(s.name)) + '</span><b>' + (s.quote ? '–' : (s.from ? t('from') + ' ' : '') + kr(s.price)) + '</b><button class="x" data-a="remove" data-v="' + idx + '" aria-label="' + t('remove') + '">' + ic('x', 14) + '</button></div>'; }).join('') : '<span class="muted" style="font-size:14px">' + t('sum_empty') + '</span>') + '</div>' +
      (S.items.length ? '<div class="sum-meta">' + '<div>' + ic('clock', 16) + t('sum_time') + ': ' + dur(tot.mins) + '</div>' + (loc ? '<div>' + ic('pin', 16) + esc(loc.name) + '</div>' : '') + (S.slot ? '<div>' + ic('cal', 16) + whenText() + '</div>' : '') + '</div>' +
        '<div class="sum-tot"><span>' + t('sum_total') + '<br><span class="muted" style="font-size:12px">' + t('sum_vat') + '</span></span><b>' + (tot.from ? '<span style="font-size:14px;font-weight:500">' + t('from') + ' </span>' : '') + kr(tot.price) + '</b></div>' : '') +
      primary + '</div>';
  }

  function primaryFor(step) {
    const tot = totals();
    if (step === 'behov' || step === 'intent') return { label: t('next'), ok: S.items.length > 0, a: 'to-time' };
    if (step === 'tid') return { label: t('next'), ok: !!(S.loc && S.slot), a: 'to-you' };
    if (step === 'deg') return { label: t('next'), ok: true, a: 'to-confirm' };
    if (step === 'bekreft') return { label: tot.request ? t('request_cta') : t('book_cta'), ok: true, a: 'submit' };
    return null;
  }

  function booking(sub, extra) {
    if (!S.car && sub !== 'bil') { go('/bestill/bil'); return ''; }
    if (sub === 'ferdig') return header() + doneView() + footer();
    if ((sub === 'tid' || sub === 'deg' || sub === 'bekreft') && !S.items.length) { go('/bestill/behov'); return ''; }
    if ((sub === 'deg' || sub === 'bekreft') && !S.slot) { go('/bestill/tid'); return ''; }
    if (sub === 'bekreft' && !validContact()) { go('/bestill/deg'); return ''; }
    const stepKey = sub === 'behov' && extra ? 'intent' : sub;
    let body = '';
    if (sub === 'bil') body = stepCar();
    else if (sub === 'behov') body = extra ? stepIntent(extra) : stepNeed();
    else if (sub === 'tid') body = stepTime();
    else if (sub === 'deg') body = stepYou();
    else if (sub === 'bekreft') body = stepConfirm();

    let primary = null;
    if (sub === 'bil' && S.car && !S.looking) primary = { label: t('continue'), ok: true, a: 'to-need' };
    else primary = primaryFor(stepKey);
    const pBtn = primary ? '<button class="btn btn-primary btn-block" data-a="' + primary.a + '" ' + (primary.ok ? '' : 'disabled') + '>' + primary.label + '</button>' : '';
    const showSide = sub !== 'bil';
    const tot = totals();
    const mbar = primary ? '<div class="mbar ' + (showSide ? 'has-side' : '') + '"><div class="tot">' + (S.items.length ? '<small>' + S.items.length + ' × · ' + dur(tot.mins) + '</small><b>' + (tot.from ? '<span style="font-size:13px;font-weight:500">' + t('from') + ' </span>' : '') + kr(tot.price) + '</b>' : (S.car ? '<small>' + esc(S.car.plate) + '</small><b style="font-size:15px">' + esc(S.car.make + ' ' + S.car.model) + '</b>' : '')) + '</div><button class="btn btn-primary" data-a="' + primary.a + '" ' + (primary.ok ? '' : 'disabled') + '>' + primary.label + '</button></div>' : '';
    const backTo = { behov: '/bestill/bil', tid: '/bestill/behov', deg: '/bestill/tid', bekreft: '/bestill/deg' }[sub];
    return header() + '<main class="book"><div class="wrap"><div class="main">' + stepper(sub) +
      (backTo && !(sub === 'behov' && extra) ? '<button class="back-btn" data-a="nav" data-v="' + backTo + '">' + ic('back', 16) + t('back') + '</button>' : '') +
      body + '</div>' + (showSide ? '<aside class="summary">' + summaryInner(pBtn) + '</aside>' : '') + '</div></main>' + mbar;
  }

  function validContact() { const c = S.contact; return c.name.trim() && c.phone.trim() && /\S+@\S+/.test(c.email); }

  function doneView() {
    if (!S.ref) { go('/'); return ''; }
    const loc = D.locations.find((l) => l.id === S.loc);
    const tot = totals();
    const first = esc(S.contact.name.split(' ')[0]);
    const bring = [t('bring_key')];
    if (S.items.some((i) => i.id === 'swap' || i.id === 'hotel')) bring.unshift(t('bring_wheels'));
    if (S.car.fuel === 'ev' && S.symptoms.indexOf('charge') >= 0) bring.push(t('bring_charge'));
    return '<main class="book"><div class="wrap" style="display:block"><div class="done">' +
      '<div class="done-ico">' + ic('check', 36) + '</div><h1>' + (tot.request ? t('done_title_req', { name: first }) : t('done_title', { name: first })) + '</h1><p class="muted">' + (tot.request ? t('done_sub_req') : t('done_sub')) + '</p>' +
      '<div><small class="muted">' + t('done_ref') + '</small><div class="ref">' + S.ref + '</div></div>' +
      '<div class="card review done-card">' +
      '<div class="review-row"><span class="ico">' + ic('cal') + '</span><div class="t"><small>' + t('step_time') + '</small><b>' + whenText() + '</b><br>' + esc(loc.name) + ' · ' + esc(loc.addr) + '</div></div>' +
      '<div class="review-row"><span class="ico">' + ic('wrench') + '</span><div class="t"><small>' + t('step_need') + '</small>' + S.items.map((i) => esc(L(svc(i).name))).join('<br>') + '<br><b>' + t('sum_total') + ': ' + (tot.from ? t('from') + ' ' : '') + kr(tot.price) + '</b></div></div>' +
      '<div class="review-row"><span class="ico">' + ic('info') + '</span><div class="t"><small>' + t('done_bring') + '</small>' + bring.map(esc).join('<br>') + '</div></div>' +
      '</div>' +
      '<div class="done-actions"><button class="btn btn-ghost" data-a="toast" data-v="' + esc(t('done_cal')) + ' ✓">' + ic('cal', 18) + t('done_cal') + '</button><button class="btn btn-primary" data-a="restart">' + t('done_home') + '</button></div>' +
      '<p class="muted" style="font-size:14px">' + t('done_change') + '</p>' +
      '</div></div></main>';
  }

  // ---------- Product page ----------
  function pdp(id) {
    const p = D.products[id] || D.products.hakka10;
    const st = S.pdp; const car = st.car || S.car;
    const isTyre = p.fitting === 'swap';
    let fitRes = '';
    if (car && isTyre) {
      fitRes = car.wheel === p.fitsInch
        ? '<div class="fit-res ok">' + ic('check') + t('pdp_fits', { car: esc(car.make + ' ' + car.model) }) + '</div>'
        : '<div class="fit-res no">' + ic('alert') + t('pdp_no_fit', { car: esc(car.make + ' ' + car.model), inch: car.wheel }) + '</div>';
    }
    const fitPrice = isTyre ? D.wheelPrice(p.fitsInch) : 0;
    const total = p.price * st.qty + (isTyre && st.delivery === 'fit' ? fitPrice + (st.hotel ? D.hotelPrice(p.fitsInch) : 0) : 0);
    const radio = (v, title, sub, extra) => '<button class="radio-row ' + (st.delivery === v ? 'on' : '') + '" data-a="pdp-del" data-v="' + v + '"><span class="radio"></span><span style="flex:1"><b>' + title + '</b><span>' + sub + '</span></span>' + (extra ? '<b style="font-size:14px">' + extra + '</b>' : '') + '</button>';
    return header() + '<main class="pdp"><div class="wrap">' +
      '<nav class="crumbs"><a href="#/">Mjøsbil</a>/<a href="#/#shop">' + t('nav_shop') + '</a>/<span>' + L(p.cat) + '</span></nav>' +
      '<div class="pdp-img">' + productArt(id, 300) + '</div>' +
      '<div class="pdp-info"><div><div class="muted" style="font-weight:600;text-transform:uppercase;font-size:13px;letter-spacing:.04em">' + esc(p.brand) + '</div><h1>' + esc(p.name) + '</h1><div class="muted">' + esc(p.spec) + ' · ' + L(p.cat) + '</div></div>' +
      '<div class="pdp-price">' + kr(p.price) + ' <small>' + L(p.unit) + (p.example ? ' · ' + t('example_price') : '') + '</small></div>' +
      '<div class="bullets">' + L(p.bullets).map((b) => '<div>' + ic('check', 16) + '<span>' + esc(b) + '</span></div>').join('') + '</div>' +
      (isTyre ? '<div class="card fit-box"><b>' + t('pdp_fit_check') + '</b>' + (car ? fitRes : '<form class="plate-row" data-form="pdp">' + plateInput('pdpPlate', st.plate) + '<button class="btn btn-primary" type="submit">' + t('car_lookup') + '</button></form>' + tryPlates('pdp-try')) + '</div>' : '') +
      '<div style="display:flex;align-items:center;gap:12px"><span class="muted">' + t('pdp_qty') + '</span><div class="qty"><button data-a="qty" data-v="-1" aria-label="-">' + ic('minus', 18) + '</button><span>' + st.qty + '</span><button data-a="qty" data-v="1" aria-label="+">' + ic('plus', 18) + '</button></div></div>' +
      (isTyre ? '<div class="sub-h">' + t('pdp_delivery') + '</div><div class="radios">' +
        radio('fit', t('pdp_fit'), t('pdp_fit_sub') + ' · ' + t('first_free') + ' ' + firstFreeLabel(D.locations[0]), '+ ' + kr(fitPrice)) +
        radio('pickup', t('pdp_pickup'), t('pdp_pickup_sub')) + radio('ship', t('pdp_ship'), t('pdp_ship_sub')) + '</div>' +
        (st.delivery === 'fit' ? '<label class="check"><input type="checkbox" data-in="pdp.hotel" ' + (st.hotel ? 'checked' : '') + '>' + t('pdp_hotel') + ' (+ ' + kr(D.hotelPrice(p.fitsInch)) + ' ' + t('tyre_season') + ')</label>' : '') : '') +
      '<div class="card" style="padding:16px;display:grid;gap:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span>' + t('pdp_total') + '</span><b style="font-size:22px">' + kr(total) + '</b></div>' +
      (isTyre && st.delivery === 'fit' ? '<button class="btn btn-primary btn-block" data-a="pdp-fit" data-v="' + id + '">' + t('pdp_buy_fit') + ' ' + ic('right', 18) + '</button>' : '<button class="btn btn-primary btn-block" data-a="pdp-cart">' + t('pdp_buy') + '</button>') + '</div>' +
      '</div></div></main>' + footer();
  }

  // ---------- Render ----------
  const app = document.getElementById('app');
  let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer);
    let el = document.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; toastTimer = setTimeout(() => el.remove(), 2200);
  }
  function render() {
    document.documentElement.lang = S.lang === 'no' ? 'nb' : 'en';
    const r = route();
    const parts = r.split('/').filter(Boolean);
    const q = new URLSearchParams((location.hash.split('?')[1]) || '');
    if (q.get('i') && parts[0] === 'bestill') { S.presetIntent = q.get('i'); }
    let html = '';
    if (parts[0] === 'bestill') html = booking(parts[1] || 'bil', parts[2]);
    else if (parts[0] === 'produkt') html = pdp(parts[1]);
    else html = home();
    if (html) app.innerHTML = html;
    if (r === '/' && location.hash.indexOf('#/#') === 0) { const el = document.getElementById(location.hash.slice(3)); if (el) el.scrollIntoView(); }
  }

  // ---------- Actions ----------
  function doLookup(plate, then) {
    S.plate = prettyPlate(plate); S.looking = true; S.car = lookup(plate);
    if (!S.car) { S.looking = false; render(); return; }
    render();
    setTimeout(() => { S.looking = false; if (then) then(); else render(); }, 650);
  }
  function afterCar() {
    if (S.after) { const a = S.after; S.after = null; go(a); return; }
    if (S.presetIntent) { const i = S.presetIntent; S.presetIntent = null; go('/bestill/behov/' + i); return; }
    go('/bestill/behov');
  }
  function toggle(id, single) {
    const idx = S.items.findIndex((i) => i.id === id);
    if (idx >= 0) { S.items.splice(idx, 1); return; }
    if (single) S.items = S.items.filter((i) => { const s = svc(i); return s.cat !== single; });
    S.items.push({ id });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a; const v = el.dataset.v;
    if (el.tagName === 'A' && a !== 'pick-city') e.preventDefault();
    switch (a) {
      case 'lang': S.lang = v; store.set('lang', v); render(); break;
      case 'nav': go(v); break;
      case 'hero-try': S.plate = v; doLookup(v, () => go('/bestill/behov')); break;
      case 'home-intent': S.presetIntent = v; if (S.car) { S.presetIntent = null; go('/bestill/behov/' + v); } else go('/bestill/bil'); break;
      case 'home-ev': S.presetIntent = 'service'; S.plate = 'EL 12345'; doLookup('EL 12345', () => afterCar()); break;
      case 'eu-book': S.car = S.euCar; S.plate = S.euCar.plate; S.items = S.items.filter((i) => svc(i).cat !== 'eu'); S.items.push({ id: S.euCar.weight > 3500 ? 'pkk_heavy' : 'pkk' }); go('/bestill/behov/eu'); break;
      case 'pick-city': S.city = v; S.loc = v; break;
      case 'car-try': doLookup(v, afterCar); break;
      case 'car-reset': S.car = null; S.plate = ''; S.items = S.items.filter((i) => i.custom); go('/bestill/bil'); break;
      case 'to-need': afterCar(); break;
      case 'intent': go('/bestill/behov/' + v); break;
      case 'toggle': toggle(v, el.dataset.single); render(); break;
      case 'sym': {
        const i = S.symptoms.indexOf(v); if (i >= 0) S.symptoms.splice(i, 1); else S.symptoms.push(v);
        if (S.symptoms.length && !has('diag')) S.items.push({ id: 'diag' });
        if (!S.symptoms.length) S.items = S.items.filter((x) => x.id !== 'diag');
        render(); break;
      }
      case 'attach': S.attached += 1; render(); break;
      case 'remove': {
        const it = S.items[+v]; S.items.splice(+v, 1);
        if (it && it.id === 'diag') S.symptoms = [];
        render(); break;
      }
      case 'to-time': if (S.items.length) go('/bestill/tid'); break;
      case 'city': S.city = v; S.loc = null; S.slot = null; render(); break;
      case 'loc': S.loc = v; S.slot = null; render(); break;
      case 'day': S.day = +v; S.slot = null; render(); break;
      case 'slot': S.slot = v; render(); break;
      case 'handover': S.handover = v; render(); break;
      case 'to-you': if (S.slot) go('/bestill/deg'); break;
      case 'vipps': Object.assign(S.contact, { name: 'Kari Nordmann', phone: '912 34 567', email: 'kari.nordmann@example.no' }); S.err = ''; render(); break;
      case 'to-confirm': if (validContact()) { S.err = ''; go('/bestill/bekreft'); } else { S.err = t('f_required'); render(); } break;
      case 'submit': S.ref = 'MJ-' + (24000 + Math.floor(Math.random() * 9000)); go('/bestill/ferdig'); break;
      case 'restart': Object.assign(S, { items: [], symptoms: [], issueText: '', attached: 0, slot: null, ref: null, day: 0 }); go('/'); break;
      case 'toast': toast(v); break;
      case 'pdp-try': S.pdp.car = lookup(v); if (!S.car) S.car = S.pdp.car; render(); break;
      case 'qty': S.pdp.qty = Math.max(1, Math.min(8, S.pdp.qty + +v)); render(); break;
      case 'pdp-del': S.pdp.delivery = v; render(); break;
      case 'pdp-cart': S.cart += S.pdp.qty; toast(t('pdp_added')); render(); break;
      case 'pdp-fit': {
        const p = D.products[v];
        S.items = S.items.filter((i) => !i.custom && svc(i).cat !== 'tyre');
        S.items.unshift({ id: 'shop_' + v, custom: true, cat: 'shop', name: { no: S.pdp.qty + ' × ' + p.brand + ' ' + p.name, en: S.pdp.qty + ' × ' + p.brand + ' ' + p.name }, price: p.price * S.pdp.qty, mins: 0, mode: 'live' });
        S.items.push({ id: S.pdp.hotel ? 'hotel' : 'swap' });
        if (S.pdp.car && !S.car) S.car = S.pdp.car;
        if (S.car) go('/bestill/tid'); else { S.after = '/bestill/tid'; go('/bestill/bil'); }
        break;
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form;
    if (kind === 'hero') { if (normPlate(S.plate).length >= 4) doLookup(S.plate, () => go('/bestill/behov')); }
    else if (kind === 'car') { if (normPlate(S.plate).length >= 4) doLookup(S.plate, afterCar); }
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
