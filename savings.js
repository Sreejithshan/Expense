// ── WITHDRAWAL ACTION MENU ───────────────────────────────────────
function openWithdrawalActionMenu(id, label) {
  var btns = el("wdActionButtons");
  btns.innerHTML = "";
  btns.appendChild(mkB("btn", "Edit Withdrawal", function() { closeAll(); openEditWithdrawal(id); }, "background:linear-gradient(135deg,#e17055,#d63031);color:#fff;"));
  btns.appendChild(mkB("btn ghost", "Delete Entry", function() { confirmDelWithdrawal(id, label); }, "border:1.5px solid var(--exp);color:var(--exp);"));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("wdActionTitle").textContent = label;
  openOv("ov-withdrawal-action");
}

function confirmDelWithdrawal(id, label) {
  var btns = el("wdActionButtons");
  btns.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;">Delete <b style="color:var(--ink);">' + label + '</b>?<br><span style="font-size:11px;">This cannot be undone.</span></p>';
  btns.appendChild(mkB("btn me", "Delete Entry", async function() {
    try { await dbDel("withdrawals", id); closeAll(); renderAll(); } catch(e) { console.error(e); }
  }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("wdActionTitle").textContent = "Delete Entry";
}

async function openEditWithdrawal(id) {
  try {
    var w = await dbGet("withdrawals", id); if (!w) return;
    el("editWdId").value   = id;
    el("editWdAmt").value  = w.amount || 0;
    el("editWdType").value = w.type || "withdrawal";
    el("editWdCat").value  = w.cat || "cash";
    el("editWdDate").value = w.date || todayStr();
    el("editWdNote").value = w.note || "";
    openOv("ov-withdrawal-edit");
    setTimeout(function() { el("editWdAmt").focus(); }, 60);
  } catch(e) { console.error("openEditWithdrawal:", e); }
}

async function saveEditWithdrawal() {
  try {
    var id = el("editWdId").value;
    var amt = parseFloat(el("editWdAmt").value);
    if (!isPositiveAmount(amt)) { el("editWdAmt").focus(); return; }
    var w = await dbGet("withdrawals", id); if (!w) return;
    w.amount = amt;
    w.type   = el("editWdType").value;
    w.cat    = el("editWdCat").value;
    w.date   = el("editWdDate").value || todayStr();
    w.note   = el("editWdNote").value.trim();
    await dbPut("withdrawals", w);
    closeAll(); renderAll();
  } catch(e) { console.error("saveEditWithdrawal:", e); }
}
// ── SAVINGS GROUPED BY MONTH ─────────────────────────────────────
async function renderSavingsGrouped() {
  try {
    var container = el("lSavingsGrouped");
    if (!container) return;
    var allSavs = await dbAll("savings");
    if (!allSavs.length) {
      container.innerHTML = '<div class="empty">No savings entries yet.</div>';
      return;
    }
    // Group by month key, sorted newest first
    var groups = {};
    allSavs.forEach(function(e) {
      var mk = mKey(e.date);
      if (!groups[mk]) groups[mk] = [];
      groups[mk].push(e);
    });
    var sortedKeys = Object.keys(groups).sort().reverse();
    var html = sortedKeys.map(function(mk) {
      var items = groups[mk].sort(function(a,b){ return b.ts - a.ts; });
      var monthTotal = items.reduce(function(s,e){ return s + Number(e.amount||e.totalVal||0); }, 0);
      var rows = items.map(function(e) {
        var t = savInfo(e.savType), sub = "";
        if (e.savType==="cash")   sub = e.cashCur||"";
        if (e.savType==="mf")     sub = e.mfFund||"";
        if (e.savType==="shares") sub = (e.shComp||"") + (e.shNum ? " · " + e.shNum + " shares" : "");
        if (e.savType==="gold")   sub = (e.goldGrams||0) + "g";
        if (e.savType==="fd")     sub = (e.fdBank||"") + (e.fdCur ? " · " + e.fdCur : "");
        if (e.savType==="other")  sub = e.savDesc||"";
        if (e.note) sub += (sub ? " · " : "") + e.note;
        return '<li class="erow sav-row" style="cursor:pointer;" data-id="' + e.id + '" data-label="' + t.label + '">'
          + '<div class="eicon" style="background:var(--sav-s)">' + t.icon + '</div>'
          + '<div class="emeta"><div class="ecat">' + t.label + '</div><div class="enote">' + sub + '</div></div>'
          + '<div class="eamt sav">+' + fmt(e.amount||e.totalVal||0) + '</div>'
          + '<div style="color:var(--muted);font-size:18px;padding-left:4px;">›</div>'
          + '</li>';
      }).join("");
      return '<div style="margin-bottom:18px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
        + '<div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:800;">' + mLabel(mk) + '</div>'
        + '<div style="font-size:12px;font-weight:800;color:#b07800;">+' + fmt(monthTotal) + '</div>'
        + '</div>'
        + '<ul class="elist">' + rows + '</ul>'
        + '</div>';
    }).join("");
    container.innerHTML = html;
    // Wire up tap events via delegation
    container.onclick = function(e) {
      var row = e.target.closest("li[data-id]");
      if (!row) return;
      openSavingsActionMenu(row.dataset.id, row.dataset.label);
    };
  } catch(e) { console.error("renderSavingsGrouped:", e); }
}
// ── SAVINGS ACTION MENU ──────────────────────────────────────────
var editSavSelType = "cash";

function openSavingsActionMenu(id, label) {
  var btns = el("savingsActionButtons");
  btns.innerHTML = "";
  btns.appendChild(mkB("btn ms", "Edit Savings", function() { closeAll(); openEditSavings(id); }));
  btns.appendChild(mkB("btn ghost", "Delete Entry", function() { confirmDelSavings(id, label); }, "border:1.5px solid var(--exp);color:var(--exp);"));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("savingsActionTitle").textContent = label;
  openOv("ov-savings-action");
}

function confirmDelSavings(id, label) {
  var btns = el("savingsActionButtons");
  btns.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;">Delete <b style="color:var(--ink);">' + label + '</b>?<br><span style="font-size:11px;">This cannot be undone.</span></p>';
  btns.appendChild(mkB("btn me", "Delete Entry", async function() {
    try { await dbDel("savings", id); closeAll(); renderAll(); } catch(e) { console.error(e); }
  }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("savingsActionTitle").textContent = "Delete Entry";
}

async function openEditSavings(id) {
  try {
    var e = await dbGet("savings", id); if (!e) return;
    editSavSelType = e.savType || "cash";
    el("editSavId").value   = id;
    el("editSavDate").value = e.date || todayStr();
    el("editSavNote").value = e.note || "";
    // Populate type grid
    var grid = el("editSavTypeGrid");
    grid.innerHTML = SAV_TYPES.map(function(t) {
      return '<button class="cpick' + (t.id === editSavSelType ? " sel ms" : "") + '" data-sav="' + t.id + '"><span class="ci">' + t.icon + '</span><span>' + t.label + '</span></button>';
    }).join("");
    grid.querySelectorAll(".cpick").forEach(function(btn) {
      btn.addEventListener("click", function() {
        editSavSelType = this.dataset.sav;
        grid.querySelectorAll(".cpick").forEach(function(b) {
          b.className = "cpick" + (b.dataset.sav === editSavSelType ? " sel ms" : "");
        });
        document.querySelectorAll(".edit-sav-form").forEach(function(f) { f.style.display = "none"; });
        var sf = el("edit-sf-" + editSavSelType); if (sf) sf.style.display = "";
      });
    });
    // Show correct form and pre-fill
    document.querySelectorAll(".edit-sav-form").forEach(function(f) { f.style.display = "none"; });
    var sf = el("edit-sf-" + editSavSelType); if (sf) sf.style.display = "";
    if (e.savType==="cash")   { el("editCashCur").value=e.cashCur||"AED"; el("editCashAmt").value=e.amount||0; }
    if (e.savType==="mf")     { el("editMfFund").value=e.mfFund||""; el("editMfAmt").value=e.amount||0; }
    if (e.savType==="shares") { el("editShComp").value=e.shComp||""; el("editShNum").value=e.shNum||0; el("editShVal").value=e.shVal||0; }
    if (e.savType==="gold")   { el("editGoldGrams").value=e.goldGrams||0; el("editGoldAmt").value=e.amount||0; }
    if (e.savType==="fd")     { el("editFdBank").value=e.fdBank||""; el("editFdAmt").value=e.amount||0; el("editFdCur").value=e.fdCur||"AED"; el("editFdRate").value=e.fdRate||0; }
    if (e.savType==="other")  { el("editSavDesc").value=e.savDesc||""; el("editSavOtherAmt").value=e.amount||0; }
    openOv("ov-savings-edit");
  } catch(err) { console.error("openEditSavings:", err); }
}

async function saveEditSavings() {
  try {
    var id = el("editSavId").value;
    var entry = await dbGet("savings", id); if (!entry) return;
    entry.savType = editSavSelType;
    entry.date    = el("editSavDate").value || todayStr();
    entry.note    = el("editSavNote").value.trim();
    if (editSavSelType==="cash")   { entry.cashCur=el("editCashCur").value; entry.amount=parseFloat(el("editCashAmt").value)||0; }
    if (editSavSelType==="mf")     { entry.mfFund=el("editMfFund").value.trim(); entry.amount=parseFloat(el("editMfAmt").value)||0; }
    if (editSavSelType==="shares") { entry.shComp=el("editShComp").value.trim(); entry.shNum=parseFloat(el("editShNum").value)||0; entry.shVal=parseFloat(el("editShVal").value)||0; entry.amount=entry.shNum*entry.shVal; }
    if (editSavSelType==="gold")   { entry.goldGrams=parseFloat(el("editGoldGrams").value)||0; entry.amount=parseFloat(el("editGoldAmt").value)||0; }
    if (editSavSelType==="fd")     { entry.fdBank=el("editFdBank").value.trim(); entry.fdCur=el("editFdCur").value; entry.fdRate=parseFloat(el("editFdRate").value)||0; entry.amount=parseFloat(el("editFdAmt").value)||0; }
    if (editSavSelType==="other")  { entry.savDesc=el("editSavDesc").value.trim(); entry.amount=parseFloat(el("editSavOtherAmt").value)||0; }
    if (!isPositiveAmount(entry.amount)) { alert("Please enter an amount."); return; }
    await dbPut("savings", entry);
    closeAll(); renderAll();
  } catch(e) { console.error("saveEditSavings:", e); }
}
// ── SAVINGS ───────────────────────────────────────────────────────
var selSavType = "cash";
function initSavingsOv() {
  el("savTypeGrid").innerHTML = SAV_TYPES.map(function(t) {
    return '<button class="cpick' + (t.id===selSavType?" sel ms":"") + '" data-sav="' + t.id + '"><span class="ci">' + t.icon + '</span><span>' + t.label + '</span></button>';
  }).join("");
  el("savTypeGrid").querySelectorAll(".cpick").forEach(function(btn) {
    btn.addEventListener("click", function() { pickSavType(this.dataset.sav); });
  });
  document.querySelectorAll(".sav-form").forEach(function(f) { f.style.display = "none"; });
  var sf = el("sf-" + selSavType); if (sf) sf.style.display = "";
  el("savDate").value = todayStr();
}
function pickSavType(id) {
  if (id === "withdrawal") {
    // Open the withdrawal overlay directly
    closeAll();
    openWithdrawSavings();
    return;
  }
  selSavType = id;
  el("savTypeGrid").querySelectorAll(".cpick").forEach(function(b) {
    b.className = "cpick" + (b.dataset.sav === id ? " sel ms" : "");
  });
  document.querySelectorAll(".sav-form").forEach(function(f) { f.style.display = "none"; });
  var sf = el("sf-" + id); if (sf) sf.style.display = "";
}
async function saveSaving() {
  try {
    if (selSavType === "withdrawal") { openWithdrawSavings(); return; }
    var date = el("savDate").value || todayStr();
    var note = el("savNote").value.trim();
    var entry = { id:mkid(), savType:selSavType, date:date, note:note, ts:Date.now() };
    if (selSavType==="cash")   { entry.cashCur=el("cashCur").value; entry.amount=parseFloat(el("cashAmt").value)||0; }
    if (selSavType==="mf")     { entry.mfFund=el("mfFund").value.trim(); entry.amount=parseFloat(el("mfAmt").value)||0; }
    if (selSavType==="shares") { entry.shComp=el("shComp").value.trim(); entry.shNum=parseFloat(el("shNum").value)||0; entry.shVal=parseFloat(el("shVal").value)||0; entry.amount=entry.shNum*entry.shVal; }
    if (selSavType==="gold")   { entry.goldGrams=parseFloat(el("goldGrams").value)||0; entry.amount=parseFloat(el("goldAmt").value)||0; }
    if (selSavType==="fd")     { entry.fdBank=el("fdBank").value.trim(); entry.fdCur=el("fdCur").value; entry.fdRate=parseFloat(el("fdRate").value)||0; entry.fdDep=el("fdDep").value; entry.fdMat=el("fdMat").value; entry.amount=parseFloat(el("fdAmt").value)||0; }
    if (selSavType==="other")  { entry.savDesc=el("savOtherDesc").value.trim(); entry.amount=parseFloat(el("savOtherAmt").value)||0; }
    if (!isPositiveAmount(entry.amount)) { alert("Please enter an amount."); return; }
    await dbPut("savings", entry); closeAll(); renderAll();
  } catch(e) { console.error("saveSaving:", e); }
}

// ── WITHDRAWALS ───────────────────────────────────────────────────
function openWithdrawSavings() {
  el("wdAmt").value = ""; el("wdNote").value = ""; el("wdDate").value = todayStr();
  openOv("ov-withdraw");
  setTimeout(function() { el("wdAmt").focus(); }, 60);
}
async function saveWithdrawal() {
  try {
    var amt = parseFloat(el("wdAmt").value);
    if (!isPositiveAmount(amt)) { alert("Please enter an amount."); return; }
    await dbPut("withdrawals", { id:mkid(), amount:amt, type:el("wdType").value, cat:el("wdCat").value, date:el("wdDate").value||todayStr(), note:el("wdNote").value.trim(), ts:Date.now() });
    closeAll(); renderAll();
  } catch(e) { console.error("saveWithdrawal:", e); }
}
async function delWithdrawal(id) {
  if (!confirm("Delete this withdrawal record?")) return;
  try { await dbDel("withdrawals", id); renderAll(); } catch(e) { console.error("delWithdrawal:", e); }
}


