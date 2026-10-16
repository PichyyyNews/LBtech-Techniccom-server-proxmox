# ระบบควบคุมและแสดงผลฮาร์ดแวร์เซิร์ฟเวอร์ (Hardware & Fan Monitor Dashboard)

ระบบเว็บแดชบอร์ดสำหรับแสดงผลเซนเซอร์ฮาร์ดแวร์และควบคุมรอบพัดลมของเครื่อง **HP ProLiant DL20 Gen9** (Proxmox VE 8 / Debian 12 Bookworm) แบบเรียลไทม์ผ่าน Server-Sent Events (SSE) พร้อมระบบปรับโหมด Auto / Manual

- **URL สาธารณะ (Cloudflare Tunnel):** [https://hardware.pichyy.qzz.io](https://hardware.pichyy.qzz.io) *(สำรอง: [https://fan.pichyy.qzz.io](https://fan.pichyy.qzz.io))*
- **พอร์ตบริการภายในบนโฮสต์:** `http://10.10.10.1:8088`
- **ระบบหลังบ้าน:** Python 3 (Pure HTTP Server + SSE, Zero Third-party Python Dependencies)
- **การออกแบบ UI:** Cyberpunk / Dark Theme พร้อมรองรับ **Mobile Responsive 100%** และ Touch-friendly Control

---

## 🌟 ฟังก์ชันการทำงานหลัก (Key Features)

1. **สตรีมข้อมูลเซนเซอร์แบบเรียลไทม์ (Live SSE Streaming @ 1Hz):**
   - **อุณหภูมิ CPU Package & Cores:** อ่านค่าจาก `coretemp` (`/sys/class/hwmon`)
   - **อุณหภูมิฮาร์ดดิสก์ (SDA / SDB):** ดึงผ่าน `smartctl` (WD Purple Surveillance 2TB)
   - **อุณหภูมิแวดล้อมและเมนบอร์ด:** ดึงผ่าน `ipmitool sdr` (Inlet Ambient, Exhaust, Chipset, Memory VR)
   - **รอบพัดลม (Fans 1, 2, 3):** ดึงค่า % PWM ปัจจุบันจาก iLO 4
   - **โหลดระบบและแรม:** Load Average (1m, 5m, 15m) และการใช้งาน Memory
   - **ประวัติย้อนหลัง (Telemetry History Graph):** วาดกราฟเส้นบน HTML5 Canvas แบบ Real-time

2. **โหมดการควบคุมพัดลมและพลังงาน (Thermal & Fan Control Modes):**
   - **Auto Mode (Dynamic Curve):** ปรับความเร็วตามอุณหภูมิ CPU และ HDD อัตโนมัติ พร้อมสลับ CPU Governor (`powersave` / `performance`) ตามโหลด
   - **Manual Presets:**
     - 🍃 **Quiet (เงียบสุด):** Target 15% (CPU Governor: `powersave`)
     - ⚖️ **Balanced (สมดุล):** Target 25%
     - 🚀 **Performance (ประสิทธิภาพ):** Target 45% (CPU Governor: `performance`)
     - 🔥 **Turbo (สูงสุด):** Target 80%
   - **Manual Custom Slider:** สไลด์เปอร์เซ็นต์รอบพัดลมที่ต้องการได้ตั้งแต่ 10% ถึง 100%

---

## 🛠️ โครงสร้างไฟล์ในระบบ

```
/opt/hardware-monitor/
├── app.py                     # สคริปต์หลักเว็บเซิร์ฟเวอร์ + SSE + Controller
└── /etc/systemd/system/
    └── hardware-monitor.service  # Systemd daemon บน Proxmox Host
```

### การตั้งค่า Systemd Service (Proxmox Host)

```ini
[Unit]
Description=Hardware & Fan Telemetry Service (HP ProLiant DL20 Gen9)
After=network.target amsd.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hardware-monitor
ExecStart=/usr/bin/python3 /opt/hardware-monitor/app.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### การตั้งค่า Network Ingress Route (Cloudflare Tunnel)

Cloudflare Zero Trust Tunnel (`techniccom-pve`) ทำการ Route ทราฟฟิกโดเมนสาธารณะเข้ามายังพอร์ต 8088 บน Host โดยตรง ไม่ต้องผ่าน Bridge:

```yaml
- hostname: hardware.pichyy.qzz.io
  service: http://10.10.10.1:8088
- hostname: fan.pichyy.qzz.io
  service: http://10.10.10.1:8088
```

---

## 📡 REST API & SSE Endpoints

| Endpoint | Method | รายละเอียด |
| :--- | :---: | :--- |
| `/` | `GET` | หน้าเว็บแดชบอร์ด Cyberpunk/Dark theme พร้อมแอนิเมชันใบพัดหมุนตามรอบจริง |
| `/api/status` | `GET` | ข้อมูลเซนเซอร์ทั้งหมดในรูปแบบ JSON ล่าสุด |
| `/api/stream` | `GET` | Server-Sent Events (SSE) สตรีมข้อมูล JSON ทุกๆ 1 วินาที |
| `/api/control` | `POST` | สั่งเปลี่ยนโหมด/พรีเซ็ต Payload JSON: `{"mode": "auto"|"manual", "preset": "quiet"|"balanced"|"performance"|"turbo", "target_fan": 25}` |

---

## 🔧 คำสั่งจัดการ Service (CLI)

```bash
# ตรวจสอบสถานะการทำงาน
systemctl status hardware-monitor

# ดู Log เรียลไทม์
journalctl -u hardware-monitor -f

# รีสตาร์ทบริการ
systemctl restart hardware-monitor
```
