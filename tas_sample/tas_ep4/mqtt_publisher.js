const mqtt = require('mqtt');

const brokerIp = '210.94.199.225';
const brokerPort = 1919;
const brokerUrl = `mqtt://${brokerIp}:${brokerPort}`;
const topic = 'application/4/device/C4DEE2CFB045/rx';

const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log(`✅ MQTT 브로커에 연결됨: ${brokerUrl}`);

  const interval = setInterval(() => {
    const message = JSON.stringify({
      applicationID: "4",
      applicationName: "EP4_wifi",
      devEUI: "C4DEE2CFB045",
      data: {
        nh4: Math.random() * 15,
        ph: Math.random() * 14,
        turbi: Math.random() * 10,
        salt: Math.random() * 50,
        do: Math.random() * 10,
        temp: Math.random() * 40
      }
    });

    client.publish(topic, message, { qos: 0 }, (err) => {
      if (err) {
        console.error(`❌ 메시지 전송 실패:`, err);
      } else {
        console.log(`📤 전송: ${message}`);
      }
    });
  }, 5000);

  setTimeout(() => {
    clearInterval(interval);
    client.end();
    console.log("🛑 MQTT 전송 종료");
  }, 300000); // 1분 뒤 종료
});
