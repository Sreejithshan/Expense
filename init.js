// ── INIT ──────────────────────────────────────────────────────────
el("hdate").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"});
initDarkMode();
openDB().then(async function() {
  await restoreFromAutoBackup();
  setTimeout(hideSplash, 2200);
  setTimeout(initPin, 500);
}).catch(function(e) {
  console.error("openDB failed:", e);
  hideSplash();
  var sp = el("splash");
  document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:32px;text-align:center;font-family:-apple-system,sans-serif;color:#1a1a2e;"><div style="font-size:44px;margin-bottom:12px;">⚠️</div><div style="font-size:18px;font-weight:800;margin-bottom:8px;">Couldn\'t open storage</div><div style="font-size:13.5px;color:#888;max-width:320px;line-height:1.5;">FinMob couldn\'t access its local database on this device or browser. This can happen in private/incognito mode or if storage is restricted. Try a normal browser window, or free up device storage, then reload.</div><button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;border-radius:12px;border:none;background:#ff5f8f;color:#fff;font-weight:700;font-size:14px;">Reload</button></div>';
});
