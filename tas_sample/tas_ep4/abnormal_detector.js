// abnormal_detector.js

function is_abnormal(sensor_data) {
    const { nh4, ph, turbi, salt, do: DO, temp } = sensor_data;

    let score = 0;

    if (typeof ph === 'number' && (ph < 6 || ph > 9)) score += 0.3;
    if (typeof DO === 'number' && DO < 3) score += 0.3;
    if (typeof temp === 'number' && (temp < 0 || temp > 35)) score += 0.2;
    if (typeof turbi === 'number' && turbi > 100) score += 0.1;
    if (typeof nh4 === 'number' && nh4 > 5) score += 0.1;

    return {
        is_abnormal: score >= 0.5,
        score: score
    };
}

module.exports = { is_abnormal };
