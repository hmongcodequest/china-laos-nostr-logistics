import { finalizeEvent, getPublicKey } from "https://esm.sh/nostr-tools@2.10.4";

const KIND_ORG = 38384;
const STORAGE = { org: "cln_org_v1", secret: "cln_secret_v1" };

export const ROLES = ["shipper", "warehouse", "carrier", "customs", "receiver", "admin"];
export const STATUS_FLOW = ["created", "picked_up", "in_transit", "customs", "delivered", "exception"];

export const TRANSITIONS = {
  created: ["picked_up", "exception"],
  picked_up: ["in_transit", "exception"],
  in_transit: ["customs", "delivered", "exception"],
  customs: ["in_transit", "delivered", "exception"],
  delivered: [],
  exception: ["picked_up", "in_transit", "customs", "delivered", "exception"]
};

export const DEFAULT_ROLE_RULES = {
  created: ["shipper", "admin"],
  picked_up: ["warehouse", "admin"],
  in_transit: ["carrier", "admin"],
  customs: ["customs", "admin"],
  delivered: ["receiver", "carrier", "admin"],
  exception: ["shipper", "warehouse", "carrier", "customs", "receiver", "admin"]
};

const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function secretKey() {
  const hex = localStorage.getItem(STORAGE.secret);
  if (!hex) return null;
  return Uint8Array.from(hex.match(/.{2}/g).map(x => parseInt(x, 16)));
}
function localPubkey() {
  const secret = secretKey();
  return secret ? getPublicKey(secret) : null;
}

export function getOrg() {
  const current = load(STORAGE.org, null);
  if (current?.orgId && current?.adminPubkey) return current;
  return {
    orgId: "cln-local-org",
    name: "China–Laos Logistics",
    adminPubkey: localPubkey() || "",
    roles: {},
    roleRules: DEFAULT_ROLE_RULES
  };
}

export function saveOrg(org) {
  const normalized = {
    orgId: String(org.orgId || "cln-local-org").trim(),
    name: String(org.name || "China–Laos Logistics").trim(),
    adminPubkey: String(org.adminPubkey || "").trim().toLowerCase(),
    roles: Object.fromEntries(ROLES.flatMap(role => {
      const values = Array.isArray(org.roles?.[role]) ? org.roles[role] : [];
      return [[role, [...new Set(values.map(v => String(v).trim().toLowerCase()).filter(v => /^[0-9a-f]{64}$/.test(v))])]];
    })),
    roleRules: Object.fromEntries(STATUS_FLOW.map(status => [
      status,
      [...new Set((org.roleRules?.[status] || DEFAULT_ROLE_RULES[status] || []).filter(role => ROLES.includes(role)))]
    ]))
  };
  save(STORAGE.org, normalized);
  return normalized;
}

export function roleAllowed(org, status, role, pubkey) {
  if (!ROLES.includes(role) || !STATUS_FLOW.includes(status)) return false;
  if (!(org.roleRules?.[status] || []).includes(role)) return false;
  if (role === "admin" && pubkey === org.adminPubkey) return true;
  return Array.isArray(org.roles?.[role]) && org.roles[role].includes(pubkey);
}

export function canTransition(previousStatus, nextStatus, role) {
  if (role === "admin" && nextStatus === "exception") return true;
  return (TRANSITIONS[previousStatus] || []).includes(nextStatus);
}

export function verifyLocalActor(status, role) {
  const pubkey = localPubkey();
  const org = getOrg();
  if (!pubkey) return { ok: false, reason: "Local signing identity is missing." };
  if (!roleAllowed(org, status, role, pubkey)) return { ok: false, reason: "This signing key is not registered for the selected organization role." };
  return { ok: true, pubkey, org };
}

export function latestLocalEvent(shipment) {
  return [...(shipment?.events || [])].sort((a,b) => (b.created_at || 0) - (a.created_at || 0))[0] || null;
}

export function makeOrganizationEvent(org) {
  const secret = secretKey();
  const pubkey = localPubkey();
  if (!secret || !pubkey) throw new Error("Local signing identity is missing.");
  if (org.adminPubkey !== pubkey) throw new Error("Only the organization admin key can publish the organization manifest.");
  const timestamp = Math.floor(Date.now() / 1000);
  return finalizeEvent({
    kind: KIND_ORG,
    created_at: timestamp,
    tags: [["d", org.orgId], ["org", org.orgId], ["type", "organization"]],
    content: JSON.stringify({
      protocol: "china-laos-nostr-logistics/v1",
      type: "organization",
      orgId: org.orgId,
      name: org.name,
      adminPubkey: org.adminPubkey,
      roles: org.roles,
      roleRules: org.roleRules,
      timestamp
    })
  }, secret);
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function renderPanel() {
  const settingsForm = document.querySelector("#settingsForm");
  if (!settingsForm || document.querySelector("#clnOrgPanel")) return;
  const org = getOrg();
  const panel = document.createElement("div");
  panel.id = "clnOrgPanel";
  panel.className = "mt-6 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-5";
  panel.innerHTML = `
    <div class="mb-4"><h2 class="font-semibold">Organization identity & authorization</h2>
      <p class="mt-1 text-xs text-slate-500">Register trusted public keys locally. This registry is client-side trust configuration, not a server-side ACL.</p></div>
    <form id="clnOrgForm" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block"><span class="mb-2 block text-sm text-slate-300">Organization ID</span>
          <input name="orgId" value="${esc(org.orgId)}" required class="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 font-mono text-sm outline-none focus:border-cyan-300"></label>
        <label class="block"><span class="mb-2 block text-sm text-slate-300">Organization name</span>
          <input name="name" value="${esc(org.name)}" required class="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-cyan-300"></label>
      </div>
      <div class="rounded-xl border border-white/10 bg-black/20 p-4"><div class="text-xs text-slate-500">Organization admin pubkey</div>
        <div class="mt-1 break-all font-mono text-xs text-cyan-200">${esc(org.adminPubkey || "—")}</div>
        <p class="mt-2 text-xs text-slate-500">The current browser identity is the admin key for the default local organization.</p></div>
      <div class="grid gap-3 md:grid-cols-2">
        ${ROLES.filter(r => r !== "admin").map(role => `
          <label class="block"><span class="mb-2 block text-sm text-slate-300">${role} pubkeys</span>
            <textarea name="role_${role}" rows="3" placeholder="64-char hex pubkey, one per line" class="w-full rounded-xl border border-white/10 bg-slate-900 p-3 font-mono text-xs outline-none focus:border-cyan-300">${esc((org.roles?.[role] || []).join("\n"))}</textarea></label>`).join("")}
      </div>
      <div class="rounded-xl border border-amber-300/10 bg-amber-300/5 p-4 text-xs text-amber-100"><b>Transition rules:</b>
        created → picked_up → in_transit → customs → delivered. Exception can be recorded by a registered operational role.</div>
      <div class="flex flex-wrap gap-2"><button class="rounded-xl bg-cyan-300 px-4 py-2.5 font-bold text-slate-950">Save organization</button>
        <button type="button" id="clnOrgManifest" class="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">Sign organization manifest</button></div>
      <div id="clnOrgMessage" class="text-xs text-slate-500"></div>
    </form>`;
  settingsForm.parentElement.appendChild(panel);

  panel.querySelector("#clnOrgForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = { ...getOrg(), orgId: fd.get("orgId"), name: fd.get("name"), roles: {} };
    for (const role of ROLES.filter(r => r !== "admin")) next.roles[role] = String(fd.get(`role_${role}`) || "").split("\n").map(x => x.trim().toLowerCase()).filter(Boolean);
    const saved = saveOrg(next);
    panel.querySelector("#clnOrgMessage").textContent = `Saved organization ${saved.orgId}. Local role authorization is enabled.`;
  });

  panel.querySelector("#clnOrgManifest").addEventListener("click", () => {
    try {
      const event = makeOrganizationEvent(getOrg());
      localStorage.setItem("cln_org_manifest_v1", JSON.stringify(event));
      panel.querySelector("#clnOrgMessage").textContent = `Manifest signed: ${event.id}`;
    } catch (error) {
      panel.querySelector("#clnOrgMessage").textContent = error.message || "Unable to sign manifest.";
    }
  });
}

new MutationObserver(renderPanel).observe(document.body, { childList: true, subtree: true });
renderPanel();
