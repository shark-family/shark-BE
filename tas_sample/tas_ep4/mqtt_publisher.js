const mqtt = require('mqtt');

const brokerIp = '210.94.199.225';
const brokerPort = 1919;
const brokerUrl = `mqtt://${brokerIp}:${brokerPort}`;
const topic = 'application/4/device/C4DEE2CFB045/rx';

const client = mqtt.connect(brokerUrl);

let count = 0;
const maxCount = 100;      // 최대 전송 횟수 (원하면 무한으로 변경 가능)
const interval = 5000;     // 전송 간격(ms) → 5초

function getRandomValue(min, max, isAbnormal = false) {
  if (isAbnormal && Math.random() < 0.2) {
    return (max + Math.random() * 100).toFixed(2); // 이상치
  }
  return (Math.random() * (max - min) + min).toFixed(2); // 정상
}

function createSensorData() {
  return {
    nh4: getRandomValue(0, 20, true),
    ph: getRandomValue(6.5, 8.5, true),
    turbi: getRandomValue(0, 2, true),
    salt: getRandomValue(15, 35, true),
    do: getRandomValue(3, 10, true),
    temp: getRandomValue(15, 28, true)
  };
}

client.on('connect', () => {
  console.log(`MQTT connected: ${brokerUrl}`);

  const intervalId = setInterval(() => {
    if (count >= maxCount) {
      clearInterval(intervalId);
      client.end();
      console.log("Finished sending test messages.");
      return;
    }

    const sensorData = createSensorData();

    const message = JSON.stringify({
      applicationID: "4",
      applicationName: "EP4_wifi",
      devEUI: "C4DEE2CFB045",
      data: sensorData
    });

    client.publish(topic, message, { qos: 0 }, (err) => {
      if (err) {
        console.error(`Failed to send message ${count}:`, err);
      } else {
        console.log(`Sent test message #${count + 1}:`, sensorData);
      }
    });

    count++;
  }, interval);
});
