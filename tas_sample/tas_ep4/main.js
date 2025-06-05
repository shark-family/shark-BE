// tas_sample/tas_ep4/main.js

const sender = require('./sender');

// 초기 기준값 설정
let baseSensorData = {
  Temp: 25.0,
  pH: 7.0,
  TURBIDITY: 2.5,
  DO: 5.0,
  NH4: 1.0,
  salt: 0.5,
};

// 범위 내에서 부드럽게 랜덤 변화
function vary(value, range, min = 0, max = 100) {
  const delta = (Math.random() * 2 - 1) * range; // -range ~ +range
  const newValue = value + delta;
  return parseFloat(Math.min(max, Math.max(min, newValue)).toFixed(2));
}

// 센서값 생성 함수 (기준값 기반)
function generateRandomSensorData() {
  // 기준값을 약간씩 변화
  baseSensorData.Temp = vary(baseSensorData.Temp, 0.5, 20, 30);         // ±0.5도
  baseSensorData.pH = vary(baseSensorData.pH, 0.1, 6, 8);               // ±0.1
  baseSensorData.TURBIDITY = vary(baseSensorData.TURBIDITY, 0.3, 0, 5); // ±0.3
  baseSensorData.DO = vary(baseSensorData.DO, 0.5, 0, 10);              // ±0.5
  baseSensorData.NH4 = vary(baseSensorData.NH4, 0.2, 0, 3);             // ±0.2
  baseSensorData.salt = vary(baseSensorData.salt, 0.05, 0, 1);          // ±0.05

  return {
    applicationID: 1001,
    applicationName: "TestApp",
    devEUI: Math.floor(1000000000000000 + Math.random() * 8999999999999999),
    deviceName: "Device1",
    Temp: baseSensorData.Temp,
    pH: baseSensorData.pH,
    TURBIDITY: baseSensorData.TURBIDITY,
    DO: baseSensorData.DO,
    NH4: baseSensorData.NH4,
    salt: baseSensorData.salt,
    ALCOHOL: 0.0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// 주기적으로 센서 데이터 전송
function send_to_elasticsearch() {
  const json_data = generateRandomSensorData();
  sender.send_elasticsearch(json_data);
}

// 5초마다 새 데이터 전송 (원하면 30000 → 5분, 1800000 → 30분)
setInterval(send_to_elasticsearch, 5000);

console.log("🚀 Sensor data generator started.");
