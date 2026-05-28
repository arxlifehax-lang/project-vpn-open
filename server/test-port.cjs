const net = require('net');

const testPort = (port, host) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startTime = Date.now();
    
    socket.setTimeout(5000);
    
    socket.connect(port, host, () => {
      const latency = Date.now() - startTime;
      console.log(`Port ${port} on ${host} is OPEN! Latency: ${latency}ms`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', (err) => {
      console.log(`Port ${port} on ${host} is CLOSED/UNREACHABLE! Error: ${err.message}`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('timeout', () => {
      console.log(`Port ${port} on ${host} is TIMEOUT!`);
      socket.destroy();
      resolve(false);
    });
  });
};

async function run() {
  await testPort(443, '139.84.234.151');
  await testPort(22, '139.84.234.151');
  await testPort(2096, '139.84.234.151');
}

run();
