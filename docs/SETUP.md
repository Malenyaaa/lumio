# Setting up Lumio

Lumio runs as one container next to Jellyfin and becomes its public face: people open Lumio, and everything that
belongs to Jellyfin is passed through by Lumio's server, so one address serves both.

```
Internet ─► your reverse proxy (TLS) ─► lumio:8097
                                          ├─ /            the Lumio app
                                          ├─ /api/…       Lumio's server (social, caches, metadata)
                                          ├─ /web/…       jellyfin-web, for the administration only
                                          └─ everything else ─► jellyfin:8096 (API, streams, WebSockets, /sso)
```

- **Jellyfin apps keep working.** Android, iOS, TV apps, Infuse and the like use the same address; their requests go
  straight through (streams with seeking, WebSockets for remote control).
- **jellyfin-web stays for administrators.** The dashboard (`/web/#/dashboard` and its subpages), the metadata manager
  (`/web/#/metadata`) and plugin pages (`/web/#/configurationpage?…`) open as before; everything else of jellyfin-web
  (its home, its player, leaving the dashboard) sends you back to Lumio. Signed in to Lumio, you are signed in there too.
- **Lumio's administrator menu** links to those pages.

## The bare minimum

1. **Add Lumio to your Jellyfin stack.** Start from [`deploy/docker-compose.yml`](../deploy/docker-compose.yml): the
   `lumio` service, with `JELLYFIN_URL` pointing at Jellyfin *inside* the stack (`http://jellyfin:8096`) and
   `PROXY_JELLYFIN: "true"`. Its data (follows, settings, caches, looked-up credits) lives in the `lumio-data` volume.
   The image is `ghcr.io/palmarhealer/lumio:latest`, built from `main` by GitHub Actions.
2. **Point your reverse proxy at Lumio** instead of Jellyfin: `lumio:8097`, with WebSocket support on (Nginx Proxy
   Manager: "Websockets Support"; Caddy and Traefik pass them by default). Lumio and the proxy need a network in common;
   Jellyfin no longer needs to be reachable from outside.
3. **Tell Jellyfin about the proxies** (Dashboard → Networking):
   - *Known proxies*: your reverse proxy and the Lumio container (their addresses on the Docker network, or the
     network's range). Then Jellyfin sees people's real addresses, not Lumio's.
   - *Published server URL* (or `JELLYFIN_PublishedServerUrl`): the public `https://` address.
4. **Open the address** and sign in with a Jellyfin account (password or Quick Connect).

That's all Lumio needs. Everything below makes it better.

## Recommended

### HTTPS

Needed for signing in safely, for the app to install and work offline (its service worker), and for downloads.

### Single sign-on (Jellyfin SSO plugin)

Lumio signs in through Jellyfin's [SSO plugin](https://github.com/9p4/jellyfin-plugin-sso) (OpenID Connect, e.g.
Authentik, Keycloak, Authelia), so accounts stay Jellyfin's:

1. Install the plugin (add its repository under Dashboard → Plugins → Repositories, see its README) and restart
   Jellyfin.
2. In your identity provider, create an OIDC application with the redirect URI
   `https://<your address>/sso/OID/redirect/<provider>`, `<provider>` being the name you give it in the plugin.
3. Configure that provider in the plugin (client id and secret, the provider's address, roles if you like).
4. Give Lumio a button for it: `SSO_PROVIDERS: "<provider>:Sign in with …"` (several separated by commas).

The sign-in page then shows the button. The plugin does the sign-in and finishes it in jellyfin-web; Lumio takes it
over from there (same address, so no second sign-in). Signing out of Lumio signs out of jellyfin-web too.

With SSO, people change their password at the identity provider: build with `VITE_PASSWORD_CHANGE_DISABLED=true` and
`VITE_ACCOUNT_URL` (the provider's account page) to send them there from Lumio's profile page.

### Search (Meilisearch plugin)

Lumio searches through Jellyfin. The [Meilisearch plugin](https://github.com/arnesacnussem/jellyfin-plugin-meilisearch)
makes that search fast and forgiving (typos, partial words), for Lumio and every other app. Run a `meilisearch`
container in the stack and give Jellyfin `MEILI_URL` and `MEILI_MASTER_KEY`, as the plugin's README describes.

### Skipping intros and credits (Intro Skipper)

Lumio offers "Skip intro" / "Skip credits" (or skips by itself, set per user under Settings → Controls) wherever
Jellyfin knows a media segment. The [Intro Skipper](https://github.com/intro-skipper/intro-skipper) plugin finds them
for series; without it, only segments from other sources show up.

### What else Lumio uses from Jellyfin

| Feature in Lumio | Comes from | To set up |
| --- | --- | --- |
| Seek previews (thumbnails over the progress bar) | Jellyfin's trickplay images | Per library: enable trickplay image extraction (Dashboard → Libraries) |
| Synced lyrics | Jellyfin's lyrics, else [lrclib.net](https://lrclib.net) through Lumio's server | Optional: Jellyfin's LrcLib plugin to store them in the library |
| Watching together | Jellyfin SyncPlay | Built in (users need the SyncPlay permission) |
| Quick Connect sign-in | Jellyfin Quick Connect | Dashboard → General → Quick Connect |
| Featured artists, songwriters, producers, labels | MusicBrainz, looked up by Lumio's server | Optional: tag files with [MusicBrainz Picard](https://picard.musicbrainz.org); Lumio's admin page "Music metadata" fills in the whole library |
| Artist photos and biographies | Jellyfin, Epidemic Sound, Deezer, Last.fm (through Lumio's server, kept for months) | Optional Last.fm key (below) |
| Concerts | Ticketmaster (through Lumio's server) | Optional Ticketmaster key (below) |
| TMDb rating | TMDb | Optional TMDb key (below) |
| Remote control, "play on" | Jellyfin sessions | Built in |

### Keys for outside services (optional)

Free keys make Lumio richer. The image comes without any: everyone uses their own, set on the `lumio` container.
The app then asks those services through Lumio's server (which caches the answers for everyone and keeps the keys
off the browser).

| Variable | Service | What it brings |
| --- | --- | --- |
| `LASTFM_API_KEY` | [Last.fm](https://www.last.fm/api) (non-commercial use) | Listener counts, popular songs, similar artists, bios, charts, radios |
| `TICKETMASTER_API_KEY` | [Ticketmaster](https://developer.ticketmaster.com) | Concerts on artist pages and the concerts page |
| `TMDB_API_KEY` | [TMDb](https://www.themoviedb.org/settings/api) | TMDb ratings, names of film series |
| `MUSICBRAINZ_CONTACT` | [MusicBrainz](https://musicbrainz.org) (no key) | A URL or e-mail address; MusicBrainz throttles anonymous clients |

Without a key, what it brings simply stays off. Keep to each service's terms (attribution, Last.fm non-commercial).

### After the first start

As an administrator, in Lumio's settings:

- **Music metadata**: look up every song's credits (featured artists, songwriters …) and fetch every artist's
  information ahead, leaving out libraries, artists or genres (audio plays, say).
- **Branding**, **Display**, **Plugins**: name, logo, colours, where previews open, Lumio plugins.

## Building it yourself

The image needs nothing but Docker:

```sh
docker build -t lumio --build-arg VITE_JELLYFIN_URL=/ --build-arg VITE_SERVER_LOCKED=true .
```

`VITE_JELLYFIN_URL=/` means "Jellyfin is on the address Lumio is opened on" (the proxied setup). Without the proxy,
build with Jellyfin's own address and leave `PROXY_JELLYFIN` off; Lumio then talks to Jellyfin directly, and Jellyfin
must allow it (CORS).

## Updating and backups

- **Update**: pull `ghcr.io/palmarhealer/lumio:latest` and recreate the container (or pin a version tag).
- **Back up** the `lumio-data` volume (SQLite database, settings, caches). Jellyfin keeps its own data as before.

## Troubleshooting

- **Everyone shows up with the same IP in Jellyfin**: the proxies aren't in Jellyfin's *Known proxies*.
- **Remote control or live updates don't work**: WebSockets aren't passed by the reverse proxy.
- **The SSO button does nothing / "provider not found"**: the name in `SSO_PROVIDERS` must match the plugin's provider
  name exactly, and the redirect URI in the identity provider must use the public address.
- **The dashboard asks to sign in again**: sign in to Lumio first; opening `/web/#/dashboard` then signs you in.
