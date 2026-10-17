import { camelize, type Component } from 'vue'
import { warn } from '../core'

// Widget props can come from saved or shared layouts, so they are untrusted
// Vue applies any prop a component does not declare to its root element as an attribute,
// which would let a layout set style, href, innerHTML and the like on the page

type PropsOption = readonly string[] | Record<string, unknown> | undefined

interface ComponentShape {
  props?: PropsOption
  mixins?: ComponentShape[]
  extends?: ComponentShape
  __asyncResolved?: ComponentShape
}

const declaredCache = new WeakMap<object, Set<string> | null>()

function collect(shape: ComponentShape | undefined, into: Set<string>, depth = 0): void {
  if (!shape || typeof shape !== 'object' || depth > 10) return
  const option = shape.props
  if (Array.isArray(option)) option.forEach((name) => typeof name === 'string' && into.add(camelize(name)))
  else if (option && typeof option === 'object') Object.keys(option).forEach((name) => into.add(camelize(name)))
  collect(shape.extends, into, depth + 1)
  shape.mixins?.forEach((mixin) => collect(mixin, into, depth + 1))
}

/* Prop names a component declares, camelized, or null when it declares none */
function declaredProps(component: Component): Set<string> | null {
  const shape = ((component as ComponentShape).__asyncResolved ?? component) as ComponentShape
  if (declaredCache.has(shape)) return declaredCache.get(shape)!
  const names = new Set<string>()
  collect(shape, names)
  const result = names.size ? names : null
  // An async component is cached only once loaded, so its real props are picked up later
  if (!(component as { __asyncLoader?: unknown }).__asyncLoader || (component as ComponentShape).__asyncResolved) declaredCache.set(shape, result)
  return result
}

// Used only for components that declare no props, where everything would fall through
const UNSAFE_KEYS = new Set(['innerHTML', 'outerHTML', 'srcdoc', 'textContent', 'innerText', 'style', 'class', 'ref', 'key'])
const unsafeKey = (key: string) => UNSAFE_KEYS.has(key) || /^on[A-Z]/.test(key) || /^ref_/.test(key)

/*
 * The props to bind on a widget's component
 * Components that declare props get only those, the rest stay readable through useWidget
 * Components that declare none get everything except keys that could change the page or run code
 */
export function safeWidgetProps(component: Component, props: Record<string, unknown>, widgetId: string): Record<string, unknown> {
  const declared = declaredProps(component)
  const keys = Object.keys(props)
  if (declared) {
    if (keys.every((key) => declared.has(camelize(key)))) return props
    const out: Record<string, unknown> = {}
    for (const key of keys) if (declared.has(camelize(key))) out[key] = props[key]
    return out
  }
  if (!keys.some(unsafeKey)) return props
  warn(`Widget ${widgetId} has props that could change the page (like style, class, innerHTML or event handlers); they were ignored. Declare the props your widget component uses.`)
  const out: Record<string, unknown> = {}
  for (const key of keys) if (!unsafeKey(key)) out[key] = props[key]
  return out
}
