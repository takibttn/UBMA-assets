import { buildPaginatedResponse } from '@common/pagination/utils/pagination.utils';
import { PaginatedResponse } from '@common/pagination/types/paginated-response.type';

type DrizzlePaginationQuery<T> = {
  limit: (limit: number) => {
    offset: (offset: number) => Promise<T[]>;
  };
};

type DrizzleCountQuery = Promise<
  Array<{ count?: string | number; total?: string | number }>
>;

export abstract class BaseRepository {
  protected async paginate<T>({
    query,
    countQuery,
    page,
    limit,
  }: {
    query: DrizzlePaginationQuery<T>;
    countQuery: DrizzleCountQuery;
    page: number;
    limit: number;
  }): Promise<PaginatedResponse<T>> {
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
      countQuery,
    ]);

    const totalValue = countResult[0]?.total ?? countResult[0]?.count ?? 0;
    const total = Number(totalValue);

    return buildPaginatedResponse(data, page, limit, total);
  }
}
