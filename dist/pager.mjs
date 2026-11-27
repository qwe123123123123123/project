export const pageSize = 24;

export function pageOf(items, requested = 1) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.max(1, Math.min(requested, pages));
  const start = (current - 1) * pageSize;
  return {items: items.slice(start, start + pageSize), current, pages, start};
}

export function pageControls(kind, page) {
  if (page.pages <= 1) return '';
  return `<nav class="page-controls" aria-label="Страницы списка">
    <button class="btn small" type="button" data-pager="${kind}" data-page="${page.current - 1}"${page.current === 1 ? ' disabled' : ''}>← Предыдущая</button>
    <span aria-live="polite">${page.current} из ${page.pages}</span>
    <button class="btn small" type="button" data-pager="${kind}" data-page="${page.current + 1}"${page.current === page.pages ? ' disabled' : ''}>Следующая →</button>
  </nav>`;
}
