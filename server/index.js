const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Simulation of server status and logs for visualization
let isConnected = false;
let activeConfig = null;
const debugLogs = [
  "[System] ShieldLink local daemon starting up...",
  "[System] Internal interfaces validated successfully.",
  "[System] Ready for WireGuard & VLESS integration."
];

// Endpoint to generate configurations
app.post('/api/config/generate', (req, res) => {
  const {
    serverIp = '203.0.113.50',
    wgPort = 51820,
    wgClientIp = '10.8.0.2',
    wgServerIp = '10.8.0.1',
    vlessUuid = '7d292850-8b1b-4f91-8854-3e9a7e6b8401',
    vlessPort = 443,
    realityDest = 'www.microsoft.com',
    realityServerName = 'www.microsoft.com',
    publicKey = 'SERVER_REALITY_PUBLIC_KEY',
    privateKey = 'SERVER_REALITY_PRIVATE_KEY',
    shortId = '12345678abcdef'
  } = req.body;

  // 1. Client WireGuard configuration (connecting to local port instead of VPS endpoint)
  const clientWg = `[Interface]
PrivateKey = CLIENT_WIREGUARD_PRIVATE_KEY_HERE
Address = ${wgClientIp}/24
DNS = 1.1.1.1, 8.8.8.8
MTU = 1360

[Peer]
PublicKey = SERVER_WIREGUARD_PUBLIC_KEY_HERE
Endpoint = 127.0.0.1:${wgPort}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`;

  // 2. Client Xray Configuration (routes WG UDP packets through VLESS)
  const clientXray = {
    "log": {
      "loglevel": "warning"
    },
    "inbounds": [
      {
        "port": wgPort,
        "listen": "127.0.0.1",
        "protocol": "dokodemo-door",
        "settings": {
          "address": "127.0.0.1",
          "port": wgPort,
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
              "address": serverIp,
              "port": vlessPort,
              "users": [
                {
                  "id": vlessUuid,
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
            "dest": `${realityDest}:443`,
            "serverNames": [realityServerName],
            "publicKey": publicKey,
            "shortId": shortId,
            "spiderX": "/"
          }
        },
        "tag": "vless-out"
      },
      {
        "protocol": "freedom",
        "tag": "direct"
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

  // 3. Server VPS Xray Configuration
  const serverXray = {
    "log": {
      "loglevel": "warning"
    },
    "inbounds": [
      {
        "port": vlessPort,
        "protocol": "vless",
        "settings": {
          "clients": [
            {
              "id": vlessUuid,
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
            "dest": `${realityDest}:443`,
            "xver": 0,
            "serverNames": [realityServerName],
            "privateKey": privateKey,
            "shortIds": [shortId]
          }
        },
        "tag": "vless-in"
      }
    ],
    "outbounds": [
      {
        "protocol": "dokodemo-door",
        "settings": {
          "address": "127.0.0.1",
          "port": wgPort,
          "network": "udp"
        },
        "tag": "wg-out"
      }
    ]
  };

  // 4. Server WireGuard configuration (server.conf)
  const serverWg = `[Interface]
Address = ${wgServerIp}/24
ListenPort = ${wgPort}
PrivateKey = SERVER_WIREGUARD_PRIVATE_KEY_HERE
MTU = 1360

# Add firewall forwarding scripts to allow clients outbound web access
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = CLIENT_WIREGUARD_PUBLIC_KEY_HERE
AllowedIPs = ${wgClientIp}/32`;

  // 5. Automated Setup Bash Script for remote VPS
  const serverSetupScript = `#!/bin/bash
# ShieldLink - Automated Server WireGuard over VLESS installation
# For Debian/Ubuntu OS

set -e

echo "=== ShieldLink Server Auto-installer ==="
echo "1. Installing WireGuard and dependencies..."
apt-get update
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

  return res.json({
    success: true,
    configs: {
      clientWg,
      clientXray: JSON.stringify(clientXray, null, 2),
      serverWg,
      serverXray: JSON.stringify(serverXray, null, 2),
      serverSetupScript
    }
  });
});

// Endpoint to manage VPN mock state
app.get('/api/vpn/status', (req, res) => {
  return res.json({
    isConnected,
    logs: debugLogs
  });
});

app.post('/api/vpn/toggle', (req, res) => {
  isConnected = !isConnected;
  
  const timestamp = new Date().toLocaleTimeString();
  if (isConnected) {
    debugLogs.push(`[${timestamp}] [Client] Activating local Xray/VLESS loopback...`);
    debugLogs.push(`[${timestamp}] [Client] Xray listening on local port 51820 successfully.`);
    debugLogs.push(`[${timestamp}] [Client] Launching WireGuard TUN interface...`);
    debugLogs.push(`[${timestamp}] [System] Tunnel interface ShieldLinkWg0 brought up.`);
    debugLogs.push(`[${timestamp}] [System] Routes updated. Sending all traffic through secure VLESS tunnel.`);
  } else {
    debugLogs.push(`[${timestamp}] [System] Disabling WireGuard TUN interface...`);
    debugLogs.push(`[${timestamp}] [Client] Stopping Xray/VLESS background workers.`);
    debugLogs.push(`[${timestamp}] [System] VPN Disconnected successfully.`);
  }

  return res.json({
    success: true,
    isConnected,
    logs: debugLogs
  });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
