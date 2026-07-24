// ── DEBT ACTION MENU ──────────────────────────────────────────────
async function openDebtActionMenu(id) {
  try {
    var d = await dbGet("debts", id); if (!d) return;
    var allPmts = await dbAll("payments");
    var pmts = allPmts.filter(function(p){return p.debtId===id;});
    var paid = pmts.reduce(function(s,p){return s+Number(p.amount||0);},0);
    var rem  = Math.max(0, Number(d.total||0) - paid);
    var pct  = d.total > 0 ? Math.min(100, paid/d.total*100).toFixed(0) : 0;
    var info = el("debtActionInfo");
    info.innerHTML =
      '<div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--dbt);font-weight:800;">' + (DEBT_LABELS[d.type]||d.type) + '</div>'
      + '<div style="font-weight:800;font-size:16px;margin:4px 0 10px;">' + d.lender + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">'
      + '<div style="text-align:center;"><div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;">Original</div><div style="font-weight:800;font-size:13px;">' + d.currency + ' ' + fmt(d.total) + '</div></div>'
      + '<div style="text-align:center;"><div style="font-size:9px;color:var(--inc);font-weight:700;text-transform:uppercase;">Paid</div><div style="font-weight:800;font-size:13px;color:var(--inc);">' + d.currency + ' ' + fmt(paid) + '</div></div>'
      + '<div style="text-align:center;"><div style="font-size:9px;color:var(--exp);font-weight:700;text-transform:uppercase;">Remaining</div><div style="font-weight:800;font-size:13px;color:var(--exp);">' + d.currency + ' ' + fmt(rem) + '</div></div>'
      + '</div>'
      + '<div style="font-size:11.5px;color:var(--muted);font-weight:600;">EMI: ' + d.currency + ' ' + fmt(d.emi) + (d.rate ? ' · ' + d.rate + '% p.a.' : '') + (d.emiDate ? ' · Next: ' + d.emiDate : '') + (typeof d.emisPending === "number" ? ' · ' + d.emisPending + ' EMIs Pending' : '') + '</div>'
      + '<div style="height:6px;background:var(--line);border-radius:6px;margin-top:10px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--dbt),#a78bff);border-radius:6px;"></div></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:4px;font-weight:600;">' + pct + '% paid off</div>';
    var btns = el("debtActionButtons"); btns.innerHTML = "";
    if (rem > 0) btns.appendChild(mkB("btn md", "Pay EMI", async function() { await payEMI(id); closeAll(); openOv("ov-debt-list"); }));
    if (pmts.length > 0) btns.appendChild(mkB("btn ghost", "Undo Last EMI Payment", async function() { await undoLastEMIPayment(id); }));
    btns.appendChild(mkB("btn mb",    "Edit Loan",   function() { closeAll(); openEditDebt(id); }));
    btns.appendChild(mkB("btn ghost", "Delete Loan", function() { confirmDelDebt(id, d.lender); }));
    btns.appendChild(mkB("btn ghost", "Cancel",      function() { closeAll(); }));
    el("debtActionTitle").textContent = d.lender;
    openOv("ov-debt-action");
  } catch(e) { console.error("openDebtActionMenu:", e); }
}

function confirmDelDebt(id, lender) {
  var btns = el("debtActionButtons"); btns.innerHTML = "<p style='text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;'>Delete loan from <b style='color:var(--ink);'>" + lender + "</b>?<br><span style='font-size:11px;'>All payment history will also be deleted.</span></p>";
  btns.appendChild(mkB("btn me", "Delete Loan", async function() { try { await dbDel("debts", id); var pm = await dbAll("payments"); for(var i=0;i<pm.length;i++){if(pm[i].debtId===id)await dbDel("payments",pm[i].id);} closeAll(); renderDebtList(); renderAll(); } catch(e){console.error(e);} }));
  btns.appendChild(mkB("btn ghost", "Cancel",      function() { closeAll(); }));
  el("debtActionTitle").textContent = "Delete Loan";
}

async function openEditDebt(id) {
  try {
    var d = await dbGet("debts", id); if (!d) return;
    el("editDId").value      = id;
    el("editDType").value    = d.type || "personal";
    el("editDLender").value  = d.lender || "";
    el("editDTotal").value   = d.total || "";
    el("editDEMI").value     = d.emi || "";
    el("editDRate").value    = d.rate || "";
    el("editDCur").value     = d.currency || "AED";
    el("editDEmiDate").value = d.emiDate || "";
    openOv("ov-debt-edit");
  } catch(e) { console.error("openEditDebt:", e); }
}

async function saveEditDebt() {
  try {
    var id    = el("editDId").value;
    var total = parseFloat(el("editDTotal").value);
    var emi   = parseFloat(el("editDEMI").value);
    if (!isPositiveAmount(total) || !isPositiveAmount(emi)) { alert("Please fill in total amount and EMI."); return; }
    var d = await dbGet("debts", id); if (!d) return;
    d.type    = el("editDType").value;
    d.lender  = el("editDLender").value.trim() || "Lender";
    d.total   = total;
    d.emi     = emi;
    d.rate    = parseFloat(el("editDRate").value) || 0;
    d.currency= el("editDCur").value;
    d.emiDate = el("editDEmiDate").value;
    await dbPut("debts", d);
    closeAll(); renderDebtList();
  } catch(e) { console.error("saveEditDebt:", e); }
}
// ── DEBT ─────────────────────────────────────────────────────────
function openLoanListOverlay() {
  openOv("ov-debt-list");
}
function closeLoanList() {
  document.querySelectorAll(".ov").forEach(function(o){ o.classList.remove("open"); });
  el("ov-debt").classList.add("open");
}
function showDebtForm() {
  el("dLender").value = ""; el("dTotal").value = ""; el("dEMI").value = "";
  el("dRate").value = ""; el("dEmiDate").value = ""; el("dEmisPending").value = "";
  el("dType").value = "mortgage"; el("dCur").value = "AED";
  openOv("ov-debt-add");
}
function hideDebtForm() {
  closeAll(); openOv("ov-debt");
}
async function saveDebt() {
  try {
    var total = parseFloat(el("dTotal").value), emi = parseFloat(el("dEMI").value);
    if (!isPositiveAmount(total) || !isPositiveAmount(emi)) { alert("Please fill in total amount and EMI."); return; }
    var newDebt = {
      id: mkid(),
      type: el("dType").value,
      lender: el("dLender").value.trim() || "Lender",
      total: total,
      emi: emi,
      rate: parseFloat(el("dRate").value) || 0,
      currency: el("dCur").value,
      emiDate: el("dEmiDate").value,
      createdAt: todayStr()
    };
    var emisPendingVal = el("dEmisPending").value;
    if (emisPendingVal !== "") newDebt.emisPending = parseInt(emisPendingVal) || 0;
    await dbPut("debts", newDebt);
    hideDebtForm();
  } catch(e) { console.error("saveDebt:", e); }
}
async function payEMI(id) {
  try {
    var d = await dbGet("debts", id); if (!d) return;
    var today = todayStr();
    var payId = mkid();
    var emisPendingBefore = (typeof d.emisPending === "number") ? d.emisPending : null;
    // Record in payments store (for debt balance tracking)
    await dbPut("payments", { id:payId, debtId:id, amount:d.emi, date:today, ts:Date.now(), emisPendingBefore:emisPendingBefore });
    // Auto-deduct from this month by adding as an expense
    // This keeps Debt Tracker independent while reflecting EMI in monthly expenses
    await dbPut("expenses", {
      id:    mkid(),
      amount: d.emi,
      cat:   "emi",
      subcat: null,
      note:  "EMI: " + d.lender + " (" + d.currency + ")",
      date:  today,
      ts:    Date.now(),
      autoEmi: true,   // flag so we know it was auto-created
      debtPaymentId: payId   // links this expense to the payment record, for Undo
    });
    if (emisPendingBefore !== null) {
      d.emisPending = Math.max(0, emisPendingBefore - 1);
      await dbPut("debts", d);
    }
    renderDebtList();
    renderAll();
  } catch(e) { console.error("payEMI:", e); }
}
async function undoLastEMIPayment(id) {
  try {
    var pmts = (await dbAll("payments")).filter(function(p){return p.debtId===id;}).sort(function(a,b){return b.ts-a.ts;});
    if (!pmts.length) { closeAll(); openOv("ov-debt-list"); return; }
    var last = pmts[0];
    await dbDel("payments", last.id);
    var exps = await dbAll("expenses");
    var linked = exps.filter(function(e){ return e.debtPaymentId === last.id; })[0];
    if (linked) await dbDel("expenses", linked.id);
    var d = await dbGet("debts", id);
    if (d) {
      if (last.emisPendingBefore !== null && last.emisPendingBefore !== undefined) {
        d.emisPending = last.emisPendingBefore;
      } else if (typeof d.emisPending === "number") {
        d.emisPending = d.emisPending + 1;
      }
      await dbPut("debts", d);
    }
    closeAll();
    openOv("ov-debt-list");
    renderAll();
  } catch(e) { console.error("undoLastEMIPayment:", e); }
}
async function delDebt(id) {
  if (!confirm("Delete this loan?")) return;
  try {
    var debt = await dbGet("debts", id);
    await dbDel("debts", id);
    // Remove payment records
    var pmts = await dbAll("payments");
    for (var i = 0; i < pmts.length; i++) { if (pmts[i].debtId === id) await dbDel("payments", pmts[i].id); }
    // Note: auto-created EMI expenses remain in expense history (accurate financial record)
    renderDebtList();
    renderAll();
  } catch(e) { console.error("delDebt:", e); }
}
async function renderDebtList() {
  try {
    var debts = await dbAll("debts"), pmts = await dbAll("payments");
    var container = el("debtList");
    if (!debts.length) { container.innerHTML = '<div class="empty" style="margin-bottom:13px">No loans yet. Tap + Add New Loan.</div>'; return; }
    var html = debts.map(function(d) {
      var paid  = pmts.filter(function(p){return p.debtId===d.id;}).reduce(function(s,p){return s+Number(p.amount||0);},0);
      var rem   = Math.max(0, Number(d.total||0) - paid);
      var pct   = d.total > 0 ? Math.min(100, paid/d.total*100) : 0;
      var mLeft = rem > 0 ? Math.ceil(rem/(d.emi||1)) : 0;
      return '<div class="dcard" style="cursor:pointer;" data-id="' + d.id + '">'
        + '<div class="dhead"><div><div class="dtype">' + (DEBT_LABELS[d.type]||d.type) + '</div><div class="dname">' + d.lender + '</div></div>'
        + '</div>'
        + (d.rate ? '<div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">' + d.rate + '% p.a.</div>' : '')
        + '<div style="display:flex;justify-content:space-between;margin:10px 0 6px;">'
        + '<div style="text-align:center;"><div style="font-size:9px;text-transform:uppercase;color:var(--muted);font-weight:700;">Original</div><div style="font-weight:800;font-size:13px;">' + d.currency + ' ' + fmt(d.total) + '</div></div>'
        + '<div style="text-align:center;"><div style="font-size:9px;text-transform:uppercase;color:var(--inc);font-weight:700;">Paid</div><div style="font-weight:800;font-size:13px;color:var(--inc);">' + d.currency + ' ' + fmt(paid) + '</div></div>'
        + '<div style="text-align:center;"><div style="font-size:9px;text-transform:uppercase;color:var(--exp);font-weight:700;">Remaining</div><div style="font-weight:800;font-size:15px;color:var(--exp);">' + d.currency + ' ' + fmt(rem) + '</div></div>'
        + '</div>'
        + '<div class="dbar"><div class="dbarf" style="width:' + pct.toFixed(0) + '%"></div></div>'
        + '<div class="dnums"><span>' + pct.toFixed(0) + '% paid</span><span>' + (rem > 0 ? mLeft + ' EMIs left' : 'Paid off!') + '</span></div>'
        + '<div style="font-size:11.5px;color:var(--muted);font-weight:600;margin-top:6px;">EMI: ' + d.currency + ' ' + fmt(d.emi) + (d.emiDate ? ' · Next: ' + d.emiDate : '') + '</div>'
        + '</div>';
    }).join("");
    container.innerHTML = html;
    container.onclick = function(e) {
      var card = e.target.closest(".dcard[data-id]");
      if (!card) return;
      openDebtActionMenu(card.dataset.id);
    };
  } catch(e) { console.error("renderDebtList:", e); }
}

