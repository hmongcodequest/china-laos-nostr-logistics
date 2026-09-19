# China–Laos Nostr Logistics & Tracking

A serverless, decentralized shipment tracking MVP for China → Laos logistics.

## Stack

- HTML5 / CSS3
- Tailwind CSS CDN
- Noto Sans Lao
- Vanilla JavaScript ES6 modules
- Nostr relays over WebSocket
- Nostr event kind **38383** for the application's shipment events
- Schnorr signatures through `nostr-tools`
- Browser LocalStorage for local cache / offline MVP
- GitHub Pages compatible static hosting

## Features

- Create shipment with a unique tracking ID
- Signed Nostr shipment events
- Publish public shipment events to configurable relays
- Search shipment history from local cache + Nostr relays
- Tracking URL: `?track=CLN-...`
- Share link and QR code
- Responsive dark/glassmorphism UI
- Local/private mode that does not publish the shipment
- Configurable Nostr relay list
- No traditional backend or database required for the MVP

## Important privacy note

The MVP treats **private** as local-only: the event is not published to relays. It does **not** encrypt a published event. If private data must be stored on relays, implement NIP-44 encryption and a proper key-management strategy before production use.

## Run locally

Because `app.js` imports `nostr-tools` as an ES module, serve the folder through a local HTTP server:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

Enable GitHub Pages from the repository settings and publish from the `main` branch/root.

## Production roadmap

1. NIP-44 encrypted private shipments.
2. Role-based signing identities for warehouse, carrier, customs and receiver.
3. Signed status-transition rules.
4. NIP-05 identities.
5. Relay redundancy and retry queue.
6. Indexed local cache with IndexedDB.
7. Optional geolocation checkpoints.
8. Customs/document attachments via content-addressed storage.
9. Multi-language UI: Lao / Chinese / English.
10. Automated tests and security review.

## Event shape

Each event uses kind `38383`, with tags such as:

- `["t", trackingId]`
- `["d", trackingId]`
- `["status", status]`
- `["type", "shipment"]`

The event content contains the application protocol version, shipment metadata and a status update.

## License

Add your preferred license before public production use.