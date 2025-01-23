const mqtt = require('mqtt');
const mysql = require('mysql2');

// MQTT Broker 연결 정보
const brokerIp = '210.94.199.225';
const brokerPort = 1919;
const brokerUrl = `mqtt://${brokerIp}:${brokerPort}`;
const topic = '#'; // Subscribe to all topics

// MySQL DB 연결 설정
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'shark'
});

db.connect((err) => {
    if (err) {
        console.error('DB 연결 오류:', err);
        return;
    }
    console.log('DB에 연결되었습니다.');
});

// MQTT 클라이언트 연결
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
    console.log(`Connected to MQTT broker at ${brokerUrl}`);

    // Subscribe to the topic
    client.subscribe(topic, (err) => {
        if (err) {
            console.error('Subscription error:', err);
        } else {
            console.log(`Subscribed to topic: ${topic}`);
        }
    });
});

// 메시지 수신 시 처리
client.on('message', (topic, message) => {
    try {
        let messageStr = message.toString();

        // JSON 변환을 위해 메시지 가공
        if (messageStr.includes('"data":[')) {
            messageStr = messageStr.replace(/"data":\[(.+)\]/, (match, p1) => {
                const fixedData = p1.replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/,\s*$/, '');
                return `"data":{${fixedData}}`;
            });
        }

        // JSON 파싱
        const parsedMessage = JSON.parse(messageStr);
        const { applicationID, applicationName, devEUI, data } = parsedMessage;

        // 센서 데이터 추출
        const {
            temp = null,
            ph = null,
            turbi: turbidity = null,
            do: doValue = null,
            nh4 = null,
            salt = null
        } = data;

        // 데이터 삽입
        const insertQuery = `
            INSERT INTO sensor_data (
                applicationID, applicationName, devEUI, deviceName, Temp, pH, TURBIDITY, DO, NH4, salt, ALCOHOL, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
        `;

        db.query(insertQuery, [
            applicationID,
            applicationName,
            devEUI,
            `${applicationName}_${devEUI}`,
            temp,
            ph,
            turbidity,
            doValue,
            nh4,
            salt
        ], (err, result) => {
            if (err) {
                console.error('데이터 삽입 오류:', err);
                return;
            }
            console.log('데이터 삽입 완료:', result.insertId);
        });
    } catch (err) {
        console.error('메시지 처리 오류:', err);
        console.error('문제 메시지:', message.toString());
    }
});
