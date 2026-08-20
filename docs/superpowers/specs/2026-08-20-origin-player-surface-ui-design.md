# OriginPlayerSurface 阅读器壳对齐（方案 A）

> 日期：2026-08-20  
> 状态：已实现；外层对齐阅读器 `page-x lg:px-8` + related 卡片圆角/边框；原站 WebView 同步媒体槽 bounds  
> 前置：`2026-08-20-origin-player-live-sniff-design.md`（行为契约不变）  
> 范围：自建源 Android 原站播放表面的 **外层壳 / 状态条 / WebView 槽位对齐**，不改 CMS 页内样式、不改嗅探门槛

## 1. 问题

`OriginPlayerSurface` 在 `mode === 'origin'` 时用 `bg-ink-deep` + 居中长文案填充 16:9 槽。昼读方案下 `ink-deep` 为奶油色，看起来像一张空卡片，与同页的 `VideoSniffPlaceholder` / `InkVideoPlayer`（固定深色媒体槽）不一致。浮钮用实心 `cinnabar` 胶囊，对比与圆角语言也和嗅探重试钮脱节。

上方 CMS 自带的线路钮 / 粉红报错 **不在本 spec 范围**（第三方 HTML）。

## 2. 目标与非目标

### 目标

| # | 目标 |
|---|---|
| G1 | 外层与阅读器统一：`page-x lg:px-8`、related 同款圆角边框卡片、状态条 `px-2.5` |
| G2 | 原站 WebView 对齐媒体槽（bounds + 圆角裁剪）；取消第二层海报占位 |
| G3 | 状态在槽下：短文案 + 主按钮「用阅读器播放」；失败态短句 +「打开原文」 |
| G4 | 产品行为零变化：可见原站 WebView、浮钮门槛、切自定义播放、返回键、会话生命周期 |

### 非目标

- 不注入 CMS CSS、不藏线路钮、不新增站点适配  
- 不改 `InkVideoPlayer` 内部控件  
- 不改门控 / `liveCandidate` / 原生 `startLiveSession` 契约  
- 不做「首屏改自定义播放器」等产品决策回退  

## 3. UI 规格

### 3.1 容器

- 外层：`mt-5 page-x lg:px-8`（与封面图一致）。
- 卡片：`rounded-xl border border-haze bg-ink-raised/80 overflow-hidden`（与相关内容卡片同圆角/边框语言）。
- 媒体槽：`aspect-video` + 固定深底 `#0c0d10`；**不再**铺海报当第二块画面。
- Android 原站 WebView 经 `setLiveSessionBounds` 对齐到该槽（含 12px 圆角裁剪）；滚动/缩放时持续同步。
- `mode === 'custom'` 时槽内挂 `InkVideoPlayer`，隐藏原站 WebView。

### 3.2 状态条（origin，媒体槽下方）

与相关卡片 body 同级内边距 `px-2.5 py-2.5`（0.625rem）：

| 状态 | 表现 |
|---|---|
| 正常、未达浮钮门槛 | 左侧 mono 文案 `原站播放中` + 脉冲点 |
| 已有合格候选 | 左侧 `已识别正片` + 右侧主按钮「用阅读器播放」 |
| `sessionError` | 左侧短句 + 次要「打开原文」 |

禁止再显示长段说明；禁止在媒体槽内叠第二层海报壳。

### 3.3 浮钮 / 主按钮

- 文案不变：`用阅读器播放`
- 视觉：阅读器主操作钮（`rounded-lg bg-cinnabar` + `font-mono text-[11px] text-white`），与付费墙等处一致
- 显示条件不变：`mode === 'origin' && candidate`

### 3.4 自定义模式脚注

- 「返回原站播放器」保持次要文字链即可；若与阅读器次要操作语气冲突，仅微调字号/色到 `text-paper-muted`，不做新组件。

## 4. 实现边界

| 文件 | 职责 |
|---|---|
| `src/components/OriginPlayerSurface.tsx` | 卡片壳、状态条、槽位 ref、bounds 同步 |
| `src/features/mediaSniffer/native.ts` | `setNativeLiveSessionBounds` |
| `android/.../MediaSnifferPlugin.java` | `setLiveSessionBounds` + 启动时离屏直至 JS 对齐 |

## 5. 测试与验收

- 自动化：本改动为纯展示；若已有 `OriginPlayerSurface` / gate 测试，不因 class 调整失败即可。无强制新测。
- 实机 / 开发态：自建源视频稿 → origin 壳为深色槽 + 短药丸，非奶油空卡；候选出现后浮钮可读；点浮钮进 `InkVideoPlayer`；失败态短文案。
- 回归：门控外路径（内置源、Web、图文）零变化。

## 6. 验证清单

1. 仍满足「无后端 / 站内可切阅读器播放 / 本地优先」。  
2. 只碰 Origin 壳相关文件。  
3. 不引入密钥或新生产依赖。  
4. 用户可见文案为中文且更短。  
