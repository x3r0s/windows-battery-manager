'use strict';

function fmtMwh(v) {
  if (v === null || v === undefined) return '-';
  return (v < 0 ? '' : '') + Math.abs(v).toLocaleString() + ' mWh';
}

function fmtDuration(str) {
  if (!str) return '-';
  return str;
}

window.BatteryUsageView = {
  render(data) {
    const entries = data.batteryUsage || [];
    if (entries.length === 0) {
      return `
        <div class="view-header"><div class="view-title">배터리 소모</div></div>
        <div class="no-data">배터리 소모 데이터가 없습니다.</div>
      `;
    }

    // 유효한 에너지 데이터가 있는 항목만 통계 계산
    const withEnergy = entries.filter(e => e.energyMwh !== null);
    const totalDrain = withEnergy.reduce((sum, e) => sum + Math.abs(e.energyMwh || 0), 0);
    const avgDrain = withEnergy.length > 0 ? totalDrain / withEnergy.length : 0;

    const activeEntries = entries.filter(e => e.state && e.state.toLowerCase().includes('active'));
    const standbyEntries = entries.filter(e => e.state && e.state.toLowerCase().includes('standby'));

    const activeDrain = activeEntries.filter(e => e.energyMwh !== null)
      .reduce((s, e) => s + Math.abs(e.energyMwh || 0), 0);
    const standbyDrain = standbyEntries.filter(e => e.energyMwh !== null)
      .reduce((s, e) => s + Math.abs(e.energyMwh || 0), 0);

    return `
      <div class="view-header">
        <div class="view-title">배터리 소모</div>
        <div class="view-subtitle">최근 7일간의 배터리 방전 이벤트 (총 ${entries.length}개)</div>
      </div>

      <!-- 요약 카드 -->
      <div class="card-grid card-grid-4">
        <div class="card">
          <div class="card-label">총 방전 이벤트</div>
          <div class="card-value">${entries.length}</div>
          <div class="card-sub">개</div>
        </div>
        <div class="card">
          <div class="card-label">총 소모량</div>
          <div class="card-value" style="font-size:20px; color:var(--color-battery);">${Math.round(totalDrain).toLocaleString()}</div>
          <div class="card-sub">mWh</div>
        </div>
        <div class="card">
          <div class="card-label">Active 소모</div>
          <div class="card-value" style="font-size:20px;">${Math.round(activeDrain).toLocaleString()}</div>
          <div class="card-sub">mWh (${activeEntries.length}회)</div>
        </div>
        <div class="card">
          <div class="card-label">Standby 소모</div>
          <div class="card-value" style="font-size:20px;">${Math.round(standbyDrain).toLocaleString()}</div>
          <div class="card-sub">mWh (${standbyEntries.length}회)</div>
        </div>
      </div>

      <!-- 소모량 차트 -->
      <div class="chart-card">
        <div class="chart-card-title">이벤트별 소모량 (mWh)</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-dot" style="background:#ff6b6b;"></div>
            Active
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:#ffd43b;"></div>
            Connected Standby
          </div>
        </div>
        <div class="chart-wrapper" style="height:240px;">
          <canvas id="usage-chart"></canvas>
        </div>
      </div>

      <!-- 이벤트 테이블 -->
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <span class="data-table-title">방전 이벤트 목록</span>
          <span class="data-table-count">${entries.length}개</span>
        </div>
        <div style="max-height:400px; overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>날짜/시간</th>
                <th class="center">상태</th>
                <th class="right">지속시간</th>
                <th class="right">소모 (%)</th>
                <th class="right">소모 (mWh)</th>
              </tr>
            </thead>
            <tbody>
              ${entries.slice().reverse().map(entry => `
                <tr>
                  <td class="mono">${entry.dateTime}</td>
                  <td class="center">
                    <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:${entry.state && entry.state.toLowerCase().includes('active') ? '#ff6b6b20' : '#ffd43b20'}; color:${entry.state && entry.state.toLowerCase().includes('active') ? '#ff6b6b' : '#ffd43b'};">
                      ${entry.state || '-'}
                    </span>
                  </td>
                  <td class="right mono">${fmtDuration(entry.duration)}</td>
                  <td class="right mono">${entry.energyPercent !== null ? entry.energyPercent + ' %' : '-'}</td>
                  <td class="right mono" style="color:var(--color-battery);">${fmtMwh(entry.energyMwh)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  initCharts(data) {
    const entries = data.batteryUsage || [];
    const canvas = document.getElementById('usage-chart');
    if (!canvas || entries.length === 0) return [];

    // 소모량이 있는 최근 30개 이벤트
    const withEnergy = entries.filter(e => e.energyMwh !== null).slice(-30);

    const labels = withEnergy.map(e => e.dateTime.slice(-8));
    const values = withEnergy.map(e => Math.abs(e.energyMwh || 0));
    const colors = withEnergy.map(e =>
      e.state && e.state.toLowerCase().includes('active') ? '#ff6b6b' : '#ffd43b'
    );

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '소모량 (mWh)',
          data: values,
          backgroundColor: colors,
          borderRadius: 3,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => withEnergy[items[0].dataIndex]?.dateTime || '',
              label: (item) => {
                const e = withEnergy[item.dataIndex];
                return [
                  ` 소모: ${item.raw.toLocaleString()} mWh`,
                  ` 상태: ${e?.state || '-'}`,
                  ` 지속: ${e?.duration || '-'}`,
                ];
              },
            },
            backgroundColor: '#1a1a2e',
            borderColor: '#2a2a40',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#9090a8',
              maxRotation: 30,
              autoSkip: true,
              maxTicksLimit: 10,
              font: { size: 10, family: 'Consolas' },
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: '#9090a8',
              callback: (v) => v.toLocaleString(),
              font: { size: 11 },
            },
            grid: { color: '#2a2a40' },
          },
        },
      },
    });

    return [chart];
  },
};
