const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const MAX_COURSES = 500;
let scheduleData = { courses: [], adjustments: [], lastUpdated: "" };
const FALLBACK_DATA = {
  lastUpdated: "2026-10-13T11:35:00+08:00", adjustments: [],
  courses: [
    ["2026-10-13","08:00","09:40","大学英语1","以通知为准","马娜","原课表未注明地点"], ["2026-10-13","16:00","17:40","体育1","以通知为准","陆新鹏","原课表未注明地点"],
    ["2026-10-14","08:00","09:40","高等数学1","张教学楼D-407","孙桂磊",""], ["2026-10-14","14:00","15:40","人工智能技术及应用","张教学楼B-104","朱凯旋",""],
    ["2026-10-15","10:00","11:40","大学英语1","张教学楼C-303","马娜",""], ["2026-10-15","14:00","15:40","中国近现代史纲要","张教学楼B-101","陈晓丹",""],
    ["2026-10-16","10:00","11:40","高等数学1","张教学楼D-407","孙桂磊",""], ["2026-10-16","14:00","15:40","中国近现代史纲要","张教学楼B-101","陈晓丹",""],
    ["2026-10-19","08:00","09:40","高等数学1","张教学楼D-407","孙桂磊",""], ["2026-10-19","10:00","11:40","船舶专业工程导论","张教学楼D-407","柯力",""], ["2026-10-19","16:00","17:40","形势与政策1","张教学楼D-407","肖冬",""],
    ["2026-10-20","08:00","09:40","大学英语1","张教学楼A-301","马娜",""], ["2026-10-20","16:00","17:40","体育1","以通知为准","陆新鹏","原课表未注明地点"],
    ["2026-10-21","08:00","09:40","高等数学1","张教学楼D-407","孙桂磊",""], ["2026-10-21","14:00","15:40","人工智能技术及应用","张教学楼B-104","朱凯旋",""],
    ["2026-10-22","10:00","11:40","大学英语1","张教学楼C-303","马娜",""], ["2026-10-22","14:00","15:40","中国近现代史纲要","张教学楼B-101","陈晓丹",""],
    ["2026-10-23","10:00","11:40","高等数学1","张教学楼D-407","孙桂磊",""], ["2026-10-23","14:00","15:40","中国近现代史纲要","张教学楼B-101","陈晓丹",""]
  ].map(([date,start,end,name,room,teacher,note]) => ({ date,start,end,name,room,teacher,note,adjusted:false }))
};
const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseLocalDate = (key) => { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day); };
const addDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const formatShortDate = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;
const formatFullDate = (date) => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
const dateTimeFor = (course, field) => new Date(`${course.date}T${course[field]}:00+08:00`);
const byTime = (a, b) => a.start.localeCompare(b.start);
const cleanText = (value, maxLength) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
const validTime = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const timeMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseLocalDate(value)) === value;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

function parseCsv(text) {
  const rows = []; let row = []; let value = ""; let quoted = false; const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]; const next = source[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(value.trim()); if (row.some((cell) => cell !== "")) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  row.push(value.trim()); if (row.some((cell) => cell !== "")) rows.push(row); if (rows.length < 2) return [];
  const headers = rows[0]; return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}
function normalizeCourse(row) {
  const course = { date: cleanText(row["日期"], 10), start: cleanText(row["开始时间"], 5), end: cleanText(row["结束时间"], 5), name: cleanText(row["课程名"], 60), room: cleanText(row["教室"], 50) || "以通知为准", teacher: cleanText(row["老师"], 50), note: cleanText(row["备注"], 200), adjusted: ["是", "true", "1"].includes(cleanText(row["是否调整"], 10).toLowerCase()) };
  if (!validDate(course.date) || !validTime(course.start) || !validTime(course.end) || !course.name || timeMinutes(course.end) <= timeMinutes(course.start)) return null; return course;
}
function normalizeAdjustment(row) { const item = { date: cleanText(row["日期"], 10), title: cleanText(row["标题"], 80), description: cleanText(row["说明"], 300) }; return validDate(item.date) && item.title ? item : null; }
function normalizeCourses(rows) { const seen = new Set(); return rows.slice(0, MAX_COURSES).map(normalizeCourse).filter(Boolean).filter((course) => { const key = [course.date, course.start, course.end, course.name, course.room].join("|"); if (seen.has(key)) return false; seen.add(key); return true; }); }
async function loadScheduleData() {
  const requestOptions = { cache: "no-store" }; const [configResponse, coursesResponse, adjustmentsResponse] = await Promise.all([fetch("./data/config.json", requestOptions), fetch("./data/courses.csv", requestOptions), fetch("./data/adjustments.csv", requestOptions)]);
  if (!configResponse.ok || !coursesResponse.ok || !adjustmentsResponse.ok) throw new Error("课程数据加载失败"); const config = await configResponse.json();
  scheduleData = { className: cleanText(config.className, 80), notice: cleanText(config.notice, 300), lastUpdated: Number.isNaN(new Date(config.lastUpdated).getTime()) ? FALLBACK_DATA.lastUpdated : config.lastUpdated, courses: normalizeCourses(parseCsv(await coursesResponse.text())), adjustments: parseCsv(await adjustmentsResponse.text()).map(normalizeAdjustment).filter(Boolean).slice(0, 100) };
}
const coursesOn = (date) => scheduleData.courses.filter((course) => course.date === toDateKey(date)).sort(byTime);
function courseCard(course, compact = false) {
  const card = el("article", `course-card${course.adjusted ? " course-card--adjusted" : ""}${compact ? " course-card--compact" : ""}`); const time = el("div", "course-time"); time.append(el("strong", "", course.start), el("span", "", course.end));
  const line = el("div", "course-line"); line.setAttribute("aria-hidden", "true"); line.append(el("span")); const info = el("div", "course-info"); const titleRow = el("div", "course-title-row"); titleRow.append(el("h3", "", course.name)); if (course.adjusted) titleRow.append(el("span", "adjusted-badge", "已调整"));
  const room = el("p", "course-room"); const pin = el("span", "", "⌖"); pin.setAttribute("aria-hidden", "true"); room.append(pin, document.createTextNode(course.room)); const meta = el("p", "course-meta"); if (course.teacher) meta.append(document.createTextNode(`教师：${course.teacher}`)); if (course.note) meta.append(el("span", "", course.note)); info.append(titleRow, room, meta); card.append(time, line, info); return card;
}
function emptyState(title, description) { const box = el("div", "empty-state"); const icon = el("span", "", "✓"); icon.setAttribute("aria-hidden", "true"); box.append(icon, el("strong", "", title), el("p", "", description)); return box; }
function renderCourseList(element, courses, emptyTitle, emptyDescription) { element.replaceChildren(...(courses.length ? courses.map((course) => courseCard(course)) : [emptyState(emptyTitle, emptyDescription)])); }
function getWeekStart(date) { const result = new Date(date); const day = result.getDay() || 7; result.setDate(result.getDate() - day + 1); result.setHours(0, 0, 0, 0); return result; }
function getStatusState(now, todayCourses) { const current = todayCourses.find((course) => now >= dateTimeFor(course, "start") && now < dateTimeFor(course, "end")); if (current) return { label: "正在上课", title: current.name, detail: `${current.end} 下课 · ${current.room}`, free: false }; const next = todayCourses.find((course) => now < dateTimeFor(course, "start")); if (next) return { label: "下一节课", title: next.name, detail: `${next.start} 开始 · ${next.room}`, free: true }; return { label: "当前状态", title: todayCourses.length ? "今日课程已结束" : "今天没有课程", detail: todayCourses.length ? "辛苦了，记得查看明日安排" : "可以自由安排今天的时间", free: true }; }
function renderStatus(now, todayCourses) { const status = getStatusState(now, todayCourses); const dot = el("span", `status-dot${status.free ? " status-dot--free" : ""}`); const content = el("div"); content.append(el("small", "", status.label), el("strong", "", status.title), el("p", "", status.detail)); document.querySelector("#status-card").replaceChildren(dot, content); }
function renderWeek(now) {
  const weekStart = getWeekStart(now); const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)); const todayKey = toDateKey(now); const availableDays = weekDays.filter((date) => coursesOn(date).length); let activeKey = availableDays.some((date) => toDateKey(date) === todayKey) ? todayKey : toDateKey(availableDays[0] || weekDays[0]); const tabs = document.querySelector("#week-tabs"); const panel = document.querySelector("#week-panel"); document.querySelector("#week-range").textContent = `${formatShortDate(weekDays[0])}—${formatShortDate(weekDays[6])}`;
  const renderPanel = () => { const activeDate = parseLocalDate(activeKey); const activeCourses = coursesOn(activeDate); const heading = el("div", "week-panel__heading"); heading.append(el("strong", "", `${formatShortDate(activeDate)} ${WEEKDAYS[activeDate.getDay()]}`), el("span", "", `${activeCourses.length} 门课`)); panel.replaceChildren(heading, ...(activeCourses.length ? activeCourses.map((course) => courseCard(course, true)) : [emptyState("当天没有课程", "可以安排自习或其他活动。")])); };
  tabs.replaceChildren(...weekDays.map((date) => { const key = toDateKey(date); const count = coursesOn(date).length; const button = el("button", `week-tab${key === activeKey ? " is-active" : ""}${key === todayKey ? " is-today" : ""}`); button.type = "button"; button.dataset.date = key; button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(key === activeKey)); button.append(el("span", "", WEEKDAYS[date.getDay()].replace("周", "")), el("strong", "", String(date.getDate()))); if (count) button.append(el("i", "", String(count))); return button; }));
  tabs.onclick = (event) => { const button = event.target.closest("button[data-date]"); if (!button) return; activeKey = button.dataset.date; tabs.querySelectorAll("button").forEach((tab) => { const active = tab.dataset.date === activeKey; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); }); renderPanel(); }; renderPanel();
}
function renderAdjustments(now) { const container = document.querySelector("#adjustments-list"); const upcoming = scheduleData.adjustments.filter((item) => parseLocalDate(item.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())); if (!upcoming.length) { const box = el("div", "no-adjustments"); box.append(el("span", "", "暂无"), el("p", "", "目前没有已提前确认的课程调整。")); container.replaceChildren(box); return; } container.replaceChildren(...upcoming.map((item) => { const card = el("article", "adjustment-card"); const detail = el("div"); detail.append(el("strong", "", item.title), el("p", "", item.description)); card.append(el("span", "", "已调整"), detail); return card; })); }
function resolveNow() { const allowed = ["localhost", "127.0.0.1"].includes(window.location.hostname); const debugDate = allowed ? new URLSearchParams(window.location.search).get("debugDate") : null; const parsed = debugDate ? new Date(debugDate) : new Date(); return Number.isNaN(parsed.getTime()) ? new Date() : parsed; }
function renderDashboard(now) {
  const tomorrow = addDays(now, 1); const todayCourses = coursesOn(now); const tomorrowCourses = coursesOn(tomorrow); document.querySelector("#today-label").textContent = formatFullDate(now); document.querySelector("#today-count").textContent = `${todayCourses.length} 门课`; document.querySelector("#tomorrow-date").textContent = `${formatShortDate(tomorrow)} ${WEEKDAYS[tomorrow.getDay()]}`; renderStatus(now, todayCourses); renderCourseList(document.querySelector("#today-list"), todayCourses, "今天没有课程", "放松一下，或者提前准备明天的课程。"); renderCourseList(document.querySelector("#tomorrow-list"), tomorrowCourses, "明天没有课程", "目前没有查到明日课程安排。"); renderWeek(now); renderAdjustments(now); const updated = new Date(scheduleData.lastUpdated); document.querySelector("#last-updated").textContent = `${updated.getFullYear()}年${updated.getMonth() + 1}月${updated.getDate()}日 ${pad(updated.getHours())}:${pad(updated.getMinutes())}`;
}
function startLiveUpdates(initialNow) {
  let renderedDateKey = toDateKey(initialNow);
  const refresh = () => {
    const now = resolveNow(); const currentDateKey = toDateKey(now);
    if (currentDateKey !== renderedDateKey) { renderDashboard(now); renderedDateKey = currentDateKey; return; }
    renderStatus(now, coursesOn(now));
  };
  window.setInterval(refresh, 60_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
async function init() {
  try { await loadScheduleData(); } catch (error) { scheduleData = FALLBACK_DATA; console.warn("Using built-in schedule data because external data files are unavailable.", error); } const now = resolveNow(); renderDashboard(now); startLiveUpdates(now);
}
if (typeof document !== "undefined") init();
export { getStatusState, getWeekStart, normalizeCourse, normalizeCourses, parseCsv, toDateKey };
