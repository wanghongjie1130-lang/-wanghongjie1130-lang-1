# SE VOULOIR BELLE

SE VOULOIR BELLE 是一个由 HTML5、CSS3 和 Vanilla JavaScript 构建的个人美妆档案、产品资料与创意妆容平台。正式品牌名称只有 **SE VOULOIR BELLE**；界面说明使用简体中文。

## 本地运行

项目无需安装前端依赖。由于产品百科和数据控制台通过 `fetch()` 读取分片 JSON，请使用静态服务器，不要直接双击 `index.html`：

```bash
cd /workspace/1
python3 -m http.server 4173
```

打开 `http://localhost:4173/`。用户档案、化妆包和已保存方案存入浏览器 `localStorage`。

## 数据构建与验证

需要 Node.js 20 或更高版本：

```bash
npm run data:test
npm run data:build
npm run data:validate
```

数据流程为：

```text
Source Adapter → Import Envelope → Normalization → Taxonomy
→ Deduplication → Validation → Canonical Product / Variant JSON
```

当前种子数据包含 12 个 Canonical Products、11 个品牌和 12 个 Variants。它们由旧版人工记录迁移而来，来源链接和价格尚未完成在线复核，因此状态显示为 `PARTIALLY VERIFIED`。项目不会用虚构商品填充数量，也不会把缺失成分解释为“不含”。

目录说明：

- `data-sources/`：CSV、JSON 和获许可标准 Feed Adapter。
- `imports/`：导入清单和原始种子数据。
- `scripts/`：标准化、分类、去重、验证与静态数据生成。
- `data/`：产品索引、产品分片、价格、来源、图片、冲突和完整性报告。
- `js/generated-products.js`：兼容现有推荐界面的生成数据。
- `tests/`：数据平台与 MakeupPlan 图像绑定测试。

品牌官网和授权零售商目录暂时只保留 Adapter 入口。没有许可的 API、Feed 或明确授权时，系统不会自动抓取网页。

## 产品图片策略

具体产品页面统一使用以下顺序：

1. 具体色号的品牌官网产品图。
2. 授权零售商产品图。
3. 用户自己的产品照片。
4. 统一产品类别占位图。

所有产品图使用 `object-fit: contain`，并区分 `OFFICIAL PRODUCT IMAGE`、`OFFICIAL SWATCH`、`RETAILER PRODUCT IMAGE`、`USER PHOTO`、`TEXTURE REFERENCE` 和 `SIMULATED IMAGE`。图片记录同时保存来源类型、来源名称、原始 URL、检索日期和可选缓存路径。

当前 12 个产品没有经过确认、可稳定展示的官网图片，所以页面明确显示 `OFFICIAL PRODUCT IMAGE PENDING`。系统不会拿相似型号或随机网络图片冒充。数据管理页会显示官网图覆盖率、缺失量、零售商回退、用户照片回退和占位图数量。

批量照片录入会保留用户原始裁切图；匹配到 `canonicalProductID` 后，化妆包仍优先读取该产品的官网图。若官网图不存在，才回退到用户照片。

Product imagery and trademarks belong to their respective brands and are displayed for product identification and educational/reference purposes. 若项目用于商业发布，必须重新审查图片、商标和数据授权。

## 妆容方案与视觉绑定

妆容工作室现在使用同一条数据链：

```text
用户条件 → MakeupPlan → 产品与色号锁定 → ImageSpecification
→ Image Provider → Visual Consistency Check → 方案 / 产品 / 色板 / 教程
```

`MakeupPlan` 中包含底妆、眼部颜色与位置、腮红位置、唇妆质地、产品、强度、灯光和排除项。`js/makeup-image-prompt-builder.js` 将这份结构化数据转换为可查看的 ImageSpecification、Prompt 和 Negative Specification。

项目同时保留两条明确区分的视觉路径：

- 未配置后端时，只显示严格读取 MakeupPlan 的 SVG 教学示意图，并明确标注 `TEACHING DIAGRAM`。
- 用户选择“在我的脸上试妆”时，浏览器使用 MediaPipe Face Landmarker 定位 478 个关键点，生成 Eyes、Lips、Cheeks、Complexion 和 Face Edit 五组柔化 Mask。
- 用户照片、Face Edit PNG Mask、MakeupPlan、产品色号与 Beauty Profile 只在用户明确同意并点击生成后发送到 `POST /api/makeup-tryon`。
- Serverless API 从后端环境变量读取密钥，并调用 OpenAI Image Edit；失败时只显示“写实试妆生成暂时不可用”，不会显示随机模特或预设图。
- 写实输出必须标注 `AI MAKEUP SIMULATION`，并通过拖动式 Original / Try-On 进行对比。

`js/image-generation/provider.js` 继续负责无后端时的教学示意；`api/makeup-tryon.js` 负责真实图片编辑。结构检查可以确认输入、Mask、MakeupPlan 和 API 输出是否完整；身份、颜色和位置的自动视觉复核仍需要独立 Vision Model，因此不能伪造匹配分数。

## 写实试妆后端配置

GitHub Pages 只能托管静态文件，不能执行 `api/makeup-tryon.js`。要启用写实试妆，可将同一仓库部署到 Vercel，或单独部署 Serverless API：

```text
OPENAI_API_KEY=服务器端密钥
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst
ALLOWED_ORIGIN=https://wanghongjie1130-lang.github.io
```

密钥只放在 Serverless 平台的环境变量中，不写入 HTML、JavaScript 或 Git。若前端继续使用 GitHub Pages，把 `index.html` 中 `sevb-tryon-api` 的 `content` 设置成 Serverless 接口完整地址；同源 Vercel 部署可以保持为空，默认使用 `api/makeup-tryon`。

后端没有 `OPENAI_API_KEY` 时，状态接口返回 `MISSING_OPENAI_API_KEY`，生成按钮保持禁用。当前仓库没有密钥，也没有提交任何用户人脸照片，所以仓库测试只覆盖数据绑定、Mask 合同、服务状态、安全失败路径和浏览器界面；真实端到端图片编辑必须在私密环境变量和测试者明确提供照片后执行。

## 主要功能

- 可编辑美妆档案、独立色彩偏好、质地、包装和成分排除。
- 专属甄选、三级分类、性能偏好、证据状态和零结果诊断。
- 产品百科、Variant、来源、价格、完整度、收藏和产品比较。
- 化妆包添加、编辑、删除、搜索、收藏、购买/开封状态和照片批量录入。
- 数据管理控制台、CSV/JSON 字段映射预览、缺失数据与图片完整性报告。
- MakeupPlan、产品锁定、颜色/结构/图片级重新生成、产品色板和生成规格查看。
- 新手学院、穿搭建议、购买渠道记录、促销计算和本地 JSON 备份。

自然光照片只在本地进行亮度辅助，不自动判断底调或粉底色号。屏幕色块、教学 SVG 和灯光滤镜都属于构思示意，不是产品真实试色或物理光照预测。
