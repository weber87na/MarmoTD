# AGENTS.md

> **System Context:** This file provides authoritative instructions for AI coding agents operating in this repository.
> **Goal:** Maintain the lightweight, vanilla JavaScript architecture of the Marmot Defense game without introducing unnecessary complexity.

---

## 1. Project Overview & Architecture

### Tech Stack
- **Language:** Vanilla JavaScript (ES6+)
- **Platform:** HTML5 Canvas (Browser-based)
- **Dependencies:** None (No `npm`, `package.json`, or build tools)
- **Asset Management:** Images loaded directly via `Image()` object (e.g., `MarmotPostfix128.png`).

### Directory Structure
- `index.html`: Entry point, UI layout, and CSS styles.
- `game.js`: Contains ALL game logic, classes, and state management.
- `*.png`: Game assets.

---

## 2. Development Workflow

### Build & Run
- **Start Game:** Open `index.html` in any modern web browser.
- **Reload:** Refresh the browser page to apply changes.
- **No Build Step:** Do **not** try to run `npm install` or `npm start`.

### Linting & Formatting
*This project does not use automated linters. Strictly mimic the existing style:*
- **Indentation:** 4 spaces.
- **Quotes:** Single quotes `'` preferred.
- **Semicolons:** Always use semicolons `;`.
- **Braces:** K&R style (opening brace on the same line).

### Testing Strategy
- **Manual Testing:** Since there is no test runner, verify changes by playing the game.
- **"Run Single Test":** Interpreted as "Isolate the logic in a console script" or "Create a temporary specific scenario in `init()`" (e.g., spawn a specific tower or enemy immediately).

---

## 3. Code Style & Conventions

### Naming Conventions
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `CANVAS_WIDTH`, `ELEMENTS`).
- **Classes:** `PascalCase` (e.g., `Tower`, `Enemy`).
- **Variables/Functions:** `camelCase` (e.g., `gameLoop`, `updateUI`).
- **DOM IDs:** `kebab-case` in HTML (e.g., `game-container`), accessed via `getElementById`.

### Global State Management
- The game state is centralized in the global `game` object.
- **DO NOT** scatter state variables outside this object unless they are constant configurations.

### Error Handling & User Feedback
- **Deprecation:** Do **not** use `alert()`.
- **Preferred Method:** Use `showNotification("Message")` for in-game feedback (e.g., "Not enough gold!").

### CSS & UI
- Keep CSS within the `<style>` block in `index.html` unless the file grows too large.
- Use Flexbox/Grid for layout (as seen in `#sidebar` and `.stats`).

---

## 4. Agent-Specific Rules

### Behavior Protocol
1.  **Vanilla First:** Solve problems using standard Web APIs. Do not suggest installing libraries (React, Phaser, etc.) unless explicitly requested.
2.  **Single File Logic:** Keep game logic in `game.js`. Do not split into modules (ESM) unless the user asks for a refactor, as this requires a local server to avoid CORS issues.
3.  **Asset Handling:** When adding images, assume they are local files. If creating placeholders, usage of `ctx` drawing primitives (circles, squares) is preferred over external placeholders.

### Interaction with Cursor/Copilot
- **Read First:** Always read `game.js` completely before making changes to understand the coupling between `update()`, `draw()`, and the `game` state.
- **Performance:** Be mindful of the `gameLoop`. Avoid heavy computations in `draw()` or `update()` that could drop FPS below 60.

---

## 5. Git & Version Control

### Commit Messages
- **Format:** `<type>: <subject>`
- **Types:**
    - `feat`: New game mechanics (e.g., new tower, enemy type).
    - `fix`: Bug fix (e.g., collision detection, UI glitch).
    - `style`: Visual changes (CSS, canvas drawing).
    - `refactor`: Code cleanup without logic change.

*Example:* `feat: add poison damage effect to enemies`
