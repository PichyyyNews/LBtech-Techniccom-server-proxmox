from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether

OUT = Path('output/pdf')
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / 'คู่มือส่งมอบและดูแลระบบเซิร์ฟเวอร์.pdf'

pdfmetrics.registerFont(TTFont('Tahoma', r'C:\Windows\Fonts\tahoma.ttf'))
pdfmetrics.registerFont(TTFont('TahomaBold', r'C:\Windows\Fonts\tahomabd.ttf'))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ThaiTitle', parent=styles['Title'], fontName='TahomaBold', fontSize=23, leading=31, alignment=TA_CENTER, textColor=colors.HexColor('#12355B'), spaceAfter=14))
styles.add(ParagraphStyle(name='ThaiSub', parent=styles['Normal'], fontName='Tahoma', fontSize=11, leading=17, alignment=TA_CENTER, textColor=colors.HexColor('#44546A')))
styles.add(ParagraphStyle(name='H1T', parent=styles['Heading1'], fontName='TahomaBold', fontSize=16, leading=23, textColor=colors.HexColor('#12355B'), spaceBefore=10, spaceAfter=8))
styles.add(ParagraphStyle(name='H2T', parent=styles['Heading2'], fontName='TahomaBold', fontSize=12, leading=18, textColor=colors.HexColor('#1F5D8F'), spaceBefore=9, spaceAfter=5))
styles.add(ParagraphStyle(name='BodyT', parent=styles['BodyText'], fontName='Tahoma', fontSize=9.3, leading=15, spaceAfter=5))
styles.add(ParagraphStyle(name='SmallT', parent=styles['BodyText'], fontName='Tahoma', fontSize=8, leading=11))
styles.add(ParagraphStyle(name='NoteT', parent=styles['BodyText'], fontName='Tahoma', fontSize=9, leading=14, backColor=colors.HexColor('#FFF3CD'), borderColor=colors.HexColor('#D6A800'), borderWidth=0.5, borderPadding=7, spaceBefore=5, spaceAfter=8))
styles.add(ParagraphStyle(name='CodeT', parent=styles['BodyText'], fontName='Courier', fontSize=7.8, leading=11, backColor=colors.HexColor('#F1F4F7'), borderColor=colors.HexColor('#D7DEE7'), borderWidth=0.3, borderPadding=6, spaceAfter=6))

def p(text, style='BodyT'):
    return Paragraph(text, styles[style])

def table(headers, rows, widths=None):
    data = [[p(x, 'SmallT') for x in headers]] + [[p(str(x), 'SmallT') for x in row] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#12355B')), ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'TahomaBold'), ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.35, colors.HexColor('#B8C5D2')), ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F5F8FB')]),
        ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6), ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    return t

def bullets(items):
    return [p('• ' + x) for x in items]

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#D7DEE7'))
    canvas.line(1.7*cm, 1.35*cm, A4[0]-1.7*cm, 1.35*cm)
    canvas.setFont('Tahoma', 7.5)
    canvas.setFillColor(colors.HexColor('#596B7A'))
    canvas.drawString(1.7*cm, 0.85*cm, 'คู่มือส่งมอบระบบเซิร์ฟเวอร์ - เอกสารภายใน')
    canvas.drawRightString(A4[0]-1.7*cm, 0.85*cm, f'หน้า {doc.page}')
    canvas.restoreState()

story = []
story += [Spacer(1, 3.3*cm), p('คู่มือส่งมอบและดูแลระบบเซิร์ฟเวอร์', 'ThaiTitle'), p('Proxmox VE / LXC / Virtual Machines / CloudPanel / Cloudflare Tunnel / Tailscale', 'ThaiSub'), Spacer(1, .8*cm)]
story += [p('วัตถุประสงค์', 'H1T'), p('เอกสารนี้รวบรวมภาพรวม วิธีเข้าระบบ วิธีใช้งานประจำวัน วิธีตรวจสอบ และแนวทางแก้ปัญหา เพื่อให้ผู้รับช่วงที่ไม่เคยดูแลระบบเดิมสามารถเริ่มทำงานได้อย่างปลอดภัย เอกสารอ้างอิงจากไฟล์ server_infrastructure.md, how_to_connect.md, CLOUDPANEL_VM_103.md และ credentials.md ณ วันที่จัดทำเอกสารนี้')]
story += [p('<b>ระดับความลับ: ภายใน / ผู้ดูแลระบบเท่านั้น</b><br/>PDF ฉบับนี้ไม่พิมพ์รหัสผ่าน, invite link, token หรือ secret จริงลงไป เพราะไฟล์ PDF มักถูกส่งต่อและควบคุมการเข้าถึงได้ยาก รายละเอียดชื่อบัญชีและช่องข้อมูลลับมีในทะเบียนข้อมูลลับแยกต่างหาก และควรย้ายไป password manager ก่อนส่งมอบ', 'NoteT')]
story += [p('เริ่มต้นแบบสั้นที่สุด', 'H2T')] + bullets([
    'ติดตั้งและเชื่อมต่อ Tailscale ด้วยบัญชีที่ผู้ดูแลอนุมัติ',
    'เปิดหน้า Proxmox ผ่าน VPN ที่ https://100.125.250.85:8006 หรือใช้โดเมนควบคุมที่กำหนดไว้',
    'เข้าสู่ระบบด้วยบัญชี Proxmox โดยเลือก Realm: Linux PAM standard authentication',
    'ตรวจสอบสถานะ Host, CT 100, CT 102, VM 103 และ VM 101 ก่อนดำเนินการใด ๆ',
    'หากต้องแก้ไขระบบ ให้สร้าง backup/snapshot และบันทึกสิ่งที่เปลี่ยนทุกครั้ง',
])
story.append(PageBreak())

story += [p('1. ภาพรวมสถาปัตยกรรม', 'H1T'), p('เครื่องจริงทำหน้าที่เป็น Proxmox VE Host ชื่อ <b>Techniccom</b> ซึ่งเป็นศูนย์กลางสร้างและควบคุมเครื่องเสมือน ภายในมี LXC 2 ตัว และ VM 2 ตัว การเข้าจากภายนอกใช้ Tailscale VPN และบางบริการเผยแพร่ผ่าน Cloudflare Tunnel')]
story += [table(['ชั้นระบบ', 'ชื่อ/ID', 'หน้าที่', 'วิธีเข้าหลัก'], [
    ['Host', 'Techniccom', 'Proxmox VE 8.x บน Debian Bookworm; ควบคุม VM/CT และ Tunnel', 'Proxmox Web UI / SSH'],
    ['LXC 100', 'web-server', 'เว็บแอปหรือหน้าเว็บไซต์', 'Proxmox Console / SSH'],
    ['LXC 102', 'database-server', 'เก็บ SQLite และพื้นที่สำรองข้อมูล; ยังไม่ใช่ DB server เต็มรูปแบบ', 'Proxmox Console / SSH'],
    ['VM 103', 'techniccom-cp', 'CloudPanel, Nginx, PHP-FPM, MySQL และ SSH', 'CloudPanel / Proxmox Console / SSH'],
    ['VM 101', 'win10-light', 'Windows 10 Light สำหรับงานทั่วไป', 'Proxmox Console หรือ RDP'],
], [2.1*cm, 2.5*cm, 7.4*cm, 4.0*cm])]
story += [p('เส้นทางการรับส่งข้อมูล', 'H2T'), p('ผู้ดูแลระยะไกล → Tailscale → Proxmox Host → Console/SSH ของ CT หรือ VM. ผู้ใช้งานเว็บสาธารณะ → Cloudflare Tunnel บน Host → บริการปลายทางภายใน เช่น Web Server หรือ CloudPanel. เครือข่ายภายใน vmbr1 ใช้เลข 10.10.10.x สำหรับการสื่อสารที่ไม่ผูกกับ IP จากเราเตอร์')]
story += [p('คำศัพท์จำเป็น', 'H2T'), table(['คำ', 'ความหมายแบบง่าย'], [
    ['Host', 'เครื่องจริงที่ติดตั้ง Proxmox และรันเครื่องเสมือนทั้งหมด'], ['VM', 'คอมพิวเตอร์เสมือนที่มีระบบปฏิบัติการเต็มรูปแบบ'], ['LXC/CT', 'คอนเทนเนอร์ Linux ที่เบากว่า VM และใช้ kernel ร่วมกับ Host'], ['Bridge', 'สะพานเครือข่ายเสมือนที่เชื่อม VM/CT กับเครือข่าย'], ['DHCP', 'รับ IP อัตโนมัติจากเราเตอร์ ซึ่งอาจเปลี่ยนได้'], ['Cloudflare Tunnel', 'ช่องทางให้โดเมนสาธารณะเข้าถึงบริการภายใน โดยไม่ต้องเปิดพอร์ตจากเราเตอร์'], ['Tailscale', 'VPN สำหรับผู้ดูแล เชื่อมเครื่องที่ได้รับอนุญาตเข้าด้วยกัน'],
], [3.5*cm, 12.5*cm])]
story.append(PageBreak())

story += [p('2. แผนผังเครือข่ายและที่ตั้งของระบบ', 'H1T')]
story += [table(['รายการ', 'LAN / DHCP', 'วงภายใน', 'ช่องทางภายนอก', 'หมายเหตุ'], [
    ['Host Techniccom', 'DHCP; fallback 192.168.1.250/24', 'vmbr1: 10.10.10.1/24', 'Tailscale 100.125.250.85; techniccom-pve.pichyy.qzz.io', 'จุดควบคุมทั้งหมด'],
    ['CT 100 web-server', 'DHCP (มีข้อมูลเดิม: 192.168.1.113)', '10.10.10.100/24', 'aas.pichyy.qzz.io', 'มี shared bind mount'],
    ['CT 102 database-server', 'DHCP', '10.10.10.102/24', 'ไม่มีโดเมนสาธารณะ', 'เก็บ SQLite/backups'],
    ['VM 103 techniccom-cp', 'ข้อมูลล่าสุดระบุ 192.168.1.114/24', 'เอกสารหนึ่งระบุ 10.10.10.103/24', 'techniccom-cp.pichyy.qzz.io', 'ต้องตรวจสอบ config จริงก่อนแก้ไข'],
    ['VM 101 win10-light', 'DHCP', '-', '-', 'ใช้ Console/RDP'],
], [3.5*cm, 3.6*cm, 2.8*cm, 4.1*cm, 3.0*cm])]
story += [p('การเข้าถึง Proxmox', 'H2T')] + bullets([
    'จากภายนอก (แนะนำ): เปิด Tailscale ก่อน แล้วเข้าที่ https://100.125.250.85:8006',
    'จาก LAN เดียวกัน: ใช้ https://192.168.1.250:8006 หาก fallback IP นี้ยังตั้งใช้งานอยู่',
    'ผ่านโดเมนสาธารณะ: ใช้ techniccom-pve.pichyy.qzz.io เฉพาะเมื่อผู้ดูแลอนุญาตและตรวจสอบ Cloudflare Access/การป้องกันเพิ่มเติมแล้ว',
    'หน้าแรกอาจแจ้งเตือน certificate ของระบบภายใน ให้ตรวจสอบว่าปลายทางเป็น IP/โดเมนที่ถูกต้องก่อนยอมรับ ไม่กดยอมรับกับ URL อื่น',
])
story += [p('ข้อควรระวังด้านเครือข่าย', 'H2T'), p('IP แบบ DHCP เปลี่ยนได้เมื่อเราเตอร์หรือ DHCP lease เปลี่ยน การเชื่อมต่อที่ควรอ้างอิงระยะยาวคือชื่อเครื่อง, Tailscale หรือ static IP ใน vmbr1 เท่านั้น ห้ามเปิดพอร์ต 8006 หรือ 22 สู่ Internet โดยตรงเพื่อความสะดวกโดยไม่มี firewall และ MFA')]
story.append(PageBreak())

story += [p('3. วิธีเข้าระบบแบบจับมือทำ', 'H1T'), p('3.1 เตรียมเครื่องผู้ดูแล', 'H2T')] + bullets([
    'ติดตั้ง Tailscale จากเว็บไซต์ทางการบน Windows, macOS, Linux, iOS หรือ Android',
    'รับสิทธิ์เข้าร่วม tailnet จากผู้ดูแลผ่านวิธีที่ปลอดภัย ไม่ส่ง invite link ในกลุ่มแชตหรืออีเมลสาธารณะ',
    'Sign in ด้วยบัญชีของตนเอง แล้วเปิดสถานะ Connected; ตั้งชื่ออุปกรณ์ให้สื่อความหมาย เช่น naam-admin-laptop',
    'ทดสอบเปิด https://100.125.250.85:8006 หากเปิดไม่ได้ ให้ตรวจสอบว่า Tailscale Connected และอุปกรณ์ได้รับอนุญาตใน Admin Console',
])
story += [p('3.2 Login Proxmox', 'H2T')] + bullets([
    'เปิด URL แล้วกรอก Username จากทะเบียนข้อมูลลับ',
    'เลือก Realm เป็น Linux PAM standard authentication; ถ้าเลือก Realm ผิดแม้รหัสถูกต้องก็เข้าไม่ได้',
    'หลังเข้าระบบ ให้ดูแถบซ้าย: Datacenter → Techniccom จะเห็น CT และ VM',
    'เริ่มจากตรวจสถานะว่าเป็นสีเขียว/Running และดู CPU, RAM, Storage ก่อนสั่ง Start/Stop',
])
story += [p('3.3 เข้าเครื่องแต่ละตัวผ่าน Console', 'H2T'), p('เลือก CT หรือ VM → Console → Start Console. วิธีนี้เหมาะเมื่อ SSH ใช้ไม่ได้หรือยังไม่ทราบ IP. สำหรับ VM 101 ให้ใช้ Console เป็นช่องทางแรก หากจะใช้ RDP ต้องตรวจสอบ IP ปัจจุบันจาก DHCP/หน้า Windows ก่อน')]
story += [p('3.4 SSH สำหรับ Linux', 'H2T'), p('ใช้ Terminal/PowerShell และบัญชีจากทะเบียนข้อมูลลับ ตัวอย่างรูปแบบคำสั่ง:<br/><font name="Courier">ssh &lt;user&gt;@&lt;ip-or-hostname&gt;</font><br/>ห้ามใส่รหัสผ่านลงใน command history, ไฟล์ .bat หรือเอกสารที่ส่งผ่านทั่วไป ควรเปลี่ยนไปใช้ SSH key และปิด password login ภายหลังทดสอบเรียบร้อย')]
story.append(PageBreak())

story += [p('4. รายละเอียดและการใช้งานองค์ประกอบ', 'H1T'), p('4.1 Proxmox Host: Techniccom', 'H2T')]
story += [table(['หัวข้อ', 'ค่า/บทบาท'], [
    ['ระบบปฏิบัติการ', 'Debian Bookworm / Proxmox VE 8.x'], ['หน้าที่', 'Hypervisor จัดสรร CPU, RAM, Disk, Network และควบคุม CT/VM'], ['เครือข่าย', 'vmbr0 DHCP, fallback 192.168.1.250/24; vmbr1 10.10.10.1/24; Tailscale 100.125.250.85'], ['Cloudflare Tunnel config', '/etc/cloudflared/config.yml บน Host'], ['คำสั่งตรวจสอบ', 'pveversion; pvesh get /nodes; qm list; pct list; df -h; ip a'],
], [4.4*cm, 11.6*cm])]
story += [p('4.2 CT 100: web-server', 'H2T')]
story += [table(['หัวข้อ', 'ค่า/บทบาท'], [
    ['ระบบ/ทรัพยากร', 'Debian 12, 1 vCPU, RAM 4 GB, Swap 512 MB, Rootfs 20 GB บน pve-extra'], ['เครือข่าย', 'net0 vmbr0 DHCP; net1 vmbr1 10.10.10.100/24'], ['บริการ', 'เว็บแอป/เว็บไซต์; โดเมน aas.pichyy.qzz.io'], ['ข้อมูลร่วม', 'Host: /mnt/pve-extra/shared-attendance-data/ → CT: /home/tc-admin/shared-db-data/'], ['ตรวจสอบ', 'systemctl --type=service --state=running; df -h; mount | grep shared'],
], [4.4*cm, 11.6*cm])]
story += [p('4.3 CT 102: database-server', 'H2T')]
story += [table(['หัวข้อ', 'ค่า/บทบาท'], [
    ['ระบบ/ทรัพยากร', 'Debian 12, 1 vCPU, RAM 512 MB, Swap 512 MB, Rootfs 10 GB บน pve-extra'], ['เครือข่าย', 'net0 vmbr0 DHCP; net1 vmbr1 10.10.10.102/24'], ['ข้อมูลปัจจุบัน', 'SQLite ที่ /mnt/database-backup/database.sqlite พร้อม -wal และ -shm'], ['ข้อมูลร่วม', 'Host shared-attendance-data → CT /mnt/database-backup/'], ['ขอบเขตสำคัญ', 'ยังไม่รัน MySQL/PostgreSQL; เป็นพื้นที่ข้อมูล/สำรอง ไม่ใช่ production DB network service'], ['โน้ตเดิม', '/home/tc-admin/SERVER_NOTES.txt'],
], [4.4*cm, 11.6*cm])]
story.append(PageBreak())

story += [p('4.4 VM 103: CloudPanel Server', 'H2T')]
story += [table(['หัวข้อ', 'ค่า/บทบาท'], [
    ['ระบบ', 'Debian 12 Full VM, ID 103, ชื่อ techniccom-cp, auto-start enabled'], ['ทรัพยากร', '2 vCPU, Disk 32 GB บน pve-extra; เอกสารขัดกันเรื่อง RAM: 4 GB กับ 8 GB - ตรวจสอบจริงด้วย qm config 103'], ['IP ที่ระบุล่าสุด', '192.168.1.114/24, gateway/DNS 192.168.1.1; เอกสารอีกฉบับระบุ net1 10.10.10.103/24 - ต้องตรวจสอบ'], ['บริการ', 'clp-nginx, clp-php-fpm, nginx, mysql (MySQL 8.4), ssh'], ['พอร์ต', '80 HTTP, 443 HTTPS, 8443 CloudPanel admin'], ['URL แผงควบคุม', 'https://techniccom-cp.pichyy.qzz.io (ควรเข้าเฉพาะผู้ได้รับสิทธิ์)'], ['คำสั่งชีวิต VM', 'qm status 103; qm start 103; qm shutdown 103; qm config 103; qm terminal 103'],
], [4.4*cm, 11.6*cm])]
story += [p('วิธีดูแลเว็บไซต์ใน CloudPanel', 'H2T')] + bullets([
    'เข้าผ่าน URL ของ CloudPanel แล้วใช้บัญชีผู้ดูแลจากทะเบียนข้อมูลลับ; หากระบบเพิ่งติดตั้งและยังไม่มีผู้ดูแล ให้สร้างบัญชีแรกด้วยอีเมลขององค์กรทันที',
    'ก่อนสร้างเว็บไซต์ใหม่ ให้กำหนดเจ้าของ, โดเมน, PHP version, วิธีสำรองข้อมูล และผู้รับผิดชอบให้ครบ',
    'ตรวจสอบ service ใน VM: sudo systemctl status clp-nginx clp-php-fpm nginx mysql ssh',
    'ตรวจพอร์ต: sudo ss -ltnp | grep -E \' :(80|443|8443)\' (ปรับเว้นวรรคตาม shell หากจำเป็น)',
    'MySQL ใน VM 103 ใช้สำหรับ CloudPanel ในปัจจุบัน; CT 102 ยังไม่ได้ทำหน้าที่ DB server ของ VM นี้',
])
story += [p('4.5 VM 101: win10-light', 'H2T'), p('Windows 10 Tiny10 x64 23H2, 1 vCPU, RAM 2 GB, Disk 32 GB บน pve-extra, รับ IP ผ่าน DHCP. ใช้ Proxmox Console เป็นวิธีเข้าที่เชื่อถือได้ที่สุด; RDP ใช้ได้เมื่อทราบ IP ปัจจุบันและตรวจสอบ firewall/Remote Desktop แล้ว')]
story.append(PageBreak())

story += [p('5. งานดูแลประจำวันและการเปลี่ยนแปลง', 'H1T'), p('ก่อนทำงานทุกครั้ง', 'H2T')] + bullets([
    'ตรวจว่าไม่มี backup หรือ replication ทำงานอยู่ และดูพื้นที่ disk บน Host/Guest',
    'อ่าน log/การแจ้งเตือนล่าสุดใน Proxmox และจดเวลาที่เริ่มงาน',
    'ทำ backup หรือ snapshot ที่สามารถย้อนกลับได้ก่อน update หรือปรับ config',
    'เปลี่ยนทีละเรื่อง: ห้ามอัปเดต Host, CloudPanel, Nginx, PHP และฐานข้อมูลพร้อมกัน',
])
story += [p('ลำดับเปิด/ปิดระบบอย่างปลอดภัย', 'H2T')]
story += [table(['สถานการณ์', 'ลำดับที่แนะนำ'], [
    ['เปิดหลังไฟดับ', 'เปิด Host → รอ storage/network พร้อม → CT 102 → CT 100 → VM 103 → VM 101; ตรวจบริการหลังแต่ละเครื่อง'],
    ['ปิดเพื่อซ่อมบำรุง', 'แจ้งผู้ใช้ → สำรองข้อมูล → ปิด VM 101 → shutdown CT 100/VM 103 ตามงานเว็บ → CT 102 → Host เป็นลำดับสุดท้าย'],
    ['รีสตาร์ตบริการเว็บ', 'ตรวจ status/log → restart เฉพาะ service ที่เกี่ยวข้อง → ทดสอบ URL ทั้งภายในและภายนอก'],
], [4.2*cm, 11.8*cm])]
story += [p('คำสั่งที่ใช้บน Proxmox Host', 'H2T'), p('ตรวจสอบเท่านั้น (ปลอดภัยกว่าการแก้ไข):', 'BodyT'), p('qm list<br/>pct list<br/>qm status 103<br/>pct status 100<br/>pct status 102<br/>df -h<br/>journalctl -p warning -b', 'CodeT')]
story += [p('Backup และการกู้คืน', 'H2T')] + bullets([
    'ตรวจใน Proxmox ว่าปลายทาง backup อยู่ที่ใด, มีอายุเก็บกี่วัน และ backup ล่าสุดสำเร็จเมื่อใด - เอกสารต้นทางไม่ระบุนโยบายนี้ จึงต้องยืนยันก่อนส่งมอบ',
    'SQLite ต้องสำรองไฟล์ database.sqlite พร้อมพิจารณาไฟล์ -wal และ -shm; ห้ามคัดลอกระหว่างที่เขียนข้อมูลโดยไม่ใช้วิธี backup ที่ถูกต้อง',
    'ทดสอบกู้คืนในเครื่องทดสอบเป็นระยะ เพราะ backup ที่ไม่เคย restore ทดสอบยังยืนยันไม่ได้ว่าใช้ได้จริง',
    'ห้าม restore ทับ production โดยตรง; สร้าง VM/CT ใหม่หรือ snapshot ก่อนเสมอ',
])
story.append(PageBreak())

story += [p('6. ตรวจสอบปัญหาและแก้ไขเบื้องต้น', 'H1T')]
story += [table(['อาการ', 'ตรวจสอบตามลำดับ', 'แนวทาง'], [
    ['เข้า Proxmox ไม่ได้', 'Tailscale Connected? เปิด URL ถูก? ping/เปิดจาก LAN ได้ไหม?', 'ตรวจสิทธิ์ Tailscale, DNS/Cloudflare; ใช้ LAN fallback หรือหน้าเครื่องจริงเมื่อต้องกู้ภัย'],
    ['CT/VM ดับ', 'Proxmox status, task log, CPU/RAM/Disk Host', 'อ่าน error ก่อน Start; อย่าสั่ง start ซ้ำ; ถ้า disk เต็มให้เคลียร์อย่างระวังและ backup ก่อน'],
    ['เว็บเปิดไม่ได้', 'DNS/Cloudflare → tunnel → guest reachable → nginx/service → application log', 'แยกว่าปัญหาอยู่ที่ Cloudflare, Host, network หรือ web service แล้วแก้จุดเดียว'],
    ['CloudPanel เข้าไม่ได้', 'VM 103 running? port 8443? clp-nginx/clp-php-fpm?', 'SSH/Console เข้า VM แล้วตรวจ systemctl และ journalctl -u service'],
    ['ฐานข้อมูล/SQLite ใช้ไม่ได้', 'พื้นที่ disk, ownership, file lock, WAL/SHM, bind mount', 'หยุดการเขียนก่อนสำรอง; ห้ามลบ -wal/-shm โดยไม่เข้าใจสถานะ transaction'],
    ['IP เปลี่ยน', 'ดู DHCP lease/IP ใน Proxmox Console หรือ ip a', 'อ้างอิง Tailscale/static vmbr1; พิจารณา DHCP reservation ที่ router'],
], [3.1*cm, 7.2*cm, 5.7*cm])]
story += [p('คำสั่งวินิจฉัยใน Linux guest', 'H2T'), p('ip a<br/>ip route<br/>ping -c 3 192.168.1.1<br/>df -h<br/>free -h<br/>systemctl --failed<br/>journalctl -xe --no-pager | tail -n 80<br/>sudo ss -ltnp', 'CodeT')]
story += [p('เมื่อควรหยุดและขอความช่วยเหลือ', 'H2T'), p('หยุดทันทีเมื่อพบ disk I/O error, filesystem เป็น read-only, มีข้อมูลหาย, ต้อง restore, ต้องแก้ firewall/Cloudflare policy, หรือไม่แน่ใจว่าคำสั่งจะลบข้อมูลหรือรีบูต Host ได้ บันทึกอาการ เวลา คำสั่งที่รัน และภาพหน้าจอเพื่อส่งต่อผู้เชี่ยวชาญ')]
story.append(PageBreak())

story += [p('7. ความปลอดภัยและทะเบียนข้อมูลลับ', 'H1T'), p('หลักการส่งมอบ', 'H2T')] + bullets([
    'สร้างบัญชีผู้ดูแลรายบุคคล แทนการใช้บัญชีและรหัสผ่านร่วมกัน; ให้สิทธิ์เท่าที่จำเป็น',
    'เปลี่ยนรหัสที่เคยอยู่ในไฟล์, แชต, log หรือเอกสารต้นทางทันทีหลังส่งมอบ และเปิด MFA ทุกบริการที่รองรับ',
    'ย้าย secret ออกจาก repository/plain text ไป password manager ที่มี audit log และแบ่งปันเป็นรายบุคคล',
    'เพิกถอน Tailscale invite link เก่า, ตรวจอุปกรณ์ใน tailnet และลบอุปกรณ์ที่ไม่ใช้งาน',
    'สำรอง Cloudflare configuration และให้สิทธิ์แบบ least privilege; เก็บ API token ใน secret store เท่านั้น',
])
story += [p('แบบฟอร์มทะเบียนข้อมูลลับ (เก็บใน password manager เท่านั้น)', 'H2T')]
story += [table(['รายการที่ต้องมี', 'ผู้รับผิดชอบ/ตำแหน่งเก็บ', 'สถานะตรวจรับ'], [
    ['Proxmox: URL, username, realm, password/MFA, SSH access', 'Password manager', '☐'],
    ['Tailscale: admin account, device approvals, ACL, recovery process', 'Password manager / Admin Console', '☐'],
    ['CT 100: SSH username/password or key', 'Password manager', '☐'],
    ['CT 102: SSH username/password or key', 'Password manager', '☐'],
    ['VM 103: CloudPanel admin, SSH, MySQL recovery/admin account', 'Password manager', '☐'],
    ['VM 101: Windows Console/RDP account', 'Password manager', '☐'],
    ['Cloudflare: account owner, zone, tunnel ID/config, API token, billing', 'Password manager', '☐'],
    ['Router/ISP: admin account, DHCP reservation, physical location/contact', 'Password manager', '☐'],
], [7.2*cm, 6.7*cm, 2.1*cm])]
story += [p('เอกสารต้นทางมี credentials.md แบบ plaintext ซึ่งเป็นความเสี่ยงสูง PDF นี้จงใจไม่ทำสำเนาค่าลับดังกล่าว หากมีการส่งไฟล์เดิมหรือรหัสผ่านผ่านแชตแล้ว ให้ถือว่าอาจถูกเปิดเผยและวางแผน rotate credential ทุกชุด', 'NoteT')]
story.append(PageBreak())

story += [p('8. รายการตรวจรับส่งมอบ', 'H1T')]
story += [table(['หัวข้อ', 'สิ่งที่ผู้รับต้องทำได้', 'ยืนยัน'], [
    ['การเข้าถึง', 'ติดตั้ง Tailscale, เข้า Proxmox ได้ด้วยบัญชีของตนเอง และ MFA ใช้งานได้', '☐'],
    ['โครงสร้าง', 'อธิบายได้ว่า Host, CT 100, CT 102, VM 103, VM 101 ทำหน้าที่อะไร', '☐'],
    ['การดำเนินงาน', 'เปิด Console, ดู task log, ดู resource, start/shutdown guest อย่างปลอดภัย', '☐'],
    ['CloudPanel', 'เข้าแผงควบคุมและตรวจ nginx/PHP/MySQL ใน VM 103 ได้', '☐'],
    ['ข้อมูล', 'ทราบตำแหน่ง SQLite/shared bind mount และวิธีสำรองที่ได้รับอนุมัติ', '☐'],
    ['Backup', 'ตรวจ backup ล่าสุดและทำ restore test ในพื้นที่ทดสอบได้', '☐'],
    ['ความปลอดภัย', 'ได้รับสิทธิ์รายบุคคล, ได้รับ secret ผ่าน password manager, รหัสเดิมถูก rotate', '☐'],
    ['เอกสาร', 'ยืนยันค่าที่ขัดกันและอัปเดตเอกสารฉบับจริงแล้ว', '☐'],
], [3.2*cm, 10.7*cm, 2.1*cm])]
story += [p('ประเด็นที่ต้องยืนยันก่อนถือว่าส่งมอบสมบูรณ์', 'H2T')] + bullets([
    'VM 103 มี RAM 4 GB หรือ 8 GB กันแน่ (ตรวจ qm config 103)',
    'VM 103 ใช้เฉพาะ 192.168.1.114/24 หรือมี net1 10.10.10.103/24 ด้วย (ตรวจ qm config 103 และ ip a ใน VM)',
    'CT 100/102 ได้ IP DHCP ปัจจุบันอะไร และ router ตั้ง DHCP reservation หรือไม่',
    'เส้นทาง/ตารางเวลา/อายุ retention ของ backup และผล restore test ล่าสุด',
    'ผู้เป็นเจ้าของบัญชี Cloudflare, Tailscale, Domain/DNS, Router/ISP และช่องทางกู้คืนบัญชี',
    'รายการเว็บไซต์/แอปจริงใน CT 100 และ VM 103, repository, deployment procedure, และเจ้าของข้อมูล',
])
story += [p('สรุป', 'H2T'), p('ระบบนี้มีฐานโครงสร้างพร้อมใช้งาน: Proxmox เป็นศูนย์กลาง, Tailscale เป็นช่องทางผู้ดูแล, Cloudflare Tunnel เป็นช่องทางสาธารณะ, CT 100 ให้บริการเว็บ, CT 102 เก็บ SQLite/ข้อมูลสำรอง, VM 103 ดูแล CloudPanel และ VM 101 สำหรับงาน Windows. การส่งมอบที่ปลอดภัยต้องเปลี่ยน secret เดิม, ยืนยันค่าที่เอกสารขัดกัน, และทดสอบ backup/restore ก่อนรับผิดชอบเต็มรูปแบบ')]

doc = SimpleDocTemplate(str(PDF), pagesize=A4, rightMargin=1.7*cm, leftMargin=1.7*cm, topMargin=1.55*cm, bottomMargin=1.8*cm, title='คู่มือส่งมอบและดูแลระบบเซิร์ฟเวอร์', author='Codex')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(PDF)
