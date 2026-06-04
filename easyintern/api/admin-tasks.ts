import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { action, email, password, roleTag, permissions, role } = req.body;

  // Supabase Init - Priority to SERVICE_ROLE_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ 
      success: false, 
      message: 'Supabase credentials missing on server. Please set SUPABASE_SERVICE_ROLE_KEY in Vercel settings.' 
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Verify Requester is an Admin
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Authorization required');

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid or expired session');

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin');
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    // 2. Actions
    // Deprecated path: Admin UI now uses auth.signUp (anon) + finalize_sub_admin_creation RPC — no service role needed.
    if (action === 'create_sub_user') {
      if (!email || !password || !roleTag) throw new Error('Email, Password, and Role Tag are required');
      const userRole = role === 'staff' ? 'staff' : 'admin';

      // A. Create Auth User
      // NOTE: We intentionally do NOT write role / is_staff into user_metadata.
      // raw_user_meta_data is client-editable (auth.updateUser data) and is not
      // trusted anywhere in the app. Authoritative role assignment happens in
      // step B (insert into user_roles, gated by service-role + this admin JWT).
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: roleTag }
      });

      if (createError) throw createError;

      const userId = newUser.user.id;

      // B. Assign Admin Role
      await supabase.from('user_roles').upsert({ user_id: userId, role: userRole }, { onConflict: 'user_id,role' });

      // C. Create Profile
      await supabase.from('profiles').upsert({ 
        id: userId, 
        full_name: roleTag, 
        email: String(email).trim().toLowerCase()
      });

      // D. Track staff listing and permissions
      await supabase.from('admin_staff').upsert({
        id: userId,
        email: String(email).trim().toLowerCase(),
        full_name: roleTag,
        role_tag: roleTag,
        permissions: permissions || {}
      });

      await supabase.from('admin_permissions').upsert({
        user_id: userId,
        can_manage_students: permissions?.can_manage_students ?? true,
        can_manage_classes: permissions?.can_manage_classes ?? true,
        can_manage_certificates: permissions?.can_manage_certificates ?? true,
        can_manage_institutions: permissions?.can_manage_institutions ?? true,
        can_view_payments: permissions?.can_view_payments ?? true,
        can_manage_leads: permissions?.can_manage_leads ?? true,
        can_manage_notifications: permissions?.can_manage_notifications ?? true,
        can_manage_assignments: permissions?.can_manage_assignments ?? true,
        can_manage_communications: permissions?.can_manage_communications ?? true
      });

      return res.status(200).json({ success: true, userId, role: userRole });
    }

    if (action === 'force_logout') {
      const { target_user_id } = req.body;
      if (!target_user_id) throw new Error('target_user_id is required');

      // Only super_admin can force logout other admins
      const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
      if (!isSuperAdmin) throw new Error('Unauthorized: Super Admin access required to force logout admins');

      // signOut with 'global' scope revokes ALL refresh tokens for the user
      // This effectively logs them out of ALL browsers and devices immediately
      const { error: signOutError } = await supabase.auth.admin.signOut(target_user_id, 'global');
      if (signOutError) throw signOutError;

      return res.status(200).json({ success: true, message: 'User has been logged out from all devices' });
    }

    return res.status(400).json({ success: false, message: `Action "${action}" not implemented` });

  } catch (err: any) {
    console.error("Vercel Admin API Error:", err);
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      details: err.details || "Internal Server Error"
    });
  }
}

