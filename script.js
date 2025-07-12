let chart;
let dbData = [];
let timeLabels = [];
let allLogs = [];
let monitoring = false;
let intervalId;
let analyser, dataArray, audioContext, stream;

let lastNotificationTime = 0;
const NOTIF_INTERVAL = 60000; // 1 menit

async function toggleMonitoring() {
  const toggleButton = document.getElementById("toggleButton");
  const restartButton = document.getElementById("restartButton");

  if (!monitoring) {
    // Minta izin notifikasi
    if ("Notification" in window && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }

    try {
      // Mulai mikrofon
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);
      source.connect(analyser);

      // Buat grafik
      if (!chart) {
        const ctx = document.getElementById('dbChart').getContext('2d');
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: timeLabels,
            datasets: [{
              label: 'dB',
              data: dbData,
              borderColor: 'blue',
              fill: false,
              tension: 0.3
            }]
          },
          options: {
            responsive: true,
            animation: false,
            scales: {
              y: {
                min: 0,
                max: 100,
                ticks: {
                  stepSize: 10
                }
              }
            }
          }
        });
      }

      // Loop pengukuran
      intervalId = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          let val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        let rms = Math.sqrt(sum / dataArray.length);
        let db = Math.max(0, Math.round(20 * Math.log10(rms) + 100));
        const now = new Date().toLocaleTimeString();

        // Update chart
        dbData.push(db);
        timeLabels.push(now);
        if (dbData.length > 8) {
          dbData.shift();
          timeLabels.shift();
        }
        chart.update();

        // Tampilkan ke tabel
        const tbody = document.querySelector("#logTable tbody");
        const row = document.createElement("tr");
        row.innerHTML = `<td>${now}</td><td>${db}</td>`;
        tbody.prepend(row);
        while (tbody.rows.length > 4) tbody.deleteRow(-1);

        // Tampilkan status
        const statusBox = document.getElementById("statusBox");
        document.getElementById("dbDisplay").innerText = `dB: ${db}`;
        if (db > 80) {
          statusBox.innerText = "BISING";
          statusBox.style.backgroundColor = "red";

          // Notifikasi lokal
          if (Notification.permission === "granted") {
            let currentTime = Date.now();
            if (currentTime - lastNotificationTime > NOTIF_INTERVAL) {
              new Notification("Peringatan Kebisingan!", {
                body: `Suara bising terdeteksi: ${db} dB pada pukul ${now}`,
                icon: "https://img.icons8.com/emoji/48/000000/loudspeaker-emoji.png"
              });
              lastNotificationTime = currentTime;
            }
          }
        } else {
          statusBox.innerText = "AMAN";
          statusBox.style.backgroundColor = "green";
        }

        // Simpan lokal & kirim ke server
        const logEntry = { time: now, db: db, status: db > 80 ? "BISING" : "AMAN" };
        allLogs.push(logEntry);

        // Kirim log ke server
        fetch('/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logEntry)
        });

      }, 1000);

      monitoring = true;
      toggleButton.innerText = "⏹️";
      restartButton.style.display = "inline-block";

    } catch (err) {
      alert("Gagal mengakses mikrofon: " + err.message);
    }

  } else {
    // Stop
    clearInterval(intervalId);
    stream.getTracks().forEach(track => track.stop());
    audioContext.close();
    monitoring = false;
    toggleButton.innerText = "▶️";
  }
}

function restartMonitoring() {
  dbData.length = 0;
  timeLabels.length = 0;
  allLogs.length = 0;
  lastNotificationTime = 0;

  if (chart) chart.update();

  document.querySelector("#logTable tbody").innerHTML = "";
  document.getElementById("dbDisplay").innerText = "dB: -";
  const statusBox = document.getElementById("statusBox");
  statusBox.innerText = "Status";
  statusBox.style.backgroundColor = "gray";
}

function showReport() {
  if (allLogs.length === 0) {
    alert("Belum ada data untuk laporan.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Waktu,dB,Status\n";
  allLogs.forEach(log => {
    csvContent += `${log.time},${log.db},${log.status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "laporan_kebisingan.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
