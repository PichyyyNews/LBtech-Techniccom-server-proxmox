# ใบสรุปย่อ 5 ขั้นตอนจบใน 1 หน้า (Quick Cheat Sheet) ⚡📄

> ⏱️ **คู่มือฉบับย่อ 5 นาที** สำหรับนักศึกษาที่ต้องการทบทวนขั้นตอนอย่างรวดเร็ว

---

## 🔗 ข้อมูลสำคัญประจำตัว
* **CloudPanel Web Control:** [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io)
* **Username / Password:** `std<รหัสนักศึกษา>` / `Std@<รหัสนักศึกษา>`
* **โฟลเดอร์ปลายทาง:** `htdocs` ➡️ `lab.pichyy.qzz.io` ➡️ `<รหัสนักศึกษา>`
* **URL หน้าเว็บของตนเอง:** `https://lab.pichyy.qzz.io/<รหัสนักศึกษา>`

---

## 🚀 5 ขั้นตอนปฏิบัติการ (The 5-Step Pipeline)

```
[1. Export DB] ➡️ [2. Create DB CloudPanel] ➡️ [3. Upload & Extract Zip] ➡️ [4. Edit Configs] ➡️ [5. Test & Done!]
```

### 1️⃣ Export ฐานข้อมูลจากเครื่องตนเอง (Local)
* เข้า `http://localhost/phpmyadmin`
* เลือกฐานข้อมูล `ecom_store` ➡️ กดแท็บ **Export** ➡️ เลือก **Quick / SQL** ➡️ กด **Export** (ได้ไฟล์ `.sql`)

### 2️⃣ สร้าง Database และ Import บน CloudPanel
* เข้า [https://techniccom-cp.pichyy.qzz.io](https://techniccom-cp.pichyy.qzz.io)
* เมนู **Databases** ➡️ คลิก **+ Add Database**
  * Database Name: `db_<รหัสนักศึกษา>`
  * User Name: `u_<รหัสนักศึกษา>`
  * Password: `<ตั้งรหัสผ่านและจดไว้>`
* คลิกปุ่ม **Manage Database** ➡️ เข้า phpMyAdmin ➡️ เลือกชื่อ DB ➡️ คลิกแท็บ **Import** ➡️ เลือกไฟล์ `.sql` ➡️ กด **Import**

### 3️⃣ บีบอัดและอัปโหลดไฟล์เว็บ
* เข้าไปในโฟลเดอร์ `C:\xampp\htdocs\e-com` ➡️ กด **`Ctrl + A`** ➡️ คลิกขวาเลือก **Compress to ZIP** (ได้ไฟล์ `project_files.zip`)
* บน CloudPanel เข้าเมนู **Files** ➡️ ไปที่ `htdocs/lab.pichyy.qzz.io/<รหัสนักศึกษา>/`
* กดปุ่ม **Upload** ➡️ เลือกไฟล์ `project_files.zip`
* คลิกขวาที่ไฟล์ zip ➡️ เลือก **Extract** ➡️ ลบไฟล์ zip ทิ้ง

### 4️⃣ แก้ไขไฟล์ Config 2 จุด

#### จุดที่ 1: `config/database.php`
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'db_<รหัสนักศึกษา>');
define('DB_USER', 'u_<รหัสนักศึกษา>');
define('DB_PASS', '<รหัสผ่านฐานข้อมูลที่ตั้งไว้>');
```

#### จุดที่ 2: `config/app.php`
```php
define('BASE_URL', '/<รหัสนักศึกษา>');
```

### 5️⃣ ทดสอบและตรวจสอบผลงาน
* เปิดเบราว์เซอร์เข้า: `https://lab.pichyy.qzz.io/<รหัสนักศึกษา>`
* ตรวจสอบว่า CSS สีสันครบ, เพิ่มสินค้าลงตะกร้าได้, สั่งซื้อได้, และเข้าหลังบ้าน `/admin` ได้

---

## 🆘 แก้ปัญหาด่วน (Quick Fix)
* **Error 1045 / 1049 (DB Error):** ตรวจสอบ `DB_NAME`, `DB_USER`, `DB_PASS` ใน `config/database.php` ให้ตรงกับที่สร้างไว้
* **CSS ไม่โหลด / รูปแตก (404):** ตรวจสอบ `BASE_URL` ใน `config/app.php` ว่าเป็น `'/<รหัสนักศึกษา>'` หรือไม่ (ต้องมี `/` ข้างหน้า)
* **เพิ่มสินค้าแล้วรูปไม่เข้า:** ตรวจสอบว่ามีโฟลเดอร์ `uploads/products/` อยู่ในโฟลเดอร์งานหรือไม่
