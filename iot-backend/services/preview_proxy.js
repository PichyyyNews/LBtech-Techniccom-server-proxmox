import http from 'http'
import { db } from '../database.js'

/**
 * Generate a clean, responsive fallback HTML page when the container web server is offline
 */
export function getFallbackHtml({ studentId, serverName, vmid, port = 80, errorReason = 'Connection Refused (Port not listening)' }) {
  const starterCmd = `mkdir -p /workspace/www && cat << 'EOF' > /workspace/www/index.html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>infra-techcom Node - ${studentId || 'Project'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col font-sans">
  <!-- Minimal Header -->
  <header class="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs tracking-wider">IoT</div>
      <div>
        <h1 class="font-semibold text-sm sm:text-base">infra-techcom Node</h1>
        <p class="text-xs text-zinc-400">ID: ${studentId || '69123456789'} • วิทยาลัยเทคนิคลพบุรี</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Online
      </span>
      <span id="clock" class="text-xs text-zinc-400 font-mono">00:00:00</span>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
    <div class="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40">
      <h2 class="text-lg font-semibold mb-1">🎉 ยินดีต้อนรับสู่เว็บเซิร์ฟเวอร์ IoT ของคุณ!</h2>
      <p class="text-sm text-zinc-400">หน้าเว็บนี้ถูกสร้างขึ้นสำเร็จจากคอนเทนเนอร์ของคุณ และพร้อมให้นำไปต่อยอดแสดงผลข้อมูลเซนเซอร์ผ่าน MQTT หรือ REST API</p>
    </div>

    <!-- Live Metrics Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div class="text-xs text-zinc-400 font-medium">เซนเซอร์อุณหภูมิ (Temp)</div>
        <div class="text-2xl font-bold mt-2 text-emerald-400">28.4 °C</div>
        <div class="text-[11px] text-zinc-500 mt-1">อัปเดตแบบเรียลไทม์</div>
      </div>
      <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div class="text-xs text-zinc-400 font-medium">ความชื้นสัมพัทธ์ (Humidity)</div>
        <div class="text-2xl font-bold mt-2 text-sky-400">62.0 %</div>
        <div class="text-[11px] text-zinc-500 mt-1">อัปเดตแบบเรียลไทม์</div>
      </div>
      <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div class="text-xs text-zinc-400 font-medium">สถานะรีเลย์ (Relay Status)</div>
        <div class="text-2xl font-bold mt-2 text-amber-400">Active (ON)</div>
        <div class="text-[11px] text-zinc-500 mt-1">GPIO 2 (ESP32)</div>
      </div>
    </div>
  </main>

  <script>
    function updateClock() {
      document.getElementById('clock').textContent = new Date().toLocaleTimeString('th-TH');
    }
    setInterval(updateClock, 1000); updateClock();
  </script>
</body>
</html>
EOF
python3 -m http.server ${port} --directory /workspace/www > /workspace/www/web.log 2>&1 &
echo -e "\n\\e[32m[OK] เว็บไซต์เริ่มต้นทำงานแล้วบนพอร์ต ${port}! รีเฟรชหน้านี้ได้เลย\\e[0m"`

  return `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>เว็บเซิร์ฟเวอร์ยังไม่เปิดทำงาน | infra-techcom</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #09090b;
      color: #f4f4f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      line-height: 1.5;
    }
    .card {
      width: 100%;
      max-width: 640px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 1rem;
      padding: 1.75rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      background: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #fbbf24;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      gap: 1rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 0.25rem;
    }
    p.desc {
      font-size: 0.875rem;
      color: #a1a1aa;
    }
    .info-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1.25rem 0;
      padding: 0.75rem 1rem;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      color: #d4d4d8;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .info-item span.label {
      color: #71717a;
    }
    .code-box {
      position: relative;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 0.5rem;
      margin-top: 1rem;
      overflow: hidden;
    }
    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #18181b;
      border-bottom: 1px solid #27272a;
      font-size: 0.75rem;
      color: #71717a;
      font-family: 'JetBrains Mono', monospace;
    }
    .copy-btn {
      background: #27272a;
      color: #f4f4f5;
      border: 1px solid #3f3f46;
      border-radius: 0.375rem;
      padding: 0.25rem 0.625rem;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .copy-btn:hover {
      background: #3f3f46;
      color: #ffffff;
    }
    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8125rem;
      color: #e4e4e7;
      padding: 0.875rem;
      overflow-x: auto;
      max-height: 220px;
      line-height: 1.4;
      white-space: pre;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-primary {
      background: #ffffff;
      color: #09090b;
      border: 1px solid #ffffff;
    }
    .btn-primary:hover {
      background: #f4f4f5;
    }
    .btn-secondary {
      background: #27272a;
      color: #f4f4f5;
      border: 1px solid #3f3f46;
    }
    .btn-secondary:hover {
      background: #3f3f46;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="badge" style="margin-bottom: 0.5rem;">
          <span class="dot"></span>
          <span>Web Server Not Ready</span>
        </div>
        <h1>ยังไม่พบ Web Server กำลังรันอยู่</h1>
        <p class="desc">คอนเทนเนอร์ของคุณเปิดทำงานอยู่ แต่ยังไม่มีโปรแกรมเว็บเซิร์ฟเวอร์รันบนพอร์ต ${port}</p>
      </div>
    </div>

    <div class="info-bar">
      <div class="info-item">
        <span class="label">นักศึกษา:</span>
        <strong>${studentId || '-'}</strong>
      </div>
      <div style="color: #3f3f46;">•</div>
      <div class="info-item">
        <span class="label">คอนเทนเนอร์:</span>
        <strong>${serverName || 'CT ' + (vmid || '')}</strong>
      </div>
      <div style="color: #3f3f46;">•</div>
      <div class="info-item">
        <span class="label">พอร์ตเป้าหมาย:</span>
        <strong>${port}</strong>
      </div>
    </div>

    <p style="font-size: 0.875rem; color: #d4d4d8; margin-top: 1rem;">
      💡 <strong>วิธีเริ่มเปิดใช้งาน:</strong> คัดลอกคำสั่งด้านล่างไปวางใน <strong>Web Terminal</strong> เพื่อสร้างหน้าเว็บ HTML พร้อมรันเซิร์ฟเวอร์ทันที
    </p>

    <div class="code-box">
      <div class="code-header">
        <span>Instant Python 3 IoT Web Dashboard (Port ${port})</span>
        <button class="copy-btn" onclick="copyCode(this)">คัดลอกคำสั่ง (Copy)</button>
      </div>
      <pre id="starterCode">${starterCmd.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>

    <div class="actions">
      <button class="btn btn-primary" onclick="retryNow()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 16h5v5"/>
        </svg>
        <span>รีเฟรชหน้าเว็บ (<span id="countdown">10</span>s)</span>
      </button>

      <a href="/terminal/${vmid || studentId}" target="_blank" class="btn btn-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" x2="20" y1="19" y2="19"/>
        </svg>
        <span>เปิด Web Terminal เพื่อรันคำสั่ง</span>
      </a>
    </div>
  </div>

  <script>
    let secondsLeft = 10;
    const countEl = document.getElementById('countdown');
    const timer = setInterval(() => {
      secondsLeft--;
      if (countEl) countEl.textContent = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(timer);
        window.location.reload();
      }
    }, 1000);

    function retryNow() {
      window.location.reload();
    }

    function copyCode(btn) {
      const code = document.getElementById('starterCode').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const orig = btn.innerText;
        btn.innerText = 'คัดลอกแล้ว ✓';
        btn.style.background = '#059669';
        btn.style.borderColor = '#059669';
        setTimeout(() => {
          btn.innerText = orig;
          btn.style.background = '#27272a';
          btn.style.borderColor = '#3f3f46';
        }, 2000);
      });
    }
  </script>
</body>
</html>`
}

/**
 * Handle incoming web preview proxy requests
 */
export async function handlePreviewRequest(req, res) {
  const target = req.params.target
  const subPath = req.url.replace(new RegExp(`^/api/preview/${target}`), '') || '/'

  // Find server from DB
  const server = db.getServerByVmid(target) ||
    db.getServers().find(s => s.studentId === target || String(s.vmid) === String(target) || s.containerId === target || s.name === target)

  if (!server) {
    res.status(404).send(getFallbackHtml({
      studentId: target,
      serverName: 'ไม่พบในระบบ',
      vmid: target,
      port: 80,
      errorReason: 'Container not found in database'
    }))
    return
  }

  const containerHost = server.containerName || `std-${server.studentId}-${(server.name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}` || server.ip || '127.0.0.1'
  const targetPort = server.webPort || 80

  const options = {
    hostname: containerHost,
    port: targetPort,
    path: subPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${containerHost}:${targetPort}`,
      'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress
    },
    timeout: 5000
  }

  const proxyReq = http.request(options, (proxyRes) => {
    // If backend returns a valid response, stream it back
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Gateway Timeout'))
  })

  proxyReq.on('error', (err) => {
    // Check if headers already sent
    if (res.headersSent) return
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(getFallbackHtml({
      studentId: server.studentId,
      serverName: server.name,
      vmid: server.vmid,
      port: targetPort,
      errorReason: err.message
    }))
  })

  req.pipe(proxyReq)
}
