/**
 * 可变行高虚拟滚动的最小布局核心。
 *
 * 用 Fenwick 树（Binary Indexed Tree）维护逐行高度的前缀和，支持
 * O(log n) 的「改写某行高度」「前 n 行累计高度」「offset → 行下标」，
 * 让日志行高不定（自动换行）时也能只渲染视口内的行。
 *
 * 行高由调用方测量后经 `setHeight` 写入；未测量的行用估算值。
 */
export class VirtualLayout {
    private heights: number[] = []
    private tree = new Float64Array(0)
    private total = 0

    get length(): number {
        return this.heights.length
    }

    get totalHeight(): number {
        return this.total
    }

    /** 用一组行高重建（行列表变化时调用）。 */
    rebuild(heights: readonly number[]): void {
        const n = heights.length
        this.heights = new Array(n)
        this.tree = new Float64Array(n + 1)
        let total = 0
        for (let i = 0; i < n; i++) {
            const height = heights[i]!
            this.heights[i] = height
            this.tree[i + 1] = height
            total += height
        }
        for (let i = 1; i <= n; i++) {
            const parent = i + (i & -i)
            if (parent <= n) this.tree[parent]! += this.tree[i]!
        }
        this.total = total
    }

    /** 第 index 行的当前高度。 */
    height(index: number): number {
        return this.heights[index] ?? 0
    }

    /** 改写某行高度（实测后调用）。 */
    setHeight(index: number, height: number): void {
        const current = this.heights[index]
        if (current === undefined || current === height) return
        this.heights[index] = height
        const delta = height - current
        this.total += delta
        for (let i = index + 1; i < this.tree.length; i += i & -i)
            this.tree[i]! += delta
    }

    /** 前 index 行的累计高度。 */
    prefix(index: number): number {
        let sum = 0
        for (let i = index; i > 0; i -= i & -i) sum += this.tree[i]!
        return sum
    }

    /** 返回包含 offset 的行下标（在 Fenwick 树上二分）。 */
    find(offset: number): number {
        const n = this.heights.length
        if (n === 0) return 0
        let index = 0
        let remaining = offset
        let bit = 1
        while (bit << 1 <= n) bit <<= 1
        for (; bit > 0; bit >>= 1) {
            const next = index + bit
            if (next <= n && this.tree[next]! <= remaining) {
                index = next
                remaining -= this.tree[next]!
            }
        }
        return Math.min(index, n - 1)
    }

    /** 视口窗口 `[start, end)`（含 overscan 上下各几行）。 */
    range(
        scrollTop: number,
        viewportHeight: number,
        overscan: number
    ): { start: number; end: number } {
        const n = this.heights.length
        if (n === 0) return { start: 0, end: 0 }
        const start = Math.max(0, this.find(scrollTop) - overscan)
        const end = Math.min(
            n,
            this.find(scrollTop + viewportHeight) + 1 + overscan
        )
        return { start, end }
    }
}
