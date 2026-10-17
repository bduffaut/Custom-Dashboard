# Reliability and limits

## When things go wrong

- Live data is safe to stream in. Replacing the array with new content at the same positions never interrupts a drag, never re-tidies the layout and never adds an undo step
- A widget that throws is replaced by a fallback with a Retry button, `widget-error` fires and the rest of the dashboard keeps working
- Bad data like missing or duplicate ids, `NaN` sizes or non-arrays is fixed or skipped, with one console warning per problem
- Layouts from other people are safe to load. A widget `type` only matches your own `components`, and a component only receives the props it declares, so a layout cannot set `style`, `class`, `href`, `innerHTML` or event handlers on the page. A component that declares no props gets everything except those. Anything your own widget does with its props, like rendering them with `v-html` or using one as a link, is still up to you
- Untrusted layouts with thousands of widgets cost real time to lay out (about 0.1s for 2,000, 2.5s for 10,000), so check the array length before loading a layout you did not make
- An interrupted drag (Escape, the window losing focus, the browser taking the pointer, the widget removed mid-drag) is cancelled and nothing is saved. A mouse released outside the window finishes the drag when the pointer comes back
- Dragged and resized widgets never go past the grid's sides or top, so the page never gets a sideways scrollbar
- Overlaps are resolved, even between static widgets, and rows are capped at 10,000 so corrupt data like `y: 1e9` cannot make a giant grid
- When `addWidget`, a drop or `autoArrange` would not fit within `max-rows`, it is refused with `null` or `false` instead of overflowing

## Edge cases and limits

- Positions are whole cells. While dragging, the grid looks at the exact pointer position and slides into a free cell next to it before it pushes a neighbour
- Collapsed widgets keep their full `h` in your data, so raw positions can look overlapped if you ignore `collapsed`. The grid always draws them correctly
- Size to content needs a natural height. Content with `height: 100%` cannot be measured, and content whose height depends on the widget's height stops resizing after a few tries with a warning
- If the grid changes width mid-drag, like a scrollbar appearing, the widget keeps its grab point under the pointer. Crossing a breakpoint cancels the drag, since the whole layout changes
- Dropping between grids aims at where each grid was when the drag started, adjusted for any scrolling since. Live previews are ignored on purpose, otherwise a group pushed down by a preview would slide away from the pointer
- Widget ids must be unique within a grid. A widget dropped into a grid that already has its id gets a new one
- Layout work grows with the square of the widget count. A few hundred widgets stay smooth, thousands need `lazy` and testing on slow devices
