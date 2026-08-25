# คู่มือการเข้าใช้งานเซิร์ฟเวอร์จากภายนอกและภายใน (Server Access Guide) 🌐🔑

คู่มือฉบับนี้อธิบายถึงขั้นตอนการเข้าใช้งานระบบควบคุม **Proxmox VE**, **CloudPanel**, **เว็บแอปพลิเคชัน**, **SSH**, และ **Windows VM** ทั้งจากภายนอกผ่าน **Tailscale VPN** / **Cloudflare Tunnel** และจากเครือข่ายภายในบ้าน (Local LAN)

---

## 1. วิธีเข้าใช้งานผ่าน Tailscale (สำหรับรีโมทจากภายนอกบ้าน - แนะนำ)

หากต้องการเข้าควบคุมระบบจากระยะไกลอย่างปลอดภัย แนะนำให้เชื่อมต่อผ่าน **Tailscale VPN** ซึ่งเป็นเครือข่ายเสมือนที่มีการเข้ารหัสข้อมูล:

* **URL ของ Proxmox VE WebUI:** [https://100.125.250.85:8006](https://100.125.250.85:8006)
* **IP ของเครื่องเซิร์ฟเวอร์หลัก (Proxmox Host):** `100.125.250.85`
* **ข้อมูลเข้าล็อกอิน Proxmox:**
  * **User name:** `tc-admin`
  * **Password:** `07072569`
  * **Realm:** `Linux PAM standard authentication` *(ต้องเลือกข้อนี้ในช่องดร็อปดาวน์ เพื่อใช้บัญชีของระบบปฏิบัติการ)*

> [!IMPORTANT]  
> การเข้าใช้งานผ่าน Tailscale **จำเป็น** ต้องเปิดโปรแกรม Tailscale บนอุปกรณ์ของคุณ และลงชื่อเข้าใช้ด้วยบัญชีที่ได้ยอมรับลิงก์คำเชิญเครือข่ายนี้แล้วเท่านั้น

---

## 2. ลิงก์คำเชิญเข้าร่วมเครือข่าย Tailscale (Invite Links)

สำหรับสมาชิกหรือผู้ดูแลระบบท่านอื่นที่ต้องการสิทธิ์ในการเชื่อมต่อเข้ามายัง Proxmox และเครื่องเสมือนจากระยะไกล สามารถคลิกยอมรับคำเชิญเพื่อแชร์การเชื่อมต่อผ่านลิงก์ด้านล่าง:

* 🔗 **ลิงก์คำเชิญชุดที่ 1:** [https://login.tailscale.com/admin/invite/A1ohNaCjS8jXjJjgqYzj11](https://login.tailscale.com/admin/invite/A1ohNaCjS8jXjJjgqYzj11)
* 🔗 **ลิงก์คำเชิญชุดที่ 2:** [https://login.tailscale.com/admin/invite/CCwRd122M9LXjJjgqYzj11](https://login.tailscale.com/admin/invite/CCwRd122M9LXjJjgqYzj11)

> [!NOTE]  
> * ลิงก์คำเชิญแต่ละลิงก์สามารถกดยอมรับเพื่อเข้าร่วมเครือข่ายได้ 1 บัญชี Tailscale เท่านั้น
> * หลังจากลงทะเบียนแล้ว อุปกรณ์เหล่านั้นจะสามารถเชื่อมต่อกับ IP ของเครื่องในเครือข่าย VPN ได้ทันที

---

## 3. ขั้นตอนสำหรับผู้ใช้ใหม่ในการเข้าร่วมและใช้งาน Tailscale

1. **ติดตั้ง Tailscale:** ดาวน์โหลดและติดตั้งแอปพลิเคชัน Tailscale ลงบนอุปกรณ์ที่ต้องการใช้งาน (รองรับทั้ง Windows, macOS, Linux, iOS และ Android) [ดาวน์โหลดที่นี่](https://tailscale.com/download)
2. **กดยอมรับคำเชิญ (Accept Invite):** เปิดเว็บเบราว์เซอร์แล้วนำลิงก์คำเชิญด้านบนไปเปิด ล็อกอินด้วยบัญชี Tailscale ของตนเองเพื่อยินยอมเชื่อมต่ออุปกรณ์เข้ากับวงเครือข่าย
3. **เชื่อมต่อการทำงาน:** เปิดโปรแกรม Tailscale บนอุปกรณ์ แล้วกดเชื่อมต่อ (**Connect**)
4. **เปิดใช้งานหน้าเว็บควบคุม:** ไปยังหน้าเว็บไซต์ [https://100.125.250.85:8006](https://100.125.250.85:8006) 
   * *หมายเหตุ: หากเบราว์เซอร์แจ้งเตือนความปลอดภัย (SSL Security Warning) ให้กด **Advanced** (ขั้นสูง) แล้วกด **Proceed to 100.125.250.85 (unsafe)** หรือยอมรับความเสี่ยงเพื่อเข้าสู่หน้าล็อกอิน*

---

## 4. วิธีเข้าใช้งานแบบสาธารณะผ่าน Cloudflare Tunnel (ไม่ต้องเปิด VPN)

คุณสามารถเข้าใช้งานบริการผ่านอินเทอร์เน็ตสาธารณะได้โดยตรงจากทุกที่ ทุกอุปกรณ์ (รวมถึงมือถือหรือแท็บเล็ต) โดย**ไม่จำเป็นต้องเชื่อมต่อ Tailscale**:

### 4.1 แผงควบคุม Proxmox VE
* **URL:** [https://techniccom-pve.pichyy.qzz.io](https://techniccom-pve.pichyy.qzz.io)
* **ข้อมูลล็อกอิน:**
  * **User name:** `tc-admin`
  * **Password:** `07072569`
  * **Realm:** `Linux PAM standard authentication`

### 4.2 แผงควบคุม CloudPanel (VM 103)
* **URL:** [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io)
* **ข้อมูลล็อกอิน CloudPanel:**
  * **User name:** `techniccom.admin`
  * **Email:** `lbtechniccom@gmail.com`
  * **Password:** `Techniccom.admin14072569`

### 4.3 เว็บแอปพลิเคชันหน้าร้าน (CT 100)
* **URL:** [http://aas.pichyy.qzz.io](http://aas.pichyy.qzz.io)

---

## 5. วิธีเข้าใช้งานแบบโลคอล (สำหรับกรณีอยู่ในวงแลน Wi-Fi เดียวกัน)

หากใช้งานคอมพิวเตอร์ที่เชื่อมต่อสายแลนหรือ Wi-Fi เดียวกันกับเครื่องเซิร์ฟเวอร์:

* **URL ของ Proxmox VE WebUI:** [https://192.168.1.250:8006](https://192.168.1.250:8006) *(Fallback IP ในกรณีเราเตอร์วง 192.168.1.x)*
* **เข้าผ่าน IP จาก DHCP:** ตรวจสอบ IP ที่ได้รับจากเราเตอร์ผ่านหน้าจอ Console หรือเราเตอร์

---

## 6. ช่องทางการเชื่อมต่อ SSH (สำหรับ Command Line)

### 6.1 เชื่อมต่อเข้า Proxmox Host (เครื่องแม่ข่าย)
```bash
# ผ่าน Tailscale VPN (จากภายนอก)
ssh tc-admin@100.125.250.85

# ผ่านวงแลนในบ้าน (Local LAN)
ssh tc-admin@192.168.1.250
```

### 6.2 เชื่อมต่อเข้า Guests (ยิงตรงผ่าน Proxmox Host หรือในวง Private Bridge 10.10.10.x)
```bash
# CT 100 (Web Server)
ssh root@10.10.10.100

# CT 102 (Database Server)
ssh root@10.10.10.102

# VM 103 (CloudPanel Server)
ssh tc-admin@10.10.10.103
```
*รหัสผ่าน SSH มาตรฐาน: `07072569`*

---

## 7. วิธีเข้าใช้งานเครื่อง Windows 10 Light (VM 101)

1. **ผ่าน Proxmox Web UI Console (แนะนำ):**
   * ล็อกอินเข้า Proxmox VE
   * เลือกเมนูซ้าย `Datacenter` → `Techniccom` → `101 (win10-light)`
   * คลิกแท็บ **Console** เพื่อใช้งานหน้าจอ GUI โดยตรง
2. **ผ่าน Remote Desktop (RDP):**
   * ตรวจสอบ IP Address ของ VM 101 จากหน้าต่าง Console หรือ DHCP Client บนเราเตอร์
   * เปิด Remote Desktop Connection (`mstsc`) บนเครื่อง Windows
   * ระบุ IP และเข้าใช้งานด้วย User: `tc-admin` หรือ `Administrator` (รหัสผ่าน: `07072569`)

---

## 8. การแก้ไขปัญหาเบื้องต้น (Troubleshooting & FAQs)

| ปัญหาที่พบ | สาเหตุที่เป็นไปได้ | แนวทางแก้ไข |
| --- | --- | --- |
| **เบราว์เซอร์แจ้งเตือน Certificate ไม่ปลอดภัย (SSL Warning)** | Proxmox ใช้ Self-signed SSL Certificate ภายใน | กดปุ่ม **Advanced** (ขั้นสูง) แล้วเลือก **Proceed to ... (unsafe)** เพื่อเข้าใช้งานตามปกติ |
| **ล็อกอินไม่ผ่าน แม้กรอกรหัสผ่านถูกต้อง** | ไม่ได้เลือก Realm เป็น PAM | ตรวจสอบช่อง **Realm** ในหน้า Login ให้เลือกเป็น `Linux PAM standard authentication` |
| **เข้าผ่าน Tailscale ไม่ได้** | Tailscale ยังไม่ได้เปิดใช้งาน หรือหลุดการเชื่อมต่อ | เปิดแอปพลิเคชัน Tailscale ตรวจสอบสถานะว่าแสดงเป็น **Connected** และตรวจสอบว่าบัญชีที่ใช้ได้รับการอนุมัติแล้ว |
| **เข้าผ่าน Cloudflare Domain ไม่ได้** | เซอร์วิส cloudflared บนเซิร์ฟเวอร์หยุดทำงาน | รีโมทเข้า Host แล้วรัน `systemctl restart cloudflared` เพื่อเริ่มเซอร์วิสใหม่ |
