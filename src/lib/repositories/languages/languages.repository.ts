import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { Language, NewLanguage, languages } from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';
import { FindLanguagesQueryDto } from '@modules/languages/dto/find-languages-query.dto';

@Injectable()
export class LanguagesRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findAllActivePaginated(query: FindLanguagesQueryDto) {
    const whereClause = query.search
      ? or(
          ilike(languages.name, `%${query.search}%`),
          ilike(languages.code, `%${query.search}%`),
        )
      : undefined;

    const sortColumns = {
      createdAt: languages.createdAt,
      name: languages.name,
      code: languages.code,
    } as const;

    const requestedSortBy = query.sortBy as
      | keyof typeof sortColumns
      | undefined;
    const sortColumn =
      requestedSortBy && requestedSortBy in sortColumns
        ? sortColumns[requestedSortBy]
        : sortColumns.name;
    const order =
      query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const dataQuery = this.db
      .select()
      .from(languages)
      .where(
        whereClause
          ? and(eq(languages.isActive, true), whereClause)
          : eq(languages.isActive, true),
      )
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(languages)
      .where(
        whereClause
          ? and(eq(languages.isActive, true), whereClause)
          : eq(languages.isActive, true),
      );

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findById(id: string): Promise<Language | undefined> {
    const result = await this.db
      .select()
      .from(languages)
      .where(eq(languages.id, id))
      .limit(1);
    return result[0];
  }

  async findByCode(code: string): Promise<Language | undefined> {
    const result = await this.db
      .select()
      .from(languages)
      .where(eq(languages.code, code))
      .limit(1);
    return result[0];
  }

  async create(data: NewLanguage): Promise<Language> {
    const result = await this.db.insert(languages).values(data).returning();
    return result[0];
  }

  async update(
    id: string,
    data: Partial<NewLanguage>,
  ): Promise<Language | undefined> {
    const result = await this.db
      .update(languages)
      .set(data)
      .where(eq(languages.id, id))
      .returning();
    return result[0];
  }

  async softDelete(id: string): Promise<Language | undefined> {
    const result = await this.db
      .update(languages)
      .set({ isActive: false })
      .where(eq(languages.id, id))
      .returning();
    return result[0];
  }
}
