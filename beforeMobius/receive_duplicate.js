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

// 최근 메시지 캐싱
const recentMessages = new Set();
const MESSAGE_TTL = 60000; // 메시지 중복 감지를 위한 TTL (60초)

// 메시지 캐시 정리 함수
function cleanUpRecentMessages() {
    setInterval(() => {
        recentMessages.clear();
    }, MESSAGE_TTL);
}
cleanUpRecentMessages();

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
        const messageStr = message.toString();

        // 중복 메시지 확인
        if (recentMessages.has(messageStr)) {
            console.log('중복 메시지 무시:', messageStr);
            return;
        }
        recentMessages.add(messageStr);

        // JSON 변환을 위해 메시지 가공
        let processedMessageStr = messageStr;
        if (processedMessageStr.includes('"data":[')) {
            processedMessageStr = processedMessageStr.replace(/"data":\[(.+)\]/, (match, p1) => {
                const fixedData = p1.replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/,\s*$/, '');
                return `"data":{${fixedData}}`;
            });
        }

        // JSON 파싱
        const parsedMessage = JSON.parse(processedMessageStr);
        const { applicationID, applicationName, devEUI, data } = parsedMessage;

        // Device 테이블에서 device_id 가져오기
        const getDeviceIdQuery = `SELECT device_id FROM Device WHERE devEUI = ?`;
        db.query(getDeviceIdQuery, [devEUI], (err, rows) => {
            if (err) {
                console.error('Device ID 조회 오류:', err);
                return;
            }

            if (rows.length === 0) {
                // Device 테이블에 devEUI가 없을 경우 삽입
                const deviceInsertQuery = `INSERT INTO Device (devEUI, device_name) VALUES (?, ?)`;
                db.query(deviceInsertQuery, [devEUI, `${applicationName}_${devEUI}`], (err, result) => {
                    if (err) {
                        console.error('Device 데이터 삽입 오류:', err);
                        return;
                    }
                    console.log('Device 데이터 삽입 완료:', result.insertId);
                    insertSensorData(result.insertId, applicationID, applicationName, data);
                });
            } else {
                // Device ID가 존재하면 Sensor 데이터 삽입
                insertSensorData(rows[0].device_id, applicationID, applicationName, data);
            }
        });
    } catch (err) {
        console.error('메시지 처리 오류:', err);
        console.error('문제 메시지:', message.toString());
    }
});

// Sensor 데이터 삽입 함수
function insertSensorData(deviceId, applicationID, applicationName, data) {
    const { temp, ph, turbi: turbidity, do: doValue, nh4, salt } = data;

    const sensors = [
        { type: 'Temp', value: temp },
        { type: 'PH', value: ph },
        { type: 'TURBIDITY', value: turbidity },
        { type: 'DO', value: doValue },
        { type: 'NH4', value: nh4 },
        { type: 'Salt', value: salt }
    ];

    const sensorInsertQuery = `
        INSERT INTO Sensor (
            device_id, application_id, application_name, sensor_type, sensor_value, creatAT, updateAT
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    sensors.forEach((sensor) => {
        if (sensor.value !== null) {
            db.query(sensorInsertQuery, [deviceId, applicationID, applicationName, sensor.type, sensor.value], (err, result) => {
                if (err) {
                    console.error(`Sensor 데이터 삽입 오류 (${sensor.type}):`, err);
                    return;
                }
                console.log(`Sensor 데이터 삽입 완료 (${sensor.type}):`, result.insertId);
            });
        }
    });
}
