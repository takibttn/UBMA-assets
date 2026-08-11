export interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalFormations: number;
  openFormations: number;
  closedFormations: number;
  totalEnrollments: number;
  upcomingFormations: number;
  formationsByLanguage: Array<{
    languageId: string | null;
    languageCode: string | null;
    languageName: string | null;
    count: number;
  }>;
  formationsByLevel: Array<{
    levelId: string | null;
    levelCode: string | null;
    levelName: string | null;
    count: number;
  }>;
}

export interface TeacherStats {
  assignedFormationsCount: number;
  openAssignedFormationsCount: number;
  closedAssignedFormationsCount: number;
  totalStudentsEnrolled: number;
}

export interface StudentStats {
  enrolledFormationsCount: number;
  upcomingEnrollmentsCount: number;
}
