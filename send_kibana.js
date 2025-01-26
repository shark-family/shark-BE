const mqtt = require('mqtt');
const mysql = require('mysql2');
const crypto = require('crypto');
const axios = require('axios');

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

// Kibana(Elasticsearch) 연결 정보
const ELASTICSEARCH_URL = 'http://34.64.200.202:9200'; // Elasticsearch 기본 URL
const INDEX_NAME = 'sensor'; // 인덱스 이름
const kibanaApiUrl = `${ELASTICSEARCH_URL}/${INDEX_NAME}/_doc`; // 엔드포인트 URL

// 최근 처리된 메시지를 저장하기 위한 캐시
const recentMessages = new Set();
const MESSAGE_CACHE_DURATION = 5000; // 메시지 중복 제거를 위한 캐시 지속 시간 (밀리초)

// 메시지 해시 생성 함수
function generateMessageHash(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

// `devEUI`를 long 값으로 변환하는 함수
function convertDevEUIToLong(devEUI) {
    const hash = crypto.createHash('sha256').update(devEUI).digest('hex');
    return parseInt(hash.slice(0, 15), 16); // 16진수로 변환 후 long 크기에 맞게 자르기
}

// Kibana 데이터 전송 함수
async function sendDataToKibana(data) {
    try {
        const response = await axios.post(kibanaApiUrl, data, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.log('Kibana 데이터 전송 성공:', response.data);
    } catch (error) {
        console.error('Kibana 데이터 전송 오류:', error.message);
        if (error.response) {
            console.error('상세 응답:', error.response.data);
        }
    }
}

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
        const messageHash = generateMessageHash(messageStr);

        // 최근 메시지 중복 체크
        if (recentMessages.has(messageHash)) {
            console.log('중복 메시지로 저장 생략:', messageStr);
            return;
        }

        // 메시지를 최근 메시지 캐시에 추가
        recentMessages.add(messageHash);
        setTimeout(() => recentMessages.delete(messageHash), MESSAGE_CACHE_DURATION);

        // JSON 변환을 위해 메시지 가공
        let processedMessageStr = messageStr;
        if (messageStr.includes('"data":[')) {
            processedMessageStr = messageStr.replace(/"data":\[(.+)\]/, (match, p1) => {
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
                    insertSensorData(result.insertId, applicationID, applicationName, data, devEUI);
                });
            } else {
                // Device ID가 존재하면 Sensor 데이터 삽입
                insertSensorData(rows[0].device_id, applicationID, applicationName, data, devEUI);
            }
        });
    } catch (err) {
        console.error('메시지 처리 오류:', err);
        console.error('문제 메시지:', message.toString());
    }
});

// Sensor 데이터 삽입 함수
function insertSensorData(deviceId, applicationID, applicationName, data, devEUI) {
    const { temp, ph, turbi: turbidity, do: doValue, nh4, salt } = data;

    const sensors = [
        { type: 'Temp', value: temp ?? 0 },
        { type: 'PH', value: ph ?? 0 },
        { type: 'TURBIDITY', value: turbidity ?? 0 },
        { type: 'DO', value: doValue ?? 0 },
        { type: 'NH4', value: nh4 ?? 0 },
        { type: 'Salt', value: salt ?? 0 },
    ];

    const sensorInsertQuery = `
        INSERT INTO Sensor (
            device_id, application_id, application_name, sensor_type, sensor_value, creatAT, updateAT
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    // 센서 데이터 저장 후 Kibana로 전송
    const kibanaData = {
        applicationID,
        applicationName,
        devEUI: convertDevEUIToLong(devEUI), // long 값으로 변환된 devEUI
        deviceName: `${applicationName}_${devEUI}`,
        Temp: temp ?? 0,
        pH: ph ?? 0,
        TURBIDITY: turbidity ?? 0,
        DO: doValue ?? 0,
        NH4: nh4 ?? 0,
        salt: salt ?? 0,
        ALCOHOL: 0, // 기본값
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // 센서 데이터 저장 후 한 번만 Kibana로 전송
    let remainingSensors = sensors.length;
    sensors.forEach((sensor) => {
        if (sensor.value !== null) {
            db.query(sensorInsertQuery, [deviceId, applicationID, applicationName, sensor.type, sensor.value], (err, result) => {
                if (err) {
                    console.error(`Sensor 데이터 삽입 오류 (${sensor.type}):`, err);
                    return;
                }
                console.log(`Sensor 데이터 삽입 완료 (${sensor.type}):`, result.insertId);

                remainingSensors--;
                if (remainingSensors === 0) {
                    // 모든 센서 데이터 저장이 완료된 후 Kibana로 전송
                    sendDataToKibana(kibanaData);
                }
            });
        } else {
            remainingSensors--;
        }
    });
}
