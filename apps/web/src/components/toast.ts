let el: HTMLDivElement | null = null;
let timer: number | undefined;

export function toast(msg: string): void {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove('on'), 2600);
}
