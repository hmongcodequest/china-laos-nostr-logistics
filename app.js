import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from "https://esm.sh/nostr-tools@2.10.4";

const KIND = 38383;
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net"
];
const STORAGE = {
  settings: "cln_settings_v1",
  secret: "cln_secret_v1",
  shipments: "cln_shipments_v1"
};

const state = {
  view: "dashboard",
  shipments: load(STORAGE.shipments, []),
  settings: load(STORAGE.settings, { relays: DEFAULT_RELAYS, defaultPublic: true }),
  activeTrack: null,
  relayStatus: new Map()
};

const app = document.querySelector("#app");

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message; el.classList.remove("hidden");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hidden"), 2800);
}
function short(id, n=12) { return id ? id.slice(0,n) + "…" : "—"; }
function formatDate(ts) { return new Intl.DateTimeFormat("lo-LA", { dateStyle:"medium", timeStyle:"short" }).format(new Date(ts * 1000)); }
function uid() { return crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase(); }
function getSecret() {
  let hex = localStorage.getItem(STORAGE.secret);
  if (!hex) {
    const bytes = generateSecretKey();
    hex = [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(STORAGE.secret, hex);
  }
  return Uint8Array.from(hex.match(/.{2}/g).map(x => parseInt(x,16)));
}
function getIdentity() {
  const secret = getSecret();
  const pubkey = getPublicKey(secret);
  return { secret, pubkey };
}

function layout(content) {
  return `
    <section class="space-y-6">
      ${content}
    </section>`;
}

function statCard(label, value, hint) {
  return `<div class="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/10">
    <div class="text-sm text-slate-400">${label}</div>
    <div class="mt-2 text-3xl font-bold">${value}</div>
    <div class="mt-1 text-xs text-slate-500">${hint}</div>
  </div>`;
}

function dashboard() {
  const counts = state.shipments.reduce((a,s) => { a[s.status]=(a[s.status]||0)+1; return a; }, {});
  const recent = [...state.shipments].sort((a,b)=>b.createdAt-a.createdAt).slice(0,6);
  return layout(`
    <div class="grid gap-6 lg:grid-cols-[1.5fr_.5fr]">
      <div class="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-white/[0.03] to-blue-500/10 p-7">
        <div class="max-w-2xl">
          <div class="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">NOSTR • SERVERLESS • SIGNED EVENTS</div>
          <h1 class="text-3xl font-bold tracking-tight sm:text-5xl">China → Laos<br><span class="text-cyan-300">Logistics Tracking</span></h1>
          <p class="mt-4 max-w-xl text-slate-300">ສ້າງເລກຕິດຕາມ, ບັນທຶກສະຖານະການຂົນສົ່ງ ແລະ ແບ່ງປັນ tracking link ຜ່ານ Nostr relays ໂດຍບໍ່ຕ້ອງມີ traditional backend.</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button data-view="create" class="rounded-xl bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-200">+ Create shipment</button>
            <button data-view="track" class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-semibold hover:bg-white/10">Track shipment</button>
          </div>
        </div>
      </div>
      <div class="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <div class="text-sm text-slate-400">Nostr identity</div>
        <div class="mt-4 break-all rounded-xl bg-black/20 p-3 font-mono text-xs text-cyan-200">${esc(getIdentity().pubkey)}</div>
        <div class="mt-3 text-xs text-slate-500">Private key ຖືກເກັບໃນ browser localStorage. ຢ່າໃຊ້ wallet ນີ້ເກັບມູນຄ່າຈິງ.</div>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${statCard("Total shipments", state.shipments.length, "Local index")}
      ${statCard("Created", counts.created || 0, "Shipment records")}
      ${statCard("In transit", counts.in_transit || 0, "Moving")}
      ${statCard("Delivered", counts.delivered || 0, "Completed")}
    </div>

    <div class="rounded-2xl border border-white/10 bg-white/[0.035] overflow-hidden">
      <div class="flex items-center justify-between border-b border-white/10 p-5">
        <h2 class="font-semibold">Recent shipments</h2>
        <button data-view="track" class="text-sm text-cyan-300 hover:underline">View all</button>
      </div>
      <div class="divide-y divide-white/10">
        ${recent.length ? recent.map(shipmentRow).join("") : `<div class="p-8 text-center text-slate-500">ຍັງບໍ່ມີ shipment. ກົດ Create shipment ເພື່ອເລີ່ມ.</div>`}
      </div>
    </div>
  `);
}

function shipmentRow(s) {
  const statusLabel = { created:"Created", picked_up:"Picked up", in_transit:"In transit", customs:"Customs", delivered:"Delivered", exception:"Exception" }[s.status] || s.status;
  return `<button data-track-id="${esc(s.trackingId)}" class="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-white/[0.03]">
    <div class="min-w-0">
      <div class="font-mono text-sm font-semibold text-cyan-200">${esc(s.trackingId)}</div>
      <div class="mt-1 truncate text-sm text-slate-300">${esc(s.productName || "Unnamed shipment")}</div>
    </div>
    <div class="text-right">
      <div class="text-xs text-slate-400">${statusLabel}</div>
      <div class="mt-1 text-xs text-slate-600">${formatDate(s.createdAt)}</div>
    </div>
  </button>`;
}

function createView() {
  return layout(`
    <div class="mx-auto max-w-3xl">
      <div class="mb-6"><h1 class="text-2xl font-bold">Create shipment</h1><p class="mt-1 text-sm text-slate-400">ສ້າງ shipment event ແລະ ເລກ tracking ໃໝ່.</p></div>
      <form id="createForm" class="space-y-5 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div class="grid gap-5 sm:grid-cols-2">
          ${input("productName","Product / cargo name","ຕົວຢ່າງ: ເຄື່ອງໃຊ້ໄຟຟ້າ",true)}
          ${input("sku","SKU / Reference","CN-2026-001")}
          ${input("origin","Origin","ຕົວຢ່າງ: Kunming, China")}
          ${input("destination","Destination","ຕົວຢ່າງ: Vientiane, Laos")}
          ${input("sender","Sender","ຊື່ຜູ້ສົ່ງ")}
          ${input("receiver","Receiver","ຊື່ຜູ້ຮັບ")}
          ${input("weight","Weight","kg")}
          ${input("image","Image URL","https://…")}
        </div>
        <div>
          <label class="mb-2 block text-sm text-slate-300">Visibility</label>
          <select name="visibility" class="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 outline-none focus:border-cyan-300">
            <option value="public" ${state.settings.defaultPublic ? "selected":""}>Public — publish to Nostr</option>
            <option value="private" ${state.settings.defaultPublic ? "":"selected"}>Private — local browser only</option>
          </select>
          <p class="mt-2 text-xs text-slate-500">Private mode ໃນ MVP ຈະບໍ່ publish ຂໍ້ມູນຂຶ້ນ relay. ຖ້າຕ້ອງການ encrypted NIP-44 ສາມາດເພີ່ມໃນ phase ຕໍ່ໄປ.</p>
        </div>
        <button class="w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-200">Create & publish</button>
      </form>
    </div>`);
}

function input(name,label,placeholder,required=false) {
  return `<label class="block"><span class="mb-2 block text-sm text-slate-300">${label}</span><input name="${name}" ${required?"required":""} placeholder="${placeholder}" class="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 outline-none placeholder:text-slate-600 focus:border-cyan-300"></label>`;
}

function trackView() {
  const requested = new URLSearchParams(location.search).get("track");
  return layout(`
    <div class="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
      <div>
        <h1 class="text-2xl font-bold">Track shipment</h1>
        <p class="mt-1 text-sm text-slate-400">ຄົ້ນຫາຈາກ local cache ຫຼື Nostr relays.</p>
        <form id="trackForm" class="mt-6 flex gap-2">
          <input name="trackingId" value="${esc(requested || "")}" required placeholder="CLN-XXXXXXXX" class="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-3 font-mono outline-none focus:border-cyan-300">
          <button class="rounded-xl bg-cyan-300 px-4 font-bold text-slate-950">Search</button>
        </form>
        <div class="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400">
          <div class="font-semibold text-slate-200">Relays</div>
          <div class="mt-2 space-y-1">${state.settings.relays.map(r => `<div class="flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-slate-600" data-relay-dot="${esc(r)}"></span><span class="truncate">${esc(r)}</span></div>`).join("")}</div>
        </div>
      </div>
      <div id="trackResult" class="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        ${requested ? `<div class="text-slate-400">Loading <span class="font-mono">${esc(requested)}</span>…</div>` : emptyState("Enter a tracking ID to view shipment history.")}
      </div>
    </div>`);
}

function emptyState(text) { return `<div class="grid min-h-64 place-items-center text-center text-slate-500">${esc(text)}</div>`; }

function settingsView() {
  return layout(`
    <div class="mx-auto max-w-3xl">
      <h1 class="text-2xl font-bold">Settings</h1>
      <p class="mt-1 text-sm text-slate-400">Relay configuration and local application preferences.</p>
      <form id="settingsForm" class="mt-6 space-y-5 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <label class="block">
          <span class="mb-2 block text-sm text-slate-300">Nostr relay URLs</span>
          <textarea name="relays" rows="5" class="w-full rounded-xl border border-white/10 bg-slate-900 p-3 font-mono text-sm outline-none focus:border-cyan-300">${esc(state.settings.relays.join("\n"))}</textarea>
          <span class="mt-2 block text-xs text-slate-500">One wss:// URL per line.</span>
        </label>
        <label class="flex items-center gap-3 rounded-xl border border-white/10 p-4">
          <input type="checkbox" name="defaultPublic" ${state.settings.defaultPublic ? "checked":""} class="h-4 w-4">
          <span><b>Default to public</b><br><small class="text-slate-500">New shipments will publish to relays by default.</small></span>
        </label>
        <div class="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
          <b>Security:</b> this demo keeps a generated Nostr private key in this browser. Clearing site data loses the local identity. Do not use this identity for high-value assets.
        </div>
        <button class="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950">Save settings</button>
        <button type="button" id="clearLocal" class="ml-2 rounded-xl border border-red-400/20 px-5 py-3 text-red-300">Clear local data</button>
      </form>
    </div>`);
}

function render() {
  if (state.view === "create") app.innerHTML = createView();
  else if (state.view === "track") app.innerHTML = trackView();
  else if (state.view === "settings") app.innerHTML = settingsView();
  else app.innerHTML = dashboard();
  bind();
}

function go(view) {
  state.view = view;
  document.querySelector("#mobileNav")?.classList.add("hidden");
  render();
  if (view === "track") {
    const id = new URLSearchParams(location.search).get("track");
    if (id) searchTracking(id);
  }
}

function bind() {
  document.querySelectorAll("[data-view]").forEach(el => el.addEventListener("click", () => go(el.dataset.view)));
  document.querySelectorAll("[data-track-id]").forEach(el => el.addEventListener("click", () => {
    const id = el.dataset.trackId; history.pushState({}, "", "?track=" + encodeURIComponent(id)); go("track");
  }));
  document.querySelector("#mobileMenu")?.addEventListener("click", () => document.querySelector("#mobileNav").classList.toggle("hidden"));
  document.querySelector("#createForm")?.addEventListener("submit", createShipment);
  document.querySelector("#trackForm")?.addEventListener("submit", e => { e.preventDefault(); const id = new FormData(e.currentTarget).get("trackingId").trim(); history.pushState({}, "", "?track=" + encodeURIComponent(id)); searchTracking(id); });
  document.querySelector("#settingsForm")?.addEventListener("submit", saveSettings);
  document.querySelector("#clearLocal")?.addEventListener("click", () => {
    if (confirm("Clear local shipment cache and identity?")) { localStorage.removeItem(STORAGE.shipments); localStorage.removeItem(STORAGE.secret); location.reload(); }
  });
}

async function createShipment(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const shipment = {
    trackingId: "CLN-" + uid(),
    productName: data.productName,
    sku: data.sku,
    origin: data.origin,
    destination: data.destination,
    sender: data.sender,
    receiver: data.receiver,
    weight: data.weight,
    image: data.image,
    visibility: data.visibility,
    status: "created",
    createdAt: Math.floor(Date.now()/1000),
    events: []
  };
  const event = makeEvent(shipment, "created", "Shipment created");
  shipment.events.push(event);
  state.shipments.unshift(shipment); save(STORAGE.shipments, state.shipments);

  if (shipment.visibility === "public") {
    const result = await publishEvent(event);
    toast(result.ok ? "Shipment created and published." : "Saved locally; relay publish failed.");
  } else toast("Private shipment saved locally.");
  history.pushState({}, "", "?track=" + shipment.trackingId);
  go("track");
}

function makeEvent(shipment, status, note) {
  const id = shipment.trackingId;
  const content = {
    protocol: "china-laos-nostr-logistics/v1",
    type: "shipment",
    trackingId: id,
    shipment: {
      productName: shipment.productName, sku: shipment.sku, origin: shipment.origin,
      destination: shipment.destination, sender: shipment.sender, receiver: shipment.receiver,
      weight: shipment.weight, image: shipment.image, visibility: shipment.visibility
    },
    update: { status, note, timestamp: Math.floor(Date.now()/1000) }
  };
  const event = finalizeEvent({
    kind: KIND,
    created_at: content.update.timestamp,
    tags: [["t", id], ["d", id], ["status", status], ["type", "shipment"]],
    content: JSON.stringify(content)
  }, getIdentity().secret);
  return event;
}

async function publishEvent(event) {
  const results = await Promise.allSettled(state.settings.relays.map(url => publishToRelay(url, event)));
  const ok = results.some(r => r.status === "fulfilled" && r.value === true);
  return { ok };
}

function publishToRelay(url, event) {
  return new Promise((resolve) => {
    let done = false;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { if (!done) { done=true; ws.close(); resolve(false); } }, 7000);
    ws.onopen = () => {
      state.relayStatus.set(url, true);
      ws.send(JSON.stringify(["EVENT", event]));
    };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data);
        if (msg[0] === "OK" && msg[1] === event.id) {
          done = true; clearTimeout(timer); ws.close(); resolve(Boolean(msg[2]));
        }
      } catch {}
    };
    ws.onerror = () => { state.relayStatus.set(url, false); if (!done) { done=true; clearTimeout(timer); resolve(false); } };
    ws.onclose = () => { if (!done) { done=true; clearTimeout(timer); resolve(false); } };
  });
}

function queryRelay(url, trackingId) {
  return new Promise((resolve) => {
    let events = [], done = false;
    const ws = new WebSocket(url);
    const sub = "cln" + Math.random().toString(36).slice(2,10);
    const timer = setTimeout(() => { if (!done) { done=true; ws.close(); resolve(events); } }, 7000);
    ws.onopen = () => {
      state.relayStatus.set(url, true);
      ws.send(JSON.stringify(["REQ", sub, { kinds:[KIND], "#t":[trackingId], limit:100 }]));
    };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data);
        if (msg[0] === "EVENT" && msg[1] === sub) events.push(msg[2]);
        if (msg[0] === "EOSE" && msg[1] === sub) { done=true; clearTimeout(timer); ws.send(JSON.stringify(["CLOSE", sub])); ws.close(); resolve(events); }
      } catch {}
    };
    ws.onerror = () => { state.relayStatus.set(url, false); if (!done) { done=true; clearTimeout(timer); resolve(events); } };
    ws.onclose = () => { if (!done) { done=true; clearTimeout(timer); resolve(events); } };
  });
}

async function searchTracking(trackingId) {
  const result = document.querySelector("#trackResult");
  if (!result) return;
  result.innerHTML = `<div class="animate-pulse text-slate-400">Searching local cache and Nostr relays…</div>`;
  const local = state.shipments.find(s => s.trackingId.toLowerCase() === trackingId.toLowerCase());
  let events = local?.events || [];
  const remoteArrays = await Promise.all(state.settings.relays.map(r => queryRelay(r, trackingId).catch(() => [])));
  const remote = remoteArrays.flat();
  for (const ev of remote) {
    try {
      const c = JSON.parse(ev.content);
      if (c.trackingId === trackingId) events.push(ev);
    } catch {}
  }
  events = [...new Map(events.map(ev => [ev.id || JSON.stringify(ev), ev])).values()].sort((a,b) => {
    const at = a.created_at || a.update?.timestamp || 0, bt = b.created_at || b.update?.timestamp || 0; return bt-at;
  });
  if (!events.length) { result.innerHTML = emptyState("No shipment found."); return; }
  renderTracking(result, trackingId, events);
}

function normalizeEvent(ev) {
  if (ev.content) {
    try {
      const c = JSON.parse(ev.content);
      return { timestamp: c.update?.timestamp || ev.created_at, status: c.update?.status || "unknown", note: c.update?.note || "", shipment: c.shipment || {}, pubkey: ev.pubkey, id: ev.id };
    } catch {}
  }
  return ev;
}

function renderTracking(result, trackingId, events) {
  const normalized = events.map(normalizeEvent);
  const first = normalized[normalized.length-1];
  const latest = normalized[0];
  const s = first.shipment || {};
  const share = location.origin + location.pathname + "?track=" + encodeURIComponent(trackingId);
  result.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div><div class="text-xs uppercase tracking-widest text-cyan-300">Tracking ID</div><h2 class="mt-1 font-mono text-xl font-bold">${esc(trackingId)}</h2></div>
      <div class="flex gap-2"><button id="shareBtn" class="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Share</button><button id="qrBtn" class="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">QR</button></div>
    </div>
    <div class="mt-6 grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl bg-black/20 p-4"><div class="text-xs text-slate-500">Status</div><div class="mt-1 font-semibold">${esc(latest.status)}</div></div>
      <div class="rounded-xl bg-black/20 p-4"><div class="text-xs text-slate-500">Route</div><div class="mt-1 text-sm">${esc(s.origin || "—")} → ${esc(s.destination || "—")}</div></div>
      <div class="rounded-xl bg-black/20 p-4"><div class="text-xs text-slate-500">Product</div><div class="mt-1 text-sm">${esc(s.productName || "—")}</div></div>
    </div>
    <div class="mt-7"><h3 class="font-semibold">Event history</h3><div class="mt-4 space-y-3">
      ${normalized.map(ev => `<div class="relative rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <div class="flex flex-wrap items-center justify-between gap-2"><span class="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-200">${esc(ev.status)}</span><span class="text-xs text-slate-500">${formatDate(ev.timestamp)}</span></div>
        <div class="mt-2 text-sm text-slate-300">${esc(ev.note)}</div>
        ${ev.pubkey ? `<div class="mt-2 font-mono text-[10px] text-slate-600">signed by ${esc(short(ev.pubkey,20))}</div>`:""}
      </div>`).join("")}
    </div></div>
    <div class="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
      <div class="text-xs text-slate-500">Share link</div><div class="mt-1 break-all font-mono text-xs text-cyan-200">${esc(share)}</div>
    </div>
    <div id="qrBox" class="mt-4 hidden rounded-xl border border-white/10 bg-white p-5 text-center"><canvas id="qrCanvas" class="mx-auto"></canvas></div>
  `;
  document.querySelector("#shareBtn")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(share); toast("Tracking link copied."); } catch { toast(share); } });
  document.querySelector("#qrBtn")?.addEventListener("click", () => {
    const box = document.querySelector("#qrBox"); box.classList.toggle("hidden");
    if (!box.classList.contains("hidden")) QRCode.toCanvas(document.querySelector("#qrCanvas"), share, { width: 220, margin: 2 });
  });
}

function saveSettings(e) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  const relays = String(data.get("relays")).split("\n").map(x=>x.trim()).filter(x=>/^wss?:\/\//.test(x));
  state.settings = { relays, defaultPublic: data.get("defaultPublic") === "on" };
  save(STORAGE.settings, state.settings);
  toast("Settings saved."); go("settings");
}

window.addEventListener("popstate", () => go(new URLSearchParams(location.search).get("track") ? "track" : "dashboard"));
document.querySelector("#brandBtn").addEventListener("click", () => { history.pushState({}, "", location.pathname); go("dashboard"); });
render();