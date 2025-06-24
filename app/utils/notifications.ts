export function notifyUser() {
  const audio = new Audio('/sounds/notify.mp3');
  audio.play().catch(e => console.warn('Audio failed', e));

  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}
