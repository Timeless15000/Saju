// saju.html 미리보기용 간이 정적 서버 (node dev/serve.js → http://localhost:8931)
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 8931;
http.createServer((req, res) => {
  const file = path.join(ROOT, req.url === '/' ? 'saju.html' : decodeURIComponent(req.url));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, () => console.log('saju preview on http://localhost:' + PORT));
