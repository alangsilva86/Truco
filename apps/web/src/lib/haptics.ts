type HapticPattern = number | number[];

export function triggerHaptic(pattern: HapticPattern): void {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return;
  }

  navigator.vibrate(pattern);
}
