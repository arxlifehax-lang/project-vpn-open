const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection ready!');
  
  // Run fix commands on VPS
  conn.exec('sed -i "s/eth0/enp1s0/g" /etc/wireguard/wg0.conf && systemctl restart wg-quick@wg0 && echo "=== Verifying wg0.conf ===" && cat /etc/wireguard/wg0.conf && echo "=== Verifying iptables ===" && iptables -t nat -L -v -n', (err, stream) => {
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
