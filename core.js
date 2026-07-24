"use strict";

// ================================================================
// FINMOB  -  Production JS
// Architecture:
//   - No inline onclick strings (event delegation only)
//   - No emoji inside JS alert/error strings
//   - All async functions wrapped in try/catch
//   - Single source of truth per data type
//   - DOM helpers for safe element creation
// ================================================================

// ── SERVICE WORKER ──────────────────────────────────────────────
if ("serviceWorker" in navigator && location.hostname === "sreejithshan.github.io") {
  navigator.serviceWorker.register("/Expense/sw.js", { scope: "/Expense/" })
    .then(function(reg) {
      reg.update();
      reg.addEventListener("updatefound", function() {
        var nw = reg.installing;
        nw.addEventListener("statechange", async function() {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            await safeBackupBeforeReload();
            location.reload();
          }
        });
      });
    }).catch(function(e) { console.warn("SW:", e); });
}

// ── INDEXEDDB ────────────────────────────────────────────────────
var DB_NAME = "FinMobDB", DB_VER = 8;
var db;

function openDB() {
  return new Promise(function(res, rej) {
    var r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = function(e) {
      var d = e.target.result;
      ["expenses","incomes","savings","withdrawals","debts","payments",
       "banks","people","documents","appointments","notifLog","rollover",
       "bills","cheques","otherpays","config"].forEach(function(s) {
        if (!d.objectStoreNames.contains(s)) {
          d.createObjectStore(s, { keyPath: s === "config" ? "key" : "id" });
        }
      });
    };
    r.onsuccess = function(e) { db = e.target.result; res(db); };
    r.onerror = rej;
  });
}
function dbAll(s) {
  return new Promise(function(res, rej) {
    var r = db.transaction(s, "readonly").objectStore(s).getAll();
    r.onsuccess = function() { res(r.result || []); };
    r.onerror = rej;
  });
}
function dbGet(s, k) {
  return new Promise(function(res, rej) {
    var r = db.transaction(s, "readonly").objectStore(s).get(k);
    r.onsuccess = function() { res(r.result); };
    r.onerror = rej;
  });
}
function dbPut(s, item) {
  return new Promise(function(res, rej) {
    var r = db.transaction(s, "readwrite").objectStore(s).put(item);
    r.onsuccess = function() { res(r.result); scheduleBackup(); };
    r.onerror = rej;
  });
}
function dbDel(s, id) {
  return new Promise(function(res, rej) {
    var r = db.transaction(s, "readwrite").objectStore(s).delete(id);
    r.onsuccess = function() { res(); scheduleBackup(); };
    r.onerror = rej;
  });
}

// ── PIN ──────────────────────────────────────────────────────────
var pinBuf = "", pinMode = "enter", newPinBuf = "";

function randomSaltHex() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
}
async function sha256Hex(str) {
  try {
    if (!window.crypto || !window.crypto.subtle) return null; // unsupported context, caller falls back
    var enc = new TextEncoder().encode(str);
    var buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
  } catch(e) { console.warn("sha256Hex:", e); return null; }
}
// Stores the PIN as a salted hash. Falls back to legacy plaintext storage
// only if Web Crypto is unavailable (very old/insecure context) so PIN
// protection never silently breaks.
async function savePin(pin) {
  var salt = randomSaltHex();
  var hash = await sha256Hex(salt + ":" + pin);
  if (hash) { await dbPut("config", { key:"pin", salt:salt, hash:hash }); }
  else { await dbPut("config", { key:"pin", value: pin }); }
}
// Verifies an entered PIN against the stored record. Understands both the
// new salted-hash format and the legacy plaintext format (for anyone who
// already had a PIN set before this change) — and silently upgrades a
// legacy record to the hashed format the moment it's successfully verified,
// so existing users are never locked out and everyone converges to the
// safer format over time.
async function verifyAndMigratePin(pin) {
  var cfg = await dbGet("config", "pin");
  if (!cfg) return false;
  if (cfg.hash && cfg.salt) {
    var h = await sha256Hex(cfg.salt + ":" + pin);
    return h !== null && h === cfg.hash;
  }
  if (cfg.value !== undefined) {
    if (cfg.value === pin) { await savePin(pin); return true; }
    return false;
  }
  return false;
}

async function initPin() {
  try {
    var cfg = await dbGet("config", "pin");
    if (!cfg) { showPin("setup"); }
    else { showPin("enter"); el("pinChangeBtn").style.display = "block"; }
  } catch(e) { showPin("setup"); }
}
function showPin(mode) {
  var titles = { enter:"Enter PIN", setup:"Set Up Your PIN",
    "ch-old":"Enter Current PIN", "ch-new":"Enter New PIN", "ch-confirm":"Confirm New PIN" };
  pinMode = mode; pinBuf = "";
  el("pinTitle").textContent = titles[mode] || mode;
  updateDots(); el("pinErr").textContent = "";
  el("pinScreen").style.display = "flex";
  el("app").style.display = "none";
}
function updateDots() {
  for (var i = 0; i < 4; i++)
    el("pd" + i).className = "pdot" + (i < pinBuf.length ? " filled" : "");
}
function pp(d) {
  if (pinBuf.length >= 4) return;
  pinBuf += String(d); updateDots();
  if (pinBuf.length === 4) setTimeout(handlePin, 280);
}
function ppDel() { if (pinBuf.length > 0) { pinBuf = pinBuf.slice(0, -1); updateDots(); } }
async function handlePin() {
  try {
    if (pinMode === "setup") {
      await savePin(pinBuf);
      unlockApp();
    } else if (pinMode === "enter") {
      var ok = await verifyAndMigratePin(pinBuf);
      if (ok) { unlockApp(); }
      else { el("pinErr").textContent = "Wrong PIN"; pinBuf = ""; updateDots(); }
    } else if (pinMode === "ch-old") {
      var ok2 = await verifyAndMigratePin(pinBuf);
      if (ok2) {
        pinMode = "ch-new"; pinBuf = "";
        el("pinTitle").textContent = "Enter New PIN"; updateDots(); el("pinErr").textContent = "";
      } else { el("pinErr").textContent = "Wrong PIN"; pinBuf = ""; updateDots(); }
    } else if (pinMode === "ch-new") {
      newPinBuf = pinBuf; pinMode = "ch-confirm"; pinBuf = "";
      el("pinTitle").textContent = "Confirm New PIN"; updateDots();
    } else if (pinMode === "ch-confirm") {
      if (pinBuf === newPinBuf) {
        await savePin(pinBuf);
        alert("PIN changed successfully!"); unlockApp();
      } else {
        el("pinErr").textContent = "PINs do not match";
        pinMode = "ch-new"; pinBuf = ""; newPinBuf = "";
        el("pinTitle").textContent = "Enter New PIN"; updateDots();
      }
    }
  } catch(e) { console.error("PIN error:", e); }
}
function startChangePin() { showPin("ch-old"); el("pinChangeBtn").style.display = "none"; }
async function unlockApp() {
  el("pinScreen").style.display = "none";
  el("app").style.display = "block";
  el("pinChangeBtn").style.display = "block";
  await renderAll();
  updateEmailUI();
  checkNotifications();
  checkDailyBackupReminder();
  checkAppointmentCarryForward();
  checkPaymentNotifications();
}

// ── DARK MODE ────────────────────────────────────────────────────
function toggleDark() {
  var d = document.body.classList.toggle("dark");
  localStorage.setItem("fm_dark", d ? "1" : "0");
  el("darkBtn").textContent = d ? "☀️" : "🌙";
  var sb = el("darkSettingBtn"); if (sb) sb.textContent = d ? "Disable" : "Enable";
}
function initDarkMode() {
  if (localStorage.getItem("fm_dark") === "1") {
    document.body.classList.add("dark");
    el("darkBtn").textContent = "☀️";
  }
}

// ── CATEGORIES ───────────────────────────────────────────────────
var EXP_CATS = [
  { id:"rent",          label:"Rent",          icon:"🏠", subs:null },
  { id:"food",          label:"Food & Dining",  icon:"🍽️", subs:[
    { id:"restaurant",  label:"Restaurant",     icon:"🍴" },
    { id:"cafe",        label:"Cafe",           icon:"☕" },
    { id:"delivery",    label:"Delivery",       icon:"🛵" },
    { id:"takeout",     label:"Takeout",        icon:"🥡" },
    { id:"food_o",      label:"Others",         icon:"📌" }
  ]},
  { id:"car",           label:"Car",            icon:"🚗", subs:[
    { id:"fuel",        label:"Fuel",           icon:"⛽" },
    { id:"car_ins",     label:"Insurance",      icon:"🛡️" },
    { id:"tolls",       label:"Tolls",          icon:"🛣️" },
    { id:"car_svc",     label:"Service & Repair",icon:"🔧" },
    { id:"car_o",       label:"Others",         icon:"📌" }
  ]},
  { id:"transport",     label:"Transport",      icon:"🚌", subs:null },
  { id:"school",        label:"School",         icon:"🎓", subs:[
    { id:"tuition",     label:"Tuition Fees",   icon:"🏫" },
    { id:"trans_fee",   label:"Transport Fees", icon:"🚌" },
    { id:"school_o",    label:"Others",         icon:"📌" }
  ]},
  { id:"groceries",     label:"Groceries",      icon:"🛒", subs:null },
  { id:"spa",           label:"Spa",            icon:"💆", subs:null },
  { id:"entertainment", label:"Entertainment",  icon:"🎬", subs:[
    { id:"shopping",    label:"Online Shopping",icon:"🛍️" },
    { id:"movies",      label:"Movies",         icon:"🎥" },
    { id:"clothing",    label:"Clothing",       icon:"👗" },
    { id:"holiday",     label:"Holiday",        icon:"✈️" },
    { id:"ent_o",       label:"Others",         icon:"📌" }
  ]},
  { id:"utilities",     label:"Utilities",      icon:"💡", subs:[
    { id:"electricity", label:"Electricity",    icon:"⚡" },
    { id:"phone",       label:"Phone",          icon:"📱" },
    { id:"internet",    label:"Internet",       icon:"🌐" },
    { id:"gas",         label:"Gas Bill",       icon:"🔥" },
    { id:"util_o",      label:"Others",         icon:"📌" }
  ]},
  { id:"medical",       label:"Medical",        icon:"🏥", subs:null },
  { id:"insurance",     label:"Insurance",      icon:"🛡️", subs:null },
  { id:"remittance",    label:"Remittance",     icon:"💸", subs:null },
  { id:"other",         label:"Others",         icon:"📌", subs:null },
  { id:"emi",           label:"EMI Payment",    icon:"🏦", subs:null }
];
var INC_CATS = [
  { id:"salary",    label:"Salary",   icon:"💼" },
  { id:"business",  label:"Business", icon:"🏪" },
  { id:"gift",      label:"Gift",     icon:"🎁" },
  { id:"other_i",   label:"Others",   icon:"➕" }
];
var SAV_TYPES = [
  { id:"cash",       label:"Cash",          icon:"💵" },
  { id:"mf",         label:"Mutual Funds",  icon:"📈" },
  { id:"shares",     label:"Shares",        icon:"📊" },
  { id:"gold",       label:"Gold",          icon:"🪙" },
  { id:"fd",         label:"Fixed Deposit", icon:"🏦" },
  { id:"other",      label:"Others",        icon:"➕" },
  { id:"withdrawal", label:"Withdrawal",    icon:"💸" }
];
var DEBT_LABELS  = { mortgage:"Mortgage", gold:"Gold Loan", personal:"Personal Loan", car:"Car Loan", other:"Others" };
var DOC_LABELS   = { govt_id:"Government ID", visa:"Visa", passport:"Passport", driving:"Driving License", tenancy:"Tenancy Contract", other:"Others" };
var DOC_NUMLBL   = { govt_id:"ID Number", visa:"Visa Number", passport:"Passport No", driving:"License No", tenancy:"Contract No", other:"Document No" };
var APPT_ICONS   = { doctor:"🩺", service:"🔧", spa:"💆", other:"📋" };
var APPT_COLORS  = { doctor:"#fce4ec", service:"#e8f5e9", spa:"#f3e5f5", other:"#f3f0ff" };
var BILL_CATS    = {
  electricity:{ label:"Electricity Bill", icon:"⚡" },
  phone:      { label:"Phone Bill",       icon:"📱" },
  internet:   { label:"Internet Bill",    icon:"🌐" },
  school:     { label:"School Fees",      icon:"🎓" },
  custom:     { label:"Custom Bill",      icon:"🧾" }
};

// ── UTILS ────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function elSet(id, prop, val) { var e = document.getElementById(id); if (e) e[prop] = val; }
function elStyle(id, val) { var e = document.getElementById(id); if (e) e.style.display = val; }
function sanitize(str) {
  var m = {'<':'&lt;', '>':'&gt;', '"':'&quot;', '&':'&amp;'};
  return (str || '').replace(/[<>"&]/g, function(c) { return m[c]; });
}
function numVal(id, def) { var e = el(id); return e ? (parseFloat(e.value) || def || 0) : (def || 0); }
function strVal(id) { var e = el(id); return e ? e.value.trim() : ""; }
function fmt(n) { return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits:0, maximumFractionDigits:2 }); }
function mkid() { return Date.now() + "-" + Math.random().toString(36).slice(2, 6); }
function todayStr() { return fmtDate(new Date()); }
function fmtDate(d) { return d.toISOString().slice(0, 10); }
function mKey(d) { return (d || "").slice(0, 7); }
function curM() { return mKey(todayStr()); }
function mLabel(k) {
  if (!k) return "";
  var parts = k.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString(undefined, { month:"long", year:"numeric" });
}
function catInfo(id, isInc) {
  var pool = isInc ? INC_CATS : EXP_CATS;
  for (var i = 0; i < pool.length; i++) {
    if (pool[i].id === id) return pool[i];
    if (pool[i].subs) {
      var s = pool[i].subs.filter(function(x) { return x.id === id; })[0];
      if (s) return s;
    }
  }
  return { label: id, icon:"📌" };
}
function savInfo(id) { return SAV_TYPES.filter(function(s) { return s.id === id; })[0] || { label:id, icon:"📌" }; }
async function fileToDataURL(file) {
  if (!file) return null;
  return new Promise(function(res) { var r = new FileReader(); r.onload = function(e) { res(e.target.result); }; r.readAsDataURL(file); });
}
// Shared action-sheet button builder, used by every module's action menu
// (Bank, Debt, Documents, Appointments, Bills, Cheques, Income, Expense,
// Savings, Withdrawals). Centralized here instead of each module defining
// its own identical local copy.
function mkB(cls, txt, fn, extraStyle) {
  var b = document.createElement("button");
  b.className = cls;
  b.textContent = txt;
  b.style.cssText = "padding:14px;font-size:15px;" + (extraStyle || "");
  b.addEventListener("click", fn);
  return b;
}
// Centralized validation rules, used consistently by every add/edit save
// function across the app instead of each one repeating its own copy of
// the same check. These are pure - no alert, no focus, no side effects -
// so each call site keeps its own exact existing behavior on failure
// (some focus a field, some show a custom message); only the underlying
// rule itself is shared, so a gap fixed once (e.g. rejecting negative
// values) is fixed everywhere that uses it.
function isPositiveAmount(value) {
  var n = parseFloat(value);
  return !!n && n > 0;
}
function allRequired(values) {
  for (var i = 0; i < values.length; i++) { if (!values[i]) return false; }
  return true;
}

// ── RENDER ALL ───────────────────────────────────────────────────
async function renderAll() {
  try {
    if (!db) { console.warn("DB not ready"); return; }
    await checkMonthRollover();
    var mk = curM(), today = todayStr();
    var results = await Promise.all([dbAll("expenses"), dbAll("incomes"), dbAll("savings"), dbAll("payments"), dbAll("debts"), dbAll("withdrawals")]);
    var exps = results[0], incs = results[1], savs = results[2], pmts = results[3], debts = results[4], wds = results[5];
    var mExp = exps.filter(function(e) { return mKey(e.date) === mk; });
    var mInc = incs.filter(function(e) { return mKey(e.date) === mk; });
    var mSav = savs.filter(function(e) { return mKey(e.date) === mk; });
    var spent    = mExp.reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
    var earned   = mInc.reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
    var savedM   = mSav.reduce(function(s, e) { return s + Number(e.amount || e.totalVal || 0); }, 0);
    var totalWd  = wds.reduce(function(s, w) { return s + Number(w.amount || 0); }, 0);
    var savAll   = Math.max(0, savs.reduce(function(s, e) { return s + Number(e.amount || e.totalVal || 0); }, 0) - totalWd);
    var totalDebtRem = debts.reduce(function(sum, d) {
      var paid = pmts.filter(function(p) { return p.debtId === d.id; }).reduce(function(s, p) { return s + Number(p.amount || 0); }, 0);
      return sum + Math.max(0, Number(d.total || 0) - paid);
    }, 0);
    var bal = earned - spent - savedM;
    el("balVal").textContent = (bal < 0 ? "-" : "") + fmt(Math.abs(bal));
    el("bInc").textContent = fmt(earned);
    el("bSpent").textContent = fmt(spent);
    el("bSaved").textContent = fmt(savedM);
    el("todayV").textContent = fmt(exps.filter(function(e) { return e.date === today; }).reduce(function(s, e) { return s + Number(e.amount || 0); }, 0));
    el("mIncV").textContent = fmt(earned);
    el("totalSavV").textContent = fmt(savAll);
    if (el("savAllV"))  el("savAllV").textContent  = fmt(savAll);
    if (el("savMonthV"))el("savMonthV").textContent = fmt(savedM);
    if (el("savWithdrawV")) el("savWithdrawV").textContent = fmt(totalWd);
    if (el("totalDebtRemaining")) el("totalDebtRemaining").textContent = fmt(totalDebtRem);
    renderList("lIncome",  mInc.slice().sort(function(a,b){return b.ts-a.ts;}), "income");
    renderList("lToday",   exps.filter(function(e){return e.date===today;}).sort(function(a,b){return b.ts-a.ts;}), "expense");
    renderList("lMonth",   mExp.slice().sort(function(a,b){return b.ts-a.ts;}), "expense");
    await renderSavingsGrouped();
    renderWithdrawalList(wds);
    var sums = {};
    mExp.forEach(function(e) { var k = e.subcat || e.cat; sums[k] = (sums[k] || 0) + Number(e.amount || 0); });
    var maxV = Math.max(1, Math.max.apply(null, Object.values(sums).concat([0])));
    el("catBars").innerHTML = Object.entries(sums).sort(function(a,b){return b[1]-a[1];}).map(function(entry) {
      var id = entry[0], tot = entry[1], c = catInfo(id, false);
      return '<div class="brow"><div class="bname">' + c.icon + " " + c.label + '</div><div class="btrack"><div class="bfill" style="width:' + ((tot/maxV)*100).toFixed(0) + '%"></div></div><div class="bamt">' + fmt(tot) + "</div></div>";
    }).join("") || '<div class="empty">No data yet.</div>';
    var allKeys = new Set(exps.concat(incs).concat(savs).map(function(e) { return mKey(e.date); }));
    allKeys.delete(mk);
    el("histList").innerHTML = Array.from(allKeys).sort().reverse().map(function(k) {
      var ex = exps.filter(function(e){return mKey(e.date)===k;}).reduce(function(s,e){return s+Number(e.amount||0);},0);
      var ic = incs.filter(function(e){return mKey(e.date)===k;}).reduce(function(s,e){return s+Number(e.amount||0);},0);
      var sv = savs.filter(function(e){return mKey(e.date)===k;}).reduce(function(s,e){return s+Number(e.amount||e.totalVal||0);},0);
      var b = ic - ex - sv;
      return '<div class="hrow"><div class="hm">' + mLabel(k) + '</div><div class="hn">Inc ' + fmt(ic) + " · Spent " + fmt(ex) + " · Saved " + fmt(sv) + "<br>Balance <b>" + (b<0?"-":"") + fmt(Math.abs(b)) + "</b></div></div>";
    }).join("") || '<div class="empty">No previous months yet.</div>';
  } catch(e) { console.error("renderAll error:", e); }
}

// ── TABS ─────────────────────────────────────────────────────────
function switchTab(t) {
  document.querySelectorAll("nav.tabs button").forEach(function(b) { b.classList.toggle("active", b.dataset.t === t); });
  ["income","today","month","breakdown","savings","history"].forEach(function(id) {
    elStyle("tab-" + id, id === t ? "" : "none");
  });
}

// ── OVERLAYS ─────────────────────────────────────────────────────
function openOv(id) {
  document.querySelectorAll(".ov").forEach(function(o) { o.classList.remove("open"); });
  var target = el(id);
  if (!target) { console.warn("openOv: element not found:", id); return; }
  target.classList.add("open");
  if (id === "ov-debt-list") { renderDebtList(); }
  if (id === "ov-bank-list") { renderBankList(); }
  if (id === "ov-settings") { updateNotifBtnUI(); }
  if (id === "ov-docs-add") { selDocT=null; renderPeople(); renderDocs(); }
  if (id === "ov-docs-view") { renderPeople(); renderSavedDocsList(el("personSelView").value); }
  if (id === "ov-appts")      updateApptCount();
  if (id === "ov-appt-list")  renderAppts();
  if (id === "ov-savings")    { selSavType = "cash"; initSavingsOv(); }
  if (id === "ov-withdraw")   { renderWithdrawalInOverlay(); }
  if (id === "ov-payschedule"){ Promise.all([carryForwardPayments(),carryForwardOtherPays()]); }
  if (id === "ov-payschedule-list"){ switchPayTab(activePayTab); }
}
function closeAll() {
  document.querySelectorAll(".ov").forEach(function(o) { o.classList.remove("open"); });
  // Re-show bank list when closing bank overlay
  var bankList = el("bankList"); if (bankList) {}
}
document.querySelectorAll(".ov").forEach(function(o) { o.addEventListener("click", function(e) { if (e.target === o) closeAll(); }); });

// ── MONTH ROLLOVER ────────────────────────────────────────────────
async function checkMonthRollover() {
  try {
    var mk = curM();
    var done = await dbGet("rollover","rollover_"+mk); if (done) return;
    var savs = await dbAll("savings");
    var debts = await dbAll("debts"), pmts = await dbAll("payments");
    var savTotal = savs.reduce(function(s,e){return s+Number(e.amount||e.totalVal||0);},0);
    var debtSnap = debts.map(function(d){
      var paid=pmts.filter(function(p){return p.debtId===d.id;}).reduce(function(s,p){return s+Number(p.amount||0);},0);
      return {id:d.id,lender:d.lender,remaining:Math.max(0,Number(d.total||0)-paid)};
    });
    await dbPut("rollover",{id:"rollover_"+mk,month:mk,createdAt:new Date().toISOString(),savingsCarriedForward:savTotal,debtSnapshot:debtSnap});
  } catch(e) { console.warn("checkMonthRollover:", e); }
}

