// ── ENTRY LISTS ──────────────────────────────────────────────────
function renderList(id, items, kind) {
  var container = el(id);
  if (!items.length) { container.innerHTML = '<div class="empty">Nothing here yet.</div>'; return; }
  var isIncome = kind === "income";
  var html = items.map(function(e) {
    var isInc = kind === "income", isSav = kind === "savings";
    var c = catInfo(e.subcat || e.cat, isInc);
    var bg = isInc ? "var(--inc-s)" : isSav ? "var(--sav-s)" : "var(--exp-s)";
    var note = e.note || (e.remDest ? "to " + e.remDest + " (" + e.remCur + ")" : new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { day:"numeric", month:"short" }));
    var cls = isInc ? "inc-row" : isSav ? "sav-row" : "exp-row";
    var amt = isInc ? "+" + fmt(e.amount) : "-" + fmt(e.amount);
    var amtCls = isInc ? "inc" : isSav ? "sav" : "exp";
    // All entry types: tappable row, no X button
    return '<li class="erow ' + cls + '" style="cursor:pointer;" data-id="' + e.id + '" data-kind="' + kind + '" data-label="' + c.label + '">'
      + '<div class="eicon' + (isInc ? " big" : "") + '" style="background:' + bg + '">' + c.icon + '</div>'
      + '<div class="emeta"><div class="ecat">' + c.label + '</div><div class="enote">' + note + '</div></div>'
      + '<div class="eamt ' + amtCls + '">' + amt + '</div>'
      + '</li>';
  }).join("");
  container.innerHTML = html;
  container.querySelectorAll("li[data-kind]").forEach(function(row) {
    row.addEventListener("click", function() {
      var kind = this.dataset.kind, id = this.dataset.id, label = this.dataset.label;
      if (kind === "income")  openIncomeActionMenu(id, label);
      if (kind === "expense") openExpenseActionMenu(id, label);
    });
  });
}
function renderSavList(id, items) {
  var container = el(id);
  if (!items.length) { container.innerHTML = '<div class="empty">Nothing here yet.</div>'; return; }
  var html = items.map(function(e) {
    var t = savInfo(e.savType), sub = "";
    if (e.savType==="cash") sub = e.cashCur||"";
    else if (e.savType==="mf") sub = e.mfFund||"";
    else if (e.savType==="shares") sub = (e.shComp||"") + " · " + (e.shNum||0) + " shares";
    else if (e.savType==="gold") sub = (e.goldGrams||0) + "g";
    else if (e.savType==="fd") sub = (e.fdBank||"") + " · " + (e.fdCur||"");
    else if (e.savType==="other") sub = e.savDesc||"";
    if (e.note) sub += (sub ? " · " : "") + e.note;
    return '<li class="erow sav-row" style="cursor:pointer;" data-id="' + e.id + '" data-label="' + t.label + '">'
      + '<div class="eicon" style="background:var(--sav-s)">' + t.icon + '</div>'
      + '<div class="emeta"><div class="ecat">' + t.label + '</div><div class="enote">' + sub + '</div></div>'
      + '<div class="eamt sav">+' + fmt(e.amount || e.totalVal || 0) + '</div>'
      + '</li>';
  }).join("");
  container.innerHTML = html;
  container.querySelectorAll("li[data-id]").forEach(function(row) {
    row.addEventListener("click", function() {
      openSavingsActionMenu(this.dataset.id, this.dataset.label);
    });
  });
}
async function renderWithdrawalInOverlay() {
  try {
    var wds = await dbAll("withdrawals");
    var wdContainer = el("wdListContainer");
    if (!wdContainer) return;
    if (!wds.length) { wdContainer.innerHTML = "<div class='empty'>No withdrawals recorded.</div>"; return; }
    var sorted = wds.slice().sort(function(a,b){return b.ts-a.ts;});
    var SAV_ICONS = { cash:"💵", mf:"📈", shares:"📊", gold:"🪙", fd:"🏦", other:"📌" };
    var html = sorted.map(function(w) {
      var icon = SAV_ICONS[w.cat] || "💸";
      var label = w.type === "withdrawal" ? "Withdrawal" : "Adjustment";
      var note = w.note || new Date(w.date+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
      return "<li class='erow exp-row' style='cursor:pointer;' data-id='" + w.id + "' data-label='" + label + "'>"
        + "<div class='eicon' style='background:#fff0ef'>" + icon + "</div>"
        + "<div class='emeta'><div class='ecat'>" + label + "</div><div class='enote'>" + note + "</div></div>"
        + "<div class='eamt exp'>-" + fmt(w.amount) + "</div>"
        
        + "</li>";
    }).join("");
    wdContainer.innerHTML = "<ul class='elist'>" + html + "</ul>";
    wdContainer.querySelectorAll("li[data-id]").forEach(function(row) {
      row.addEventListener("click", function() {
        openWithdrawalActionMenu(this.dataset.id, this.dataset.label);
      });
    });
  } catch(e) { console.error("renderWithdrawalInOverlay:", e); }
}

function renderWithdrawalList(wds) {
  var container = el("lWithdrawals");
  if (!container) return;
  if (!wds || !wds.length) { container.innerHTML = '<div class="empty">No withdrawals recorded.</div>'; return; }
  var sorted = wds.slice().sort(function(a,b){return b.ts-a.ts;});
  var SAV_ICONS = { cash:"💵", mf:"📈", shares:"📊", gold:"🪙", fd:"🏦", other:"📌" };
  var html = sorted.map(function(w) {
    var icon = SAV_ICONS[w.cat] || "💸";
    var label = w.type === "withdrawal" ? "Withdrawal" : "Adjustment";
    var note = w.note || new Date(w.date+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
    return '<li class="erow exp-row" style="cursor:pointer;" data-id="' + w.id + '" data-label="' + label + '">'
      + '<div class="eicon" style="background:#fff0ef">' + icon + '</div>'
      + '<div class="emeta"><div class="ecat">' + label + '</div><div class="enote">' + note + '</div></div>'
      + '<div class="eamt exp">-' + fmt(w.amount) + '</div>'
      + '</li>';
  }).join("");
  container.innerHTML = html;
  container.onclick = function(e) {
    var row = e.target.closest("li[data-id]");
    if (!row) return;
    openWithdrawalActionMenu(row.dataset.id, row.dataset.label);
  };
}
async function delItem(kind, id) {
  try {
    var storeMap = { expense:"expenses", income:"incomes", savings:"savings" };
    await dbDel(storeMap[kind], id);
    renderAll();
  } catch(e) { console.error("delItem:", e); }
}






// ── EXPENSE ACTION MENU ──────────────────────────────────────────
var editExpSelCat = "rent", editExpSelSub = null;

function openExpenseActionMenu(id, label) {
  var btns = el("expenseActionButtons");
  btns.innerHTML = "";
  btns.appendChild(mkB("btn me", "Edit Entry", function() { closeAll(); openEditExpense(id); }));
  btns.appendChild(mkB("btn ghost", "Delete Entry", function() { confirmDelExpense(id, label); }, "border:1.5px solid var(--exp);color:var(--exp);"));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("expenseActionTitle").textContent = label;
  openOv("ov-expense-action");
}

function confirmDelExpense(id, label) {
  var btns = el("expenseActionButtons");
  btns.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;">Delete <b style="color:var(--ink);">' + label + '</b>?<br><span style="font-size:11px;">This cannot be undone.</span></p>';
  btns.appendChild(mkB("btn me", "Delete Entry", async function() {
    try { await dbDel("expenses", id); closeAll(); renderAll(); } catch(e) { console.error(e); }
  }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("expenseActionTitle").textContent = "Delete Entry";
}

async function openEditExpense(id) {
  try {
    var e = await dbGet("expenses", id); if (!e) return;
    editExpSelCat = e.cat || "rent";
    editExpSelSub = e.subcat || null;
    el("editExpId").value   = id;
    el("editExpAmt").value  = e.amount;
    el("editExpNote").value = e.note || "";
    el("editExpDate").value = e.date || todayStr();
    renderEditExpCatGrid();
    openOv("ov-expense-edit");
    setTimeout(function() { el("editExpAmt").focus(); }, 60);
  } catch(err) { console.error("openEditExpense:", err); }
}

function renderEditExpCatGrid() {
  var grid = el("editExpCatGrid"); if (!grid) return;
  grid.innerHTML = EXP_CATS.map(function(c) {
    return '<button class="cpick' + (c.id === editExpSelCat ? " sel me" : "") + '" data-cat="' + c.id + '"><span class="ci">' + c.icon + '</span><span>' + c.label + '</span></button>';
  }).join("");
  grid.querySelectorAll(".cpick").forEach(function(btn) {
    btn.addEventListener("click", function() {
      editExpSelCat = this.dataset.cat;
      editExpSelSub = null;
      grid.querySelectorAll(".cpick").forEach(function(b) {
        b.className = "cpick" + (b.dataset.cat === editExpSelCat ? " sel me" : "");
      });
      var cat = EXP_CATS.filter(function(c) { return c.id === editExpSelCat; })[0];
      var subEl = el("editExpSubCats");
      if (cat && cat.subs) {
        el("editExpSubLbl").textContent = "Select " + cat.label + " type";
        el("editExpSubGrid").innerHTML = cat.subs.map(function(s) {
          return '<button class="cpick' + (s.id === editExpSelSub ? " sel me" : "") + '" data-sub="' + s.id + '"><span class="ci">' + s.icon + '</span><span>' + s.label + '</span></button>';
        }).join("");
        el("editExpSubGrid").querySelectorAll(".cpick").forEach(function(b) {
          b.addEventListener("click", function() {
            editExpSelSub = this.dataset.sub;
            el("editExpSubGrid").querySelectorAll(".cpick").forEach(function(x) {
              x.className = "cpick" + (x.dataset.sub === editExpSelSub ? " sel me" : "");
            });
          });
        });
        subEl.style.display = "block";
      } else {
        subEl.style.display = "none";
      }
    });
  });
}

async function saveEditExpense() {
  try {
    var id  = el("editExpId").value;
    var amt = parseFloat(el("editExpAmt").value);
    if (!isPositiveAmount(amt)) { el("editExpAmt").focus(); return; }
    var entry = await dbGet("expenses", id); if (!entry) return;
    entry.amount = amt;
    entry.cat    = editExpSelCat;
    entry.subcat = editExpSelSub || null;
    entry.note   = el("editExpNote").value.trim();
    entry.date   = el("editExpDate").value || todayStr();
    await dbPut("expenses", entry);
    closeAll(); renderAll();
  } catch(e) { console.error("saveEditExpense:", e); }
}
// ── INCOME ACTION MENU ────────────────────────────────────────────
var editIncSelCat = "salary";

function openIncomeActionMenu(id, label) {
  var btns = el("incomeActionButtons");
  btns.innerHTML = "";
  btns.appendChild(mkB("btn mi", "Edit Income", function() { closeAll(); openEditIncome(id); }));
  btns.appendChild(mkB("btn me", "Delete Income", function() { confirmDelIncome(id, label); }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("incomeActionTitle").textContent = label;
  openOv("ov-income-action");
}

function confirmDelIncome(id, label) {
  var btns = el("incomeActionButtons");
  btns.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;">Delete <b style="color:var(--ink);">' + label + '</b>?<br><span style="font-size:11px;">This cannot be undone.</span></p>';
  btns.appendChild(mkB("btn me", "Delete Income", async function() {
    try { await dbDel("incomes", id); closeAll(); renderAll(); } catch(e) { console.error(e); }
  }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); }));
  el("incomeActionTitle").textContent = "Delete Income";
}

async function openEditIncome(id) {
  try {
    var e = await dbGet("incomes", id); if (!e) return;
    editIncSelCat = e.cat || "salary";
    el("editIncId").value   = id;
    el("editIncAmt").value  = e.amount;
    el("editIncNote").value = e.note || "";
    el("editIncDate").value = e.date || todayStr();
    renderEditIncCatGrid();
    openOv("ov-income-edit");
    setTimeout(function() { el("editIncAmt").focus(); }, 60);
  } catch(err) { console.error("openEditIncome:", err); }
}

function renderEditIncCatGrid() {
  var grid = el("editIncCatGrid"); if (!grid) return;
  grid.innerHTML = INC_CATS.map(function(c) {
    return '<button class="cpick' + (c.id === editIncSelCat ? " sel mi" : "") + '" data-cat="' + c.id + '"><span class="ci">' + c.icon + '</span><span>' + c.label + '</span></button>';
  }).join("");
  grid.querySelectorAll(".cpick").forEach(function(btn) {
    btn.addEventListener("click", function() {
      editIncSelCat = this.dataset.cat;
      grid.querySelectorAll(".cpick").forEach(function(b) {
        b.className = "cpick" + (b.dataset.cat === editIncSelCat ? " sel mi" : "");
      });
    });
  });
}

async function saveEditIncome() {
  try {
    var id  = el("editIncId").value;
    var amt = parseFloat(el("editIncAmt").value);
    if (!isPositiveAmount(amt)) { el("editIncAmt").focus(); return; }
    var entry = await dbGet("incomes", id); if (!entry) return;
    entry.amount = amt;
    entry.cat    = editIncSelCat;
    entry.note   = el("editIncNote").value.trim();
    entry.date   = el("editIncDate").value || todayStr();
    await dbPut("incomes", entry);
    closeAll(); renderAll();
  } catch(e) { console.error("saveEditIncome:", e); }
}
// ── ENTRY SHEET ───────────────────────────────────────────────────
var mode = "expense", selCat = "rent", selSub = null;
function openEntry(m) {
  mode = m; selCat = m === "income" ? "salary" : "rent"; selSub = null;
  el("entAmt").value = ""; el("entNote").value = ""; el("entDate").value = todayStr();
  elStyle("subCats", "none"); elStyle("remF", "none");
  el("entTitle").textContent = m === "income" ? "Add Income" : "Add Expense";
  el("entSaveBtn").className = "btn " + (m === "income" ? "mi" : "me");
  el("catLbl").textContent = m === "income" ? "Source" : "Category";
  renderCatGrid(); openOv("ov-entry");
  setTimeout(function() { el("entAmt").focus(); }, 60);
}
function renderCatGrid() {
  var cats = mode === "income" ? INC_CATS : EXP_CATS;
  el("catGrid").innerHTML = cats.map(function(c) {
    var sel = c.id === selCat ? " sel " + (mode === "income" ? "mi" : "me") : "";
    return '<button class="cpick' + sel + '" data-cat="' + c.id + '"><span class="ci">' + c.icon + '</span><span>' + c.label + '</span></button>';
  }).join("");
  el("catGrid").querySelectorAll(".cpick").forEach(function(btn) {
    btn.addEventListener("click", function() { pickCat(this.dataset.cat); });
  });
}
function pickCat(id) {
  selCat = id; selSub = null; renderCatGrid();
  var cat = EXP_CATS.filter(function(c) { return c.id === id; })[0];
  var sub = el("subCats");
  if (mode === "expense" && cat && cat.subs) {
    el("subLbl").textContent = "Select " + cat.label + " type";
    el("subGrid").innerHTML = cat.subs.map(function(s) {
      return '<button class="cpick' + (s.id===selSub?" sel me":"") + '" data-sub="' + s.id + '"><span class="ci">' + s.icon + '</span><span>' + s.label + '</span></button>';
    }).join("");
    el("subGrid").querySelectorAll(".cpick").forEach(function(btn) {
      btn.addEventListener("click", function() { pickSub(this.dataset.sub); });
    });
    sub.style.display = "block";
  } else { sub.style.display = "none"; }
  el("remF").style.display = (mode === "expense" && id === "remittance") ? "block" : "none";
}
function pickSub(id) {
  selSub = id;
  el("subGrid").querySelectorAll(".cpick").forEach(function(b) {
    b.className = "cpick" + (b.dataset.sub === id ? " sel me" : "");
  });
}
async function saveEntry() {
  var btn = el("entSaveBtn"); if (btn) btn.disabled = true;
  try {
    var amt = parseFloat(el("entAmt").value);
    if (!isPositiveAmount(amt)) { el("entAmt").focus(); if (btn) btn.disabled = false; return; }
    var dateVal = el("entDate").value || todayStr();
    var entry = { id:mkid(), amount:amt, cat:selCat, subcat:selSub||null,
      note:el("entNote").value.trim(), date:dateVal, ts:Date.now() };
    if (mode === "expense" && selCat === "remittance") {
      entry.remCur = el("remCur").value; entry.remDest = el("remDest").value.trim();
    }
    await dbPut(mode === "income" ? "incomes" : "expenses", entry);
    closeAll(); renderAll();
  } catch(e) { console.error("saveEntry:", e); }
  finally { if (btn) btn.disabled = false; }
}

