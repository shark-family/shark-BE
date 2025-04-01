// mqtt_publisher.js
const mqtt = require('mqtt');

const brokerIp = '210.94.199.225';
const brokerPort = 1919;
const brokerUrl = `mqtt://${brokerIp}:${brokerPort}`;

// 토픽 설정 - 수신 코드에서 구독하고 있는 토픽과 맞아야 함!
const topic = 'sensor/data';

// 예시 센서 데이터 (수동 전송할 내용)
const message = JSON.stringify({
  applicationID: 1001,
  applicationName: 'haeunTEST',
  devEUI: '1234567890ABCDEF',
  data: {
    temp: 23.5,
    ph: 7.1,
    turbi: 10.3,
    do: 8.4,
    nh4: 0.2,
    salt: 1.5
  }
});

// MQTT 브로커에 연결하고 메시지 전송
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log(`✅ MQTT 브로커 연결됨: ${brokerUrl}`);
  client.publish(topic, message, { qos: 0, retain: false }, (err) => {
    if (err) {
      console.error('❌ 메시지 전송 실패:', err);
    } else {
      console.log(`📤 메시지 전송 완료\n토픽: ${topic}\n내용: ${message}`);
    }
    client.end(); // 전송 후 연결 종료
  });
});