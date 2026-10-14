import test from "node:test";
import assert from "node:assert/strict";
import { activePeriod, electronicPeriods, isOpenAt, nextChange, readingPeriods, shanghaiClock, statusAt } from "../library.js";

test("无论访客时区如何都按上海时间判断", () => {
  assert.deepEqual(shanghaiClock(new Date("2026-10-14T08:30:00Z")), {
    year: 2026, month: 10, date: 14, day: 3, time: "16:30",
  });
});

test("周一至周五日期推进后均使用工作日开放规则", () => {
  const dates = [
    ["2026-10-12T01:00:00Z", 1],
    ["2026-10-13T01:00:00Z", 2],
    ["2026-10-14T01:00:00Z", 3],
    ["2026-10-15T01:00:00Z", 4],
    ["2026-10-16T01:00:00Z", 5],
  ];
  for (const [instant, expectedDay] of dates) {
    const clock = shanghaiClock(new Date(instant));
    assert.equal(clock.day, expectedDay);
    assert.deepEqual(statusAt(clock.day, clock.time).filter((space) => space.open).map((space) => space.id), ["study", "reading", "electronic", "recitation"]);
  }
});

test("周末与周一切换时日期和开放区域同步变化", () => {
  const cases = [
    ["2026-10-17T01:00:00Z", { date: 17, day: 6 }, ["study", "reading", "recitation"]],
    ["2026-10-18T01:00:00Z", { date: 18, day: 0 }, ["study", "recitation"]],
    ["2026-10-19T01:00:00Z", { date: 19, day: 1 }, ["study", "reading", "electronic", "recitation"]],
  ];
  for (const [instant, expected, openIds] of cases) {
    const clock = shanghaiClock(new Date(instant));
    assert.equal(clock.date, expected.date);
    assert.equal(clock.day, expected.day);
    assert.deepEqual(statusAt(clock.day, clock.time).filter((space) => space.open).map((space) => space.id), openIds);
  }
});

test("上海午夜发生跨日、跨月和跨年切换", () => {
  const transitions = [
    ["2026-10-16T15:59:00Z", { year: 2026, month: 10, date: 16, day: 5, time: "23:59" }],
    ["2026-10-16T16:00:00Z", { year: 2026, month: 10, date: 17, day: 6, time: "00:00" }],
    ["2026-10-31T16:00:00Z", { year: 2026, month: 11, date: 1, day: 0, time: "00:00" }],
    ["2026-12-31T16:00:00Z", { year: 2027, month: 1, date: 1, day: 5, time: "00:00" }],
  ];
  for (const [instant, expected] of transitions) {
    assert.deepEqual(shanghaiClock(new Date(instant)), expected);
  }
});

test("跨月、跨年及数月后的上海日期与开放区域正确", () => {
  const cases = [
    ["2026-10-31T16:30:00Z", { year: 2026, month: 11, date: 1, day: 0, time: "00:30" }, []],
    ["2026-12-31T16:30:00Z", { year: 2027, month: 1, date: 1, day: 5, time: "00:30" }, []],
    ["2027-03-15T01:00:00Z", { year: 2027, month: 3, date: 15, day: 1, time: "09:00" }, ["study", "reading", "electronic", "recitation"]],
  ];
  for (const [instant, expectedClock, openIds] of cases) {
    const clock = shanghaiClock(new Date(instant));
    assert.deepEqual(clock, expectedClock);
    assert.deepEqual(statusAt(clock.day, clock.time).filter((space) => space.open).map((space) => space.id), openIds);
  }
});

test("3楼借阅室按工作日、周六和周日开放", () => {
  assert.deepEqual(readingPeriods(1), [["08:00", "11:30"], ["14:00", "17:30"], ["18:30", "21:30"]]);
  assert.deepEqual(readingPeriods(6), [["08:30", "11:30"], ["14:00", "17:30"]]);
  assert.deepEqual(readingPeriods(0), [["14:00", "17:30"], ["18:30", "21:30"]]);
});

test("电子借阅室仅在工作日上午开放", () => {
  assert.deepEqual(electronicPeriods(2)[0], ["08:00", "11:30"]);
  assert.deepEqual(electronicPeriods(6), [["14:00", "17:30"], ["18:30", "21:30"]]);
});

test("结束时刻视为关闭，开始时刻视为开放", () => {
  const periods = [["07:30", "22:30"]];
  assert.equal(isOpenAt(periods, "07:29"), false);
  assert.equal(isOpenAt(periods, "07:30"), true);
  assert.equal(isOpenAt(periods, "22:29"), true);
  assert.equal(isOpenAt(periods, "22:30"), false);
});

test("当前开放区域能给出本次连续开放时段", () => {
  const periods = [["08:00", "11:30"], ["14:00", "17:30"], ["18:30", "21:30"]];
  assert.deepEqual(activePeriod(periods, "16:00"), ["14:00", "17:30"]);
  assert.equal(activePeriod(periods, "17:45"), null);
  assert.deepEqual(statusAt(3, "19:00").find((space) => space.id === "reading").activePeriod, ["18:30", "21:30"]);
});

test("首屏状态能正确区分周一上午和周日上午", () => {
  const monday = statusAt(1, "09:00");
  assert.deepEqual(monday.filter((space) => space.open).map((space) => space.id), ["study", "reading", "electronic", "recitation"]);
  const sunday = statusAt(0, "09:00");
  assert.deepEqual(sunday.filter((space) => space.open).map((space) => space.id), ["study", "recitation"]);
});

test("能计算当天与次日的下一状态变化", () => {
  assert.deepEqual(nextChange(1, "07:40"), { time: "08:00", labels: ["3楼借阅室开放", "电子借阅室开放"] });
  assert.deepEqual(nextChange(6, "22:30"), { dayOffset: 1, day: 0, time: "07:30", labels: ["1、2、4楼自习室开放", "5楼自习室开放"] });
});
