'use strict';

const CHART_COLORS = {
  battery: '#ff6b6b',
  ac: '#51cf66',
  standby: '#ffd43b',
  grid: '#2a2a40',
};

window.RecentActivityView = {
  render(data) {
    const entries = data.recentUsage || [];
    if (entries.length === 0) {
      return `
        <div class="view-header"><div class="view-title">최근 활동</div></div>
        <div class="no-data">최근 사용 기록이 없습니다.</div>
      `;
    }

    // 테이블에 표시할 최근 100개
    const tableEntries = entries.slice(-100).reverse();

    return `
      <div class="view-header">
        <div class="view-title">최근 활동</div>
        <div class="view-subtitle">최근 7일간의 전원 상태 전환 기록 (총 ${entries.length}개)</div>
      </div>

      <!-- 배터리 잔량 추이 차트 -->
      <div class="chart-card">
        <div class="chart-card-title">배터리 잔량 추이 (최근 7일)</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-dot" style="background:${CHART_COLORS.battery};"></div>
            Battery (방전)
          </div>
          <div class="legend-item">
            <div class="legend-dot" style="background:${CHART_COLORS.ac};"></div>
            AC (충전/유지)
          </div>
        </div>
        <div class="chart-wrapper" style="height:280px;">
          <canvas id="activity-chart"></canvas>
        </div>
      </div>

      <!-- 이벤트 로그 테이블 -->
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <span class="data-table-title">전원 상태 전환 로그</span>
          <span class="data-table-count">최근 100개 표시 (전체 ${entries.length}개)</span>
        </div>
        <div style="max-height:420px; overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>날짜/시간</th>
                <th>상태</th>
                <th class="center">전원</th>
                <th class="right">잔량 (%)</th>
                <th class="right">잔량 (mWh)</th>
              </tr>
            </thead>
            <tbody>
              ${tableEntries.map(entry => `
                <tr>
                  <td class="mono">${entry.dateTime}</td>
                  <td>${entry.state}</td>
                  <td class="center">
                    <span class="source-badge ${entry.source && entry.source.toLowerCase() === 'ac' ? 'ac' : 'battery'}">${entry.source || '-'}</span>
                  </td>
                  <td class="right mono">${entry.capacityPercent !== null ? entry.capacityPercent + ' %' : '-'}</td>
                  <td class="right mono">${entry.capacityMwh !== null ? entry.capacityMwh.toLocaleString() + ' mWh' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  initCharts(data) {
    const entries = data.recentUsage || [];
    if (entries.length === 0) return [];

    const canvas = document.getElementById('activity-chart');
    if (!canvas) return [];

    // 데이터 포인트 준비 (최근 200개로 제한, 잔량이 있는 것만)
    const points = entries
      .filter(e => e.capacityPercent !== null)
      .slice(-200);

    const labels = points.map(e => e.dateTime.slice(-8)); // 시간 부분만
    const values = points.map(e => e.capacityPercent);
    const pointColors = points.map(e =>
      e.source && e.source.toLowerCase() === 'ac' ? CHART_COLORS.ac : CHART_COLORS.battery
    );
    const bgColors = points.map(e =>
      e.source && e.source.toLowerCase() === 'ac' ? CHART_COLORS.ac + '30' : CHART_COLORS.battery + '30'
    );

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '배터리 잔량 (%)',
          data: values,
          borderColor: function(ctx) {
            const i = ctx.dataIndex;
            return pointColors[i] || CHART_COLORS.battery;
          },
          backgroundColor: bgColors,
          segment: {
            borderColor: function(ctx) {
              const i = ctx.p0DataIndex;
              return pointColors[i] || CHART_COLORS.battery;
            },
          },
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 1.5,
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
              title: (items) => points[items[0].dataIndex]?.dateTime || '',
              label: (item) => {
                const p = points[item.dataIndex];
                return [
                  ` 잔량: ${item.raw}%`,
                  ` 전원: ${p?.source || '-'}`,
                  ` 상태: ${p?.state || '-'}`,
                ];
              },
            },
            backgroundColor: '#1a1a2e',
            borderColor: '#2a2a40',
            borderWidth: 1,
            titleColor: '#f0f0f0',
            bodyColor: '#9090a8',
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#9090a8',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
              font: { size: 10, family: 'Consolas' },
            },
            grid: { color: CHART_COLORS.grid },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: '#9090a8',
              callback: (v) => v + '%',
              font: { size: 11 },
            },
            grid: { color: CHART_COLORS.grid },
          },
        },
      },
    });

    return [chart];
  },
};
