const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection ready!');
  
  // Run check commands on VPS
  conn.exec('echo "=== IP Forwarding ===" && sysctl net.ipv4.ip_forward && echo "=== WireGuard Show ===" && wg show && echo "=== Xray Logs ===" && journalctl -u xray -n 50 --no-pager && echo "=== Active Connections ===" && ss -anp | grep 443', (err, stream) => {
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
