# LAN Deployment — Self-Hosting on an Office Machine

One machine in the office runs the whole stack; everyone else opens it in a browser over the
WiFi. No cloud, no domain, no TLS certificate required.

```
   Office WiFi / LAN
        │
        ├── Laptop A ─┐
        ├── Laptop B ─┼──►  http://192.168.1.50/   ─► nginx :80 ─┬─► static React bundle
        └── Laptop C ─┘          (server machine)                └─► /api/* → FastAPI :5000
                                                                              │
                                                                    Gemini / OpenAI / Groq
                                                                        (needs internet)
```

The server needs outbound internet access — the vision provider is a cloud API. Only the
server needs it; clients just need to reach the server.

---

## 1. Choose the server machine

| Requirement | Why |
|---|---|
| Always on, never sleeps | It is a server now |
| Wired Ethernet if possible | WiFi-to-WiFi adds latency and drops |
| 16 GB RAM recommended, 8 GB minimum | PDFs rasterize to 300-DPI PNGs **entirely in memory** |
| 4+ cores | Rasterization is CPU-bound and holds the GIL |
| Outbound HTTPS allowed | Vision API calls |

Disable sleep, or the app vanishes every evening:

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 15
```

---

## 2. Give it a fixed address

A DHCP lease that changes breaks every bookmark in the office. Either:

- **Preferred** — add a DHCP reservation for the machine's MAC on the office router, or
- set a static IP on the adapter (must be outside the router's DHCP pool).

Find the current address:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' } |
  Select-Object InterfaceAlias, IPAddress
```

Note it down — call it `<SERVER-IP>` below.

---

## 3. Open the firewall

Windows blocks inbound :80 by default. Check which profile the office network is on first —
if it is `Public`, the rule below will not apply to it.

```powershell
Get-NetConnectionProfile
# If NetworkCategory is Public, switch it (office WiFi is a trusted network):
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private

New-NetFirewallRule -DisplayName "ZeroxAI Planner (HTTP 80)" `
  -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private
```

The API port is deliberately **not** opened — it is only reachable through the nginx `/api/`
proxy, and on `127.0.0.1:5000` from the server itself.

> **If clients still cannot connect**, check the access point for **client isolation** (also
> called AP isolation or guest mode). It blocks device-to-device traffic and is on by default
> on many guest networks. It must be off for the LAN segment the office uses.

---

## 4. Configure secrets

```powershell
cd C:\Tech\ZeroxAI-Planner\backend2.0
copy .env.example .env
notepad .env
```

Set at minimum:

```env
VISION_PROVIDER=gemini
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-2.5-flash
```

`APP_ENV` and `TEMP_DIR` in this file are ignored for LAN deploys — `docker-compose.lan.yml`
overrides both.

> **Use a billing-enabled key.** A whole office shares this one key. The free Gemini tier is
> per-key, and `.env.example` warns that `gemini-3.5-flash` can be capped near 20 requests/day
> — that is one afternoon for one person. Rate-limit errors surface as `503` in the UI.

---

## 5. Deploy

With Docker Desktop installed on the server:

```powershell
cd C:\Tech\ZeroxAI-Planner
docker compose -f docker-compose.lan.yml up -d --build
```

First build takes several minutes (PyMuPDF, numpy, Pillow wheels). Then:

```powershell
docker compose -f docker-compose.lan.yml ps
docker compose -f docker-compose.lan.yml logs -f
```

---

## 6. Verify

On the server:

```powershell
curl http://localhost:5000/health          # {"status":"ok","vision":{"configured":true,...}}
curl http://localhost/api/health           # same, through the nginx proxy
```

`vision.configured` must be `true`. If it is `false`, the API key did not reach the container —
check `backend2.0/.env` and rebuild.

**From a different machine on the WiFi** — this is the test that matters:

```
http://<SERVER-IP>/
```

Upload a PDF and confirm results stream in page by page. If the page loads but analysis fails
with a network error, the bundle still has a hardcoded API host; see Troubleshooting.

---

## 7. Give it a name (optional)

`http://192.168.1.50` is hard to remember. Either add an A record for `planner.<office-domain>`
on the internal DNS/router, or push a hosts-file line to each machine:

```
192.168.1.50    planner
```

Because the frontend calls the API at the relative path `/api`, **any** hostname or IP that
reaches the server works with no rebuild.

---

## 8. Day-to-day operations

| Task | Command (from repo root, on the server) |
|---|---|
| Ship a code update | `git pull; docker compose -f docker-compose.lan.yml up -d --build` |
| Rotate an API key | edit `backend2.0/.env`, then `docker compose -f docker-compose.lan.yml up -d --force-recreate api` |
| Tail logs | `docker compose -f docker-compose.lan.yml logs -f api` |
| Restart everything | `docker compose -f docker-compose.lan.yml restart` |
| Stop | `docker compose -f docker-compose.lan.yml down` |

`restart: always` plus Docker Desktop's *Start on login* setting brings the stack back after a
reboot. Verify that setting — it is the usual reason a Monday morning is broken.

There is **nothing to back up**. The app writes no files and keeps no database; analysis results
live in the browser tab until the user exports them. The only irreplaceable item is
`backend2.0/.env`.

---

## 9. Capacity and known limits

**Image uploads serialize globally.** `/analyze` (JPG/PNG/WEBP) runs through
[isolated_runner.py:20](backend2.0/src/infrastructure/isolated_runner.py#L20), a
`ProcessPoolExecutor(max_workers=1)`. Every image analysis in the office queues behind every
other one. PDFs use the SSE path and do run concurrently.

For a team of more than a couple of people, raise the pool:

```python
_executor = ProcessPoolExecutor(max_workers=3, mp_context=ctx, max_tasks_per_child=1)
```

`max_tasks_per_child=1` keeps the per-analysis process isolation the current design relies on.
Size `max_workers` to cores, not people — each worker rasterizes at 300 DPI.

**Other constraints:**

- **No authentication.** Anyone on the WiFi can open the app and spend your API credits. See §10.
- **50 MB / 100 pages per upload** (`MAX_UPLOAD_MB`, `MAX_PDF_PAGES`). nginx is set to 55 MB to
  match; raise both together or uploads fail at the proxy with a 413.
- **Memory is the real ceiling.** A 100-page PDF at 300 DPI is held in RAM. Concurrent large PDFs
  are what will take the box down, not request count.
- **A 15-minute hard timeout** per image analysis (`timeout_seconds=900`), matched by the nginx
  `proxy_read_timeout`.
- **`/export/csv` and `/export/xlsx` are unused by the UI** — the frontend generates both
  client-side. They read an in-memory job store, so they only work for direct API callers, and
  only against the same process that ran the analysis. This is why the API runs as a **single
  uvicorn worker**; adding `--workers N` would make those endpoints 404 intermittently.

---

## 10. Restricting access (recommended)

Cheapest effective control is HTTP basic auth at nginx. On the server:

```powershell
docker run --rm -it httpd:alpine htpasswd -nb team "<password>" > frontend/htpasswd
```

Add to the `server` block in [frontend/nginx.conf](frontend/nginx.conf):

```nginx
auth_basic           "ZeroxAI Planner";
auth_basic_user_file /etc/nginx/htpasswd;
```

and to the frontend `Dockerfile`, after the nginx.conf copy:

```dockerfile
COPY htpasswd /etc/nginx/htpasswd
```

(Add `htpasswd` to `frontend/.dockerignore`'s exceptions if you copy it in.) Alternatively,
restrict by subnet with `allow 192.168.1.0/24; deny all;` — weaker, but zero friction for users.

Traffic is plain HTTP. On a trusted office LAN that is a normal tradeoff; just be aware that
uploaded floor plans cross the network unencrypted.

---

## 11. The Test Suite tab is not available in this deployment

Batch QA is a **development-only** feature. It is implemented as a Vite dev-server plugin
([vite.testSuitePlugin.js](frontend/vite.testSuitePlugin.js)) that reads and writes the
`test-suite/` folder directly through the Node filesystem. It does not exist in a production
build — there is no server-side code for it in FastAPI.

If QA staff need it, run a second, separate dev server on the server machine:

```powershell
cd C:\Tech\ZeroxAI-Planner\frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open `http://<SERVER-IP>:5173/` (open port 5173 in the firewall too). It writes to the
repo checkout on the server, so results are shared. Keep this off the main URL — it is a dev
server, it is slower, and it exposes filesystem write endpoints to the whole LAN.

Its `.env.development` points at `http://localhost:5000`, which will not resolve from another
machine. Set `VITE_API_BASE_URL=http://<SERVER-IP>:5000` in `frontend/.env.development`, and
publish port 5000 to the LAN in the compose file, if you go this route.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Works on the server, no other machine can load the page | Firewall or AP client isolation | §3 |
| Page loads, uploads fail with a network error | Bundle has a hardcoded API host | `docker compose -f docker-compose.lan.yml build --no-cache web` |
| Still failing after rebuild, only in one browser | `apiBaseUrl` cached in `sessionStorage` (`floor-plan-api-store`) | Close the tab, or clear session storage |
| PDF analysis dies partway with 504 | nginx read timeout | Confirm `proxy_read_timeout 900s` is in the running image |
| `413 Request Entity Too Large` | Upload over 55 MB | Raise `client_max_body_size` **and** `MAX_UPLOAD_MB` together |
| `503` with a provider message | API key missing, or rate-limited | `curl http://localhost:5000/health`; check quota |
| Everything 404s after a reboot | Docker Desktop did not auto-start | Enable *Start Docker Desktop when you log in* |

---

## Appendix — running without Docker

If Docker Desktop is not an option, run the two pieces natively on the server:

```powershell
# API — single worker; see §9 for why
cd C:\Tech\ZeroxAI-Planner\backend2.0
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000

# Static bundle
cd C:\Tech\ZeroxAI-Planner\frontend
npm ci
$env:VITE_API_BASE_URL="/api"; $env:VITE_APP_ENV="production"; $env:VITE_FEATURE_TEST_SUITE="false"
npm run build
```

Serve `frontend/dist` with a reverse proxy that mirrors [frontend/nginx.conf](frontend/nginx.conf)
— Caddy is the least painful on Windows. Set `CORS_ORIGINS` in `backend2.0/.env` to
`["http://<SERVER-IP>"]` if you skip the proxy and let the browser call :5000 directly.

Register both as Windows services with [NSSM](https://nssm.cc/) so they survive reboots and
logouts; Task Scheduler with *Run whether user is logged on or not* also works.
