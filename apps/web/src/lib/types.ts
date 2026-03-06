export type Role =
    | 'STUDENT'
    | 'STUDENT_LEADER'
    | 'STUDENT_ADMIN'
    | 'TEACHER'
    | 'SPONSOR'
    | 'SUPPORT_STAFF'
    | 'ADMIN'
    | 'SUPER_ADMIN';

export type Pathway = 'INFORMATION_TECHNOLOGY' | 'HEALTH_SCIENCE' | 'ENGINEERING';

export type AnnouncementTarget = 'SCHOOL_WIDE' | 'GRADE' | 'PATHWAY' | 'CLUB';

export type AnnouncementStatus = 'ACTIVE' | 'ARCHIVED' | 'EXPIRED';

export type FlexFridayType =
    | 'ALL_STUDENT'
    | 'FRESHMAN_WORKSHOP'
    | 'PATHWAY_SPECIFIC'
    | 'TEACHER_PD';

export type FlexSessionType = 'STUDENT_CHOICE' | 'TEACHER_ASSIGNED';
