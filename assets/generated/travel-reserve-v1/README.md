# 四季旅行自然收藏 · Seasonal Travel and Nature Collection

**备用素材，不是已经接入游戏的内容。** 共 48 种基础造型 × 4 个结构/内容变体 = 192 张透明 PNG；不能称为 192 种独立基础设计。

- [统一筛选画廊](../reserve-library/index.html?pack=travel-reserve-v1)
- [总览图](contact-sheet.png) · [透明图集](atlas.png) · [清单](manifest.json) · [校验报告](verification-report.json)
- 原创程序化像素绘制，非外部素材下载或生图模型输出。遵循[主色板](../../../docs/art-grid/palette.json)，96×96 原生美术像素、density 2、二值透明度，锚点 (48,90)。
- 96×96 是统一目录画布，不代表所有物体在场景里同样大。正式使用前需根据人物、桌面或建筑比例重新适配并校准遮挡；大件家具的透视和材质仍需场景内复核。
- 本目录不在 public，不影响游戏启动、存档、数值或离线缓存。

## 重建

```sh
node scripts/build-reserve-library.mjs --pack=travel
node scripts/build-reserve-library.mjs --pack=travel --check
node scripts/build-reserve-library.mjs --gallery
```

修改绘制源模块后再重建。生成器会拒绝覆盖被手改的产物；请先保留自定义修改。自检验证尺寸、色板、透明边距、重复图、非纯换色变体、图集逐像素一致和确定性，但不替代人工审美验收。
