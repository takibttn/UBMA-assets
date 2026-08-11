import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  formationSessions,
  rooms,
  NewFormationSession,
} from '@/database/schema';

export abstract class FormationSessionsBaseRepository {
  protected readonly db: DrizzleDB;
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    this.db = db;
  }

  async create(data: NewFormationSession) {
    const [row] = await this.db
      .insert(formationSessions)
      .values(data)
      .returning();
    return row;
  }

  async findById(sessionId: string) {
    const [row] = await this.db
      .select()
      .from(formationSessions)
      .where(eq(formationSessions.id, sessionId))
      .limit(1);
    return row;
  }

  async findByIdInFormation(formationId: string, sessionId: string) {
    const [row] = await this.db
      .select()
      .from(formationSessions)
      .where(
        and(
          eq(formationSessions.id, sessionId),
          eq(formationSessions.formationId, formationId),
        ),
      )
      .limit(1);
    return row;
  }

  async update(
    formationId: string,
    sessionId: string,
    data: Partial<NewFormationSession>,
  ) {
    const [row] = await this.db
      .update(formationSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(formationSessions.id, sessionId),
          eq(formationSessions.formationId, formationId),
        ),
      )
      .returning();
    return row;
  }

  async remove(formationId: string, sessionId: string) {
    await this.db
      .delete(formationSessions)
      .where(
        and(
          eq(formationSessions.id, sessionId),
          eq(formationSessions.formationId, formationId),
        ),
      );
  }

  async listByFormation(formationId: string) {
    return this.db
      .select({
        id: formationSessions.id,
        formationId: formationSessions.formationId,
        title: formationSessions.title,
        description: formationSessions.description,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
        status: formationSessions.status,
        room: {
          id: rooms.id,
          code: rooms.code,
          name: rooms.name,
          capacity: rooms.capacity,
        },
      })
      .from(formationSessions)
      .innerJoin(rooms, eq(formationSessions.roomId, rooms.id))
      .where(eq(formationSessions.formationId, formationId))
      .orderBy(formationSessions.startAt);
  }
}
