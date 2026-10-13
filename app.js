const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
let scheduleData = { courses: [], adjustments: [], lastUpdated: "" };
const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseLocalDate = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const formatShortDate = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;
const formatFullDate = (date) => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
const dateTimeFor = (course, field) => new Date(`${course.date}T${course[field]}:00+08:00`);
const byTime = (a, b) => a.start.localeCompare(b.start);
const coursesOn = (date) => scheduleData.courses.filter((course) => course.date === toDateKey(date)).sort(byTime);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

async function loadScheduleData() {
  const requestOptions = { cache: "no-store" };
  const [configResponse, coursesResponse, adjustmentsResponse] = await Promise.all([
    fetch("./data/config.json", requestOptions),
    fetch("./data/courses.csv", requestOptions),
    fetch("./data/adjustments.csv", requestOptions)
  ]);
  if (!configResponse.ok || !coursesResponse.ok || !adjustmentsResponse.ok) throw new Error("课程数据加载失败");
  const config = await configResponse.json();
  const courseRows = parseCsv(await coursesResponse.text());
  const adjustmentRows = parseCsv(await adjustmentsResponse.text());
  scheduleData = {
    ...config,
    courses: courseRows.map((row) => ({
      date: row["日期"], start: row["开始时间"], end: row["结束时间"], name: row["课程名"],
      room: row["教室"] || "以通知为准", teacher: row["老师"], note: row["备注"],
      adjusted: ["是", "true", "1"].includes((row["是否调整"] || "").toLowerCase())
    })).filter((course) => course.date && course.start && course.name),
    adjustments: adjustmentRows.map((row) => ({ date: row["日期"], title: row["标题"], description: row["说明"] })).filter((item) => item.date && item.title)
  };
}

function courseCard(course, compact = false) {
  return `
    <article class="course-card${course.adjusted ? " course-card--adjusted" : ""}${compact ? " course-card--compact" : ""}">
      <div class="course-time">
        <strong>${course.start}</strong>
        <span>${course.end}</span>
      </div>
      <div class="course-line" aria-hidden="true"><span></span></div>
      <div class="course-info">
        <div class="course-title-row">
          <h3>${course.name}</h3>
          ${course.adjusted ? '<span class="adjusted-badge">已调整</span>' : ""}
        </div>
        <p class="course-room"><span aria-hidden="true">⌖</span>${course.room}</p>
        <p class="course-meta">${course.teacher ? `教师：${course.teacher}` : ""}${course.note ? `<span>${course.note}</span>` : ""}</p>
      </div>
    </article>`;
}

function emptyState(title, description) {
  return `<div class="empty-state"><span aria-hidden="true">✓</span><strong>${title}</strong><p>${description}</p></div>`;
}

function renderCourseList(element, courses, emptyTitle, emptyDescription) {
  element.innerHTML = courses.length
    ? courses.map((course) => courseCard(course)).join("")
    : emptyState(emptyTitle, emptyDescription);
}

function getWeekStart(date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function renderStatus(now, todayCourses) {
  const statusCard = document.querySelector("#status-card");
  const current = todayCourses.find((course) => now >= dateTimeFor(course, "start") && now < dateTimeFor(course, "end"));
  const next = todayCourses.find((course) => now < dateTimeFor(course, "start"));

  if (current) {
    statusCard.innerHTML = `<span class="status-dot"></span><div><small>正在上课</small><strong>${current.name}</strong><p>${current.end} 下课 · ${current.room}</p></div>`;
    return;
  }
  if (next) {
    statusCard.innerHTML = `<span class="status-dot status-dot--free"></span><div><small>下一节课</small><strong>${next.name}</strong><p>${next.start} 开始 · ${next.room}</p></div>`;
    return;
  }
  statusCard.innerHTML = `<span class="status-dot status-dot--free"></span><div><small>当前状态</small><strong>${todayCourses.length ? "今日课程已结束" : "今天没有课程"}</strong><p>${todayCourses.length ? "辛苦了，记得查看明日安排" : "可以自由安排今天的时间"}</p></div>`;
}

function renderWeek(now) {
  const weekStart = getWeekStart(now);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todayKey = toDateKey(now);
  const availableDays = weekDays.filter((date) => coursesOn(date).length);
  let activeKey = availableDays.some((date) => toDateKey(date) === todayKey) ? todayKey : toDateKey(availableDays[0] || weekDays[0]);
  const tabs = document.querySelector("#week-tabs");
  const panel = document.querySelector("#week-panel");

  document.querySelector("#week-range").textContent = `${formatShortDate(weekDays[0])}—${formatShortDate(weekDays[6])}`;

  const renderPanel = () => {
    const activeDate = parseLocalDate(activeKey);
    const activeCourses = coursesOn(activeDate);
    panel.innerHTML = `
      <div class="week-panel__heading"><strong>${formatShortDate(activeDate)} ${WEEKDAYS[activeDate.getDay()]}</strong><span>${activeCourses.length} 门课</span></div>
      ${activeCourses.length ? activeCourses.map((course) => courseCard(course, true)).join("") : emptyState("当天没有课程", "可以安排自习或其他活动。")}`;
  };

  tabs.innerHTML = weekDays.map((date) => {
    const key = toDateKey(date);
    const count = coursesOn(date).length;
    return `<button class="week-tab${key === activeKey ? " is-active" : ""}${key === todayKey ? " is-today" : ""}" type="button" data-date="${key}" role="tab" aria-selected="${key === activeKey}"><span>${WEEKDAYS[date.getDay()].replace("周", "")}</span><strong>${date.getDate()}</strong>${count ? `<i>${count}</i>` : ""}</button>`;
  }).join("");

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-date]");
    if (!button) return;
    activeKey = button.dataset.date;
    tabs.querySelectorAll("button").forEach((tab) => {
      const active = tab.dataset.date === activeKey;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderPanel();
  });
  renderPanel();
}

function renderAdjustments(now) {
  const container = document.querySelector("#adjustments-list");
  const upcoming = scheduleData.adjustments.filter((item) => parseLocalDate(item.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  container.innerHTML = upcoming.length
    ? upcoming.map((item) => `<article class="adjustment-card"><span>已调整</span><div><strong>${item.title}</strong><p>${item.description}</p></div></article>`).join("")
    : `<div class="no-adjustments"><span>暂无</span><p>目前没有已提前确认的课程调整。</p></div>`;
}

async function init() {
  try {
    await loadScheduleData();
  } catch (error) {
    document.querySelector("main").innerHTML = `<section class="section"><div class="empty-state"><strong>课程数据加载失败</strong><p>请刷新页面；如果仍未恢复，请联系维护人。</p></div></section>`;
    console.error(error);
    return;
  }
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const todayCourses = coursesOn(now);
  const tomorrowCourses = coursesOn(tomorrow);

  document.querySelector("#today-label").textContent = formatFullDate(now);
  document.querySelector("#today-count").textContent = `${todayCourses.length} 门课`;
  document.querySelector("#tomorrow-date").textContent = `${formatShortDate(tomorrow)} ${WEEKDAYS[tomorrow.getDay()]}`;
  renderStatus(now, todayCourses);
  renderCourseList(document.querySelector("#today-list"), todayCourses, "今天没有课程", "放松一下，或者提前准备明天的课程。");
  renderCourseList(document.querySelector("#tomorrow-list"), tomorrowCourses, "明天没有课程", "目前没有查到明日课程安排。");
  renderWeek(now);
  renderAdjustments(now);

  const updated = new Date(scheduleData.lastUpdated);
  document.querySelector("#last-updated").textContent = `${updated.getFullYear()}年${updated.getMonth() + 1}月${updated.getDate()}日 ${pad(updated.getHours())}:${pad(updated.getMinutes())}`;
}

init();
