import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const tarPath = path.resolve('../iot-portal/dist.tar.gz');
console.log('Reading tar from:', tarPath);
const tarBuffer = fs.readFileSync(tarPath);

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/tmp/dist.tar.gz');
    writeStream.on('close', () => {
      console.log('Uploaded /tmp/dist.tar.gz to Proxmox host');
      const cmd = `echo "07072569" | sudo -S pct push 108 /tmp/dist.tar.gz /opt/iot-stack/iot-portal/dist.tar.gz && echo "07072569" | sudo -S pct exec 108 -- bash -c "cd /opt/iot-stack/iot-portal && rm -rf dist && mkdir -p dist && tar -xzf dist.tar.gz -C dist && rm dist.tar.gz && cd /opt/iot-stack && docker compose build portal && docker compose up -d portal"`;
      conn.exec(cmd, (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', (code) => {
          console.log('Deploy finished with exit code:', code);
          conn.end();
        }).on('data', data => process.stdout.write(data))
          .stderr.on('data', data => process.stderr.write(data));
      });
    });
    writeStream.end(tarBuffer);
  });
}).connect({
  host: '100.125.250.85',
  port: 22,
  username: 'tc-admin',
  password: '07072569'
});
