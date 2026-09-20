#!/usr/bin/env bash
# One-shot server setup + deploy for Welya (Ubuntu/Debian). Run as a sudo-capable user:
#   curl -fsSL https://raw.githubusercontent.com/<you>/welya-v2/main/deploy/server-setup.sh | bash -s -- https://github.com/<you>/welya-v2.git
# Re-run `deploy/deploy.sh` afterwards for updates.
set -euo pipefail

REPO_URL="${1:?usage: server-setup.sh <git-repo-url> [branch]}"
BRANCH="${2:-main}"
APP_DIR="${APP_DIR:-$HOME/welya}"

echo "==> Installing Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Log out and back in (or run: newgrp docker) so your user can use Docker without sudo."
fi

echo "==> Basic firewall (SSH, HTTP, HTTPS only)"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow OpenSSH >/dev/null
  sudo ufw allow 80/tcp >/dev/null
  sudo ufw allow 443/tcp >/dev/null
  sudo ufw allow 443/udp >/dev/null
  sudo ufw --force enable >/dev/null
fi

echo "==> Cloning $REPO_URL ($BRANCH) into $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f .env.docker ]; then
  cp .env.docker.example .env.docker
  # Generate strong secrets so the defaults are never used by accident
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env.docker
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|" .env.docker
  echo
  echo "==> .env.docker created with random DB password and JWT secret."
  echo "    Now edit it and set: APP_DOMAIN, API_DOMAIN, ACME_EMAIL, CORS_ORIGIN, APP_URL, PUBLIC_API_URL,"
  echo "    plus optional AZURE_*, SMTP_*, GOOGLE_* — then run: deploy/deploy.sh"
  exit 0
fi

exec "$APP_DIR/deploy/deploy.sh"
