# ข้อมูลการเข้าใช้งานและรหัสผ่านเซิร์ฟเวอร์ (Server Credentials & Passwords) 🔐

เอกสารฉบับนี้รวบรวมข้อมูลบัญชีผู้ใช้งาน IP Address และรหัสผ่านทั้งหมดของเซิร์ฟเวอร์หลัก (Proxmox VE Host), LXC Containers, และ Virtual Machines (VMs) ที่ใช้งานในระบบ

> [!WARNING]  
> กรุณาเก็บรักษาไฟล์นี้ไว้เป็นความลับ และหลีกเลี่ยงการเปิดเผยรหัสผ่านเหล่านี้ในพื้นที่สาธารณะ

---

## 1. เซิร์ฟเวอร์หลัก (Proxmox VE Host)

เครื่องแม่ข่ายหลักที่ควบคุมระบบทั้งหมด (ตั้งค่าเน็ตเวิร์กแลนหลักเป็น **DHCP** เพื่อรองรับการย้ายเราเตอร์และสถานที่ติดตั้ง)

| รายการ | ข้อมูลการเข้าใช้งาน |
| :--- | :--- |
| **IP (Local - ในบ้าน)** | `192.168.1.141` (ได้รับผ่าน DHCP) / Fallback Static: `192.168.1.250` |
| **URL (Tailscale - VPN)** | [https://100.125.250.85:8006](https://100.125.250.85:8006) *(แนะนำ - เป็น Static IP VPN เสมอ)* |
| **URL (External - โดเมนสาธารณะ)** | [https://techniccom-pve.pichyy.qzz.io](https://techniccom-pve.pichyy.qzz.io) *(ใช้งานได้จากอินเทอร์เน็ตภายนอก ไม่ต้องต่อ VPN)* |
| **User name** | `tc-admin` / `root` |
| **Password** | `07072569` |
| **Realm** | `Linux PAM standard authentication` *(ต้องเลือกข้อนี้ตอนล็อกอินผ่านเว็บ)* |
| **SSH Command** | `ssh tc-admin@100.125.250.85` (Tailscale) หรือ `ssh tc-admin@192.168.1.141` (Local) |


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

---

## 4. บริการภายนอก (External Cloud Services)

### Cloudflare
* **Account Email:** `Newskung43@gmail.com`
* **Global API Key:** `cfk_59y4RSdqWrRjvoPku0vLqkkXZNPO9j2oGpqQSHle2161d7f8`
* **Account ID:** `5162d00fd728881de42502416a88419e`
* **Zone ID (`pichyy.qzz.io`):** `cdba5bb60aa2588a2f8eb24219abc360`
* **Tunnel ID (`techniccom-pve`):** `ae270dc3-cd44-46cb-abd6-3a409f94d423`
* **Domain หลัก:** `pichyy.qzz.io`
* **Domain สำหรับทดลอง/การเรียนการสอน:** `https://lab.pichyy.qzz.io` (ชี้ไปที่ VM 103 `10.10.10.103:443`)
  * **Site User:** `lab-pichyy`
  * **Site Password:** `hwpg4iQ12DNDxgpOsRPp`
  * **Document Root:** `/home/lab-pichyy/htdocs/lab.pichyy.qzz.io/`

---

## 5. บัญชีผู้ใช้งานนักศึกษา CloudPanel (Student Accounts) 🎓

* **URL แผงควบคุม CloudPanel:** [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io)
* **สิทธิ์ในระบบ:** `User` (เข้าถึงเฉพาะไซต์ `lab.pichyy.qzz.io`)

| รหัสนักศึกษา | ชื่อ - นามสกุล | CloudPanel Username | CloudPanel Password | โฟลเดอร์งาน |
| :---: | :--- | :---: | :---: | :--- |
| `69319090021` | นางสาวกาญจน์เกล้า แซ่ลิ้ม | `std69319090021` | `Std@69319090021` | `/69319090021/` |
| `69319090022` | นางสาวฐิติพร เจริญสลุง | `std69319090022` | `Std@69319090022` | `/69319090022/` |
| `69319090023` | นายทักษดนย์ ชูชื่น | `std69319090023` | `Std@69319090023` | `/69319090023/` |
| `69319090024` | นายทินภัทร มะนาวหวาน | `std69319090024` | `Std@69319090024` | `/69319090024/` |
| `69319090025` | นางสาวธันย์ชนก ทับทิมทอง | `std69319090025` | `Std@69319090025` | `/69319090025/` |
| `69319090026` | นายธีรพันธ์ เต็งน้อย | `std69319090026` | `Std@69319090026` | `/69319090026/` |
| `69319090027` | นายนครินทร์ แก้วโสตย | `std69319090027` | `Std@69319090027` | `/69319090027/` |
| `69319090028` | นายปัญญพัฒน์ บุญเกตุ | `std69319090028` | `Std@69319090028` | `/69319090028/` |
| `69319090029` | นางสาวปิยธิดา บุตรนิน | `std69319090029` | `Std@69319090029` | `/69319090029/` |
| `69319090030` | นายพิทวัส วงค์ตาเขียว | `std69319090030` | `Std@69319090030` | `/69319090030/` |
| `69319090031` | นายพีรพัฒน์ พาหุรัตน์ | `std69319090031` | `Std@69319090031` | `/69319090031/` |
| `69319090032` | นายภาณุวัฒน์ ปั่นสันเที่ยะ | `std69319090032` | `Std@69319090032` | `/69319090032/` |
| `69319090033` | นายภานุวัฒน์ ยิ้มพ่วง | `std69319090033` | `Std@69319090033` | `/69319090033/` |
| `69319090034` | นายรชต เปลี่ยนศรี | `std69319090034` | `Std@69319090034` | `/69319090034/` |
| `69319090035` | นายศิรศักดิ์ ม่วงงาม | `std69319090035` | `Std@69319090035` | `/69319090035/` |
| `69319090036` | นายศิวา พุทธโชติ | `std69319090036` | `Std@69319090036` | `/69319090036/` |
| `69319090037` | นายศุภกร แสงจันทร์ | `std69319090037` | `Std@69319090037` | `/69319090037/` |
| `69319090038` | นางสาวโสธิตา มีผล | `std69319090038` | `Std@69319090038` | `/69319090038/` |
| `69319090039` | นายอนาวินทร์ แก้วเก้า | `std69319090039` | `Std@69319090039` | `/69319090039/` |




