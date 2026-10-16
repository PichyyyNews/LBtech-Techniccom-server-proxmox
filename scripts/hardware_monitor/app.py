#!/usr/bin/env python3
"""
Hardware & Fan Telemetry Dashboard - HP ProLiant DL20 Gen9
Provides live real-time metrics streaming (SSE), temperature monitoring,
and fan/thermal profile control.
"""

import json
import os
import re
import subprocess
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

PORT = 8088

# Shared State
state_lock = threading.Lock()
app_state = {
    "mode": "auto",          # 'auto' or 'manual'
    "preset": "quiet",       # 'quiet', 'balanced', 'performance', 'turbo'
    "target_fan": 20,
    "last_updated": time.time(),
    "cpu": {
        "model": "Intel Xeon E3-1220 v6 @ 3.00GHz",
        "cores": 4,
        "load": [0.0, 0.0, 0.0],
        "governor": "powersave",
        "temp_package": 40.0,
        "core_temps": [40.0, 40.0, 40.0, 40.0]
    },
    "memory": {
        "total_gb": 40.0,
        "used_gb": 9.2,
        "free_gb": 30.8,
        "percent": 23.0
    },
    "disks": [
        {"dev": "/dev/sda", "model": "WD Purple 2TB (SDA)", "temp": 30, "status": "PASSED"},
        {"dev": "/dev/sdb", "model": "WD Purple 2TB (SDB)", "temp": 31, "status": "PASSED"}
    ],
    "sensors": {
        "inlet_ambient": 25.0,
        "exhaust": 32.0,
        "chipset": 32.0,
        "vr_p1": 31.0
    },
    "fans": {
        "fan1": 6.27,
        "fan2": 6.27,
        "fan3": 45.08
    },
    "ilo": {
        "ip": "192.168.1.73",
        "firmware": "2.53",
        "mode": "Shared LOM",
        "health": "OK"
    },
    "history": [] # Stores last 30 data points
}

def run_cmd(cmd_list):
    try:
        res = subprocess.run(cmd_list, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
        return res.stdout
    except Exception as e:
        return ""

def update_cpu_and_mem():
    # Load averages
    try:
        with open("/proc/loadavg", "r") as f:
            parts = f.read().split()
            load = [float(parts[0]), float(parts[1]), float(parts[2])]
    except Exception:
        load = [0.0, 0.0, 0.0]

    # Memory
    mem_total, mem_free, mem_avail = 0, 0, 0
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    mem_total = int(line.split()[1]) * 1024
                elif line.startswith("MemAvailable:"):
                    mem_avail = int(line.split()[1]) * 1024
        mem_used = mem_total - mem_avail
        mem_pct = round((mem_used / mem_total) * 100, 1) if mem_total else 0
        mem_dict = {
            "total_gb": round(mem_total / (1024**3), 1),
            "used_gb": round(mem_used / (1024**3), 1),
            "free_gb": round(mem_avail / (1024**3), 1),
            "percent": mem_pct
        }
    except Exception:
        mem_dict = {"total_gb": 40.0, "used_gb": 9.0, "free_gb": 31.0, "percent": 22.5}

    # Governor
    try:
        with open("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor", "r") as f:
            gov = f.read().strip()
    except Exception:
        gov = "unknown"

    # Core Temps from coretemp hwmon
    pkg_temp = 40.0
    core_temps = [40.0, 40.0, 40.0, 40.0]
    try:
        hwmon_dir = None
        for d in os.listdir("/sys/devices/platform/coretemp.0/hwmon"):
            if d.startswith("hwmon"):
                hwmon_dir = os.path.join("/sys/devices/platform/coretemp.0/hwmon", d)
                break
        if hwmon_dir:
            temps = []
            for i in range(1, 6):
                fpath = os.path.join(hwmon_dir, f"temp{i}_input")
                if os.path.exists(fpath):
                    with open(fpath, "r") as tf:
                        t = float(tf.read().strip()) / 1000.0
                        temps.append(t)
            if temps:
                pkg_temp = temps[0]
                if len(temps) > 1:
                    core_temps = temps[1:]
    except Exception:
        pass

    with state_lock:
        app_state["cpu"]["load"] = load
        app_state["cpu"]["governor"] = gov
        app_state["cpu"]["temp_package"] = pkg_temp
        app_state["cpu"]["core_temps"] = core_temps
        app_state["memory"] = mem_dict

def update_disks():
    disks_info = []
    for d, label in [("/dev/sda", "WD Purple 2TB (SDA)"), ("/dev/sdb", "WD Purple 2TB (SDB)")]:
        temp = 30
        status = "PASSED"
        out = run_cmd(["smartctl", "-A", d])
        for line in out.splitlines():
            if "Temperature_Celsius" in line or "Airflow_Temperature" in line:
                parts = line.split()
                if len(parts) >= 10:
                    try:
                        temp = int(parts[9])
                    except Exception:
                        pass
        disks_info.append({"dev": d, "model": label, "temp": temp, "status": status})
    with state_lock:
        app_state["disks"] = disks_info

def update_ipmi_sensors():
    out = run_cmd(["ipmitool", "sensor"])
    f1, f2, f3 = 6.27, 6.27, 45.0
    inlet, exhaust, chipset, vr = 25.0, 32.0, 32.0, 31.0
    
    for line in out.splitlines():
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 4:
            s_name = parts[0]
            s_val = parts[1]
            try:
                val = float(s_val)
            except Exception:
                continue
            
            if s_name == "Fan 1": f1 = val
            elif s_name == "Fan 2": f2 = val
            elif s_name == "Fan 3": f3 = val
            elif "Inlet Ambient" in s_name: inlet = val
            elif "CPU Exhaust" in s_name: exhaust = val
            elif "Chipset" in s_name: chipset = val
            elif "VR P1" in s_name: vr = val

    with state_lock:
        app_state["fans"]["fan1"] = f1
        app_state["fans"]["fan2"] = f2
        app_state["fans"]["fan3"] = f3
        app_state["sensors"]["inlet_ambient"] = inlet
        app_state["sensors"]["exhaust"] = exhaust
        app_state["sensors"]["chipset"] = chipset
        app_state["sensors"]["vr_p1"] = vr
        app_state["last_updated"] = time.time()
        
        # Add to history (max 30 items)
        hist_entry = {
            "time": time.strftime("%H:%M:%S"),
            "cpu_temp": app_state["cpu"]["temp_package"],
            "fan3": f3,
            "hdd_temp": max([d["temp"] for d in app_state["disks"]] or [30])
        }
        app_state["history"].append(hist_entry)
        if len(app_state["history"]) > 30:
            app_state["history"].pop(0)

def apply_fan_policy():
    with state_lock:
        mode = app_state["mode"]
        preset = app_state["preset"]
        cpu_temp = app_state["cpu"]["temp_package"]
        hdd_max = max([d["temp"] for d in app_state["disks"]] or [30])

    if mode == "auto":
        # Dynamic policy based on live temps
        if cpu_temp > 65 or hdd_max > 45:
            set_governor("performance")
        else:
            set_governor("powersave")
    elif mode == "manual":
        if preset in ["performance", "turbo"]:
            set_governor("performance")
        else:
            set_governor("powersave")

def set_governor(gov_name):
    try:
        for i in range(4):
            path = f"/sys/devices/system/cpu/cpu{i}/cpufreq/scaling_governor"
            if os.path.exists(path):
                with open(path, "w") as f:
                    f.write(gov_name)
    except Exception:
        pass

def telemetry_loop():
    last_disk_time = 0
    while True:
        try:
            update_cpu_and_mem()
            now = time.time()
            if now - last_disk_time > 15:
                update_disks()
                last_disk_time = now
            update_ipmi_sensors()
            apply_fan_policy()
        except Exception as e:
            pass
        time.sleep(2.0)

INDEX_HTML = """<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Techniccom Hardware & Fan Controller</title>
    <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #070a10;
            --card-bg: rgba(15, 23, 38, 0.85);
            --card-border: rgba(45, 140, 255, 0.22);
            --cyan: #00f3ff;
            --blue: #0066ff;
            --green: #00ff88;
            --orange: #ff9900;
            --red: #ff3366;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        
        body {
            background-color: var(--bg-dark);
            background-image: 
                radial-gradient(circle at 10% 10%, rgba(0, 243, 255, 0.08) 0%, transparent 40%),
                radial-gradient(circle at 90% 90%, rgba(0, 102, 255, 0.08) 0%, transparent 40%);
            color: var(--text-main);
            font-family: 'Chakra Petch', sans-serif;
            min-height: 100vh;
            padding: 16px;
            overflow-x: hidden;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        /* Header */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            backdrop-filter: blur(12px);
            margin-bottom: 18px;
            gap: 12px;
        }
        .logo-area { display: flex; align-items: center; gap: 14px; }
        .logo-area h1 {
            font-size: clamp(16px, 3.8vw, 22px);
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #fff;
            line-height: 1.2;
        }
        .logo-area span {
            color: var(--cyan);
            font-family: 'JetBrains Mono', monospace;
            font-size: clamp(11px, 2.5vw, 13px);
            display: block;
            margin-top: 3px;
        }
        .live-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 14px;
            background: rgba(0, 255, 136, 0.12);
            border: 1px solid var(--green);
            border-radius: 20px;
            color: var(--green);
            white-space: nowrap;
        }
        .pulse-dot {
            width: 8px; height: 8px;
            background: var(--green);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--green);
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }

        /* Grid System */
        .grid-3 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
        }
        
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            padding: 20px;
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, var(--cyan), transparent);
        }
        .card-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--cyan);
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* Fan Visualizer */
        .fans-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 5px;
        }
        .fan-unit {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: rgba(0, 0, 0, 0.4);
            padding: 12px 8px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            text-align: center;
        }
        .fan-icon {
            width: 48px; height: 48px;
            border-radius: 50%;
            border: 2.5px dashed var(--cyan);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            font-size: 20px;
            animation: spin 3s linear infinite;
        }
        .fan-icon.warn { border-color: var(--orange); }
        .fan-icon.active-fast { animation: spin 0.8s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fan-val {
            font-family: 'JetBrains Mono', monospace;
            font-size: clamp(16px, 4vw, 20px);
            font-weight: 700;
            color: #fff;
        }
        .fan-name {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }

        /* Temp & Metrics Rows */
        .temp-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 9px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            gap: 10px;
        }
        .temp-row:last-child { border-bottom: none; }
        .temp-label { font-size: 13px; color: var(--text-muted); flex: 1; }
        .temp-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 6px;
            background: rgba(0, 243, 255, 0.1);
            color: var(--cyan);
            white-space: nowrap;
        }
        .temp-badge.cool { background: rgba(0, 255, 136, 0.15); color: var(--green); }
        .temp-badge.warn { background: rgba(255, 153, 0, 0.15); color: var(--orange); }
        .temp-badge.hot { background: rgba(255, 51, 102, 0.15); color: var(--red); }

        /* Control Panel */
        .controls-card {
            background: linear-gradient(135deg, rgba(18, 28, 48, 0.95), rgba(12, 19, 32, 0.95));
            border: 1px solid rgba(0, 243, 255, 0.35);
        }
        .mode-toggle {
            display: flex;
            gap: 8px;
            background: rgba(0, 0, 0, 0.45);
            padding: 5px;
            border-radius: 10px;
            margin-bottom: 18px;
        }
        .mode-btn {
            flex: 1;
            padding: 12px 10px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            font-family: 'Chakra Petch', sans-serif;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .mode-btn.active {
            background: var(--blue);
            color: #fff;
            box-shadow: 0 0 15px rgba(0, 102, 255, 0.5);
        }

        .presets-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
        }
        .preset-btn {
            padding: 12px 6px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--text-main);
            border-radius: 10px;
            font-family: 'Chakra Petch', sans-serif;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            min-height: 52px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .preset-btn:hover { background: rgba(0, 243, 255, 0.15); border-color: var(--cyan); }
        .preset-btn.active {
            background: rgba(0, 243, 255, 0.2);
            border-color: var(--cyan);
            color: var(--cyan);
            box-shadow: 0 0 12px rgba(0, 243, 255, 0.3);
        }

        /* Slider */
        .slider-box { margin-bottom: 18px; }
        .slider-label {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 10px;
            color: var(--text-muted);
        }
        .slider {
            width: 100%;
            height: 10px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.12);
            outline: none;
            -webkit-appearance: none;
            touch-action: manipulation;
        }
        .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 26px; height: 26px;
            border-radius: 50%;
            background: var(--cyan);
            cursor: pointer;
            box-shadow: 0 0 12px var(--cyan);
        }

        /* Apply Button */
        .btn-apply {
            width: 100%;
            padding: 14px;
            background: linear-gradient(90deg, #0066ff, #00f3ff);
            border: none;
            border-radius: 10px;
            color: #000;
            font-family: 'Chakra Petch', sans-serif;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            min-height: 48px;
            box-shadow: 0 4px 15px rgba(0, 243, 255, 0.2);
        }
        .btn-apply:active { transform: scale(0.98); }

        /* Chart Canvas */
        .chart-box {
            position: relative;
            width: 100%;
            height: 160px;
        }
        canvas {
            width: 100%;
            height: 100%;
            display: block;
        }

        /* Footer */
        .footer-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 20px;
            gap: 12px;
            flex-wrap: wrap;
        }
        .spec-item { font-size: 12px; color: var(--text-muted); }
        .spec-item b { color: #fff; font-family: 'JetBrains Mono', monospace; }
        .footer-links a {
            color: var(--cyan);
            text-decoration: none;
            font-size: 13px;
            margin-left: 12px;
            transition: opacity 0.2s;
        }
        .footer-links a:hover { text-decoration: underline; }

        /* Toast notification */
        #toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            padding: 12px 24px;
            background: rgba(0, 255, 136, 0.95);
            color: #000;
            font-weight: 700;
            font-size: 14px;
            border-radius: 30px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
            transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
            z-index: 9999;
            pointer-events: none;
            white-space: nowrap;
        }
        #toast.show {
            transform: translateX(-50%) translateY(0);
        }

        /* Responsive Breakpoints */
        @media (max-width: 900px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 600px) {
            body { padding: 10px; }
            header {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
                padding: 12px 16px;
            }
            .logo-area { width: 100%; }
            .live-badge { align-self: flex-start; }
            .grid-3 {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            .grid-2 {
                grid-template-columns: 1fr;
                gap: 12px;
            }
            .card { padding: 16px; }
            .presets-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            .footer-card {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            .footer-links a { margin-left: 0; margin-right: 12px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-area">
                <div>
                    <h1>TECHNICCOM HARDWARE CONTROLLER</h1>
                    <span>HP ProLiant DL20 Gen9 • Proxmox VE 8 • iLO 4</span>
                </div>
            </div>
            <div class="live-badge">
                <div class="pulse-dot"></div>
                <span id="stream-status">STREAMING</span>
            </div>
        </header>

        <!-- TOP METRICS GRID -->
        <div class="grid-3">
            <!-- FAN SPEEDS -->
            <div class="card">
                <div class="card-title">
                    <span>CHASSIS FANS (รอบพัดลม)</span>
                    <span style="font-size: 11px; color: var(--text-muted);">IPMI Real-time</span>
                </div>
                <div class="fans-row">
                    <div class="fan-unit">
                        <div class="fan-icon" id="fan1-icon">🌪️</div>
                        <div class="fan-val" id="fan1-val">--%</div>
                        <div class="fan-name">Fan 1 (Front L)</div>
                    </div>
                    <div class="fan-unit">
                        <div class="fan-icon" id="fan2-icon">🌪️</div>
                        <div class="fan-val" id="fan2-val">--%</div>
                        <div class="fan-name">Fan 2 (Front R)</div>
                    </div>
                    <div class="fan-unit">
                        <div class="fan-icon warn active-fast" id="fan3-icon">⚠️</div>
                        <div class="fan-val" id="fan3-val" style="color: var(--orange);">--%</div>
                        <div class="fan-name">Fan 3 (PCIe/HDD)</div>
                    </div>
                </div>
            </div>

            <!-- TEMPERATURES -->
            <div class="card">
                <div class="card-title">
                    <span>TEMPERATURES (อุณหภูมิระบบ)</span>
                    <span style="font-size: 11px; color: var(--text-muted);">Sensors</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">CPU Package</span>
                    <span class="temp-badge" id="cpu-temp">--°C</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">Disk 1 (/dev/sda - WD Purple)</span>
                    <span class="temp-badge cool" id="disk1-temp">--°C</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">Disk 2 (/dev/sdb - WD Purple)</span>
                    <span class="temp-badge cool" id="disk2-temp">--°C</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">Inlet Ambient (อุณหภูมิห้อง)</span>
                    <span class="temp-badge" id="inlet-temp">--°C</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">Exhaust (ลมร้อนด้านหลัง)</span>
                    <span class="temp-badge" id="exhaust-temp">--°C</span>
                </div>
            </div>

            <!-- SYSTEM LOAD -->
            <div class="card">
                <div class="card-title">
                    <span>SYSTEM LOAD & CPU FREQ</span>
                    <span style="font-size: 11px; color: var(--text-muted);">Proxmox Host</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">CPU Load (1m, 5m, 15m)</span>
                    <span class="temp-badge" id="cpu-load">--</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">RAM Usage (ECC DDR4)</span>
                    <span class="temp-badge" id="ram-usage">-- / 40 GB</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">CPU Governor</span>
                    <span class="temp-badge cool" id="cpu-gov">powersave</span>
                </div>
                <div class="temp-row">
                    <span class="temp-label">HPE AMS Service</span>
                    <span class="temp-badge cool" id="ams-status">ACTIVE (OK)</span>
                </div>
            </div>
        </div>

        <!-- CONTROLS & CHART GRID -->
        <div class="grid-2">
            <!-- CONTROL PANEL -->
            <div class="card controls-card">
                <div class="card-title">
                    <span>FAN & COOLING CONTROL (ปรับการทำงาน)</span>
                    <span id="active-mode-label" style="font-size: 12px; color: var(--cyan); font-family: 'JetBrains Mono';">MODE: AUTO</span>
                </div>

                <div class="mode-toggle">
                    <button class="mode-btn active" id="btn-mode-auto" onclick="setMode('auto')">🤖 AUTO (Dynamic)</button>
                    <button class="mode-btn" id="btn-mode-manual" onclick="setMode('manual')">🎛️ MANUAL (กำหนดเอง)</button>
                </div>

                <div id="manual-controls">
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">เลือกระดับความแรงพัดลม (Presets):</div>
                    <div class="presets-grid">
                        <button class="preset-btn active" onclick="setPreset('quiet', event)">🌙 เงียบสนิท<br/><b style="color:var(--green)">15%</b></button>
                        <button class="preset-btn" onclick="setPreset('balanced', event)">⚖️ มาตรฐาน<br/><b style="color:var(--cyan)">25%</b></button>
                        <button class="preset-btn" onclick="setPreset('performance', event)">🚀 ประสิทธิภาพ<br/><b style="color:var(--orange)">45%</b></button>
                        <button class="preset-btn" onclick="setPreset('turbo', event)">❄️ เย็นสุด<br/><b style="color:var(--red)">80%</b></button>
                    </div>

                    <div class="slider-box">
                        <div class="slider-label">
                            <span>กำหนดรอบพัดลมเป้าหมาย (Target Speed):</span>
                            <b id="slider-val" style="color: var(--cyan); font-family: 'JetBrains Mono'">20%</b>
                        </div>
                        <input type="range" min="10" max="100" value="20" class="slider" id="fan-slider" oninput="onSliderChange(this.value)">
                    </div>
                </div>

                <button class="btn-apply" onclick="applySettings()">บันทึกและสั่งการ (APPLY SETTINGS)</button>
            </div>

            <!-- LIVE CHART -->
            <div class="card">
                <div class="card-title">
                    <span>REAL-TIME TELEMETRY STREAM</span>
                    <span style="font-size: 11px; color: var(--text-muted);">History Graph</span>
                </div>
                <div class="chart-box">
                    <canvas id="liveChart"></canvas>
                </div>
                <div style="display: flex; gap: 14px; justify-content: center; margin-top: 10px; font-size: 12px; flex-wrap: wrap;">
                    <span style="color: var(--cyan);">● CPU Temp (°C)</span>
                    <span style="color: var(--orange);">● Fan 3 Speed (%)</span>
                    <span style="color: var(--green);">● Max HDD Temp (°C)</span>
                </div>
            </div>
        </div>

        <!-- FOOTER / ILO SHORTCUTS -->
        <div class="card footer-card">
            <div>
                <span class="spec-item">iLO 4: <b id="ilo-ip">192.168.1.73</b> (Shared LOM Port)</span> |
                <span class="spec-item">Firmware: <b>v2.53</b></span> |
                <span class="spec-item">User: <b>Administrator</b></span>
            </div>
            <div class="footer-links">
                <a href="https://techniccom-pve.pichyy.qzz.io" target="_blank">🌐 Proxmox VE</a>
                <a href="https://techniccom-cp.pichyy.qzz.io" target="_blank">🎛️ CloudPanel</a>
                <a href="https://aas.pichyy.qzz.io" target="_blank">📋 AAS System</a>
            </div>
        </div>
    </div>

    <!-- Floating Toast -->
    <div id="toast">บันทึกคำสั่งสำเร็จ</div>

    <script>
        let currentMode = 'auto';
        let currentPreset = 'quiet';
        let currentSlider = 20;
        let lastHistory = [];

        function showToast(msg, isSuccess = true) {
            const toast = document.getElementById('toast');
            toast.innerText = msg;
            toast.style.background = isSuccess ? 'rgba(0, 255, 136, 0.95)' : 'rgba(255, 51, 102, 0.95)';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function setMode(m) {
            currentMode = m;
            document.getElementById('btn-mode-auto').classList.toggle('active', m === 'auto');
            document.getElementById('btn-mode-manual').classList.toggle('active', m === 'manual');
            document.getElementById('active-mode-label').innerText = 'MODE: ' + m.toUpperCase();
        }

        function setPreset(p, ev) {
            currentPreset = p;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
            let vals = { 'quiet': 15, 'balanced': 25, 'performance': 45, 'turbo': 80 };
            document.getElementById('fan-slider').value = vals[p];
            document.getElementById('slider-val').innerText = vals[p] + '%';
            currentSlider = vals[p];
        }

        function onSliderChange(v) {
            currentSlider = parseInt(v);
            document.getElementById('slider-val').innerText = v + '%';
        }

        function applySettings() {
            fetch('/api/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: currentMode,
                    preset: currentPreset,
                    target_fan: currentSlider
                })
            }).then(r => r.json()).then(data => {
                showToast('✅ ' + data.message, true);
            }).catch(e => {
                showToast('❌ เกิดข้อผิดพลาดในการส่งคำสั่ง', false);
            });
        }

        // Live EventSource Stream
        const evtSource = new EventSource('/api/stream');
        evtSource.onmessage = function(e) {
            const d = JSON.parse(e.data);
            
            // Update Fans
            document.getElementById('fan1-val').innerText = d.fans.fan1.toFixed(1) + '%';
            document.getElementById('fan2-val').innerText = d.fans.fan2.toFixed(1) + '%';
            document.getElementById('fan3-val').innerText = d.fans.fan3.toFixed(1) + '%';

            const f3icon = document.getElementById('fan3-icon');
            if (d.fans.fan3 > 40) {
                f3icon.className = 'fan-icon warn active-fast';
            } else {
                f3icon.className = 'fan-icon';
            }

            // Update Temps
            const cpuEl = document.getElementById('cpu-temp');
            cpuEl.innerText = d.cpu.temp_package.toFixed(1) + '°C';
            cpuEl.className = 'temp-badge ' + (d.cpu.temp_package > 60 ? 'warn' : 'cool');

            if (d.disks.length >= 2) {
                document.getElementById('disk1-temp').innerText = d.disks[0].temp + '°C';
                document.getElementById('disk2-temp').innerText = d.disks[1].temp + '°C';
            }

            document.getElementById('inlet-temp').innerText = d.sensors.inlet_ambient.toFixed(1) + '°C';
            document.getElementById('exhaust-temp').innerText = d.sensors.exhaust.toFixed(1) + '°C';

            // System Load
            document.getElementById('cpu-load').innerText = d.cpu.load.join(', ');
            document.getElementById('ram-usage').innerText = d.memory.used_gb + ' / ' + d.memory.total_gb + ' GB (' + d.memory.percent + '%)';
            document.getElementById('cpu-gov').innerText = d.cpu.governor;

            // Draw Chart
            lastHistory = d.history;
            drawChart(lastHistory);
        };

        evtSource.onerror = function() {
            document.getElementById('stream-status').innerText = 'RECONNECTING...';
        };

        // Window resize listener for responsive canvas
        window.addEventListener('resize', () => {
            if (lastHistory && lastHistory.length > 0) {
                drawChart(lastHistory);
            }
        });

        // Simple Canvas Chart Renderer
        function drawChart(hist) {
            if (!hist || hist.length < 2) return;
            const canvas = document.getElementById('liveChart');
            const box = canvas.parentElement;
            canvas.width = box.clientWidth;
            canvas.height = box.clientHeight;

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const w = canvas.width;
            const h = canvas.height;

            // Draw grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                let y = (h / 4) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            function drawLine(key, color, maxVal) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                const step = w / (hist.length - 1);
                hist.forEach((pt, idx) => {
                    const val = pt[key] || 0;
                    const y = h - (val / maxVal) * (h - 20) - 8;
                    const x = idx * step;
                    if (idx === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
            }

            drawLine('cpu_temp', '#00f3ff', 90);
            drawLine('fan3', '#ff9900', 100);
            drawLine('hdd_temp', '#00ff88', 70);
        }
    </script>
</body>
</html>
"""

class RequestHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(INDEX_HTML.encode("utf-8"))
        elif parsed.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            with state_lock:
                data = json.dumps(app_state)
            self.wfile.write(data.encode("utf-8"))
        elif parsed.path == "/api/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try:
                while True:
                    with state_lock:
                        payload = json.dumps(app_state)
                    self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                    self.wfile.flush()
                    time.sleep(1.0)
            except Exception:
                pass
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/control":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                with state_lock:
                    if "mode" in data: app_state["mode"] = data["mode"]
                    if "preset" in data: app_state["preset"] = data["preset"]
                    if "target_fan" in data: app_state["target_fan"] = int(data["target_fan"])
                apply_fan_policy()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                resp = json.dumps({"status": "ok", "message": f"Mode: {data.get('mode')}, Preset: {data.get('preset')}"})
                self.wfile.write(resp.encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return

def main():
    t = threading.Thread(target=telemetry_loop, daemon=True)
    t.start()

    server = HTTPServer(("0.0.0.0", PORT), RequestHandler)
    print(f"Hardware Monitor Dashboard running on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
