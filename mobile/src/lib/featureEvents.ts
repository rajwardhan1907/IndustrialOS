// mobile/src/lib/featureEvents.ts
// Lightweight event emitter that works on web and native without
// requiring the Node.js "events" polyfill (which isn't in package.json
// and caused a blank screen on Vercel web builds).

type Listener = (...args: any[]) => void;

class SimpleEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, fn: Listener) {
    (this.listeners[event] ??= []).push(fn);
    return this;
  }

  off(event: string, fn: Listener) {
    const arr = this.listeners[event];
    if (arr) this.listeners[event] = arr.filter(f => f !== fn);
    return this;
  }

  emit(event: string, ...args: any[]) {
    for (const fn of this.listeners[event] ?? []) fn(...args);
    return this;
  }
}

const featureEmitter = new SimpleEmitter();
export default featureEmitter;
