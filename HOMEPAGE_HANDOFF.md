# เอกสารส่งต่องาน (Handoff Documentation) 📋
## โครงการติดตั้ง Homepage Dashboard และระบบบริหารจัดการเซิร์ฟเวอร์ Techniccom

**วันที่บันทึก:** 15 กันยายน 2026  
**สถานะปัจจุบัน:** พักการทำงานชั่วคราวตามคำสั่งผู้ดูแลระบบ (Work in Progress - 85% Complete)

---

## 📌 1. สิ่งที่ดำเนินการเสร็จสิ้นแล้ว (Completed Work)

### 1.1 สร้าง LXC Container ใหม่ (CT 105: `techniccom-hub`)
* **ID:** `105`
* **Hostname:** `techniccom-hub`
* **OS:** Debian 12 (Bookworm) Standard Template
* **สเปก:** 1 vCPU, 2048 MB RAM, 512 MB Swap, Rootfs 15 GB (บนไดรฟ์ `pve-extra`)
* **เครือข่าย:**
  * `eth0` (`vmbr0`): DHCP (`192.168.1.175/24`) สำหรับออกเน็ตและอัปเดตระบบ
  * `eth1` (`vmbr1`): Static IP `10.10.10.105/24` (วงแลนความเร็วสูงภายในเครื่อง เชื่อมต่อกับทุก Container)
* **สถานะ:** `running` (เปิด `onboot: 1`, `features: nesting=1,keyctl=1`)

### 1.2 ติดตั้ง Docker & Docker Compose
* ติดตั้ง Docker Engine v29.8.0 และ Docker Compose v5.5.1 สมบูรณ์บน CT 105
* Service `docker.service` และ `docker.socket` ทำงานปกติ (`active/running`)

### 1.3 ติดตั้งและกำหนดค่า Homepage (gethomepage.dev)
* ไดเรกทอรีทำงาน: `/opt/homepage/` ภายใน CT 105
* รันผ่าน Docker Compose บนอิมเมจ `ghcr.io/gethomepage/homepage:latest`
* พอร์ตบริการ: `3000:3000`
* **การตั้งค่า Environment:** กำหนด `HOMEPAGE_ALLOWED_HOSTS` ครอบคลุมทั้ง `homepage.pichyy.qzz.io`, `10.10.10.105:3000`, `localhost`
* **การจัดกลุ่มบริการใน `services.yaml` (แยกส่วน Admin ตามที่ระบุ):**
  1. **🌐 บริการทั่วไป (General & Web Services):**
     * `AAS Attendance`: ระบบเช็คชื่อกิจกรรมวิทยาลัย (`http://aas.pichyy.qzz.io`)
     * `TechSAR System`: ระบบรายงาน SAR (`http://techsar.pichyy.qzz.io`)
     * `Nextcloud Storage`: คลาวด์จัดเก็บไฟล์ (`https://cloud.pichyy.qzz.io`)
     * `Student Lab Hub`: เว็บส่งงานนักศึกษา ปวส. (`https://lab.pichyy.qzz.io`)
  2. **👑 แผงควบคุมระบบ (System Administration):**
     * `Proxmox VE Control`: หน้าควบคุมหลักของโฮสต์ (`https://techniccom-pve.pichyy.qzz.io`)
     * `CloudPanel Admin`: หน้าจัดการ Server & Nginx (`https://techniccom-cp.pichyy.qzz.io`)
     * `Nextcloud Admin`: ศูนย์ตั้งค่าผู้ใช้งานและโควตา (`https://cloud.pichyy.qzz.io/index.php/settings/admin`)
     * `SQLite Database Node`: คลังฐานข้อมูลหลัก CT 102 (`10.10.10.102`)
     * `Windows 10 Light`: เครื่องเสมือน Utility VM 101
  3. **🛠️ การจัดการและมอนิเตอร์ (Management & Monitoring):**
     * `Portainer Control`: จองการเชื่อมต่อไว้รองรับ Portainer (`http://homepage.pichyy.qzz.io:9000`)
     * `Netdata Monitoring`: จองการเชื่อมต่อไว้รองรับ Netdata (`http://homepage.pichyy.qzz.io:19999`)
* **สถานะการทำงานภายใน:** ทดสอบรันจากโฮสต์ `curl -I http://10.10.10.105:3000` ตอบกลับ **`HTTP/1.1 200 OK` (สมบูรณ์ 100%)**

### 1.4 จด Subdomain บน Cloudflare
* สร้าง CNAME Record บน Cloudflare Zone `pichyy.qzz.io`:
  * **Type:** `CNAME`
  * **Name:** `homepage.pichyy.qzz.io`
  * **Target:** `ae270dc3-cd44-46cb-abd6-3a409f94d423.cfargotunnel.com`
  * **Proxied:** `true` (สถานะบน Cloudflare เรียบร้อยแล้ว)

### 1.5 อัปเดต Ingress บน Proxmox Host
* ไฟล์ `/etc/cloudflared/config.yml` บน Host ได้เพิ่ม Ingress rule เรียบร้อยแล้ว:
  ```yaml
  - hostname: homepage.pichyy.qzz.io
    service: http://10.10.10.105:3000
  ```

---

## ⚠️ 2. จุดที่ค้างอยู่ และสิ่งที่ต้องทำต่อในรอบหน้า (Next Steps)

### 2.1 ตรวจสอบเส้นทาง Cloudflare Tunnel ภายนอก
* **อาการ:** เข้าผ่านภายในวงแลน `http://10.10.10.105:3000` ได้ `200 OK` แต่เมื่อยิงผ่าน `https://homepage.pichyy.qzz.io` จากภายนอก Cloudflare Edge ตอบกลับ `404 Not Found`
* **สาเหตุที่เป็นไปได้และวิธีแก้รอบหน้า:**
  1. **Cloudflare Zero Trust Remote Dashboard:** ตรวจสอบว่า Tunnel `ae270dc3-...` ถูกตั้งค่าแบบ Remote Configuration (จัดการผ่านหน้าเว็บ Cloudflare Zero Trust Dash) หรือแบบ Local Config File (`/etc/cloudflared/config.yml`)  
     * *ถ้าเป็น Remote Config*: ให้ล็อกอินเข้า Cloudflare Zero Trust Dashboard -> Networks -> Tunnels -> เลือก `techniccom-pve` -> เพิ่ม Public Hostname: `homepage.pichyy.qzz.io` -> Service: `HTTP` -> `10.10.10.105:3000`
  2. **Reload Cloudflared Process:** รันคำสั่ง `sudo systemctl restart cloudflared` บน Host อีกครั้งหลัง Cloudflare DNS แคชอัปเดตเต็มรูปแบบ

### 2.2 การติดตั้งระบบเสริม (ตามที่คุยไว้ในตอนแรก)
1. **Portainer CE:** ติดตั้งบน CT 105 (`docker run -d -p 9000:9000 ... portainer/portainer-ce`) เพื่อใช้ควบคุม Docker Containers
2. **Netdata:** ติดตั้ง Netdata Agent โดยปรับแต่งให้แคชบน RAM เพื่อถนอม IOPS ของฮาร์ดดิสก์ WD Purple

---

## 🔑 3. บัญชี พอร์ต และคำสั่งสำคัญสำหรับดูแลต่อ

| รายการ | ข้อมูล |
| :--- | :--- |
| **Container ID** | `105` (`techniccom-hub`) |
| **IP Address ภายใน (vmbr1)** | `10.10.10.105` |
| **IP Address วงบ้าน (vmbr0)** | `192.168.1.175` |
| **Root Password CT 105** | `07072569` |
| **URL ภายใน** | `http://10.10.10.105:3000` |
| **URL ภายนอก** | `https://homepage.pichyy.qzz.io` |
| **ตำแหน่งไฟล์คอนฟิก Homepage** | `/opt/homepage/config/` (ใน CT 105) |

### คำสั่งด่วนบน Proxmox Host (SSH: `tc-admin@100.125.250.85` รหัส: `07072569`)

```bash
# 1. เข้าสู่หน้า Shell ของ CT 105
sudo pct enter 105

# 2. ตรวจสอบสถานะ Homepage Container
sudo pct exec 105 -- docker ps -a

# 3. ดู Log ของ Homepage
sudo pct exec 105 -- docker logs homepage --tail=50 -f

# 4. รีสตาร์ท Homepage
sudo pct exec 105 -- bash -c "cd /opt/homepage && docker compose restart"

# 5. ทดสอบยิงเปิด Homepage จาก Host
curl -I http://10.10.10.105:3000

# 6. ตรวจสอบสถานะ Cloudflared
sudo systemctl status cloudflared
```
