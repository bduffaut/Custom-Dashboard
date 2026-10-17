# Changelog

## 0.2.0

### Fixed

- `sizeToContent` widgets now refit after outside changes, like loading a saved layout after mount, undo or a reset. Before, they kept their old height until their content changed size
- Content sizing measures the layout size, so a widget added during its enter animation is no longer fitted to its scaled-down size
- `drag-end` and `resize-end` now pass the widget at its final spot instead of where it started

### Added

- `change` has a second argument, `{ source }`, which is `user` for drags, resizes, keys, drops and method calls and `auto` when the grid adjusts the layout itself, like sizing to content
- `useLayoutStorage` options `loadOnMount`, for server rendering without hydration mismatches, and `reconcile`, to adjust a loaded layout
- `reconcileLayout(saved, current)` merges a saved layout with the widgets that exist now
- `parseLayout` reads a layout that was JSON encoded twice, with a warning
- Widgets sized to their content only show sideways resize handles
- Widgets sized to their content are drawn exactly as tall as the content instead of the rounded up row height, so their outline, handles and drag placeholder no longer hang past the visible card

### Docs

- `serializeLayout` returns a JSON string, the old example suggested an object
- The order of `update:modelValue`, `change` and `drag-end` is documented
- A recipe for even spacing under content sized widgets
- Server rendering support is mentioned in the README

## 0.1.0

First release
