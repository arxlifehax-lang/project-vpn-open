const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection ready!');
  
  // Run status commands on VPS
  conn.exec('echo "=== System Status ===" && uname -a && echo "=== Xray Status ===" && systemctl status xray --no-pager && echo "=== WireGuard Status ===" && systemctl status wg-quick@wg0 --no-pager && echo "=== Network Interfaces ===" && ip a && echo "=== Listening Ports ===" && ss -tulpn && echo "=== Xray Config ===" && cat /usr/local/etc/xray/config.json && echo "=== WireGuard Config ===" && cat /etc/wireguard/wg0.conf', (err, stream) => {
    if (err) {
      console.error('Error executing commands:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`Command stream closed with code ${code}`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection error:', err);
}).connect({
  host: '139.84.234.151',
  port: 22,
  username: 'root',
  password: 'x(F3#=}w8L=bpLEK',
  readyTimeout: 20000
});
