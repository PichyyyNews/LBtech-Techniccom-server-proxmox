# เอกสารรายละเอียดโครงสร้างระบบเซิร์ฟเวอร์ (Server Infrastructure Documentation)

เอกสารฉบับนี้รวบรวมรายละเอียด สเปกเครื่อง การตั้งค่าเครือข่าย และบทบาทหน้าที่ของเซิร์ฟเวอร์หลัก (Proxmox VE Host) รวมถึง Containers (LXC) และ Virtual Machines (VMs) ทั้งหมดในระบบปัจจุบัน

---

## 1. เซิร์ฟเวอร์หลัก (Proxmox VE Host)
* **ชื่อโฮสต์ (Node Name):** `Techniccom`
* **โมเดลฮาร์ดแวร์ (Hardware Model):** HP ProLiant DL20 Gen9 (1U Rack Server)
* **หน่วยประมวลผล (CPU):** Intel(R) Xeon(R) CPU E3-1220 v6 @ 3.00GHz (4 Cores / 4 Threads, Turbo 3.50GHz, 8MB Cache)
* **หน่วยความจำ (RAM):** 40 GB DDR4 ECC (40,985 MB) — *ใช้งานจริงเฉลี่ย ~11.8 GB (~29%) ว่างเหลือเฟือ ~28.2 GB (~71%)*
* **ฮาร์ดดิสก์หลัก (Storage Disks):** 2x 2.0 TB Enterprise Surveillance HDD (Western Digital WD Purple — `WD22PURZ-85B4ZY0`)
  * `/dev/sda` (2TB): ติดตั้ง OS Root (`/`), `/var`, `/home`, Swap (S.M.A.R.T. Health: PASSED, อุณหภูมิ 32°C, 0 Bad Sector)
  * `/dev/sdb` (2TB): พาร์ทิชันจัดเก็บข้อมูลหลัก `/mnt/pve-extra` (VMs/LXCs Disks, ISOs, Data) (S.M.A.R.T. Health: PASSED, อุณหภูมิ 33°C, 0 Bad Sector)
* **ระบบปฏิบัติการ:** Debian 12 (Bookworm) / Proxmox VE 8.x (Kernel: `Linux 6.8.12-33-pve`)
* **ความร้อนและเสถียรภาพ:** อุณหภูมิ CPU Package ~43°C, ฮาร์ดดิสก์ ~32-33°C, Uptime เฉลี่ย 14+ วันต่อเนื่อง
* **หน้าที่หลัก:** คอยควบคุม จัดสรรทรัพยากร และทำหน้าที่เป็น Hypervisor ให้กับระบบจำลอง (Virtualization) ทั้งหมด

### การเชื่อมต่อเครือข่าย (Network Interfaces)
* **การ์ดแลนหลัก (`vmbr0`):** ตั้งค่าแบบ **DHCP** (รับ IP ปัจจุบันจากเราเตอร์บ้าน: `192.168.1.141/24`, Gateway: `192.168.1.1`)
* **วงแลนสำรองกู้ภัย:** ล็อกไอพีสำรองฉุกเฉินแบบ Static ไว้ที่ `192.168.1.250/24` (หากเกิดเหตุฉุกเฉินสามารถเสียบสายแลนจากคอมตรงเข้าเซิร์ฟเวอร์แล้วล็อกอินเข้าแก้ไขได้)
* **วงแลนจำลองภายในเครื่อง (`vmbr1`):** เป็นเครือข่ายส่วนตัว (Host-Only Virtual Network) ไอพี `10.10.10.1/24` เพื่อความเสถียรในการเชื่อมต่อระหว่างโฮสต์และแอปพลิเคชัน
* **เครือข่าย VPN (`Tailscale`):** `100.125.250.85` (ไอพีถาวรสำหรับรีโมททางไกล)
* **โดเมนควบคุมหลัก:** [https://techniccom-pve.pichyy.qzz.io](https://techniccom-pve.pichyy.qzz.io)

---

## 2. ข้อมูลรายละเอียด Containers (LXC)

### CT 100 — Web Server (`web-server`)
คอนเทนเนอร์สำหรับรันบริการเว็บไซต์และหน้าบ้านของระบบ
* **ระบบปฏิบัติการ:** Debian 12
* **ทรัพยากรที่จัดสรร:**
  * **vCPU:** 1 Core
  * **RAM:** 4 GB (4096 MB)
  * **Swap:** 512 MB
  * **พื้นที่ดิสก์ (Rootfs):** 20 GB (บนไดรฟ์ `pve-extra`)
* **การตั้งค่าเครือข่าย:**
  * **`net0` (แลนหลัก/vmbr0):** DHCP (เชื่อมต่อออกสู่สายแลนนอกบ้าน)
  * **`net1` (แลนจำลอง/vmbr1):** Static IP `10.10.10.100/24` (ใช้เชื่อมต่อกับ Cloudflare Tunnel)
* **การเชื่อมต่อโฟลเดอร์ภายนอก (Shared Bind Mount):**
  * เส้นทางบนโฮสต์: `/mnt/pve-extra/shared-attendance-data/`
  * เส้นทางภายใน CT: `/home/tc-admin/shared-db-data/`
* **บริการหลัก:** เว็บแอปพลิเคชันหน้าร้าน
* **โดเมนสาธารณะ:** [http://aas.pichyy.qzz.io](http://aas.pichyy.qzz.io)

---

### CT 102 — Database Server (`database-server`)
คอนเทนเนอร์สำหรับสำรองข้อมูลและเตรียมระบบฐานข้อมูลแยกส่วน (Separation of Concerns)
* **ระบบปฏิบัติการ:** Debian 12
* **ทรัพยากรที่จัดสรร:**
  * **vCPU:** 1 Core
  * **RAM:** 512 MB
  * **Swap:** 512 MB
  * **พื้นที่ดิสก์ (Rootfs):** 10 GB (บนไดรฟ์ `pve-extra`)
* **การตั้งค่าเครือข่าย:**
  * **`net0` (แลนหลัก/vmbr0):** DHCP (รับ IP จากเราเตอร์ในบ้านอัตโนมัติ)
  * **`net1` (แลนจำลอง/vmbr1):** Static IP `10.10.10.102/24` (สำหรับใช้รับส่งข้อมูลกับ Host/Web Server)
* **การเชื่อมต่อโฟลเดอร์ภายนอก (Shared Bind Mount):**
  * เส้นทางบนโฮสต์: `/mnt/pve-extra/shared-attendance-data/`
  * เส้นทางภายใน CT: `/mnt/database-backup/`
* **ข้อมูลและไฟล์ระบบฐานข้อมูล:**
  * ปัจจุบันรันเป็น SQLite ที่ซิงก์ข้อมูลหลักมาจาก AWS โดยไฟล์เก็บอยู่ที่ `/mnt/database-backup/database.sqlite` (พร้อมไฟล์ Log `-wal` และ `-shm`)
  * โครงสร้างนี้ถูกเตรียมไว้เพื่อรองรับการติดตั้ง PostgreSQL หรือ MySQL เพื่อย้ายฐานข้อมูลออกจากตัว Web Server ในอนาคต
* **ที่เก็บไฟล์โน้ตของระบบ:** `/home/tc-admin/SERVER_NOTES.txt`

---

## 3. ข้อมูลรายละเอียด Virtual Machines (VMs)

### VM 103 — CloudPanel Server (`techniccom-cp`)
เซิร์ฟเวอร์เสมือนสำหรับติดตั้งระบบบริหารจัดการเว็บไซต์ CloudPanel และฐานข้อมูลการบริการ
* **ระบบปฏิบัติการ:** Debian 12 (Full VM)
* **ทรัพยากรที่จัดสรร:**
  * **vCPU:** 2 Cores
  * **RAM:** 8 GB (8192 MB)
  * **พื้นที่ดิสก์ (System Disk):** 32 GB (บนไดรฟ์ `pve-extra`)
* **การตั้งค่าเครือข่าย:**
  * **`net0` (แลนหลัก/vmbr0):** DHCP (รับ IP จากเราเตอร์ในบ้านอัตโนมัติ)
  * **`net1` (แลนจำลอง/vmbr1):** Static IP `10.10.10.103/24` (ใช้รับทราฟฟิกเว็บจาก Cloudflare Tunnel เข้าหลังบ้าน)
* **บริการภายในที่ทำงานอยู่:**
  * `clp-nginx` (Nginx สำหรับควบคุม CloudPanel)
  * `clp-php-fpm` (รัน PHP ระบบหลังบ้านของแผงควบคุม)
  * `nginx` (เว็บเซิร์ฟเวอร์หลักสำหรับเว็บไซต์ต่างๆ ที่จัดเก็บบนระบบ)
  * `mysql` (ฐานข้อมูล MySQL รุ่น 8.4)
  * `ssh` (พอร์ต 22 สำหรับควบคุมทางไกล)
* **พอร์ตบริการ:**
  * พอร์ต `80`, `443` (หน้าเว็บไซต์ของผู้ใช้)
  * พอร์ต `8443` (หน้าควบคุมระบบ CloudPanel Admin)
* **โดเมนสาธารณะ:** 
  * [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io) (แผงควบคุมระบบ)
  * [https://lab.pichyy.qzz.io](https://lab.pichyy.qzz.io) (Student Project Hub)

---

### VM 101 — Windows 10 Light (`win10-light`)
คอมพิวเตอร์เสมือนระบบปฏิบัติการ Windows 10 ขนาดเบา สำหรับใช้งานโปรแกรมทั่วไป
* **ระบบปฏิบัติการ:** Windows 10 (Tiny10 x64 23H2 ISO)
* **ทรัพยากรที่จัดสรร:**
  * **vCPU:** 1 Core
  * **RAM:** 2 GB (2048 MB)
  * **พื้นที่ดิสก์ (System Disk):** 32 GB (บนไดรฟ์ `pve-extra`)
* **การตั้งค่าเครือข่าย:**
  * **`net0` (แลนหลัก/vmbr0):** DHCP (รับ IP จากเราเตอร์ในบ้านอัตโนมัติ)
* **การเข้าใช้บริการ:** ใช้งานผ่านหน้า Console ของ Proxmox GUI หรือรีโมทหน้าจอผ่าน Windows Remote Desktop (RDP)

---

## 4. ตารางสรุปไอพีและการเข้าใช้งานภายนอก (Network Map & Domains)

| VMID | ประเภท | ชื่อเครื่อง | IP วงในบ้าน (DHCP) | IP วงจำลองในเครื่อง | โดเมนภายนอก (Cloudflare Tunnel) | หน้าที่ |
| --- | --- | --- | --- | --- | --- | --- |
| **Host** | Host | `Techniccom` | `192.168.1.141` (Fallback: `192.168.1.250`) | `10.10.10.1` | `techniccom-pve.pichyy.qzz.io` | ตัวควบคุมเซิร์ฟเวอร์หลัก (Proxmox VE) |
| **100** | LXC | `web-server` | รับจากเราเตอร์ | `10.10.10.100` | `aas.pichyy.qzz.io` | หน้าบ้าน/เว็บแอปพลิเคชัน |
| **102** | LXC | `database-server` | รับจากเราเตอร์ | `10.10.10.102` | - | ตัวเก็บสำรองฐานข้อมูลหลัก |
| **103** | VM | `techniccom-cp` | รับจากเราเตอร์ (`192.168.1.114`) | `10.10.10.103` | `techniccom-cp.pichyy.qzz.io`<br/>`lab.pichyy.qzz.io` | จัดการเว็บ / CloudPanel / Student Hub |
| **101** | VM | `win10-light` | รับจากเราเตอร์ | - | - | เครื่องวินโดวส์ใช้งานทั่วไป |


