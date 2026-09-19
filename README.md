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
