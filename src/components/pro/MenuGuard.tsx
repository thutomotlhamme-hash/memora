'use client';

import { useEffect } from 'react';

/**
 * Keeps the studio's `<details class="st-menu">` dropdowns tidy: one open at a time,
 * and they close on an outside tap, on Escape, or once a link inside is chosen.
 */
export function MenuGuard() {
  useEffect(() => {
    const openMenus = () => [...document.querySelectorAll<HTMLDetailsElement>('details.st-menu[open]')];
    const closeAll = (except?: Element) => openMenus().forEach((m) => m !== except && (m.open = false));

    const onToggle = (e: Event) => {
      const menu = e.target as HTMLElement;
      if (menu instanceof HTMLDetailsElement && menu.matches('.st-menu') && menu.open) closeAll(menu);
    };
    const onPointerDown = (e: PointerEvent) => {
      const inside = (e.target as Element | null)?.closest?.('details.st-menu');
      closeAll(inside ?? undefined);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const open = openMenus();
      if (!open.length) return;
      closeAll();
      open[0].querySelector('summary')?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('.st-menu-list a');
      if (link) closeAll();
    };

    document.addEventListener('toggle', onToggle, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('toggle', onToggle, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return null;
}
