export interface IStudentRepository {
  checkRegistrationAvailable(email: string, phone: string): Promise<{
    available: boolean;
    emailTaken: boolean;
    phoneTaken: boolean;
    message: string;
  }>;
  createAuthUser(email: string, password: string, fullName: string): Promise<{ userId: string; created: boolean }>;
  insertStudent(studentData: any): Promise<string>; // returns registration_id
  upsertProfile(profileData: {
    id: string;
    full_name: string;
    email: string;
    contact_number: string;
    gender?: string;
    parent_name?: string;
  }): Promise<void>;
  assignRole(userId: string, role: string): Promise<void>;
  findStudentByEmail(email: string): Promise<{ id: string; registration_id?: string | null } | null>;
  findStudentById(id: string): Promise<{ id: string; registration_id?: string | null } | null>;
  findProfileById(id: string): Promise<{ id: string; email: string } | null>;
  findProfileByEmail(email: string): Promise<{ id: string; email: string } | null>;
  checkUserRole(userId: string, requiredRoles: string[]): Promise<boolean>;
  upsertAdminStaff(staffData: any): Promise<void>;
  upsertAdminPermissions(permissionsData: any): Promise<void>;
  signOutUserGlobally(userId: string): Promise<void>;
}
