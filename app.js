/* Runway – javni del aplikacije (feed, košarica, naročilo) */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(String(u || ''), location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* ---------- jezik (SL privzeto, EN) ---------- */
const EN = {
'Zapri':'Close','Zvok':'Sound','Priljubljeno':'Favourite','V košarico':'Add to cart','Deli':'Share','Razprodano':'Sold out','Brez naziva':'Untitled',
'Modelka':'Model','Šifra':'SKU','Dodaj v košarico':'Add to cart','Vse':'All','♥ Priljubljeno':'♥ Favourites','Nimaš priljubljenih':'No favourites yet',
'Še ni vsebine':'Nothing here yet','Tapni srček pri izdelku, ki ti je všeč.':'Tap the heart on a product you like.','V tej rubriki še ni izdelkov.':'No products in this section yet.',
'Ni izdelkov':'No products','Odpri <b>Admin</b> (ikona zgoraj desno), dodaj podjetje in naloži slike modelk.':'Open <b>Admin</b> (icon top right), add a company and upload photos.',
'Povezava kopirana':'Link copied','Znamke':'Brands','Vse znamke':'All brands','Spletna stran':'Website','Ogled kolekcije':'View collection',
'Dodano v košarico':'Added to cart','Izdelek je razprodan':'This product is sold out','Izberi velikost':'Choose a size','Količina':'Quantity','Košarica':'Cart',
'Košarica je prazna.':'Your cart is empty.','vel.':'size','Odstrani':'Remove','Skupaj':'Total','Nadaljuj na naročilo':'Continue to checkout','Naročilo':'Order',
'Naročanje še ni nastavljeno (v adminu vpiši e-pošto za naročila).':'Ordering is not set up yet.','Naročanje še ni nastavljeno.':'Ordering is not set up yet.',
'Ime in priimek':'Full name','E-pošta':'Email','Telefon':'Phone','Naslov (ulica in hišna št.)':'Address (street and number)','Poštna št.':'Postal code','Kraj':'City',
'Država':'Country','Opomba':'Note','Slovenija':'Slovenia','Strinjam se, da se moji podatki uporabijo za obdelavo naročila.':'I agree that my data is used to process the order.',
'Pošlji naročilo':'Place order','Nazaj v košarico':'Back to cart','Izpolni vsa obvezna polja.':'Please fill in all required fields.','Vpiši veljaven e-naslov.':'Enter a valid email.',
'Potrdi soglasje za obdelavo podatkov.':'Please confirm your consent.','Pošiljam…':'Sending…','Hvala za naročilo!':'Thank you for your order!','Št. naročila':'Order no.',
'Potrdilo bo prispelo na':'Confirmation will be sent to','Nadaljuj z ogledom':'Continue browsing','Pošiljanje ni uspelo':'Sending failed','Odpri v e-pošti':'Open in email',
'strežnik je vrnil napako':'server returned an error','kos':'pcs','naslednji izdelek':'next product','druga znamka':'another brand','Prejšnja znamka':'Previous brand',
'Naslednja znamka':'Next brand','Prejšnji izdelek':'Previous product','Naslednji izdelek':'Next product','Podjetja':'Companies','Modna revija v žepu':'Fashion show in your pocket',
'Vse starosti':'All ages','Oblačila':'Clothing','Kozmetika':'Cosmetics','Kozmetični pripomočki':'Beauty tools','Nakit za ženske':'Jewelry for women',
'Mlajša dekleta':'Younger girls','Srednja leta':'Middle-aged women','Starejše ženske':'Older women',
'Obleka':'Dresses','Zgornji deli':'Tops','Hlače':'Trousers','Krila':'Skirts','Jakne in plašči':'Jackets & coats','Kompleti':'Sets','Športna oblačila':'Sportswear','Kopalke':'Swimwear','Dodatki':'Accessories','Obutev':'Footwear',
'Nega obraza':'Face care','Ličila':'Makeup','Nega las':'Hair care','Nega telesa':'Body care','Dišave':'Fragrances','Nega nohtov':'Nail care',
'Čopiči in gobice':'Brushes & sponges','Pincete in škarjice':'Tweezers & scissors','Ogledala':'Mirrors','Sušilniki in likalniki za lase':'Hair dryers & stylers','Torbice za kozmetiko':'Makeup bags','Pripomočki za nego kože':'Skincare tools',
'Ogrlice':'Necklaces','Uhani':'Earrings','Zapestnice':'Bracelets','Prstani':'Rings','Broške':'Brooches','Kompleti nakita':'Jewelry sets','Ure':'Watches',
'Spremeni jezik':'Change language','Video':'Video'
};
let LANG = LS.get('fa_lang', 'sl') === 'en' ? 'en' : 'sl';
const t = s => (LANG === 'en' && EN[s] !== undefined) ? EN[s] : s;
const L = (o, k) => (LANG === 'en' && o && o[k + 'En']) ? o[k + 'En'] : ((o && o[k]) || '');
const plural = n => LANG === 'en' ? `${n} ${n === 1 ? 'product' : 'products'}` : `${n} ${n % 100 === 1 ? 'izdelek' : n % 100 === 2 ? 'izdelka' : (n % 100 === 3 || n % 100 === 4) ? 'izdelki' : 'izdelkov'}`;
const TAX = {
  sections: [
    { id: 'clothes', name: 'Oblačila', ages: true, cats: ['Obleka', 'Zgornji deli', 'Hlače', 'Krila', 'Jakne in plašči', 'Kompleti', 'Športna oblačila', 'Kopalke', 'Dodatki', 'Obutev'] },
    { id: 'cosmetics', name: 'Kozmetika', cats: ['Nega obraza', 'Ličila', 'Nega las', 'Nega telesa', 'Dišave', 'Nega nohtov'] },
    { id: 'tools', name: 'Kozmetični pripomočki', cats: ['Čopiči in gobice', 'Pincete in škarjice', 'Ogledala', 'Sušilniki in likalniki za lase', 'Torbice za kozmetiko', 'Pripomočki za nego kože'] },
    { id: 'jewelry', name: 'Nakit za ženske', cats: ['Ogrlice', 'Uhani', 'Zapestnice', 'Prstani', 'Broške', 'Kompleti nakita', 'Ure'] }
  ],
  ages: [{ id: 'young', name: 'Mlajša dekleta' }, { id: 'middle', name: 'Srednja leta' }, { id: 'senior', name: 'Starejše ženske' }]
};
const secOf = i => (i && i.section) || 'clothes';

/* ---------- ikone ---------- */
const I = p => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ic = {
  heart: I('<path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.6 3.7 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.3 0 5.4 3.1 4.2 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>'),
  bag: I('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  share: I('<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  trash: I('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  up: I('<path d="M6 14l6-6 6 6"/>'),
  down: I('<path d="M6 10l6 6 6-6"/>'),
  eye: I('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: I('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  mute: I('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  sound: I('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/>'),
  upload: I('<path d="M12 16V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
  play: I('<path d="M7 4l13 8-13 8V4z"/>')
};

/* ---------- stanje ---------- */
const DEF = { siteName: 'Moda danes', siteNameEn: 'Fashion Today', tagline: 'Modna revija v žepu', taglineEn: '', orderEmail: '', currency: 'EUR', showPrices: true, ordersEnabled: true, orderNote: '', orderNoteEn: '' };
const FA = window.FA = {
  data: { settings: { ...DEF }, companies: [], items: [] },
  channel: 'all', section: 'all', age: 'all', t, L, TAX, secOf,
  get lang() { return LANG; },
  list: [],
  favs: new Set(LS.get('fa_favs', [])),
  cart: LS.get('fa_cart', []),
  admin: { active: false },
  $, $$, esc, safeUrl, LS, ic
};

FA.getSections = () => (FA.data.sections && FA.data.sections.length) ? FA.data.sections : JSON.parse(JSON.stringify(TAX.sections));
FA.secName = x => LANG === 'en' && x.nameEn ? x.nameEn : t(x.name || '');
const secHasAges = id => { const x = FA.getSections().find(y => y.id === id); return !!(x && x.ages); };
FA.secHasAges = secHasAges;
FA.setData = j => {
  j = j && typeof j === 'object' ? j : {};
  FA.data = {
    settings: (() => { const x = { ...DEF, ...(j.settings || {}) }; if (!x.siteName || x.siteName === 'Runway' || x.siteName === 'Modna pista') x.siteName = 'Moda danes'; return x; })(),
    companies: Array.isArray(j.companies) ? j.companies : [],
    items: Array.isArray(j.items) ? j.items : [],
    sections: Array.isArray(j.sections) ? j.sections : [],
    updatedAt: j.updatedAt
  };
};

FA.money = n => {
  if (n === '' || n == null || isNaN(n)) return '';
  const cur = FA.data.settings.currency || 'EUR';
  try { return new Intl.NumberFormat(LANG === 'en' ? 'en-GB' : 'sl-SI', { style: 'currency', currency: cur }).format(+n); }
  catch { return (+n).toFixed(2) + ' ' + cur; }
};

FA.ytParse = u => {
  u = String(u || '').trim(); if (!u) return null;
  const idRe = /^[\w-]{11}$/;
  if (idRe.test(u)) return { id: u, short: false };
  try {
    const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u);
    const h = x.hostname.replace(/^www\.|^m\./, '');
    const p = x.pathname.split('/').filter(Boolean);
    if (h === 'youtu.be') return idRe.test(p[0] || '') ? { id: p[0], short: false } : null;
    if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
      if (p[0] === 'shorts' && idRe.test(p[1] || '')) return { id: p[1], short: true };
      if (['embed', 'live', 'v'].includes(p[0]) && idRe.test(p[1] || '')) return { id: p[1], short: false };
      const v = x.searchParams.get('v'); if (idRe.test(v || '')) return { id: v, short: false };
    }
  } catch {}
  return null;
};

FA.toast = (msg, ms = 2600) => {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms);
};

/* ---------- sheet (spodnji list / modalno okno) ---------- */
FA.openSheet = ({ title = '', html = '', cls = '', onMount, onClose } = {}) => {
  FA.closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="backdrop"></div><div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div><div class="sheet-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="${t('Zapri')}">${ic.close}</button></div><div class="sheet-b">${html}</div></div>`;
  root.classList.add('open');
  const sheet = $('.sheet', root);
  $('.backdrop', root).onclick = () => FA.closeSheet();
  $('[data-close]', root).onclick = () => FA.closeSheet();
  FA._sheetClose = onClose;
  let y0 = null, dy = 0;
  [$('.grab', sheet), $('.sheet-h', sheet)].forEach(el => {
    el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
    el.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    el.addEventListener('touchend', () => { if (y0 == null) return; sheet.style.transition = ''; if (dy > 110) FA.closeSheet(); else sheet.style.transform = ''; y0 = null; });
  });
  if (onMount) onMount(sheet);
  return sheet;
};
FA.closeSheet = silent => {
  const root = $('#sheet-root');
  if (!root.classList.contains('open')) return;
  root.classList.remove('open'); root.innerHTML = '';
  const f = FA._sheetClose; FA._sheetClose = null;
  if (!silent && f) f();
};

/* ---------- nalaganje podatkov ---------- */
async function loadData() {
  try {
    const r = await fetch('data/data.json?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    FA.setData(await r.json());
  } catch { FA.setData({}); }
}

/* ---------- kanali (znamke) in seznam lookov ---------- */
const cmapGet = () => new Map(FA.data.companies.map(c => [c.id, c]));
const activeCompanyIds = () => new Set(FA.data.companies.filter(c => c.active !== false).map(c => c.id));

const secOk = i => FA.section === 'all' || secOf(i) === FA.section;
const ageOk = i => FA.age === 'all' || !secHasAges(secOf(i)) || !(i.ages && i.ages.length) || i.ages.includes(FA.age);
const catName = (c, sid) => {
  const x = FA.getSections().find(y => y.id === (sid || 'clothes'));
  const k = x && Array.isArray(x.cats) ? x.cats.indexOf(c) : -1;
  return LANG === 'en' && k >= 0 && x.catsEn && x.catsEn[k] ? x.catsEn[k] : t(c || '');
};
function visibleItems() {
  const act = activeCompanyIds();
  let it = FA.data.items.filter(i => i.active !== false && act.has(i.companyId) && secOk(i) && ageOk(i));
  if (FA.channel === 'fav') it = it.filter(i => FA.favs.has(i.id));
  else if (FA.channel !== 'all') it = it.filter(i => i.companyId === FA.channel);
  return it;
}
function channels() {
  const act = activeCompanyIds();
  const withItems = new Set(FA.data.items.filter(i => i.active !== false && act.has(i.companyId) && secOk(i) && ageOk(i)).map(i => i.companyId));
  const arr = [{ id: 'all', name: t('Vse') }, ...FA.data.companies.filter(c => withItems.has(c.id)).map(c => ({ id: c.id, name: c.name }))];
  if (FA.favs.size) arr.push({ id: 'fav', name: t('♥ Priljubljeno') });
  return arr;
}

FA.renderTabs = () => {
  const chs = channels();
  if (!chs.some(c => c.id === FA.channel)) FA.channel = 'all';
  const tabs = $('#tabs');
  tabs.innerHTML = chs.map(c => `<button class="tab ${c.id === FA.channel ? 'on' : ''}" data-ch="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  const on = $('.tab.on', tabs);
  if (on) tabs.scrollTo({ left: on.offsetLeft - tabs.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' });
};

FA.renderFilters = () => {
  const act = activeCompanyIds();
  const have = new Set(FA.data.items.filter(i => i.active !== false && act.has(i.companyId)).map(secOf));
  if (have.size === 1) FA.section = [...have][0]; else if (FA.section !== 'all' && !have.has(FA.section)) FA.section = 'all';
  if (!secHasAges(FA.section)) FA.age = 'all';
  const sn = $('#sections'), an = $('#ages');
  const chip = (attr, id, name, on) => `<button class="tab sm ${on ? 'on' : ''}" ${attr}="${id}">${esc(t(name))}</button>`;
  sn.hidden = have.size < 2;
  sn.innerHTML = have.size < 2 ? '' : chip('data-sec', 'all', 'Vse', FA.section === 'all') + FA.getSections().filter(x => have.has(x.id)).map(x => chip('data-sec', x.id, FA.secName(x), FA.section === x.id)).join('');
  an.hidden = !secHasAges(FA.section);
  an.innerHTML = !secHasAges(FA.section) ? '' : chip('data-age', 'all', 'Vse starosti', FA.age === 'all') + TAX.ages.map(x => chip('data-age', x.id, x.name, FA.age === x.id)).join('');
};

/* ---------- feed ---------- */
let loadIO, activeIO, cmap = new Map();

function slideHtml(it) {
  const c = cmap.get(it.companyId) || {};
  const vid = it.type === 'video';
  const yt = vid ? FA.ytParse(it.videoUrl) : null;
  const img = vid ? (yt ? `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg` : '') : safeUrl(it.imageUrl);
  const fy = Math.min(100, Math.max(0, Number.isFinite(+it.focusY) ? +it.focusY : 50));
  const s = FA.data.settings;
  const hasPrice = s.showPrices !== false && it.price !== '' && it.price != null && !isNaN(it.price);
  const price = hasPrice ? FA.money(it.price) : '';
  const old = hasPrice && it.oldPrice && !isNaN(it.oldPrice) ? FA.money(it.oldPrice) : '';
  const sold = it.inStock === false;
  const fav = FA.favs.has(it.id);
  const logo = safeUrl(c.logo);
  let media;
  if (vid) {
    const vert = it.vertical !== false;
    media = `<img class="photo blur" data-src="${esc(img)}" alt="" draggable="false">` +
      (yt ? `<div class="yt ${vert ? 'v' : 'h'}" data-yt="${yt.id}"></div><div class="vtap" data-act="vplay"></div><button class="vsound" data-act="vsound" aria-label="${t('Zvok')}">${ic.mute}</button>` : '');
  } else if (it.fit === 'contain') {
    media = `<img class="photo blur" data-src="${esc(img)}" alt="" draggable="false"><img class="photo contain" data-src="${esc(img)}" alt="${esc(L(it, 'title'))}" style="object-position:50% ${fy}%" draggable="false">`;
  } else {
    media = `<img class="photo" data-src="${esc(img)}" alt="${esc(L(it, 'title'))}" style="object-position:50% ${fy}%" draggable="false">`;
  }
  const sizes = Array.isArray(it.sizes) && it.sizes.length ? `<div class="sizes">${it.sizes.map(z => `<span>${esc(z)}</span>`).join('')}</div>` : '';
  const meta = [it.model ? `${t('Modelka')}: ${esc(it.model)}` : '', it.category ? esc(catName(it.category, it.section)) : ''].filter(Boolean).join(' · ');
  const canOrder = s.ordersEnabled !== false;
  return `<section class="slide" data-id="${esc(it.id)}">
    ${media}
    <div class="shade"></div>
    <aside class="rail">
      <button class="avatar" data-act="brand" data-co="${esc(it.companyId)}" aria-label="${esc(c.name || '')}" ${logo ? `style="background-image:url('${esc(logo)}')"` : ''}>${logo ? '' : esc((c.name || '?').charAt(0).toUpperCase())}</button>
      <button class="icon-btn fav ${fav ? 'on' : ''}" data-act="fav" aria-label="${t('Priljubljeno')}">${ic.heart}</button>
      ${canOrder ? `<button class="icon-btn" data-act="add" aria-label="${t('V košarico')}">${ic.bag}</button>` : ''}
      <button class="icon-btn" data-act="share" aria-label="${t('Deli')}">${ic.share}</button>
    </aside>
    <div class="caption">
      <button class="brand-chip" data-act="brand" data-co="${esc(it.companyId)}"><span class="mini" ${logo ? `style="background-image:url('${esc(logo)}')"` : ''}>${logo ? '' : esc((c.name || '?').charAt(0).toUpperCase())}</span>${esc(c.name || '')}</button>
      <h3 class="title">${esc(L(it, 'title') || t('Brez naziva'))}${sold ? `<span class="sold">${t('Razprodano')}</span>` : ''}</h3>
      <div class="meta">${price ? `<span class="price">${esc(price)}</span>` : ''}${old ? `<s class="old">${esc(old)}</s>` : ''}${it.sku ? `<span class="sku">${t('Šifra')}: ${esc(it.sku)}</span>` : ''}</div>
      ${L(it, 'description') ? `<p class="desc" data-act="desc">${esc(L(it, 'description'))}</p>` : ''}
      ${meta ? `<div class="sub">${meta}</div>` : ''}
      ${sizes}
      ${canOrder ? `<button class="cta" data-act="add" ${sold ? 'disabled' : ''}>${sold ? t('Razprodano') : t('Dodaj v košarico')}</button>` : ''}
    </div>
  </section>`;
}

FA.renderFeed = () => {
  const feed = $('#feed');
  cmap = cmapGet();
  const list = FA.list = visibleItems();
  if (loadIO) loadIO.disconnect();
  if (activeIO) activeIO.disconnect();
  if (!list.length) {
    const filt = FA.section !== 'all' || FA.age !== 'all';
    feed.innerHTML = `<div class="empty"><h2>${FA.channel === 'fav' ? t('Nimaš priljubljenih') : filt ? t('Ni izdelkov') : t('Še ni vsebine')}</h2><p>${FA.channel === 'fav' ? t('Tapni srček pri izdelku, ki ti je všeč.') : filt ? t('V tej rubriki še ni izdelkov.') : t('Odpri <b>Admin</b> (ikona zgoraj desno), dodaj podjetje in naloži slike modelk.')}</p></div>`;
    $('#counter').textContent = '';
    return;
  }
  feed.innerHTML = list.map(slideHtml).join('');
  const slides = $$('.slide', feed);
  loadIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    $$('img[data-src]', e.target).forEach(im => { im.src = im.dataset.src; im.removeAttribute('data-src'); });
    loadIO.unobserve(e.target);
  }), { root: feed, rootMargin: '250% 0px' });
  activeIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) setActive(e.target); else unmountVideo(e.target);
  }), { root: feed, threshold: 0.6 });
  slides.forEach(s => { loadIO.observe(s); activeIO.observe(s); });
  feed.scrollTop = 0;
};

function setActive(slide) {
  const idx = $$('.slide', $('#feed')).indexOf(slide);
  $('#counter').textContent = `${idx + 1} / ${FA.list.length}`;
  FA.activeId = slide.dataset.id;
  const img = $('img.photo', slide);
  const src = img && (img.src || img.dataset.src);
  if (src) $('#bg').style.backgroundImage = `url('${src}')`;
  mountVideo(slide);
}

function mountVideo(slide) {
  const box = $('.yt', slide);
  if (!box || box.firstElementChild) return;
  const id = box.dataset.yt;
  const f = document.createElement('iframe');
  const origin = /^https?:/.test(location.protocol) ? `&origin=${encodeURIComponent(location.origin)}` : '';
  f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1${origin}`;
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.title = 'Video';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  box.appendChild(f);
  slide.dataset.muted = '1'; slide.dataset.playing = '1';
  const b = $('.vsound', slide); if (b) b.innerHTML = ic.mute;
}
function unmountVideo(slide) { const box = $('.yt', slide); if (box) box.innerHTML = ''; }
function ytCmd(slide, func, args = []) {
  const f = $('iframe', slide);
  if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}

/* ---------- dogodki v feedu ---------- */
function bindFeed() {
  const feed = $('#feed');

  feed.addEventListener('load', e => { const t = e.target; if (t.classList && t.classList.contains('photo')) { t.classList.add('ld'); t.closest('.slide').classList.add('ready'); } }, true);
  feed.addEventListener('error', e => { const t = e.target; if (t.classList && t.classList.contains('photo')) { t.closest('.slide').classList.add('bad', 'ready'); } }, true);

  feed.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const slide = el.closest('.slide'); const id = slide && slide.dataset.id;
    const it = id && FA.data.items.find(i => i.id === id);
    switch (el.dataset.act) {
      case 'fav': toggleFav(id, el); break;
      case 'add': if (it) FA.addFlow(it); break;
      case 'share': if (it) share(it); break;
      case 'brand': openBrand(el.dataset.co); break;
      case 'desc': el.classList.toggle('open'); break;
      case 'vplay': {
        const playing = slide.dataset.playing === '1';
        ytCmd(slide, playing ? 'pauseVideo' : 'playVideo'); slide.dataset.playing = playing ? '0' : '1'; break;
      }
      case 'vsound': {
        const m = slide.dataset.muted === '1';
        ytCmd(slide, m ? 'unMute' : 'mute'); if (m) ytCmd(slide, 'setVolume', [100]);
        slide.dataset.muted = m ? '0' : '1'; el.innerHTML = m ? ic.sound : ic.mute; break;
      }
    }
  });

  // vodoravni swipe = zamenjava znamke
  let sx = 0, sy = 0, dx = 0, lock = null, tracking = false;
  feed.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; lock = null;
  }, { passive: true });
  feed.addEventListener('touchmove', e => {
    if (!tracking) return;
    const t = e.touches[0]; dx = t.clientX - sx; const dy = t.clientY - sy;
    if (lock === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
    if (lock === 'h') { feed.style.transform = `translateX(${dx * 0.55}px)`; feed.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 500)); }
  }, { passive: true });
  const end = () => {
    if (!tracking) return; tracking = false;
    const was = lock === 'h'; const d = dx;
    if (was) { feed.style.transform = ''; feed.style.opacity = ''; }
    lock = null;
    if (was && Math.abs(d) > 70) swipeChannel(d < 0 ? 1 : -1, d * 0.55);
    else if (was) feed.animate([{ transform: `translateX(${d * 0.55}px)` }, { transform: 'translateX(0)' }], { duration: 180 });
  };
  feed.addEventListener('touchend', end);
  feed.addEventListener('touchcancel', end);

  // drsenje s sledilno ploščico (vodoravno)
  let wlock = 0;
  feed.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 40 && Date.now() > wlock) {
      wlock = Date.now() + 700; e.preventDefault(); swipeChannel(e.deltaX > 0 ? 1 : -1);
    }
  }, { passive: false });
}

async function swipeChannel(step, from = 0) {
  const chs = channels();
  const i = Math.max(0, chs.findIndex(c => c.id === FA.channel));
  const n = i + step;
  const feed = $('#feed');
  if (n < 0 || n >= chs.length) { feed.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${-step * 14}px)` }, { transform: 'translateX(0)' }], { duration: 260, easing: 'ease-out' }); return; }
  try { await feed.animate([{ transform: `translateX(${from}px)`, opacity: 1 }, { transform: `translateX(${-step * 40}%)`, opacity: 0 }], { duration: 150, easing: 'ease-in' }).finished; } catch {}
  FA.channel = chs[n].id; FA.renderTabs(); FA.renderFeed();
  feed.animate([{ transform: `translateX(${step * 40}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 230, easing: 'ease-out' });
}
FA.setChannel = id => { FA.channel = id; FA.renderFilters(); FA.renderTabs(); FA.renderFeed(); };

function step(dir) { const f = $('#feed'); f.scrollBy({ top: dir * f.clientHeight, behavior: 'smooth' }); }

/* ---------- priljubljeno, deljenje, znamka ---------- */
function toggleFav(id, el) {
  if (FA.favs.has(id)) FA.favs.delete(id); else FA.favs.add(id);
  LS.set('fa_favs', [...FA.favs]);
  el.classList.toggle('on', FA.favs.has(id));
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  FA.renderTabs();
}
async function share(it) {
  const url = location.href.split('#')[0] + '#look=' + encodeURIComponent(it.id);
  const c = cmap.get(it.companyId);
  const data = { title: L(it, 'title'), text: `${L(it, 'title')}${c ? ' – ' + c.name : ''}`, url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); FA.toast(t('Povezava kopirana')); } catch { FA.toast(url, 5000); }
}
function openBrands() {
  cmap = cmapGet();
  const act = activeCompanyIds();
  const counts = {};
  FA.data.items.forEach(i => { if (i.active !== false && act.has(i.companyId)) counts[i.companyId] = (counts[i.companyId] || 0) + 1; });
  const cos = FA.data.companies.filter(c => counts[c.id]);
  const row = (id, name, logo, sub) => `<button class="brand-row" data-ch="${esc(id)}"><span class="avatar" ${logo ? `style="background-image:url('${esc(logo)}')"` : ''}>${logo ? '' : esc(name.charAt(0).toUpperCase())}</span><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></button>`;
  FA.openSheet({
    title: L(FA.data.settings, 'siteName') || t('Znamke'),
    html: (L(FA.data.settings, 'tagline') ? `<p class="mut" style="margin:0 0 8px">${esc(L(FA.data.settings, 'tagline'))}</p>` : '') +
      row('all', t('Vse znamke'), '', plural(FA.data.items.filter(i => i.active !== false && act.has(i.companyId)).length)) +
      cos.map(c => row(c.id, c.name, safeUrl(c.logo), plural(counts[c.id]))).join(''),
    onMount: s => $$('[data-ch]', s).forEach(b => b.onclick = () => { FA.closeSheet(); FA.section = 'all'; FA.age = 'all'; FA.setChannel(b.dataset.ch); })
  });
}
function openBrand(id) {
  const c = cmap.get(id); if (!c) return;
  const n = FA.data.items.filter(i => i.companyId === id && i.active !== false).length;
  const logo = safeUrl(c.logo);
  const web = safeUrl(c.website);
  const ig = String(c.instagram || '').replace(/^@/, '').replace(/[^\w.]/g, '');
  FA.openSheet({
    title: c.name,
    html: `<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><span class="avatar" style="width:64px;height:64px;border-width:1px;flex:none;${logo ? `background-image:url('${esc(logo)}')` : ''}">${logo ? '' : esc(c.name.charAt(0).toUpperCase())}</span><div class="mut">${plural(n)}</div></div>
      ${L(c, 'description') ? `<p style="line-height:1.55;margin:0 0 14px">${esc(L(c, 'description'))}</p>` : ''}
      <div class="row-b" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${web ? `<a class="btn sm" href="${esc(web)}" target="_blank" rel="noopener noreferrer">${t('Spletna stran')}</a>` : ''}${ig ? `<a class="btn sm" href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener noreferrer">Instagram</a>` : ''}</div>
      <button class="btn primary block" id="see">${t('Ogled kolekcije')}</button>`,
    onMount: s => $('#see', s).onclick = () => { FA.closeSheet(); FA.section = 'all'; FA.age = 'all'; FA.setChannel(id); }
  });
}

/* ---------- košarica ---------- */
const saveCart = () => { LS.set('fa_cart', FA.cart); updateBadge(); };
function updateBadge() {
  const n = FA.cart.reduce((a, l) => a + l.qty, 0);
  const b = $('#cart-badge'); b.textContent = n; b.hidden = !n;
  $('#btn-cart').hidden = FA.data.settings.ordersEnabled === false;
}
function addToCart(it, size, qty = 1) {
  const key = it.id + '|' + (size || '');
  const l = FA.cart.find(x => x.key === key);
  if (l) l.qty += qty;
  else {
    const c = cmap.get(it.companyId) || cmapGet().get(it.companyId) || {};
    const yt = it.type === 'video' ? FA.ytParse(it.videoUrl) : null;
    FA.cart.push({ key, id: it.id, size: size || '', qty, title: it.title || '', titleEn: it.titleEn || '', sku: it.sku || '', price: +it.price || 0, company: c.name || '', img: it.type === 'video' ? (yt ? `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg` : '') : safeUrl(it.imageUrl) });
  }
  saveCart(); FA.toast(t('Dodano v košarico'));
}
FA.addFlow = it => {
  if (it.inStock === false) { FA.toast(t('Izdelek je razprodan')); return; }
  const sizes = Array.isArray(it.sizes) ? it.sizes.filter(Boolean) : [];
  if (!sizes.length) { addToCart(it, '', 1); return; }
  let size = '', qty = 1;
  FA.openSheet({
    title: t('Izberi velikost'),
    html: `<p style="margin:0 0 14px"><b>${esc(L(it, 'title'))}</b>${it.sku ? `<br><span class="mut">${t('Šifra')}: ${esc(it.sku)}</span>` : ''}</p>
      <div class="chips" id="sz">${sizes.map(z => `<button class="chip" data-z="${esc(z)}">${esc(z)}</button>`).join('')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0"><span class="mut">${t('Količina')}</span><span class="qty"><button id="qm">−</button><span id="qn">1</span><button id="qp">+</button></span></div>
      <button class="btn primary block" id="ok">${t('Dodaj v košarico')}</button>`,
    onMount: s => {
      $$('#sz .chip', s).forEach(b => b.onclick = () => { size = b.dataset.z; $$('#sz .chip', s).forEach(x => x.classList.toggle('on', x === b)); });
      $('#qm', s).onclick = () => { qty = Math.max(1, qty - 1); $('#qn', s).textContent = qty; };
      $('#qp', s).onclick = () => { qty = Math.min(20, qty + 1); $('#qn', s).textContent = qty; };
      $('#ok', s).onclick = () => { if (!size) { FA.toast(t('Izberi velikost')); return; } addToCart(it, size, qty); FA.closeSheet(); };
    }
  });
};

const cartTotal = () => FA.cart.reduce((a, l) => a + l.price * l.qty, 0);

FA.openCart = () => {
  const s = FA.data.settings;
  if (!FA.cart.length) { FA.openSheet({ title: t('Košarica'), html: `<div class="empty-s">${t('Košarica je prazna.')}</div>` }); return; }
  const showP = s.showPrices !== false;
  const draw = sheet => {
    const body = $('.sheet-b', sheet);
    if (!FA.cart.length) { FA.closeSheet(); return; }
    body.innerHTML = FA.cart.map((l, i) => `<div class="line"><img src="${esc(l.img)}" alt=""><div><div class="t">${esc(LANG === 'en' && l.titleEn ? l.titleEn : l.title)}</div><div class="s">${esc(l.company)}${l.sku ? ' · ' + esc(l.sku) : ''}${l.size ? ' · ' + t('vel.') + ' ' + esc(l.size) : ''}</div><div style="margin-top:8px;display:flex;gap:10px;align-items:center"><span class="qty"><button data-m="${i}">−</button><span>${l.qty}</span><button data-p="${i}">+</button></span><button class="mut" data-x="${i}" style="font-size:12px;text-decoration:underline">${t('Odstrani')}</button></div></div><div class="p">${showP ? esc(FA.money(l.price * l.qty)) : ''}</div></div>`).join('') +
      (showP ? `<div class="total"><span>${t('Skupaj')}</span><span>${esc(FA.money(cartTotal()))}</span></div>` : '<div style="height:14px"></div>') +
      `<button class="btn primary block" id="go">${t('Nadaljuj na naročilo')}</button>`;
    $$('[data-m]', body).forEach(b => b.onclick = () => { const l = FA.cart[+b.dataset.m]; l.qty = Math.max(1, l.qty - 1); saveCart(); draw(sheet); });
    $$('[data-p]', body).forEach(b => b.onclick = () => { const l = FA.cart[+b.dataset.p]; l.qty = Math.min(20, l.qty + 1); saveCart(); draw(sheet); });
    $$('[data-x]', body).forEach(b => b.onclick = () => { FA.cart.splice(+b.dataset.x, 1); saveCart(); draw(sheet); });
    $('#go', body).onclick = () => checkout(sheet);
  };
  const sheet = FA.openSheet({ title: t('Košarica') });
  draw(sheet);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function checkout(sheet) {
  const s = FA.data.settings; const showP = s.showPrices !== false;
  const cust = LS.get('fa_cust', {});
  const body = $('.sheet-b', sheet); $('.sheet-h h2', sheet).textContent = t('Naročilo');
  const f = k => esc(cust[k] || '');
  body.innerHTML = `<form class="form" id="co" novalidate>
    ${!s.orderEmail ? `<div class="note warn">${t('Naročanje še ni nastavljeno (v adminu vpiši e-pošto za naročila).')}</div>` : ''}
    ${L(s, 'orderNote') ? `<div class="note">${esc(L(s, 'orderNote'))}</div>` : ''}
    <label>${t('Ime in priimek')} *<input name="name" autocomplete="name" value="${f('name')}" required></label>
    <div class="two"><label>${t('E-pošta')} *<input name="email" type="email" inputmode="email" autocomplete="email" value="${f('email')}" required></label>
    <label>${t('Telefon')} *<input name="phone" type="tel" autocomplete="tel" value="${f('phone')}" required></label></div>
    <label>${t('Naslov (ulica in hišna št.)')} *<input name="street" autocomplete="street-address" value="${f('street')}" required></label>
    <div class="two"><label>${t('Poštna št.')} *<input name="zip" autocomplete="postal-code" value="${f('zip')}" required></label>
    <label>${t('Kraj')} *<input name="city" autocomplete="address-level2" value="${f('city')}" required></label></div>
    <label>${t('Država')}<input name="country" autocomplete="country-name" value="${esc(cust.country || t('Slovenija'))}"></label>
    <label>${t('Opomba')}<textarea name="note" rows="2"></textarea></label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label class="chk"><input type="checkbox" name="ok" required> ${t('Strinjam se, da se moji podatki uporabijo za obdelavo naročila.')}</label>
    <div class="total" style="padding:4px 0"><span>${FA.cart.reduce((a, l) => a + l.qty, 0)} ${t('kos')}</span><span>${showP ? esc(FA.money(cartTotal())) : ''}</span></div>
    <p class="err" id="er"></p>
    <button class="btn primary block" id="send" type="submit">${t('Pošlji naročilo')}</button>
    <button class="btn block" type="button" id="back">${t('Nazaj v košarico')}</button>
  </form>`;
  $('#back', body).onclick = () => { FA.closeSheet(); FA.openCart(); };
  $('#co', body).onsubmit = async e => {
    e.preventDefault();
    const fm = e.target; const v = Object.fromEntries(new FormData(fm).entries());
    const er = $('#er', body); er.textContent = '';
    if (v.website) return; // honeypot
    if (!s.orderEmail) { er.textContent = t('Naročanje še ni nastavljeno.'); return; }
    for (const k of ['name', 'email', 'phone', 'street', 'zip', 'city']) if (!String(v[k] || '').trim()) { er.textContent = t('Izpolni vsa obvezna polja.'); fm.elements[k].focus(); return; }
    if (!EMAIL_RE.test(v.email.trim())) { er.textContent = t('Vpiši veljaven e-naslov.'); return; }
    if (!fm.elements.ok.checked) { er.textContent = t('Potrdi soglasje za obdelavo podatkov.'); return; }
    v.country = v.country || t('Slovenija');
    LS.set('fa_cust', { name: v.name, email: v.email, phone: v.phone, street: v.street, zip: v.zip, city: v.city, country: v.country });
    const btn = $('#send', body); btn.disabled = true; btn.textContent = t('Pošiljam…');
    const no = orderNo();
    try {
      await sendOrder(v, no);
      const sum = cartTotal(); FA.cart = []; saveCart();
      body.innerHTML = `<div style="text-align:center;padding:24px 0"><div style="font-size:46px;color:var(--ok)">✓</div><h3 style="font-family:var(--serif);font-weight:500;font-size:24px;margin:10px 0">${t('Hvala za naročilo!')}</h3><p class="mut" style="line-height:1.5">${t('Št. naročila')}: <b style="color:var(--fg)">${esc(no)}</b><br>${t('Potrdilo bo prispelo na')} ${esc(v.email)}.${showP ? `<br>${t('Skupaj')}: ${esc(FA.money(sum))}` : ''}</p><button class="btn primary block" id="fin" style="margin-top:18px">${t('Nadaljuj z ogledom')}</button></div>`;
      $('#fin', body).onclick = () => FA.closeSheet();
    } catch (err) {
      btn.disabled = false; btn.textContent = t('Pošlji naročilo');
      er.innerHTML = `${t('Pošiljanje ni uspelo')} (${esc(err.message)}). <a href="${esc(mailto(v, no))}">${t('Odpri v e-pošti')}</a>`;
    }
  };
};

const orderNo = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; };
const lineText = l => {
  const link = location.href.split('#')[0] + '#look=' + encodeURIComponent(l.id);
  return `${l.qty}× ${l.title} | šifra: ${l.sku || '-'} | velikost: ${l.size || '-'} | znamka: ${l.company || '-'} | ${FA.money(l.price)} | skupaj ${FA.money(l.price * l.qty)} | ${link}`;
};
function mailto(v, no) {
  const s = FA.data.settings;
  const body = [`Št. naročila: ${no}`, '', ...FA.cart.map((l, i) => `${i + 1}. ${lineText(l)}`), '', `SKUPAJ: ${FA.money(cartTotal())}`, '', `Ime: ${v.name}`, `E-pošta: ${v.email}`, `Telefon: ${v.phone}`, `Naslov: ${v.street}, ${v.zip} ${v.city}, ${v.country}`, `Opomba: ${v.note || '-'}`].join('\n');
  return `mailto:${s.orderEmail}?subject=${encodeURIComponent(`Naročilo ${no} – ${s.siteName}`)}&body=${encodeURIComponent(body)}`;
}
async function sendOrder(v, no) {
  const s = FA.data.settings;
  const p = {
    _subject: `Novo naročilo ${no} – ${s.siteName}`,
    _template: 'table',
    _captcha: 'false',
    _replyto: v.email,
    _autoresponse: LANG === 'en' ? `Thank you for your order ${no}! We have received it and will contact you shortly. – ${L(s, 'siteName')}` : `Hvala za naročilo ${no}! Prejeli smo ga in se vam bomo oglasili v najkrajšem možnem času. – ${s.siteName}`,
    'Št. naročila': no,
    'Ime in priimek': v.name,
    'E-pošta': v.email,
    'Telefon': v.phone,
    'Naslov': `${v.street}, ${v.zip} ${v.city}, ${v.country}`,
    'Opomba': v.note || '-'
  };
  FA.cart.forEach((l, i) => { p[`Artikel ${i + 1}`] = lineText(l); });
  p['SKUPAJ'] = FA.money(cartTotal());
  const r = await fetch('https://formsubmit.co/ajax/' + s.orderEmail, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(p) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false || j.success === 'false') throw new Error(j.message || 'strežnik je vrnil napako');
}

/* ---------- skupno ---------- */
FA.renderAll = () => {
  const s = FA.data.settings;
  const nm = L(s, 'siteName') || 'Moda danes';
  $('#site-name').textContent = nm;
  document.title = nm;
  FA.renderFilters(); FA.renderTabs(); FA.renderFeed(); updateBadge();
};
function applyStatic() {
  document.documentElement.lang = LANG;
  $$('[data-i18n]').forEach(e => { if (e.dataset.sl === undefined) e.dataset.sl = e.textContent; e.textContent = t(e.dataset.sl); });
  [['#nav-left', 'title', 'Prejšnja znamka'], ['#nav-up', 'title', 'Prejšnji izdelek'], ['#nav-down', 'title', 'Naslednji izdelek'], ['#nav-right', 'title', 'Naslednja znamka'],
   ['#btn-cart', 'aria-label', 'Košarica'], ['#brand', 'aria-label', 'Podjetja'], ['#tabs', 'aria-label', 'Podjetja'], ['#btn-lang', 'aria-label', 'Spremeni jezik']]
    .forEach(([q, a, v]) => { const e = $(q); if (e) e.setAttribute(a, t(v)); });
  $$('#btn-lang span').forEach(e => e.classList.toggle('on', e.dataset.l === LANG));
}
function setLang(l) {
  LANG = l; LS.set('fa_lang', l); FA.closeSheet(true); applyStatic(); FA.renderAll();
}
FA.updateBadge = updateBadge;
FA.sendOrderTest = async to => {
  const r = await fetch('https://formsubmit.co/ajax/' + to, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: `Test naročanja – ${FA.data.settings.siteName}`, _captcha: 'false', _template: 'table', Sporočilo: 'To je testno sporočilo. Če ga vidiš, naročila delujejo.' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false || j.success === 'false') throw new Error(j.message || 'napaka');
  return j;
};

function openLook(id) {
  const it = FA.data.items.find(i => i.id === id); if (!it) return;
  FA.channel = 'all'; FA.section = 'all'; FA.age = 'all'; FA.renderFilters(); FA.renderTabs(); FA.renderFeed();
  const idx = FA.list.findIndex(i => i.id === id);
  if (idx >= 0) { const f = $('#feed'); f.style.scrollBehavior = 'auto'; f.scrollTop = idx * f.clientHeight; }
}

async function openAdmin() {
  if (!window.FA.openAdmin) {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'admin.js?t=' + Date.now(); s.onload = res; s.onerror = () => rej(new Error('admin.js se ni naložil')); document.head.appendChild(s); }).catch(e => FA.toast(e.message));
  }
  if (FA.openAdmin) FA.openAdmin();
}

async function init() {
  $('#ic-cart').innerHTML = ic.bag;
  $('#ic-admin').innerHTML = ic.user;
  $('#brand').onclick = openBrands;
  $('#btn-lang').onclick = () => setLang(LANG === 'sl' ? 'en' : 'sl');
  $('#sections').addEventListener('click', e => { const b = e.target.closest('[data-sec]'); if (!b) return; FA.section = b.dataset.sec; FA.age = 'all'; FA.renderFilters(); FA.renderTabs(); FA.renderFeed(); });
  $('#ages').addEventListener('click', e => { const b = e.target.closest('[data-age]'); if (!b) return; FA.age = b.dataset.age; FA.renderFilters(); FA.renderTabs(); FA.renderFeed(); });
  applyStatic();
  $('#btn-cart').onclick = () => FA.openCart();
  $('#btn-admin').onclick = openAdmin;
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) FA.setChannel(b.dataset.ch); });
  $('#nav-up').onclick = () => step(-1); $('#nav-down').onclick = () => step(1);
  $('#nav-left').onclick = () => swipeChannel(-1); $('#nav-right').onclick = () => swipeChannel(1);
  bindFeed();

  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select') || $('#sheet-root').classList.contains('open') || FA.admin.active) { if (e.key === 'Escape') FA.closeSheet(); return; }
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') swipeChannel(1);
    else if (e.key === 'ArrowLeft') swipeChannel(-1);
  });

  await loadData();
  FA.renderAll();
  const m = location.hash.match(/look=([^&]+)/); if (m) openLook(decodeURIComponent(m[1]));
  if (FA.list.length > 1 && !LS.get('fa_hint', false)) {
    LS.set('fa_hint', true); const h = $('#hint'); h.hidden = false; setTimeout(() => h.hidden = true, 4300);
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
})();
