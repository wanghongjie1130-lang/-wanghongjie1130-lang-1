# Product Data and Image Architecture

## Canonical records

`Product` 保存品牌、系列、标准名称、分类、妆效、来源、完整度和产品级图片；`Variant` 保存色号、区域、价格、色彩参数、色号图片和试色。购买渠道、价格历史、官方宣称、独立测试与用户体验分别保存，避免相互覆盖。

图片字段：

```json
{
  "images": {
    "officialPrimary": null,
    "officialSecondary": [],
    "officialSwatches": [],
    "retailerImages": [],
    "userImages": [],
    "textureReference": null,
    "simulatedImages": [],
    "placeholder": "assets/images/product-packaging.svg"
  },
  "imageSources": [{
    "type": "official",
    "sourceName": "Brand Official Website",
    "sourceUrl": "",
    "retrievedAt": "",
    "usagePermission": "",
    "cachedImage": null,
    "originalImage": null
  }]
}
```

只有能够确认产品与色号匹配的图片才能进入 `officialPrimary`。无法确认时保持 `null`。

## Adapter contract

Adapter 输出统一 envelope：

```json
{
  "source": {},
  "products": [],
  "errors": []
}
```

`StandardProductFeedAdapter` 要求显式声明允许的访问方式，并将 `termsAccepted` 设为 `true`。浏览器端的 Bulk URL 工具只做来源识别；没有获许可 Adapter 时返回 unsupported，不执行抓取。

## Build outputs

`npm run data:build` 生成产品索引与分片、品牌、分类、Variants、成分、价格、来源、Claims、Performance、Images、Duplicates、Conflicts、Missing Data、Import History 和 Dashboard。`npm run data:validate` 检查产品 ID、Variant 关系、来源、状态和必需字段。

## Image runtime

`js/image-policy.js` 负责 lazy loading、错误回退和来源标签。加载顺序固定为：

```text
variant official → product official → retailer → user photo → placeholder
```

Texture Reference 和 Simulated Image 不会自动成为个人化妆包或产品比较的主图。
