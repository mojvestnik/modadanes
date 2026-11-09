/* Moda danes – admin (prijava, urejanje, objava na GitHub, nalaganje slik) */
(() => {
'use strict';
const FA = window.FA;
const { $, $$, esc, safeUrl, ic, LS } = FA;
const KEY = 'fa_admin_v1';
const DATA_PATH = 'data/data.json';

let cfg = null;      // { owner, repo, branch, token, imgurId } – samo v pomnilniku
let pass = null;     // geslo seje (za ponovno šifriranje)
const A = { tab: 'looks', filter: 'all', sec: 'all' };
let root = null;
let dirty = false, busy = false, again = false, timer = null;

const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'znamka';
const parseNum = s => { s = String(s ?? '').trim().replace(',', '.'); if (s === '') return ''; const n = Number(s); return isFinite(n) ? n : ''; };

/* ---------- šifriranje (AES-GCM + PBKDF2) ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pw, salt) {
  const km = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptJson(obj, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pw, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function decryptJson(blob, pw) {
  const key = await deriveKey(pw, unb64(blob.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return JSON.parse(dec.decode(pt));
}
const saveCfg = async () => LS.set(KEY, await encryptJson(cfg, pass));

/* ---------- GitHub ---------- */
async function gh(path, opts = {}, raw = false) {
  if (/[^\x21-\x7e]/.test(cfg.token)) throw new Error('Token vsebuje nedovoljene znake (presledek, nova vrstica ali posebni znak). Prilepi ga znova.');
  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${path}`, {
      ...opts,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
  } catch (e) { throw new Error(`Povezava z GitHubom ni uspela (${e.message}). Preveri uporabnika »${cfg.owner}«, repozitorij »${cfg.repo}« in token.`); }
  if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error(`GitHub ${r.status}: ${t.message || r.statusText}`); }
  return raw ? r.text() : r.json();
}
const b64utf8 = s => b64(enc.encode(s));

async function syncFromGithub(silent = false) {
  try {
    const txt = await gh(`contents/${DATA_PATH}?ref=${encodeURIComponent(cfg.branch)}`, {}, true);
    FA.setData(JSON.parse(txt));
    return true;
  } catch (e) {
    if (!silent || !/404/.test(e.message)) FA.toast('Branje podatkov ni uspelo: ' + e.message, 5000);
    setStatus('⚠ GitHub ni dosegljiv: ' + e.message, 'err');
    return false;
  }
}
async function ghPut() {
  let sha;
  try { sha = (await gh(`contents/${DATA_PATH}?ref=${encodeURIComponent(cfg.branch)}`)).sha; }
  catch (e) { if (!/404/.test(e.message)) throw e; }
  const body = { message: 'Posodobitev vsebine (admin)', content: b64utf8(JSON.stringify(FA.data, null, 2) + '\n'), branch: cfg.branch };
  if (sha) body.sha = sha;
  await gh(`contents/${DATA_PATH}`, { method: 'PUT', body: JSON.stringify(body) });
}
function setStatus(t, cls = '') { const e = $('#a-status'); if (e) { e.textContent = t; e.className = 'a-status ' + cls; } }
function queuePublish() { dirty = true; setStatus('● neshranjene spremembe…', 'warn'); clearTimeout(timer); timer = setTimeout(publish, 1200); }
async function publish() {
  if (busy) { again = true; return; }
  busy = true; clearTimeout(timer); setStatus('Objavljam…', 'warn');
  try {
    do { again = false; FA.data.updatedAt = new Date().toISOString(); await ghPut(); } while (again);
    dirty = false; setStatus('✓ Objavljeno (javna stran se osveži v ~1 min)', 'ok');
  } catch (e) { setStatus('Napaka: ' + e.message, 'err'); FA.toast('Objava ni uspela: ' + e.message, 6000); }
  finally { busy = false; }
}
window.addEventListener('beforeunload', e => { if (dirty || busy) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- nalaganje slik ---------- */
async function prepImage(file) {
  if (!/^image\//.test(file.type)) throw new Error('To ni slika');
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const max = 2400, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (sc === 1 && file.size < 8 * 1024 * 1024 && /jpe?g|png|webp/.test(file.type)) { bmp.close && bmp.close(); return file; }
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Pretvorba slike ni uspela')), 'image/jpeg', 0.9));
  } catch (e) { if (file.size < 10 * 1024 * 1024) return file; throw e; }
}
function imgurUpload(blob, onP) {
  return new Promise((res, rej) => {
    const fd = new FormData(); fd.append('image', blob); fd.append('type', 'file');
    const x = new XMLHttpRequest();
    x.open('POST', 'https://api.imgur.com/3/image');
    x.setRequestHeader('Authorization', 'Client-ID ' + cfg.imgurId);
    x.upload.onprogress = e => { if (e.lengthComputable && onP) onP(e.loaded / e.total); };
    x.onload = () => {
      try {
        const j = JSON.parse(x.responseText);
        if (x.status >= 200 && x.status < 300 && j.success) res(String(j.data.link).replace('http://', 'https://'));
        else { const m = j.data && j.data.error; rej(new Error('Imgur: ' + (typeof m === 'string' ? m : (m && m.message) || x.status))); }
      } catch (e) { rej(new Error('Imgur: neveljaven odgovor (' + x.status + ')')); }
    };
    x.onerror = () => rej(new Error('Imgur: omrežna napaka'));
    x.send(fd);
  });
}
const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function ghUpload(blob, onP) {
  const name = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
  onP && onP(.3);
  await gh(`contents/${name}`, { method: 'PUT', body: JSON.stringify({ message: 'Nalaganje slike', content: await blobB64(blob), branch: cfg.branch }) });
  onP && onP(1);
  return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${name}`;
}
async function uploadFile(file, onP) {
  const blob = await prepImage(file);
  return cfg.imgurId ? imgurUpload(blob, onP) : ghUpload(blob, onP);
}

/* ---------- ogrodje admina ---------- */
function ensureRoot() {
  if (root) return root;
  root = document.createElement('div'); root.id = 'admin'; root.className = 'admin';
  document.body.appendChild(root);
  return root;
}
FA.openAdmin = () => {
  ensureRoot(); root.classList.add('open'); FA.admin.active = true;
  if (!window.crypto || !crypto.subtle) { root.innerHTML = authWrap('<h1>Admin</h1><p class="err">Brskalnik ne podpira šifriranja (potrebna je varna povezava https).</p>'); bindClose(); return; }
  if (cfg) renderShell(); else if (LS.get(KEY)) renderLogin(); else renderSetup();
};
function closeAdmin() {
  if (dirty && !busy) publish();
  root.classList.remove('open'); FA.admin.active = false;
  $('#admin-dot').hidden = !cfg;
  FA.closeSheet(true);
  FA.renderAll();
}
const bindClose = () => $$('[data-aclose]', root).forEach(b => b.onclick = closeAdmin);
const authWrap = inner => `<div class="a-top"><strong>Admin</strong><button class="icon-btn" data-aclose aria-label="Zapri">${ic.close}</button></div><div class="a-auth">${inner}</div>`;

/* ----- prva nastavitev ----- */
function renderSetup() {
  const host = location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] : '';
  const repo = host ? location.pathname.split('/').filter(Boolean)[0] || host + '.github.io' : '';
  const auto = !!(host && repo);
  root.innerHTML = authWrap(`
    <h1>Admin</h1>
    <form class="form" id="f-setup" autocomplete="off" style="margin-top:18px">
      <div class="two"><label>GitHub uporabnik *<input name="owner" value="${esc(host)}" required></label><label>Repozitorij *<input name="repo" value="${esc(repo)}" required></label></div>
      <input type="hidden" name="branch" value="main"><input type="hidden" name="imgur" value="">
      <label>GitHub token *<input name="token" type="password" placeholder="github_pat_…" required autocomplete="off"></label>
      <label>Novo geslo za admin *<input name="pw" type="password" required autocomplete="new-password"></label>
      <label>Ponovi geslo *<input name="pw2" type="password" required autocomplete="new-password"></label>
      <p class="err" id="er"></p>
      <button class="btn primary block" type="submit">Shrani in vstopi</button>
    </form>`);
  bindClose();
  $('#f-setup', root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target.elements, er = $('#er', root), btn = $('button[type=submit]', root);
    er.textContent = '';
    if (f.pw.value !== f.pw2.value) { er.textContent = 'Gesli se ne ujemata.'; return; }
    const clean = v => v.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
    let ow = clean(f.owner.value), rp = clean(f.repo.value);
    if (rp.includes('/')) { const p = rp.split('/'); if (!ow) ow = p[0]; rp = p[1]; }
    if (ow.includes('/')) { const p = ow.split('/'); ow = p[0]; if (!rp || rp === 'index.html') rp = p[1] || rp; }
    const c = { owner: ow, repo: rp, branch: f.branch.value.trim() || 'main', token: f.token.value.replace(/\s+/g, ''), imgurId: f.imgur.value.trim() };
    btn.disabled = true; btn.textContent = 'Preverjam…';
    try {
      cfg = c; pass = f.pw.value;
      // Ne blokiraj vstopa v admin, če brskalnik trenutno ne more doseči GitHub API-ja.
      // Povezavo preverimo v ozadju in natančno pokažemo napako v statusu.
      await saveCfg();
      renderShell();
      setStatus('Preverjam povezavo z GitHubom…', 'warn');
      const ok = await syncFromGithub(true);
      if (ok) setStatus(`✓ povezano z ${cfg.owner}/${cfg.repo}`, 'ok');
      else FA.toast('Admin je odprt. GitHub povezavo lahko preveriš v Nastavitvah.', 5000);
    } catch (err) { cfg = null; pass = null; er.textContent = err.message; btn.disabled = false; btn.textContent = 'Shrani in vstopi'; }
  };
}

/* ----- prijava ----- */
function renderLogin() {
  root.innerHTML = authWrap(`
    <h1>Admin</h1><p class="mut" style="margin:0 0 18px">Vnesi geslo za dostop.</p>
    <form class="form" id="f-login"><label>Geslo<input name="pw" type="password" autocomplete="current-password" required autofocus></label><p class="err" id="er"></p><button class="btn primary block" type="submit">Vstopi</button></form>
    <button class="link" id="reset">Pozabljeno geslo / nova nastavitev</button>`);
  bindClose();
  $('#f-login', root).onsubmit = async e => {
    e.preventDefault();
    const pw = e.target.elements.pw.value, er = $('#er', root), btn = $('button[type=submit]', root);
    er.textContent = ''; btn.disabled = true; btn.textContent = 'Preverjam…';
    try { cfg = await decryptJson(LS.get(KEY), pw); pass = pw; }
    catch { er.textContent = 'Napačno geslo.'; btn.disabled = false; btn.textContent = 'Vstopi'; return; }
    renderShell();
    setStatus('Preverjam povezavo z GitHubom…', 'warn');
    const ok = await syncFromGithub(true);
    if (ok) setStatus(`✓ povezano z ${cfg.owner}/${cfg.repo}`, 'ok');
    else FA.toast('Admin je odprt, vendar GitHub trenutno ni dosegljiv.', 5000);
  };
  $('#reset', root).onclick = () => { if (confirm('Izbrišem shranjen token in geslo na tej napravi? Podatki na GitHubu ostanejo.')) { LS.del(KEY); renderSetup(); } };
}

/* ----- glavni pogled ----- */
function renderShell() {
  $('#admin-dot').hidden = false;
  root.innerHTML = `<div class="a-top"><div><strong>Admin</strong><span class="a-status ok" id="a-status">● povezano z ${esc(cfg.owner)}/${esc(cfg.repo)}</span></div><div class="row-b"><button class="btn sm" id="a-sync" title="Ponovno naloži z GitHuba">↻</button><button class="icon-btn" data-aclose aria-label="Zapri">${ic.close}</button></div></div>
    <nav class="a-tabs"><button data-t="looks">Izdelki</button><button data-t="companies">Podjetja</button><button data-t="sections">Rubrike</button><button data-t="settings">Nastavitve</button></nav>
    <div class="a-body"><div class="a-inner" id="a-view"></div></div>`;
  bindClose();
  $$('.a-tabs button', root).forEach(b => b.onclick = () => { A.tab = b.dataset.t; draw(); });
  $('#a-sync', root).onclick = async () => { if (dirty && !confirm('Neobjavljene spremembe bodo izgubljene. Nadaljujem?')) return; await syncFromGithub(); dirty = false; setStatus('✓ osveženo z GitHuba', 'ok'); draw(); };
  draw();
}
function draw() {
  $$('.a-tabs button', root).forEach(b => b.classList.toggle('on', b.dataset.t === A.tab));
  ({ looks: viewLooks, companies: viewCompanies, sections: viewSections, settings: viewSettings })[A.tab]();
}
const view = () => $('#a-view', root);
const coName = id => (FA.data.companies.find(c => c.id === id) || {}).name || '—';
const ytThumb = u => { const y = FA.ytParse(u); return y ? `https://i.ytimg.com/vi/${y.id}/hqdefault.jpg` : ''; };

/* ----- LOOKI ----- */
function viewLooks() {
  const D = FA.data;
  if (!D.companies.length) {
    view().innerHTML = `<div class="a-sec"><h3>Najprej dodaj podjetje</h3><p class="mut" style="line-height:1.5">Vsak izdelek pripada podjetju oziroma znamki.</p><button class="btn primary" id="go-co">+ Dodaj podjetje</button></div>`;
    $('#go-co', view()).onclick = () => { A.tab = 'companies'; draw(); setTimeout(() => companyForm(), 50); };
    return;
  }
  const items = D.items.filter(i => (A.filter === 'all' || i.companyId === A.filter) && (A.sec === 'all' || (i.section || 'clothes') === A.sec));
  view().innerHTML = `<div class="a-bar">
      <select id="flt"><option value="all">Vsa podjetja (${D.items.length})</option>${D.companies.map(c => `<option value="${esc(c.id)}" ${A.filter === c.id ? 'selected' : ''}>${esc(c.name)} (${D.items.filter(i => i.companyId === c.id).length})</option>`).join('')}</select>
      <select id="flt-s"><option value="all">Vse rubrike</option>${FA.getSections().map(x => `<option value="${x.id}" ${A.sec === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="btn primary" id="n-look">${ic.plus} Nov izdelek</button>
      <button class="btn" id="n-vid">${ic.plus} YouTube video</button>
      <button class="btn" id="n-bulk">${ic.upload} Več slik naenkrat</button>
    </div>
    ${items.length ? `<div class="a-grid">${items.map(card).join('')}</div>` : '<div class="empty-s">Ni izdelkov. Dodaj prvega zgoraj.</div>'}`;
  $('#flt', view()).onchange = e => { A.filter = e.target.value; viewLooks(); };
  $('#flt-s', view()).onchange = e => { A.sec = e.target.value; viewLooks(); };
  $('#n-look', view()).onclick = () => lookForm(null, 'image');
  $('#n-vid', view()).onclick = () => lookForm(null, 'video');
  $('#n-bulk', view()).onclick = bulkForm;
  $$('[data-a]', view()).forEach(b => b.onclick = () => lookAction(b.dataset.a, b.dataset.id));
}
function card(it) {
  const th = it.type === 'video' ? ytThumb(it.videoUrl) : safeUrl(it.imageUrl);
  const off = it.active === false;
  return `<div class="a-card ${off ? 'off' : ''}"><div class="a-thumb">${th ? `<img src="${esc(th)}" loading="lazy" alt="">` : ''}<div class="a-badges">${it.type === 'video' ? '<span>▶ VIDEO</span>' : ''}${off ? '<span>SKRITO</span>' : ''}${it.inStock === false ? '<span>RAZPRODANO</span>' : ''}</div></div>
    <div class="a-info"><b>${esc(it.title || 'Brez naziva')}</b><small>${esc(coName(it.companyId))} · ${esc((FA.getSections().find(x => x.id === (it.section || 'clothes')) || {}).name || '')}</small><small>${esc(it.sku || '')}${it.price !== '' && it.price != null ? ' · ' + esc(FA.money(it.price)) : ''}</small></div>
    <div class="a-act"><button data-a="up" data-id="${esc(it.id)}" aria-label="Gor">${ic.up}</button><button data-a="down" data-id="${esc(it.id)}" aria-label="Dol">${ic.down}</button><button data-a="edit" data-id="${esc(it.id)}" aria-label="Uredi">${ic.edit}</button><button data-a="hide" data-id="${esc(it.id)}" aria-label="Skrij/pokaži">${off ? ic.eye : ic.eyeOff}</button><button class="red" data-a="del" data-id="${esc(it.id)}" aria-label="Izbriši">${ic.trash}</button></div></div>`;
}
function lookAction(a, id) {
  const D = FA.data, idx = D.items.findIndex(i => i.id === id); if (idx < 0) return;
  const it = D.items[idx];
  if (a === 'edit') { lookForm(it); return; }
  if (a === 'hide') it.active = it.active === false;
  if (a === 'del') { if (!confirm(`Izbrišem »${it.title || 'izdelek'}«?`)) return; D.items.splice(idx, 1); }
  if (a === 'up' || a === 'down') {
    const vis = D.items.filter(i => (A.filter === 'all' || i.companyId === A.filter) && (A.sec === 'all' || (i.section || 'clothes') === A.sec));
    const vi = vis.findIndex(i => i.id === id), nb = vis[vi + (a === 'up' ? -1 : 1)];
    if (!nb) return;
    const j = D.items.indexOf(nb); [D.items[idx], D.items[j]] = [D.items[j], D.items[idx]];
  }
  queuePublish(); viewLooks();
}

/* obrazec za look */
function lookForm(item, kind) {
  const D = FA.data;
  const isNew = !item;
  const it = item ? { ...item } : { id: uid('l'), type: kind || 'image', companyId: A.filter !== 'all' ? A.filter : D.companies[0].id, section: (A.sec !== 'all' ? A.sec : FA.getSections()[0].id), ages: [], titleEn: '', descriptionEn: '', title: '', sku: '', price: '', oldPrice: '', description: '', model: '', category: '', sizes: [], imageUrl: '', videoUrl: '', vertical: true, focusY: 50, fit: 'cover', inStock: true, active: true, createdAt: Date.now() };
  let type = it.type === 'video' ? 'video' : 'image', vertical = it.vertical !== false, uploading = false;
  const TAX = { sections: FA.getSections(), ages: FA.TAX.ages }; let section = it.section || 'clothes'; if (!TAX.sections.some(x => x.id === section)) section = TAX.sections[0].id; const ages = new Set(it.ages || []);
  const sheet = FA.openSheet({
    title: isNew ? 'Nov izdelek' : 'Uredi izdelek', cls: 'wide',
    html: `<form class="form" id="f-look" autocomplete="off">
      <label>Podjetje *<select name="companyId">${D.companies.map(c => `<option value="${esc(c.id)}" ${c.id === it.companyId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="seg" id="seg-type"><button type="button" data-v="image">Fotografija 9:16</button><button type="button" data-v="video">YouTube video</button></div>
      <div id="sec-image" style="display:grid;gap:12px">
        <div class="row-b" style="align-items:flex-start;gap:16px"><div class="prev916" id="prev">Predogled 9:16</div>
          <div style="display:grid;gap:10px;flex:1;min-width:180px"><button type="button" class="btn" id="pick">${ic.upload} Naloži sliko</button><input type="file" id="file" accept="image/*" hidden><div id="up-st" class="mut" style="font-size:13px"></div><div class="prog" id="prog" hidden><i></i></div></div></div>
        <label>ali vstavi URL slike<input name="imageUrl" type="url" inputmode="url" placeholder="https://i.imgur.com/…" value="${esc(it.imageUrl)}"></label>
        <label>Položaj kadra (zgoraj ↔ spodaj)<input name="focusY" type="range" min="0" max="100" value="${+it.focusY || 50}"></label>
        <label class="chk"><input type="checkbox" name="contain" ${it.fit === 'contain' ? 'checked' : ''}> Prikaži celo sliko (brez obrezovanja)</label>
      </div>
      <div id="sec-video" style="display:grid;gap:12px">
        <label>YouTube povezava *<input name="videoUrl" placeholder="https://youtube.com/shorts/… ali youtu.be/…" value="${esc(it.videoUrl)}"></label>
        <div class="seg" id="seg-or"><button type="button" data-o="1">Pokončen</button><button type="button" data-o="0">Ležeč</button></div>
        <div class="prev916 wide" id="vprev">Predogled videa</div>
      </div>
      <label>Naziv izdelka *<input name="title" maxlength="120" required value="${esc(it.title)}"></label>
      <div class="two"><label>Rubrika<select name="section">${TAX.sections.map(x => `<option value="${x.id}" ${x.id === section ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><label>Kategorija<select name="category"></select></label></div>
      <div id="age-box" style="display:grid;gap:8px"><span class="mut" style="font-size:13px">Za koga (prazno = vse starosti)</span><div class="age-chips">${TAX.ages.map(x => `<button type="button" class="chip ${ages.has(x.id) ? 'on' : ''}" data-age="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
      <label>Šifra artikla<input name="sku" value="${esc(it.sku)}"></label>
            <div class="two"><label>Cena<input name="price" inputmode="decimal" placeholder="49,90" value="${it.price === '' ? '' : esc(String(it.price).replace('.', ','))}"></label><label>Stara cena (prečrtana)<input name="oldPrice" inputmode="decimal" value="${it.oldPrice === '' || it.oldPrice == null ? '' : esc(String(it.oldPrice).replace('.', ','))}"></label></div>
      <label>Velikosti ali variante (ločene z vejico)<input name="sizes" placeholder="XS, S, M, L, XL" value="${esc((it.sizes || []).join(', '))}"></label>
      <label>Modelka / model (neobvezno)<input name="model" value="${esc(it.model)}"></label>
      <label>Opis<textarea name="description" rows="4">${esc(it.description)}</textarea></label>
      <label>Naziv v angleščini (neobvezno)<input name="titleEn" maxlength="120" value="${esc(it.titleEn || '')}"></label>
      <label>Opis v angleščini (neobvezno)<textarea name="descriptionEn" rows="3">${esc(it.descriptionEn || '')}</textarea></label>
      <label class="chk"><input type="checkbox" name="inStock" ${it.inStock !== false ? 'checked' : ''}> Na zalogi</label>
      <label class="chk"><input type="checkbox" name="active" ${it.active !== false ? 'checked' : ''}> Vidno v aplikaciji</label>
      <p class="err" id="er"></p>
      <div class="stick"><button class="btn primary" type="submit" id="save">Shrani</button>${isNew ? '' : '<button type="button" class="btn danger" id="del">Izbriši</button>'}</div>
    </form>`,
    onMount: s => {
      const f = $('#f-look', s).elements;
      const prev = $('#prev', s), vprev = $('#vprev', s);
      const syncType = () => {
        $$('#seg-type button', s).forEach(b => b.classList.toggle('on', b.dataset.v === type));
        $('#sec-image', s).style.display = type === 'image' ? 'grid' : 'none';
        $('#sec-video', s).style.display = type === 'video' ? 'grid' : 'none';
      };
      const syncOr = () => { $$('#seg-or button', s).forEach(b => b.classList.toggle('on', (b.dataset.o === '1') === vertical)); };
      const showPrev = () => {
        const u = safeUrl(f.imageUrl.value);
        prev.innerHTML = u ? `<img src="${esc(u)}" alt="" style="object-position:50% ${f.focusY.value}%;${f.contain.checked ? 'object-fit:contain' : ''}">` : 'Predogled 9:16';
      };
      const showV = () => {
        const y = FA.ytParse(f.videoUrl.value);
        vprev.innerHTML = y ? `<img src="https://i.ytimg.com/vi/${y.id}/hqdefault.jpg" alt="">` : 'Predogled videa';
        if (y && y.short) { vertical = true; syncOr(); }
      };
      $$('#seg-type button', s).forEach(b => b.onclick = () => { type = b.dataset.v; syncType(); });
      $$('#seg-or button', s).forEach(b => b.onclick = () => { vertical = b.dataset.o === '1'; syncOr(); });
      f.imageUrl.oninput = showPrev; f.focusY.oninput = showPrev; f.contain.onchange = showPrev; f.videoUrl.oninput = showV;
      const fillCats = () => {
        const cur = it.category || '', list = (TAX.sections.find(x => x.id === section).cats || []).slice();
        if (cur && !list.includes(cur) && section === (it.section || 'clothes')) list.push(cur);
        f.category.innerHTML = '<option value="">—</option>' + list.map(c => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
        $('#age-box', s).style.display = TAX.sections.find(x => x.id === section).ages ? 'grid' : 'none';
      };
      f.section.onchange = () => { section = f.section.value; fillCats(); };
      $$('[data-age]', s).forEach(b => b.onclick = () => { const k = b.dataset.age; if (ages.has(k)) ages.delete(k); else ages.add(k); b.classList.toggle('on', ages.has(k)); });
      fillCats();
      syncType(); syncOr(); showPrev(); showV();

      $('#pick', s).onclick = () => $('#file', s).click();
      $('#file', s).onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        uploading = true; $('#save', s).disabled = true;
        const st = $('#up-st', s), pg = $('#prog', s), bar = $('i', pg);
        st.textContent = 'Nalagam…'; pg.hidden = false; bar.style.width = '0';
        try {
          const url = await uploadFile(file, p => bar.style.width = Math.round(p * 100) + '%');
          f.imageUrl.value = url; showPrev(); st.textContent = '✓ Naloženo' + (cfg.imgurId ? ' na Imgur' : ' v GitHub');
        } catch (err) { st.textContent = '✗ ' + err.message; st.style.color = 'var(--danger)'; }
        uploading = false; $('#save', s).disabled = false; e.target.value = '';
      };

      const del = $('#del', s);
      if (del) del.onclick = () => { if (!confirm('Izbrišem ta izdelek?')) return; FA.data.items = FA.data.items.filter(i => i.id !== it.id); FA.closeSheet(); queuePublish(); viewLooks(); };

      $('#f-look', s).onsubmit = e => {
        e.preventDefault(); const er = $('#er', s); er.textContent = '';
        if (uploading) { er.textContent = 'Počakaj, da se slika naloži.'; return; }
        const o = {
          ...it, type, vertical, companyId: f.companyId.value,
          title: f.title.value.trim(), titleEn: f.titleEn.value.trim(), descriptionEn: f.descriptionEn.value.trim(), section, ages: TAX.sections.find(x => x.id === section).ages ? [...ages] : [], sku: f.sku.value.trim(), category: f.category.value,
          price: parseNum(f.price.value), oldPrice: parseNum(f.oldPrice.value),
          sizes: f.sizes.value.split(',').map(x => x.trim()).filter(Boolean),
          model: f.model.value.trim(), description: f.description.value.trim(),
          inStock: f.inStock.checked, active: f.active.checked,
          focusY: +f.focusY.value, fit: f.contain.checked ? 'contain' : 'cover',
          imageUrl: f.imageUrl.value.trim(), videoUrl: f.videoUrl.value.trim()
        };
        if (!o.title) { er.textContent = 'Vpiši naziv izdelka.'; return; }
        if (type === 'image' && !safeUrl(o.imageUrl)) { er.textContent = 'Naloži sliko ali vstavi veljaven URL.'; return; }
        if (type === 'video' && !FA.ytParse(o.videoUrl)) { er.textContent = 'Vstavi veljavno YouTube povezavo.'; return; }
        if (isNew) FA.data.items.unshift(o);
        else { const i = FA.data.items.findIndex(x => x.id === it.id); if (i >= 0) FA.data.items[i] = o; }
        FA.closeSheet(); queuePublish(); viewLooks(); FA.toast('Shranjeno');
      };
    }
  });
}

/* množično nalaganje */
function bulkForm() {
  const D = FA.data;
  FA.openSheet({
    title: 'Več slik naenkrat', cls: 'wide',
    html: `<div class="form"><label>Podjetje<select id="b-co">${D.companies.map(c => `<option value="${esc(c.id)}" ${c.id === A.filter ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>Rubrika<select id="b-sec">${FA.getSections().map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
      <div class="note">Vsaka slika postane nov izdelek (kot <b>skrit osnutek</b>). Nato pri vsakem dopolniš naziv, šifro in ceno ter ga vklopiš z gumbom oko.</div>
      <button class="btn" id="b-pick">${ic.upload} Izberi slike</button><input type="file" id="b-file" accept="image/*" multiple hidden>
      <div id="b-list"></div></div>`,
    onMount: s => {
      $('#b-pick', s).onclick = () => $('#b-file', s).click();
      $('#b-file', s).onchange = async e => {
        const files = [...e.target.files]; if (!files.length) return;
        const co = $('#b-co', s).value, sec = $('#b-sec', s).value, list = $('#b-list', s);
        list.innerHTML = files.map((f, i) => `<div class="up-row" id="u${i}">${esc(f.name)}<br><small>čaka…</small></div>`).join('');
        $('#b-pick', s).disabled = true; $('#b-co', s).disabled = true;
        let ok = 0;
        for (let i = 0; i < files.length; i++) {
          const row = $('#u' + i, s); const sm = $('small', row);
          try {
            sm.textContent = 'nalagam…';
            const url = await uploadFile(files[i], p => sm.textContent = `nalagam… ${Math.round(p * 100)}%`);
            FA.data.items.unshift({ id: uid('l'), type: 'image', companyId: co, section: sec, ages: [], title: files[i].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), sku: '', price: '', oldPrice: '', description: '', model: '', category: '', sizes: [], imageUrl: url, videoUrl: '', vertical: true, focusY: 50, fit: 'cover', inStock: true, active: false, createdAt: Date.now() });
            sm.textContent = '✓ naloženo'; ok++;
          } catch (err) { sm.textContent = '✗ ' + err.message; sm.style.color = 'var(--danger)'; }
        }
        if (ok) { queuePublish(); A.filter = co; viewLooks(); FA.toast(`Dodanih ${ok} osnutkov – dopolni podatke in jih vklopi`, 4500); }
        $('#b-pick', s).disabled = false; $('#b-co', s).disabled = false; e.target.value = '';
      };
    }
  });
}

/* ----- PODJETJA ----- */
function viewCompanies() {
  const D = FA.data;
  view().innerHTML = `<div class="a-bar"><button class="btn primary" id="n-co">${ic.plus} Novo podjetje</button><span class="mut" style="font-size:13px">${D.companies.length} podjetij · brez omejitve</span></div>
    <div class="a-list">${D.companies.map(c => { const n = D.items.filter(i => i.companyId === c.id).length; const lg = safeUrl(c.logo); return `<div class="row ${c.active === false ? 'off' : ''}"><span class="avatar" ${lg ? `style="background-image:url('${esc(lg)}')"` : ''}>${lg ? '' : esc(c.name.charAt(0).toUpperCase())}</span><div class="grow"><b>${esc(c.name)}</b><small>${n} izdelkov${c.active === false ? ' · skrito' : ''}</small></div><button class="btn" data-c="edit" data-id="${esc(c.id)}">${ic.edit}</button><button class="btn" data-c="hide" data-id="${esc(c.id)}">${c.active === false ? ic.eye : ic.eyeOff}</button><button class="btn danger" data-c="del" data-id="${esc(c.id)}">${ic.trash}</button></div>`; }).join('') || '<div class="empty-s">Še ni podjetij.</div>'}</div>`;
  $('#n-co', view()).onclick = () => companyForm();
  $$('[data-c]', view()).forEach(b => b.onclick = () => {
    const c = D.companies.find(x => x.id === b.dataset.id); if (!c) return;
    if (b.dataset.c === 'edit') companyForm(c);
    if (b.dataset.c === 'hide') { c.active = c.active === false; queuePublish(); viewCompanies(); }
    if (b.dataset.c === 'del') {
      const n = D.items.filter(i => i.companyId === c.id).length;
      if (!confirm(`Izbrišem podjetje »${c.name}«${n ? ` in njegovih ${n} izdelkov` : ''}?`)) return;
      D.companies = D.companies.filter(x => x.id !== c.id); D.items = D.items.filter(i => i.companyId !== c.id);
      if (A.filter === c.id) A.filter = 'all';
      queuePublish(); viewCompanies();
    }
  });
}
function companyForm(co) {
  const isNew = !co;
  const c = co ? { ...co } : { id: slug('x') + '-' + Math.random().toString(36).slice(2, 6), name: '', logo: '', description: '', website: '', instagram: '', active: true, createdAt: Date.now() };
  FA.openSheet({
    title: isNew ? 'Novo podjetje' : 'Uredi podjetje',
    html: `<form class="form" id="f-co" autocomplete="off">
      <label>Ime podjetja / znamke *<input name="name" required maxlength="80" value="${esc(c.name)}"></label>
      <div class="row-b" style="gap:14px"><span class="avatar" id="lg" style="width:64px;height:64px;border-width:1px;border-color:var(--line);${safeUrl(c.logo) ? `background-image:url('${esc(safeUrl(c.logo))}')` : ''}">${safeUrl(c.logo) ? '' : '?'}</span><button type="button" class="btn" id="pick">${ic.upload} Naloži logo</button><input type="file" id="file" accept="image/*" hidden><span id="up-st" class="mut" style="font-size:13px"></span></div>
      <label>ali URL loga<input name="logo" type="url" placeholder="https://…" value="${esc(c.logo)}"></label>
      <label>Opis<textarea name="description" rows="3">${esc(c.description)}</textarea></label>
      <label>Opis v angleščini (neobvezno)<textarea name="descriptionEn" rows="3">${esc(c.descriptionEn || '')}</textarea></label>
      <div class="two"><label>Spletna stran<input name="website" type="url" placeholder="https://…" value="${esc(c.website)}"></label><label>Instagram<input name="instagram" placeholder="@uporabnik" value="${esc(c.instagram)}"></label></div>
      <label class="chk"><input type="checkbox" name="active" ${c.active !== false ? 'checked' : ''}> Vidno v aplikaciji</label>
      <p class="err" id="er"></p>
      <div class="stick"><button class="btn primary" type="submit" id="save">Shrani</button></div></form>`,
    onMount: s => {
      const f = $('#f-co', s).elements; const lg = $('#lg', s);
      const showLogo = () => { const u = safeUrl(f.logo.value); lg.style.backgroundImage = u ? `url('${u}')` : ''; lg.textContent = u ? '' : (f.name.value.charAt(0).toUpperCase() || '?'); };
      f.logo.oninput = showLogo; f.name.oninput = showLogo; showLogo();
      $('#pick', s).onclick = () => $('#file', s).click();
      $('#file', s).onchange = async e => {
        const file = e.target.files[0]; if (!file) return; const st = $('#up-st', s);
        $('#save', s).disabled = true; st.textContent = 'Nalagam…'; st.style.color = '';
        try { f.logo.value = await uploadFile(file, p => st.textContent = `Nalagam… ${Math.round(p * 100)}%`); showLogo(); st.textContent = '✓'; }
        catch (err) { st.textContent = '✗ ' + err.message; st.style.color = 'var(--danger)'; }
        $('#save', s).disabled = false; e.target.value = '';
      };
      $('#f-co', s).onsubmit = e => {
        e.preventDefault();
        const o = { ...c, name: f.name.value.trim(), logo: f.logo.value.trim(), description: f.description.value.trim(), descriptionEn: f.descriptionEn.value.trim(), website: f.website.value.trim(), instagram: f.instagram.value.trim(), active: f.active.checked };
        if (!o.name) { $('#er', s).textContent = 'Vpiši ime podjetja.'; return; }
        if (isNew) { o.id = slug(o.name) + '-' + Math.random().toString(36).slice(2, 6); FA.data.companies.push(o); A.filter = o.id; }
        else { const i = FA.data.companies.findIndex(x => x.id === c.id); if (i >= 0) FA.data.companies[i] = o; }
        FA.closeSheet(); queuePublish(); viewCompanies(); FA.toast('Shranjeno');
      };
    }
  });
}

/* ----- RUBRIKE ----- */
function ensureSections() {
  if (!FA.data.sections || !FA.data.sections.length) FA.data.sections = FA.getSections();
  return FA.data.sections;
}
function viewSections() {
  const D = FA.data, secs = FA.getSections();
  view().innerHTML = `<div class="a-bar"><button class="btn primary" id="n-sec">${ic.plus} Nova rubrika</button><span class="mut" style="font-size:13px">${secs.length} rubrik · brez omejitve</span></div>
    <div class="a-list">${secs.map(x => { const n = D.items.filter(i => (i.section || 'clothes') === x.id).length; return `<div class="row"><div class="grow"><b>${esc(x.name)}</b><small>${n} izdelkov · ${(x.cats || []).length} kategorij${x.ages ? ' · po starosti' : ''}</small></div><button class="btn" data-s="up" data-id="${esc(x.id)}">${ic.up}</button><button class="btn" data-s="down" data-id="${esc(x.id)}">${ic.down}</button><button class="btn" data-s="edit" data-id="${esc(x.id)}">${ic.edit}</button><button class="btn danger" data-s="del" data-id="${esc(x.id)}">${ic.trash}</button></div>`; }).join('')}</div>`;
  $('#n-sec', view()).onclick = () => sectionForm();
  $$('[data-s]', view()).forEach(b => b.onclick = () => {
    const list = ensureSections(), i = list.findIndex(x => x.id === b.dataset.id); if (i < 0) return;
    const a = b.dataset.s;
    if (a === 'edit') { sectionForm(list[i]); return; }
    if (a === 'del') {
      const n = D.items.filter(it => (it.section || 'clothes') === list[i].id).length;
      if (n) { FA.toast(`Rubrika ima ${n} izdelkov – najprej jih premakni v drugo rubriko.`, 5000); return; }
      if (list.length < 2) { FA.toast('Ostati mora vsaj ena rubrika.'); return; }
      if (!confirm(`Izbrišem rubriko »${list[i].name}«?`)) return;
      list.splice(i, 1); if (A.sec === b.dataset.id) A.sec = 'all';
    } else {
      const j = i + (a === 'up' ? -1 : 1); if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    }
    queuePublish(); viewSections();
  });
}
function sectionForm(sec) {
  const isNew = !sec;
  const c = sec ? { ...sec } : { id: '', name: '', nameEn: '', ages: false, cats: [], catsEn: [] };
  FA.openSheet({
    title: isNew ? 'Nova rubrika' : 'Uredi rubriko',
    html: `<form class="form" id="f-sec" autocomplete="off">
      <div class="two"><label>Ime rubrike *<input name="name" required maxlength="60" value="${esc(c.name)}"></label><label>Ime v angleščini<input name="nameEn" maxlength="60" value="${esc(c.nameEn || '')}"></label></div>
      <label>Kategorije (ena v vsaki vrstici)<textarea name="cats" rows="6">${esc((c.cats || []).join('\n'))}</textarea></label>
      <label>Kategorije v angleščini (isti vrstni red, neobvezno)<textarea name="catsEn" rows="6">${esc((c.catsEn || []).join('\n'))}</textarea></label>
      <label class="chk"><input type="checkbox" name="ages" ${c.ages ? 'checked' : ''}> Razdeli po starosti (mlajša dekleta, srednja leta, starejše ženske)</label>
      <p class="err" id="er"></p><div class="stick"><button class="btn primary" type="submit">Shrani</button></div></form>`,
    onMount: s => {
      $('#f-sec', s).onsubmit = e => {
        e.preventDefault(); const f = e.target.elements;
        const lines = v => v.split('\n').map(x => x.trim());
        const cats = lines(f.cats.value), en = lines(f.catsEn.value);
        const keep = cats.map((x, i) => x ? i : -1).filter(i => i >= 0);
        const o = { ...c, name: f.name.value.trim(), nameEn: f.nameEn.value.trim(), ages: f.ages.checked, cats: keep.map(i => cats[i]), catsEn: keep.map(i => en[i] || '') };
        if (!o.name) { $('#er', s).textContent = 'Vpiši ime rubrike.'; return; }
        const list = ensureSections();
        if (isNew) { o.id = slug(o.name) + '-' + Math.random().toString(36).slice(2, 6); list.push(o); }
        else { const i = list.findIndex(x => x.id === c.id); if (i >= 0) list[i] = o; }
        FA.closeSheet(); queuePublish(); viewSections(); FA.toast('Shranjeno');
      };
    }
  });
}

/* ----- NASTAVITVE ----- */
function viewSettings() {
  const s = FA.data.settings;
  view().innerHTML = `
  <div class="a-sec"><h3>Aplikacija in naročila</h3>
    <form class="form" id="f-set" autocomplete="off">
      <div class="two"><label>Ime aplikacije<input name="siteName" value="${esc(s.siteName)}"></label><label>Ime v angleščini<input name="siteNameEn" value="${esc(s.siteNameEn || '')}"></label></div>
      <div class="two"><label>Valuta<select name="currency">${['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'HUF', 'RON', 'SEK', 'NOK', 'DKK'].map(x => `<option ${x === s.currency ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <label>Podnaslov (v seznamu znamk)<input name="tagline" value="${esc(s.tagline)}"></label>
      <label>Podnaslov v angleščini<input name="taglineEn" value="${esc(s.taglineEn || '')}"></label>
      <label>Tvoj e-naslov za naročila *<input name="orderEmail" type="email" placeholder="ime@domena.si" value="${esc(s.orderEmail)}"></label>
      <label>Sporočilo v naročilu (plačilo, dostava…)<textarea name="orderNote" rows="2" placeholder="npr. Plačilo po povzetju, dostava v 3–5 delovnih dneh.">${esc(s.orderNote)}</textarea></label>
      <label>Sporočilo v naročilu v angleščini<textarea name="orderNoteEn" rows="2">${esc(s.orderNoteEn || '')}</textarea></label>
      <label class="chk"><input type="checkbox" name="ordersEnabled" ${s.ordersEnabled !== false ? 'checked' : ''}> Naročanje vklopljeno</label>
      <label class="chk"><input type="checkbox" name="showPrices" ${s.showPrices !== false ? 'checked' : ''}> Prikaži cene</label>
      <p class="err" id="er"></p>
      <div class="row-b"><button class="btn primary" type="submit">Shrani nastavitve</button><button type="button" class="btn" id="test">Pošlji testno sporočilo</button></div>
    </form>
    <p class="mut" style="font-size:12.5px;line-height:1.5;margin:14px 0 0">Naročila se pošiljajo prek brezplačne storitve <b>FormSubmit</b>. Ob prvem sporočilu ti pride e-pošta z gumbom <i>Activate</i> – klikni ga (enkrat). Opomba: e-naslov je zapisan v javnem <code>data.json</code>.</p>
  </div>
  <div class="a-sec"><h3>Povezava in nalaganje slik</h3>
    <p class="mut" style="margin:0 0 12px;font-size:13.5px">Repozitorij: <b style="color:var(--fg)">${esc(cfg.owner)}/${esc(cfg.repo)}</b> (${esc(cfg.branch)})</p>
    <form class="form" id="f-conn" autocomplete="off">
      <label>Imgur Client-ID (prazno = slike gredo v GitHub)<input name="imgur" value="${esc(cfg.imgurId || '')}"></label>
      <label>GitHub token (pusti prazno, če ga ne menjaš)<input name="token" type="password" placeholder="••••••••" autocomplete="off"></label>
      <p class="err" id="er2"></p>
      <button class="btn" type="submit">Shrani povezavo</button>
    </form>
  </div>
  <div class="a-sec"><h3>Varnost</h3>
    <form class="form" id="f-pw" autocomplete="off"><label>Novo geslo za admin<input name="pw" type="password" autocomplete="new-password"></label><p class="err" id="er3"></p><button class="btn" type="submit">Spremeni geslo</button></form>
    <div class="row-b" style="margin-top:16px"><button class="btn" id="logout">Odjava</button><button class="btn danger" id="wipe">Izbriši shranjene podatke na tej napravi</button></div>
  </div>`;
  const v = view();
  $('#f-set', v).onsubmit = e => {
    e.preventDefault(); const f = e.target.elements; const er = $('#er', v);
    const mail = f.orderEmail.value.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { er.textContent = 'Neveljaven e-naslov.'; return; }
    Object.assign(FA.data.settings, { siteName: f.siteName.value.trim() || 'Moda danes', siteNameEn: f.siteNameEn.value.trim(), currency: f.currency.value, tagline: f.tagline.value.trim(), taglineEn: f.taglineEn.value.trim(), orderNoteEn: f.orderNoteEn.value.trim(), orderEmail: mail, orderNote: f.orderNote.value.trim(), ordersEnabled: f.ordersEnabled.checked, showPrices: f.showPrices.checked });
    er.textContent = ''; queuePublish(); FA.toast('Shranjeno');
  };
  $('#test', v).onclick = async () => {
    const mail = $('#f-set', v).elements.orderEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { FA.toast('Najprej vpiši veljaven e-naslov'); return; }
    try { await FA.sendOrderTest(mail); FA.toast('Poslano – preveri e-pošto (ob prvem pošiljanju klikni Activate)', 5500); }
    catch (err) { FA.toast('Napaka: ' + err.message, 5000); }
  };
  $('#f-conn', v).onsubmit = async e => {
    e.preventDefault(); const f = e.target.elements; const er = $('#er2', v);
    const prev = { ...cfg };
    cfg.imgurId = f.imgur.value.trim(); if (f.token.value.trim()) cfg.token = f.token.value.trim();
    try { await gh(''); await saveCfg(); er.textContent = ''; FA.toast('Shranjeno'); f.token.value = ''; }
    catch (err) { cfg = prev; er.textContent = err.message; }
  };
  $('#f-pw', v).onsubmit = async e => {
    e.preventDefault(); const pw = e.target.elements.pw.value; const er = $('#er3', v);
    if (!pw) { er.textContent = "Vpiši geslo."; return; }
    pass = pw; await saveCfg(); e.target.reset(); er.textContent = ''; FA.toast('Geslo spremenjeno');
  };
  $('#logout', v).onclick = async () => { if (dirty) await publish(); cfg = null; pass = null; closeAdmin(); };
  $('#wipe', v).onclick = () => { if (confirm('Izbrišem token in geslo iz tega brskalnika?')) { LS.del(KEY); cfg = null; pass = null; closeAdmin(); } };
}
})();
