// const express = require('express');
// const mysql = require('mysql2/promise');
// const app = express();
// const PORT = 3000;

// app.use(express.json());

// const cors = require('cors');
// app.use(cors());


// // DB 연결 설정
// const db = mysql.createPool({
//   host: 'svc.sel4.cloudtype.app',
//   user: 'root',
//   port: '31873',
//   password: '0000',
//   database: 'mobiusdb'
// });

// // 기본 루트
// app.get('/', (req, res) => {
//   res.send('서버 정상 작동 중입니다!');
// });


// // ✅ 1. 관리자 이름 → 수조 목록 + 보유 센서 + 센서값 포함 (기관 전체 기준)
// app.get('/api/user-info/:username', async (req, res) => {
//   const { username } = req.params;

//   try {
//     // 사용자 조회
//     const [[user]] = await db.query(
//       'SELECT * FROM user WHERE name = ?', [username]
//     );
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     // 소속 기관명 조회 (cr 필터용)
//     const [[univ]] = await db.query(
//       'SELECT * FROM univ WHERE id = ?', [user.univ_id]
//     );

//     // 수조 목록
//     const [aquariums] = await db.query(
//       'SELECT * FROM aquarium WHERE univ_id = ?', [user.univ_id]
//     );

//     // 센서 목록
//     const [sensors] = await db.query(
//       'SELECT * FROM sensor WHERE univ_id = ?', [user.univ_id]
//     );

//     // 센서 사용 로그 (기관 전체 기준)
//     const [logs] = await db.query(`
//       SELECT 
//         l.sensor_id, l.aquarium_id, s.type AS sensor_type, a.name AS aquarium_name
//       FROM sensor_usage_log l
//       JOIN sensor s ON l.sensor_id = s.id
//       JOIN aquarium a ON l.aquarium_id = a.id
//       JOIN user u ON l.user_id = u.id
//       WHERE u.univ_id = ? AND l.stopped_at IS NULL
//     `, [user.univ_id]);

//     // 센서값 조회 (pi에서 센서타입 추출)
//     const [cinData] = await db.query(`
//       SELECT 
//         SUBSTRING_INDEX(pi, '/', -1) AS sensor_type,
//         con, 
//         created_at
//       FROM cin
//       WHERE cr = ?
//       ORDER BY created_at DESC
//     `, [univ.name]);

//     // 센서 타입별로 가장 최신 값만 저장
//     const cinMap = {};
//     for (const row of cinData) {
//       if (!cinMap[row.sensor_type]) {
//         cinMap[row.sensor_type] = {
//           value: row.con,
//           updated_at: row.created_at
//         };
//       }
//     }

//     // 수조별로 연결된 센서 + 최근값 정리
//     const aquariumStatus = aquariums.map((aq) => {
//       const activeSensors = logs
//         .filter(log => log.aquarium_id === aq.id)
//         .map(log => {
//           const valueObj = cinMap[log.sensor_type] || null;
//           return {
//             type: log.sensor_type,
//             value: valueObj?.value || null,
//             updated_at: valueObj?.updated_at || null
//           };
//         });
    
//       return {
//         aquarium_id: aq.id,
//         name: aq.name,
//         location: aq.location,
//         fish_type: aq.fish_type, 
//         activeSensors,
//         status: activeSensors.length ? '가동중' : '센서 없음'
//       };
//     });

//     // 최종 응답
//     res.json({
//       user_id: user.id,
//       univ_id: user.univ_id,
//       univ_name: univ.name,
//       sensors,
//       aquariums: aquariumStatus
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });


// // ✅ 2. 센서 작동 요청
// app.post('/api/start-sensor', async (req, res) => {
//   const { user_id, aquarium_id, sensor_id } = req.body;
//   try {
//     // 센서가 이미 작동 중인지 확인
//     const [[existing]] = await db.query(`
//       SELECT * FROM sensor_usage_log 
//       WHERE sensor_id = ? AND stopped_at IS NULL
//     `, [sensor_id]);

//     if (existing) {
//       return res.status(400).json({ status: '센서가 이미 사용 중입니다.' });
//     }

//     // 사용 로그 삽입
//     await db.query(`
//       INSERT INTO sensor_usage_log (sensor_id, aquarium_id, user_id, started_at)
//       VALUES (?, ?, ?, NOW())
//     `, [sensor_id, aquarium_id, user_id]);

//     res.json({ status: 'ok' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// // ✅ 3. 수조별 로그 조회
// app.get('/api/aquarium-log/:aquarium_id', async (req, res) => {
//   const { aquarium_id } = req.params;
//   try {
//     const [logs] = await db.query(`
//       SELECT log.*, u.name AS user_name, s.type AS sensor_type
//       FROM sensor_usage_log log
//       JOIN user u ON log.user_id = u.id
//       JOIN sensor s ON log.sensor_id = s.id
//       WHERE log.aquarium_id = ?
//       ORDER BY log.started_at DESC
//     `, [aquarium_id]);

//     res.json({ logs });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // ✅ 4. 센서 작동 중지 요청
// app.post('/api/stop-sensor', async (req, res) => {
//   const { sensor_id } = req.body;

//   try {
//     // 작동 중인 로그가 있는지 확인
//     const [[activeLog]] = await db.query(`
//       SELECT * FROM sensor_usage_log
//       WHERE sensor_id = ? AND stopped_at IS NULL
//       ORDER BY started_at DESC
//       LIMIT 1
//     `, [sensor_id]);

//     if (!activeLog) {
//       return res.status(400).json({ status: '해당 센서는 현재 작동 중이 아닙니다.' });
//     }

//     // 종료 시간 기록
//     await db.query(`
//       UPDATE sensor_usage_log
//       SET stopped_at = NOW()
//       WHERE id = ?
//     `, [activeLog.id]);

//     res.json({ status: '센서 작동 중지 완료', stopped_log_id: activeLog.id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ✅ 5. 최근 이상치 조회 API -> 나중에 INTERVAL TIME 조정하기!
// app.get('/api/anomaly-recent', async (req, res) => {
//   try {
//     const [rows] = await db.query(`
//       SELECT 
//       al.sensor_type,
//       al.value,
//       al.created_at,
//       su.aquarium_id
//       FROM anomaly_log al
//       JOIN sensor s 
//         ON s.type = al.sensor_type
//       JOIN sensor_usage_log su 
//         ON su.sensor_id = s.id
//       WHERE su.stopped_at IS NULL
//         AND al.created_at >= NOW() - INTERVAL 60 MINUTE
//      ORDER BY al.created_at DESC;


//     `);

//     res.json(rows);
//   } catch (err) {
//     console.error('❌ [anomaly-recent] Error:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

// require('./data_analyzer');

// // ✅ 서버 실행
// app.listen(PORT, () => {
//   console.log(`✅ Server listening on http://localhost:${PORT}`);
// });


// // cr 중복 오류 시 mqtt 내부 리소스 삭제
// // curl -X DELETE "http://localhost:7579/Mobius/sharkfamily" -H "X-M2M-Origin: Ssharkfamily" -H "X-M2M-RI: 12345" -H "Accept: application/json"  -H "Content-Type: application/json;ty=2"