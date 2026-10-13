# 班级课程查询网页

这是一个无需后台的手机端优先静态网页。课程数据与页面代码分离，日常更新只需维护 `data/courses.csv`。这个 CSV 文件可以直接使用 Excel 打开。

## 本地打开

在项目目录运行：

```powershell
python -m http.server 4173
```

然后访问 `http://localhost:4173`。

## 给学习委员的日常更新方式

你不需要打开 CSV 或登录 GitHub 上传文件。固定流程如下：

1. 每周六或周日，在任意 Codex 对话中发送下一周课程详情截图。
2. 说一句“更新下周课表”。
3. Codex 会识别蓝色日期、课程、时间、教室和教师，更新数据并检查手机页面。
4. Codex 完成 GitHub 推送后，会回复本次更新内容和网站链接。

周六、周日默认不上课，除非截图或消息明确说明有特殊安排。完整规则见 `WEEKLY_UPDATE_WORKFLOW.md`。

新窗口可直接使用这句话：

> 打开 `C:\Users\ll\Documents\ChatGPT\抢课`，按 `WEEKLY_UPDATE_WORKFLOW.md` 识别我上传的图片、更新下周课表、完成检查并发布。

发布前固定运行：

```powershell
npm run validate
npm test
```

## 课程数据文件（通常无需手动修改）

如需人工维护，可以使用 Excel 打开 `data/courses.csv`：

1. 使用 Excel 打开 `data/courses.csv`。
2. 每门课程占一行，按照表头填写。
3. 保存时保持 **CSV UTF-8（逗号分隔）** 格式。
4. 如果网站放在 GitHub：打开仓库的 `data` 文件夹，选择 **Add file → Upload files**，上传新的 `courses.csv` 覆盖旧文件。
5. 打开 `data/config.json`，把 `lastUpdated` 改成此次更新时间。GitHub Pages 通常会在数十秒到几分钟后更新。

课程表字段示例：

```csv
日期,开始时间,结束时间,课程名,教室,老师,备注,是否调整
2026-10-14,08:00,09:40,高等数学1,张教学楼D-407,孙桂磊,,否
```

- 日期必须使用 `年-月-日`。
- 页面只显示起止时间，不显示节次。
- 教室未知时填写 `以通知为准`。
- 有调整时把“是否调整”填成“是”，并在“备注”写清调整内容。
- 不需要每天重复上传没有变化的数据；只有课表新增、删改或调课时才更新。

## 课程调整

把提前确认的调整加入 `data/adjustments.csv`：

```csv
日期,标题,说明
2026-10-22,大学英语1更换教室,10:00–11:40 改至张教学楼C-305
```

## 发布

项目是纯静态文件，可直接上传到 Cloudflare Pages、GitHub Pages、Vercel 或其他静态网站托管。

### GitHub Pages 初次发布

1. 在 GitHub 新建一个 **Public** 仓库，例如 `class-schedule`。
2. 将本目录的全部文件上传到仓库根目录。
3. 打开仓库 **Settings → Pages**。
4. 在 **Build and deployment** 中选择 **Deploy from a branch**。
5. 分支选择 `main`，目录选择 `/(root)`，点击保存。
6. 等待页面显示网站地址，通常形如 `https://你的用户名.github.io/class-schedule/`。

GitHub Pages 的免费公开站点通常要求仓库为 Public，因此课程数据和教师姓名也会公开可见。如果不希望公开这些信息，应改用带访问控制的服务，或先删减敏感字段。
