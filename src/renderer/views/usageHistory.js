'use strict';

function secsToHours(secs) {
  if (secs === null || secs === undefined) return 0;
  return Math.round(secs / 360) / 10; // 소수 1자리
}

function fmtHms(str) {
  if (!str) return '-';
  return str;
}

window.UsageHistoryView = {
  render(data) {
    const history = data.usageHistory || [];
    if (history.length === 0) {
      return `
        <div class="view-header"><div class="view-title">사용 이력</div></div>
        <div class="no-data">사용 이력 데이터가 없습니다.</div>
      `;
    }

    return `
      <div class="view-header">
        <div class="view-title">사용 이력</div>
        <div class="view-subtitle">기간별 배터리 vs AC 사용 시간 이력 (${history.length}개 기간)</div>
      </div>

      <!-- 스택 막대 차트 -->
      <div class="chart-card">
        <div class="chart-card-title">기간별 사용 시간 (시간 단위)</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-dot" style="background:#ff6b6b;"></div>
            배터리 Active
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:#ff6b6b60;"></div>
            배터리 Standby
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:#51cf66;"></div>
            AC Active
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:#51cf6660;"></div>
            AC Standby
          </div>
        </div>
        <div class="chart-wrapper" style="height:300px;">
          <canvas id="history-chart"></canvas>
        </div>
      </div>

      <!-- 상세 테이블 -->
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <span class="data-table-title">기간별 상세 이력</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>기간</th>
              <th class="right" style="color:#ff6b6b;">배터리 Active</th>
              <th class="right" style="color:#ff6b6b80;">배터리 Standby</th>
              <th class="right" style="color:#51cf66;">AC Active</th>
              <th class="right" style="color:#51cf6680;">AC Standby</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(row => `
              <tr>
                <td class="mono secondary">${row.period}</td>
                <td class="right mono" style="color:#ff6b6b;">${fmtHms(row.batteryActiveStr)}</td>
                <td class="right mono secondary">${fmtHms(row.batteryStandbyStr)}</td>
                <td class="right mono" style="color:#51cf66;">${fmtHms(row.acActiveStr)}</td>
                <td class="right mono secondary">${fmtHms(row.acStandbyStr)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  initCharts(data) {
    const history = data.usageHistory || [];
    const canvas = document.getElementById('history-chart');
    if (!canvas || history.length === 0) return [];

    const labels = history.map(r => {
      // 기간 문자열 단축: "2026-01-01 - 2026-01-08" → "1/1-1/8"
      const parts = r.period.split('-').map(s => s.trim());
      if (parts.length >= 2) {
        const m1 = parts[0].slice(5); // MM-DD
        const m2 = parts[parts.length - 1].slice(5);
        return m1 && m2 ? `${m1}~${m2}` : r.period.slice(0, 10);
      }
      return r.period.slice(0, 10);
    });

    const battActive = history.map(r => secsToHours(r.batteryActiveSeconds));
    const battStandby = history.map(r => secsToHours(r.batteryStandbySeconds));
    const acActive = history.map(r => secsToHours(r.acActiveSeconds));
    const acStandby = history.map(r => secsToHours(r.acStandbySeconds));

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '배터리 Active',
            data: battActive,
            backgroundColor: '#ff6b6b',
            stack: 'battery',
            borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 2, bottomRight: 2 },
          },
          {
            label: '배터리 Standby',
            data: battStandby,
            backgroundColor: '#ff6b6b50',
            stack: 'battery',
            borderRadius: { topLeft: 2, topRight: 2, bottomLeft: 0, bottomRight: 0 },
          },
          {
            label: 'AC Active',
            data: acActive,
            backgroundColor: '#51cf66',
            stack: 'ac',
            borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 2, bottomRight: 2 },
          },
          {
            label: 'AC Standby',
            data: acStandby,
            backgroundColor: '#51cf6650',
            stack: 'ac',
            borderRadius: { topLeft: 2, topRight: 2, bottomLeft: 0, bottomRight: 0 },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            callbacks: {
              title: (items) => history[items[0].dataIndex]?.period || '',
              label: (item) => ` ${item.dataset.label}: ${item.raw}h`,
            },
            backgroundColor: '#1a1a2e',
            borderColor: '#2a2a40',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: '#9090a8',
              font: { size: 10, family: 'Consolas' },
              maxRotation: 30,
            },
            grid: { display: false },
          },
          y: {
            stacked: true,
            ticks: {
              color: '#9090a8',
              callback: (v) => v + 'h',
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
