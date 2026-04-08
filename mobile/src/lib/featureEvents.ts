// mobile/src/lib/featureEvents.ts
// Module-level EventEmitter so ProfileScreen can signal _layout.tsx
// to reload features immediately without waiting for app background/foreground.
import { EventEmitter } from "events";

const featureEmitter = new EventEmitter();
export default featureEmitter;
