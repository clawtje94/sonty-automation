#!/usr/bin/env bash
# =============================================================================
# Sonty — Server Provisioning Script
# Run once on a fresh Ubuntu 22.04 VPS to set up the base environment.
#
# Usage:
#   chmod +x provision.sh
#   sudo ./provision.sh [staging|production]
#
# This script does NOT start any services or deploy any configs.
# Run deploy.sh after provisioning is complete.
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: $0 [staging|production]"
  exit 1
fi

echo "==> Provisioning Sonty $ENVIRONMENT server..."

# ─── System update ─────────────────────────────────────────────────────────
echo "==> Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl \
  wget \
  git \
  unzip \
  ufw \
  fail2ban \
  nginx \
  certbot \
  python3-certbot-nginx \
  postgresql-client \
  htop \
  jq \
  age

# ─── Create deploy user ────────────────────────────────────────────────────
echo "==> Creating deploy user..."
if ! id "sonty" &>/dev/null; then
  useradd -m -s /bin/bash -G docker sonty
  echo "User 'sonty' created. Add your SSH public key to /home/sonty/.ssh/authorized_keys"
fi

# ─── Install Docker ────────────────────────────────────────────────────────
echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker sonty
  usermod -aG docker "$SUDO_USER" 2>/dev/null || true
fi

# Ensure Docker starts on boot
systemctl enable docker
systemctl start docker

# ─── Create application directories ───────────────────────────────────────
echo "==> Creating application directories..."
mkdir -p /opt/sonty/{config,data/{n8n,postgres,redis},backups/{postgres,n8n},logs,docker,nginx}
chown -R sonty:sonty /opt/sonty
chmod 700 /opt/sonty/config

# ─── Configure UFW firewall ─────────────────────────────────────────────────
echo "==> Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
# Block direct access to service ports from outside
# (all services bind to 127.0.0.1 only)
ufw --force enable
echo "UFW status:"
ufw status verbose

# ─── Configure fail2ban ────────────────────────────────────────────────────
echo "==> Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = 22
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter  = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ─── Harden SSH ────────────────────────────────────────────────────────────
echo "==> Hardening SSH..."
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
echo "WARNING: Password auth disabled. Ensure your SSH key is in place before closing this session!"

# ─── Configure automatic security updates ─────────────────────────────────
echo "==> Enabling unattended security upgrades..."
apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
systemctl enable unattended-upgrades

# ─── Set up log rotation ───────────────────────────────────────────────────
echo "==> Configuring log rotation..."
cat > /etc/logrotate.d/sonty << 'EOF'
/opt/sonty/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 sonty sonty
}
EOF

# ─── Set up backup cron ────────────────────────────────────────────────────
echo "==> Installing backup cron job..."
SCRIPT_DIR="/opt/sonty"
(crontab -u sonty -l 2>/dev/null; echo "0 3 * * * /opt/sonty/scripts/backup.sh >> /opt/sonty/logs/backup.log 2>&1") | crontab -u sonty -

# ─── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " Provisioning complete for: $ENVIRONMENT"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Add SSH public key for 'sonty' user"
echo "  2. Copy .env.$ENVIRONMENT to /opt/sonty/config/"
echo "  3. Run: ./deploy.sh $ENVIRONMENT"
echo "  4. Issue SSL certificate:"
echo "     certbot --nginx -d staging.automation.sonty.nl -d staging.grafana.sonty.nl"
echo ""
