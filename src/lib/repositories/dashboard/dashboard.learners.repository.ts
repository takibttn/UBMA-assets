import { sql } from 'drizzle-orm';
import { DashboardStudentRepository } from './dashboard.student.repository';

export abstract class DashboardLearnersRepository extends DashboardStudentRepository {
  /**
   * Top APPRENANT learners by average attendance across ENROLLED formations,
   * then completed formations count, then certificates count.
   */
  async getTopLearners(params: { limit: number }): Promise<
    Array<{
      studentId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      matricule: string | null;
      accountType: string | null;
      enrollmentsCount: number;
      completedFormationsCount: number;
      certificatesCount: number;
      averageAttendanceRate: number;
    }>
  > {
    type Row = {
      student_id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      matricule: string | null;
      account_type: string | null;
      enrollments_count: string | number;
      completed_formations_count: string | number;
      certificates_count: string | number;
      average_attendance_rate: string | number;
    };

    const result = (await this.db.execute(sql`
      WITH sess_tot AS (
        SELECT formation_id, count(*)::int AS n
        FROM formation_sessions
        WHERE status <> 'CANCELLED'
        GROUP BY formation_id
      ),
      pres AS (
        SELECT sa.enrollment_id, count(*)::int AS n
        FROM session_attendance sa
        INNER JOIN formation_sessions fs ON fs.id = sa.session_id
        WHERE fs.status <> 'CANCELLED' AND sa.status = 'PRESENT'
        GROUP BY sa.enrollment_id
      ),
      rates AS (
        SELECT
          e.student_id,
          CASE WHEN coalesce(st.n, 0) = 0 THEN 0
            ELSE round(100.0 * coalesce(p.n, 0) / st.n) END AS rate
        FROM enrollments e
        LEFT JOIN sess_tot st ON st.formation_id = e.formation_id
        LEFT JOIN pres p ON p.enrollment_id = e.id
        WHERE e.status = 'ENROLLED'
      ),
      by_student AS (
        SELECT student_id,
          round(avg(rate))::int AS avg_att,
          count(*)::int AS enrollments_count
        FROM rates
        GROUP BY student_id
      ),
      certs AS (
        SELECT e.student_id, count(c.id)::int AS n
        FROM certificates c
        INNER JOIN enrollments e ON e.id = c.enrollment_id
        GROUP BY e.student_id
      ),
      completed AS (
        SELECT e.student_id, count(*)::int AS n
        FROM enrollments e
        INNER JOIN formations f ON f.id = e.formation_id
        WHERE e.status = 'ENROLLED'
          AND f.end_date IS NOT NULL
          AND f.end_date < now()
        GROUP BY e.student_id
      )
      SELECT u.id AS student_id,
        u.first_name,
        u.last_name,
        u.email,
        u.matricule,
        u.account_type,
        bs.enrollments_count,
        coalesce(comp.n, 0) AS completed_formations_count,
        coalesce(cf.n, 0) AS certificates_count,
        coalesce(bs.avg_att, 0) AS average_attendance_rate
      FROM by_student bs
      INNER JOIN users u ON u.id = bs.student_id AND u.role = 'APPRENANT'
      LEFT JOIN certs cf ON cf.student_id = u.id
      LEFT JOIN completed comp ON comp.student_id = u.id
      ORDER BY bs.avg_att DESC, coalesce(comp.n, 0) DESC, coalesce(cf.n, 0) DESC
      LIMIT ${params.limit}
    `)) as { rows: Row[] };

    return result.rows.map((r) => ({
      studentId: r.student_id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      matricule: r.matricule,
      accountType: r.account_type,
      enrollmentsCount: Number(r.enrollments_count),
      completedFormationsCount: Number(r.completed_formations_count),
      certificatesCount: Number(r.certificates_count),
      averageAttendanceRate: Number(r.average_attendance_rate),
    }));
  }
}
