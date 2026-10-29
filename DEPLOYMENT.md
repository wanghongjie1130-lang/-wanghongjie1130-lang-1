# SFTP 静态部署

## 上传

1. 向老师确认服务器地址、端口、个人账号和个人网站目录。不要使用他人的示例账号。
2. 使用学校指定的 SFTP 客户端登录。
3. 进入分配给自己的个人网站目录；不要上传到服务器根目录或他人的目录。
4. 上传根目录中的 `index.html`、`README.md`、`DEPLOYMENT.md`，并完整上传 `css/`、`js/`、`assets/`、`data/`。`assets/vendor/mediapipe/` 包含本地人脸关键点运行时和模型，必须完整上传。
5. 保持文件名大小写和目录结构不变。不要上传账号、密码、私钥或个人照片备份。

## 检查

- 访问老师提供的个人网址，确认首页打开。
- 浏览首页、档案、甄选、化妆包、工作室、学院和购物指南。
- 浏览器开发者工具 Network 面板中，本站静态文件应返回 200；MediaPipe 运行时和模型应从本站 `assets/vendor/mediapipe/` 加载，不依赖 CDN。
- 在手机尺寸下检查折叠菜单、滑块、表单和横向溢出。
- 如首页 404，检查 `index.html` 是否位于个人目录最外层。
- 如样式或图片 404，检查是否完整上传 `css/`、`js/`、`assets/`，以及服务器文件名大小写。

## 更新

本地修改并测试后，只需覆盖发生变化的文件。代码更新不会自动删除访客浏览器中的 `localStorage` 数据；结构大改前建议先从网站导出 JSON。

网站使用 hash 导航，不需要服务器重写规则，也能部署在任意子目录中。

## 写实试妆服务

学校 SFTP、GitHub Pages 等静态空间不能执行 `api/makeup-tryon.js`。静态部署时，产品资料、MakeupPlan 和教学示意图仍可正常使用；写实试妆按钮会保持禁用，不能把任何本地示意图冒充生成结果。

要启用写实试妆，需要把 `api/makeup-tryon.js` 部署到 Vercel 等 Serverless 平台，并在那里设置 `OPENAI_API_KEY`、`OPENAI_IMAGE_MODEL` 和 `ALLOWED_ORIGIN`。然后把 `index.html` 中 `sevb-tryon-api` 的 `content` 改为完整 HTTPS 接口地址。不要把 API Key 写入或上传到静态网站。
