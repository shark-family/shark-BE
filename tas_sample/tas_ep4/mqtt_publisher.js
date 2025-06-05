const mqtt = require('mqtt');

const brokerIp = '210.94.199.225';
const brokerPort = 1919;
const brokerUrl = `mqtt://${brokerIp}:${brokerPort}`;
const topic = 'application/4/device/C4DEE2CFB045/rx';

const client = mqtt.connect(brokerUrl);

let count = 0;
const maxCount = 100;
const interval = 5000; // 5초 간격

function getSensorValue({ range, abnormalRange, isAbnormal = false }) {
  const isOutlier = isAbnormal && Math.random() < 0.15; // 15% 확률로 이상치
  const [min, max] = isOutlier ? abnormalRange : range;
  return (Math.random() * (max - min) + min).toFixed(2);
}

function createSensorData() {
  return {
    nh4: getSensorValue({ range: [0, 10], abnormalRange: [30, 60], isAbnormal: true }),
    ph: getSensorValue({ range: [6.5, 8.5], abnormalRange: [9.5, 15], isAbnormal: true }),
    turbi: getSensorValue({ range: [0, 2], abnormalRange: [10, 50], isAbnormal: true }),
    salt: getSensorValue({ range: [15, 35], abnormalRange: [60, 120], isAbnormal: true }),
    do: getSensorValue({ range: [4, 9], abnormalRange: [20, 50], isAbnormal: true }),
    temp: getSensorValue({ range: [18, 26], abnormalRange: [40, 80], isAbnormal: true }),
  };
}

client.on('connect', () => {
  console.log(`✅ MQTT connected: ${brokerUrl}`);

  const intervalId = setInterval(() => {
    if (count >= maxCount) {
      clearInterval(intervalId);
      client.end();
      console.log("✅ Finished sending test messages.");
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
        console.error(`❌ Failed to send message #${count}:`, err);
      } else {
        console.log(`📤 Sent test message #${count + 1}:`, sensorData);
      }
    });

    count++;
  }, interval);
});
