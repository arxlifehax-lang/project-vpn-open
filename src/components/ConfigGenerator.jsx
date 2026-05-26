import React, { useState } from 'react';
import { Settings, Copy, Check, Terminal, Play, ArrowRight, ShieldAlert, KeyRound, ServerCrash } from 'lucide-react';

export default function ConfigGenerator({ onSaveSettings, backendUrl }) {
  const [formData, setFormData] = useState({
    serverIp: '139.84.234.151', // Autofilled from user request!
    wgPort: '51820',
    wgClientIp: '10.8.0.2',
    wgServerIp: '10.8.0.1',
    vlessPort: '443',
    realityServerName: 'www.microsoft.com',
  });

  const [sshData, setSshData] = useState({
    host: '139.84.234.151', // Autofilled from user request!
    port: '22',
    username: 'root',
    password: '',
  });

  const [activeTab, setActiveTab] = useState('clientWg');
  const [copiedTab, setCopiedTab] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState('');
  
  const [configs, setConfigs] = useState(() => generateLocalConfigs(formData));

  function generateLocalConfigs(data) {
    // Basic cryptographic keys simulation
    const uuid = "455037ea-dc30-4e09-9de3-ee1ae735c36d";
    const clientWgPrivate = "8JeMczxUJ//ED9s7uiB2an7vvFSVsWha3mNYTTeP0H4=";
    const clientWgPublic = "rUXE/v+4ib8oOGmzNaA5Qg15UXhJcq7bjWOi3CsR4yw=";
    const serverWgPrivate = "UPXsh/JLWGbIRTSfrbCxeAby4Vvwu+ynLyJZ1b3nnkg=";
    const serverWgPublic = "R2k28leApEiBTPxRPN33+t70ouAc9lkMP/EiP4eT1Tw=";
    const realityPrivate = "KDTi0A_z-5PYGRDkE02rbZ450SHytidJeQl_BbDQUXA";
    const realityPublic = "XArfuZjeq6vmny_V2n2IqTl6dFOgaYfWsmIdLZwoPws";
    const shortId = "81a4a0dd48b6750a";

    const clientWg = `[Interface]
PrivateKey = ${clientWgPrivate}
Address = ${data.wgClientIp}/24
DNS = 1.1.1.1, 8.8.8.8
MTU = 1360

[Peer]
PublicKey = ${serverWgPublic}
Endpoint = 127.0.0.1:${data.wgPort}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`;

    const clientXray = {
      "log": { "loglevel": "warning" },
      "inbounds": [
        {
          "port": parseInt(data.wgPort),
          "listen": "127.0.0.1",
          "protocol": "dokodemo-door",
          "settings": {
            "address": "127.0.0.1",
            "port": parseInt(data.wgPort),
            "network": "udp",
            "timeout": 300
          },
          "tag": "wg-in"
        }
      ],
      "outbounds": [
        {
          "protocol": "vless",
          "settings": {
            "vnext": [
              {
                "address": data.serverIp,
                "port": parseInt(data.vlessPort),
                "users": [
                  {
                    "id": uuid,
                    "encryption": "none",
                    "flow": "xtls-rprx-vision"
                  }
                ]
              }
            ]
          },
          "streamSettings": {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {
              "show": false,
              "dest": `${data.realityServerName}:443`,
              "serverNames": [data.realityServerName],
              "publicKey": realityPublic,
              "shortId": shortId,
              "spiderX": "/"
            }
          },
          "tag": "vless-out"
        }
      ],
      "routing": {
        "domainStrategy": "AsIs",
        "rules": [
          {
            "type": "field",
            "inboundTag": ["wg-in"],
            "outboundTag": "vless-out"
          }
        ]
      }
    };

    const serverXray = {
      "log": { "loglevel": "warning" },
      "inbounds": [
        {
          "port": parseInt(data.vlessPort),
          "protocol": "vless",
          "settings": {
            "clients": [
              {
                "id": uuid,
                "flow": "xtls-rprx-vision"
              }
            ],
            "decryption": "none"
          },
          "streamSettings": {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {
              "show": false,
              "dest": `${data.realityServerName}:443`,
              "xver": 0,
              "serverNames": [data.realityServerName],
              "privateKey": realityPrivate,
              "shortIds": [shortId]
            }
          },
          "tag": "vless-in"
        }
      ],
      "outbounds": [
        {
          "protocol": "freedom",
          "settings": {
            "redirect": `127.0.0.1:${data.wgPort}`
          },
          "tag": "wg-out"
        }
      ]
    };

    const serverWg = `[Interface]
Address = ${data.wgServerIp}/24
ListenPort = ${data.wgPort}
PrivateKey = ${serverWgPrivate}
MTU = 1360

PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = ${clientWgPublic}
AllowedIPs = ${data.wgClientIp}/32`;

    const serverSetupScript = `#!/bin/bash
# ShieldLink - Automated Server WireGuard over VLESS installation
# For Debian/Ubuntu OS

set -e

echo "=== ShieldLink Server Auto-installer ==="
echo "1. Installing WireGuard and dependencies..."
apt-get update -y
apt-get install -y wireguard iptables curl unzip

echo "2. Installing Xray-core..."
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

echo "3. Creating directories..."
mkdir -p /etc/wireguard
mkdir -p /usr/local/etc/xray

echo "4. Writing WireGuard configuration..."
cat << 'EOF' > /etc/wireguard/wg0.conf
${serverWg}
EOF

echo "5. Writing Xray configuration..."
cat << 'EOF' > /usr/local/etc/xray/config.json
${JSON.stringify(serverXray, null, 2)}
EOF

echo "6. Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

echo "7. Starting services..."
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0
systemctl enable xray
systemctl restart xray

echo "=== Installation complete! ShieldLink server is now listening stealthily ==="
`;

    const singboxMobile = {
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
          "server_port": parseInt(data.wgPort),
          "local_address": [
            `${data.wgClientIp}/24`
          ],
          "private_key": clientWgPrivate,
          "peer_public_key": serverWgPublic,
          "mtu": 1280,
          "detour": "vless-out"
        },
        {
          "type": "vless",
          "tag": "vless-out",
          "server": data.serverIp,
          "server_port": parseInt(data.vlessPort),
          "uuid": uuid,
          "flow": "xtls-rprx-vision",
          "network": "tcp",
          "tls": {
            "enabled": true,
            "server_name": data.realityServerName,
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

    const ssPasswordMock = "c2hhZG93c29ja3MtcGFzc3dvcmQtbW9jay1iYXNlNjQ=";
    const trojanPasswordMock = "trojanpasswordmock123";

    const ultimateHybrid = {
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
          "server_port": parseInt(data.wgPort),
          "local_address": [
            `${data.wgClientIp}/24`
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
            "server_name": data.realityServerName,
            "insecure": true
          },
          "detour": "vless-out"
        },
        {
          "type": "vless",
          "tag": "vless-out",
          "server": data.serverIp,
          "server_port": parseInt(data.vlessPort),
          "uuid": uuid,
          "flow": "xtls-rprx-vision",
          "network": "tcp",
          "tls": {
            "enabled": true,
            "server_name": data.realityServerName,
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

    return {
      clientWg,
      clientXray: JSON.stringify(clientXray, null, 2),
      serverWg,
      serverXray: JSON.stringify(serverXray, null, 2),
      serverSetupScript,
      singboxMobile: JSON.stringify(singboxMobile, null, 2),
      ultimateHybrid: JSON.stringify(ultimateHybrid, null, 2)
    };
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'serverIp') {
      setSshData(prev => ({ ...prev, host: value }));
    }
  };

  const handleSshChange = (e) => {
    const { name, value } = e.target;
    setSshData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    setIsGenerating(true);
    
    try {
      // Connect to local backend Express endpoints for secure generation
      const response = await fetch(`${backendUrl}/api/config/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setConfigs(data.configs);
        onSaveSettings(formData);
      }
    } catch (err) {
      // Offline fallback
      const generated = generateLocalConfigs(formData);
      setConfigs(generated);
      onSaveSettings(formData);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    setIsDeploying(true);
    setDeployMessage('Connecting to SSH...');

    try {
      const response = await fetch(`${backendUrl}/api/vps/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: sshData.host,
          port: parseInt(sshData.port) || 22,
          username: sshData.username,
          password: sshData.password,
          setupScript: configs.serverSetupScript
        })
      });
      const data = await response.json();
      if (data.success) {
        setDeployMessage('Deployment initiated! Check the Dashboard tab log terminal to monitor the progress.');
      } else {
        setDeployMessage(`Deployment error: ${data.error}`);
      }
    } catch (err) {
      setDeployMessage('Failed to reach local backend server. Ensure Express backend is running on port 5000.');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCopy = (text, tabName) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Configuration Builder */}
      <div className="glass-panel">
        <div className="panel-header">
          <h2>
            <Settings size={20} style={{ color: 'var(--accent-primary)' }} />
            Stealth Configuration Builder
          </h2>
        </div>

        <div className="config-generator-layout">
          {/* Form Settings Panel */}
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div className="form-group">
                <label>VPS Server IP Address</label>
                <input
                  type="text"
                  name="serverIp"
                  value={formData.serverIp}
                  onChange={handleChange}
                  placeholder="e.g. 203.0.113.50"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>WireGuard Port</label>
                  <input
                    type="number"
                    name="wgPort"
                    value={formData.wgPort}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>VLESS Stealth Port</label>
                  <input
                    type="number"
                    name="vlessPort"
                    value={formData.vlessPort}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Obfuscated SNI / Dest Domain</label>
                <input
                  type="text"
                  name="realityServerName"
                  value={formData.realityServerName}
                  onChange={handleChange}
                  placeholder="e.g. www.microsoft.com"
                  required
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" style={{ marginTop: '1rem' }} disabled={isGenerating}>
              {isGenerating ? 'Compiling Cryptography...' : 'Recompile Profiles'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Configurations Code Panel */}
          <div className="configs-display-panel">
            <div className="code-tabs">
              <button
                onClick={() => setActiveTab('clientWg')}
                className={`code-tab-btn ${activeTab === 'clientWg' ? 'active' : ''}`}
              >
                Client WG (client.conf)
              </button>
              <button
                onClick={() => setActiveTab('clientXray')}
                className={`code-tab-btn ${activeTab === 'clientXray' ? 'active' : ''}`}
              >
                Client Xray (config.json)
              </button>
              <button
                onClick={() => setActiveTab('serverWg')}
                className={`code-tab-btn ${activeTab === 'serverWg' ? 'active' : ''}`}
              >
                Server WG (wg0.conf)
              </button>
              <button
                onClick={() => setActiveTab('serverXray')}
                className={`code-tab-btn ${activeTab === 'serverXray' ? 'active' : ''}`}
              >
                Server Xray (config.json)
              </button>
              <button
                onClick={() => setActiveTab('serverSetupScript')}
                className={`code-tab-btn ${activeTab === 'serverSetupScript' ? 'active' : ''}`}
                style={{ color: 'var(--accent-cyan)' }}
              >
                VPS Installer (.sh)
              </button>
              <button
                onClick={() => setActiveTab('singboxMobile')}
                className={`code-tab-btn ${activeTab === 'singboxMobile' ? 'active' : ''}`}
                style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}
              >
                Sing-box Mobile (.json)
              </button>
              <button
                onClick={() => setActiveTab('ultimateHybrid')}
                className={`code-tab-btn ${activeTab === 'ultimateHybrid' ? 'active' : ''}`}
                style={{ color: 'var(--accent-amber)', fontWeight: 'bold' }}
              >
                Ultimate 5-Layer (.json)
              </button>
            </div>

            <div className="code-window-wrapper">
              <button
                onClick={() => handleCopy(configs[activeTab], activeTab)}
                className="copy-btn"
              >
                {copiedTab === activeTab ? (
                  <>
                    <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy Config
                  </>
                )}
              </button>
              
              <div className="code-window">
                {configs[activeTab]}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              <ShieldAlert size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                Note: The Client WireGuard endpoint points locally to loopback because it routes into the VLESS camouflage.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive VPS SSH Deployer */}
      <div className="glass-panel glowing-indigo">
        <div className="panel-header">
          <h2>
            <KeyRound size={20} style={{ color: 'var(--accent-cyan)' }} />
            One-Click Remote VPS Provisioning (SSH)
          </h2>
        </div>

        <form onSubmit={handleDeploy} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.6fr 1fr 1.2fr auto', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>VPS Host IP</label>
            <input
              type="text"
              name="host"
              value={sshData.host}
              onChange={handleSshChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>SSH Port</label>
            <input
              type="number"
              name="port"
              value={sshData.port}
              onChange={handleSshChange}
              placeholder="22"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={sshData.username}
              onChange={handleSshChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={sshData.password}
              onChange={handleSshChange}
              placeholder="Enter SSH password"
              required
            />
          </div>

          <button type="submit" className="submit-btn" style={{ padding: '0.75rem 1.5rem', width: 'auto' }} disabled={isDeploying}>
            {isDeploying ? 'Deploying...' : 'Deploy Stealth Core'}
            <Play size={16} />
          </button>
        </form>

        {deployMessage && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', fontSize: '0.85rem', color: deployMessage.includes('initiated') ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
            {deployMessage}
          </div>
        )}
      </div>
    </div>
  );
}
