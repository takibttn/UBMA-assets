import { eq, sql } from 'drizzle-orm';
import {
  Formation,
  enrollments,
  formationLevels,
  formations,
  formationTeachers,
  languages,
} from '@/database/schema';
import { FormationsListRepository } from './formations.repository.list';

export abstract class FormationsDetailRepository extends FormationsListRepository {
  async findByIdWithLanguageAndLevel(id: string) {
    const {
      teacherIdSub,
      teacherFirstNameSub,
      teacherLastNameSub,
      teacherEmailSub,
    } = this.teacherSubqueries;

    const result = await this.db
      .select({
        id: formations.id,
        title: formations.title,
        description: formations.description,
        creatorId: formations.creatorId,
        languageId: formations.languageId,
        levelId: formations.levelId,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        startDate: formations.startDate,
        endDate: formations.endDate,
        createdAt: formations.createdAt,
        enrolledCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} = 'ENROLLED'
        )`.as('enrolled_count'),
        reservedCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} IN ('ENROLLED', 'PENDING_PAYMENT')
        )`.as('reserved_count'),
        assignedTeacherId: teacherIdSub,
        assignedTeacherFirstName: teacherFirstNameSub,
        assignedTeacherLastName: teacherLastNameSub,
        assignedTeacherEmail: teacherEmailSub,
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
        },
        level: {
          id: formationLevels.id,
          code: formationLevels.code,
          name: formationLevels.name,
        },
      })
      .from(formations)
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(eq(formations.id, id))
      .limit(1);

    return result[0];
  }

  async findByTeacher(teacherId: string): Promise<Formation[]> {
    const rows = await this.db
      .select()
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .where(eq(formationTeachers.teacherId, teacherId));

    return rows.map((row) => row.formations);
  }

  async findByTeacherWithLanguageAndLevel(teacherId: string) {
    return this.db
      .select({
        id: formations.id,
        title: formations.title,
        description: formations.description,
        creatorId: formations.creatorId,
        languageId: formations.languageId,
        levelId: formations.levelId,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        startDate: formations.startDate,
        endDate: formations.endDate,
        createdAt: formations.createdAt,
        enrolledCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} = 'ENROLLED'
        )`.as('enrolled_count'),
        reservedCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} IN ('ENROLLED', 'PENDING_PAYMENT')
        )`.as('reserved_count'),
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
        },
        level: {
          id: formationLevels.id,
          code: formationLevels.code,
          name: formationLevels.name,
        },
      })
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(eq(formationTeachers.teacherId, teacherId));
  }
}
