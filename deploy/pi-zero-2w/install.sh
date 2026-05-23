#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INSTALL_DIR="/opt/idea-radar-system"
SERVICE_NAME="idea-radar"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Installing dependencies..."
apt-get update
apt-get install -y python3 python3-venv python3-pip rsync

echo "Copying repository to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '.pytest_cache' \
  --exclude 'node_modules' \
  --exclude '*.pyc' \
  --exclude '*.pyo' \
  --exclude 'idea-radar/idea_radar.db' \
  --exclude 'idea-radar/logs/' \
  "${REPO_ROOT}/" "${INSTALL_DIR}/"

if [[ ! -f "${INSTALL_DIR}/idea-radar/.env" ]]; then
  cp "${INSTALL_DIR}/idea-radar/.env.example" "${INSTALL_DIR}/idea-radar/.env"
  chmod 600 "${INSTALL_DIR}/idea-radar/.env"
fi

echo "Creating virtual environment..."
python3 -m venv "${INSTALL_DIR}/.venv"
"${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip
"${INSTALL_DIR}/.venv/bin/pip" install -r "${INSTALL_DIR}/idea-radar/requirements.txt"

echo "Installing systemd service..."
install -m 644 "${SCRIPT_DIR}/${SERVICE_NAME}.service" "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo "Done."
echo "Service status:"
systemctl --no-pager --full status "${SERVICE_NAME}" || true
