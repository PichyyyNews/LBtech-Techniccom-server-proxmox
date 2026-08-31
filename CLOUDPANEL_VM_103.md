# CloudPanel VM 103 (`techniccom-cp`) 🎛️

## 1. Purpose (วัตถุประสงค์)

VM 103 (`techniccom-cp`) provides the dedicated virtual machine environment for running **CloudPanel**, managing hosted websites, PHP-FPM runtimes, and local MySQL database services. It runs as a full Debian 12 Virtual Machine to ensure full compatibility with CloudPanel's systemd services, user management, and security isolation.

---

## 2. VM Specifications (รายละเอียดสเปก)

| Setting | Value | หมายเหตุ |
| :--- | :--- | :--- |
| **Proxmox Node** | `Techniccom` | แม่ข่ายหลัก |
| **VM ID** | `103` | รหัสเครื่องเสมือน |
| **Name** | `techniccom-cp` | ชื่อ Hostname ในระบบ |
| **Operating System** | Debian 12 (Bookworm x64) | Full VM (KVM) |
| **vCPU** | 2 Cores | จัดสรร 2 Core สำหรับงานเว็บและฐานข้อมูล |
| **Memory (RAM)** | 4 GB - 8 GB | รองรับการปรับเปลี่ยนตามปริมาณการใช้งานเว็บ |
| **Storage (Disk)** | 32 GB (บนสตอเรจ `pve-extra`) | ขยายพื้นที่ได้ผ่าน Proxmox GUI |
| **Network (net0 - vmbr0)** | DHCP (เช่น `192.168.1.114/24`) | เชื่อมต่อเราเตอร์หลักเพื่อออกสู่อินเทอร์เน็ต |
| **Network (net1 - vmbr1)** | Static IP `10.10.10.103/24` | เครือข่ายส่วนตัว Host-Only ใช้รับ Traffic จาก Cloudflare Tunnel |
| **Auto-Start** | Enabled (onboot: 1) | เริ่มทำงานอัตโนมัติเมื่อ Host เปิดเครื่อง |

---

## 3. Installed Services & Listening Ports (บริการและพอร์ตที่เปิดใช้งาน)

CloudPanel ติดตั้งพร้อมฐานข้อมูล **MySQL 8.4** โดยมีบริการหลักที่ทำงานอยู่ภายในดังนี้:

| Port | Service Name | รายละเอียด |
| :--- | :--- | :--- |
| **80** | `nginx` | HTTP Web Server |
| **443** | `nginx` | HTTPS Web Server |
| **8443** | `clp-nginx` | CloudPanel Administration Web GUI |
| **22** | `ssh` | Remote Shell Administration |
| **3306** | `mysql` | MySQL 8.4 Database Server (Local) |

**ตรวจสอบสถานะเซอร์วิสภายใน VM:**
```bash
sudo systemctl status clp-nginx clp-php-fpm nginx mysql ssh
```

---

## 4. Cloudflare Tunnel Ingress Configuration (การตั้งค่าทางเข้า)

Proxmox Host มีการกำหนด Ingress Route ใน `/etc/cloudflared/config.yml` ดังนี้:

```yaml
- hostname: techniccom-cp.pichyy.qzz.io
  service: https://10.10.10.103:8443
  originRequest:
    noTLSVerify: true

- hostname: lab.pichyy.qzz.io
  service: https://10.10.10.103:443
  originRequest:
    httpHostHeader: lab.pichyy.qzz.io
    originServerName: lab.pichyy.qzz.io
    noTLSVerify: true
```

* **Public Web Admin URL:** [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io)
* **Student Project Hub URL:** [https://lab.pichyy.qzz.io](https://lab.pichyy.qzz.io)
* **CloudPanel Initial Admin User:** `techniccom.admin`
* **Email:** `lbtechniccom@gmail.com`

---

## 5. เว็บไซต์และระบบการเรียนการสอน (Student Project Lab) 🎓

* **Domain ประจำวิชา:** `lab.pichyy.qzz.io`
* **รายวิชา:** (31909-0003) การสร้างเว็บไซต์และระบบฐานข้อมูล
* **ผู้สอน:** อาจารย์พิชญุตย์ สมบุญ
* **Document Root:** `/home/lab-pichyy/htdocs/lab.pichyy.qzz.io/`
* **Site User:** `lab-pichyy`
* **จำนวนนักศึกษา:** 19 คน (รหัส `69319090021` - `69319090039`)
* **โครงสร้างพื้นที่:**
  * หน้าหลัก (Hub): `https://lab.pichyy.qzz.io/` (ไฟล์ `index.php` ศูนย์รวมผลงาน พร้อมระบบค้นหาแบบ Real-time)
  * หน้านักศึกษาแต่ละคน: `https://lab.pichyy.qzz.io/<รหัสนักศึกษา>` (เช่น `/69319090021`)
* **บัญชีผู้ใช้ CloudPanel ของนักเรียน:**
  * Role: `User`
  * Username: `std<รหัสนักศึกษา>` (เช่น `std69319090021`)
  * Password: `Std@<รหัสนักศึกษา>` (เช่น `Std@69319090021`)
  * Email: `std<รหัสนักศึกษา>@lab.local`


---

## 6. Operations & Maintenance (คำสั่งควบคุมและบำรุงรักษา)

รันคำสั่งเหล่านี้บน **Proxmox Host**:

```bash
# ตรวจสอบสถานะ VM 103
qm status 103

# เปิด / ปิด / บังคับปิด VM
qm start 103
qm shutdown 103
qm stop 103

# ดูการตั้งค่าฮาร์ดแวร์และเน็ตเวิร์ก
qm config 103

# เปิด Serial Terminal Console
qm terminal 103

# SSH เข้า VM จาก Proxmox Host
ssh tc-admin@10.10.10.103
# หรือ
ssh tc-admin@192.168.1.114
```

**คำสั่งตรวจสอบสถานะเซอร์วิสและพอร์ตภายใน VM 103:**
```bash
sudo systemctl status clp-nginx clp-php-fpm nginx mysql ssh
sudo ss -ltnp | grep -E ':(80|443|8443|3306)'
```

---

## 7. Database Architecture & Future Scalability (การจัดการฐานข้อมูล)


* **ปัจจุบัน:** CloudPanel ใช้งาน MySQL 8.4 ภายในตัว VM 103 เองสำหรับจัดการเว็บและฐานข้อมูลของแต่ละเว็บไซต์
* **CT 102 (`database-server`):** ปัจจุบันทำหน้าที่เก็บสำรองข้อมูลและจัดการไฟล์ SQLite ของระบบอื่น (ยังไม่ได้รันบริการ MySQL Server สำหรับ VM 103)
* **แนวทางการแยกฐานข้อมูลในอนาคต (ถ้าต้องการ):**
  1. เพิ่มทรัพยากร (RAM / Storage) ให้กับ CT 102
  2. ติดตั้ง MySQL 8.4 หรือ MariaDB บน CT 102
  3. ผูกการเชื่อมต่อผ่านวง Private Bridge `vmbr1` (`10.10.10.102` ↔ `10.10.10.103`) เพื่อความปลอดภัยและความเร็วสูงสุด
