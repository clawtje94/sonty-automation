# Sonty — Security Configuration

> Status: Design phase. Not yet provisioned.
> Last updated: 2026-03-08

---

## Security Model Overview

| Layer | Control | Implementation |
|---|---|---|
| Network | Hardware firewall | Hetzner Cloud Firewall |
| OS | Host firewall | UFW |
| OS | Brute-force protection | fail2ban |
| OS | SSH hardening | Key-only auth, no root login |
| OS | Automatic security updates | unattended-upgrades |
| TLS | HTTPS everywhere | Certbot + Let's Encrypt |
| TLS | Modern cipher suites | TLSv1.2 + TLSv1.3 only |
| Application | n8n UI access | IP allowlist via Nginx |
| Application | Grafana access | IP allowlist via Nginx |
| Application | Webhook endpoints | Rate-limited, HMAC-validated |
| Application | n8n auth | Basic auth (username + password) |
| Secrets | Credentials storage | n8n encrypted credential store |
| Secrets | Environment files | Not in git, chmod 600, owner only |
| Data | Internal services | Bind to 127.0.0.1, no external exposure |
| Data | Postgres | Internal Docker network only |
| Data | Redis | Internal Docker network + password |

---

## Hetzner Cloud Firewall Rules

Applied at the Hetzner infrastructure level — blocks traffic before it reaches the VPS.

| Direction | Protocol | Port | Source | Action | Purpose |
|---|---|---|---|---|---|
| Inbound | TCP | 22 | Your IP(s) only | Allow | SSH access |
| Inbound | TCP | 80 | Any | Allow | HTTP (redirects to HTTPS) |
| Inbound | TCP | 443 | Any | Allow | HTTPS |
| Inbound | Any | Any | Any | Deny | Block everything else |
| Outbound | Any | Any | Any | Allow | Allow all outbound |

Configure in Hetzner Cloud Console → Firewalls. Attach firewall to both staging and production servers.

---

## UFW Host Firewall Rules

Adds a second layer of protection at the OS level.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

All service ports (5678, 5432, 6379, 9090, 3000) are NOT opened in UFW — they bind to `127.0.0.1` only.

---

## SSH Hardening

`/etc/ssh/sshd_config` settings:

```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
LoginGraceTime 30
```

Access is via the `sonty` deploy user with an SSH key only. Root login is disabled.

---

## fail2ban Configuration

Jail configuration (`/etc/fail2ban/jail.local`):

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
maxretry = 10
```

fail2ban monitors SSH and Nginx logs and automatically bans IPs that exceed attempt limits.

---

## TLS / SSL Configuration

Certificates issued by Let's Encrypt via Certbot:

```bash
# Staging
certbot --nginx \
  -d staging.automation.sonty.nl \
  -d staging.grafana.sonty.nl \
  --email admin@sonty.nl \
  --agree-tos \
  --non-interactive

# Production
certbot --nginx \
  -d automation.sonty.nl \
  -d grafana.sonty.nl \
  --email admin@sonty.nl \
  --agree-tos \
  --non-interactive
```

Auto-renewal via Certbot's systemd timer (installed automatically). Verify with:
```bash
certbot renew --dry-run
```

Nginx TLS settings enforce:
- TLSv1.2 and TLSv1.3 only
- Strong cipher suites (ECDHE-based)
- HSTS headers (max-age 63072000 = 2 years)
- OCSP stapling (production)

---

## IP Allowlisting

The following endpoints are restricted to known IPs via Nginx:

| Endpoint | Default Access | Notes |
|---|---|---|
| n8n UI (`/`) | IP allowlist only | Staff + admin |
| Grafana | IP allowlist only | Owner + admin |
| Webhooks (`/webhook/`) | Public | Rate-limited |

Replace `1.2.3.4` in Nginx configs with the actual office/VPN IP before provisioning.

For remote access without a fixed IP, use an SSH tunnel:
```bash
ssh -L 5678:localhost:5678 sonty@staging.automation.sonty.nl
# Then open http://localhost:5678 in browser
```

---

## n8n Security Settings

| Setting | Value |
|---|---|
| Basic auth | Enabled |
| User management | Enabled (per-user accounts) |
| Encryption key | 32+ char random key, stored in `.env` |
| Execution history | Pruned after 14 days (production) |
| External credential access | n8n encrypted credential store only |

n8n credentials are encrypted at rest using `N8N_ENCRYPTION_KEY`. If this key is lost, credentials cannot be recovered — store it securely.

---

## Secrets Management

**Rule: No secrets in the repository.**

| Secret type | Storage |
|---|---|
| API keys and tokens | n8n credential store (encrypted) |
| Database passwords | `/opt/sonty/config/.env.[env]` (chmod 600) |
| Redis password | `.env` file |
| n8n encryption key | `.env` file + secure offline backup |
| SSH private keys | Local developer machine only |

`.gitignore` entries that must be present:
```
configs/.env*
configs/secrets/
!configs/example.env
*.env
.env.*
```

---

## Webhook Security

All inbound webhooks from external systems should be validated using HMAC signatures where the platform supports it:

| Platform | HMAC Header | Key variable |
|---|---|---|
| Meta (WhatsApp / Ads) | `X-Hub-Signature-256` | `META_APP_SECRET` |
| HubSpot | `X-HubSpot-Signature-v3` | HubSpot app secret |
| Custom webhooks | `X-Sonty-Signature` | Internal secret |

Validation logic is implemented in n8n Function nodes at the start of each webhook-triggered workflow. Invalid signatures result in immediate rejection (HTTP 401) with no processing.

---

## Security Checklist (Pre-Production)

- [ ] Hetzner Cloud Firewall configured and attached
- [ ] UFW enabled with correct rules
- [ ] SSH: password auth disabled, root login disabled
- [ ] fail2ban active
- [ ] SSL certificates issued and auto-renewal verified
- [ ] IP allowlist set to correct office/VPN IPs in Nginx configs
- [ ] All passwords are strong and unique per environment
- [ ] `N8N_ENCRYPTION_KEY` stored in secure password manager
- [ ] `.env` files have `chmod 600`
- [ ] No secrets in git history
- [ ] Webhook HMAC validation implemented for all webhook triggers
- [ ] Backup encryption key (`age`) stored securely offline
- [ ] Hetzner automated snapshots enabled on both servers
- [ ] Alert email configured and tested
