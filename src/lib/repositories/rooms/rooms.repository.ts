import { Injectable, Inject } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  ne,
  or,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  formationSessions,
  formations,
  rooms,
  NewRoom,
} from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';
import { FindRoomsQueryDto } from '@modules/rooms/dto/find-rooms-query.dto';

@Injectable()
export class RoomsRepository extends BaseRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async create(data: NewRoom) {
    const [row] = await this.db.insert(rooms).values(data).returning();
    return row;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);
    return row;
  }

  async findManyByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db.select().from(rooms).where(inArray(rooms.id, ids));
  }

  async findByCode(code: string) {
    const [row] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code.trim().toUpperCase()))
      .limit(1);
    return row;
  }

  async update(id: string, data: Partial<NewRoom>) {
    const [row] = await this.db
      .update(rooms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return row;
  }

  async remove(id: string) {
    await this.db.delete(rooms).where(eq(rooms.id, id));
  }

  async countSessionsReferencingRoom(roomId: string): Promise<number> {
    const [r] = await this.db
      .select({ n: count() })
      .from(formationSessions)
      .where(eq(formationSessions.roomId, roomId));
    return Number(r?.n ?? 0);
  }

  async findPaginated(query: FindRoomsQueryDto) {
    const filters = [
      query.isActive !== undefined
        ? eq(rooms.isActive, query.isActive)
        : undefined,
      query.search
        ? or(
            ilike(rooms.code, `%${query.search}%`),
            ilike(rooms.name, `%${query.search}%`),
          )
        : undefined,
    ].filter(Boolean);

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const dataQuery = this.db
      .select()
      .from(rooms)
      .where(whereClause)
      .orderBy(desc(rooms.createdAt));

    const countQuery = this.db
      .select({ total: count() })
      .from(rooms)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  /** All rooms (active and inactive), stable order for availability UI. */
  async findAllOrderedByCode() {
    return this.db.select().from(rooms).orderBy(asc(rooms.code));
  }

  /**
   * Non-cancelled sessions in `roomId` that could overlap any instant in
   * `[windowStart, windowEnd]` (broad fetch; caller filters precisely).
   */
  async findNonCancelledSessionsInRoomTimeWindow(
    roomId: string,
    windowStart: Date,
    windowEnd: Date,
    excludeSessionId?: string,
  ) {
    return this.db
      .select({
        id: formationSessions.id,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
        title: formationSessions.title,
        formationId: formationSessions.formationId,
        formationTitle: formations.title,
      })
      .from(formationSessions)
      .innerJoin(formations, eq(formationSessions.formationId, formations.id))
      .where(
        and(
          eq(formationSessions.roomId, roomId),
          ne(formationSessions.status, 'CANCELLED'),
          lt(formationSessions.startAt, windowEnd),
          gt(formationSessions.endAt, windowStart),
          ...(excludeSessionId
            ? [ne(formationSessions.id, excludeSessionId)]
            : []),
        ),
      )
      .orderBy(asc(formationSessions.startAt));
  }
}
