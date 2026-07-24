// ── PEOPLE & DOCUMENTS ────────────────────────────────────────────
var selDocT = null;
async function renderPeople() {
  try {
    var people = await dbAll("people");
    el("personList").innerHTML = people.map(function(p) {
      return '<div class="person-row"><div class="person-name">👤 ' + p.name + '</div><div class="person-actions"><button class="person-edit" data-action="edit-person" data-id="' + p.id + '" data-name="' + p.name + '">Edit</button><button class="person-del" data-action="del-person" data-id="' + p.id + '" data-name="' + p.name + '">Delete</button></div></div>';
    }).join("");
    el("personList").querySelectorAll("[data-action]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var action = this.dataset.action, id = this.dataset.id, name = this.dataset.name;
        if (action === "edit-person") editPerson(id, name);
        else if (action === "del-person") deletePerson(id, name);
      });
    });
    var sel = el("personSel"), prev = sel.value;
    sel.innerHTML = '<option value=""> -  Select person  - </option>' + people.map(function(p) {
      return '<option value="' + p.id + '">' + p.name + '</option>';
    }).join("");
    if (prev) sel.value = prev;
    var selV = el("personSelView");
    if (selV) {
      var prevV = selV.value;
      selV.innerHTML = '<option value=""> -  Select person  - </option>' + people.map(function(p) {
        return '<option value="' + p.id + '">' + p.name + '</option>';
      }).join("");
      if (prevV) selV.value = prevV;
    }
  } catch(e) { console.error("renderPeople:", e); }
}
async function addPerson() {
  try {
    var name = el("newPerson").value.trim(); if (!name) return;
    var existing = await dbAll("people");
    if (existing.some(function(p) { return p.name.toLowerCase() === name.toLowerCase(); })) {
      alert("A person with this name already exists."); return;
    }
    var newId = mkid();
    await dbPut("people", { id:newId, name:name });
    el("newPerson").value = "";
    await renderPeople();
    el("personSel").value = newId;
    renderDocs();
  } catch(e) { console.error("addPerson:", e); }
}
async function editPerson(id, oldName) {
  var n = prompt("Enter new name:", oldName); if (!n || !n.trim()) return;
  try { var p = await dbGet("people", id); p.name = n.trim(); await dbPut("people", p); await renderPeople(); renderDocs(); } catch(e) { console.error("editPerson:", e); }
}
async function deletePerson(id, name) {
  if (!confirm("Delete " + name + " and all their documents?")) return;
  try {
    await dbDel("people", id);
    var docs = await dbAll("documents");
    for (var i = 0; i < docs.length; i++) { if (docs[i].personId === id) await dbDel("documents", docs[i].id); }
    el("personSel").value = ""; await renderPeople(); renderDocs();
  } catch(e) { console.error("deletePerson:", e); }
}
async function renderDocs() {
  try {
    var pid = el("personSel").value, sec = el("docSection");
    if (!pid) { if (sec) sec.style.display = "none"; return; }
    sec.style.display = "";
    selDocT = null;
    document.querySelectorAll(".dtbtn").forEach(function(b){ b.classList.remove("sel"); });
    elStyle("docForm","none"); elStyle("tenForm","none");
  } catch(e) { console.error("renderDocs:", e); }
}

function cancelDocForm() {
  selDocT = null;
  elStyle("docForm","none"); elStyle("tenForm","none");
  var ci = el("chequeInputs"); if (ci) ci.innerHTML = "";
  closeAll();
  openOv("ov-docs-add");
}

// Open saved docs overlay and render list
function openDocsAddOverlay() {
  openOv("ov-docs-add");
}
function closeDocsAdd() {
  closeAll(); openOv("ov-docs");
}
function openDocsViewOverlay() {
  openOv("ov-docs-view");
}
function closeDocsView() {
  closeAll(); openOv("ov-docs");
}
async function renderSavedDocsList(pid) {
  var container = el("savedDocsList"); if (!container) return;
  if (!pid) { container.innerHTML = ""; return; }
  var docs = (await dbAll("documents")).filter(function(d){ return d.personId === pid; });
  if (!docs.length) { container.innerHTML = "<div class='empty'>No documents saved yet for this person.</div>"; return; }
  var today = new Date();
  var tenancies = docs.filter(function(d){ return d.type==="tenancy"; });
  var otherDocs = docs.filter(function(d){ return d.type!=="tenancy"; });
  var tenHTML = tenancies.map(function(d) {
    var exp  = d.endDate ? new Date(d.endDate+"T00:00:00") : null;
    var days = exp ? Math.round((exp-today)/86400000) : null;
    var soon = days !== null && days < 30;
    return '<div class="doccard" style="cursor:pointer;border-left:3px solid var(--dbt);" data-id="'+d.id+'" data-type="tenancy">'
      + '<div class="dctop"><div>'
      + '<div class="dctag" style="color:var(--dbt);">🏠 Tenancy Contract</div>'
      + '<div class="dcnum">'+(d.contractNo||"—")+'</div>'
      + '<div class="dcexp">Landlord: '+(d.landlord||"—")+'</div>'
      + '<div class="dcexp">'+(d.startDate||"")+(d.endDate?" to "+d.endDate:"")+'</div>'
      + (soon?'<div class="dcexp soon">Expires in '+days+' days</div>':"")
      + (d.fileData?'<div class="dcexp" style="color:var(--pri);">📎 File attached</div>':"")
      + '</div><div style="color:var(--muted);font-size:18px;">›</div></div></div>';
  }).join("");
  var docIcons = { govt_id:"🪪", visa:"🛂", passport:"📘", driving:"🚗", other:"📁" };
  var otherHTML = otherDocs.map(function(d) {
    var exp  = d.expiry ? new Date(d.expiry+"T00:00:00") : null;
    var days = exp ? Math.round((exp-today)/86400000) : null;
    var soon = days !== null && days < 90;
    var icon = docIcons[d.type] || "📄";
    return '<div class="doccard" style="cursor:pointer;" data-id="'+d.id+'" data-type="doc">'
      + '<div class="dctop"><div>'
      + '<div class="dctag">'+icon+' '+(DOC_LABELS[d.type]||d.type)+(d.docName?" — "+d.docName:"")+'</div>'
      + '<div class="dcnum">'+(d.docNum||"—")+'</div>'
      + (d.expiry?('<div class="dcexp'+(soon?' soon':'')+'">')+(soon?"Expires "+d.expiry+" ("+days+" days)":"Expires "+d.expiry)+('</div>'):"" )
      + (d.issuedBy?'<div class="dcexp">Issued by: '+d.issuedBy+'</div>':"")
      + (d.fileData?'<div class="dcexp" style="color:var(--pri);">📎 File attached</div>':"")
      + '</div><div style="color:var(--muted);font-size:18px;">›</div></div></div>';
  }).join("");
  container.innerHTML = tenHTML + otherHTML;
  container.querySelectorAll("[data-type='tenancy']").forEach(function(card) {
    card.addEventListener("click", function() { openTenancyActionMenu(this.dataset.id); });
  });
  container.querySelectorAll("[data-type='doc']").forEach(function(card) {
    card.addEventListener("click", function() { openDocActionMenu(this.dataset.id); });
  });
}

// ── DOC ACTION MENU ───────────────────────────────────────────────
async function openDocActionMenu(id) {
  try {
    var d = await dbGet("documents", id); if (!d) return;
    var label = (DOC_LABELS[d.type]||d.type) + (d.docName?" — "+d.docName:"");
    var info = el("docActionInfo");
    if (info) {
      info.style.display = "";
      info.innerHTML = '<div class="dctag">'+label+'</div>'
        + '<div class="dcnum">'+(d.docNum||"—")+'</div>'
        + (d.expiry ? '<div class="dcexp">Expires: '+d.expiry+'</div>' : '')
        + (d.issuedBy ? '<div class="dcexp">Issued by: '+d.issuedBy+'</div>' : '')
        + (d.fileData ? '<div class="dcexp" style="margin-top:6px;">📎 File attached</div>' : '<div class="dcexp" style="margin-top:6px;">No file attached</div>');
    }
    var btns = el("docActionButtons"); btns.innerHTML = "";
    btns.appendChild(mkB("btn mb","View Document",function(){viewDocDetails(id,label);}));
    btns.appendChild(mkB("btn mb","Edit Document",function(){closeAll();openEditDoc(id);}));
    btns.appendChild(mkB("btn ghost","Delete Document",function(){confirmDelDocEntry(id,label);}));
    btns.appendChild(mkB("btn ghost","Cancel",function(){closeAll();}));
    el("docActionTitle").textContent = label;
    openOv("ov-doc-action");
  } catch(e){console.error("openDocActionMenu:",e);}
}
// Read-only "View Document" — shows the saved details plus View/Download
// buttons if a file is attached. No file-management actions here; those
// live exclusively in Edit Document.
async function viewDocDetails(id, label) {
  try {
    var d = await dbGet("documents", id); if (!d) return;
    var info = el("docActionInfo");
    if (info) {
      info.style.display = "";
      info.innerHTML = '<div class="dctag">'+label+'</div>'
        + '<div class="dcnum">'+(d.docNum||"—")+'</div>'
        + (d.docName  ? '<div class="dcexp">Name: '+d.docName+'</div>' : '')
        + (d.expiry   ? '<div class="dcexp">Expires: '+d.expiry+'</div>' : '')
        + (d.issuedBy ? '<div class="dcexp">Issued by: '+d.issuedBy+'</div>' : '')
        + (d.fileData ? '' : '<div class="dcexp" style="margin-top:6px;">No file attached to this document.</div>');
    }
    var btns = el("docActionButtons"); btns.innerHTML = "";
    if (d.fileData) {
      btns.appendChild(mkB("btn mb","View File",function(){viewFile(id);}));
      btns.appendChild(mkB("btn ghost","Download File",function(){dlFile(id);}));
    }
    btns.appendChild(mkB("btn ghost","Back",function(){openDocActionMenu(id);}));
    el("docActionTitle").textContent = label;
  } catch(e) { console.error("viewDocDetails:", e); }
}

function confirmDelDocEntry(id, label) {
  var btns = el("docActionButtons");
  btns.innerHTML = "<p style='text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;'>Delete <b style='color:var(--ink);'>"+label+"</b>?<br><span style='font-size:11px;'>This cannot be undone.</span></p>";
  btns.appendChild(mkB("btn me","Delete Document",async function(){try{await dbDel("documents",id); document.querySelectorAll(".ov").forEach(function(o){o.classList.remove("open");}); el("ov-docs-view").classList.add("open"); await renderSavedDocsList(el("personSelView").value);}catch(e){console.error(e);}}));
  btns.appendChild(mkB("btn ghost","Cancel",function(){closeAll();}));
  el("docActionTitle").textContent = "Delete Document";
}

// ── TENANCY ACTION MENU ───────────────────────────────────────────
async function openTenancyActionMenu(id) {
  try {
    var d = await dbGet("documents", id); if (!d) return;
    var exp  = d.endDate ? new Date(d.endDate+"T00:00:00") : null;
    var days = exp ? Math.round((exp-new Date())/86400000) : null;
    var soon = days !== null && days < 30;
    var info = el("tenActionInfo");
    info.innerHTML = '<div style="font-size:9px;color:var(--dbt);font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Tenancy Contract</div>'
      + '<div style="font-weight:800;font-size:15px;margin:4px 0;">'+(d.contractNo||"—")+'</div>'
      + '<div style="font-size:11.5px;color:var(--muted);">Landlord: '+(d.landlord||"—")+'</div>'
      + '<div style="font-size:11.5px;color:var(--muted);">'+(d.startDate||"")+' to '+(d.endDate||"")+'</div>'
      + (soon ? '<div style="font-size:11px;color:#e17055;font-weight:700;margin-top:4px;">Expires in '+days+' days</div>' : '')
      + '<div style="font-size:11.5px;color:var(--muted);margin-top:4px;">Total Rent: '+fmt(d.totalRent||0)+' · '+(d.cheques||[]).length+' cheques</div>'
      + (d.fileData
        ? '<div class="file-actions" style="margin-top:8px;"><button class="file-btn view" id="taBtnView">View</button><button class="file-btn dl" id="taBtnDl">Download</button><button class="file-btn rep" id="taBtnRep">Replace</button><button class="file-btn rm" id="taBtnRm">Remove</button></div>'
        : '<div class="file-actions" style="margin-top:8px;"><button class="file-btn rep" id="taBtnRep">Attach Contract</button></div>')
      + (d.cheques&&d.cheques.length
        ? '<div style="margin-top:10px;"><div class="stitle" style="margin:8px 0 6px;">Cheques</div>'
          + d.cheques.map(function(ch,i){return '<div class="ch-row" style="margin-bottom:6px;"><div class="cr-top">Cheque #'+(i+1)+' — AED '+fmt(ch.amount)+'</div><div style="font-size:11px;color:var(--muted);">Due: '+(ch.date||"—")+'</div></div>';}).join("")
          + '</div>' : '');
    if(el("taBtnView")) el("taBtnView").addEventListener("click",function(){viewTenFile(id);});
    if(el("taBtnDl"))   el("taBtnDl").addEventListener("click",function(){dlTenFile(id);});
    if(el("taBtnRep"))  el("taBtnRep").addEventListener("click",function(){replaceTenFile(id);});
    if(el("taBtnRm"))   el("taBtnRm").addEventListener("click",function(){removeTenFile(id);});
    var btns = el("tenActionButtons"); btns.innerHTML = "";
    btns.appendChild(mkB("btn mb","View Contract",function(){viewTenancyDetails(id);}));
    btns.appendChild(mkB("btn ghost","Delete Contract",function(){confirmDelTenancyEntry(id,d.contractNo||"this contract");}));
    btns.appendChild(mkB("btn ghost","Cancel",function(){closeAll();}));
    el("tenActionTitle").textContent = d.contractNo || "Tenancy Contract";
    openOv("ov-ten-action");
  } catch(e){console.error("openTenancyActionMenu:",e);}
}
// Read-only "View Contract" — opens the attached file if there is one,
// otherwise shows a read-only summary of the saved contract details.
async function viewTenancyDetails(id) {
  try {
    var d = await dbGet("documents", id); if (!d) return;
    if (d.fileData) { viewTenFile(id); return; }
    var info = el("tenActionInfo");
    if (info) {
      info.innerHTML = '<div style="font-size:9px;color:var(--dbt);font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Tenancy Contract</div>'
        + '<div style="font-weight:800;font-size:15px;margin:4px 0;">'+(d.contractNo||"—")+'</div>'
        + '<div style="font-size:11.5px;color:var(--muted);">Landlord: '+(d.landlord||"—")+'</div>'
        + '<div style="font-size:11.5px;color:var(--muted);">'+(d.startDate||"")+' to '+(d.endDate||"")+'</div>'
        + '<div style="font-size:11.5px;color:var(--muted);margin-top:4px;">Total Rent: '+fmt(d.totalRent||0)+' · '+(d.cheques||[]).length+' cheques</div>'
        + (d.cheques&&d.cheques.length
          ? '<div style="margin-top:10px;"><div class="stitle" style="margin:8px 0 6px;">Cheques</div>'
            + d.cheques.map(function(ch,i){return '<div class="ch-row" style="margin-bottom:6px;"><div class="cr-top">Cheque #'+(i+1)+' — AED '+fmt(ch.amount)+'</div><div style="font-size:11px;color:var(--muted);">Due: '+(ch.date||"—")+'</div></div>';}).join("")
            + '</div>' : '')
        + '<div class="dcexp" style="margin-top:6px;">No file attached to this contract.</div>';
    }
    var btns = el("tenActionButtons"); btns.innerHTML = "";
    btns.appendChild(mkB("btn ghost","Back",function(){openTenancyActionMenu(id);}));
    el("tenActionTitle").textContent = d.contractNo || "Tenancy Contract";
  } catch(e) { console.error("viewTenancyDetails:", e); }
}

function confirmDelTenancyEntry(id, label) {
  var btns = el("tenActionButtons");
  btns.innerHTML = "<p style='text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;'>Delete contract <b style='color:var(--ink);'>"+label+"</b>?</p>";
  btns.appendChild(mkB("btn me","Delete Contract",async function(){try{await dbDel("documents",id); document.querySelectorAll(".ov").forEach(function(o){o.classList.remove("open");}); el("ov-docs-view").classList.add("open"); await renderSavedDocsList(el("personSelView").value);}catch(e){console.error(e);}}));
  btns.appendChild(mkB("btn ghost","Cancel",function(){closeAll();}));
  el("tenActionTitle").textContent = "Delete Contract";
}
function genCheques() {
  var n = parseInt(el("tcNumCh").value) || 0; if (!n || n < 1) { alert("Enter number of cheques."); return; }
  el("chequeInputs").innerHTML = Array.from({length:n}, function(_, i) {
    return '<div class="ch-row"><div class="cr-top">Cheque #' + (i+1) + '</div><div class="ci-row"><span>Amount</span><input type="number" inputmode="decimal" class="ch-amt" placeholder="0"></div><div class="ci-row" style="margin-top:6px"><span>Date</span><input type="date" class="ch-date"></div></div>';
  }).join("");
}
async function saveTenancy() {
  try {
    var pid = el("personSel").value; if (!pid) return;
    var cheques = Array.from(document.querySelectorAll(".ch-amt")).map(function(a, i) {
      return { amount:parseFloat(a.value)||0, date:(document.querySelectorAll(".ch-date")[i]||{}).value||"" };
    }).filter(function(c){return c.amount||c.date;});
    var tcFile = el("tcFile").files[0];
    var doc = { id:mkid(), personId:pid, type:"tenancy", contractNo:el("tcContract").value.trim(), startDate:el("tcStart").value, endDate:el("tcEnd").value, landlord:el("tcLandlord").value.trim(), totalRent:parseFloat(el("tcRent").value)||0, cheques:cheques };
    if (tcFile) { doc.fileData = await fileToDataURL(tcFile); doc.fileName = tcFile.name; }
    await dbPut("documents", doc);
    ["tcContract","tcStart","tcEnd","tcLandlord","tcRent","tcNumCh"].forEach(function(id){el(id).value="";});
    el("chequeInputs").innerHTML = ""; el("tcFile").value = "";
    cancelDocForm(); await renderDocs(); await renderSavedDocsList(el('personSel').value);
  } catch(e) { console.error("saveTenancy:", e); }
}
function openDocEntry(dt) {
  selDocT = dt;
  if (dt === "tenancy") {
    var ci = el("chequeInputs"); if(ci) ci.innerHTML = "";
    ["tcContract","tcStart","tcEnd","tcLandlord","tcRent","tcNumCh"].forEach(function(id){var e=el(id);if(e)e.value="";});
    elStyle("docForm","none"); elStyle("tenForm","");
    el("docEntryTitle").textContent = "Add Tenancy Contract";
  } else {
    elStyle("df-other-name", dt==="other" ? "" : "none");
    el("docNumLbl").textContent = DOC_NUMLBL[dt] || "Number";
    ["docNum","docExpiry","docIssued","docName","docFile"].forEach(function(id){var e=el(id);if(e)e.value="";});
    elStyle("tenForm","none"); elStyle("docForm","");
    el("docEntryTitle").textContent = "Add " + (DOC_LABELS[dt] || dt);
  }
  openOv("ov-doc-entry");
}
async function saveDoc() {
  try {
    var pid = el("personSel").value; if (!pid||!selDocT) return;
    var doc = { id:mkid(), personId:pid, type:selDocT, docNum:el("docNum").value.trim(), expiry:el("docExpiry").value, issuedBy:el("docIssued").value.trim() };
    if (selDocT==="other") doc.docName = el("docName").value.trim();
    var file = el("docFile").files[0];
    if (file) { doc.fileData = await fileToDataURL(file); doc.fileName = file.name; }
    await dbPut("documents", doc);
    cancelDocForm(); await renderDocs(); await renderSavedDocsList(el('personSel').value);
  } catch(e) { console.error("saveDoc:", e); }
}
async function openEditDoc(id) {
  try {
    var d = await dbGet("documents", id); if (!d) return;
    el("editDocId").value = id;
    el("editDocNumLbl").textContent = DOC_NUMLBL[d.type] || "Number";
    elStyle("editDf-other-name", d.type === "other" ? "" : "none");
    el("editDocName").value = d.docName || "";
    el("editDocNum").value = d.docNum || "";
    el("editDocExpiry").value = d.expiry || "";
    el("editDocIssued").value = d.issuedBy || "";
    var fa = el("editDocFileActions");
    if (fa) {
      fa.innerHTML = d.fileData
        ? '<div class="file-actions"><button class="file-btn rep" id="edBtnRep">Replace File</button><button class="file-btn rm" id="edBtnRm">Remove File</button></div>'
        : '<div class="file-actions"><button class="file-btn rep" id="edBtnRep">Attach File</button></div>';
      if (el("edBtnRep")) el("edBtnRep").addEventListener("click", function(){ replaceFile(id); });
      if (el("edBtnRm"))  el("edBtnRm").addEventListener("click", function(){ removeFile(id); });
    }
    el("docEditTitle").textContent = "Edit " + (DOC_LABELS[d.type] || d.type);
    openOv("ov-doc-edit");
  } catch(e) { console.error("openEditDoc:", e); }
}
async function saveEditDoc() {
  try {
    var id = el("editDocId").value;
    var d = await dbGet("documents", id); if (!d) return;
    d.docNum = el("editDocNum").value.trim();
    d.expiry = el("editDocExpiry").value;
    d.issuedBy = el("editDocIssued").value.trim();
    if (d.type === "other") d.docName = el("editDocName").value.trim();
    await dbPut("documents", d);
    closeAll();
    openOv("ov-docs-view");
  } catch(e) { console.error("saveEditDoc:", e); }
}
// Converts a "data:<mime>;base64,...." string into a Blob, so attached
// files can be opened/downloaded via a Blob URL rather than a raw data
// URL — this is what lets browsers reliably render PDFs/images in a new
// tab using their native viewer, across all supported file types.
function dataURLtoBlob(dataURL) {
  var parts = dataURL.split(",");
  var mimeMatch = parts[0].match(/data:([^;]+);base64/);
  var mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  var byteString = atob(parts[1]);
  var arr = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
async function viewFile(id) {
  // Open the tab synchronously, before any await — browsers block
  // window.open() once a promise has resolved, since it's no longer seen
  // as a direct result of the user's tap. Opening first and redirecting
  // it once the data is ready avoids that popup block entirely.
  var w = window.open("", "_blank");
  try {
    var d = await dbGet("documents", id);
    if (!d || !d.fileData) { if (w) w.close(); alert("No file attached to this document."); return; }
    var url = URL.createObjectURL(dataURLtoBlob(d.fileData));
    if (w) { w.location.href = url; }
    else {
      // Popup was blocked outright — fall back to a direct link click
      var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  } catch(e) { console.error("viewFile:", e); if (w) w.close(); alert("Couldn't open the file."); }
}
async function dlFile(id) {
  try {
    var d = await dbGet("documents", id);
    if (!d || !d.fileData) { alert("No file attached to this document."); return; }
    var url = URL.createObjectURL(dataURLtoBlob(d.fileData));
    var a = document.createElement("a"); a.href = url; a.download = d.fileName || "document";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  } catch(e) { console.error("dlFile:", e); alert("Couldn't download the file."); }
}
async function replaceFile(id) { var inp=document.createElement("input");inp.type="file";inp.accept=".pdf,.jpg,.jpeg,.png";inp.onchange=async function(e){var f=e.target.files[0];if(!f)return;try{var d=await dbGet("documents",id);d.fileData=await fileToDataURL(f);d.fileName=f.name;await dbPut("documents",d);closeAll();openOv("ov-docs-view");}catch(err){console.error(err);}};inp.click(); }
async function removeFile(id)  { if(!confirm("Remove attached file?"))return; try{var d=await dbGet("documents",id);d.fileData=null;d.fileName=null;await dbPut("documents",d);closeAll();openOv("ov-docs-view");}catch(e){console.error(e);} }
async function viewTenFile(id)    { viewFile(id); }
async function dlTenFile(id)      { dlFile(id); }
async function replaceTenFile(id) { replaceFile(id); }
async function removeTenFile(id)  { removeFile(id); }

