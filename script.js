const startBtn = document.getElementById('startButton');
const statusText = document.getElementById('status');
const tableBody = document.querySelector('#reportTable tbody');
const downloadBtn = document.getElementById('downloadReportButton');

let audioContext, micStream, analyser, dataArray, animationId;
let reportData = [];
let notified = false;

// Meminta izin akses mikrofon dan notifikasi
async function requestPermissions() {
  try {
    // Meminta izin akses mikrofon
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Meminta izin untuk notifikasi
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Izin notifikasi dibutuhkan agar pemberitahuan bekerja.');
      }
    }

    return stream;
  } catch (err) {
    alert('Gagal akses mikrofon: ' + err.message);
    throw err; // Jika gagal, lempar error ke caller
  }
}

startBtn.addEventListener('click', async () => {
  if (audioContext) {
    stopMonitoring();
    startBtn.textContent = 'Mulai Monitoring';
    return;
  }

  try {
    const stream = await requestPermissions();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    micStream = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    micStream.connect(analyser);
    monitor();
    startBtn.textContent = 'Stop Monitoring';
    statusText.textContent = 'Monitoring aktif...';
  } catch (err) {
    // Jika gagal memulai monitoring, tampilkan pesan
    statusText.textContent = 'Gagal memulai monitoring!';
  }
});

function monitor() {
  analyser.getByteTimeDomainData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sum += normalized * normalized;
  }

  const rms = Math.sqrt(sum / dataArray.length);
  const decibel = 20 * Math.log10(rms);
  const dB = Math.max(0, Math.round(decibel + 100));

  statusText.textContent = `Level Suara: ${dB} dB`;

  if (dB > 80) {
    showNotification(dB);
    addToReport(dB);
  }

  animationId = requestAnimationFrame(monitor);
}

function stopMonitoring() {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  cancelAnimationFrame(animationId);
  statusText.textContent = 'Monitoring dihentikan.';
}

function showNotification(dB) {
  if (Notification.permission === 'granted' && !notified) {
    new Notification('🚨 Ruangan Terlalu Berisik!!', {
      body: `Level saat ini: ${dB} dB`,
      icon: 'https://cdn-icons-png.flaticon.com/512/565/565340.png',
      vibrate: [200, 100, 200],
      sound: 'default',
    });

    notified = true;
    setTimeout(() => notified = false, 10000);  // Reset pemberitahuan setelah 10 detik
  }
}

function addToReport(dB) {
  const now = new Date();
  const time = now.toLocaleString();

  const row = document.createElement('tr');
  const timeCell = document.createElement('td');
  const levelCell = document.createElement('td');

  timeCell.textContent = time;
  levelCell.textContent = dB;

  row.appendChild(timeCell);
  row.appendChild(levelCell);
  tableBody.appendChild(row);

  reportData.push({ time, level: dB });

  // Menampilkan tabel jika ada data
  if (reportData.length > 0) {
    document.getElementById('reportTable').hidden = false; // Tampilkan tabel
  }

  // Aktifkan tombol download jika ada data
  downloadBtn.disabled = false;
}

downloadBtn.addEventListener('click', () => {
  if (reportData.length === 0) return;

  let csv = 'Waktu,Level Suara (dB)\n';
  reportData.forEach(row => {
    csv += `${row.time},${row.level}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'laporan_kebisingan.csv';
  link.click();
});
