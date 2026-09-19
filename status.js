import { finalizeEvent, getPublicKey } from "https://esm.sh/nostr-tools@2.10.4";

const KIND = 38383;
const STATUS_FLOW = ["created", "picked_up", "in_transit", "customs", "delivered", "exception"];
const ROLES = ["shipper", "warehouse", "carrier", "customs", "receiver", "admin"];
const STORAGE = { settings: "cln_settings_v1", secret: "cln_secret_v1", shipments: "cln_shipments_v1" };

const esc = (value = "") => String(value).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function secretKey() {
  const hex = localStorage.getItem(STORAGE.secret);
  if (!hex) return null;
  return Uint8Array.from(hex.match(/.{2}/g).map(x => parseInt(x, 16)));
}

function identity() {
  const secret = secretKey();
  return secret ? { secret, pubkey: getPublicKey(secret) } : null;
}

function toast(message) {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add("hidden"), 2800);
}

function currentTrackingId() {
  return new URLSearchParams(location.search).get("track");
}

function makeEvent(shipment, status, note, role) {
  const me = identity();
  if (!me) throw new Error("Nostr identity not found.");
  const timestamp = Math.floor(Date.now() / 1000);
  const content = {
    protocol: "china-laos-nostr-logistics/v1",
    type: "shipment",
    trackingId: shipment.trackingId,
    shipment: {
      productName: shipment.productName, sku: shipment.sku, origin: shipment.origin,
      destination: shipment.destination, sender: shipment.sender, receiver: shipment.receiver,
      weight: shipment.weight, image: shipment.image, visibility: shipment.visibility
    },
    update: { status, note, timestamp },
    actor: { role, pubkey: me.pubkey }
  };
  return finalizeEvent({
    kind: KIND,
    created_at: timestamp,
    tags: [["t", shipment.trackingId], ["d", shipment.trackingId], ["status", status], ["type", "shipment"]],
    content: JSON.stringify(content)
  }, me.secret);
}

function publishToRelay(url, event) {
  return new Promise(resolve => {
    let done = false;
    let ws;
    try { ws = new WebSocket(url); } catch { resolve(false); return; }
    const timer = setTimeout(() => {
      if (!done) { done = true; try { ws.close(); } catch {} resolve(false); }
    }, 7000);
    ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg[0] === "OK" && msg[1] === event.id) {
          done = true; clearTimeout(timer); try { ws.close(); } catch {}
          resolve(Boolean(msg[2]));
        }
      } catch {}
    };
    ws.onerror = () => {
      if (!done) { done = true; clearTimeout(timer); resolve(false); }
    };
    ws.onclose = () => {
      if (!done) { done = true; clearTimeout(timer); resolve(false); }
    };
  });
}

async function publish(event) {
  const settings = load(STORAGE.settings, { relays: [] });
  const relays = Array.isArray(settings.relays) ? settings.relays : [];
  const results = await Promise.allSettled(relays.map(url => publishToRelay(url, event)));
  return results.some(r => r.status === "fulfilled" && r.value === true);
}

function mount() {
  const result = document.querySelector("#trackResult");
  if (!result || document.querySelector("#clnStatusUpdater")) return;
  const id = currentTrackingId();
  if (!id) return;

  const shipments = load(STORAGE.shipments, []);
  const shipment = shipments.find(s => s.trackingId?.toLowerCase() === id.toLowerCase());

  const box = document.createElement("div");
  box.id = "clnStatusUpdater";
  box.className = "mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4";
  box.innerHTML = `
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <div class="font-semibold text-sm">Update shipment status</div>
        <div class="text-xs text-slate-500 mt-1">Create a new signed Nostr event.</div>
      </div>
      <span class="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-200">SIGNED</span>
    </div>
    ${shipment ? `
    <form id="clnStatusForm" class="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
      <select name="status" class="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm">
        ${STATUS_FLOW.map(s => `<option value="${s}" ${shipment.status === s ? "selected" : ""}>${s}</option>`).join("")}
      </select>
      <select name="role" class="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm">
        ${ROLES.map(r => `<option value="${r}">${r}</option>`).join("")}
      </select>
      <input name="note" placeholder="Status note..." class="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-300">
      <button class="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950">Sign & publish</button>
    </form>` : `
      <div class="rounded-lg border border-amber-300/10 bg-amber-300/5 p-3 text-xs text-amber-100">
        This shipment was found remotely. Updating remote-only shipments requires an authorized local signing identity for the shipment organization.
      </div>`}
  `;
  result.appendChild(box);

  document.querySelector("#clnStatusForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const status = String(data.get("status"));
    const role = String(data.get("role"));
    const note = String(data.get("note") || "").trim() || `Status changed to ${status}`;
    if (!STATUS_FLOW.includes(status) || !ROLES.includes(role)) return toast("Invalid status or role.");

    try {
      const event = makeEvent(shipment, status, note, role);
      shipment.status = status;
      shipment.events = [...(shipment.events || []), event];
      save(STORAGE.shipments, shipments);

      if (shipment.visibility === "public") {
        const ok = await publish(event);
        toast(ok ? "Status signed and published." : "Status signed and saved locally; relay publish failed.");
      } else {
        toast("Status signed and saved locally.");
      }

      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      toast(error.message || "Unable to create status event.");
    }
  });
}

const observer = new MutationObserver(() => mount());
observer.observe(document.body, { childList: true, subtree: true });
mount();
