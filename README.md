# China–Laos Nostr Logistics & Tracking

Serverless decentralized shipment tracking for the China → Laos logistics route.

## Architecture

- **Frontend:** HTML5, CSS3, Tailwind CSS CDN, Noto Sans Lao
- **Application:** Vanilla JavaScript ES6 modules / SPA-style view switching
- **Transport:** Nostr WebSocket relays
- **Event model:** application-defined Nostr kind **38383**
- **Signing:** Schnorr signatures via `nostr-tools`
- **Local cache:** browser LocalStorage
- **Hosting:** GitHub Pages / any static hosting
- **Backend:** none required for the MVP

## Implemented features

- Create unique `CLN-...` tracking IDs with cargo metadata.
- Create and sign Nostr shipment events locally.
- Publish public events to configurable relays.
- Search shipment history locally and through Nostr relays.
- Share tracking URLs with `?track=CLN-...`.
- Copy share links and generate QR codes.
- Responsive dark/glassmorphism UI with Lao-friendly typography.
- Dashboard statistics and recent shipments.
- Public vs local-only shipment visibility.
- Configurable relay list and browser-local Nostr identity.

## Nostr event contract

Each shipment event uses:

- kind: `38383`
- `["t", trackingId]`
- `["d", trackingId]`
- `["status", status]`
- `["type", "shipment"]`

Content contains the application protocol version, shipment metadata and a status update.

## Privacy and security

The MVP's **private** mode means local-only storage: the event is not published to relays.

It does **not** provide encrypted relay storage. For production private shipments, add NIP-44 encryption, key separation/rotation, access control and a reviewed threat model.

The generated private key is stored in browser LocalStorage. Clearing site data removes the local identity. Do not use this demo identity for valuable assets or production custody.

## Run locally

Serve the folder over HTTP because `app.js` imports `nostr-tools` as an ES module:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`.

1. Push/merge to `main`.
2. In GitHub, open **Settings → Pages**.
3. Select **GitHub Actions** as the Pages source if required.
4. The workflow publishes the repository root as a static site.

## Production roadmap

1. Shipment status updates for warehouse/carrier/customs/receiver roles.
2. Signed status-transition rules and organization-level identities.
3. NIP-44 encrypted private shipments.
4. Relay health checks, retry queue and IndexedDB cache.
5. NIP-05 identities.
6. Content-addressed storage for images and customs documents.
7. Lao / Chinese / English localization.
8. Automated tests and security review.

## License

Add the project's preferred license before production release.


## Signed status workflow

The application now supports additional signed shipment events for operational updates.

Status lifecycle:
- created
- picked_up
- in_transit
- customs
- delivered
- exception

Operational roles:
- shipper
- warehouse
- carrier
- customs
- receiver
- admin

Each status update records the selected role and signer public key in the event actor metadata. These role values are application metadata only; they are **not server-side authorization**. Production authorization should use organization-controlled keys, role-specific identities, and signed transition rules.

## Next production phase

- Enforce signed status-transition rules.
- Add organization-level identities and key management.
- Add NIP-44 encrypted private shipments.
- Add relay health, retry queue and IndexedDB persistence.


## Organization identity and signed transitions

The production-security phase now adds a local organization registry and transition policy.

Organization configuration:
- organization ID and name
- organization admin public key
- trusted public keys for shipper, warehouse, carrier, customs and receiver roles
- role-specific status permissions

Signed status events now include:
- organization ID
- role
- signer public key
- previous event ID (prev)
- organization tag (org)
- status and transition metadata

The client rejects status updates when:
- the signing key is not registered for the selected role
- the selected role is not allowed to perform that status
- the new status is not a valid transition from the shipment's current status

This is a **local trust registry** in the current static application. It is not a globally authoritative access-control system because there is no traditional backend. The signed organization manifest uses kind **38384** and is intended to become the basis for distributed organization verification.

## Security note

Nostr event signatures provide cryptographic integrity and signer identity, but they do not by themselves prove that a signer is authorized by a logistics company. Authorization requires a trusted organization root/key registry. The current browser registry is an MVP trust anchor and should be replaced or synchronized with a stronger organization identity model before production.

NIP-44 private shipment encryption remains the next phase. Public Nostr event fields such as tags and timestamps remain observable even when event content is encrypted.
