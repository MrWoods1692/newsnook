# OriginPlayerSurface 阅读器壳对齐（方案 A）

> 日期：2026-08-20  
> 状态：已实现（`OriginPlayerSurface` 对齐 sniff 占位）  
> 前置：`2026-08-20-origin-player-live-sniff-design.md`（行为契约不变）  
> 范围：仅自建源 Android 原站播放表面的 **React 壳 / 状态 UI**，不改 CMS 页内样式、不改嗅探与切换逻辑

## 1. 问题

`OriginPlayerSurface` 在 `mode === 'origin'` 时用 `bg-ink-deep` + 居中长文案填充 16:9 槽。昼读方案下 `ink-deep` 为奶油色，看起来像一张空卡片，与同页的 `VideoSniffPlaceholder` / `InkVideoPlayer`（固定深色媒体槽）不一致。浮钮用实心 `cinnabar` 胶囊，对比与圆角语言也和嗅探重试钮脱节。

上方 CMS 自带的线路钮 / 粉红报错 **不在本 spec 范围**（第三方 HTML）。

## 2. 目标与非目标

### 目标

| # | 目标 |
|---|---|
| G1 | origin 态视觉对齐 `reader-video-sniff-placeholder`：深色 16:9、圆角、可选海报压暗 |
| G2 | 长说明改为角落状态药丸；失败态对齐嗅探失败短文案 + 次要「打开原文」 |
| G3 | 「用阅读器播放」样式对齐 `reader-video-sniff-retry`（半透明深底 + 浅描边 + 浅色字） |
| G4 | 产品行为零变化：可见原站 WebView、浮钮门槛、切自定义播放、返回键、会话生命周期 |

### 非目标

- 不注入 CMS CSS、不藏线路钮、不新增站点适配  
- 不改 `InkVideoPlayer` 内部控件  
- 不改门控 / `liveCandidate` / 原生 `startLiveSession` 契约  
- 不做「首屏改自定义播放器」等产品决策回退  

## 3. UI 规格

### 3.1 容器

- 复用或镜像 `.reader-video-sniff-placeholder`：`aspect-ratio: 16/9`、深底 `#0c0d10`（不跟主题 `ink-deep` 昼读变奶油）、`border-radius` 与现有视频槽一致（约 14px）。
- 有 `poster` 时铺底并压暗（同 `.reader-video-sniff-poster`）。
- `mode === 'custom'` 时仍整槽挂载 `InkVideoPlayer`；壳样式由播放器自身负责。

### 3.2 状态文案（origin）

| 状态 | 表现 |
|---|---|
| 正常、未达浮钮门槛 | 左下角药丸：`原站播放中`（带与嗅探相同的脉冲点） |
| 已有合格候选 | 左下角药丸改为 `已识别正片`（可去掉脉冲点）；**必须**同时显示右下浮钮 |
| `sessionError` | 居中短句（现有「原站播放器未能启动」）+ 可选「打开原文」；无浮钮 |

禁止再显示长段：「原站播放器已打开（可点播、过广告）…」。

### 3.3 浮钮

- 文案不变：`用阅读器播放`
- 视觉：对齐 `.reader-video-sniff-retry`（非实心朱红胶囊）
- 位置：媒体槽内右下（现有 `absolute bottom-3 right-3` 可保留）
- 显示条件不变：`mode === 'origin' && candidate`

### 3.4 自定义模式脚注

- 「返回原站播放器」保持次要文字链即可；若与阅读器次要操作语气冲突，仅微调字号/色到 `text-paper-muted`，不做新组件。

## 4. 实现边界

| 文件 | 职责 |
|---|---|
| `src/components/OriginPlayerSurface.tsx` | 结构调整：海报、药丸、失败栈、浮钮 class |
| `src/index.css`（可选） | 若不宜硬套 sniff class 名，可加 `reader-origin-player-*` 镜像 sniff 视觉；避免改 sniff 语义 |

优先 **复用** `.reader-video-sniff-*` class，减少重复；仅在语义冲突时新增 origin 专用 class。

## 5. 测试与验收

- 自动化：本改动为纯展示；若已有 `OriginPlayerSurface` / gate 测试，不因 class 调整失败即可。无强制新测。
- 实机 / 开发态：自建源视频稿 → origin 壳为深色槽 + 短药丸，非奶油空卡；候选出现后浮钮可读；点浮钮进 `InkVideoPlayer`；失败态短文案。
- 回归：门控外路径（内置源、Web、图文）零变化。

## 6. 验证清单

1. 仍满足「无后端 / 站内可切阅读器播放 / 本地优先」。  
2. 只碰 Origin 壳相关文件。  
3. 不引入密钥或新生产依赖。  
4. 用户可见文案为中文且更短。  
