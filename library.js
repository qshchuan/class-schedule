const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const SHORT_DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const STUDY_HOURS = [["07:30", "22:30"]];
const WEEKDAY_READING = [["08:00", "11:30"], ["14:00", "17:30"], ["18:30", "21:30"]];
const SATURDAY_READING = [["08:30", "11:30"], ["14:00", "17:30"]];
const SUNDAY_READING = [["14:00", "17:30"], ["18:30", "21:30"]];
const ELECTRONIC_BASE = [["14:00", "17:30"], ["18:30", "21:30"]];
const SHANGHAI_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const SPACES = [
  {
    id: "study",
    name: "1、2、4楼自习室",
    floor: "1F · 2F · 4F",
    icon: "自习",
    note: "每天开放，无需预约，直接入座。",
    periods: () => STUDY_HOURS,
  },
  {
    id: "reading",
    name: "3楼借阅室",
    floor: "3F",
    icon: "借阅",
    note: "18:30–21:30 仅提供阅读服务，不办理图书借还。",
    periods: (day) => readingPeriods(day),
  },
  {
    id: "electronic",
    name: "电子借阅室",
    floor: "4F",
    icon: "电子",
    note: "周末上午不开放。",
    periods: (day) => electronicPeriods(day),
  },
  {
    id: "recitation",
    name: "5楼自习室",
    floor: "5F",
    icon: "5楼",
    note: "可以大声背单词。",
    periods: () => STUDY_HOURS,
  },
];

const pad = (value) => String(value).padStart(2, "0");
const minutesFor = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function shanghaiClock(date = new Date()) {
  const values = Object.fromEntries(SHANGHAI_CLOCK.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    date: values.day,
    day: new Date(Date.UTC(values.year, values.month - 1, values.day)).getUTCDay(),
    time: `${pad(values.hour)}:${pad(values.minute)}`,
  };
}

function readingPeriods(day) {
  if (day === 0) return SUNDAY_READING;
  if (day === 6) return SATURDAY_READING;
  return WEEKDAY_READING;
}

function electronicPeriods(day) {
  return day >= 1 && day <= 5 ? [["08:00", "11:30"], ...ELECTRONIC_BASE] : ELECTRONIC_BASE;
}

function isOpenAt(periods, time) {
  const current = minutesFor(time);
  return periods.some(([start, end]) => current >= minutesFor(start) && current < minutesFor(end));
}

function activePeriod(periods, time) {
  const current = minutesFor(time);
  return periods.find(([start, end]) => current >= minutesFor(start) && current < minutesFor(end)) || null;
}

function statusAt(day, time) {
  return SPACES.map((space) => ({
    id: space.id,
    name: space.name,
    floor: space.floor,
    periods: space.periods(day),
    open: isOpenAt(space.periods(day), time),
    activePeriod: activePeriod(space.periods(day), time),
  }));
}

function nextChange(day, time) {
  const current = minutesFor(time);
  const events = [];
  SPACES.forEach((space) => {
    space.periods(day).forEach(([start, end]) => {
      if (minutesFor(start) > current) events.push({ time: start, label: `${space.name}开放` });
      if (minutesFor(end) > current) events.push({ time: end, label: `${space.name}关闭` });
    });
  });
  events.sort((a, b) => a.time.localeCompare(b.time));
  if (events.length) {
    const firstTime = events[0].time;
    return { time: firstTime, labels: events.filter((event) => event.time === firstTime).map((event) => event.label) };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = (day + offset) % 7;
    const openings = SPACES.flatMap((space) => space.periods(nextDay).map(([start]) => ({ time: start, label: `${space.name}开放` })));
    openings.sort((a, b) => a.time.localeCompare(b.time));
    if (openings.length) {
      const firstTime = openings[0].time;
      return {
        dayOffset: offset,
        day: nextDay,
        time: firstTime,
        labels: openings.filter((event) => event.time === firstTime).map((event) => event.label),
      };
    }
  }
  return null;
}

const hoursText = (periods) => periods.map(([start, end]) => `${start}–${end}`).join("  ·  ");

function renderCurrent(now = new Date()) {
  const clock = shanghaiClock(now);
  const day = clock.day;
  const currentTime = clock.time;
  const statuses = statusAt(day, currentTime);
  const openSpaces = statuses.filter((space) => space.open);
  document.querySelector("#current-date").textContent = `${clock.year}年${clock.month}月${clock.date}日 ${WEEKDAYS[day]}`;
  document.querySelector("#current-time").textContent = currentTime;
  document.querySelector("#now-heading").textContent = openSpaces.length ? `${openSpaces.length} 个区域正在开放` : "明确时段内暂无开放区域";

  const list = document.querySelector("#open-now-list");
  list.replaceChildren();
  list.dataset.count = String(openSpaces.length);
  if (!openSpaces.length) {
    list.append(el("div", "closed-message", "可以查看下方完整开放时间"));
  } else {
    openSpaces.forEach((space) => {
      const item = el("div", "open-pill");
      const [start, end] = space.activePeriod;
      item.append(
        el("strong", "", space.name),
        el("span", "", space.floor),
        el("span", "open-pill__period", `本次开放 ${start}–${end}`),
      );
      list.append(item);
    });
  }

  const change = nextChange(day, currentTime);
  const nextChangeElement = document.querySelector("#next-change");
  if (!change) {
    nextChangeElement.textContent = "暂无后续状态变化";
  } else {
    const dayLabel = change.dayOffset ? `${change.dayOffset === 1 ? "明天" : WEEKDAYS[change.day]} ` : "";
    nextChangeElement.textContent = `下一变化：${dayLabel}${change.time} ${change.labels.join("、")}`;
  }

  document.querySelectorAll("[data-space-id]").forEach((card) => {
    const status = statuses.find((item) => item.id === card.dataset.spaceId);
    const badge = card.querySelector(".state-badge");
    badge.textContent = status.open ? "开放中" : "已关闭";
    badge.classList.toggle("is-open", status.open);
  });
}

function renderSpaces(day) {
  const list = document.querySelector("#space-list");
  list.replaceChildren();
  SPACES.forEach((space, index) => {
    const card = el("article", "space-card");
    card.dataset.spaceId = space.id;
    const icon = el("span", `space-icon${index === 1 ? " space-icon--orange" : ""}`, space.icon);
    icon.setAttribute("aria-hidden", "true");
    const content = el("div");
    const top = el("div", "space-card__top");
    top.append(el("h3", "", `${space.name} · ${space.floor}`), el("span", "state-badge", ""));
    content.append(top, el("p", "space-hours", hoursText(space.periods(day))), el("p", "space-note", space.note));
    card.append(icon, content);
    list.append(card);
  });
}

function renderWeek(selectedDay) {
  const tabs = document.querySelector("#week-tabs");
  tabs.replaceChildren();
  for (let day = 1; day <= 7; day += 1) {
    const actualDay = day % 7;
    const button = el("button", `week-tab${actualDay === selectedDay ? " is-active" : ""}`);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(actualDay === selectedDay));
    button.append(el("span", "", "周"), el("strong", "", SHORT_DAYS[actualDay]));
    button.addEventListener("click", () => renderWeek(actualDay));
    tabs.append(button);
  }

  const detail = document.querySelector("#week-detail");
  detail.replaceChildren();
  const periods = readingPeriods(selectedDay);
  const heading = el("div", "week-detail__title");
  heading.append(el("strong", "", `${WEEKDAYS[selectedDay]} · 3楼借阅室`), el("span", "", `${periods.length} 个开放时段`));
  const periodList = el("div", "period-list");
  periods.forEach(([start, end]) => {
    const row = el("div", "period-row");
    const period = el("time", "", `${start}–${end}`);
    const isReadingOnly = start === "18:30";
    row.append(period, el("span", "", isReadingOnly ? "仅阅读，不办理借还" : "阅读及图书借还"));
    periodList.append(row);
  });
  detail.append(heading, periodList);
}

function init() {
  const now = new Date();
  const clock = shanghaiClock(now);
  renderSpaces(clock.day);
  renderWeek(clock.day);
  renderCurrent(now);
  window.setInterval(() => renderCurrent(new Date()), 30_000);
}

if (typeof document !== "undefined") init();

export { activePeriod, electronicPeriods, isOpenAt, nextChange, readingPeriods, shanghaiClock, statusAt };
