import React from 'react';

export default function TunnelVisual({ isConnected }) {
  return (
    <div className="visualizer-container">
      <svg className="svg-tunnel" viewBox="0 0 500 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Connection Paths */}
        <path
          id="network-path"
          d="M 50 75 L 140 75 L 250 75 L 360 75 L 450 75"
          className={`svg-line ${isConnected ? 'active' : ''}`}
        />

        {/* Local Node: Client Device */}
        <circle cx="50" cy="75" r="22" className={`svg-node ${isConnected ? 'active' : ''}`} />
        <g transform="translate(37, 62)">
          {/* Laptop SVG Icon */}
          <path
            d="M5 2h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm-3 13h22v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1z"
            stroke={isConnected ? '#06b6d4' : '#64748b'}
            strokeWidth="1.5"
            fill="none"
          />
        </g>
        <text x="50" y="115" className={`svg-text ${isConnected ? 'active' : ''}`}>Client Apps</text>

        {/* WireGuard TUN Node */}
        <circle cx="140" cy="75" r="22" className={`svg-node ${isConnected ? 'active' : ''}`} />
        <g transform="translate(128, 63)">
          {/* Padlock Icon representing WireGuard */}
          <rect
            x="2"
            y="6"
            width="19"
            height="14"
            rx="2"
            stroke={isConnected ? '#6366f1' : '#64748b'}
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M6 6V4a4 4 0 0 1 8 0v2"
            stroke={isConnected ? '#6366f1' : '#64748b'}
            strokeWidth="1.5"
            fill="none"
          />
        </g>
        <text x="140" y="115" className={`svg-text ${isConnected ? 'active' : ''}`}>WireGuard TUN</text>

        {/* Xray VLESS + Reality Tunnel Wrapper */}
        <g transform="translate(195, 30)">
          <rect
            x="0"
            y="0"
            width="110"
            height="90"
            rx="12"
            fill="rgba(0,0,0,0.15)"
            stroke={isConnected ? 'url(#glow-gradient)' : 'rgba(255,255,255,0.06)'}
            strokeWidth="1.5"
            strokeDasharray={isConnected ? '0' : '4 4'}
          />
          <text x="55" y="18" fill={isConnected ? '#06b6d4' : '#64748b'} fontSize="8" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">
            XRAY VLESS (Reality)
          </text>
        </g>

        {/* Firewall DPI Gateway (In the middle of the tunnel) */}
        <circle cx="250" cy="75" r="16" className="svg-node" style={{ fill: 'rgba(0,0,0,0.4)', stroke: isConnected ? '#10b981' : '#ef4444' }} />
        <g transform="translate(242, 67)">
          {/* Shield / Firewall Icon */}
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke={isConnected ? '#10b981' : '#ef4444'}
            strokeWidth="1.5"
            fill="none"
          />
        </g>
        <text x="250" y="115" className={`svg-text ${isConnected ? 'active' : ''}`}>
          {isConnected ? 'Bypassed' : 'Firewall'}
        </text>

        {/* Server VPS Node */}
        <circle cx="360" cy="75" r="22" className={`svg-node ${isConnected ? 'active' : ''}`} />
        <g transform="translate(348, 63)">
          {/* Server / Cloud Icon */}
          <path
            d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"
            stroke={isConnected ? '#6366f1' : '#64748b'}
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M8 16h.01M12 16h.01M16 16h.01" stroke={isConnected ? '#6366f1' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
        </g>
        <text x="360" y="115" className={`svg-text ${isConnected ? 'active' : ''}`}>Server (VPS)</text>

        {/* Internet Outgress Node */}
        <circle cx="450" cy="75" r="22" className={`svg-node ${isConnected ? 'active' : ''}`} />
        <g transform="translate(438, 63)">
          {/* Globe Icon */}
          <circle cx="12" cy="12" r="10" stroke={isConnected ? '#10b981' : '#64748b'} strokeWidth="1.5" fill="none" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={isConnected ? '#10b981' : '#64748b'} strokeWidth="1.5" fill="none" />
        </g>
        <text x="450" y="115" className={`svg-text ${isConnected ? 'active' : ''}`}>Web / Egress</text>

        {/* Animated Particles flowing along the path */}
        {isConnected && (
          <>
            <circle r="4" fill="#06b6d4" className="particle">
              <animateMotion dur="3s" repeatCount="indefinite" path="M 50 75 L 140 75" />
            </circle>
            <circle r="3" fill="#6366f1" className="particle">
              <animateMotion dur="4s" repeatCount="indefinite" path="M 140 75 L 360 75" />
            </circle>
            <circle r="4" fill="#10b981" className="particle">
              <animateMotion dur="3s" repeatCount="indefinite" path="M 360 75 L 450 75" />
            </circle>
          </>
        )}

        {/* Gradients */}
        <defs>
          <linearGradient id="glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
