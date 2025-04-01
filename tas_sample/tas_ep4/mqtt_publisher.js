const mqtt = require('mqtt');

// 센서 브로커 정보 (수신 코드가 구독 중인 포트와 IP)
const brokerIp = '210.94.199.225';
const brokerPort = 1919;
const brokerUrl = `mqtt://${brokerIp}:${brokerPort}`;

// 센서처럼 보낼 MQTT 토픽 (receiver.js가 구독 중인 토픽)
const topic = 'application/4/device/C4DEE2CFB045/rx';  // sensors_info.js 기준

// 센서처럼 보낼 메시지 형식
const message = JSON.stringify({
  applicationID: "4",
  applicationName: "EP4_wifi",
  devEUI: "C4DEE2CFB045",
  data: {
    nh4: 4444,
    ph: 4444,
    turbi: 4444,
    salt: 4444,
    do: 4444,
    temp: 4444
  }
});

const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log(`✅ MQTT 브로커에 연결됨: ${brokerUrl}`);
  
  client.publish(topic, message, { qos: 0 }, (err) => {
    if (err) {
      console.error(`❌ 메시지 전송 실패:`, err);
    } else {
      console.log(`📤 메시지 전송 성공\n📍토픽: ${topic}\n📦내용: ${message}`);
    }
    client.end();
  });
});
