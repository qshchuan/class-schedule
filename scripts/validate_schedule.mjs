import fs from "node:fs";
import { getStudySessions, normalizeCourses, parseCsv } from "../app.js";

const text = fs.readFileSync(new URL("../data/courses.csv", import.meta.url), "utf8");
const rows = parseCsv(text);
const courses = normalizeCourses(rows);
const errors = [];
if (courses.length !== rows.length) errors.push(`有 ${rows.length - courses.length} 行无效或重复课程`);
for (const course of courses) {
  const day = new Date(`${course.date}T00:00:00+08:00`).getDay();
  if ((day === 0 || day === 6) && !/特殊|补课|考试|临时/.test(course.note)) errors.push(`${course.date} ${course.name} 是周末课程，请确认备注为特殊安排`);
}
const mondaySessions = getStudySessions(new Date(2026, 9, 19), courses.filter((course) => course.date === "2026-10-19"));
if (!mondaySessions.some((item) => item.name === "早自习" && item.room === "张教学楼D-407")) errors.push("早自习未沿用当天 08:00 课程地点");
if (!mondaySessions.some((item) => item.name === "晚自习" && item.start === "19:00" && item.end === "20:40" && item.room === "C302")) errors.push("晚自习规则无效");
const weeks = new Map();
for (const course of courses) {
  const date = new Date(`${course.date}T00:00:00+08:00`); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; weeks.set(key, (weeks.get(key) || 0) + 1);
}
console.log(`课程数据校验：${courses.length} 门课程`);
for (const [week, count] of weeks) console.log(`- ${week} 开始的一周：${count} 门`);
if (errors.length) { for (const error of errors) console.error(`错误：${error}`); process.exitCode = 1; } else console.log("课程与自习规则校验通过");
