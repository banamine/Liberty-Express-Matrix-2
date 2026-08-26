const express = require('express');
const multer = require('multer');
const app = express();
const upload = multer({ limits: { fileSize: 1 } });
app.post('/api/upload', upload.array('files'), (req, res) => res.json({ok:true}));
app.listen(3001, () => {
  fetch('http://localhost:3001/api/upload', {
    method: 'POST',
    body: (new (require('form-data'))()).append('files', 'large string that exceeds limit')
  }).then(r=>r.text()).then(t => { console.log("Response:", t.substring(0, 50)); process.exit(0); });
});
