// test_detector.js
const detector = require('./abnormal_detector');

// 샘플 센서 데이터 준비
const sample_data_list = [
    { pH: 7.5, DO: 5, temperature: 22 },   // 정상
    { pH: 10, DO: 5, temperature: 23 },    // pH 이상
    { pH: 7, DO: 2, temperature: 20 },     // DO 이상
    { pH: 10, DO: 2, temperature: 25 },    // pH + DO 이상
];

// 테스트
for (const data of sample_data_list) {
    const result = detector.is_abnormal(data);
    console.log(`센서 데이터: ${JSON.stringify(data)}, 라벨링 결과:`, result);
}
