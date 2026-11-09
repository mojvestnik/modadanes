# Moda danes (PWA za telefon in računalnik)

Pokončni (9:16) feed z modelkami: **swipe gor/dol** = naslednji look, **swipe levo/desno** = druga znamka. Neomejeno podjetij, košarica, naročilo po e-pošti, admin.

## 1. Namestitev na GitHub Pages
1. Naredi **javen** repozitorij (npr. `runway`) in naloži vse datoteke iz te mape (vključno z `data/` in `demo/`).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Čez ~1 min je aplikacija na `https://UPORABNIK.github.io/runway/`.
4. Na telefonu: Deli → *Dodaj na začetni zaslon* (deluje kot aplikacija).

## 2. GitHub token (za admin)
GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained** → Only select repositories (tvoj repo) → Permissions → **Contents: Read and write**.

## 3. Prva prijava v admin
Klikni ikono osebe **zgoraj desno** → izpolni repozitorij, token, (neobvezno) Imgur Client-ID in si izmisli **geslo**. Token se šifrira (AES-GCM) z geslom in shrani samo v tem brskalniku. Na vsaki napravi (telefon, računalnik) je prva nastavitev enkratna.

## 4. Delo v adminu
- **Podjetja**: dodaj poljubno število (ime, logo, opis, splet, Instagram).
- **Looki**: nova fotografija 9:16, YouTube video (pokončen ali ležeč), ali več slik naenkrat (nastanejo kot skriti osnutki). Za vsak look: naziv, šifra artikla, cena, stara cena, velikosti, modelka, kategorija, opis, zaloga.
- **Nastavitve**: tvoj e-naslov za naročila, valuta, sporočilo o plačilu/dostavi.
- Vsaka sprememba se samodejno objavi v `data/data.json` na GitHubu; javna stran se osveži v ~1 minuti.

## 5. Slike
- Z Imgur Client-ID (`api.imgur.com/oauth2/addclient`, *Anonymous usage*) se slike naložijo na Imgur.
- Brez Client-ID se naložijo v mapo `uploads/` v tvojem repozitoriju.
- Lahko tudi prilepiš URL katere koli slike.

## 6. Naročila po e-pošti
V Nastavitvah vpiši svoj e-naslov. Naročila gredo prek brezplačnega **FormSubmit**; ob prvem sporočilu ti pride e-pošta z gumbom *Activate* – klikni ga enkrat (uporabi gumb "Pošlji testno sporočilo"). Naročilo vsebuje ime, naslov, telefon, in za vsak artikel naziv, šifro, velikost, znamko, ceno in povezavo.

## Opombe
- Geslo ščiti dostop do shranjenega tokena na napravi; prava zaščita pisanja je GitHub token (omeji ga na en repozitorij).
- Tvoj e-naslov za naročila je zapisan v javnem `data/data.json`.
- Demo podatke (Demo Atelier) izbriši v adminu.

## Rubrike in jezik
- Rubrike: Oblačila, Kozmetika, Kozmetični pripomočki, Nakit za ženske (izbereš jih pri vsakem izdelku v adminu).
- Pri oblačilih izbereš za koga: mlajša dekleta, srednja leta, starejše ženske (lahko več, prazno = vse).
- Gumb SL/EN zgoraj desno; privzeto slovensko. Angleške nazive in opise vpišeš v adminu (neobvezno, sicer se prikaže slovenski).
- Poljubno število rubrik in podjetij: Admin → **Rubrike** (ime, angleško ime, kategorije, razdelitev po starosti) in Admin → **Podjetja**.
