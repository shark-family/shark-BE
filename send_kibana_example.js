const axios = require('axios');

// Kibana(Elasticsearch) 연결 정보
const ELASTICSEARCH_URL = 'http://34.64.200.202:9200'; // Elasticsearch 기본 URL
const INDEX_NAME = 'sensor'; // 인덱스 이름
const kibanaApiUrl = `${ELASTICSEARCH_URL}/${INDEX_NAME}/_doc`; // 엔드포인트 URL

// 전송할 데이터 예시
const jsonData = {
  applicationID: 1001,
  applicationName: "Water Monitoring",
  devEUI: 1241054800,
  deviceName: "EP4_01241054800",
  Temp: 27.4,
  pH: 6.92,
  TURBIDITY: 0,
  DO: 5.85,
  NH4: 0,
  salt: 26.83,
  ALCOHOL: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Kibana(Elasticsearch)에 데이터 전송
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

// 데이터 전송 실행
sendDataToKibana(jsonData);
