# AGENTS.md

> **System Context:** This file provides authoritative instructions for AI coding agents operating in this repository.
> **Goal:** Maintain the lightweight, vanilla JavaScript architecture of the "Marmot Defense" game without introducing unnecessary complexity.

---

## 1. Project Overview & Architecture

### Tech Stack
- **Language:** Vanilla JavaScript (ES6+).
- **Platform:** HTML5 Canvas (Browser-based).
- **Dependencies:** **NONE**. No `npm`, `package.json`, bundlers (Webpack/Vite), or frameworks.
- **Entry Point:** `index.html` loads `game.js`.

### Directory Structure
- `index.html`: Contains HTML structure, UI overlay, and CSS in `<style>` block.
- `game.js`: Monolithic file (~1400+ lines) containing:
    -   **Constants & Config:** Game balance settings (`ELEMENT_CHART`, `TOWER_TYPES`, `WAVES`).
    -   **Global State:** The `game` object.
    -   **Classes:** `Enemy`, `Tower`, `Projectile`, `TextParticle`.
    -   **Engine:** `init()`, `gameLoop()`, `update()`, `draw()`.
    -   **UI Logic:** DOM manipulation functions.
- `*.png`: Asset files loaded directly via `Image()`.

---

## 2. Development Workflow

### Build & Run
- **Start Game:** Open `index.html` directly in a web browser.
- **Hot Reload:** None. Refresh the browser manually to apply changes.
- **Forbidden:** Do NOT attempt to run `npm install`, `npm start`, or create build scripts.

### Testing Strategy
- **Manual Testing:** Primary method. Play the game to verify changes.
- **"Run Single Test":** Since there is no test runner, interpret this as:
    1.  **Console Test:** Write a snippet to run in the browser console (e.g., `new Tower(0,0,0).getDamage()`).
    2.  **Scenario Isolation:** Temporarily modify `init()` to spawn a specific entity immediately (e.g., `game.enemies.push(new Enemy(0))`).
    3.  **Debug Logs:** Use `console.log` for logic verification, but remove them before committing.

---

## 3. Architecture & State Management

### Global State (`game`)
The `game` object in `game.js` is the **Single Source of Truth**.
-   **Do not** create other global variables for state.
-   **Properties:** `gold`, `lives`, `wave`, `enemies` (array), `towers` (array), `projectiles` (array).
-   **Reset:** Ensure `game` state is fully reset in `startGame()` or `init()` if adding new state properties.

### Game Loop
-   **Engine:** `requestAnimationFrame` drives `gameLoop()`.
-   **Update:** `update()` handles logic (movement, collision, cooldowns).
-   **Draw:** `draw()` handles all Canvas rendering.
-   **Coupling:** Entities (`Tower`, `Enemy`) have their own `update()` and `draw()` methods called by the main loop.

### Balance Configuration
-   **Constants:** `ELEMENT_CHART` defines the rock-paper-scissors logic. **Handle with care.**
-   **Waves:** `WAVES` array generator defines difficulty.
-   **Towers:** `TOWER_TYPES` defines tower stats.

---

## 4. Code Style & Conventions

### Formatting
-   **Indentation:** 4 spaces (Strict).
-   **Quotes:** Single quotes `'` preferred for JS; Double quotes `"` for HTML attributes.
-   **Semicolons:** **Always** use semicolons.
-   **Braces:** K&R style (opening brace on the same line).
-   **Max Line Length:** Soft limit 100, but flexible for long strings/HTML.

### Naming Conventions
-   **Constants:** `UPPER_SNAKE_CASE` (e.g., `CANVAS_WIDTH`, `ELEMENTS`).
-   **Classes:** `PascalCase` (e.g., `Tower`, `Enemy`).
-   **Variables/Functions:** `camelCase` (e.g., `gameLoop`, `updateUI`).
-   **DOM IDs:** `kebab-case` (e.g., `game-container`), accessed via `getElementById`.

### Error Handling & UI
-   **No Alerts:** Never use `window.alert()`.
-   **In-Game Feedback:** Use `showNotification("Message")` for temporary toasts.
-   **Visual Feedback:** Use `game.particles.push(new TextParticle(...))` for damage numbers or hit effects.

---

## 5. Agent-Specific Rules

### 1. Read Before Write
`game.js` is large. **Always** read the relevant section (e.g., "Classes", "Engine", "UI Updates") before modifying.
-   *Search first:* Use `grep` to find where a variable (like `game.gold`) is modified.

### 2. Vanilla & Simple
-   **No Modules:** Do not split `game.js` into ES modules (`import/export`) unless requested. It breaks local file opening (CORS).
-   **No External Libs:** Do not suggest generic UI libraries. Use standard HTML/CSS.

### 3. Asset Handling
-   **Missing Assets:** If adding a new feature that needs art, use **Canvas primitives** (circles, rects, colors) first.
-   **Placeholders:** If you must use an image, use a distinct color or label it in `draw()` until the user provides the asset.

### 4. Performance
-   **FPS:** Target 60-90 FPS.
-   **Optimization:** Avoid creating objects (like `new Vector()`) inside the `gameLoop` or `draw()` methods. Reuse objects or use raw numbers (x, y).
-   **Loops:** Use `for` loops or `forEach` for entity arrays. `filter` is used for cleanup (dead entities).

---

## 6. Git & Version Control

### Commit Messages
-   **Format:** `<type>: <subject>`
-   **Types:**
    -   `feat`: New game mechanics, towers, enemies.
    -   `fix`: Bug fix (collision, logic errors).
    -   `style`: Visual changes (CSS, canvas drawing, formatting).
    -   `refactor`: Code cleanup without logic change.
    -   `docs`: Updating AGENTS.md or README.
-   **Example:** `feat: add ice element slow effect`
