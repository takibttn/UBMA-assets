import {
  PaginatedResponse,
  PaginationMeta,
} from '../types/paginated-response.type';

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResponse<T> {
  return {
    data,
    meta: buildPaginationMeta(page, limit, total),
  };
}
