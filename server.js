// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// ✅ DB 연결
const db = mysql.createPool({
  host: 'svc.sel3.cloudtype.app', // smart DB
  user: 'root',
  port: '32344',
  password: '0000',
  database: 'smart'
});

// ✅ 기본 루트
app.get('/', (req, res) => {
  res.send('🐟 스마트양식장 서버 정상 작동 중!');
});

/**
 * ✅ 1. 관리자 이름 → 수조 목록 + 보유 센서 + (수조별 최신) 센서값
 *    - sensor_usage_log 로 “가동중” 센서를 결정
 *    - 각 수조의 aquarium.device_id 로 sensor_data 에서 최신 1행 조회
 *    - 기존 응답 스키마 그대로 유지
 *    - ❗ 센서값은 1번 수조에 몰아서 내려주고, 수조는 최대 3개까지만 응답
 */
app.get('/api/user-info/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // 1) 사용자
    const [[user]] = await db.query('SELECT * FROM user WHERE name = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2) 소속기관
    const [[univ]] = await db.query('SELECT * FROM univ WHERE id = ?', [user.univ_id]);

    // 3) 수조 목록 (device_id 포함) - id 기준 정렬
    const [aquariums] = await db.query(
      'SELECT id, name, location, fish_type, univ_id, device_id FROM aquarium WHERE univ_id = ? ORDER BY id',
      [user.univ_id]
    );

    // 4) 기관 내 센서 목록(보유 현황)
    const [sensors] = await db.query('SELECT * FROM sensor WHERE univ_id = ?', [user.univ_id]);

    // 5) 가동중 센서 로그
    const [logs] = await db.query(
      `
      SELECT 
        l.sensor_id, l.aquarium_id, s.type AS sensor_type, a.name AS aquarium_name
      FROM sensor_usage_log l
      JOIN sensor s   ON l.sensor_id = s.id
      JOIN aquarium a ON l.aquarium_id = a.id
      JOIN user u     ON l.user_id = u.id
      WHERE u.univ_id = ? AND l.stopped_at IS NULL
    `,
      [user.univ_id]
    );

    // ★ 타입 정규화 (과거 명칭 → 현재 컬럼명으로 통일)
    const normalizeType = (t = '') => {
      const k = String(t).toLowerCase().trim();
      const map = {
        ph: 'ph',
        orp: 'orp',
        tds: 'tds',
        do_val: 'do_val', // 현재 컬럼
        ec: 'ec',
        turbidity: 'turbidity',
        // 구 명칭 호환
        do: 'do_val',
        salt: 'ec',
        turbi: 'turbidity'
      };
      return map[k] || k;
    };

    // 값 포맷(소수점 2자리)
    const formatValue = (val) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      const num = Number(val);
      // 소수점 2자리까지 표시하되, .00이면 정수로, 0이 아닌 소수부만 유지
      return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
    };

    // 수조별 deviceId 묶기 (N+1 줄이기용 캐시)
    const deviceIds = Array.from(
      new Set(aquariums.map((a) => a.device_id).filter(Boolean))
    );

    // deviceId → 최신 1행 매핑
    const latestByDevice = new Map();
    if (deviceIds.length) {
      // 한번에 최신행 뽑는 쿼리 (deviceId별 최신 ts 조합)
      const [rows] = await db.query(
        `
        SELECT sd.deviceId, sd.ph, sd.orp, sd.tds, sd.do_val, sd.ec, sd.turbidity, sd.ts AS latest_ts
        FROM sensor_data sd
        JOIN (
          SELECT deviceId, MAX(ts) AS latest_ts
          FROM sensor_data
          WHERE deviceId IN ( ${deviceIds.map(() => '?').join(',')} )
          GROUP BY deviceId
        ) t ON t.deviceId = sd.deviceId AND t.latest_ts = sd.ts
      `,
        deviceIds
      );

      rows.forEach((r) => latestByDevice.set(r.deviceId, r));
    }

    // 수조별 응답 조립
    let aquariumStatus = aquariums.map((aq) => {
      const activeLogs = logs.filter((log) => log.aquarium_id === aq.id);
      const latestRow = aq.device_id ? latestByDevice.get(aq.device_id) || null : null;

      // 이 수조의 최신값 맵
      const latestMap = {};
      ['ph', 'orp', 'tds', 'do_val', 'ec', 'turbidity'].forEach((type) => {
        latestMap[type] = latestRow
          ? {
              value: latestRow[type] != null ? formatValue(latestRow[type]) : null,
              updated_at: latestRow.latest_ts || null
            }
          : { value: null, updated_at: null };
      });

      const activeSensors = activeLogs.map((log) => {
        const key = normalizeType(log.sensor_type);
        const val = latestMap[key] || {};
        return {
          type: key, // ← 백엔드 타입 그대로 내려줌 (프론트에서 라벨 매핑)
          value: val.value ?? null,
          updated_at: val.updated_at ?? null
        };
      });

      return {
        aquarium_id: aq.id,
        name: aq.name,
        location: aq.location,
        fish_type: aq.fish_type,
        activeSensors,
        status: activeSensors.length ? '가동중' : '센서 없음'
      };
    });

    // 🔥 NEW 1) 모든 수조의 센서를 1번 수조에 몰아서 보여주기
    if (aquariumStatus.length > 0) {
      const mergedByType = new Map();

      // 모든 수조에서 센서 모아서 타입별로 하나만 남기기 (가장 최신 updated_at 기준)
      aquariumStatus.forEach((aq) => {
        aq.activeSensors.forEach((s) => {
          const prev = mergedByType.get(s.type);
          if (!prev || (prev.updated_at || '') < (s.updated_at || '')) {
            mergedByType.set(s.type, s);
          }
        });
      });

      // 1번 수조(배열 첫 번째)에만 몰아서 넣기
      aquariumStatus[0].activeSensors = Array.from(mergedByType.values());
      aquariumStatus[0].status = aquariumStatus[0].activeSensors.length
        ? '가동중'
        : '센서 없음';

      // 나머지 수조는 센서 정보 제거
      for (let i = 1; i < aquariumStatus.length; i++) {
        aquariumStatus[i].activeSensors = [];
        aquariumStatus[i].status = '센서 없음';
      }

      // 🔥 NEW 2) 수조는 최대 3개까지만 보내기
      aquariumStatus = aquariumStatus.slice(0, 3);
    }

    // ✅ 최종 응답 (기존 구조 유지)
    res.json({
      user_id: user.id,
      univ_id: user.univ_id,
      univ_name: univ.name,
      sensors,
      aquariums: aquariumStatus
    });
  } catch (err) {
    console.error('❌ [user-info] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ 2. 센서 작동 시작
 */
app.post('/api/start-sensor', async (req, res) => {
  const { user_id, aquarium_id, sensor_id } = req.body;

  try {
    const [[existing]] = await db.query(
      `SELECT * FROM sensor_usage_log WHERE sensor_id = ? AND stopped_at IS NULL`,
      [sensor_id]
    );
    if (existing) {
      return res.status(400).json({ status: '센서가 이미 사용 중입니다.' });
    }

    await db.query(
      `
      INSERT INTO sensor_usage_log (sensor_id, aquarium_id, user_id, started_at)
      VALUES (?, ?, ?, NOW())
    `,
      [sensor_id, aquarium_id, user_id]
    );

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('❌ [start-sensor] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ 3. 수조별 로그 조회
 */
app.get('/api/aquarium-log/:aquarium_id', async (req, res) => {
  const { aquarium_id } = req.params;

  try {
    const [logs] = await db.query(
      `
      SELECT log.*, u.name AS user_name, s.type AS sensor_type
      FROM sensor_usage_log log
      JOIN user u ON log.user_id = u.id
      JOIN sensor s ON log.sensor_id = s.id
      WHERE log.aquarium_id = ?
      ORDER BY log.started_at DESC
    `,
      [aquarium_id]
    );

    res.json({ logs });
  } catch (err) {
    console.error('❌ [aquarium-log] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ 4. 센서 작동 중지
 */
app.post('/api/stop-sensor', async (req, res) => {
  const { sensor_id } = req.body;

  try {
    const [[active]] = await db.query(
      `
      SELECT * FROM sensor_usage_log
      WHERE sensor_id = ? AND stopped_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `,
      [sensor_id]
    );

    if (!active) {
      return res
        .status(400)
        .json({ status: '해당 센서는 현재 작동 중이 아닙니다.' });
    }

    await db.query(
      `
      UPDATE sensor_usage_log SET stopped_at = NOW() WHERE id = ?
    `,
      [active.id]
    );

    res.json({ status: '센서 작동 중지 완료', stopped_log_id: active.id });
  } catch (err) {
    console.error('❌ [stop-sensor] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * ✅ 5. 최근 이상치 조회 (60분 내)
 */
app.get('/api/anomaly-recent', async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT al.sensor_type, al.value, al.created_at, su.aquarium_id
      FROM anomaly_log al
      JOIN sensor s ON s.type = al.sensor_type
      JOIN sensor_usage_log su ON su.sensor_id = s.id
      WHERE su.stopped_at IS NULL
        AND al.created_at >= NOW() - INTERVAL 60 MINUTE
      ORDER BY al.created_at DESC
    `
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ [anomaly-recent] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});