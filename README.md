# dirigera-openapi

📖 **[Browse the docs](https://bombsimon.github.io/dirigera-openapi/)**

---

An [OpenAPI] description of the local REST API on the IKEA DIRIGERA smart home
hub, plus an [AsyncAPI] description of its websocket event stream. Use them to
generate a client in any language, browse the API, or check your own
implementation.

> [!NOTE]
> IKEA doesn't document this API. Everything here comes from community projects
> and testing against a real hub, and firmware updates may change it. This
> project isn't affiliated with IKEA.

- [`openapi.yaml`] describes the REST API with 43 operations over devices,
  rooms, scenes, device sets, users, music, the hub and pairing.
- [`asyncapi.yaml`] describes the websocket with ping and pong plus 19 event
  types for changes to devices, scenes, rooms, device sets and music.

## How much to trust it

Every operation has two extensions:

- `x-verified: true` means the operation was called against a real hub
  (firmware 2.975.4) and the response matched the schema. This covers 12
  operations, all of them reads plus the first pairing step.
- `x-sources` lists the community projects that use the operation, as GitHub
  `owner/repo` slugs. They're linked under [Sources] and in
  `x-source-repositories` at the top of the spec.

Operations that change state are described from the sources but haven't been
verified yet. Their success status is written as `2XX` because the exact code
isn't known. Corrections from people who have tried them are very welcome.

Fields where IKEA keeps adding values, such as device types, capabilities and
icons, are plain strings with the known values listed in the description. A
generated client with closed enums would otherwise fail to parse the response as
soon as you pair a new kind of device.

## Using the API

The hub listens on port 8443 with a self-signed certificate, so turn off
certificate verification or pin the certificate. All paths are under
`https://<hub-ip>:8443/v1`.

### Pairing

Pairing is an OAuth 2 authorization code flow with PKCE, finished by pressing
the action button on the bottom of the hub.

```sh
HUB=192.168.1.100
VERIFIER=$(openssl rand -base64 96 | tr -d '\n=' | tr '/+' '_-' | cut -c1-128)
CHALLENGE=$(printf %s "$VERIFIER" \
  | openssl dgst -sha256 -binary \
  | openssl base64 \
  | tr -d '=' \
  | tr '/+' '_-')

CODE=$(curl -sk "https://$HUB:8443/v1/oauth/authorize" -G \
  --data-urlencode "audience=homesmart.local" \
  --data-urlencode "response_type=code" \
  --data-urlencode "code_challenge=$CHALLENGE" \
  --data-urlencode "code_challenge_method=S256" | jq -r .code)

# Press the action button on the hub, then within 60 seconds:
curl -sk "https://$HUB:8443/v1/oauth/token" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "code_verifier=$VERIFIER" \
  --data-urlencode "name=$(hostname)" \
  --data-urlencode "grant_type=authorization_code" | jq -r .access_token
```

The token doesn't expire. Send it as `Authorization: Bearer <token>`.

### Examples

```sh
# Every device
curl -sk -H "Authorization: Bearer $TOKEN" "https://$HUB:8443/v1/devices"

# Turn a light on at 40% over one second
curl -sk -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  "https://$HUB:8443/v1/devices/$DEVICE_ID" \
  -d '[
    {"attributes": {"isOn": true, "lightLevel": 40}, "transitionTime": 1000}
  ]'

# Move two devices into a room
curl -sk -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  "https://$HUB:8443/v1/rooms/$ROOM_ID/devices" \
  -d '{"deviceIds": ["<device id>", "<device id>"]}'
```

### Events

Instead of polling, open a websocket to `wss://<hub-ip>:8443/v1` with the same
`Authorization` header. The hub pushes an event for every change, including
changes made from the IKEA app or a remote:

```json
{
  "id": "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d",
  "time": "2026-01-01T12:00:01.000Z",
  "specversion": "1.1.0",
  "source": "urn:com:ikea:homesmart:iotc:zigbee",
  "type": "deviceStateChanged",
  "data": { "id": "<device id>", "attributes": { "isOn": true } }
}
```

Send a `ping` every 30 seconds to keep the connection open. The hub replies with
a `pong`. See [`asyncapi.yaml`] for every event.

## Generating a client

Any OpenAPI 3.1 generator should work. Some options:

```sh
# Python
uvx openapi-python-client generate --path openapi.yaml

# TypeScript types
npx openapi-typescript openapi.yaml -o dirigera.d.ts

# Go
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen \
  -generate types,client -package dirigera openapi.yaml

# Many languages
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml -g rust -o dirigera-client
```

[openapi-python-client] has been checked to generate a client from this spec
without errors. Remember to turn off certificate verification in the generated
client.

## Validating

```sh
uvx openapi-spec-validator openapi.yaml
npx @asyncapi/cli validate asyncapi.yaml
```

## Browsing the docs

Every push to `main` builds a static site with [Redocly] for both the REST API
and the websocket, and publishes it to GitHub Pages. The events are under
`/events/`. To build and serve it locally with [just] and Node:

```sh
just serve
```

## Sources

The spec combines the work of everyone who reverse engineered parts of this
API. Thank you!

- [lpgera/dirigera] (TypeScript): most endpoints and response types, the
  websocket and its event types, room and device set management.
- [Leggin/dirigera] (Python): pairing flow, device control, scene creation and
  adaptive profiles.
- [dvdgeisler/DirigeraClient] (Java): group control by type, room, device set
  and audio group, `/step`, remote link targets, firmware channel, cloud
  integration, and cancelling and refreshing authorization.
- [thembo-sec/dirigera_client] (Rust): an earlier partial OpenAPI 3.0 spec and
  notes on error responses.
- [openHAB DIRIGERA binding] (Java): request bodies for sensor configuration,
  hub coordinates, button triggered scenes and circadian presets, and the
  websocket URL.
- [hagronnestad/dirigera] (C#): room control with the `deviceType` filter.
- [sanjoyg/dirigera_platform] (Python): device set control, used by the Home
  Assistant integration.
- [rtoma/dirigera-prometheus-exporter] (Go): the websocket at the root path and
  device polling.
- [salex-org/ikea-dirigera-client] (Go): devices, rooms, scenes and users.
- [uboness/homebridge-dirigera] (TypeScript): identifying devices.
- [zinen/node-dirigera-promise] (JavaScript): listing device sets through
  `/home`.
- [mattias73andersson/dirigera-client-poc] (Python): an early proof of concept
  of the pairing flow.
- [wjtje/DIRIGERA] (Python): hardware details and a pairing script.
- [phillipp/dirigera] (Ruby): pairing and device endpoints.
- [kaliberjs/ikea-dirigera] (JavaScript): device endpoints.
- [0xtosh/denkigera] (JavaScript): device endpoints.
- [bombsimon/dirigera-rs] (Rust): device control, scenes, and tolerant parsing
  of newer devices and scenes.

These projects were checked and use one of the libraries above instead of
calling the API directly: [favoretti/net.favoretti.ikea.dirigera],
[theeuwes-it/homey-dirigera-gateway] (through [theeuwes-it/dirigera-simple]),
[zinen/node-red-contrib-dirigera] and [lpgera/dirigera-web].

## Contributing

Corrections are welcome, especially for operations still marked
`x-verified: false`. If you confirm one against your hub, include the firmware
version, the request and the response with any personal values replaced, and
update `x-verified` in the same change.

## License

[MIT]

[OpenAPI]: https://spec.openapis.org/oas/v3.1.0
[AsyncAPI]: https://www.asyncapi.com/docs/reference/specification/v3.0.0
[`openapi.yaml`]: openapi.yaml
[`asyncapi.yaml`]: asyncapi.yaml
[Sources]: #sources
[openapi-python-client]: https://github.com/openapi-generators/openapi-python-client
[MIT]: LICENSE
[lpgera/dirigera]: https://github.com/lpgera/dirigera
[Leggin/dirigera]: https://github.com/Leggin/dirigera
[dvdgeisler/DirigeraClient]: https://github.com/dvdgeisler/DirigeraClient
[thembo-sec/dirigera_client]: https://github.com/thembo-sec/dirigera_client
[openHAB DIRIGERA binding]: https://github.com/openhab/openhab-addons/tree/main/bundles/org.openhab.binding.dirigera
[hagronnestad/dirigera]: https://github.com/hagronnestad/dirigera
[sanjoyg/dirigera_platform]: https://github.com/sanjoyg/dirigera_platform
[rtoma/dirigera-prometheus-exporter]: https://github.com/rtoma/dirigera-prometheus-exporter
[salex-org/ikea-dirigera-client]: https://github.com/salex-org/ikea-dirigera-client
[uboness/homebridge-dirigera]: https://github.com/uboness/homebridge-dirigera
[zinen/node-dirigera-promise]: https://github.com/zinen/node-dirigera-promise
[mattias73andersson/dirigera-client-poc]: https://github.com/mattias73andersson/dirigera-client-poc
[wjtje/DIRIGERA]: https://github.com/wjtje/DIRIGERA
[phillipp/dirigera]: https://github.com/phillipp/dirigera
[kaliberjs/ikea-dirigera]: https://github.com/kaliberjs/ikea-dirigera
[0xtosh/denkigera]: https://github.com/0xtosh/denkigera
[bombsimon/dirigera-rs]: https://github.com/bombsimon/dirigera-rs
[favoretti/net.favoretti.ikea.dirigera]: https://github.com/favoretti/net.favoretti.ikea.dirigera
[theeuwes-it/homey-dirigera-gateway]: https://github.com/theeuwes-it/homey-dirigera-gateway
[theeuwes-it/dirigera-simple]: https://github.com/theeuwes-it/dirigera-simple
[zinen/node-red-contrib-dirigera]: https://github.com/zinen/node-red-contrib-dirigera
[lpgera/dirigera-web]: https://github.com/lpgera/dirigera-web
[Redocly]: https://redocly.com/docs/cli/commands/build-docs
[just]: https://just.systems
