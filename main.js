
/* ============================================================
   MOTOR FISCAL GERMAN 2026 (identic cu cel testat și calibrat)
   ============================================================ */
const TAX_2026 = {
  grundfreibetrag: 12348,
  zone1End: 17005,
  zone2End: 69878,
  zone3End: 277825,
  soliFreigrenze: 20350,
  soliMilderungszoneEnd: 38840,
  soliRate: 0.055,
};

const SV_2026 = {
  bbgRVAV: 8450,
  bbgKVPV: 5812.50,
  kvAngajat: 0.0879,
  rvAngajat: 0.0930,
  avAngajat: 0.0130,
  pvAngajatCuCopii: 0.0180,
  pvZuschlagKinderlos: 0.0060,
};

function calcLohnsteuerAnual(zvE) {
  const { grundfreibetrag, zone1End, zone2End, zone3End } = TAX_2026;
  if (zvE <= grundfreibetrag) return 0;
  let est = 0;
  if (zvE <= zone1End) {
    const y = (zvE - grundfreibetrag) / 10000;
    est = (954.80 * y + 1400) * y;
  } else if (zvE <= zone2End) {
    const z = (zvE - zone1End) / 10000;
    est = (181.19 * z + 2397) * z + 991.21;
  } else if (zvE <= zone3End) {
    est = 0.42 * zvE - 11136.95;
  } else {
    est = 0.45 * zvE - 19471.95;
  }
  return Math.max(0, Math.round(est));
}

function calcVorsorgepauschale(jahresBrutto) {
  const rvBrutto = Math.min(jahresBrutto, SV_2026.bbgRVAV * 12);
  const rvVorsorge = rvBrutto * SV_2026.rvAngajat;
  const kvPvBrutto = Math.min(jahresBrutto, SV_2026.bbgKVPV * 12);
  const kvVorsorge = kvPvBrutto * SV_2026.kvAngajat;
  const pvVorsorge = kvPvBrutto * SV_2026.pvAngajatCuCopii;
  return rvVorsorge + kvVorsorge + pvVorsorge;
}

function calcLohnsteuerMonatlich(bruttoMonat, steuerklasse) {
  const ENTLASTUNG_ALLEINERZIEHEND = 4260;
  let jahresBrutto = bruttoMonat * 12;
  const pauschale = 1230 + 36;
  const vorsorge = calcVorsorgepauschale(jahresBrutto);
  let zvE = Math.max(0, jahresBrutto - pauschale - vorsorge);

  if (steuerklasse === 2) zvE = Math.max(0, zvE - ENTLASTUNG_ALLEINERZIEHEND);

  let lohnsteuerJahr;
  if (steuerklasse === 3) {
    lohnsteuerJahr = 2 * calcLohnsteuerAnual(zvE / 2);
  } else if (steuerklasse === 5 || steuerklasse === 6) {
    lohnsteuerJahr = calcLohnsteuerAnual(zvE + TAX_2026.grundfreibetrag);
  } else {
    lohnsteuerJahr = calcLohnsteuerAnual(zvE);
  }
  const lohnsteuerMonat = Math.max(0, lohnsteuerJahr / 12);

  let soliJahr = 0;
  if (lohnsteuerJahr > TAX_2026.soliFreigrenze) {
    if (lohnsteuerJahr <= TAX_2026.soliMilderungszoneEnd) {
      soliJahr = Math.min(lohnsteuerJahr * TAX_2026.soliRate, (lohnsteuerJahr - TAX_2026.soliFreigrenze) * 0.119);
    } else {
      soliJahr = lohnsteuerJahr * TAX_2026.soliRate;
    }
  }
  return { lohnsteuer: round2(lohnsteuerMonat), soli: round2(soliJahr / 12) };
}

function calcSozialversicherung(bruttoMonat, hatKinder) {
  const kvBrutto = Math.min(bruttoMonat, SV_2026.bbgKVPV);
  const rvBrutto = Math.min(bruttoMonat, SV_2026.bbgRVAV);
  const avBrutto = rvBrutto;
  const pvBrutto = kvBrutto;
  const kvBeitrag = kvBrutto * SV_2026.kvAngajat;
  const rvBeitrag = rvBrutto * SV_2026.rvAngajat;
  const avBeitrag = avBrutto * SV_2026.avAngajat;
  let pvRateAngajat = SV_2026.pvAngajatCuCopii;
  if (!hatKinder) pvRateAngajat += SV_2026.pvZuschlagKinderlos;
  const pvBeitrag = pvBrutto * pvRateAngajat;
  return {
    kvBeitrag: round2(kvBeitrag), rvBeitrag: round2(rvBeitrag),
    avBeitrag: round2(avBeitrag), pvBeitrag: round2(pvBeitrag),
    total: round2(kvBeitrag + rvBeitrag + avBeitrag + pvBeitrag),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
function fmt(n) { return (n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ============================================================
   STORAGE
   ============================================================ */
const STORAGE_KEY = "lohn-istoric-v1";
function loadIstoric() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveIstoricData(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; }
  catch (err) { showFlash("Nu s-au putut salva datele"); return false; }
}

/* ============================================================
   STARE
   ============================================================ */
let s = {
  luna: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })(),
  steuerklasse: 3,
  hatKinder: true,
  stdLohn1: 15.60,
  stdLohn2: 16.60,
  oreNormale: 152.0,
  oreSuplimentare: 8.0,
  zuschlagSuplimentareProcent: 25,
  oreNoapte: 0,
  zuschlagNoapteProcent: 25,
  oreDuminica: 0,
  zuschlagDuminicaProcent: 50,
  oreConcediuMedical: 0,
  oreSarbatori: 0,
  kindergartenVerpflegungActiv: true,
  kindergartenVerpflegungSuma: 40.00,
  kindergartenAllgActiv: true,
  kindergartenAllgSuma: 159.50,
  schichtfuehrerActiv: true,
  schichtfuehrerSuma: 184.50,
  oreUrlaubZuschlag: 0,
  zuschlagUrlaubProcent: 8.4,
  anwesenheitspauschaleActiv: true,
  anwesenheitspauschaleSuma: 60.00,
  arbeitskleidungActiv: true,
  arbeitskleidungSuma: 10.00,
};
let istoric = loadIstoric();
const STEUERKLASSEN = [1, 2, 3, 4, 5, 6];

/* ============================================================
   CALCUL PRINCIPAL
   ============================================================ */
function calculeaza() {
  const sumStundenlohn = round2(s.oreNormale * s.stdLohn1);
  const sumUeberstunden = round2(s.oreSuplimentare * s.stdLohn1);
  const sumUeberstdZuschlag = round2(s.oreSuplimentare * s.stdLohn2 * (s.zuschlagSuplimentareProcent / 100));
  const sumNachtschicht = round2(s.oreNoapte * s.stdLohn2 * (s.zuschlagNoapteProcent / 100));
  const sumSonntag = round2(s.oreDuminica * s.stdLohn2 * (s.zuschlagDuminicaProcent / 100));
  const sumKrankstunden = round2(s.oreConcediuMedical * s.stdLohn1);
  const sumFeiertag = round2(s.oreSarbatori * s.stdLohn1);
  const sumUrlaubZuschlag = round2(s.oreUrlaubZuschlag * s.stdLohn2 * (s.zuschlagUrlaubProcent / 100));

  const sumKita = (s.kindergartenVerpflegungActiv ? s.kindergartenVerpflegungSuma : 0) +
                  (s.kindergartenAllgActiv ? s.kindergartenAllgSuma : 0);
  const sumSchicht = s.schichtfuehrerActiv ? s.schichtfuehrerSuma : 0;
  const sumAnwesenheit = s.anwesenheitspauschaleActiv ? s.anwesenheitspauschaleSuma : 0;

  const gesamtBrutto = round2(
    sumStundenlohn + sumUeberstunden + sumUeberstdZuschlag + sumNachtschicht +
    sumSonntag + sumKrankstunden + sumFeiertag + sumUrlaubZuschlag +
    sumKita + sumSchicht + sumAnwesenheit
  );

  const steuerfreieBezuege = round2(sumKita + sumNachtschicht + sumSonntag);
  const steuerBrutto = round2(gesamtBrutto - steuerfreieBezuege);
  const svBrutto = steuerBrutto;

  const { lohnsteuer, soli } = calcLohnsteuerMonatlich(steuerBrutto, s.steuerklasse);
  const sv = calcSozialversicherung(svBrutto, s.hatKinder);

  const steuerAbzuege = round2(lohnsteuer + soli);
  const svAbzuege = sv.total;
  const arbeitskleidung = s.arbeitskleidungActiv ? s.arbeitskleidungSuma : 0;
  const nettoVerdienst = round2(gesamtBrutto - steuerAbzuege - svAbzuege);
  const auszahlung = round2(nettoVerdienst - arbeitskleidung);

  const lohnarten = [
    s.kindergartenVerpflegungActiv && { code: "034", nume: "Kindergarten B. Verpfl.", suma: s.kindergartenVerpflegungSuma, frei: true },
    s.kindergartenAllgActiv && { code: "035", nume: "Kindergarten B. allg.", suma: s.kindergartenAllgSuma, frei: true },
    { code: "100", nume: "Stundenlohn", ore: s.oreNormale, suma: sumStundenlohn },
    s.oreSuplimentare > 0 && { code: "101", nume: "Überstunden", ore: s.oreSuplimentare, suma: sumUeberstunden },
    s.oreSuplimentare > 0 && { code: "102", nume: `Überstd. Zuschlag ${s.zuschlagSuplimentareProcent}%`, ore: s.oreSuplimentare, suma: sumUeberstdZuschlag },
    s.oreNoapte > 0 && { code: "104", nume: `Nachtschichtzulage ${s.zuschlagNoapteProcent}%`, ore: s.oreNoapte, suma: sumNachtschicht, frei: true },
    s.oreDuminica > 0 && { code: "106", nume: `Sonntagszuschlag ${s.zuschlagDuminicaProcent}%`, ore: s.oreDuminica, suma: sumSonntag, frei: true },
    s.oreConcediuMedical > 0 && { code: "108", nume: "Krankstunden", ore: s.oreConcediuMedical, suma: sumKrankstunden },
    s.oreSarbatori > 0 && { code: "109", nume: "Feiertagsstunden", ore: s.oreSarbatori, suma: sumFeiertag },
    s.schichtfuehrerActiv && { code: "150", nume: "Schichtführerzulage", suma: sumSchicht },
    s.oreUrlaubZuschlag > 0 && { code: "181", nume: `Zuschlag Urlaub ${s.zuschlagUrlaubProcent}%`, ore: s.oreUrlaubZuschlag, suma: sumUrlaubZuschlag },
    s.anwesenheitspauschaleActiv && { code: "190", nume: "Anwesenheitspauschale", suma: sumAnwesenheit },
  ].filter(Boolean);

  return { lohnarten, gesamtBrutto, steuerfreieBezuege, steuerBrutto, lohnsteuer, soli, steuerAbzuege, sv, svAbzuege, nettoVerdienst, arbeitskleidung, auszahlung };
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  document.getElementById("inpLuna").value = s.luna;
  document.getElementById("lblLuna").textContent = s.luna;

  const pillBox = document.getElementById("pillSteuerklasse");
  pillBox.innerHTML = "";
  STEUERKLASSEN.forEach(k => {
    const btn = document.createElement("button");
    btn.className = "pill" + (s.steuerklasse === k ? " active" : "");
    btn.textContent = k;
    btn.onclick = () => { s.steuerklasse = k; render(); };
    pillBox.appendChild(btn);
  });

  setToggle("toggleHatKinder", s.hatKinder, v => { s.hatKinder = v; render(); });
  setNumValue("inpStdLohn1", s.stdLohn1);
  setNumValue("inpStdLohn2", s.stdLohn2);
  setNumValue("inpOreNormale", s.oreNormale);
  setNumValue("inpOreSuplimentare", s.oreSuplimentare);
  setNumValue("inpZuschlagSuplimentare", s.zuschlagSuplimentareProcent);
  setNumValue("inpOreNoapte", s.oreNoapte);
  setNumValue("inpOreDuminica", s.oreDuminica);
  setNumValue("inpZuschlagNoapte", s.zuschlagNoapteProcent);
  setNumValue("inpZuschlagDuminica", s.zuschlagDuminicaProcent);
  setNumValue("inpOreConcediuMedical", s.oreConcediuMedical);
  setNumValue("inpOreSarbatori", s.oreSarbatori);
  setNumValue("inpOreUrlaubZuschlag", s.oreUrlaubZuschlag);
  setNumValue("inpZuschlagUrlaub", s.zuschlagUrlaubProcent);

  setToggle("toggleKindergartenVerpflegung", s.kindergartenVerpflegungActiv, v => { s.kindergartenVerpflegungActiv = v; render(); });
  setNumValue("inpKindergartenVerpflegung", s.kindergartenVerpflegungSuma);
  setToggle("toggleKindergartenAllg", s.kindergartenAllgActiv, v => { s.kindergartenAllgActiv = v; render(); });
  setNumValue("inpKindergartenAllg", s.kindergartenAllgSuma);
  setToggle("toggleSchichtfuehrer", s.schichtfuehrerActiv, v => { s.schichtfuehrerActiv = v; render(); });
  setNumValue("inpSchichtfuehrer", s.schichtfuehrerSuma);
  setToggle("toggleAnwesenheit", s.anwesenheitspauschaleActiv, v => { s.anwesenheitspauschaleActiv = v; render(); });
  setNumValue("inpAnwesenheit", s.anwesenheitspauschaleSuma);
  setToggle("toggleArbeitskleidung", s.arbeitskleidungActiv, v => { s.arbeitskleidungActiv = v; render(); });
  setNumValue("inpArbeitskleidung", s.arbeitskleidungSuma);

  const calc = calculeaza();

  document.getElementById("lblLohnsteuer").textContent = `Lohnsteuer (Kl. ${s.steuerklasse})`;

  const tbl = document.getElementById("tblLohnarten");
  tbl.innerHTML = calc.lohnarten.map(l => `
    <tr>
      <td class="code">${l.code}</td>
      <td>${l.nume}${l.frei ? '<span class="tag">frei</span>' : ''}</td>
      <td class="num muted">${l.ore ? fmt(l.ore) + ' h' : '—'}</td>
      <td class="num">${fmt(l.suma)}</td>
    </tr>
  `).join("");

  document.getElementById("outGesamtBrutto").textContent = fmt(calc.gesamtBrutto) + " €";
  document.getElementById("outSteuerBrutto").textContent = fmt(calc.steuerBrutto) + " €";
  document.getElementById("outSteuerfrei").textContent = fmt(calc.steuerfreieBezuege) + " €";
  document.getElementById("outLohnsteuer").textContent = fmt(calc.lohnsteuer) + " €";
  document.getElementById("outSoli").textContent = fmt(calc.soli) + " €";
  document.getElementById("outKv").textContent = fmt(calc.sv.kvBeitrag) + " €";
  document.getElementById("outRv").textContent = fmt(calc.sv.rvBeitrag) + " €";
  document.getElementById("outAv").textContent = fmt(calc.sv.avBeitrag) + " €";
  document.getElementById("outPv").textContent = fmt(calc.sv.pvBeitrag) + " €";
  document.getElementById("outSteuerAbzuege").textContent = fmt(calc.steuerAbzuege) + " €";
  document.getElementById("outSvAbzuege").textContent = fmt(calc.svAbzuege) + " €";
  document.getElementById("outNetto").textContent = fmt(calc.nettoVerdienst) + " €";
  document.getElementById("outAuszahlung").textContent = fmt(calc.auszahlung) + " €";
  document.getElementById("heroAuszahlung").textContent = fmt(calc.auszahlung) + " €";

  const rowAK = document.getElementById("rowArbeitskleidung");
  if (calc.arbeitskleidung > 0) {
    rowAK.style.display = "";
    document.getElementById("outArbeitskleidung").textContent = "− " + fmt(calc.arbeitskleidung) + " €";
  } else {
    rowAK.style.display = "none";
  }

  renderIstoric();
}

function setNumValue(id, value) {
  const el = document.getElementById(id);
  // nu suprascriem câmpul cât utilizatorul scrie în el (altfel virgula/cifrele se pierd la fiecare tastă)
  if (document.activeElement === el) return;
  // afișăm cu virgulă, fără zerouri inutile pentru valori întregi simple
  const str = Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  el.value = str;
}

function setToggle(id, value, onChange) {
  const el = document.getElementById(id);
  el.className = "toggle " + (value ? "on" : "off");
  el.onclick = () => onChange(!value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function renderIstoric() {
  const badge = document.getElementById("istoricBadge");
  if (istoric.length > 0) { badge.style.display = ""; badge.textContent = istoric.length; }
  else badge.style.display = "none";

  const container = document.getElementById("istoricContainer");
  if (istoric.length === 0) {
    document.getElementById("istoricSummary").innerHTML = "";
    document.getElementById("istoricChart").innerHTML = "";
    container.innerHTML = `<p class="empty">Nu ai salvat încă nicio lună. Calculează un fluturaș și apasă „Salvează luna în istoric”.</p>`;
    return;
  }
  const sorted = [...istoric].sort((a, b) => b.luna.localeCompare(a.luna));
  const values = sorted.map(x => Number(x.rezultat?.auszahlung) || 0);
  const avg = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  const max = values.length ? Math.max(...values) : 0;
  document.getElementById("istoricSummary").innerHTML = `<div class="summary-tile"><span>Luni salvate</span><strong>${sorted.length}</strong></div><div class="summary-tile"><span>Medie încasată</span><strong>${fmt(avg)} €</strong></div><div class="summary-tile"><span>Cea mai mare</span><strong>${fmt(max)} €</strong></div>`;
  document.getElementById("istoricChart").innerHTML = [...sorted].reverse().slice(-8).map(entry => { const amount = Math.max(0, Number(entry.rezultat?.auszahlung)||0); const height = max > 0 ? Math.max(4, amount/max*78) : 4; return `<div class="chart-col" title="${escapeHtml(entry.luna)} · ${fmt(amount)} €"><div class="chart-bar" style="height:${height}%"></div><span class="chart-label">${escapeHtml(String(entry.luna||"").slice(5))}</span></div>`; }).join("");
  container.innerHTML = `<div class="istoric-list">` + sorted.map(entry => `
    <div class="istoric-card">
      <div class="istoric-info">
        <div class="istoric-luna">${escapeHtml(entry.luna)}</div>
        <div class="istoric-detalii">Brutto ${fmt(entry.rezultat.gesamtBrutto)} € · Netto ${fmt(entry.rezultat.nettoVerdienst)} € · Steuerklasse ${escapeHtml(entry.state.steuerklasse)}</div>
      </div>
      <div class="istoric-suma">${fmt(entry.rezultat.auszahlung)} €</div>
      <div class="istoric-actions">
        <button onclick="incarcaDinIstoric('${escapeHtml(entry.id)}')">Încarcă</button>
        <button class="danger" onclick="stergeDinIstoric('${escapeHtml(entry.id)}')">Șterge</button>
      </div>
    </div>
  `).join("") + `</div>`;
}

function incarcaDinIstoric(id) {
  const entry = istoric.find(i => i.id === id);
  if (!entry) return;
  s = { ...entry.state };
  document.getElementById("tabCalculBtn").click();
  render();
}

function stergeDinIstoric(id) {
  istoric = istoric.filter(i => i.id !== id);
  saveIstoricData(istoric);
  renderIstoric();
}

function showFlash(msg) {
  const el = document.getElementById("flash");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function parseNumberInput(raw) {
  if (raw == null) return 0;
  // acceptă atât virgulă cât și punct ca separator decimal
  const normalizat = String(raw).trim().replace(",", ".");
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalizat)) return 0;
  const val = Number(normalizat);
  return !Number.isFinite(val) ? 0 : Math.max(0, val);
}

function bindNumber(id, key) {
  document.getElementById(id).addEventListener("input", e => {
    s[key] = parseNumberInput(e.target.value);
    render();
  });
}

document.getElementById("inpLuna").addEventListener("change", e => { s.luna = e.target.value; render(); });

bindNumber("inpStdLohn1", "stdLohn1");
bindNumber("inpStdLohn2", "stdLohn2");
bindNumber("inpOreNormale", "oreNormale");
bindNumber("inpOreSuplimentare", "oreSuplimentare");
bindNumber("inpZuschlagSuplimentare", "zuschlagSuplimentareProcent");
bindNumber("inpOreNoapte", "oreNoapte");
bindNumber("inpOreDuminica", "oreDuminica");
bindNumber("inpZuschlagNoapte", "zuschlagNoapteProcent");
bindNumber("inpZuschlagDuminica", "zuschlagDuminicaProcent");
bindNumber("inpOreConcediuMedical", "oreConcediuMedical");
bindNumber("inpOreSarbatori", "oreSarbatori");
bindNumber("inpOreUrlaubZuschlag", "oreUrlaubZuschlag");
bindNumber("inpZuschlagUrlaub", "zuschlagUrlaubProcent");
bindNumber("inpKindergartenVerpflegung", "kindergartenVerpflegungSuma");
bindNumber("inpKindergartenAllg", "kindergartenAllgSuma");
bindNumber("inpSchichtfuehrer", "schichtfuehrerSuma");
bindNumber("inpAnwesenheit", "anwesenheitspauschaleSuma");
bindNumber("inpArbeitskleidung", "arbeitskleidungSuma");

document.getElementById("btnSalveaza").addEventListener("click", () => {
  const calc = calculeaza();
  const entry = {
    id: `${s.luna}-${Date.now()}`,
    luna: s.luna,
    state: { ...s },
    rezultat: { gesamtBrutto: calc.gesamtBrutto, auszahlung: calc.auszahlung, nettoVerdienst: calc.nettoVerdienst },
  };
  istoric = [entry, ...istoric.filter(i => i.luna !== s.luna)];
  saveIstoricData(istoric);
  showFlash("✓ Salvat în istoric");
  renderIstoric();
});

document.getElementById("tabCalculBtn").addEventListener("click", () => {
  document.getElementById("tabCalculBtn").classList.add("active");
  document.getElementById("tabIstoricBtn").classList.remove("active");
  document.getElementById("tabCalcul").style.display = "";
  document.getElementById("tabIstoric").style.display = "none";
});
document.getElementById("tabIstoricBtn").addEventListener("click", () => {
  document.getElementById("tabIstoricBtn").classList.add("active");
  document.getElementById("tabCalculBtn").classList.remove("active");
  document.getElementById("tabCalcul").style.display = "none";
  document.getElementById("tabIstoric").style.display = "";
});


/* ============================================================
   EXPORT, BACKUP, RESTAURARE ȘI PRINT
   ============================================================ */
function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

document.getElementById("btnPrint").addEventListener("click", () => window.print());
document.getElementById("btnExport").addEventListener("click", () => {
  const backup = { app: "Fluturaș Pro", version: 2, exportedAt: new Date().toISOString(), currentState: s, history: istoric };
  downloadBlob(JSON.stringify(backup, null, 2), "application/json", `fluturas-backup-${s.luna}.json`);
  showFlash("Backup descărcat");
});
document.getElementById("btnImport").addEventListener("click", () => document.getElementById("fileImport").click());
document.getElementById("fileImport").addEventListener("change", async e => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const importedHistory = Array.isArray(data) ? data : data.history;
    if (!Array.isArray(importedHistory)) throw new Error("Format invalid");
    const clean = importedHistory.filter(x => x && typeof x.luna === "string" && x.state && x.rezultat && /^\d{4}-\d{2}$/.test(x.luna));
    if (!clean.length && importedHistory.length) throw new Error("Nu am găsit înregistrări valide");
    if (!confirm(`Restaurăm ${clean.length} înregistrări? Lunile cu aceeași dată vor fi înlocuite.`)) return;
    istoric = [...clean.filter(x => x.luna !== s.luna), ...clean.filter(x => x.luna === s.luna)];
    const unique = new Map(); clean.forEach(x => unique.set(x.luna, x)); istoric = [...unique.values()];
    if (data.currentState && !Array.isArray(data)) s = { ...s, ...data.currentState };
    saveIstoricData(istoric); render(); showFlash("Date restaurate cu succes");
  } catch (err) { alert("Fișierul nu este un backup Fluturaș valid."); }
  finally { e.target.value = ""; }
});
document.getElementById("btnCsv").addEventListener("click", () => {
  if (!istoric.length) { showFlash("Nu există luni salvate"); return; }
  const rows = [["Luna","Steuerklasse","Brutto EUR","Netto EUR","De incasat EUR"], ...[...istoric].sort((a,b)=>a.luna.localeCompare(b.luna)).map(x => [x.luna,x.state?.steuerklasse,x.rezultat?.gesamtBrutto,x.rezultat?.nettoVerdienst,x.rezultat?.auszahlung])];
  const csv = "\uFEFF" + rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(";")).join("\r\n");
  downloadBlob(csv, "text/csv;charset=utf-8", "fluturas-istoric.csv");
});

render();
