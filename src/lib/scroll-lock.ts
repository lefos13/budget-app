/*
 * Reference-counted page scroll lock for dialogs. Each open dialog takes one
 * lock; the original overflow is saved by the first lock and restored only
 * when the last one is released, whatever order the cleanups run in (a stacked
 * dialog and its parent can unmount in the same commit, parent first).
 */
type StyleLike = { overflow: string };

let locks = 0;
let saved = '';

export function lockScroll(style: StyleLike): void {
  if (locks === 0) {
    saved = style.overflow;
    style.overflow = 'hidden';
  }
  locks += 1;
}

export function unlockScroll(style: StyleLike): void {
  if (locks === 0) return;
  locks -= 1;
  if (locks === 0) style.overflow = saved;
}
