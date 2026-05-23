# Pi Zero 2 W deploy

This package installs the app on Raspberry Pi OS Lite and runs the Flask API with the frontend served from `web/static`.

## Install

Run from the repo root:

```bash
sudo bash deploy/pi-zero-2w/install.sh
```

The installer will:

1. copy the repo to `/opt/idea-radar-system`
2. create `/opt/idea-radar-system/.venv`
3. install Python dependencies from `idea-radar/requirements.txt`
4. copy `idea-radar/.env.example` to `idea-radar/.env` if needed
5. install and start the `idea-radar.service` systemd unit

## Runtime

The service runs with:

- `SERVE_FRONTEND=1`
- port `8000`

That lets Cloudflare Tunnel point at `http://localhost:8000`.
