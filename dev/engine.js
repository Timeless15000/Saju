/* ===== 사주팔자 계산 엔진 ===== */

const STEMS = [
  { h: '甲', k: '갑', e: '木', yang: true },
  { h: '乙', k: '을', e: '木', yang: false },
  { h: '丙', k: '병', e: '火', yang: true },
  { h: '丁', k: '정', e: '火', yang: false },
  { h: '戊', k: '무', e: '土', yang: true },
  { h: '己', k: '기', e: '土', yang: false },
  { h: '庚', k: '경', e: '金', yang: true },
  { h: '辛', k: '신', e: '金', yang: false },
  { h: '壬', k: '임', e: '水', yang: true },
  { h: '癸', k: '계', e: '水', yang: false },
];

const BRANCHES = [
  { h: '子', k: '자', e: '水', animal: '쥐' },
  { h: '丑', k: '축', e: '土', animal: '소' },
  { h: '寅', k: '인', e: '木', animal: '호랑이' },
  { h: '卯', k: '묘', e: '木', animal: '토끼' },
  { h: '辰', k: '진', e: '土', animal: '용' },
  { h: '巳', k: '사', e: '火', animal: '뱀' },
  { h: '午', k: '오', e: '火', animal: '말' },
  { h: '未', k: '미', e: '土', animal: '양' },
  { h: '申', k: '신', e: '金', animal: '원숭이' },
  { h: '酉', k: '유', e: '金', animal: '닭' },
  { h: '戌', k: '술', e: '土', animal: '개' },
  { h: '亥', k: '해', e: '水', animal: '돼지' },
];

// 지장간: [천간 index, 비중일수]
const HIDDEN_STEMS = [
  [[8, 10], [9, 20]],           // 자: 壬 癸
  [[9, 9], [7, 3], [5, 18]],    // 축: 癸 辛 己
  [[4, 7], [2, 7], [0, 16]],    // 인: 戊 丙 甲
  [[0, 10], [1, 20]],           // 묘: 甲 乙
  [[1, 9], [9, 3], [4, 18]],    // 진: 乙 癸 戊
  [[4, 7], [6, 7], [2, 16]],    // 사: 戊 庚 丙
  [[2, 10], [5, 10], [3, 10]],  // 오: 丙 己 丁
  [[3, 9], [1, 3], [5, 18]],    // 미: 丁 乙 己
  [[4, 7], [8, 7], [6, 16]],    // 신: 戊 壬 庚
  [[6, 10], [7, 20]],           // 유: 庚 辛
  [[7, 9], [3, 3], [4, 18]],    // 술: 辛 丁 戊
  [[4, 7], [0, 7], [8, 16]],    // 해: 戊 甲 壬
];

// 오행 상생: 木→火→土→金→水→木
const ELEMENTS = ['木', '火', '土', '金', '水'];
const EL_KO = { '木': '목', '火': '화', '土': '토', '金': '금', '水': '수' };
const GEN_NEXT = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' }; // 생하는 대상
const OVERCOME = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' }; // 극하는 대상

/* ===== 천문 계산 ===== */

// 그레고리력 → 율리우스일(JD, UT 기준). h는 0~24 실수 시간
function toJD(y, m, d, h) {
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5 + h / 24;
}

// JD → {y,m,d,h}
function fromJD(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { y: year, m: month, d: day, h: f * 24 };
}

// 태양의 시황경(도) — Meeus 근사식 (오차 수십 초 이내)
function sunLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const rad = Math.PI / 180;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * rad;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lambda % 360) + 360) % 360;
}

// 특정 황경(deg)에 도달하는 시각(JD)을 jdGuess 근처에서 탐색
function findSolarTerm(targetLon, jdGuess) {
  let jd = jdGuess;
  for (let i = 0; i < 50; i++) {
    let diff = targetLon - sunLongitude(jd);
    diff = ((diff + 180) % 360 + 360) % 360 - 180; // -180~180
    if (Math.abs(diff) < 1e-7) break;
    jd += diff * 365.2422 / 360; // 하루 약 0.9856도 이동
  }
  return jd;
}

const KST_OFFSET = 9 / 24; // 한국표준시 = UT+9h

// 절기 이름 (황경 315도부터 30도 간격 = 인월 순서)
const TERM_NAMES = ['입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동', '대설', '소한'];

/* ===== 사주 계산 ===== */

// KST 시각의 JD (UT 기준으로 변환된 값)
function kstToJD(y, m, d, hour, min) {
  return toJD(y, m, d, hour + min / 60) - KST_OFFSET;
}

// 년주: 입춘 기준
function yearPillar(jdUT, calYear) {
  // 그 해 입춘(황경 315도, 2/4 근처) 시각
  const ipchun = findSolarTerm(315, toJD(calYear, 2, 4, 0) - KST_OFFSET);
  const sajuYear = jdUT >= ipchun ? calYear : calYear - 1;
  const idx = ((sajuYear - 4) % 60 + 60) % 60;
  return { stem: idx % 10, branch: idx % 12, sajuYear };
}

// 월주: 태양 황경 30도 구간 + 오호둔
function monthPillar(jdUT, yearStem) {
  const lon = sunLongitude(jdUT);
  const sector = Math.floor((((lon - 315) % 360) + 360) % 360 / 30); // 0=인월
  const branch = (sector + 2) % 12;
  // 오호둔: 갑기년→병인월, 을경년→무인월, 병신년→경인월, 정임년→임인월, 무계년→갑인월
  const firstStem = [2, 4, 6, 8, 0][yearStem % 5];
  const stem = (firstStem + sector) % 10;
  return { stem, branch, sector };
}

// 일주: JD 기반 60갑자 (자정 기준 날짜 사용, KST)
function dayPillar(y, m, d) {
  const jdn = Math.round(toJD(y, m, d, 12)); // 정오 기준 JDN
  const idx = ((jdn + 49) % 60 + 60) % 60; // JDN 기준: 1900-01-01(JDN 2415021) = 갑술일
  return { stem: idx % 10, branch: idx % 12 };
}

// 시주: 오서둔
function hourPillar(dayStem, hour, min) {
  const t = hour * 60 + min;
  const branch = Math.floor(((t + 60) % 1440) / 120); // 23:00~00:59 = 자(0)
  const firstStem = [0, 2, 4, 6, 8][dayStem % 5]; // 갑기일→갑자시 ...
  const stem = (firstStem + branch) % 10;
  return { stem, branch };
}

// 대운
function daeun(jdUT, yearStemYang, isMale, monthStem, monthBranch, birthYear) {
  const forward = (yearStemYang && isMale) || (!yearStemYang && !isMale);
  // 다음/이전 절(節) 시각 탐색: 황경이 315+30k 도가 되는 시점
  const lon = sunLongitude(jdUT);
  const sectorPos = (((lon - 315) % 360) + 360) % 360; // 현재 구간 내 진행 각도
  let targetLon, guess;
  if (forward) {
    targetLon = (315 + (Math.floor(sectorPos / 30) + 1) * 30) % 360;
    guess = jdUT + (30 - (sectorPos % 30)) * 365.2422 / 360;
  } else {
    targetLon = (315 + Math.floor(sectorPos / 30) * 30) % 360;
    guess = jdUT - (sectorPos % 30) * 365.2422 / 360;
  }
  const termJD = findSolarTerm(targetLon, guess);
  const days = Math.abs(termJD - jdUT);
  let startAge = Math.round(days / 3);
  if (startAge < 1) startAge = 1;
  if (startAge > 10) startAge = 10;

  // 월주 60갑자 index
  let cur = -1;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === monthStem && i % 12 === monthBranch) { cur = i; break; }
  }
  const list = [];
  for (let i = 1; i <= 8; i++) {
    const idx = ((cur + (forward ? i : -i)) % 60 + 60) % 60;
    list.push({
      age: startAge + (i - 1) * 10,
      year: birthYear + startAge + (i - 1) * 10 - 1,
      stem: idx % 10,
      branch: idx % 12,
    });
  }
  return { forward, startAge, list };
}

// 십신: 일간 기준으로 다른 천간의 관계
const SIBSIN_NAMES = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
function sibsin(dayStem, otherStem) {
  const me = STEMS[dayStem], other = STEMS[otherStem];
  const samePolarity = me.yang === other.yang;
  let base;
  if (other.e === me.e) base = 0;                    // 비견/겁재
  else if (other.e === GEN_NEXT[me.e]) base = 2;     // 식신/상관 (내가 생함)
  else if (other.e === OVERCOME[me.e]) base = 4;     // 편재/정재 (내가 극함)
  else if (OVERCOME[other.e] === me.e) base = 6;     // 편관/정관 (나를 극함)
  else base = 8;                                     // 편인/정인 (나를 생함)
  return base + (samePolarity ? 0 : 1);
}

// 지지의 십신은 본기(지장간 마지막) 기준
function branchMainStem(branch) {
  const hs = HIDDEN_STEMS[branch];
  return hs[hs.length - 1][0];
}

// 오행 분포 (지장간 가중 포함)
function elementDistribution(pillars) {
  const counts = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  for (const p of pillars) {
    if (!p) continue;
    counts[STEMS[p.stem].e] += 1;
    // 지지: 지장간 비중대로 배분 (합계 1)
    const hs = HIDDEN_STEMS[p.branch];
    const total = hs.reduce((s, x) => s + x[1], 0);
    for (const [st, w] of hs) counts[STEMS[st].e] += w / total;
  }
  return counts;
}

// 신강/신약 판정 (간단 가중치 모델)
function strength(pillars, dayStem) {
  const me = STEMS[dayStem].e;
  const genMe = ELEMENTS.find(e => GEN_NEXT[e] === me); // 나를 생하는 오행 (인성)
  const weights = { yearS: 6, yearB: 8, monthS: 8, monthB: 30, dayB: 15, hourS: 6, hourB: 8 };
  let support = 0, total = 0;
  const add = (el, w) => { total += w; if (el === me || el === genMe) support += w; };
  const [yp, mp, dp, hp] = pillars;
  add(STEMS[yp.stem].e, weights.yearS);
  add(STEMS[branchMainStem(yp.branch)].e, weights.yearB);
  add(STEMS[mp.stem].e, weights.monthS);
  add(STEMS[branchMainStem(mp.branch)].e, weights.monthB);
  add(STEMS[branchMainStem(dp.branch)].e, weights.dayB);
  if (hp) { add(STEMS[hp.stem].e, weights.hourS); add(STEMS[branchMainStem(hp.branch)].e, weights.hourB); }
  const ratio = support / total;
  return { ratio, strong: ratio >= 0.5 };
}

// 종합 계산
// tzOffsetMin: 출생지 표준시의 UTC 오프셋(분, 기본 한국 +540)
// lmtCorrMin: 진태양시 보정분 = round(경도×4 − tzOffsetMin). 서울 −32, 부산 −24 등
function computeSaju({ year, month, day, hour, minute, isMale, unknownTime, solarTimeCorrection, tzOffsetMin = 540, lmtCorrMin = -32 }) {
  let y = year, m = month, d = day, hh = hour, mm = minute;
  if (!unknownTime && solarTimeCorrection && lmtCorrMin) {
    const c = fromJD(toJD(y, m, d, hh + mm / 60) + lmtCorrMin / 1440);
    y = c.y; m = c.m; d = c.d;
    mm = Math.round(c.h * 60);
    hh = Math.floor(mm / 60) % 24; mm = mm % 60;
  }
  const jdUT = toJD(y, m, d, (unknownTime ? 12 : hh) + (unknownTime ? 0 : mm) / 60) - tzOffsetMin / 1440;
  const yp = yearPillar(jdUT, y);
  const mp = monthPillar(jdUT, yp.stem);
  const dp = dayPillar(y, m, d);
  const hp = unknownTime ? null : hourPillar(dp.stem, hh, mm);
  const pillars = [yp, mp, dp, hp];
  const dist = elementDistribution(pillars);
  const str = strength(pillars, dp.stem);
  const du = daeun(jdUT, STEMS[yp.stem].yang, isMale, mp.stem, mp.branch, yp.sajuYear);
  return { yp, mp, dp, hp, dist, str, daeun: du, corrected: { y, m, d, hh, mm } };
}

function ganjiName(stem, branch) {
  return STEMS[stem].k + BRANCHES[branch].k + '(' + STEMS[stem].h + BRANCHES[branch].h + ')';
}

/* ============================================================
   신살(神煞) · 12운성 · 공망
   ============================================================ */
// 삼합 국(局) 기준: 각 지지가 속한 그룹의 도화·역마·화개 지지
const SAMHAP_INFO = (() => {
  const groups = [
    { members: [8, 0, 4], dohwa: 9, yeokma: 2, hwagae: 4 },   // 신자진(水局) → 유·인·진
    { members: [2, 6, 10], dohwa: 3, yeokma: 8, hwagae: 10 }, // 인오술(火局) → 묘·신·술
    { members: [5, 9, 1], dohwa: 6, yeokma: 11, hwagae: 1 },  // 사유축(金局) → 오·해·축
    { members: [11, 3, 7], dohwa: 0, yeokma: 5, hwagae: 7 },  // 해묘미(木局) → 자·사·미
  ];
  const byBranch = [];
  for (const g of groups) for (const m of g.members) byBranch[m] = g;
  return byBranch;
})();
// 천을귀인: 일간 → 귀인 지지
const CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [5, 3], [5, 3]];
// 문창귀인: 일간 → 지지
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
// 양인: 양간 → 지지 (음간은 해당 없음 = -1)
const YANGIN = [3, -1, 6, -1, 6, -1, 9, -1, 0, -1];
// 백호대살 간지 (stem, branch)
const BAEKHO = [[0, 4], [1, 7], [2, 10], [3, 1], [4, 4], [8, 10], [9, 1]];
// 괴강 간지 (일주 기준이 정법, 타주도 참고 표시)
const GOEGANG = [[6, 4], [6, 10], [8, 4], [8, 10], [4, 10]];
// 공망: 일주 기준 순중공망 지지 2개
function gongmang(dayStem, dayBranch) {
  const xun = ((dayBranch - dayStem) % 12 + 12) % 12;
  return [(xun + 10) % 12, (xun + 11) % 12];
}
// 12운성: 일간 vs 지지
const STAGE_NAMES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
const STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 각 천간의 장생 지지
function twelveStage(stem, branch) {
  const start = STAGE_START[stem];
  const idx = STEMS[stem].yang ? ((branch - start) % 12 + 12) % 12 : ((start - branch) % 12 + 12) % 12;
  return STAGE_NAMES[idx];
}
// 원국 신살 목록: pillars = [yp, mp, dp, hp(null 가능)]
function shinsalList(pillars) {
  const [yp, mp, dp, hp] = pillars;
  const POS = ['년지', '월지', '일지', '시지'];
  const PILLAR_POS = ['년주', '월주', '일주', '시주'];
  const hits = [];
  const branchHits = (targets, skipIdx) => {
    const out = [];
    pillars.forEach((p, i) => {
      if (!p || i === skipIdx) return;
      if (targets.includes(p.branch)) out.push(POS[i] + ' ' + BRANCHES[p.branch].h);
    });
    return out;
  };
  const add = (key, name, where) => { if (where.length) hits.push({ key, name, where }); };

  add('cheoneul', '천을귀인(天乙貴人)', branchHits(CHEONEUL[dp.stem], -1));
  add('munchang', '문창귀인(文昌貴人)', branchHits([MUNCHANG[dp.stem]], -1));
  // 도화·역마·화개: 년지 기준 + 일지 기준 (중복 제거)
  for (const [key, name, prop] of [['dohwa', '도화살(桃花殺)', 'dohwa'], ['yeokma', '역마살(驛馬殺)', 'yeokma'], ['hwagae', '화개살(華蓋殺)', 'hwagae']]) {
    const targets = [...new Set([SAMHAP_INFO[yp.branch][prop], SAMHAP_INFO[dp.branch][prop]])];
    add(key, name, branchHits(targets, -1));
  }
  if (YANGIN[dp.stem] >= 0) add('yangin', '양인살(羊刃殺)', branchHits([YANGIN[dp.stem]], -1));
  // 백호·괴강: 간지 단위
  const gzHits = (table) => {
    const out = [];
    pillars.forEach((p, i) => {
      if (!p) return;
      if (table.some(([s, b]) => s === p.stem && b === p.branch))
        out.push(PILLAR_POS[i] + ' ' + STEMS[p.stem].h + BRANCHES[p.branch].h);
    });
    return out;
  };
  add('baekho', '백호대살(白虎大殺)', gzHits(BAEKHO));
  add('goegang', '괴강살(魁罡殺)', gzHits(GOEGANG));
  // 공망: 일주 기준이므로 일지 자신은 제외
  const gm = gongmang(dp.stem, dp.branch);
  add('gongmang', '공망(空亡)', branchHits(gm, 2));
  return { hits, gongmangBranches: gm };
}

if (typeof module !== 'undefined') {
  module.exports = { STEMS, BRANCHES, HIDDEN_STEMS, computeSaju, ganjiName, sibsin, SIBSIN_NAMES, branchMainStem, dayPillar, yearPillar, monthPillar, hourPillar, sunLongitude, findSolarTerm, toJD, fromJD, kstToJD, gongmang, twelveStage, shinsalList };
}
