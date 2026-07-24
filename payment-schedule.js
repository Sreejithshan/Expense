// ── PAYMENT SCHEDULE ─────────────────────────────────────────────
var activePayTab = "bills";
function switchPayTab(tab) {
  activePayTab = tab;
  ["bills","cheques","others"].forEach(function(t) {
    elStyle("paySection-"+t, t===tab?"":"none");
    var tb = el("payTab-"+t); if (tb) tb.classList.toggle("active",t===tab);
  });
  if (tab==="bills") renderBills();
  else if (tab==="cheques") renderCheques();
  else if (tab==="others") renderOtherPays();
}
function togglePayForm(id) { var e=el(id); if(e) e.style.display = e.style.display==="none"?"":"none"; }
function toggleCustomBill() { el("customBillRow").style.display = el("billCat").value==="custom"?"":"none"; }

function openPayScheduleList() { openOv("ov-payschedule-list"); }
function closePayScheduleList() { closeAll(); openOv("ov-payschedule"); }
function openAddBillType() { openOv("ov-payschedule-addtype"); }
function closeAddBillType() { closeAll(); openOv("ov-payschedule"); }
function openBillAddOverlay() { openOv("ov-bill-add"); }
function closeBillAdd() { closeAll(); openOv("ov-payschedule-addtype"); }
function openChequeAddOverlay() { openOv("ov-cheque-add"); }
function closeChequeAdd() { closeAll(); openOv("ov-payschedule-addtype"); }
function openOtherPayAddOverlay() { openOv("ov-otherpay-add"); }
function closeOtherPayAdd() { closeAll(); openOv("ov-payschedule-addtype"); }

async function saveBill() {
  try {
    var cat=el("billCat").value, custom=el("customBillName").value.trim(), dueDate=el("billDueDate").value;
    if (!dueDate){alert("Please enter a due date.");return;}
    if (dueDate < "2000-01-01" || dueDate > "2100-12-31"){alert("Please enter a valid date.");return;}
    if (cat==="custom"&&!custom){alert("Please enter a bill name.");return;}
    await dbPut("bills",{id:mkid(),cat:cat,customName:custom,dueDate:dueDate,amount:parseFloat(el("billAmt").value)||0,notes:el("billNotes").value.trim(),recurring:el("billRecurring").checked,paid:false,carriedForwardFrom:null,ts:Date.now()});
    ["billDueDate","billAmt","billNotes"].forEach(function(id){el(id).value="";});
    el("billRecurring").checked=false; el("billCat").value="electricity"; elStyle("customBillRow","none");
    activePayTab = "bills";
    openOv("ov-payschedule-list");
  } catch(e) { console.error("saveBill:",e); }
}
async function toggleBillPaid(id) { try{var b=await dbGet("bills",id);if(!b)return;b.paid=!b.paid;await dbPut("bills",b);renderBills();}catch(e){console.error(e);} }
async function delBill(id)        { if(!confirm("Delete this bill?"))return; try{await dbDel("bills",id);renderBills();}catch(e){console.error(e);} }

async function renderBills() {
  try {
    var mk=curM(), today=new Date(); today.setHours(0,0,0,0);
    var bills=(await dbAll("bills")).filter(function(b){return mKey(b.dueDate)===mk||b.recurring;}).sort(function(a,b){return a.dueDate.localeCompare(b.dueDate);});
    var container=el("billList");
    if (!bills.length){container.innerHTML='<div class="empty">No bills this month.</div>';return;}
    var html=bills.map(function(b){
      var info=BILL_CATS[b.cat]||{label:b.customName||"Bill",icon:"🧾"};
      var label=b.cat==="custom"?(b.customName||"Custom"):info.label;
      var due=new Date(b.dueDate+"T00:00:00"), days=Math.round((due-today)/86400000);
      var soonTxt=days>=0&&days<=3?'<span class="pay-soon">Due in '+days+' day(s)</span>':days<0?'<span class="pay-soon">Overdue</span>':"";
      var ps=b.paid?"opacity:.5;text-decoration:line-through;":"";
      var rb=b.recurring?'<span style="font-size:9px;background:#ede9ff;color:#6366f1;font-weight:800;padding:2px 7px;border-radius:10px;margin-right:4px;">Monthly</span>':"";
      var pb=b.paid?'<span style="font-size:9px;background:#edfaf5;color:#00966d;font-weight:800;padding:2px 7px;border-radius:10px;">Paid</span>':"";
      var bg=b.paid?"#ffe4e3":"#edfaf5", col=b.paid?"#ff5e57":"#00c48c", lbl=b.paid?"Unpay":"Mark Paid";
      return '<div class="pay-card"><div class="pay-card-head"><div data-action="info-bill" data-id="'+b.id+'" data-label="'+label.replace(/"/g,"&quot;")+'" style="cursor:pointer;"><span class="pay-tag">'+info.icon+" "+label+'</span><div class="pay-name" style="'+ps+'">'+label+'</div><div class="pay-meta">Due: '+due.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})+'</div>'+(b.amount?'<div class="pay-amt">AED '+fmt(b.amount)+'</div>':"")+(b.notes?'<div class="pay-meta">'+b.notes+'</div>':"")+soonTxt+'<div style="margin-top:6px;">'+rb+pb+'</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;"><button class="pay-del" data-action="del-bill" data-id="'+b.id+'">x</button><button data-action="paid-bill" data-id="'+b.id+'" style="font-size:10px;padding:5px 10px;border-radius:20px;border:none;font-weight:800;background:'+bg+';color:'+col+';">'+lbl+'</button></div></div></div>';
    }).join("");
    container.innerHTML=html;
    container.onclick = function(e) {
      var btn = e.target.closest("[data-action]"); if(!btn) return;
      var action=btn.dataset.action, id=btn.dataset.id;
      if(action==="info-bill") openBillActionMenu(id, btn.dataset.label);
      else if(action==="paid-bill") toggleBillPaid(id);
      else if(action==="del-bill") delBill(id);
    };
  } catch(e){console.error("renderBills:",e);}
}

async function saveCheque() {
  try {
    var dueDate=el("chequeDueDate").value, payee=el("chequePayee").value.trim();
    if(!allRequired([dueDate,payee])){alert("Please enter cheque date and payee.");return;}
    await dbPut("cheques",{id:mkid(),num:el("chequeNum").value.trim(),dueDate:dueDate,payee:payee,amount:parseFloat(el("chequeAmt").value)||0,bank:el("chequeBankName").value.trim(),notes:el("chequeNotes").value.trim(),recurring:el("chequeRecurring").checked,paid:false,carriedForwardFrom:null,ts:Date.now()});
    ["chequeNum","chequeDueDate","chequePayee","chequeAmt","chequeBankName","chequeNotes"].forEach(function(id){var e=el(id);if(e)e.value="";});
    el("chequeRecurring").checked=false;
    activePayTab = "cheques";
    openOv("ov-payschedule-list");
  } catch(e){console.error("saveCheque:",e);}
}
async function toggleChequePaid(id){try{var c=await dbGet("cheques",id);if(!c)return;c.paid=!c.paid;await dbPut("cheques",c);renderCheques();}catch(e){console.error(e);}}
async function delCheque(id){if(!confirm("Delete this cheque?"))return;try{await dbDel("cheques",id);renderCheques();}catch(e){console.error(e);}}

async function renderCheques() {
  try {
    var mk=curM(),today=new Date();today.setHours(0,0,0,0);
    var cheqs=(await dbAll("cheques")).filter(function(c){return mKey(c.dueDate)===mk||c.recurring;}).sort(function(a,b){return a.dueDate.localeCompare(b.dueDate);});
    var container=el("chequeList");
    if(!cheqs.length){container.innerHTML='<div class="empty">No cheques this month.</div>';return;}
    var html=cheqs.map(function(c){
      var due=new Date(c.dueDate+"T00:00:00"),days=Math.round((due-today)/86400000);
      var soonTxt=days>=0&&days<=3?'<span class="pay-soon">Due in '+days+' day(s)</span>':days<0?'<span class="pay-soon">Overdue</span>':"";
      var ps=c.paid?"opacity:.5;text-decoration:line-through;":"";
      var rb=c.recurring?'<span style="font-size:9px;background:#ede9ff;color:#6366f1;font-weight:800;padding:2px 7px;border-radius:10px;margin-right:4px;">Monthly</span>':"";
      var pb=c.paid?'<span style="font-size:9px;background:#edfaf5;color:#00966d;font-weight:800;padding:2px 7px;border-radius:10px;">Paid</span>':"";
      var bg=c.paid?"#ffe4e3":"#edfaf5",col=c.paid?"#ff5e57":"#00c48c",lbl=c.paid?"Unpay":"Mark Paid";
      return '<div class="pay-card"><div class="pay-card-head"><div data-action="info-cheque" data-id="'+c.id+'" data-payee="'+c.payee.replace(/"/g,"&quot;")+'" style="cursor:pointer;"><span class="pay-tag">Cheque</span><div class="pay-name" style="'+ps+'">'+c.payee+'</div><div class="pay-meta">Cheque #'+(c.num||"-")+" · "+(c.bank||"")+'</div><div class="pay-meta">Due: '+due.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})+'</div>'+(c.amount?'<div class="pay-amt">AED '+fmt(c.amount)+'</div>':"")+soonTxt+'<div style="margin-top:6px;">'+rb+pb+'</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;"><button class="pay-del" data-action="del-cheque" data-id="'+c.id+'">x</button><button data-action="paid-cheque" data-id="'+c.id+'" style="font-size:10px;padding:5px 10px;border-radius:20px;border:none;font-weight:800;background:'+bg+';color:'+col+';">'+lbl+'</button></div></div></div>';
    }).join("");
    container.innerHTML=html;
    container.onclick = function(e) {
      var btn = e.target.closest("[data-action]"); if(!btn) return;
      var action=btn.dataset.action, id=btn.dataset.id;
      if(action==="info-cheque") openChequeActionMenu(id, btn.dataset.payee);
      else if(action==="paid-cheque") toggleChequePaid(id);
      else if(action==="del-cheque") delCheque(id);
    };
  } catch(e){console.error("renderCheques:",e);}
}

// ── BILL ACTION MENU (view/edit/delete) ────────────────────────────
async function openBillActionMenu(id, label) {
  try {
    var b = await dbGet("bills", id); if (!b) return;
    var btns = el("billActionButtons"); btns.innerHTML = "";
    btns.appendChild(mkB("btn mb","Edit Bill",function(){ openEditBill(id); }));
    btns.appendChild(mkB("btn me","Delete Bill",function(){ confirmDelBill(id, label); }));
    btns.appendChild(mkB("btn ghost","Cancel",function(){ closeAll(); openOv("ov-payschedule-list"); }));
    el("billActionTitle").textContent = label;
    openOv("ov-bill-action");
  } catch(e) { console.error("openBillActionMenu:", e); }
}
function confirmDelBill(id, label) {
  var btns = el("billActionButtons"); btns.innerHTML = "";
  var msg = document.createElement("p");
  msg.style.cssText = "text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;";
  msg.innerHTML = 'Delete <b style="color:var(--ink);">'+label+'</b>?<br><span style="font-size:11px;">This cannot be undone.</span>';
  var delBtn = mkB("btn me","Delete Bill", async function(){ try{ await dbDel("bills",id); closeAll(); activePayTab="bills"; openOv("ov-payschedule-list"); }catch(e){console.error(e);} });
  var cancelBtn = mkB("btn ghost","Cancel", function(){ openBillActionMenu(id, label); });
  btns.appendChild(msg); btns.appendChild(delBtn); btns.appendChild(cancelBtn);
  el("billActionTitle").textContent = "Delete Bill";
}
function toggleEditCustomBill() {
  elStyle("editCustomBillRow", el("editBillCat").value==="custom" ? "" : "none");
}
async function openEditBill(id) {
  try {
    var b = await dbGet("bills", id); if (!b) return;
    el("editBillId").value = b.id;
    el("editBillCat").value = b.cat;
    el("editCustomBillName").value = b.customName || "";
    toggleEditCustomBill();
    el("editBillDueDate").value = b.dueDate;
    el("editBillAmt").value = b.amount || "";
    el("editBillNotes").value = b.notes || "";
    el("editBillRecurring").checked = !!b.recurring;
    closeAll();
    openOv("ov-bill-edit");
  } catch(e) { console.error("openEditBill:", e); }
}
async function saveEditBill() {
  try {
    var id = el("editBillId").value;
    var dueDate = el("editBillDueDate").value;
    var cat = el("editBillCat").value;
    var custom = el("editCustomBillName").value.trim();
    if (!dueDate) { alert("Please enter a due date."); return; }
    if (dueDate < "2000-01-01" || dueDate > "2100-12-31") { alert("Please enter a valid date."); return; }
    if (cat === "custom" && !custom) { alert("Please enter a bill name."); return; }
    var b = await dbGet("bills", id); if (!b) return;
    b.cat = cat; b.customName = custom; b.dueDate = dueDate;
    b.amount = parseFloat(el("editBillAmt").value) || 0;
    b.notes = el("editBillNotes").value.trim();
    b.recurring = el("editBillRecurring").checked;
    await dbPut("bills", b);
    closeAll();
    activePayTab = "bills";
    openOv("ov-payschedule-list");
  } catch(e) { console.error("saveEditBill:", e); }
}

// ── CHEQUE ACTION MENU (view/edit/delete) ───────────────────────────
async function openChequeActionMenu(id, payee) {
  try {
    var c = await dbGet("cheques", id); if (!c) return;
    var btns = el("chequeActionButtons"); btns.innerHTML = "";
    btns.appendChild(mkB("btn mb","Edit Cheque",function(){ openEditCheque(id); }));
    btns.appendChild(mkB("btn me","Delete Cheque",function(){ confirmDelCheque(id, payee); }));
    btns.appendChild(mkB("btn ghost","Cancel",function(){ closeAll(); openOv("ov-payschedule-list"); }));
    el("chequeActionTitle").textContent = payee;
    openOv("ov-cheque-action");
  } catch(e) { console.error("openChequeActionMenu:", e); }
}
function confirmDelCheque(id, payee) {
  var btns = el("chequeActionButtons"); btns.innerHTML = "";
  var msg = document.createElement("p");
  msg.style.cssText = "text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;";
  msg.innerHTML = 'Delete cheque to <b style="color:var(--ink);">'+payee+'</b>?<br><span style="font-size:11px;">This cannot be undone.</span>';
  var delBtn = mkB("btn me","Delete Cheque", async function(){ try{ await dbDel("cheques",id); closeAll(); activePayTab="cheques"; openOv("ov-payschedule-list"); }catch(e){console.error(e);} });
  var cancelBtn = mkB("btn ghost","Cancel", function(){ openChequeActionMenu(id, payee); });
  btns.appendChild(msg); btns.appendChild(delBtn); btns.appendChild(cancelBtn);
  el("chequeActionTitle").textContent = "Delete Cheque";
}
async function openEditCheque(id) {
  try {
    var c = await dbGet("cheques", id); if (!c) return;
    el("editChequeId").value = c.id;
    el("editChequeNum").value = c.num || "";
    el("editChequeDueDate").value = c.dueDate;
    el("editChequePayee").value = c.payee;
    el("editChequeAmt").value = c.amount || "";
    el("editChequeBankName").value = c.bank || "";
    el("editChequeNotes").value = c.notes || "";
    el("editChequeRecurring").checked = !!c.recurring;
    closeAll();
    openOv("ov-cheque-edit");
  } catch(e) { console.error("openEditCheque:", e); }
}
async function saveEditCheque() {
  try {
    var id = el("editChequeId").value;
    var dueDate = el("editChequeDueDate").value;
    var payee = el("editChequePayee").value.trim();
    if (!allRequired([dueDate, payee])) { alert("Please enter cheque date and payee."); return; }
    var c = await dbGet("cheques", id); if (!c) return;
    c.num = el("editChequeNum").value.trim();
    c.dueDate = dueDate;
    c.payee = payee;
    c.amount = parseFloat(el("editChequeAmt").value) || 0;
    c.bank = el("editChequeBankName").value.trim();
    c.notes = el("editChequeNotes").value.trim();
    c.recurring = el("editChequeRecurring").checked;
    await dbPut("cheques", c);
    closeAll();
    activePayTab = "cheques";
    openOv("ov-payschedule-list");
  } catch(e) { console.error("saveEditCheque:", e); }
}

async function carryForwardPayments() {
  try {
    var mk=curM(), today=new Date();
    var pad=function(n){return String(n).padStart(2,"0");};
    async function carryStore(storeName){
      var items=await dbAll(storeName);
      for(var i=0;i<items.length;i++){
        var item=items[i];
        if(!item.recurring||!item.dueDate) continue;
        if(mKey(item.dueDate)===mk) continue;
        var already=items.some(function(x){return x.carriedForwardFrom===item.id&&mKey(x.dueDate)===mk;});
        if(already) continue;
        var orig=new Date(item.dueDate+"T00:00:00");
        var lastDay=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
        var day=Math.min(orig.getDate(),lastDay);
        var newDate=today.getFullYear()+"-"+pad(today.getMonth()+1)+"-"+pad(day);
        var copy=Object.assign({},item,{id:mkid(),dueDate:newDate,paid:false,carriedForwardFrom:item.id,ts:Date.now()});
        await dbPut(storeName,copy);
      }
    }
    await carryStore("bills"); await carryStore("cheques");
  } catch(e){console.warn("carryForwardPayments:",e);}
}

// ── OTHER PAYMENTS ────────────────────────────────────────────────
async function saveOtherPay() {
  try {
    var name = el("otherPayName").value.trim();
    var dueDate = el("otherPayDate").value;
    if (!allRequired([name, dueDate])) { alert("Please enter payment name and date."); return; }
    await dbPut("otherpays", {
      id: mkid(),
      name: name,
      dueDate: dueDate,
      amount: parseFloat(el("otherPayAmt").value)||0,
      notes: el("otherPayNotes").value.trim(),
      recurring: el("otherPayRecurring").checked,
      paid: false,
      carriedForwardFrom: null,
      ts: Date.now()
    });
    ["otherPayName","otherPayDate","otherPayAmt","otherPayNotes"].forEach(function(id){var e=el(id);if(e)e.value="";});
    el("otherPayRecurring").checked = false;
    activePayTab = "others";
    openOv("ov-payschedule-list");
  } catch(e) { console.error("saveOtherPay:",e); }
}

async function toggleOtherPayPaid(id) {
  try { var p=await dbGet("otherpays",id); if(!p)return; p.paid=!p.paid; await dbPut("otherpays",p); renderOtherPays(); } catch(e){console.error(e);}
}
async function delOtherPay(id) {
  if(!confirm("Delete this payment?"))return;
  try { await dbDel("otherpays",id); renderOtherPays(); } catch(e){console.error(e);}
}

async function renderOtherPays() {
  try {
    var mk=curM(), today=new Date(); today.setHours(0,0,0,0);
    var pays=(await dbAll("otherpays")).filter(function(p){return mKey(p.dueDate)===mk||p.recurring;}).sort(function(a,b){return a.dueDate.localeCompare(b.dueDate);});
    var container=el("otherPayList"); if(!container)return;
    if(!pays.length){container.innerHTML="<div class='empty'>No other payments this month.</div>";return;}
    var html=pays.map(function(p){
      var due=new Date(p.dueDate+"T00:00:00"), days=Math.round((due-today)/86400000);
      var soonTxt=days>=0&&days<=3?"<span class='pay-soon'>Due in "+days+" day(s)</span>":days<0?"<span class='pay-soon'>Overdue</span>":"";
      var ps=p.paid?"opacity:.5;text-decoration:line-through;":"";
      var rb=p.recurring?"<span style='font-size:9px;background:#ede9ff;color:#6366f1;font-weight:800;padding:2px 7px;border-radius:10px;margin-right:4px;'>Monthly</span>":"";
      var pb=p.paid?"<span style='font-size:9px;background:#edfaf5;color:#00966d;font-weight:800;padding:2px 7px;border-radius:10px;'>Paid</span>":"";
      var bg=p.paid?"#ffe4e3":"#edfaf5", col=p.paid?"#ff5e57":"#00c48c", lbl=p.paid?"Unpay":"Mark Paid";
      return "<div class='pay-card'><div class='pay-card-head'><div>"
        +"<span class='pay-tag'>📋 "+p.name+"</span>"
        +"<div class='pay-name' style='"+ps+"'>"+p.name+"</div>"
        +"<div class='pay-meta'>Due: "+due.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})+"</div>"
        +(p.amount?"<div class='pay-amt'>AED "+fmt(p.amount)+"</div>":"")
        +(p.notes?"<div class='pay-meta'>"+p.notes+"</div>":"")
        +soonTxt+"<div style='margin-top:6px;'>"+rb+pb+"</div></div>"
        +"<div style='display:flex;flex-direction:column;gap:6px;align-items:flex-end;'>"
        +"<button class='pay-del' data-action='del-op' data-id='"+p.id+"'>x</button>"
        +"<button data-action='paid-op' data-id='"+p.id+"' style='font-size:10px;padding:5px 10px;border-radius:20px;border:none;font-weight:800;background:"+bg+";color:"+col+";'>"+lbl+"</button>"
        +"</div></div></div>";
    }).join("");
    container.innerHTML=html;
    container.onclick = function(e) {
      var btn = e.target.closest("[data-action]"); if(!btn) return;
      var action=btn.dataset.action, id=btn.dataset.id;
      if(action==="del-op") delOtherPay(id);
      else if(action==="paid-op") toggleOtherPayPaid(id);
    };
  } catch(e){console.error("renderOtherPays:",e);}
}

async function carryForwardOtherPays() {
  try {
    var mk=curM(), today=new Date();
    var pad=function(n){return String(n).padStart(2,"0");};
    var items=await dbAll("otherpays");
    for(var i=0;i<items.length;i++){
      var item=items[i];
      if(!item.recurring||!item.dueDate) continue;
      if(mKey(item.dueDate)===mk) continue;
      var already=items.some(function(x){return x.carriedForwardFrom===item.id&&mKey(x.dueDate)===mk;});
      if(already) continue;
      var orig=new Date(item.dueDate+"T00:00:00");
      var lastDay=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
      var day=Math.min(orig.getDate(),lastDay);
      var newDate=today.getFullYear()+"-"+pad(today.getMonth()+1)+"-"+pad(day);
      await dbPut("otherpays",Object.assign({},item,{id:mkid(),dueDate:newDate,paid:false,carriedForwardFrom:item.id,ts:Date.now()}));
    }
  } catch(e){console.warn("carryForwardOtherPays:",e);}
}
