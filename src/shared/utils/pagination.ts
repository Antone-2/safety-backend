export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function calculatePagination<T>(items: T[], page: number, limit: number): PaginatedResult<T> {
  const start = (page - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);
  const total = items.length;
  const totalPages = Math.ceil(total / limit);

  return {
    data: paginatedItems,
    meta: { page, limit, total, totalPages },
  };
}
