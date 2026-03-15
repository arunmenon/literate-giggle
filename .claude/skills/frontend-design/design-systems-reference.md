# Design Systems Technical Reference

Technical craft principles for precision-focused interfaces. Use alongside SKILL.md (creative philosophy) and dashboard-visual-hierarchy.md (attention/color hierarchy).

**When to use this reference:**

- Enterprise SaaS, admin panels, developer tools
- Interfaces where consistency and polish matter more than creative expression
- Projects inspired by Linear, Stripe, Notion, Vercel, Mercury

**When SKILL.md takes precedence:**

- Marketing sites, landing pages, creative products
- Interfaces where memorable differentiation is the goal
- Projects that benefit from unexpected, bold choices

---

## 1. The 4px Spacing Grid

All spacing uses multiples of 4px. This creates visual rhythm and simplifies design decisions.

| Token      | Value | Use Case                                                |
| ---------- | ----- | ------------------------------------------------------- |
| `space-1`  | 4px   | Micro spacing: icon-to-text gaps, tight inline elements |
| `space-2`  | 8px   | Tight spacing: within components, related items         |
| `space-3`  | 12px  | Standard spacing: between related elements              |
| `space-4`  | 16px  | Comfortable spacing: component padding, section gaps    |
| `space-6`  | 24px  | Generous spacing: between distinct sections             |
| `space-8`  | 32px  | Major separation: page-level divisions                  |
| `space-12` | 48px  | Maximum separation: hero sections, major breaks         |

**Tailwind mapping:**

```css
/* 4px grid aligns with Tailwind's default scale */
gap-1     /* 4px */
gap-2     /* 8px */
gap-3     /* 12px */
gap-4     /* 16px */
gap-6     /* 24px */
gap-8     /* 32px */
p-4       /* 16px - standard card padding */
p-6       /* 24px - generous card padding */
```

**The symmetrical padding rule:**
Top-Left-Bottom-Right should match unless content naturally creates visual imbalance. Asymmetric padding requires intentional justification.

```css
/* Good */
padding: 16px;
padding: 12px 16px; /* horizontal emphasis - intentional */

/* Avoid without clear reason */
padding: 24px 16px 12px 16px;
```

---

## 2. Depth & Elevation Strategies

Choose ONE approach per project and commit. Mixing strategies creates visual incoherence.

### Strategy A: Borders Only (Flat)

Clean, technical, information-dense. Ideal for developer tools, data-heavy interfaces.

```css
:root {
  --border-subtle: rgba(0, 0, 0, 0.08);
  --border-default: rgba(0, 0, 0, 0.12);
  --border-strong: rgba(0, 0, 0, 0.16);
}

.card {
  border: 1px solid var(--border-default);
  box-shadow: none;
}
```

**When to use:** Linear-style density, GitHub-style utility, terminal/CLI aesthetics.

### Strategy B: Subtle Single Shadow

Soft lift without complexity. Approachable, modern.

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.card {
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(0, 0, 0, 0.04);
}
```

**When to use:** Notion-style warmth, consumer SaaS, collaborative tools.

### Strategy C: Layered Shadows (Premium)

Rich, dimensional, premium feel. Multiple layers create realistic depth.

```css
:root {
  --shadow-layered: 0 0 0 1px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.04),
    0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 8px rgba(0, 0, 0, 0.03);

  --shadow-layered-lg: 0 0 0 1px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.04),
    0 4px 8px rgba(0, 0, 0, 0.04), 0 8px 16px rgba(0, 0, 0, 0.03),
    0 16px 32px rgba(0, 0, 0, 0.02);
}

.card {
  box-shadow: var(--shadow-layered);
}

.modal {
  box-shadow: var(--shadow-layered-lg);
}
```

**When to use:** Stripe-style sophistication, Mercury-style finance, premium enterprise.

### Strategy D: Surface Color Shifts

Hierarchy through background tints rather than shadows. Minimal, elegant.

```css
:root {
  --surface-0: #ffffff; /* Base/page */
  --surface-1: #fafafa; /* Subtle elevation */
  --surface-2: #f5f5f5; /* Cards on cards */
  --surface-raised: #ffffff; /* Elevated on tinted bg */
}

/* Card on gray page - no shadow needed */
.page {
  background: var(--surface-1);
}
.card {
  background: var(--surface-0);
}
```

**When to use:** Ultra-minimal interfaces, when shadows feel heavy, Vercel-style clarity.

---

## 3. Border Radius Systems

Choose ONE system per project. Consistency creates coherence.

### Sharp System (Technical/Dense)

```css
--radius-sm: 4px; /* Buttons, inputs, badges */
--radius-md: 6px; /* Cards, dropdowns */
--radius-lg: 8px; /* Modals, large containers */
```

### Soft System (Friendly/Modern)

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
```

### Minimal System (Utility/Functional)

```css
--radius-sm: 2px;
--radius-md: 4px;
--radius-lg: 6px;
```

**Anti-pattern:** Large radius (16px+) on small elements. A tiny badge with 16px radius looks like a pill when it should look like a label.

---

## 4. Typography Scale & Weights

### Size Scale

```css
--text-xs: 11px; /* Fine print, timestamps */
--text-sm: 12px; /* Labels, captions, metadata */
--text-base: 14px; /* Body text, default */
--text-md: 16px; /* Emphasized body, subheadings */
--text-lg: 18px; /* Section headings */
--text-xl: 24px; /* Page headings */
--text-2xl: 32px; /* Hero headings */
```

### Weight & Tracking Patterns

| Element        | Weight         | Letter-spacing                            |
| -------------- | -------------- | ----------------------------------------- |
| Headlines      | 600 (semibold) | -0.02em (tighter)                         |
| Body           | 400-500        | normal                                    |
| Labels         | 500 (medium)   | +0.02em (looser, especially if uppercase) |
| Monospace data | 400-500        | normal                                    |

### Monospace for Data

Numbers, IDs, codes, and timestamps belong in monospace. This signals "data" and enables column alignment.

```css
.data-value {
  font-family: ui-monospace, "SF Mono", "Fira Code", monospace;
  font-variant-numeric: tabular-nums; /* Aligns numbers in columns */
}
```

**Apply to:**

- Prices, counts, metrics
- IDs, codes, hashes
- Timestamps, dates
- Version numbers
- File sizes, percentages

---

## 5. Contrast Hierarchy System

Build a four-level text contrast system and apply consistently.

```css
:root {
  /* Light mode */
  --text-foreground: #0a0a0a; /* Primary content */
  --text-secondary: #404040; /* Supporting content */
  --text-muted: #737373; /* De-emphasized */
  --text-faint: #a3a3a3; /* Disabled, placeholders */
}

.dark {
  --text-foreground: #fafafa;
  --text-secondary: #d4d4d4;
  --text-muted: #a3a3a3;
  --text-faint: #737373;
}
```

**Application pattern:**

- **Foreground:** Headlines, primary values, key metrics
- **Secondary:** Body text, descriptions
- **Muted:** Labels, timestamps, metadata
- **Faint:** Placeholders, disabled states, decorative text

---

## 6. Dark Mode Implementation

### Borders Over Shadows

Shadows underperform on dark backgrounds. Shift strategy toward borders.

```css
.dark {
  --shadow-md: 0 1px 3px rgba(0, 0, 0, 0.3); /* Heavier if used */
  --border-default: rgba(255, 255, 255, 0.1);
  --border-subtle: rgba(255, 255, 255, 0.06);
}

/* Prefer border definition in dark mode */
.dark .card {
  border: 1px solid var(--border-default);
  box-shadow: none; /* Or very subtle */
}
```

### Semantic Color Adjustment

Status colors need desaturation to avoid harshness on dark backgrounds.

```css
/* Light mode - full saturation */
--success: #22c55e; /* green-500 */
--warning: #f59e0b; /* amber-500 */
--error: #ef4444; /* red-500 */

/* Dark mode - desaturated */
.dark {
  --success: #4ade80; /* green-400 */
  --warning: #fbbf24; /* amber-400 */
  --error: #f87171; /* red-400 */
}
```

### Surface Inversion

Same hierarchy model, inverted values.

```css
.dark {
  --surface-0: #0a0a0a; /* Base/page */
  --surface-1: #141414; /* Subtle elevation */
  --surface-2: #1f1f1f; /* Cards */
  --surface-raised: #262626; /* Elevated elements */
}
```

### Enable color-scheme Property

Tells the browser to style native elements (scrollbars, form controls) appropriately.

```css
:root {
  color-scheme: light dark;
}

/* Or explicitly per theme */
.light {
  color-scheme: light;
}
.dark {
  color-scheme: dark;
}
```

This affects scrollbar colors, form control backgrounds, and system UI elements.

---

## 7. Content Overflow Handling

### Flex Children Need min-w-0

Flex children can overflow their parent without this. Common source of layout bugs.

```css
/* BAD - text can overflow container */
.flex-parent {
  display: flex;
}
.flex-child {
  /* Long text breaks layout */
}

/* GOOD - enables proper truncation */
.flex-child {
  min-width: 0; /* min-w-0 in Tailwind */
}
```

### Text Truncation Patterns

```css
/* Single line truncate */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line clamp (2 lines) */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

/* Allow wrapping with word break */
.wrap-break {
  overflow-wrap: break-word;
  word-break: break-word;
}
```

### Common Pattern: Truncated Flex Item

```jsx
<div className="flex items-center gap-3">
  <Avatar />
  <div className="min-w-0 flex-1">
    <p className="truncate font-medium">{user.name}</p>
    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
  </div>
  <Button>Edit</Button>
</div>
```

---

## 8. Custom Form Controls

Native form elements have limited styling. For polished interfaces, build custom controls.

### Custom Select Pattern

```jsx
// Structure: trigger button + positioned dropdown
<div className="relative">
  {/* Trigger - MUST use inline-flex + nowrap */}
  <button className="inline-flex items-center justify-between gap-2 whitespace-nowrap">
    <span>{selectedValue}</span>
    <ChevronDown className="h-4 w-4 shrink-0" />
  </button>

  {/* Dropdown - absolutely positioned */}
  {open && (
    <div className="absolute top-full mt-1 w-full rounded-md border bg-popover shadow-md">
      {options.map((opt) => (
        <button
          key={opt.value}
          className="w-full px-3 py-2 text-left hover:bg-accent"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )}
</div>
```

**Critical:** `whitespace-nowrap` on trigger prevents text-chevron wrapping. `shrink-0` on icon prevents compression.

### Custom Checkbox/Radio

```jsx
<label className="flex items-center gap-2 cursor-pointer">
  <div className={cn(
    "h-4 w-4 rounded border flex items-center justify-center",
    checked ? "bg-primary border-primary" : "border-input"
  )}>
    {checked && <Check className="h-3 w-3 text-primary-foreground" />}
  </div>
  <span>Label text</span>
  <input type="checkbox" className="sr-only" checked={checked} onChange={...} />
</label>
```

### Date Picker Pattern

```jsx
<Popover>
  <PopoverTrigger asChild>
    <button className="inline-flex items-center gap-2 border rounded-md px-3 py-2">
      <CalendarIcon className="h-4 w-4" />
      <span>{date ? format(date, "PPP") : "Pick a date"}</span>
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar selected={date} onSelect={setDate} />
  </PopoverContent>
</Popover>
```

---

## 9. Navigation Context

Screens need grounding. Every view should include:

1. **Navigation structure** - Sidebar or top nav showing position in app
2. **Location indicator** - Active nav state, breadcrumbs, or page title
3. **User context** - Avatar, workspace name, account status

### Unified Sidebar Pattern

Sidebars can share the main content background (Linear, Supabase, Vercel approach):

```jsx
<div className="flex h-screen">
  {/* Sidebar - same bg as content, subtle border separation */}
  <aside className="w-64 border-r bg-background">
    <nav>...</nav>
  </aside>

  {/* Main content */}
  <main className="flex-1 bg-background">...</main>
</div>
```

This reduces visual weight compared to contrasting sidebar colors.

### Active State Pattern

```jsx
<nav className="space-y-1">
  {items.map((item) => (
    <a
      key={item.href}
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </a>
  ))}
</nav>
```

---

## 10. Card Architecture

Monotonous cards are lazy design. Different card types deserve distinct internal structures while maintaining consistent surface treatment.

### Surface Consistency (Maintain Across All Cards)

- Same border weight
- Same shadow depth
- Same corner radius
- Same padding scale
- Same typography hierarchy

### Internal Variety (Customize Per Card Type)

| Card Type     | Internal Structure                 |
| ------------- | ---------------------------------- |
| Metric card   | Large number + label + sparkline   |
| User card     | Avatar + name + role + action      |
| Plan card     | Title + feature list + price + CTA |
| Settings card | Label + description + control      |
| Activity card | Avatar + action text + timestamp   |

```jsx
// Consistent surface, varied internals
<Card className="p-4 border rounded-lg shadow-sm">
  {/* Metric variant */}
  <div className="flex items-end justify-between">
    <div>
      <p className="text-sm text-muted-foreground">Revenue</p>
      <p className="text-3xl font-semibold tabular-nums">$45,231</p>
    </div>
    <Sparkline data={revenueData} className="h-12 w-24" />
  </div>
</Card>

<Card className="p-4 border rounded-lg shadow-sm">
  {/* User variant */}
  <div className="flex items-center gap-3">
    <Avatar src={user.avatar} />
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate">{user.name}</p>
      <p className="text-sm text-muted-foreground">{user.role}</p>
    </div>
    <Button variant="ghost" size="sm">Edit</Button>
  </div>
</Card>
```

---

## 11. Design Direction Reference

Six established aesthetic approaches. Use as starting points, not templates.

### 1. Precision & Density

**References:** Linear, Raycast, Warp
**Characteristics:** Tight 4px spacing, monochrome palette, keyboard-first, information density
**Typography:** Monospace influence, small base size (13px)
**Depth:** Borders only, minimal shadows
**Best for:** Developer tools, power-user software

### 2. Warmth & Approachability

**References:** Notion, Coda, Craft
**Characteristics:** Generous spacing, soft shadows, warm neutrals, friendly illustrations
**Typography:** Humanist sans (SF Pro, Satoshi), comfortable base (15-16px)
**Depth:** Subtle single shadows
**Best for:** Collaborative tools, consumer productivity

### 3. Sophistication & Trust

**References:** Stripe, Mercury, Ramp
**Characteristics:** Cool slate tones, layered depth, financial precision, data clarity
**Typography:** Clean geometric (Geist, Inter), tabular numbers prominent
**Depth:** Layered shadows, premium feel
**Best for:** Fintech, B2B enterprise, anything handling money

### 4. Boldness & Clarity

**References:** Vercel, Resend, Clerk
**Characteristics:** High contrast (black/white), dramatic negative space, confident typography
**Typography:** Strong weight contrast, oversized headings
**Depth:** Surface shifts, minimal shadows
**Best for:** Developer platforms, modern SaaS

### 5. Utility & Function

**References:** GitHub, GitLab, Jira
**Characteristics:** Muted palette, functional density, battle-tested patterns
**Typography:** System fonts acceptable, utilitarian sizing
**Depth:** Subtle borders, low elevation
**Best for:** Developer tools, issue trackers, repositories

### 6. Data & Analysis

**References:** Metabase, Amplitude, Mixpanel
**Characteristics:** Chart-optimized layouts, numbers as heroes, technical but accessible
**Typography:** Monospace for values, clear labeling
**Depth:** Clean separation for data clarity
**Best for:** Analytics, BI tools, dashboards

---

## 12. Animation Guidelines (Enterprise Context)

For precision-focused interfaces, animation should be functional, not decorative.

### Timing Scale

```css
--duration-fast: 100ms; /* Micro-interactions: hovers, toggles */
--duration-normal: 150ms; /* State changes: dropdowns, tabs */
--duration-slow: 200ms; /* Larger transitions: modals, panels */
--duration-slower: 300ms; /* Page transitions, complex reveals */
```

### Easing

```css
--ease-out: cubic-bezier(0.25, 1, 0.5, 1); /* Most UI interactions */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* Symmetric transitions */
```

### Enterprise Animation Restraints

In precision/enterprise contexts, avoid:

- Spring/bouncy physics (feels casual)
- Excessive stagger delays (slows perceived performance)
- Decorative motion (particles, floating elements)
- Long durations (>300ms feels sluggish)

**Note:** These restraints apply to enterprise/precision contexts. SKILL.md's guidance on bold motion applies when creative expression is the goal.

---

## 13. Anti-Patterns (Context-Aware)

These are problems in precision-focused enterprise interfaces. Some may be intentional choices in creative contexts governed by SKILL.md.

### Always Avoid

- Asymmetric padding without clear justification
- Mixing shadow strategies within one interface
- Inconsistent border radius across similar elements
- Text below WCAG contrast minimums
- Broken grid alignment (unintentional)

### Avoid in Enterprise/Precision Contexts

- Dramatic drop shadows (`box-shadow: 0 25px 50px...`)
- Large border radius (16px+) on small elements
- Thick decorative borders (2px+)
- Spring/bouncy animations
- Multiple accent colors competing for attention
- Excessive whitespace (margins > 48px between related sections)

### Context-Dependent (May Be Intentional in Creative Work)

- Decorative gradients and color washes
- Asymmetric/broken grid layouts
- Dramatic shadows for atmosphere
- Bold, unexpected typography choices
- High-impact motion and scroll effects

---

## 14. Quality Checklist

Before finalizing any precision-focused interface:

**Spacing & Grid**

- [ ] All spacing uses 4px multiples
- [ ] Padding is symmetrical (or asymmetry is justified)
- [ ] Elements align to grid

**Depth & Elevation**

- [ ] Single shadow strategy used consistently
- [ ] Border radius system is consistent
- [ ] Elevation hierarchy is clear (page < card < modal)

**Typography**

- [ ] Font scale is consistent
- [ ] Weight/tracking patterns match element types
- [ ] Data values use monospace + tabular-nums

**Color & Contrast**

- [ ] Four-level contrast hierarchy applied
- [ ] Status colors are semantic and consistent
- [ ] WCAG AA contrast ratios met

**Dark Mode** (if applicable)

- [ ] Shadows reduced, borders emphasized
- [ ] Status colors desaturated appropriately
- [ ] Surface hierarchy inverted correctly

**Navigation**

- [ ] Location in app is clear
- [ ] Active states are visually distinct
- [ ] User context is visible

---

## Integration with SKILL.md

This reference provides technical craft principles. SKILL.md provides creative philosophy. They work together:

| Situation                                  | Primary Guide                                  |
| ------------------------------------------ | ---------------------------------------------- |
| Building a dashboard for a fintech startup | This reference + dashboard-visual-hierarchy.md |
| Creating a marketing landing page          | SKILL.md (bold creativity)                     |
| Designing a developer tool                 | This reference (precision & density)           |
| Building a creative portfolio site         | SKILL.md (unexpected choices)                  |
| Enterprise admin panel                     | This reference (consistency & polish)          |

**When in conflict:** Consider the product context. Enterprise users expect predictable, polished interfaces. Consumer/creative products benefit from memorable, distinctive design. Let the audience guide which principles take precedence.

---

## Sources

Principles adapted from:

- Linear, Stripe, Notion, Vercel design systems
- Dammyjay93/claude-design-skill (GitHub)
- Material Design 3 spacing and elevation guidelines
- Apple Human Interface Guidelines

---

_Reference compiled: January 2025_
