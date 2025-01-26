const axios = require('axios');
const moment = require('moment-timezone'); // 시간 변환을 위한 모듈

// Kibana(Elasticsearch) 연결 정보
const ELASTICSEARCH_URL = 'http://34.64.200.202:9200'; // Elasticsearch 기본 URL
const INDEX_NAME = 'sensor'; // 인덱스 이름
const kibanaApiUrl = `${ELASTICSEARCH_URL}/${INDEX_NAME}/_doc`; // 엔드포인트 URL

// 현재 대한민국 서울 시간을 가져오기
const seoulTime = moment.tz('Asia/Seoul').format('YYYY-MM-DDTHH:mm:ss.SSSSSS'); // 나노초 포함

// Kibana에 전송할 데이터 예시
const jsonData = {
  id: 1, // 데이터 ID
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
  createdAt: seoulTime, // 현재 서울 시간
  updatedAt: seoulTime, // 현재 서울 시간
};

// Kibana(Elasticsearch)에 데이터 전송 함수
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
