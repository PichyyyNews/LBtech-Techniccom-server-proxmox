# ข้อมูลการเข้าใช้งานและรหัสผ่านเซิร์ฟเวอร์ (Server Credentials & Passwords) 🔐

เอกสารฉบับนี้รวบรวมข้อมูลบัญชีผู้ใช้งาน IP Address และรหัสผ่านทั้งหมดของเซิร์ฟเวอร์หลัก (Proxmox VE Host), LXC Containers, และ Virtual Machines (VMs) ที่ใช้งานในระบบ

> [!WARNING]  
> กรุณาเก็บรักษาไฟล์นี้ไว้เป็นความลับ และหลีกเลี่ยงการเปิดเผยรหัสผ่านเหล่านี้ในพื้นที่สาธารณะ

---

## 1. เซิร์ฟเวอร์หลัก (Proxmox VE Host)

เครื่องแม่ข่ายหลักที่ควบคุมระบบทั้งหมด (ตั้งค่าเน็ตเวิร์กแลนหลักเป็น **DHCP** เพื่อรองรับการย้ายเราเตอร์และสถานที่ติดตั้ง)

| รายการ | ข้อมูลการเข้าใช้งาน |
| :--- | :--- |
| **IP (Local - ในบ้าน)** | ได้รับผ่าน DHCP (หากเราเตอร์เปลี่ยน วง IP จะเปลี่ยนอัตโนมัติเพื่อป้องกันระบบพัง) |
| **URL (Tailscale - VPN)** | [https://100.125.250.85:8006](https://100.125.250.85:8006) *(แนะนำ - เป็น Static IP VPN เสมอ)* |
| **URL (External - โดเมนสาธารณะ)** | [https://techniccom-pve.pichyy.qzz.io](https://techniccom-pve.pichyy.qzz.io) *(ใช้งานได้จากอินเทอร์เน็ตภายนอก)* |
| **User name** | `tc-admin` / `root` |
| **Password** | `07072569` |
| **Realm** | `Linux PAM standard authentication` *(ต้องเลือกข้อนี้ตอนล็อกอินผ่านเว็บ)* |
| **SSH Command** | `ssh tc-admin@100.125.250.85` (แนะนำ) |

---

## 2. LXC Containers

เชื่อมต่อเข้ากับสองวงแลนหลัก:
1. **วงแลนหลัก (vmbr0)**: รับ IP ผ่าน DHCP เพื่อออกอินเทอร์เน็ตอัตโนมัติ
2. **วงแลนจำลองภายใน (vmbr1)**: ตั้งค่า Static IP ในวง `10.10.10.x` เพื่อเชื่อมต่อกับเซิร์ฟเวอร์หลักและ Cloudflare Tunnel อย่างถาวร (ไม่มีวันพังตามเราเตอร์)

### CT 100 — Web Server (`web-server`)
คอนเทนเนอร์สำหรับรันบริการเว็บหลักและแอปพลิเคชัน

| รายการ | ข้อมูลการเข้าใช้งาน |
| :--- | :--- |
| **IP Address (Local LAN)** | รับผ่าน DHCP (จากเราเตอร์ในบ้าน) |
| **IP Address (Internal Static)** | `10.10.10.100` *(ใช้เชื่อมต่อ Cloudflare Tunnel)* |
| **URL (External - โดเมนสาธารณะ)** | [http://aas.pichyy.qzz.io](http://aas.pichyy.qzz.io) |
| **SSH User** | `root` |
| **Password** | `07072569` |
| **SSH Command** | `ssh root@10.10.10.100` *(ยิงตรงผ่าน Proxmox Host)* |

### CT 102 — Database Server (`database-server`)
คอนเทนเนอร์สำหรับสำรองข้อมูลและจัดการฐานข้อมูลแยกส่วน

| รายการ | ข้อมูลการเข้าใช้งาน |
| :--- | :--- |
| **IP Address (Local LAN)** | รับผ่าน DHCP (จากเราเตอร์ในบ้าน) |
| **IP Address (Internal Static)** | `10.10.10.102` *(ใช้สื่อสารภายในระบบ)* |
| **SSH User** | `root` |
| **Password** | `07072569` |
| **SSH Command** | `ssh root@10.10.10.102` *(ยิงตรงผ่าน Proxmox Host)* |

---

## 3. Virtual Machines (VMs)

### VM 103 — CloudPanel Server (`techniccom-cp`)
ระบบจัดการเซิร์ฟเวอร์แบบ UI สำหรับโฮสต์เว็บไซต์และฐานข้อมูล MySQL

| รายการ | ข้อมูลการเข้าใช้งาน |
| :--- | :--- |
| **IP Address (Local LAN)** | รับผ่าน DHCP (จากเราเตอร์ในบ้าน) |
| **IP Address (Internal Static)** | `10.10.10.103` *(ใช้เชื่อมต่อ Cloudflare Tunnel)* |
| **URL (External - โดเมนสาธารณะ)** | [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io) |
| **CloudPanel Username** | `techniccom.admin` |
| **CloudPanel Email** | `lbtechniccom@gmail.com` |
| **CloudPanel Password** | `Techniccom.admin14072569` |
| **SSH User** | `tc-admin` / `root` |
| **SSH Password** | `07072569` |
| **SSH Command** | `ssh tc-admin@10.10.10.103` *(ยิงตรงผ่าน Proxmox Host)* |

---

### VM 101 — Windows 10 Light (`win10-light`)
ระบบปฏิบัติการ Windows 10 ขนาดเล็กสำหรับใช้งานทั่วไป

| รายการ | ข้อมูลการเข้าใช้งาน |
| :--- | :--- |
| **IP Address (Local LAN)** | รับผ่าน DHCP (ตรวจสอบผ่านแผงควบคุม Proxmox) |
| **Console/RDP User** | `Administrator` หรือ `tc-admin` |
| **Password** | `07072569` *(หรือล็อกอินอัตโนมัติ/ว่าง)* |
