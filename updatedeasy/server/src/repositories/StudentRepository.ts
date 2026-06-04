import { IStudentRepository } from './interfaces/IStudentRepository.js';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

export class StudentRepository implements IStudentRepository {
  async checkRegistrationAvailable(email: string, phone: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const digits = phone.replace(/\D/g, '');
    const phoneForRpc = digits.length >= 10 ? digits.slice(-10) : phone.trim();

    const { data, error } = await supabase.rpc('check_student_registration_available', {
      p_email: normalizedEmail,
      p_phone: phoneForRpc,
    });

    if (error) {
      logger.error({ error, email, phone }, 'RPC check_student_registration_available failed');
      throw new Error(error.message || 'Registration validation failed.');
    }

    const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      available: row.available === true,
      emailTaken: row.email_taken === true,
      phoneTaken: row.phone_taken === true,
      message: String(row.message || '').trim(),
    };
  }

  async createAuthUser(email: string, password: string, fullName: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (
        authError.message.includes('already registered') ||
        authError.code === 'user_already_exists'
      ) {
        // Resolve existing user ID
        const profile = await this.findProfileByEmail(normalizedEmail);
        if (profile?.id) {
          return { userId: profile.id, created: false };
        }
        throw new Error('User already exists in Auth, but could not retrieve profile ID.');
      }
      logger.error({ authError, email }, 'Auth createUser failed');
      throw authError;
    }

    if (!authData?.user?.id) {
      throw new Error('Could not resolve user ID after Auth creation');
    }

    return { userId: authData.user.id, created: true };
  }

  async insertStudent(studentData: any) {
    const { data: latestStudents, error: latestError } = await supabase
      .from('students')
      .select('registration_id')
      .not('registration_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (latestError) {
      logger.warn({ latestError }, 'Failed to fetch latest students for registration ID generation');
    }

    let nextSeq = 10001;
    if (latestStudents && latestStudents.length > 0) {
      const seqs = latestStudents
        .map((s) => {
          const parts = s.registration_id.split('/');
          return parts.length === 4 ? parseInt(parts[3], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      if (seqs.length > 0) nextSeq = Math.max(...seqs) + 1;
    }

    const currentYear = new Date().getFullYear();
    let regId = `EZY/${currentYear}/INT/${nextSeq}`;
    let retryCount = 0;
    let insertError = null;

    while (retryCount < 10) {
      const payload = { ...studentData, registration_id: regId };
      const { error } = await supabase.from('students').insert(payload);
      if (error) {
        if (error.code === '23505' && (error.message.includes('registration_id') || error.details?.includes('registration_id'))) {
          nextSeq++;
          regId = `EZY/${currentYear}/INT/${nextSeq}`;
          retryCount++;
          continue;
        }
        insertError = error;
        break;
      }
      return regId;
    }

    if (insertError) {
      logger.error({ insertError, studentData }, 'Failed to insert student after retries');
      throw insertError;
    }
    throw new Error('Unique registration ID generation exceeded max retries');
  }

  async upsertProfile(profileData: {
    id: string;
    full_name: string;
    email: string;
    contact_number: string;
    gender?: string;
    parent_name?: string;
  }) {
    const { error } = await supabase.from('profiles').upsert(profileData);
    if (error) {
      logger.error({ error, profileData }, 'upsertProfile failed');
      throw error;
    }
  }

  async assignRole(userId: string, role: string) {
    const { error } = await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });
    if (error) {
      logger.error({ error, userId, role }, 'assignRole failed');
      throw error;
    }
  }

  async findStudentByEmail(email: string) {
    const { data, error } = await supabase
      .from('students')
      .select('id, registration_id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findStudentById(id: string) {
    const { data, error } = await supabase
      .from('students')
      .select('id, registration_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findProfileById(id: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findProfileByEmail(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async checkUserRole(userId: string, requiredRoles: string[]) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, userId }, 'checkUserRole failed');
      return false;
    }

    return (data || []).some((r) => requiredRoles.includes(r.role));
  }

  async upsertAdminStaff(staffData: any) {
    const { error } = await supabase.from('admin_staff').upsert(staffData);
    if (error) {
      logger.error({ error, staffData }, 'upsertAdminStaff failed');
      throw error;
    }
  }

  async upsertAdminPermissions(permissionsData: any) {
    const { error } = await supabase.from('admin_permissions').upsert(permissionsData);
    if (error) {
      logger.error({ error, permissionsData }, 'upsertAdminPermissions failed');
      throw error;
    }
  }

  async signOutUserGlobally(userId: string) {
    const { error } = await supabase.auth.admin.signOut(userId, 'global');
    if (error) {
      logger.error({ error, userId }, 'signOutUserGlobally failed');
      throw error;
    }
  }
}
