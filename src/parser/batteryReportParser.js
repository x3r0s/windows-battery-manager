'use strict';

const cheerio = require('cheerio');

/**
 * mWh 문자열에서 숫자 추출: "52,330 mWh" → 52330
 */
function parseMwh(str) {
  if (!str) return null;
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * % 문자열에서 숫자 추출: "100 %" → 100
 */
function parsePercent(str) {
  if (!str) return null;
  const match = str.match(/([\d.]+)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * h:mm:ss 문자열을 초로 변환: "2:30:45" → 9045
 * 매우 큰 값(overflow)은 null 반환
 */
function hmsToSeconds(str) {
  if (!str || str.trim() === '-' || str.trim() === '') return null;
  const parts = str.trim().split(':');
  if (parts.length !== 3) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(parts[2], 10);
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  // 10000시간 초과 → overflow/buggy data
  if (h > 10000) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * 초를 h:mm:ss 형식으로 변환
 */
function secondsToHms(secs) {
  if (secs === null) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 시스템 정보 파싱 (첫 번째 table)
 */
function parseSystemInfo($) {
  const info = {};
  // 첫 번째 table의 tr들을 순회
  $('table').first().find('tr').each((_i, row) => {
    const $row = $(row);
    // label은 .label 클래스 td 또는 span.label을 가진 td
    const labelEl = $row.find('td').first();
    const labelText = labelEl.find('.label').text().trim() || labelEl.text().trim();
    if (!labelText) return;

    const valueTd = $row.find('td').eq(1);
    // dateTime 셀은 date/time span으로 분리됨
    let value;
    if (valueTd.hasClass('dateTime')) {
      const date = valueTd.find('.date').text().trim();
      const time = valueTd.find('.time').text().trim();
      value = `${date} ${time}`.trim();
    } else {
      value = valueTd.text().trim();
    }
    if (labelText && value) {
      info[labelText.toUpperCase().replace(/\s+/g, '_')] = value;
    }
  });
  return info;
}

/**
 * 설치된 배터리 정보 파싱
 */
function parseBatteries($) {
  const batteries = [];
  let inBatteriesSection = false;

  $('h2, table').each((_i, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h2') {
      inBatteriesSection = $(el).text().toLowerCase().includes('installed batter');
      return;
    }

    if (!inBatteriesSection) return;

    // 배터리 테이블 파싱
    const battery = {};
    $(el).find('tr').each((_j, row) => {
      const $row = $(row);
      if ($row.attr('style') && $row.attr('style').includes('height')) return; // 구분선 행 건너뜀

      const labelEl = $row.find('span.label');
      if (!labelEl.length) return;

      const label = labelEl.text().trim().toUpperCase().replace(/\s+/g, '_');
      const value = $row.find('td').last().text().trim();
      if (label && value) battery[label] = value;
    });

    if (Object.keys(battery).length > 0) {
      // 숫자 파싱
      const designRaw = battery['DESIGN_CAPACITY'] || '';
      const fullRaw = battery['FULL_CHARGE_CAPACITY'] || '';
      const cycleRaw = battery['CYCLE_COUNT'] || '';

      batteries.push({
        name: battery['NAME'] || '',
        manufacturer: battery['MANUFACTURER'] || '',
        serialNumber: battery['SERIAL_NUMBER'] || '',
        chemistry: battery['CHEMISTRY'] || '',
        designCapacity: parseMwh(designRaw),
        fullChargeCapacity: parseMwh(fullRaw),
        cycleCount: parseInt(cycleRaw, 10) || 0,
      });
    }
    inBatteriesSection = false; // 배터리는 보통 1개 테이블
  });

  return batteries;
}

/**
 * 최근 사용 기록 파싱 (최근 7일 AC/Battery 전환 이벤트)
 */
function parseRecentUsage($) {
  const entries = [];
  let inSection = false;
  let lastDate = '';

  $('h2, table').each((_i, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h2') {
      inSection = $(el).text().toLowerCase().includes('recent usage');
      return;
    }

    if (!inSection) return;
    inSection = false; // 한 테이블만 처리

    $(el).find('tr').each((_j, row) => {
      const $row = $(row);
      const cls = $row.attr('class') || '';
      // 헤더 행 건너뜀
      if ($row.closest('thead').length) return;
      // even/odd 행만 처리
      if (!cls.match(/even|odd/)) return;

      const dateTd = $row.find('td.dateTime');
      const dateStr = dateTd.find('.date').text().trim();
      const timeStr = dateTd.find('.time').text().trim();
      if (dateStr) lastDate = dateStr;

      const fullDateTime = `${lastDate} ${timeStr}`.trim();
      const state = $row.find('td.state').text().trim();
      const source = $row.find('td.acdc').text().trim();
      const percentStr = $row.find('td.percent').text().trim();
      const mwhStr = $row.find('td.mw').text().trim();

      entries.push({
        dateTime: fullDateTime,
        state,
        source,
        capacityPercent: parsePercent(percentStr),
        capacityMwh: parseMwh(mwhStr),
      });
    });
  });

  return entries;
}

/**
 * 배터리 소모 이벤트 파싱
 */
function parseBatteryUsage($) {
  const entries = [];
  let inSection = false;
  let lastDate = '';

  $('h2, table').each((_i, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h2') {
      inSection = $(el).text().toLowerCase().includes('battery usage');
      return;
    }

    if (!inSection) return;
    inSection = false;

    $(el).find('tr').each((_j, row) => {
      const $row = $(row);
      const cls = $row.attr('class') || '';

      if ($row.closest('thead').length) return;
      // noncontigbreak(구분선) 건너뜀
      if (cls.includes('noncontigbreak')) return;
      if (!cls.match(/even|odd/)) return;
      // dc 클래스가 있어야 배터리 방전 행
      if (!cls.includes('dc')) return;

      const dateTd = $row.find('td.dateTime');
      const dateStr = dateTd.find('.date').text().trim();
      const timeStr = dateTd.find('.time').text().trim();
      if (dateStr) lastDate = dateStr;

      const fullDateTime = `${lastDate} ${timeStr}`.trim();
      const state = $row.find('td.state').text().trim();
      const durationStr = $row.find('td.hms').text().trim();

      // percent와 mw는 nullValue일 수 있음
      const percentTd = $row.find('td.percent');
      const mwTd = $row.find('td.mw');
      const percentStr = percentTd.length ? percentTd.text().trim() : '-';
      const mwhStr = mwTd.length ? mwTd.text().trim() : '-';

      entries.push({
        dateTime: fullDateTime,
        state,
        duration: durationStr,
        durationSeconds: hmsToSeconds(durationStr),
        energyPercent: percentStr === '-' ? null : parsePercent(percentStr),
        energyMwh: mwhStr === '-' ? null : parseMwh(mwhStr),
      });
    });
  });

  return entries;
}

/**
 * 사용 이력 파싱 (일별/주별 battery vs AC)
 */
function parseUsageHistory($) {
  const entries = [];
  let inSection = false;

  $('h2, table').each((_i, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h2') {
      inSection = $(el).text().toLowerCase().includes('usage history');
      return;
    }

    if (!inSection) return;
    inSection = false;

    $(el).find('tr').each((_j, row) => {
      const $row = $(row);
      const cls = $row.attr('class') || '';

      if ($row.closest('thead').length) return;
      if (!cls.match(/even|odd/)) return;

      const period = $row.find('td.dateTime').text().trim().replace(/\s+/g, ' ');
      // hms 셀들을 순서대로: [0]=battery active, [1]=battery standby, [2]=AC active, [3]=AC standby
      const hmsCells = $row.find('td.hms');

      const batteryActive = hmsCells.eq(0).text().trim();
      const batteryStandby = hmsCells.eq(1).text().trim();
      const acActive = hmsCells.eq(2).text().trim();
      const acStandby = hmsCells.eq(3).text().trim();

      if (period) {
        entries.push({
          period,
          batteryActiveStr: batteryActive,
          batteryStandbyStr: batteryStandby,
          acActiveStr: acActive,
          acStandbyStr: acStandby,
          batteryActiveSeconds: hmsToSeconds(batteryActive),
          batteryStandbySeconds: hmsToSeconds(batteryStandby),
          acActiveSeconds: hmsToSeconds(acActive),
          acStandbySeconds: hmsToSeconds(acStandby),
        });
      }
    });
  });

  return entries;
}

/**
 * 배터리 수명 예측 파싱
 */
function parseEstimates($) {
  const weekly = [];
  const daily = [];
  let cumulative = null;
  let inSection = false;
  let tableIndex = 0;

  $('h2, table').each((_i, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h2') {
      inSection = $(el).text().toLowerCase().includes('battery life estimates');
      tableIndex = 0;
      return;
    }

    if (!inSection) return;
    tableIndex++;

    // 첫 번째 테이블: 주별/일별 예측
    if (tableIndex === 1) {
      $(el).find('tr').each((_j, row) => {
        const $row = $(row);
        const cls = $row.attr('class') || '';

        if ($row.closest('thead').length) return;
        if (!cls.match(/even|odd/)) return;

        const period = $row.find('td.dateTime').text().trim().replace(/\s+/g, ' ');
        const hmsCells = $row.find('td.hms');

        // col 0: period, hms[0]=FC active, hms[1]=FC standby, colBreak, hms[2]=DC active, hms[3]=DC standby
        // 각 standby 셀에는 <div>시간</div><span>%</span> 구조
        const fcActiveStr = hmsCells.eq(0).text().trim();
        const fcStandbyEl = hmsCells.eq(1);
        const fcStandbyStr = fcStandbyEl.find('div').text().trim() || fcStandbyEl.text().trim();

        const dcActiveStr = hmsCells.eq(2).text().trim();
        const dcStandbyEl = hmsCells.eq(3);
        const dcStandbyStr = dcStandbyEl.find('div').text().trim() || dcStandbyEl.text().trim();

        if (period) {
          const entry = {
            period,
            fcActiveStr,
            fcStandbyStr,
            dcActiveStr,
            dcStandbyStr,
            fcActiveSeconds: hmsToSeconds(fcActiveStr),
            fcStandbySeconds: hmsToSeconds(fcStandbyStr),
            dcActiveSeconds: hmsToSeconds(dcActiveStr),
            dcStandbySeconds: hmsToSeconds(dcStandbyStr),
          };

          // 날짜 범위로 주별 vs 일별 구분
          if (period.includes('-') && !period.match(/^\d{4}-\d{2}-\d{2}$/)) {
            weekly.push(entry);
          } else {
            daily.push(entry);
          }
        }
      });
    }

    // 두 번째 테이블: OS 설치 이후 누적 (있을 수 있음)
    if (tableIndex === 2) {
      $(el).find('tr').each((_j, row) => {
        const $row = $(row);
        if ($row.closest('thead').length) return;

        const label = $row.find('td').first().text().trim();
        if (label.toLowerCase().includes('since os')) {
          const hmsCells = $row.find('td.hms');
          const fcActive = hmsCells.eq(0).text().trim();
          const fcStandby = hmsCells.eq(1).find('div').text().trim() || hmsCells.eq(1).text().trim();
          const dcActive = hmsCells.eq(2).text().trim();
          const dcStandby = hmsCells.eq(3).find('div').text().trim() || hmsCells.eq(3).text().trim();

          cumulative = { label, fcActive, fcStandby, dcActive, dcStandby };
        }
      });
    }
  });

  return { weekly, daily, cumulative };
}

/**
 * 메인 파서 함수 — HTML 문자열을 받아 구조화된 데이터 반환
 */
function parseReport(html) {
  const $ = cheerio.load(html);

  const systemInfo = parseSystemInfo($);
  const batteries = parseBatteries($);
  const recentUsage = parseRecentUsage($);
  const batteryUsage = parseBatteryUsage($);
  const usageHistory = parseUsageHistory($);
  const estimates = parseEstimates($);

  // 배터리 헬스 계산
  const battery = batteries[0] || {};
  const healthScore = battery.designCapacity && battery.fullChargeCapacity
    ? Math.round((battery.fullChargeCapacity / battery.designCapacity) * 100 * 10) / 10
    : null;

  return {
    systemInfo,
    batteries,
    recentUsage,
    batteryUsage,
    usageHistory,
    estimates,
    healthScore,
    reportTime: systemInfo['REPORT_TIME'] || '',
  };
}

module.exports = { parseReport, hmsToSeconds, secondsToHms };
