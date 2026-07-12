export function calculatePagination(items, page, limit) {
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    return {
        data: paginatedItems,
        meta: { page, limit, total, totalPages },
    };
}
