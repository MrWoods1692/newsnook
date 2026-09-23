const TICK_MS = 1_000
const FLUSH_MS = 60_000
const PAUSE_UNLESS_SCROLLED_MS = 3 * 60_000
const MAX_TRACKING_PER_POST_MS = 6 * 60_000
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000]
const RETRYABLE_STATUSES = new Set([405, 429, 500, 501, 502, 503, 504])

export interface LinuxDoTimingBatch {
  topicId: number
  topicTime: number
  timings: Record<number, number>
}

interface PendingTimingBatch extends LinuxDoTimingBatch {
  highestSeen: number
}

export interface LinuxDoReadTrackerOptions {
  send: (batch: LinuxDoTimingBatch) => Promise<void>
  onSent?: (topicId: number, highestSeen: number, postNumbers: number[]) => void
  now?: () => number
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { status?: unknown }
  return typeof candidate.status === 'number' ? candidate.status : undefined
}

/**
 * Discourse-compatible topic read tracker.
 *
 * It mirrors the important behavior of Discourse screen-track:
 * - count time only while the document is focused/visible;
 * - associate elapsed time with posts currently visible on screen;
 * - rush the first unseen timing batch, then flush every minute;
 * - pause after three minutes without scrolling;
 * - cap accumulated timing per post at six minutes;
 * - retry only transient server/rate-limit failures with bounded backoff.
 *
 * Read UI is advanced only after the server accepts /topics/timings.
 */
export class LinuxDoReadTracker {
  private readonly send: LinuxDoReadTrackerOptions['send']
  private readonly onSent?: LinuxDoReadTrackerOptions['onSent']
  private readonly now: () => number

  private topicId?: number
  private timer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private lastTick = 0
  private lastScrolled = 0
  private elapsedSinceFlush = 0
  private topicTime = 0
  private focused = true
  private visiblePosts = new Set<number>()
  private timings = new Map<number, number>()
  private totalTimings = new Map<number, number>()
  private pending: PendingTimingBatch[] = []
  private sending = false
  private retryCount = 0

  constructor(options: LinuxDoReadTrackerOptions) {
    this.send = options.send
    this.onSent = options.onSent
    this.now = options.now ?? Date.now
  }

  start(topicId: number): void {
    if (!Number.isInteger(topicId) || topicId <= 0) return
    this.stop(false)
    const now = this.now()
    this.topicId = topicId
    this.lastTick = now
    this.lastScrolled = now
    this.elapsedSinceFlush = 0
    this.topicTime = 0
    this.focused = true
    this.visiblePosts.clear()
    this.timings.clear()
    this.totalTimings.clear()
    this.pending = []
    this.retryCount = 0
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  setVisiblePosts(postNumbers: Iterable<number>): void {
    const next = new Set<number>()
    for (const raw of postNumbers) {
      const postNumber = Math.trunc(raw)
      if (postNumber > 0) next.add(postNumber)
    }
    this.visiblePosts = next
  }

  scrolled(): void {
    this.lastScrolled = this.now()
  }

  setFocused(focused: boolean): void {
    if (this.focused === focused) return
    this.focused = focused
    // Never count time spent hidden/backgrounded on the next tick.
    this.lastTick = this.now()
    this.elapsedSinceFlush = 0
  }

  /**
   * Stop sampling. By default the final partial timing is flushed, matching
   * Discourse when leaving a topic. flush=false is only used internally
   * before starting a different topic on the same tracker instance.
   */
  stop(flush = true): void {
    if (this.topicId === undefined) return
    if (flush) {
      this.tick()
      this.flush()
    }
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.topicId = undefined
    this.visiblePosts.clear()
    this.timings.clear()
    this.topicTime = 0
  }

  private tick(): void {
    if (this.topicId === undefined) return
    const now = this.now()
    const diff = Math.max(0, now - this.lastTick)
    this.lastTick = now

    if (now - this.lastScrolled > PAUSE_UNLESS_SCROLLED_MS) return

    this.elapsedSinceFlush += diff
    const rush = Array.from(this.timings.entries()).some(
      ([postNumber, timing]) =>
        timing > 0 && !this.totalTimings.has(postNumber),
    )
    if (!this.sending && (this.elapsedSinceFlush > FLUSH_MS || rush)) {
      this.flush()
    }

    if (!this.focused || diff <= 0) return

    this.topicTime += diff
    for (const postNumber of this.visiblePosts) {
      this.timings.set(postNumber, (this.timings.get(postNumber) ?? 0) + diff)
    }
  }

  private flush(): void {
    const topicId = this.topicId
    if (!topicId) return

    const batchTimings: Record<number, number> = {}
    let highestSeen = 0
    for (const [postNumber, timing] of this.timings) {
      if (timing <= 0) continue
      const total = this.totalTimings.get(postNumber) ?? 0
      const allowance = Math.max(0, MAX_TRACKING_PER_POST_MS - total)
      const accepted = Math.min(timing, allowance)
      this.timings.set(postNumber, 0)
      if (accepted <= 0) continue
      this.totalTimings.set(postNumber, total + accepted)
      batchTimings[postNumber] = accepted
      if (postNumber > highestSeen) highestSeen = postNumber
    }

    if (highestSeen <= 0) {
      this.elapsedSinceFlush = 0
      return
    }

    this.pending.push({
      topicId,
      topicTime: this.topicTime,
      timings: batchTimings,
      highestSeen,
    })
    this.topicTime = 0
    this.elapsedSinceFlush = 0
    void this.sendNext()
  }

  private async sendNext(): Promise<void> {
    if (this.sending || this.retryTimer || !this.pending.length) return
    const next = this.pending.shift()
    if (!next) return

    this.sending = true
    try {
      await this.send(next)
      this.retryCount = 0
      this.onSent?.(
        next.topicId,
        next.highestSeen,
        Object.keys(next.timings).map(Number),
      )
    } catch (error) {
      const status = errorStatus(error)
      if (status !== undefined && RETRYABLE_STATUSES.has(status)) {
        this.pending.unshift(next)
        const delay =
          RETRY_DELAYS_MS[Math.min(this.retryCount, RETRY_DELAYS_MS.length - 1)]
        this.retryCount += 1
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null
          void this.sendNext()
        }, delay)
      }
      // Auth/permission/validation errors are intentionally dropped. Repeating a
      // background read write would only create a request loop and user friction.
    } finally {
      this.sending = false
      if (!this.retryTimer && this.pending.length) void this.sendNext()
    }
  }
}
