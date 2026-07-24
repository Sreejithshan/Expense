// ── BACKUP ───────────────────────────────────────────────────────
var BSTORES = ["expenses","incomes","savings","withdrawals","debts","payments",
               "banks","people","documents","appointments","bills","cheques","otherpays"];
var _backupTimer = null;

function scheduleBackup() {
  clearTimeout(_backupTimer);
  _backupTimer = setTimeout(autoBackup, 2000);
}
async function autoBackup() {
  try {
    var data = { savedAt: new Date().toISOString(), v: DB_VER };
    for (var i = 0; i < BSTORES.length; i++) {
      var s = BSTORES[i], items = await dbAll(s);
      data[s] = s === "documents" ? items.map(function(d) { var c = Object.assign({}, d); delete c.fileData; return c; }) : items;
    }
    localStorage.setItem("fm_backup", JSON.stringify(data));
    localStorage.setItem("fm_last_backup", new Date().toISOString());
  } catch(e) { console.warn("Backup error:", e); }
}
async function safeBackupBeforeReload() {
  await autoBackup();
  await new Promise(function(r) { setTimeout(r, 300); });
}
async function restoreFromAutoBackup() {
  try {
    var raw = localStorage.getItem("fm_backup");
    if (!raw) return;
    var bk = JSON.parse(raw);
    for (var i = 0; i < BSTORES.length; i++) {
      var s = BSTORES[i];
      if (!Array.isArray(bk[s])) continue;
      var existing = await dbAll(s);
      var ids = new Set(existing.map(function(x) { return x.id; }));
      for (var j = 0; j < bk[s].length; j++) {
        if (!ids.has(bk[s][j].id)) await dbPut(s, bk[s][j]);
      }
    }
  } catch(e) { console.warn("Restore error:", e); }
}
setInterval(autoBackup, 3 * 60 * 1000);

// ── BACKUP REMINDER ──────────────────────────────────────────────
function checkDailyBackupReminder() {
  if (localStorage.getItem("fm_local_backup_date") === todayStr()) return;
  var b = el("backupReminder"); if (b) b.classList.add("show");
}
async function doDailyBackup() {
  await exportBk();
  localStorage.setItem("fm_local_backup_date", todayStr());
  var b = el("backupReminder"); if (b) b.classList.remove("show");
}
function dismissBackupReminder() {
  var b = el("backupReminder"); if (b) b.classList.remove("show");
}

// ── EMAIL BACKUP (stub  -  user can configure) ─────────────────────
function updateEmailUI() { /* stub for settings display */ }

// ── NOTIFICATIONS ────────────────────────────────────────────────
async function getNotifPref() {
  var cfg = await dbGet("config", "notifPref");
  return cfg ? cfg.value : "on";
}
async function setNotifPref(val) {
  await dbPut("config", { key:"notifPref", value: val });
}
async function updateNotifBtnUI() {
  var btn = el("notifSettingBtn"), sub = el("notifSettingSub");
  if (!btn) return;
  if (!("Notification" in window)) {
    btn.textContent = "Not Supported"; btn.disabled = true;
    if (sub) sub.textContent = "This browser doesn't support notifications.";
    return;
  }
  btn.disabled = false;
  var perm = Notification.permission;
  if (perm === "denied") {
    btn.textContent = "Enable Notifications";
    if (sub) sub.textContent = "Blocked — enable in your browser/phone settings.";
    return;
  }
  if (perm === "granted") {
    var pref = await getNotifPref();
    if (pref === "on") {
      btn.textContent = "Disable Notifications";
      if (sub) sub.textContent = "On — alerts for EMIs, cheques, visa expiry.";
    } else {
      btn.textContent = "Enable Notifications";
      if (sub) sub.textContent = "Notifications are currently off.";
    }
    return;
  }
  btn.textContent = "Enable Notifications";
  if (sub) sub.textContent = "Alerts for EMIs, cheques, visa expiry";
}
async function toggleNotifications() {
  if (!("Notification" in window)) { alert("Notifications not supported on this browser."); return; }
  try {
    var perm = Notification.permission;
    if (perm === "granted") {
      var pref = await getNotifPref();
      if (pref === "on") { await setNotifPref("off"); alert("Notifications turned off."); }
      else { await setNotifPref("on"); alert("Notifications turned on."); }
    } else if (perm === "denied") {
      alert("Notifications are blocked for this app. Please enable them in your browser or phone settings.");
    } else {
      var result = await Notification.requestPermission();
      if (result === "granted") { await setNotifPref("on"); alert("Notifications enabled!"); }
      else { alert("Notifications were not enabled. You can allow them later in your browser/phone settings."); }
    }
  } catch(e) { console.error("toggleNotifications:", e); }
  await updateNotifBtnUI();
}
async function checkNotifications() {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var notifOn = (await getNotifPref()) === "on";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d1 = new Date(today); d1.setDate(d1.getDate() + 1); var d1s = fmtDate(d1);
    var d3 = new Date(today); d3.setDate(d3.getDate() + 3); var d3s = fmtDate(d3);
    var d30 = new Date(today); d30.setDate(d30.getDate() + 30); var d30s = fmtDate(d30);
    var sent = new Set((await dbAll("notifLog")).map(function(n) { return n.id; }));
    var alerts = [];
    async function notify(key, title, body) {
      if (sent.has(key)) return;
      if (notifOn) { try { new Notification(title, { body: body }); } catch(e) {} }
      await dbPut("notifLog", { id: key });
      alerts.push(body);
    }
    var debts = await dbAll("debts");
    for (var i = 0; i < debts.length; i++) {
      var d = debts[i];
      if (d.emiDate === d1s) await notify("emi_" + d.id + "_" + d1s, "EMI Due Tomorrow", d.lender + " EMI due tomorrow");
    }
    var appts = await dbAll("appointments");
    for (var i = 0; i < appts.length; i++) {
      var a = appts[i];
      if (a.datetime && a.datetime.slice(0, 10) === d1s)
        await notify("appt_" + a.id + "_" + d1s, "Appointment Tomorrow", a.title + " is tomorrow");
    }
    var docs = await dbAll("documents");
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i], exp = d.expiry || d.endDate;
      if (exp === d30s) await notify("doc30_" + d.id, "Document Expiring Soon", (DOC_LABELS[d.type] || "Document") + " expires in 30 days");
      if (exp === d3s)  await notify("doc3_"  + d.id, "Document Expiring in 3 Days", (DOC_LABELS[d.type] || "Document") + " expires in 3 days");
      if (d.cheques) {
        for (var j = 0; j < d.cheques.length; j++) {
          var ch = d.cheques[j];
          if (ch.date === d30s) await notify("ch30_" + d.id + "_" + j, "Cheque Due in 30 Days", "Cheque #" + (j+1) + " due " + ch.date);
          if (ch.date === d3s)  await notify("ch3_"  + d.id + "_" + j, "Cheque Due in 3 Days",  "Cheque #" + (j+1) + " due in 3 days");
        }
      }
    }
    if (alerts.length) {
      el("notifList").innerHTML = alerts.map(function(a) { return "<li>" + a + "</li>"; }).join("");
      el("notifBanner").classList.add("show");
    }
  } catch(e) { console.warn("Notification error:", e); }
}
async function checkPaymentNotifications() {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var notifOn = (await getNotifPref()) === "on";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d3 = new Date(today); d3.setDate(d3.getDate() + 3); var d3s = fmtDate(d3);
    var sent = new Set((await dbAll("notifLog")).map(function(n) { return n.id; }));
    async function notify(key, title, body) {
      if (sent.has(key)) return;
      if (notifOn) { try { new Notification(title, { body: body }); } catch(e) {} }
      await dbPut("notifLog", { id: key });
    }
    var bills = await dbAll("bills");
    for (var i = 0; i < bills.length; i++) {
      var b = bills[i];
      if (b.dueDate === d3s) await notify("bill3_" + b.id + "_" + d3s, "Bill Due in 3 Days", (BILL_CATS[b.cat] ? BILL_CATS[b.cat].label : b.customName) + " due " + b.dueDate);
    }
    var cheqs = await dbAll("cheques");
    for (var i = 0; i < cheqs.length; i++) {
      var c = cheqs[i];
      if (c.dueDate === d3s) await notify("chq3_" + c.id + "_" + d3s, "Cheque Due in 3 Days", "Cheque to " + c.payee + " due " + c.dueDate);
    }
  } catch(e) { console.warn("Payment notification error:", e); }
}

// ── SETTINGS / BACKUP ────────────────────────────────────────────
async function exportBk() {
  try {
    var data={app:"FinMob",version:DB_VER,exportedAt:new Date().toISOString()};
    for(var i=0;i<BSTORES.length;i++){data[BSTORES[i]]=await dbAll(BSTORES[i]);}
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download="FinMob-backup-"+todayStr()+".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  } catch(e){console.error("exportBk:",e);}
}
async function importBk(input) {
  var file=input.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=async function(ev){
    try{
      var bk=JSON.parse(ev.target.result);
      var hasAnyStore = BSTORES.some(function(s){ return Array.isArray(bk[s]); });
      if (!hasAnyStore) { alert("This doesn't look like a valid FinMob backup file."); input.value=""; return; }
      var merge=confirm("OK = Merge with current data\nCancel = Replace all data");
      if (!merge) { await autoBackup(); }
      for(var i=0;i<BSTORES.length;i++){
        var s=BSTORES[i]; if(!Array.isArray(bk[s])) continue;
        if(merge){var ex=await dbAll(s);var ids=new Set(ex.map(function(x){return x.id;}));for(var j=0;j<bk[s].length;j++){if(!ids.has(bk[s][j].id))await dbPut(s,bk[s][j]);}}
        else{var ex=await dbAll(s);for(var j=0;j<ex.length;j++)await dbDel(s,ex[j].id);for(var j=0;j<bk[s].length;j++)await dbPut(s,bk[s][j]);}
      }
      await renderAll(); alert("Backup restored!");
    } catch(err){alert("Invalid backup file.");}
    input.value="";
  };
  reader.readAsText(file);
}
async function generatePDF() {
  // Open the tab synchronously, before any await — otherwise the browser
  // treats window.open() as no longer being a direct result of the click
  // and silently blocks it, which is why this previously appeared to do
  // nothing at all.
  var w = window.open("", "_blank");
  try {
    var mk=curM(), mName=mLabel(mk);
    var exps=await dbAll("expenses"),incs=await dbAll("incomes"),savs=await dbAll("savings");
    var mExp=exps.filter(function(e){return mKey(e.date)===mk;}), mInc=incs.filter(function(e){return mKey(e.date)===mk;}), mSav=savs.filter(function(e){return mKey(e.date)===mk;});
    var spent=mExp.reduce(function(s,e){return s+Number(e.amount||0);},0), earned=mInc.reduce(function(s,e){return s+Number(e.amount||0);},0), saved=mSav.reduce(function(s,e){return s+Number(e.amount||e.totalVal||0);},0);
    function row(l,v,c,a){var bg=a?"background:#fff;":"";return"<tr><td style='padding:12px 16px;font-weight:700;"+bg+"'>"+l+"</td><td style='padding:12px 16px;text-align:right;font-weight:800;color:"+c+";"+bg+"'>"+v+"</td></tr>";}
    var html="<html><head><meta charset='UTF-8'><style>body{font-family:-apple-system,sans-serif;color:#1a1a2e;padding:28px;}h1{font-size:26px;font-weight:800;color:#ff5f8f;margin:0 0 3px;}table{width:100%;border-collapse:collapse;font-size:12.5px;}td{padding:8px 10px;border-bottom:1px solid #eaeaf2;}tr:nth-child(even){background:#f7f8fa;}</style></head><body><h1>FinMob</h1><p style='color:#888;margin-bottom:22px;'>Monthly Report  -  "+mName+"</p><table>"+row("Income",fmt(earned),"#00c48c",false)+row("Spent",fmt(spent),"#ff5e57",true)+row("Saved",fmt(saved),"#f5a623",false)+row("Balance",fmt(earned-spent-saved),"#7c5cff",true)+"</table></body></html>";
    if (w) {
      w.document.write(html); w.document.close();
      setTimeout(function(){ w.print(); },500);
    } else {
      alert("Please allow pop-ups for this site, then tap Generate again.");
    }
  } catch(e){ console.error("generatePDF:",e); if (w) w.close(); alert("Couldn't generate the report."); }
}

// ── SPLASH ────────────────────────────────────────────────────────
function hideSplash() {
  var s=el("splash"); if(s){s.classList.add("hide");setTimeout(function(){s.remove();},700);}
}


