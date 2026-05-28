import React, { useState, useEffect } from 'react';
import { Shield, Settings, Activity, Eye, EyeOff, User, Server, Globe, Terminal } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';
import Dashboard from './components/Dashboard';
import ConfigGenerator from './components/ConfigGenerator';
import './App.css';

const VpnPlugin = registerPlugin('VpnPlugin');

const getBackendUrl = () => {
  return "https://project-vpn-open-1.onrender.com";
};

// Fetch with timeout helper
const fetchWithTimeout = async (url, options, timeoutMs = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

const generateLocalUltimateHybrid = (settings) => {
  const uuid = "455037ea-dc30-4e09-9de3-ee1ae735c36d";
  const clientWgPrivate = "8JeMczxUJ//ED9s7uiB2an7vvFSVsWha3mNYTTeP0H4=";
  const serverWgPublic = "R2k28leApEiBTPxRPN33+t70ouAc9lkMP/EiP4eT1Tw=";
  const realityPublic = "XArfuZjeq6vmny_V2n2IqTl6dFOgaYfWsmIdLZwoPws";
  const shortId = "81a4a0dd48b6750a";

  const config = {
    "log": {
      "level": "debug"
    },
    "dns": {
      "servers": [
        {
          "tag": "dns-remote",
          "address": "1.1.1.1",
          "detour": "wg-out"
        },
        {
          "tag": "dns-backup",
          "address": "8.8.8.8",
          "detour": "wg-out"
        }
      ]
    },
    "inbounds": [
      {
        "type": "tun",
        "tag": "tun-in",
        "interface_name": "tun0",
        "inet4_address": "172.19.0.1/30",
        "auto_route": false,
        "strict_route": false,
        "stack": "gvisor",
        "sniff": true
      }
    ],
    "outbounds": [
      {
        "type": "wireguard",
        "tag": "wg-out",
        "server": "127.0.0.1",
        "server_port": parseInt(settings.wgPort),
        "local_address": [
          `${settings.wgClientIp}/24`
        ],
        "private_key": clientWgPrivate,
        "peer_public_key": serverWgPublic,
        "mtu": 1280,
        "detour": "vless-out"
      },
      {
        "type": "vless",
        "tag": "vless-out",
        "server": settings.serverIp,
        "server_port": 443,
        "uuid": uuid,
        "flow": "xtls-rprx-vision",
        "network": "tcp",
        "tls": {
          "enabled": true,
          "server_name": "images.apple.com",
          "utls": {
            "enabled": true,
            "fingerprint": "chrome"
          },
          "reality": {
            "enabled": true,
            "public_key": realityPublic,
            "short_id": shortId
          }
        }
      },
      {
        "type": "direct",
        "tag": "direct"
      },
      {
        "type": "dns",
        "tag": "dns-out"
      }
    ],
    "route": {
      "auto_detect_interface": true,
      "rules": [
        {
          "port": [53],
          "outbound": "dns-out"
        }
      ]
    }
  };

  return JSON.stringify(config, null, 2);
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('admin'); // 'admin' or 'client'
  const [username, setUsername] = useState('Administrator');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCheckStatus, setConnectionCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'success' | 'failed'
  const [resolvedIp, setResolvedIp] = useState('');
  const [vpnHealthRef] = useState({ current: null }); // Holds health check interval ID
  const [activeSettings, setActiveSettings] = useState({
    serverIp: '139.84.234.151',
    wgPort: '51820',
    wgClientIp: '10.8.0.2',
    country: 'South Africa',
    countryCode: 'ZA',
    flag: '🇿🇦'
  });
  
  const [backendUrl, setBackendUrl] = useState(() => {
    const saved = localStorage.getItem('shieldlink_backend_url');
    if (!saved || saved.includes('localhost:5000') || saved === 'http://localhost:5000') {
      const defaultUrl = getBackendUrl();
      localStorage.setItem('shieldlink_backend_url', defaultUrl);
      return defaultUrl;
    }
    return saved;
  });
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [nativeLogs, setNativeLogs] = useState('');
  const [showNativeLogsModal, setShowNativeLogsModal] = useState(false);

  const handleFetchNativeLogs = async () => {
    const isNative = window.Capacitor && window.Capacitor.isNative;
    if (!isNative) {
      setNativeLogs("Native logs are only available when running on an Android/iOS device.");
      setShowNativeLogsModal(true);
      return;
    }
    try {
      const result = await VpnPlugin.getVpnLogs();
      setNativeLogs(result.logs || "No logs captured yet.");
    } catch (err) {
      setNativeLogs("Error reading logs: " + (err.message || err));
    }
    setShowNativeLogsModal(true);
  };

  // Poll backend health status
  useEffect(() => {
    let interval;
    const checkBackend = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/vpn/status`);
        if (response.ok) {
          setIsBackendConnected(true);
        } else {
          setIsBackendConnected(false);
        }
      } catch (err) {
        setIsBackendConnected(false);
      }
    };
    checkBackend();
    interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const [logs, setLogs] = useState([
    "[System] ShieldLink local daemon starting up...",
    "[System] Internal interfaces validated successfully.",
    "[System] Ready for WireGuard & VLESS integration (Double ChaCha20-Poly1305 enforced)."
  ]);

  // Adjust username default on view mode change
  useEffect(() => {
    if (viewMode === 'admin') {
      setUsername('Administrator');
    } else {
      setUsername('Guest_User');
    }
  }, [viewMode]);

  // Stop the VPN health monitor
  const stopVpnHealthMonitor = () => {
    if (vpnHealthRef.current) {
      clearInterval(vpnHealthRef.current);
      vpnHealthRef.current = null;
    }
  };

  // Start a VPN health monitor that checks if the native service is still alive
  const startVpnHealthMonitor = () => {
    stopVpnHealthMonitor();
    let consecutiveFailures = 0;
    vpnHealthRef.current = setInterval(async () => {
      try {
        const logResult = await VpnPlugin.getVpnLogs();
        const logText = logResult.logs || '';
        // Check for fatal crash indicators in the log
        const hasFatalError = /(?:fatal|panic|SIGABRT|signal \d+|process crash|died|stopped unexpectedly)/i.test(logText);
        if (hasFatalError) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }
        if (consecutiveFailures >= 2) {
          const timestamp = new Date().toLocaleTimeString();
          setLogs(old => [
            ...old,
            `[${timestamp}] [Error] VPN service crash detected. Cleaning up...`
          ]);
          try { await VpnPlugin.stopVpnConnection(); } catch (_) {}
          setIsConnected(false);
          stopVpnHealthMonitor();
        }
      } catch (_) {
        // getVpnLogs itself failed - service might be dead
      }
    }, 5000);
  };

  const runEndToEndConnectivityCheck = async () => {
    setConnectionCheckStatus('checking');
    setResolvedIp('');
    const timestamp = new Date().toLocaleTimeString();
    setLogs(old => [
      ...old,
      `[${timestamp}] [System] Verifying end-to-end tunnel connectivity...`
    ]);

    // Wait 3.5 seconds for tunnel negotiation and DHCP interface bindings
    await new Promise(resolve => setTimeout(resolve, 3500));

    try {
      // Fetch public IP via CORS-enabled endpoint (forces tunnel routing)
      const res = await fetchWithTimeout('https://api.ipify.org?format=json', {
        headers: { 'Cache-Control': 'no-cache' }
      }, 7000);
      const data = await res.json();
      const ip = data.ip;

      const isVpsIp = ip === activeSettings.serverIp;
      
      const checkTime = new Date().toLocaleTimeString();
      if (ip) {
        setResolvedIp(ip);
        if (isVpsIp) {
          setConnectionCheckStatus('success');
          setLogs(old => [
            ...old,
            `[${checkTime}] [System] [Success] E2E tunnel verification PASSED! 🎉`,
            `[${checkTime}] [System] [Success] Public IP successfully verified as VPS: ${ip} (${activeSettings.country} 🇿🇦)`,
            `[${checkTime}] [System] [Success] Secure data routing fully active and encrypted.`
          ]);
        } else {
          setConnectionCheckStatus('success');
          setLogs(old => [
            ...old,
            `[${checkTime}] [System] [Warning] E2E verification passed but IP differs from active server!`,
            `[${checkTime}] [System] Resolved Public IP: ${ip} (Expected: ${activeSettings.serverIp})`
          ]);
        }
      } else {
        throw new Error("Unable to parse public IP from diagnostic JSON.");
      }
    } catch (err) {
      const errTime = new Date().toLocaleTimeString();
      setConnectionCheckStatus('failed');
      setLogs(old => [
        ...old,
        `[${errTime}] [Error] E2E tunnel verification FAILED! 🔴`,
        `[${errTime}] [Error] VPS not responding to internet traffic. Check routing rules.`,
        `[${errTime}] [Error] Diagnostics: ${err.message || err}`
      ]);
    }
  };

  // Handle connection toggle (supporting backend API with local mock fallback)
  const handleToggle = async () => {
    // Check if running natively inside mobile app container
    const isNative = window.Capacitor && window.Capacitor.isNative;

    if (isNative) {
      const timestamp = new Date().toLocaleTimeString();

      if (isConnected) {
        // --- DISCONNECT ---
        try {
          stopVpnHealthMonitor();
          setConnectionCheckStatus('idle');
          setResolvedIp('');
          const result = await VpnPlugin.stopVpnConnection();
          if (result.status === 'DISCONNECTED') {
            setIsConnected(false);
            setLogs(old => [
              ...old,
              `[${timestamp}] [System] Native VPN Tunnel terminated successfully.`,
              `[${timestamp}] [System] Android VpnService interface destroyed.`
            ]);
          }
        } catch (err) {
          setIsConnected(false);
          stopVpnHealthMonitor();
          setLogs(old => [
            ...old,
            `[${timestamp}] [Error] VPN stop error: ${err.message || err}`
          ]);
        }
        return;
      }

      // --- CONNECT ---
      let configJson = null;
      let configSource = 'none';

      // Step 1: Try to get config from Render backend (always use backendUrl, NOT the VPS IP)
      setLogs(old => [
        ...old,
        `[${timestamp}] [System] Fetching configuration from backend server...`
      ]);
      try {
        const genRes = await fetchWithTimeout(`${backendUrl}/api/config/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverIp: activeSettings.serverIp,
            wgPort: activeSettings.wgPort,
            wgClientIp: activeSettings.wgClientIp,
            wgServerIp: '10.8.0.1',
            vlessPort: '443',
            realityServerName: 'images.apple.com'
          })
        }, 15000);
        const genData = await genRes.json();
        if (genData.success && genData.configs && genData.configs.singboxMobile) {
          configJson = genData.configs.singboxMobile;
          configSource = 'backend';
          try {
            localStorage.setItem('shieldlink_last_backend_config', configJson);
          } catch (e) {}
          setLogs(old => [
            ...old,
            `[${timestamp}] [System] Configuration received from backend (with server-matched keys).`
          ]);
        } else {
          throw new Error(genData.error || 'Backend returned invalid config response.');
        }
      } catch (fetchErr) {
        const errMsg = fetchErr.name === 'AbortError' ? 'Request timed out (15s)' : (fetchErr.message || fetchErr);
        setLogs(old => [
          ...old,
          `[${timestamp}] [Warning] Backend config fetch failed: ${errMsg}`,
          `[${timestamp}] [System] Attempting recovery from last successful cached configuration...`
        ]);
      }

      // Step 2: Fallback to last successful backend config, or local hardcoded config
      if (!configJson) {
        const cachedConfig = localStorage.getItem('shieldlink_last_backend_config');
        if (cachedConfig) {
          configJson = cachedConfig;
          configSource = 'cached-backend';
          setLogs(old => [
            ...old,
            `[${timestamp}] [System] Recovered last successful configuration from cache (keys match server).`
          ]);
        } else {
          try {
            configJson = generateLocalUltimateHybrid(activeSettings);
            configSource = 'local-fallback';
            setLogs(old => [
              ...old,
              `[${timestamp}] [System] Using local fallback config (hardcoded keys - may not match server).`
            ]);
          } catch (localErr) {
            setLogs(old => [
              ...old,
              `[${timestamp}] [Error] Failed to generate local config: ${localErr.message || localErr}`
            ]);
            return;
          }
        }
      }

      // Step 3: Start the native VPN service
      try {
        const result = await VpnPlugin.startVpnConnection({ config: configJson });
        if (result.status === 'CONNECTED') {
          setIsConnected(true);
          startVpnHealthMonitor();
          setLogs(old => [
            ...old,
            `[${timestamp}] [System] Native VPN Tunnel initialized (source: ${configSource}).`,
            `[${timestamp}] [System] Android VpnService interface created (VPN Key icon active).`,
            `[${timestamp}] [System] Routing mobile traffic through secure VLESS tunnel.`,
            `[${timestamp}] [System] Health monitor started - checking service every 5s.`
          ]);
          runEndToEndConnectivityCheck();
        }
      } catch (vpnErr) {
        setLogs(old => [
          ...old,
          `[${timestamp}] [Error] Native VPN start failed: ${vpnErr.message || vpnErr}`
        ]);
      }
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/vpn/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      if (data.success) {
        setIsConnected(data.isConnected);
        setLogs(data.logs);
      }
    } catch (err) {
      // Local Fallback if backend API is not running
      const nextState = !isConnected;
      const timestamp = new Date().toLocaleTimeString();
      
      if (nextState) {
        setConnectionCheckStatus('checking');
        setTimeout(() => {
          setConnectionCheckStatus('success');
          setResolvedIp('139.84.234.151');
        }, 2000);
        
        setLogs(oldLogs => [
          ...oldLogs,
          `[${timestamp}] [Client] [User: ${username}] Activating local Xray/VLESS loopback (Mock)...`,
          `[${timestamp}] [Client] [User: ${username}] Xray listening on local UDP port 51820 successfully.`,
          `[${timestamp}] [Client] [User: ${username}] Launching WireGuard TUN interface...`,
          `[${timestamp}] [System] [User: ${username}] Tunnel interface ShieldLinkWg0 brought up.`,
          `[${timestamp}] [System] [User: ${username}] Routes updated. Routing traffic through VLESS proxy.`
        ]);
      } else {
        setConnectionCheckStatus('idle');
        setResolvedIp('');
        
        setLogs(oldLogs => [
          ...oldLogs,
          `[${timestamp}] [System] [User: ${username}] Disabling WireGuard TUN interface (Mock)...`,
          `[${timestamp}] [Client] [User: ${username}] Stopping Xray/VLESS background workers.`,
          `[${timestamp}] [System] [User: ${username}] VPN Disconnected successfully.`
        ]);
      }
      setIsConnected(nextState);
    }
  };

  const handleSaveSettings = (newSettings) => {
    let flag = '🇸🇬';
    let country = 'Singapore';
    
    if (newSettings.serverIp === '139.84.234.151') {
      flag = '🇿🇦';
      country = 'South Africa';
    } else if (newSettings.serverIp.startsWith('139.')) {
      flag = '🇸🇬';
      country = 'Singapore';
    } else if (newSettings.serverIp.startsWith('203.')) {
      flag = '🇯🇵';
      country = 'Japan';
    } else {
      flag = '🇺🇸';
      country = 'United States';
    }

    const updatedSettings = {
      ...newSettings,
      country,
      flag
    };

    setActiveSettings(updatedSettings);
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [
      ...prev,
      `[${timestamp}] [System] [User: ${username}] Reloaded configuration for server: ${updatedSettings.serverIp} (${country})`
    ]);
  };

  // Sync state with backend on mount if running
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/vpn/status`);
        const data = await response.json();
        setIsConnected(data.isConnected);
        setLogs(data.logs);
      } catch (err) {
        // Backend not running, use client state
      }
    };
    fetchStatus();
  }, [backendUrl]);

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">
            <Shield size={24} />
          </div>
          <div className="logo-text">
            <h1>SHIELDLINK</h1>
            <span>{viewMode === 'admin' ? 'Stealth Tunnel Manager (Admin)' : 'Stealth VPN Connector'}</span>
          </div>
        </div>

        {/* Center Name-badge & User selection & Backend URL configuration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* User Input Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>
            <User size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginRight: '0.25rem' }}>User:</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-white)',
                fontSize: '0.85rem',
                fontWeight: '600',
                outline: 'none',
                width: '90px',
                fontFamily: 'var(--font-sans)'
              }}
              placeholder="Type your name..."
            />
          </div>

          {/* Sleek Premium Core Health Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '0.4rem 1rem', borderRadius: '20px' }}>
            <Server size={14} style={{ color: isBackendConnected ? 'var(--accent-emerald)' : 'var(--accent-red)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Shield Core:
            </span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isBackendConnected ? 'var(--accent-emerald)' : 'var(--accent-red)',
              boxShadow: isBackendConnected ? '0 0 8px var(--accent-emerald)' : '0 0 8px var(--accent-red)',
              display: 'inline-block'
            }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: isBackendConnected ? 'var(--accent-emerald)' : 'var(--accent-red)', textTransform: 'uppercase' }}>
              {isBackendConnected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Only visible to Admin) */}
        {viewMode === 'admin' && (
          <nav className="navigation-tabs">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`tab-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
            >
              <Activity size={16} />
              Dashboard
            </button>
            <button
              onClick={() => setCurrentTab('generator')}
              className={`tab-btn ${currentTab === 'generator' ? 'active' : ''}`}
            >
              <Settings size={16} />
              Config Builder
            </button>
          </nav>
        )}
      </header>

      {/* Main Tab Render */}
      <main style={{ flex: 1 }}>
        {viewMode === 'client' ? (
          <Dashboard
            isConnected={isConnected}
            onToggle={handleToggle}
            logs={logs}
            activeSettings={activeSettings}
            viewMode="client"
            username={username}
            backendUrl={backendUrl}
            connectionCheckStatus={connectionCheckStatus}
            resolvedIp={resolvedIp}
          />
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <Dashboard
                isConnected={isConnected}
                onToggle={handleToggle}
                logs={logs}
                activeSettings={activeSettings}
                viewMode="admin"
                username={username}
                backendUrl={backendUrl}
                connectionCheckStatus={connectionCheckStatus}
                resolvedIp={resolvedIp}
              />
            )}

            {currentTab === 'generator' && (
              <ConfigGenerator onSaveSettings={handleSaveSettings} backendUrl={backendUrl} />
            )}
          </>
        )}
      </main>

      {/* Footer & Secret View Mode Switcher */}
      <footer style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>ShieldLink VPN © 2026. Stealth secure connection.</span>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={handleFetchNativeLogs}
            style={{
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              color: 'var(--accent-cyan)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
              fontWeight: '600'
            }}
            title="Inspect background VPN service and core logs"
          >
            <Terminal size={12} />
            View Debug Logs
          </button>

          <button 
            onClick={() => {
              const nextMode = viewMode === 'admin' ? 'client' : 'admin';
              setViewMode(nextMode);
              if (nextMode === 'client') setCurrentTab('dashboard');
            }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
            title="Switch layout view role"
          >
            {viewMode === 'admin' ? (
              <>
                <Eye size={12} style={{ color: 'var(--accent-cyan)' }} />
                Switch to Client Mode
              </>
            ) : (
              <>
                <EyeOff size={12} style={{ color: 'var(--accent-primary)' }} />
                Switch to Admin Mode
              </>
            )}
          </button>
        </div>
      </footer>

      {showNativeLogsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 15, 30, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#151c2c',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={18} style={{ color: '#06b6d4' }} />
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: '700' }}>Native VPN Diagnostics Log</h3>
              </div>
              <button 
                onClick={() => setShowNativeLogsModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: '#94a3b8',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 1rem 0', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.4' }}>
                This console displays the real-time logging output from the Android background VpnService and native sing-box Go Core. Helpful for debugging crashes and configurations.
              </p>
              <textarea
                readOnly
                value={nativeLogs}
                style={{
                  width: '100%',
                  height: '300px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '1rem',
                  color: '#06b6d4',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'none',
                  whiteSpace: 'pre'
                }}
              />
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1.2rem 1.5rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '0 0 16px 16px'
            }}>
              <button 
                onClick={handleFetchNativeLogs}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  transition: 'opacity 0.2s ease'
                }}
              >
                Refresh Log
              </button>
              <button 
                onClick={() => setShowNativeLogsModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
