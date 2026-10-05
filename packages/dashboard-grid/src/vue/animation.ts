// Grid animation settings
// Movement uses CSS transitions driven by --dg-duration and --dg-easing, so it stays on the compositor

export type AnimationPreset = 'none' | 'snappy' | 'smooth' | 'gentle' | 'bouncy'

export interface AnimationOptions {
  /* Duration in ms for moves, resizes, enters and leaves */
  duration?: number
  /* Any CSS easing, like ease-out or cubic-bezier(.2, .8, .2, 1) */
  easing?: string
  /* Fade and scale new widgets in, default true */
  enter?: boolean
  /* Fade and scale removed widgets out, default true */
  leave?: boolean
  /* Turn animation off for users who prefer reduced motion, default true */
  respectReducedMotion?: boolean
}

/* On or off, a preset name, a preset plus overrides, or full options */
export type AnimationSetting = boolean | AnimationPreset | (AnimationOptions & { preset?: AnimationPreset })

export interface ResolvedAnimation {
  duration: number
  easing: string
  enter: boolean
  leave: boolean
}

export const ANIMATION_PRESETS: Record<AnimationPreset, { duration: number; easing: string }> = {
  none: { duration: 0, easing: 'linear' },
  snappy: { duration: 120, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
  smooth: { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  gentle: { duration: 350, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  bouncy: { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
}

/* Resolve to concrete values, unknown input falls back to smooth */
export function resolveAnimation(setting: AnimationSetting | undefined, reducedMotion: boolean): ResolvedAnimation {
  const off: ResolvedAnimation = { duration: 0, easing: 'linear', enter: false, leave: false }
  if (setting === false || setting === 'none') return off

  let preset = ANIMATION_PRESETS.smooth
  let options: AnimationOptions = {}
  if (typeof setting === 'string' && setting in ANIMATION_PRESETS) preset = ANIMATION_PRESETS[setting]
  else if (setting && typeof setting === 'object') {
    options = setting
    if (setting.preset && setting.preset in ANIMATION_PRESETS) preset = ANIMATION_PRESETS[setting.preset]
  }

  if (reducedMotion && options.respectReducedMotion !== false) return off
  const duration = typeof options.duration === 'number' && Number.isFinite(options.duration) ? Math.max(0, options.duration) : preset.duration
  if (duration === 0) return off
  return {
    duration,
    easing: typeof options.easing === 'string' && options.easing.trim() ? options.easing : preset.easing,
    enter: options.enter !== false,
    leave: options.leave !== false,
  }
}

/*
 * Fade out a copy of a removed widget where it was, then delete the copy
 * The real widget is already gone, so this never blocks anything
 */
export function animateLeave(el: HTMLElement, container: HTMLElement, animation: ResolvedAnimation): void {
  if (!animation.leave || typeof el.animate !== 'function') return
  try {
    const copy = el.cloneNode(true) as HTMLElement
    copy.removeAttribute('data-widget-id')
    copy.classList.add('dg-item--leaving')
    copy.style.pointerEvents = 'none'
    copy.style.transition = 'none'
    container.appendChild(copy)
    const base = copy.style.transform
    const motion = copy.animate(
      [
        { opacity: 1, transform: `${base} scale(1)` },
        { opacity: 0, transform: `${base} scale(0.92)` },
      ],
      { duration: animation.duration, easing: animation.easing, fill: 'forwards' },
    )
    const cleanup = () => copy.remove()
    motion.onfinish = cleanup
    motion.oncancel = cleanup
    // Never leave a copy behind, even if animation events do not fire
    setTimeout(cleanup, animation.duration + 100)
  } catch {
    // Leave animations are decoration, ignore failures
  }
}
