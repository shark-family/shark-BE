const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const PORT = 3000;

app.use(express.json());

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '0000',
  database: 'mobiusdb'
});

// 기본 루트
app.get('/', (req, res) => {
  res.send('서버 정상 작동 중입니다!');
});

// ✅ 1. 관리자 이름 → 수족관 목록 + 보유 센서 + 수조별 가동 중 센서
app.get('/api/user-info/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const [[user]] = await db.query('SELECT * FROM user WHERE name = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 사용자가 속한 기관의 수족관
    const [aquariums] = await db.query(
      'SELECT * FROM aquarium WHERE univ_id = ?',
      [user.univ_id]
    );

    // 사용자가 속한 기관의 센서 전체
    const [sensors] = await db.query(
      'SELECT * FROM sensor WHERE univ_id = ?',
      [user.univ_id]
    );

    // 센서 사용 로그 조회 (가동 중인 것만)
    const [logs] = await db.query(`
      SELECT l.sensor_id, l.aquarium_id, s.type AS sensor_type, a.name AS aquarium_name
      FROM sensor_usage_log l
      JOIN sensor s ON l.sensor_id = s.id
      JOIN aquarium a ON l.aquarium_id = a.id
      WHERE l.user_id = ? AND l.stopped_at IS NULL
    `, [user.id]);

    // 수조별 센서 정리
    const aquariumStatus = aquariums.map(aq => {
      const active = logs
        .filter(log => log.aquarium_id === aq.id)
        .map(log => log.sensor_type);

      return {
        aquarium_id: aq.id,
        name: aq.name,
        location: aq.location,
        activeSensors: active,
        status: active.length ? '가동중' : '센서 없음'
      };
    });

    res.json({
      user_id: user.id,
      univ_id: user.univ_id,
      sensors,
      aquariums: aquariumStatus
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 2. 센서 작동 요청
app.post('/api/start-sensor', async (req, res) => {
  const { user_id, aquarium_id, sensor_id } = req.body;
  try {
    // 센서가 이미 가동 중인지 확인
    const [[existing]] = await db.query(`
      SELECT * FROM sensor_usage_log 
      WHERE sensor_id = ? AND stopped_at IS NULL
    `, [sensor_id]);

    if (existing) {
      return res.status(400).json({ status: '센서가 이미 사용 중입니다.' });
    }

    // 로그 삽입
    await db.query(`
      INSERT INTO sensor_usage_log (sensor_id, aquarium_id, user_id, started_at)
      VALUES (?, ?, ?, NOW())
    `, [sensor_id, aquarium_id, user_id]);

    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 3. 수조별 로그 조회
app.get('/api/aquarium-log/:aquarium_id', async (req, res) => {
  const { aquarium_id } = req.params;
  try {
    const [logs] = await db.query(`
      SELECT log.*, u.name AS user_name, s.type AS sensor_type
      FROM sensor_usage_log log
      JOIN user u ON log.user_id = u.id
      JOIN sensor s ON log.sensor_id = s.id
      WHERE log.aquarium_id = ?
      ORDER BY log.started_at DESC
    `, [aquarium_id]);

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});

// cr 중복 오류 시 mqtt 내부 리소스 삭제
// curl -X DELETE "http://localhost:7579/Mobius/sharkfamily" -H "X-M2M-Origin: Ssharkfamily" -H "X-M2M-RI: 12345" -H "Accept: application/json"  -H "Content-Type: application/json;ty=2"