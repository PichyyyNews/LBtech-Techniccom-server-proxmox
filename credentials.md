# ข้อมูลการเข้าใช้งานและรหัสผ่านเซิร์ฟเวอร์ (Server Credentials & Passwords)

เอกสารฉบับนี้รวบรวมข้อมูลบัญชีผู้ใช้งาน IP Address และรหัสผ่านทั้งหมดของเซิร์ฟเวอร์หลัก (Proxmox VE Host), LXC Containers, และ Virtual Machines (VMs) ที่ใช้งานในระบบ

> [!WARNING]  
> กรุณาเก็บรักษาไฟล์นี้ไว้เป็นความลับ และหลีกเลี่ยงการเปิดเผยรหัสผ่านเหล่านี้ในพื้นที่สาธารณะ

---

## 1. เซิร์ฟเวอร์หลัก (Proxmox VE Host)

เครื่องแม่ข่ายหลักที่ควบคุมระบบทั้งหมด

| รายการ | ข้อมูลการเข้าใช้งาน |
| --- | --- |
| **URL (Local - ในบ้าน)** | [https://192.168.1.250:8006](https://192.168.1.250:8006) |
| **URL (Tailscale - VPN)** | [https://100.125.250.85:8006](https://100.125.250.85:8006) |
| **URL (External - โดเมนสาธารณะ)** | [https://techniccom-pve.pichyy.qzz.io](https://techniccom-pve.pichyy.qzz.io) |
| **User name** | `tc-admin` / `root` |
| **Password** | `07072569` |
| **Realm** | `Linux PAM standard authentication` *(ต้องเลือกข้อนี้ตอนล็อกอินผ่านเว็บ)* |
| **SSH Command** | `ssh tc-admin@192.168.1.250` หรือ `ssh tc-admin@100.125.250.85` |

---

## 2. LXC Containers

### CT 100 — Web Server (`web-server`)
คอนเทนเนอร์สำหรับรันบริการเว็บหลักและแอปพลิเคชัน

| รายการ | ข้อมูลการเข้าใช้งาน |
| --- | --- |
| **IP Address** | `192.168.1.113` |
| **SSH User** | `root` |
| **Password** | `07072569` |
| **SSH Command** | `ssh root@192.168.1.113` |

### CT 102 — Database Server (`database-server`)
คอนเทนเนอร์สำหรับสำรองข้อมูลและจัดการฐานข้อมูลแยกส่วน

| รายการ | ข้อมูลการเข้าใช้งาน |
| --- | --- |
| **IP Address** | `192.168.1.69` (รับผ่าน DHCP) |
| **SSH User** | `root` |
| **Password** | `07072569` |
| **SSH Command** | `ssh root@192.168.1.69` |

---

## 3. Virtual Machines (VMs)

### VM 103 — CloudPanel Server (`techniccom-cp`)
ระบบจัดการเซิร์ฟเวอร์แบบ UI สำหรับโฮสต์เว็บไซต์และฐานข้อมูล MySQL

| รายการ | ข้อมูลการเข้าใช้งาน |
| --- | --- |
| **IP Address** | `192.168.1.114` |
| **URL (Local - ในบ้าน)** | [https://192.168.1.114:8443](https://192.168.1.114:8443) |
| **URL (External - โดเมนสาธารณะ)** | [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io) |
| **CloudPanel Username** | `techniccom.admin` |
| **CloudPanel Email** | `lbtechniccom@gmail.com` |
| **CloudPanel Password** | `Techniccom.admin14072569` |
| **SSH User** | `tc-admin` / `root` |
| **SSH Password** | `07072569` |
| **SSH Command** | `ssh tc-admin@192.168.1.114` |

---

### VM 101 — Windows 10 Light (`win10-light`)
ระบบปฏิบัติการ Windows 10 ขนาดเล็กสำหรับใช้งานทั่วไป

| รายการ | ข้อมูลการเข้าใช้งาน |
| --- | --- |
| **IP Address** | (ตรวจสอบผ่าน Proxmox GUI หรือ Network list) |
| **Console/RDP User** | `Administrator` หรือ `tc-admin` |
| **Password** | `07072569` *(หรือล็อกอินอัตโนมัติ/ว่าง)* |
