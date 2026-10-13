# 班级课程查询网站安全审查

## 执行摘要

本项目是纯静态 GitHub Pages 网站，没有登录、Cookie、数据库、后端接口或第三方 JavaScript，传统服务器入侵面较小。本次审查发现并修复了最重要的 DOM XSS 风险：此前 CSV 中的课程名、教室、教师、备注和调课说明会经 `innerHTML` 解析；现在全部使用 `createElement`、`textContent` 和 `replaceChildren` 作为普通文字渲染，并加入严格 CSP、字段校验、长度限制、日期时间验证、重复课程去重和最大行数限制。

自动化测试、课程数据校验和真实浏览器恶意内容测试均已通过。仍需注意 GitHub 账号安全和公开仓库隐私，这些属于运营风险，不能只靠网页代码消除。

## 已修复：高优先级

### SEC-001：CSV 数据进入 HTML 解析造成 DOM XSS

- 严重级别：High（已修复）
- 位置：`app.js:30`、`app.js:56-72`
- 证据：所有动态课程与调课字段现在通过 `textContent`、`document.createTextNode` 和 DOM 节点创建，不再使用 `innerHTML`。
- 原风险：若仓库、CSV 或图片识别结果被写入 `<img onerror=...>` 等恶意内容，浏览器可能执行脚本。
- 修复：移除动态 HTML 字符串拼接，改为安全 DOM API。
- 验证：浏览器加载恶意课程名 `<img src=x onerror=window.__xss=1>` 后，`window.__xss` 未被设置、页面未创建图片元素、字符串仅作为可见文字显示。

### SEC-002：缺少 Content Security Policy

- 严重级别：Medium（已修复）
- 位置：`index.html:5`
- 证据：加入 meta CSP，限制脚本、样式、图片和网络连接为同源，禁用 object、base 和 form 提交，并未使用 `unsafe-inline` 或 `unsafe-eval`。
- 影响：CSP 是 XSS 的纵深防护，即使未来误引入危险渲染路径，也能降低脚本执行概率。
- 限制：GitHub Pages 无法由本项目直接配置全部响应头；meta CSP 不支持 `frame-ancestors` 等响应头专用指令。

## 已修复：中低优先级

### SEC-003：课程数据缺少结构与长度校验

- 严重级别：Medium（已修复）
- 位置：`app.js:26-53`
- 修复：校验 `YYYY-MM-DD` 日期、`HH:MM` 时间、结束晚于开始；限制字段长度、移除控制字符、最多加载 500 门课程、过滤无效行并去重。
- 验证：`npm test` 覆盖无效日期、倒置时间和重复课程；`npm run validate` 校验实际 CSV。

### SEC-004：每周发布缺少固定校验门槛

- 严重级别：Low（已修复）
- 位置：`WEEKLY_UPDATE_WORKFLOW.md`、`scripts/validate_schedule.mjs`、`tests/schedule.test.mjs`
- 修复：每次图片更新后必须执行数据校验、跨周测试、状态测试和恶意 HTML 回归，禁止上传测试数据或临时截图。

## 剩余运营风险

### SEC-005：GitHub 账号或仓库被接管

- 严重级别：Medium（未由代码解决）
- 影响：攻击者可直接替换整个静态网站，任何前端防护都无法阻止仓库所有者发布恶意代码。
- 建议：GitHub 开启双因素认证；不要向他人提供密码、验证码或访问令牌；定期检查仓库提交记录；禁止强制推送；发现异常时回滚到已知安全提交。

### SEC-006：公共课表信息的隐私暴露

- 严重级别：Low / 取决于班级要求
- 影响：公开 GitHub 仓库和 Pages 会暴露课程、教师和教室信息，搜索引擎或陌生人可能访问。
- 建议：继续公开前应确保班级接受；若不接受，应移除教师/教室字段或迁移至带访问控制的托管方式。

## 验证结果

- `npm test`：4/4 通过。
- `npm run validate`：19 门课程通过，分属 2026-10-12 和 2026-10-19 两周。
- 跨周：2026-10-18 显示 10月12日—10月18日；2026-10-19 自动显示 10月19日—10月25日。
- 恶意内容：脚本未执行，未生成攻击者图片元素，仅显示普通文字。
- 静态扫描：生产代码无 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`eval` 或 `new Function`。
