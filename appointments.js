// ── APPOINTMENTS ──────────────────────────────────────────────────
var selAType = "doctor";
function selAT(btn) {
  selAType = btn.dataset.at;
  document.querySelectorAll(".atbtn").forEach(function(b){b.classList.remove("sel");}); btn.classList.add("sel");
  elStyle("af-service", selAType==="service" ? "" : "none");
}
async function saveAppt() {
  try {
    var title = el("apptTitle").value.trim(), dt = el("apptDT").value;
    if (!allRequired([title, dt])) { alert("Please enter title and date/time."); return; }
    var entry = { id:mkid(), type:selAType, title:title, datetime:dt, notes:el("apptNotes").value.trim(), recurring:el("apptRecurring").checked, ts:Date.now() };
    if (selAType==="service") { entry.car=el("svcCar").value.trim(); entry.svcType=el("svcType").value.trim(); }
    await dbPut("appointments", entry);
    ["apptTitle","apptDT","apptNotes","svcCar","svcType"].forEach(function(id){var e=el(id);if(e)e.value="";});
    el("apptRecurring").checked = false;
    renderAppts();
  } catch(e) { console.error("saveAppt:", e); }
}
async function delAppt(id) { try{await dbDel("appointments",id);renderAppts();}catch(e){console.error(e);} }
async function renderAppts() {
  try {
    var appts = (await dbAll("appointments")).sort(function(a,b){return new Date(a.datetime)-new Date(b.datetime);});
    var container = el("apptList");
    if (!appts.length) { container.innerHTML = '<div class="empty">No appointments yet.</div>'; return; }
    var now = new Date();
    var html = appts.map(function(a) {
      var d = new Date(a.datetime), past = d < now;
      var dt = d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"}) + " at " + d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
      var extra = a.type==="service"&&(a.car||a.svcType) ? '<div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">'+(a.car||"")+(a.car&&a.svcType?" · ":"")+(a.svcType||"")+'</div>' : "";
      var recurBadge = a.recurring && !a.carriedForwardFrom ? '<span style="font-size:9px;background:#fff3cf;color:#c07800;font-weight:800;padding:2px 7px;border-radius:10px;margin-top:3px;display:inline-block;">Monthly</span>' : "";
      var carriedBadge = a.carriedForwardFrom ? '<span style="font-size:9px;background:#ede9ff;color:#4338ca;font-weight:800;padding:2px 7px;border-radius:10px;margin-top:3px;display:inline-block;">Carried forward</span>' : "";
      return '<div class="acard" style="cursor:pointer;" data-id="'+a.id+'" data-title="'+a.title+'"><div class="aico" style="background:'+(APPT_COLORS[a.type]||"#f3f0ff")+'">'+(APPT_ICONS[a.type]||"📋")+'</div><div class="ainfo"><div class="atitle" style="'+(past?"opacity:.5;text-decoration:line-through":"")+'">' + a.title + '</div><div class="adt">' + dt + (past?" · past":"") + '</div>' + extra + (a.notes?'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+a.notes+'</div>':"") + recurBadge + carriedBadge + '</div><button style="color:var(--muted);font-size:18px;padding-left:4px;">›</div>';
    }).join("");
    container.innerHTML = html;
    container.querySelectorAll(".acard[data-id]").forEach(function(card) {
      card.addEventListener("click", function() {
        openApptActionMenu(this.dataset.id, this.dataset.title);
      });
    });
  } catch(e) { console.error("renderAppts:", e); }
}
// ── APPOINTMENTS: MENU NAVIGATION ─────────────────────────────────
async function updateApptCount() {
  try {
    var appts = await dbAll("appointments");
    var countEl = el("savedApptsCount");
    if (countEl) countEl.textContent = appts.length > 0 ? appts.length + " appointment" + (appts.length===1?"":"s") + " saved" : "No appointments saved yet";
  } catch(e) { console.error("updateApptCount:", e); }
}
async function openSavedApptsOverlay() {
  await renderAppts();
  openOv("ov-appt-list");
}
function closeApptList() {
  document.querySelectorAll(".ov").forEach(function(o){ o.classList.remove("open"); });
  el("ov-appts").classList.add("open");
  updateApptCount();
}
function openAddApptOverlay() {
  openOv("ov-appt-add");
}
function closeApptAdd() {
  document.querySelectorAll(".ov").forEach(function(o){ o.classList.remove("open"); });
  el("ov-appts").classList.add("open");
  updateApptCount();
}

// ── APPOINTMENT ACTION MENU (view details / edit / delete) ────────
async function openApptActionMenu(id, title) {
  try {
    var a = await dbGet("appointments", id); if (!a) return;
    var d = new Date(a.datetime);
    var dt = d.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"}) + " at " + d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
    var typeLabel = {doctor:"🩺 Doctor",service:"🔧 Service",spa:"💆 Spa",other:"📋 Others"}[a.type] || a.type;
    var info = el("apptActionInfo");
    if (info) {
      info.style.display = "";
      info.innerHTML = '<div class="dctag">'+typeLabel+'</div>'
        + '<div class="dcnum">'+a.title+'</div>'
        + '<div class="dcexp">'+dt+'</div>'
        + (a.type==="service"&&(a.car||a.svcType) ? '<div class="dcexp">'+(a.car||"")+(a.car&&a.svcType?" · ":"")+(a.svcType||"")+'</div>' : "")
        + (a.notes ? '<div class="dcexp">Notes: '+a.notes+'</div>' : "")
        + (a.recurring && !a.carriedForwardFrom ? '<div class="dcexp">🔁 Repeats monthly</div>' : "");
    }
    var btns = el("apptActionButtons"); btns.innerHTML = "";
    btns.appendChild(mkB("btn mb","Edit Appointment",function(){ openEditAppt(id); }));
    btns.appendChild(mkB("btn me","Delete Appointment",function(){ confirmDelAppt(id, a.title); }));
    btns.appendChild(mkB("btn ghost","Cancel",function(){ closeAll(); openOv("ov-appt-list"); }));
    el("apptActionTitle").textContent = a.title;
    openOv("ov-appt-action");
  } catch(e) { console.error("openApptActionMenu:", e); }
}
function confirmDelAppt(id, title) {
  var info = el("apptActionInfo"); if (info) info.style.display = "none";
  var btns = el("apptActionButtons"); btns.innerHTML = "";
  var msg = document.createElement("p");
  msg.style.cssText = "text-align:center;color:var(--muted);font-size:13px;margin-bottom:4px;";
  msg.innerHTML = 'Delete <b style="color:var(--ink);">'+title+'</b>?<br><span style="font-size:11px;">This cannot be undone.</span>';
  var delBtn = mkB("btn me","Delete Appointment", async function(){ await delAppt(id); closeAll(); openOv("ov-appt-list"); });
  var cancelBtn = mkB("btn ghost","Cancel", function(){ openApptActionMenu(id, title); });
  btns.appendChild(msg); btns.appendChild(delBtn); btns.appendChild(cancelBtn);
  el("apptActionTitle").textContent = "Delete Appointment";
}

// ── APPOINTMENT EDIT ────────────────────────────────────────────
var selEditAType = "doctor";
function selEditAT(btn) {
  selEditAType = btn.dataset.at;
  document.querySelectorAll("#editApptTypes .atbtn").forEach(function(b){b.classList.remove("sel");}); btn.classList.add("sel");
  elStyle("edit-af-service", selEditAType==="service" ? "" : "none");
}
async function openEditAppt(id) {
  try {
    var a = await dbGet("appointments", id); if (!a) return;
    el("editApptId").value = a.id;
    el("editApptTitle").value = a.title;
    el("editApptDT").value = a.datetime;
    el("editApptNotes").value = a.notes || "";
    el("editApptRecurring").checked = !!a.recurring;
    el("editSvcCar").value = a.car || "";
    el("editSvcType").value = a.svcType || "";
    selEditAType = a.type || "doctor";
    document.querySelectorAll("#editApptTypes .atbtn").forEach(function(b){ b.classList.toggle("sel", b.dataset.at===selEditAType); });
    elStyle("edit-af-service", selEditAType==="service" ? "" : "none");
    closeAll();
    openOv("ov-appt-edit");
  } catch(e) { console.error("openEditAppt:", e); }
}
async function saveEditAppt() {
  try {
    var id = el("editApptId").value;
    var title = el("editApptTitle").value.trim(), dt = el("editApptDT").value;
    if (!allRequired([title, dt])) { alert("Please enter title and date/time."); return; }
    var a = await dbGet("appointments", id); if (!a) return;
    a.type = selEditAType;
    a.title = title;
    a.datetime = dt;
    a.notes = el("editApptNotes").value.trim();
    a.recurring = el("editApptRecurring").checked;
    if (selEditAType === "service") { a.car = el("editSvcCar").value.trim(); a.svcType = el("editSvcType").value.trim(); }
    else { a.car = ""; a.svcType = ""; }
    await dbPut("appointments", a);
    closeAll();
    openOv("ov-appt-list");
  } catch(e) { console.error("saveEditAppt:", e); }
}

async function checkAppointmentCarryForward() {
  try {
    var appts = await dbAll("appointments"), now = new Date();
    for (var i = 0; i < appts.length; i++) {
      var a = appts[i];
      if (!a.datetime || !a.recurring) continue;
      var d = new Date(a.datetime);
      if (d >= now) continue;
      if (a.carriedForwardFrom) continue;
      var already = appts.some(function(b){ return b.carriedForwardFrom===a.id && new Date(b.datetime)>=now; });
      if (already) continue;
      var nm = d.getMonth()===11?0:d.getMonth()+1, ny = d.getMonth()===11?d.getFullYear()+1:d.getFullYear();
      var lastDay = new Date(ny,nm+1,0).getDate(), td = Math.min(d.getDate(),lastDay);
      var nd = new Date(ny,nm,td,d.getHours(),d.getMinutes());
      var pad = function(n){return String(n).padStart(2,"0");};
      var ndt = nd.getFullYear()+"-"+pad(nd.getMonth()+1)+"-"+pad(nd.getDate())+"T"+pad(nd.getHours())+":"+pad(nd.getMinutes());
      await dbPut("appointments",{id:mkid(),type:a.type,title:a.title,datetime:ndt,notes:a.notes||"",car:a.car||"",svcType:a.svcType||"",recurring:true,carriedForwardFrom:a.id,ts:Date.now()});
    }
  } catch(e) { console.warn("carryForwardAppts:", e); }
}

