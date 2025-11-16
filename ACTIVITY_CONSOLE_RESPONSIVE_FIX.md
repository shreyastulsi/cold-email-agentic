# Activity Console Responsive Layout Fix

## Summary
Fixed responsive layout issues with the Activity Console to prevent text overflow in cards and ensure the console cannot overlap the main content section.

## Changes Made

### 1. Horizontal Scrolling (`frontend/src/index.css` & `frontend/src/pages/Search.jsx`)

#### Added Horizontal Scroll Support
- Changed main content containers from `overflow-x-hidden` to `overflow-x-auto`
- Allows horizontal scrolling when Activity Console takes up space
- Content maintains minimum width of 600px
- Smooth scrolling behavior with custom styled scrollbar

#### Custom Scrollbar Styling
- **Height**: 12px for comfortable scrolling
- **Track**: Semi-transparent dark gray `rgba(31, 41, 55, 0.5)`
- **Thumb**: Blue-to-purple gradient `rgba(59, 130, 246, 0.6)` to `rgba(147, 51, 234, 0.6)`
- **Hover**: Brighter gradient on hover for better visibility
- **Firefox Support**: Uses `scrollbar-width: thin` and matching colors

### 2. Activity Console (`frontend/src/components/activity-console.tsx`)

#### Resize Constraint Logic
- **Maximum Width Calculation**: The console now dynamically calculates its maximum width to ensure at least 600px remains for the main content area
  ```typescript
  const viewportWidth = window.innerWidth
  const maxConsoleWidth = Math.min(800, viewportWidth - 600) // Leave at least 600px for content
  const newWidth = Math.max(200, Math.min(maxConsoleWidth, resizeStartWidth.current + deltaX))
  ```

#### Window Resize Handler
- Added event listener to recalculate max width when browser window is resized
- Automatically adjusts console width if it exceeds the new maximum after window resize
- Prevents console from overlapping content on smaller screens

#### Visual Feedback
- Updated resize handle tooltip to show dynamic min/max values
- Helps users understand the resizing constraints

### 3. Search Page (`frontend/src/pages/Search.jsx`)

#### Main Content Container
- Added `min-w-[600px]` class to ensure minimum width for content area
- Changed from `overflow-x-hidden` to `overflow-x-auto` to enable horizontal scrolling
- Applied to both main search view and mapping view containers
- Inner content maintains `min-w-[600px]` to preserve layout integrity

#### Card Text Overflow Prevention

**Jobs List Card**:
- Added `overflow-hidden` to Card component
- Added `break-words line-clamp-2` to job titles (limits to 2 lines with ellipsis)
- Added `break-words` to company names
- Added `overflow-hidden` to job card containers

**Recruiter Mapping Card**:
- Added `overflow-hidden` to Card component
- Added `break-words line-clamp-2 pr-6` to job titles (padding-right for remove button)
- Added `break-words` to company names
- Added `overflow-hidden` to relative container

**Search Card**:
- Added `overflow-hidden` to main search Card
- Added `break-words` to card titles

**Filter Chips (Companies & Job Titles)**:
- Added `max-w-full overflow-hidden` to chip containers
- Added `break-words truncate` to text within chips
- Ensures long company/job names don't break layout

## Technical Details

### Responsive Breakpoints
- **Minimum content width**: 600px
- **Minimum console width**: 200px
- **Maximum console width**: min(800px, viewport width - 600px)

### CSS Classes Used
- `break-words`: Allows text to wrap at any character when needed
- `truncate`: Shows ellipsis (...) for overflow text
- `line-clamp-2`: Limits text to 2 lines with ellipsis
- `overflow-hidden`: Prevents content overflow
- `min-w-[600px]`: Sets minimum width constraint
- `max-w-full`: Ensures element doesn't exceed parent width

### Behavior
1. **Resizing**: User can drag the Activity Console resize handle, but it will stop when the main content reaches 600px width
2. **Window Resize**: Console automatically shrinks if window becomes too small to maintain both console and content minimum widths
3. **Text Wrapping**: All text within cards properly wraps and truncates to prevent overflow
4. **Layout Shift**: Content smoothly shifts when console opens/closes or is resized

## User Benefits
- ✅ No text overflow in cards when Activity Console is wide
- ✅ Console cannot overlap or obscure main content
- ✅ **Horizontal scrolling** available when needed - smooth and styled
- ✅ Content maintains proper width and structure at all times
- ✅ Smooth, responsive behavior on all screen sizes
- ✅ Clear visual feedback about resize limits
- ✅ Beautiful gradient scrollbar matches the app's design
- ✅ Professional, polished appearance

## Testing Recommendations
1. Resize Activity Console to maximum width - content should remain at least 600px wide
2. **Scroll horizontally** when console is wide - scrollbar should appear and work smoothly
3. Resize browser window while console is open - console should auto-adjust
4. Test with very long company names and job titles - should truncate/wrap properly
5. Test on smaller screens (1366px, 1440px, 1920px) - layout should be responsive with horizontal scroll
6. Verify drag-and-drop still works with truncated text
7. Check that all buttons remain clickable when text is truncated
8. Verify scrollbar appearance and hover effects work correctly

## Related Files
- `/Users/shreyastulsi/Cold-Email/frontend/src/components/activity-console.tsx` (resize constraints)
- `/Users/shreyastulsi/Cold-Email/frontend/src/pages/Search.jsx` (horizontal scroll, responsive cards)
- `/Users/shreyastulsi/Cold-Email/frontend/src/index.css` (custom scrollbar styling)
- `/Users/shreyastulsi/Cold-Email/frontend/src/components/ui/card.tsx` (unchanged, but used)
- `/Users/shreyastulsi/Cold-Email/frontend/src/components/ui/wobble-card.tsx` (unchanged, but used)

