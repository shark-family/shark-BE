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

        // 디바이스 정보 저장
        const deviceInsertQuery = `
            INSERT INTO Device (devEUI, device_name)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE device_name = VALUES(device_name)
        `;

        db.query(deviceInsertQuery, [devEUI, `${applicationName}_${devEUI}`], (err, result) => {
            if (err) {
                console.error('Device 데이터 삽입 오류:', err);
                return;
            }
            console.log('Device 데이터 삽입 완료:', result.insertId);
        });

        // 센서 데이터 추출 및 저장
        const {
            temp = null,
            ph = null,
            turbi: turbidity = null,
            do: doValue = null,
            nh4 = null,
            salt = null
        } = data;

        const sensorInsertQuery = `
            INSERT INTO Sensor (
                device_id, sensor_type, sensor_value, creatAT, updateAT
            ) VALUES (?, ?, ?, NOW(), NOW())
        `;

        // 센서별 데이터 삽입
        const sensors = [
            { type: 'Temp', value: temp },
            { type: 'PH', value: ph },
            { type: 'TURBIDITY', value: turbidity },
            { type: 'DO', value: doValue },
            { type: 'NH4', value: nh4 },
            { type: 'Salt', value: salt },
        ];

        sensors.forEach(sensor => {
            if (sensor.value !== null) {
                db.query(sensorInsertQuery, [
                    devEUI, // Device의 devEUI를 외래 키로 사용
                    sensor.type,
                    sensor.value
                ], (err, result) => {
                    if (err) {
                        console.error(`Sensor 데이터 삽입 오류 (${sensor.type}):`, err);
                        return;
                    }
                    console.log(`Sensor 데이터 삽입 완료 (${sensor.type}):`, result.insertId);
                });
            }
        });
    } catch (err) {
        console.error('메시지 처리 오류:', err);
        console.error('문제 메시지:', message.toString());
    }
});
