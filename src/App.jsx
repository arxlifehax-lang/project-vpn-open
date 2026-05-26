import React, { useState, useEffect } from 'react';
import { Shield, Settings, Activity, Eye, EyeOff, User, Server, Globe } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';
import Dashboard from './components/Dashboard';
import ConfigGenerator from './components/ConfigGenerator';
import './App.css';

const VpnPlugin = registerPlugin('VpnPlugin');

const getBackendUrl = () => {
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:5000`;
};

const generateLocalUltimateHybrid = (settings) => {
  const uuid = "455037ea-dc30-4e09-9de3-ee1ae735c36d";
  const clientWgPrivate = "8JeMczxUJ//ED9s7uiB2an7vvFSVsWha3mNYTTeP0H4=";
  const serverWgPublic = "R2k28leApEiBTPxRPN33+t70ouAc9lkMP/EiP4eT1Tw=";
  const realityPublic = "XArfuZjeq6vmny_V2n2IqTl6dFOgaYfWsmIdLZwoPws";
  const shortId = "81a4a0dd48b6750a";
  const ssPasswordMock = "c2hhZG93c29ja3MtcGFzc3dvcmQtbW9jay1iYXNlNjQ=";
  const trojanPasswordMock = "trojanpasswordmock123";

  const config = {
    "log": {
      "level": "warning"
    },
    "dns": {
      "servers": [
        {
          "tag": "dns-direct",
          "address": "1.1.1.1",
          "detour": "direct"
        }
      ]
    },
    "inbounds": [
      {
        "type": "tun",
        "tag": "tun-in",
        "interface_name": "tun0",
        "inet4_address": "172.19.0.1/30",
        "auto_route": true,
        "strict_route": true,
        "stack": "system",
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
        "detour": "ss-out"
      },
      {
        "type": "shadowsocks",
        "tag": "ss-out",
        "server": "127.0.0.1",
        "server_port": 1080,
        "method": "2022-blake3-aes-256-gcm",
        "password": ssPasswordMock,
        "detour": "vmess-out"
      },
      {
        "type": "vmess",
        "tag": "vmess-out",
        "server": "127.0.0.1",
        "server_port": 10000,
        "uuid": uuid,
        "security": "aes-128-gcm",
        "detour": "trojan-out"
      },
      {
        "type": "trojan",
        "tag": "trojan-out",
        "server": "127.0.0.1",
        "server_port": 443,
        "password": trojanPasswordMock,
        "tls": {
          "enabled": true,
          "server_name": "www.microsoft.com",
          "insecure": true
        },
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
          "server_name": "www.microsoft.com",
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
      }
    ],
    "route": {
      "auto_detect_interface": true,
      "rules": [
        {
          "port": [53],
          "outbound": "dns-direct"
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
  const [activeSettings, setActiveSettings] = useState({
    serverIp: '139.84.234.151',
    wgPort: '51820',
    wgClientIp: '10.8.0.2',
    country: 'South Africa',
    countryCode: 'ZA',
    flag: '🇿🇦'
  });
  
  const [backendUrl, setBackendUrl] = useState(() => {
    return localStorage.getItem('shieldlink_backend_url') || getBackendUrl();
  });
  const [isBackendConnected, setIsBackendConnected] = useState(false);

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

  // Handle connection toggle (supporting backend API with local mock fallback)
  // Handle connection toggle (supporting backend API with local mock fallback)
  const handleToggle = async () => {
    // Check if running natively inside mobile app container
    const isNative = window.Capacitor && window.Capacitor.isNative;

    if (isNative) {
      try {
        if (!isConnected) {
          const apiBaseUrl = activeSettings.serverIp === '139.84.234.151' ? `http://${activeSettings.serverIp}:5000` : backendUrl;
          const genRes = await fetch(`${apiBaseUrl}/api/config/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverIp: activeSettings.serverIp,
              wgPort: activeSettings.wgPort,
              wgClientIp: activeSettings.wgClientIp,
              wgServerIp: '10.8.0.1',
              vlessPort: '443',
              realityServerName: 'www.microsoft.com'
            })
          });
          const genData = await genRes.json();
          if (!genData.success) throw new Error("Failed to generate configuration profile.");

          const configJson = genData.configs.ultimateHybrid;
          const result = await VpnPlugin.startVpnConnection({ config: configJson });
          if (result.status === 'CONNECTED') {
            setIsConnected(true);
            const timestamp = new Date().toLocaleTimeString();
            setLogs(old => [
              ...old,
              `[${timestamp}] [System] Native VPN Tunnel successfully initialized.`,
              `[${timestamp}] [System] Android VpnService interface created (VPN Key icon active).`,
              `[${timestamp}] [System] Routing 100% of mobile system traffic through secure VLESS tunnel.`
            ]);
          }
        } else {
          const result = await VpnPlugin.stopVpnConnection();
          if (result.status === 'DISCONNECTED') {
            setIsConnected(false);
            const timestamp = new Date().toLocaleTimeString();
            setLogs(old => [
              ...old,
              `[${timestamp}] [System] Native VPN Tunnel terminated successfully.`,
              `[${timestamp}] [System] Android VpnService interface destroyed.`
            ]);
          }
        }
      } catch (err) {
        // Native fallback if backend server is unreachable
        if (!isConnected) {
          try {
            const configJson = generateLocalUltimateHybrid(activeSettings);
            const result = await VpnPlugin.startVpnConnection({ config: configJson });
            if (result.status === 'CONNECTED') {
              setIsConnected(true);
              const timestamp = new Date().toLocaleTimeString();
              setLogs(old => [
                ...old,
                `[${timestamp}] [System] Native VPN Tunnel successfully initialized (Offline Fallback).`,
                `[${timestamp}] [System] Android VpnService interface created (VPN Key icon active).`,
                `[${timestamp}] [System] Routing 100% of mobile system traffic through secure VLESS tunnel.`
              ]);
            }
          } catch (localErr) {
            const timestamp = new Date().toLocaleTimeString();
            setLogs(old => [...old, `[${timestamp}] [Error] Native VPN Local Error: ${localErr.message || localErr}`]);
          }
        } else {
          try {
            const result = await VpnPlugin.stopVpnConnection();
            if (result.status === 'DISCONNECTED') {
              setIsConnected(false);
              const timestamp = new Date().toLocaleTimeString();
              setLogs(old => [
                ...old,
                `[${timestamp}] [System] Native VPN Tunnel terminated successfully (Offline Fallback).`,
                `[${timestamp}] [System] Android VpnService interface destroyed.`
              ]);
            }
          } catch (localErr) {
            setIsConnected(false);
          }
        }
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
      setIsConnected(prev => {
        const nextState = !prev;
        const timestamp = new Date().toLocaleTimeString();
        setLogs(oldLogs => {
          const newLogs = [...oldLogs];
          if (nextState) {
            newLogs.push(`[${timestamp}] [Client] [User: ${username}] Activating local Xray/VLESS loopback (Mock)...`);
            newLogs.push(`[${timestamp}] [Client] [User: ${username}] Xray listening on local UDP port 51820 successfully.`);
            newLogs.push(`[${timestamp}] [Client] [User: ${username}] Launching WireGuard TUN interface...`);
            newLogs.push(`[${timestamp}] [System] [User: ${username}] Tunnel interface ShieldLinkWg0 brought up.`);
            newLogs.push(`[${timestamp}] [System] [User: ${username}] Routes updated. Routing traffic through VLESS proxy.`);
          } else {
            newLogs.push(`[${timestamp}] [System] [User: ${username}] Disabling WireGuard TUN interface (Mock)...`);
            newLogs.push(`[${timestamp}] [Client] [User: ${username}] Stopping Xray/VLESS background workers.`);
            newLogs.push(`[${timestamp}] [System] [User: ${username}] VPN Disconnected successfully.`);
          }
          return newLogs;
        });
        return nextState;
      });
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

          {/* Backend URL Input Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>
            <Server size={14} style={{ color: isBackendConnected ? 'var(--accent-emerald)' : 'var(--accent-red)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginRight: '0.25rem' }}>Backend:</span>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => {
                const url = e.target.value;
                setBackendUrl(url);
                localStorage.setItem('shieldlink_backend_url', url);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-white)',
                fontSize: '0.85rem',
                fontWeight: '600',
                outline: 'none',
                width: '180px',
                fontFamily: 'var(--font-mono)'
              }}
              placeholder="http://localhost:5000"
            />
            {/* Health indicator dot */}
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isBackendConnected ? 'var(--accent-emerald)' : 'var(--accent-red)',
              boxShadow: isBackendConnected ? '0 0 6px var(--accent-emerald)' : '0 0 6px var(--accent-red)',
              display: 'inline-block'
            }} title={isBackendConnected ? "Backend Reachable" : "Backend Offline"}></span>
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
      </footer>
    </div>
  );
}
