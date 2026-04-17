export type AppRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'SUPPORT_STAFF'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type Pathway =
  | 'INFORMATION_TECHNOLOGY'
  | 'HEALTH_SCIENCE'
  | 'ENGINEERING';

export interface AppUser {
  id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
  role?: AppRole | null;
  gradeLevel?: number | null;
  major?: Pathway | null;
  minor?: Pathway | null;
  email?: string | null;
  isActive?: boolean;
}

export interface AuthenticatedUser extends AppUser {
  role: AppRole | null;
}

export interface AuthLoginResponse {
  token: string;
  user: AppUser;
}
