// Keyboard + mouse input. WASD / arrows to move, Shift to sneak (slow and
// quiet), click to toss a lure that draws wardens to the spot, M to mute,
// Enter / Space / click to start and to continue past overlays.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.clickX = e.clientX - rect.left;
      this.mouse.clickY = e.clientY - rect.top;
      this.mouse.clicked = true;
    });
  }

  /** Movement vector from the keys, normalised. */
  moveVector() {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy, sneak: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  consumeClick() {
    const clicked = this.mouse.clicked;
    this.mouse.clicked = false;
    return clicked ? { x: this.mouse.clickX, y: this.mouse.clickY } : null;
  }

  endFrame() {
    this.pressed.clear();
  }
}
