const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const dataPath = path.join(__dirname, 'data/logs.json');

// 🧠 Fungsi bantu untuk baca file log
function readLogs() {
  if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "[]");
  const data = fs.readFileSync(dataPath);
  return JSON.parse(data);
}

// ✅ Simpan log baru (POST /api/log)
router.post('/log', (req, res) => {
  const { db, status } = req.body;

  // Simpan waktu sebagai format ISO 8601 (agar valid untuk new Date())
  const newLog = {
    time: new Date().toISOString(),
    db,
    status
  };

  const logs = readLogs();
  logs.push(newLog);

  fs.writeFile(dataPath, JSON.stringify(logs, null, 2), err => {
    if (err) return res.status(500).send("Gagal menyimpan data");
    res.status(200).send("Berhasil disimpan");
  });
});

// ✅ Ambil log dengan query waktu (GET /api/log?range=...)
router.get('/log', (req, res) => {
  const logs = readLogs();
  const { range } = req.query;

  if (range === 'today') {
    const today = new Date().toDateString();
    const filtered = logs.filter(log => {
      const logDate = new Date(log.time);
      return logDate.toDateString() === today;
    });
    return res.json(filtered);
  }

  if (range === '7days') {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const filtered = logs.filter(log => {
      const logDate = new Date(log.time);
      return logDate >= sevenDaysAgo && logDate <= now;
    });
    return res.json(filtered);
  }

  // Default: semua log
  res.json(logs);
});

module.exports = router;
