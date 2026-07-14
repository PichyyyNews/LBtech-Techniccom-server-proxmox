# CloudPanel VM 103

## Purpose

VM 103 (`techniccom-cp`) provides the supported virtual-machine runtime for CloudPanel and future hosted websites. It replaces the earlier idea of running CloudPanel in an LXC container: CloudPanel is deployed on a Debian VM so its web, PHP, database, and system services run in a supported environment.

## VM specification

| Setting | Value |
| --- | --- |
| Proxmox node | `Techniccom` |
| VM ID | `103` |
| Name | `techniccom-cp` |
| Operating system | Debian 12 |
| vCPU | 2 |
| Memory | 4 GB |
| Disk | 32 GB on `pve-extra` |
| Network bridge | `vmbr0` |
| Private IP | `192.168.1.114/24` |
| Gateway / DNS | `192.168.1.1` |
| Auto-start | Enabled |

## Installed services

CloudPanel was installed with its current MySQL 8.4 option. The following endpoints are listening inside the VM:

| Port | Purpose |
| --- | --- |
| `80` | HTTP / nginx |
| `443` | HTTPS / nginx |
| `8443` | CloudPanel administration |

The relevant services are active:

```text
clp-nginx
clp-php-fpm
nginx
mysql
ssh
```

## Public access through Cloudflare Tunnel

The existing Cloudflare Tunnel on the Proxmox host has an ingress route for the panel:

```yaml
- hostname: techniccom-cp.pichyy.qzz.io
  service: https://192.168.1.114:8443
  originRequest:
    noTLSVerify: true
```

Public URL: [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io)

The route was verified by receiving an HTTP `302` redirect to `/login` through Cloudflare. On the first visit, create the CloudPanel administrator account immediately.

## Operations

Run these commands on the Proxmox host:

```bash
# VM status and lifecycle
qm status 103
qm start 103
qm shutdown 103
qm config 103

# Open the VM serial console
qm terminal 103

# Inspect VM services via SSH from the Proxmox host
ssh tc-admin@192.168.1.114
sudo systemctl status clp-nginx clp-php-fpm nginx mysql ssh
sudo ss -ltnp | grep -E ':(80|443|8443)'
```

The Cloudflare client configuration remains on the Proxmox host at `/etc/cloudflared/config.yml`.

## Database boundary

CloudPanel requires and currently uses its own local MySQL instance inside VM 103 for panel operations. CT 102 is still a SQLite bind-mount/backup container; it does **not** yet run a MySQL or PostgreSQL server.

For website/application data to be stored on CT 102, complete this separately:

1. Increase CT 102 resources from its current minimal allocation.
2. Choose and install a database engine (recommended: MySQL 8.4 or MariaDB compatible with application requirements).
3. Restrict database access to VM 103 and required private-network clients.
4. Create per-application database users and point each hosted application to CT 102.

Do not store Cloudflare API tokens, SSH passwords, database passwords, or panel credentials in this repository. Keep them in a password manager or other secret store, and rotate any credential that was exposed in a chat or log.
