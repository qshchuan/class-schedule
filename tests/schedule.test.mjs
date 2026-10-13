import test from "node:test";
import assert from "node:assert/strict";
import { createClock, getStatusState, getStudySessions, getWeekStart, normalizeCourse, normalizeCourses, toDateKey } from "../app.js";

test("周日仍属于当周，周一自动切换到新一周", () => {
  assert.equal(toDateKey(getWeekStart(new Date(2026, 9, 18, 12))), "2026-10-12");
  assert.equal(toDateKey(getWeekStart(new Date(2026, 9, 19, 0, 1))), "2026-10-19");
  assert.equal(toDateKey(getWeekStart(new Date(2026, 9, 25, 23, 59))), "2026-10-19");
  assert.equal(toDateKey(getWeekStart(new Date(2026, 9, 26, 0, 1))), "2026-10-26");
});

test("有 08:00 课程时生成同地点早自习，无 08:00 课程时不生成", () => {
  const date = new Date(2026, 9, 19);
  const sessions = getStudySessions(date, [{ start: "08:00", room: "D-407" }]);
  assert.equal(sessions.find((item) => item.name === "早自习").room, "D-407");
  assert.equal(getStudySessions(date, [{ start: "10:00", room: "C-303" }]).some((item) => item.name === "早自习"), false);
});

test("周日到周四有 C302 晚自习，周五周六没有", () => {
  for (const day of [18, 19, 20, 21, 22]) {
    const evening = getStudySessions(new Date(2026, 9, day), []).find((item) => item.name === "晚自习");
    assert.equal(evening.room, "C302");
    assert.equal(`${evening.start}-${evening.end}`, "19:00-20:40");
  }
  assert.equal(getStudySessions(new Date(2026, 9, 23), []).some((item) => item.name === "晚自习"), false);
  assert.equal(getStudySessions(new Date(2026, 9, 24), []).some((item) => item.name === "晚自习"), false);
});

test("自习参与下一项、进行中和今日结束状态", () => {
  const arrangements = getStudySessions(new Date(2026, 9, 19), [{ start: "08:00", room: "D-407" }]);
  assert.equal(getStatusState(new Date("2026-10-19T07:20:00+08:00"), arrangements).title, "早自习");
  assert.equal(getStatusState(new Date("2026-10-19T07:45:00+08:00"), arrangements).label, "正在自习");
  assert.equal(getStatusState(new Date("2026-10-19T19:30:00+08:00"), arrangements).title, "晚自习");
  assert.equal(getStatusState(new Date("2026-10-19T20:40:00+08:00"), arrangements).title, "今日安排已结束");
});

test("生产环境只使用真实时间，本地加速时钟可跨分钟和跨天", () => {
  let realNow = 1_000;
  const production = createClock({ hostname: "qshchuan.github.io", search: "?debugDate=2026-10-20T07:20:00%2B08:00&debugSpeed=600", now: () => realNow });
  assert.equal(production.current().getTime(), 1_000);
  realNow = 2_000;
  assert.equal(production.current().getTime(), 2_000);

  realNow = 10_000;
  const debug = createClock({ hostname: "127.0.0.1", search: "?debugDate=2026-10-20T23:59:30%2B08:00&debugSpeed=60", now: () => realNow });
  assert.equal(debug.current().toISOString(), "2026-10-20T15:59:30.000Z");
  realNow += 1_000;
  assert.equal(debug.current().toISOString(), "2026-10-20T16:00:30.000Z");
  assert.equal(debug.refreshInterval, 1_000);
});

test("无效课程被拒绝，重复课程去重，恶意 HTML 保持普通文字", () => {
  const good = { "日期": "2026-10-19", "开始时间": "08:00", "结束时间": "09:40", "课程名": "<img src=x onerror=alert(1)>", "教室": "" };
  assert.equal(normalizeCourses([good, good]).length, 1);
  assert.equal(normalizeCourse(good).room, "以通知为准");
  assert.equal(normalizeCourse(good).name, "<img src=x onerror=alert(1)>");
  assert.equal(normalizeCourse({ ...good, "结束时间": "07:00" }), null);
});
