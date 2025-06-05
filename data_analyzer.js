// 📄 data_analyzer.js
const { exec } = require('child_process');

// 1분마다 파이썬 스크립트 실행
setInterval(() => {
    exec('python detect_anomaly.py', (err, stdout, stderr) => {
        if (err) {
            console.error(`[❌ Error]: ${err.message}`);
            return;
        }
        if (stderr) {
            console.error(`[⚠️ STDERR]: ${stderr}`);
        }
        if (stdout) {
            console.log(`[📢 Python Output]:\n${stdout}`);
        }
    });
}, 60000);  // 1분 = 60000ms

console.log("🟢 데이터 이상치 분석기(data_analyzer.js) 실행 중...");
