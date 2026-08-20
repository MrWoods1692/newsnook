# OriginPlayerSurface UI 对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让自建源 Android 原站播放表面的 React 壳视觉对齐 `VideoSniffPlaceholder`，行为不变。

**Architecture:** 仅改 `OriginPlayerSurface` 的 origin 态 JSX/class：复用 `.reader-video-sniff-*`；不改原生 WebView、门控、嗅探。

**Tech Stack:** React 19、现有 `src/index.css` 嗅探占位样式、无新依赖。

## Global Constraints

- 产品行为零变化（可见原站 WebView、浮钮门槛、切 `InkVideoPlayer`、返回键、会话生命周期）
- 不注入 CMS CSS、不新增站点适配
- 用户可见文案中文；标识符保持英文
- 不引入新生产依赖；不提交除非用户要求
- 优先复用 `.reader-video-sniff-*`，避免改 sniff 语义

---

### Task 1: Origin 壳对齐嗅探占位

**Files:**
- Modify: `src/components/OriginPlayerSurface.tsx`
- Test: 无强制新测（纯展示）；可选肉眼 / Android 实机

**Interfaces:**
- Consumes: 现有 `Props`（`poster`、`openOriginal`、`title` 等）、`candidate` / `sessionError` / `mode` state、`.reader-video-sniff-placeholder` / `-poster` / `-pill` / `-dot` / `-failed-stack` / `-failed-text` / `-retry`
- Produces: 同组件公开 API 不变（`OriginPlayerSurface`、`OriginPlayerCloseHandle`）

- [x] **Step 1: 改写 origin 态 JSX**

将 `mode === 'origin'`（非 custom）时的媒体槽改为：

```tsx
<div
  className={`reader-video-sniff-placeholder${poster ? ' has-poster' : ''}${sessionError ? ' is-failed' : ''}`}
  role={sessionError ? 'alert' : 'status'}
  aria-live="polite"
>
  {poster ? (
    <img
      className="reader-video-sniff-poster"
      src={poster}
      alt=""
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  ) : null}

  {sessionError ? (
    <div className="reader-video-sniff-failed-stack">
      <p className="reader-video-sniff-failed-text">{sessionError}</p>
      {openOriginal && (
        <button type="button" className="reader-video-sniff-retry" onClick={openOriginal}>
          打开原文
        </button>
      )}
    </div>
  ) : (
    <span className="reader-video-sniff-pill">
      {candidate ? null : <span className="reader-video-sniff-dot" />}
      {candidate ? '已识别正片' : '原站播放中'}
    </span>
  )}

  {candidate && (
    <button
      type="button"
      onClick={() => void openCustom()}
      className="reader-video-sniff-retry absolute bottom-3 right-3 z-10"
    >
      用阅读器播放
    </button>
  )}
</div>
```

外层保留 `page-x mt-5`。`mode === 'custom' && candidate` 时仍在同槽挂 `InkVideoPlayer`（可用同一 placeholder 外包或现有 `relative aspect-video…` 外包；优先与 sniff 同圆角深底，避免昼读奶油边）。

「返回原站播放器」保持 `mt-2 text-[12px] text-paper-muted underline-offset-2 hover:underline`。

删除居中长文案与 `bg-ink-deep` / 实心 `bg-cinnabar` 浮钮。

- [x] **Step 2: 确认 custom 外包不破全屏**

`InkVideoPlayer` 必须仍占满媒体槽；外包 class 不要加会裁切全屏 portal 的 `overflow` 冲突（若 placeholder 带 `overflow: hidden`，custom 态改用不含该约束的 wrapper，例如：

```tsx
<div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-[#0c0d10]">
  <InkVideoPlayer ... />
</div>
```

origin 用 sniff placeholder；custom 用上述固定深色槽。）

- [x] **Step 3: Lint**

Run: `npx oxlint src/components/OriginPlayerSurface.tsx`  
Expected: 无 error — 已通过

- [x] **Step 4: 验收对照**

| 状态 | 期望 |
|---|---|
| origin 无候选 | 深色槽 + 左下「原站播放中」+ 脉冲点 |
| origin 有候选 | 左下「已识别正片」+ 右下「用阅读器播放」（retry 样式） |
| sessionError | 居中短句 +「打开原文」 |
| custom | InkVideoPlayer；下方「返回原站播放器」 |

实机可选：`npm run android:run` 打开自建源视频稿。

- [ ] **Step 5: Commit（仅当用户明确要求时）**

不主动 commit。用户要求时再提交 `OriginPlayerSurface.tsx` 与本 plan/spec（若需入库）。

---

## Spec coverage

| Spec 项 | Task |
|---|---|
| G1 深色 16:9 / 海报 | Task 1 Step 1 |
| G2 药丸 / 失败态 | Task 1 Step 1 |
| G3 浮钮 retry 样式 | Task 1 Step 1 |
| G4 行为零变化 | 未改 hooks/native；仅 JSX |
| 非目标 CMS/门控 | 未触及 |
