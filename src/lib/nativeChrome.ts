import { Capacitor } from '@capacitor/core'

import { type ResolvedTheme } from './theme'

type NativeChromeBridge = {
  setFullScreen?: (fullScreen: boolean) => void
  setSystemTheme?: (theme: string) => void
}

function isSplashBoot(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.boot === 'splash'
}

function nativeChromeBridge(): NativeChromeBridge | undefined {
  if (typeof window !== 'undefined') {
    return (window as any).NewsNookNative as NativeChromeBridge | undefined
  }
  return (globalThis as any).NewsNookNative as NativeChromeBridge | undefined
}

/**
 * 隐藏/恢复系统状态栏与导航栏。
 * Android WebView 边到边 + overlays 时，HTML requestFullscreen 只会让状态栏变透明浮层，必须走原生藏栏。
 * JavascriptInterface 不一定是 typeof === 'function'，只做真值判断。
 */
export function setNativeFullScreen(fullScreen: boolean): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('is-video-fullscreen', fullScreen)
  }
  const bridge = nativeChromeBridge()
  if (bridge?.setFullScreen) {
    bridge.setFullScreen(fullScreen)
  }
}

/**
 * 真机系统栏：边到边 + 透明栏，底色由 Web（splash / AppShell safe-area 条）提供。
 *
 * 边到边与透明栏在 MainActivity.onCreate 建立；这里只负责图标颜色跟随主题。
 *
 * 不要走 @capacitor/status-bar：其 setOverlaysWebView（以及插件构造函数）会写
 * 旧版 systemUiVisibility 标志，与 WindowInsetsController 在 Android 15+（targetSdk 35+）
 * 互相干扰，会导致视频全屏时状态栏隐藏失效。
 */
export async function applyNativeChrome(theme: ResolvedTheme): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const effective: ResolvedTheme = isSplashBoot() ? 'dark' : theme

  try {
    const bridge = nativeChromeBridge()
    if (bridge?.setSystemTheme) {
      bridge.setSystemTheme(effective)
    }
  } catch {
    // ignore
  }
}
