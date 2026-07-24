// ── BANK ──────────────────────────────────────────────────────────
function openBankListOverlay() {
  openOv("ov-bank-list");
}
function closeBankList() {
  closeAll(); openOv("ov-bank");
}
function toggleBnIdType() {
  var t = el("bnIdType").value;
  elStyle("bnIbanRow", t === "iban" ? "" : "none");
  elStyle("bnIfscRow", t === "ifsc" ? "" : "none");
}
function toggleEditBnIdType() {
  var t = el("editBnIdType").value;
  elStyle("editBnIbanRow", t === "iban" ? "" : "none");
  elStyle("editBnIfscRow", t === "ifsc" ? "" : "none");
}
// Resolves the correct label/value to show for a saved bank's IBAN or IFSC,
// falling back gracefully for banks saved before this feature existed
// (which only have a plain .iban value with no type).
function getBankIdInfo(b) {
  if (b.idType === "ifsc") return { label: "IFSC", value: b.idValue || "" };
  if (b.idType === "iban") return { label: "IBAN", value: b.idValue || "" };
  return { label: "IBAN", value: b.iban || "" };
}
function openBankAddOverlay() {
  ["bnName","bnAcc","bnIban","bnIfsc","bnBal"].forEach(function(id){ var e=el(id); if(e) e.value=""; });
  el("bnCur").value = "AED";
  el("bnIdType").value = "iban";
  toggleBnIdType();
  openOv("ov-bank-add");
  setTimeout(function(){ var e=el("bnName"); if(e) e.focus(); }, 60);
}
function hideBankForm() {
  ["bnName","bnAcc","bnIban","bnIfsc","bnBal"].forEach(function(id){ var e=el(id); if(e) e.value=""; });
  el("bnCur").value = "AED";
  el("bnIdType").value = "iban";
  toggleBnIdType();
  closeAll(); openOv("ov-bank");
}
async function saveBank() {
  try {
    var name = el("bnName").value.trim(), acc = el("bnAcc").value.trim();
    if (!allRequired([name, acc])) { alert("Please enter bank name and account number."); return; }
    var idType = el("bnIdType").value;
    var idValue = (idType === "ifsc" ? el("bnIfsc").value : el("bnIban").value).trim();
    await dbPut("banks", { id:mkid(), name:name, accNo:acc, idType:idType, idValue:idValue, balance:parseFloat(el("bnBal").value)||0, currency:el("bnCur").value });
    ["bnName","bnAcc","bnIban","bnIfsc","bnBal"].forEach(function(id){ var e=el(id); if(e) e.value=""; });
    el("bnCur").value = "AED";
    el("bnIdType").value = "iban";
    toggleBnIdType();
    openOv("ov-bank-list");
  } catch(e) { console.error("saveBank:", e); }
}
async function delBank(id) {
  try { await dbDel("banks", id); closeAll(); renderBankList(); } catch(e) { console.error("delBank:", e); }
}
function confirmDelBank(id, name) {
  // Show confirm sheet
  var btns = el("bankActionButtons");
  btns.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;">Delete <b style="color:var(--ink);">' + name + '</b>?<br><span style="font-size:11px;">This cannot be undone.</span></p>';
  btns.appendChild(mkB("btn me", "Delete Bank", function() { delBank(id); }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); openOv("ov-bank-list"); }));
  el("bankActionTitle").textContent = "Delete Bank";
  openOv("ov-bank-action");
}
function openBankActionMenu(id, name) {
  var info = el("bankActionInfo");
  if (info) info.style.display = "none";
  var btns = el("bankActionButtons");
  btns.innerHTML = "";
  btns.appendChild(mkB("btn mb", "Edit Bank", function() { closeAll(); openEditBank(id); }));
  btns.appendChild(mkB("btn me", "Delete Bank", function() { confirmDelBank(id, name); }));
  btns.appendChild(mkB("btn ghost", "Cancel", function() { closeAll(); openOv("ov-bank-list"); }));
  el("bankActionTitle").textContent = name;
  openOv("ov-bank-action");
}
async function openEditBank(id) {
  try {
    var b = await dbGet("banks", id); if (!b) return;
    var idInfo = getBankIdInfo(b);
    var idType = b.idType || "iban";
    el("editBnId").value  = b.id;
    el("editBnName").value = b.name;
    el("editBnAcc").value  = b.accNo;
    el("editBnIdType").value = idType;
    el("editBnIban").value = idType === "iban" ? idInfo.value : "";
    el("editBnIfsc").value = idType === "ifsc" ? idInfo.value : "";
    toggleEditBnIdType();
    el("editBnBal").value  = b.balance;
    el("editBnCur").value  = b.currency;
    openOv("ov-bank-edit");
  } catch(e) { console.error("openEditBank:", e); }
}
async function saveEditBank() {
  try {
    var id = el("editBnId").value;
    var name = el("editBnName").value.trim();
    var acc  = el("editBnAcc").value.trim();
    if (!allRequired([name, acc])) { alert("Please enter bank name and account number."); return; }
    var b = await dbGet("banks", id); if (!b) return;
    var idType = el("editBnIdType").value;
    b.name     = name;
    b.accNo    = acc;
    b.idType   = idType;
    b.idValue  = (idType === "ifsc" ? el("editBnIfsc").value : el("editBnIban").value).trim();
    b.balance  = parseFloat(el("editBnBal").value) || 0;
    b.currency = el("editBnCur").value;
    await dbPut("banks", b);
    closeAll(); renderBankList();
  } catch(e) { console.error("saveEditBank:", e); }
}
async function renderBankList() {
  try {
    var banks = await dbAll("banks");
    var container = el("bankList");
    if (!banks.length) { container.innerHTML = '<div class="empty" style="margin-bottom:13px;">No bank accounts added yet.</div>'; return; }
    var html = banks.map(function(b) {
      var idInfo = getBankIdInfo(b);
      return '<div class="bkcard2" style="cursor:pointer;" data-action="bank-menu" data-id="' + b.id + '" data-name="' + b.name + '">'
        + '<div class="bico">🏦</div>'
        + '<div class="binfo"><div class="bname2">' + b.name + '</div><div class="bacc">Acc: ' + b.accNo + '</div><div style="font-size:13px;color:var(--ink);font-weight:800;margin-top:2px;">' + idInfo.label + ': ' + (idInfo.value || '—') + '</div><div class="bbal">' + b.currency + ' ' + fmt(b.balance) + '</div></div>'
        + ''
        + '</div>';
    }).join("");
    container.innerHTML = html;
    container.onclick = function(e) {
      var card = e.target.closest("[data-action='bank-menu']");
      if (!card) return;
      openBankActionMenu(card.dataset.id, card.dataset.name);
    };
  } catch(e) { console.error("renderBankList:", e); }
}

