import React from 'react';
import { Terminal, Shield, Laptop, Server, Play, ExternalLink } from 'lucide-react';

export default function SetupGuide() {
  return (
    <div className="glass-panel guide-container">
      <div className="panel-header">
        <h2>
          <Server size={20} style={{ color: 'var(--accent-cyan)' }} />
          Step-by-Step Server & Client Deployment Guide
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Step 1 */}
        <div className="guide-step">
          <div className="step-num">1</div>
          <div className="step-content">
            <h3>Get a Debian or Ubuntu VPS</h3>
            <p>
              Purchase a Virtual Private Server (VPS) from providers like DigitalOcean, AWS, Vultr, or Linode. 
              Ensure it runs **Ubuntu 20.04+** or **Debian 11+** with a public IPv4 address.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="guide-step">
          <div className="step-num">2</div>
          <div className="step-content">
            <h3>Install Server Infrastructure</h3>
            <p>
              SSH into your VPS as root, copy the **VPS Installer (.sh)** script from the <strong>Config Builder</strong> tab, 
              save it to a file, make it executable, and run it:
            </p>
            <div className="step-code">
              # ssh root@your_vps_ip<br />
              nano setup.sh &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;# Paste the script from the builder<br />
              chmod +x setup.sh<br />
              ./setup.sh
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '0.25rem' }}>
              * This will install WireGuard, install Xray-core release, set up local routes, and configure iptables NAT forwarding.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="guide-step">
          <div className="step-num">3</div>
          <div className="step-content">
            <h3>Download Xray-core Client (Windows)</h3>
            <p>
              Download the official Windows release of Xray-core from GitHub releases:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <a 
                href="https://github.com/XTLS/Xray-core/releases" 
                target="_blank" 
                rel="noreferrer" 
                className="submit-btn" 
                style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)' }}
              >
                Xray-core Releases <ExternalLink size={12} />
              </a>
            </div>
            <p style={{ marginTop: '0.5rem' }}>
              Extract the zip file to a folder (e.g. <code>C:\Xray\</code>), then save the **Client Xray (config.json)** into the exact same folder. Run the client via PowerShell:
            </p>
            <div className="step-code">
              cd C:\Xray\<br />
              .\xray.exe run -config config.json
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="guide-step">
          <div className="step-num">4</div>
          <div className="step-content">
            <h3>Configure WireGuard Client</h3>
            <p>
              Install the official Windows WireGuard client:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <a 
                href="https://www.wireguard.com/install/" 
                target="_blank" 
                rel="noreferrer" 
                className="submit-btn" 
                style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)' }}
              >
                WireGuard Installer <ExternalLink size={12} />
              </a>
            </div>
            <p style={{ marginTop: '0.5rem' }}>
              Open WireGuard, click <strong>"Add Tunnel" (or "Add empty tunnel...")</strong>, and paste the **Client WG (client.conf)** from the builder.
              Be sure to fill in your local private key and the server's public key generated during server install!
            </p>
          </div>
        </div>

        {/* Step 5 */}
        <div className="guide-step">
          <div className="step-num">5</div>
          <div className="step-content">
            <h3>Activate the Tunnels</h3>
            <p>
              Order of activation is crucial:
            </p>
            <ol style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              <li>Ensure <strong>Xray Client</strong> is running in PowerShell (it opens a local UDP port mapping 127.0.0.1).</li>
              <li>Click <strong>"Activate"</strong> on the WireGuard Client.</li>
              <li>WireGuard will establish connection over local Xray loopback, masking traffic instantly as VLESS HTTPS TLS traffic!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
