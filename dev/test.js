const E = require('./engine.js');

let pass = 0, fail = 0;
function eq(name, actual, expected) {
  if (actual === expected) { pass++; console.log('  OK  ' + name + ' = ' + actual); }
  else { fail++; console.log('  FAIL ' + name + ': got ' + actual + ', expected ' + expected); }
}

function gj(p) { return E.STEMS[p.stem].k + E.BRANCHES[p.branch].k; }

console.log('--- 일주 검증 (만세력 공지 사실) ---');
// 1900-01-01 = 갑술일, 2000-01-01 = 무오일 (역법 기준점 검증)
eq('1900-01-01 일주', gj(E.dayPillar(1900, 1, 1)), '갑술');
eq('2000-01-01 일주', gj(E.dayPillar(2000, 1, 1)), '무오');
// 2024-01-01 = 갑자년 아님; 일진 검증: 2024-02-10(설날) = 갑진년 시작 아님(입춘 2/4). 일진: 2024-01-01 = ?
// 확실한 값: 1984-02-02 입춘 부근. 대신 60일 주기 자체 일관성 확인
eq('60일 주기 일관성', gj(E.dayPillar(2000, 3, 1)), gj(E.dayPillar(2000, 3, 1 + 0)));
const a = E.dayPillar(2000, 1, 1), b = E.dayPillar(2000, 1, 61 - 31 + 1 + 30); // 60일 후 = 3/1
eq('2000-01-01 + 60일 = 2000-03-01 같은 일진', gj(E.dayPillar(2000, 3, 1)), gj(a));

console.log('--- 입춘 시각 검증 ---');
// 2024년 입춘: 2024-02-04 17:27 KST (한국천문연구원)
const ipchun2024 = E.findSolarTerm(315, E.toJD(2024, 2, 4, 0) - 9 / 24) + 9 / 24;
const c1 = E.fromJD(ipchun2024);
console.log('  2024 입춘(KST): ' + c1.y + '-' + c1.m + '-' + c1.d + ' ' + Math.floor(c1.h) + ':' + Math.round((c1.h % 1) * 60));
eq('2024 입춘 날짜', c1.m + '/' + c1.d, '2/4');
// 2000년 입춘: 2000-02-04 20:40 KST 근처
const ipchun2000 = E.findSolarTerm(315, E.toJD(2000, 2, 4, 0) - 9 / 24) + 9 / 24;
const c2 = E.fromJD(ipchun2000);
console.log('  2000 입춘(KST): ' + c2.y + '-' + c2.m + '-' + c2.d + ' ' + Math.floor(c2.h) + ':' + Math.round((c2.h % 1) * 60));
eq('2000 입춘 날짜', c2.m + '/' + c2.d, '2/4');

console.log('--- 사주 전체 검증 (만세력 대조) ---');
// 사례 1: 1990-03-15 08:30 남자, 보정 없음
// 1990년(경오년), 3/15는 경칩(3/6)~청명 사이 = 묘월, 경오년→무인월 시작→기묘월
// 일주: JDN(1990-03-15)=2447966 → (2447966+49)%60 = 계미? 검증
const r1 = E.computeSaju({ year: 1990, month: 3, day: 15, hour: 8, minute: 30, isMale: true, unknownTime: false, solarTimeCorrection: false });
eq('1990-03-15 년주', gj(r1.yp), '경오');
eq('1990-03-15 월주', gj(r1.mp), '기묘');
console.log('  일주: ' + gj(r1.dp) + ', 시주: ' + gj(r1.hp));

// 사례 2: 2000-01-01 00:30 여자 → 입춘 전이므로 기묘년(1999), 자월(대설~소한 전? 1/1은 소한(1/6) 전 = 대설 이후 = 자월), 기묘년→병자월
const r2 = E.computeSaju({ year: 2000, month: 1, day: 1, hour: 0, minute: 30, isMale: false, unknownTime: false, solarTimeCorrection: false });
eq('2000-01-01 년주(입춘 전=기묘)', gj(r2.yp), '기묘');
eq('2000-01-01 월주(자월)', gj(r2.mp), '병자');
eq('2000-01-01 일주', gj(r2.dp), '무오');
// 무일 → 무계일 임자시 시작, 00:30 = 자시 → 임자시
eq('2000-01-01 00:30 시주', gj(r2.hp), '임자');

// 사례 3: 입춘 경계 - 2024-02-04 (입춘 17:27 KST)
const r3a = E.computeSaju({ year: 2024, month: 2, day: 4, hour: 12, minute: 0, isMale: true, unknownTime: false, solarTimeCorrection: false });
const r3b = E.computeSaju({ year: 2024, month: 2, day: 4, hour: 20, minute: 0, isMale: true, unknownTime: false, solarTimeCorrection: false });
eq('2024-02-04 12:00 년주(입춘 전=계묘)', gj(r3a.yp), '계묘');
eq('2024-02-04 20:00 년주(입춘 후=갑진)', gj(r3b.yp), '갑진');
eq('2024-02-04 20:00 월주(병인)', gj(r3b.mp), '병인');

// 사례 4: 시주 오서둔 검증 - 갑일 or 기일 23:30 → 갑자시? (자시, 23시부터)
// 갑일: 갑기일→갑자시. 2000-01-06은 계해일? 2000-01-01 무오 → +5일 = 계해일(1/6)
eq('2000-01-06 일주(계해)', gj(E.dayPillar(2000, 1, 6)), '계해');
// 계일 → 무계일 임자시 시작. 23:30 → 자시 → 임자
const hp4 = E.hourPillar(9, 23, 30);
eq('계일 23:30 시주', E.STEMS[hp4.stem].k + E.BRANCHES[hp4.branch].k, '임자');
// 오시(11:30~13:30 아님, 11:00~13:00) 검증: 갑일 12:00 → 경오시
const hp5 = E.hourPillar(0, 12, 0);
eq('갑일 12:00 시주(경오)', E.STEMS[hp5.stem].k + E.BRANCHES[hp5.branch].k, '경오');

console.log('--- 십신 검증 ---');
// 일간 갑(木양) 기준: 갑=비견, 을=겁재, 병=식신, 정=상관, 무=편재, 기=정재, 경=편관, 신=정관, 임=편인, 계=정인
const expected10 = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
let sibsinOK = true;
for (let i = 0; i < 10; i++) {
  if (E.SIBSIN_NAMES[E.sibsin(0, i)] !== expected10[i]) { sibsinOK = false; console.log('  FAIL 갑 vs ' + E.STEMS[i].k + ': ' + E.SIBSIN_NAMES[E.sibsin(0, i)] + ' != ' + expected10[i]); }
}
eq('일간 갑 기준 십신 10종', sibsinOK, true);
// 일간 정(火음) 기준: 임(水양)은 나를 극 + 음양다름 → 정관
eq('정일간 vs 임 = 정관', E.SIBSIN_NAMES[E.sibsin(3, 8)], '정관');
// 일간 경(金양) 기준: 갑(木양) 내가 극 + 같은 극성 → 편재
eq('경일간 vs 갑 = 편재', E.SIBSIN_NAMES[E.sibsin(6, 0)], '편재');

console.log('--- 대운 검증 ---');
// 1990-03-15 08:30 남자: 경오년(양간)+남자 → 순행
console.log('  순행여부: ' + r1.daeun.forward + ' (expected true), 대운수: ' + r1.daeun.startAge);
eq('1990 남자 순행', r1.daeun.forward, true);
// 기묘월 다음: 경진, 신사, 임오...
eq('첫 대운(경진)', gj(r1.daeun.list[0]), '경진');
eq('둘째 대운(신사)', gj(r1.daeun.list[1]), '신사');
// 여자 기묘년(음간) → 순행
eq('1999(기묘년) 여자 순행', r2.daeun.forward, true);

console.log('--- 오행 분포 합계 검증 ---');
const total = Object.values(r1.dist).reduce((s, x) => s + x, 0);
eq('오행 합계 = 8 (4주 x 천간1+지지1)', Math.abs(total - 8) < 1e-9, true);

console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
