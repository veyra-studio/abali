/**
 * Veyra — a creative web experience engine.
 *
 * @packageDocumentation
 */
export const VERSION = '0.1.0'

export * from './core/math.js'
export * from './core/ease.js'
export * from './core/signal.js'
export * from './core/ticker.js'

export * from './motion/spring.js'
export * from './motion/values.js'
export { composeTransform, readValue, resetTransform, setValues, writeValue } from './motion/style.js'
export * from './motion/timeline.js'

export * from './env/viewport.js'
export * from './env/pointer.js'
export * from './env/capabilities.js'
export * from './scroll/scroll.js'
export * from './layout/rects.js'
export * from './scene/scene.js'

export * from './text/script.js'
export * from './text/split.js'
export * from './text/draw.js'

export * from './assets/preload.js'
export * from './quality/governor.js'
export * from './sound/bus.js'
export { DebugOverlay, debugRequested } from './debug/overlay.js'

export * from './stage.js'
