import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  FormationLevel,
  NewFormationLevel,
  formationLevels,
  languages,
} from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';
import { FindLevelsQueryDto } from '@modules/levels/dto/find-levels-query.dto';

@Injectable()
export class LevelsRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findAllActivePaginated(query: FindLevelsQueryDto) {
    const filters = [
      eq(formationLevels.isActive, true),
      query.languageId
        ? eq(formationLevels.languageId, query.languageId)
        : undefined,
      query.search
        ? or(
            ilike(formationLevels.name, `%${query.search}%`),
            ilike(formationLevels.code, `%${query.search}%`),
          )
        : undefined,
    ].filter(Boolean);

    const whereClause = and(...filters);

    const sortColumns = {
      order: formationLevels.order,
      code: formationLevels.code,
      name: formationLevels.name,
      createdAt: formationLevels.createdAt,
    } as const;

    const requestedSortBy = query.sortBy as
      | keyof typeof sortColumns
      | undefined;
    const sortColumn =
      requestedSortBy && requestedSortBy in sortColumns
        ? sortColumns[requestedSortBy]
        : sortColumns.order;
    const order =
      query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const dataQuery = this.db
      .select()
      .from(formationLevels)
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(formationLevels)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findByLanguagePaginated(languageId: string, query: FindLevelsQueryDto) {
    return this.findAllActivePaginated({ ...query, languageId });
  }

  async findById(id: string): Promise<FormationLevel | undefined> {
    const result = await this.db
      .select()
      .from(formationLevels)
      .where(eq(formationLevels.id, id))
      .limit(1);
    return result[0];
  }

  async findByLanguageAndCode(
    languageId: string,
    code: string,
  ): Promise<FormationLevel | undefined> {
    const result = await this.db
      .select()
      .from(formationLevels)
      .where(
        and(
          eq(formationLevels.languageId, languageId),
          eq(formationLevels.code, code),
        ),
      )
      .limit(1);
    return result[0];
  }

  async create(data: NewFormationLevel): Promise<FormationLevel> {
    const result = await this.db
      .insert(formationLevels)
      .values(data)
      .returning();
    return result[0];
  }

  async update(
    id: string,
    data: Partial<NewFormationLevel>,
  ): Promise<FormationLevel | undefined> {
    const result = await this.db
      .update(formationLevels)
      .set(data)
      .where(eq(formationLevels.id, id))
      .returning();
    return result[0];
  }

  async softDelete(id: string): Promise<FormationLevel | undefined> {
    const result = await this.db
      .update(formationLevels)
      .set({ isActive: false })
      .where(eq(formationLevels.id, id))
      .returning();
    return result[0];
  }

  async getActiveWithLanguageById(id: string) {
    const result = await this.db
      .select({
        id: formationLevels.id,
        languageId: formationLevels.languageId,
        code: formationLevels.code,
        name: formationLevels.name,
        description: formationLevels.description,
        order: formationLevels.order,
        isActive: formationLevels.isActive,
        createdAt: formationLevels.createdAt,
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
          isActive: languages.isActive,
        },
      })
      .from(formationLevels)
      .innerJoin(languages, eq(formationLevels.languageId, languages.id))
      .where(
        and(eq(formationLevels.id, id), eq(formationLevels.isActive, true)),
      )
      .limit(1);

    return result[0];
  }
}
