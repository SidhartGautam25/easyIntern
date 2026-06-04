import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify the requester is an admin
    const authHeader = req.headers.get("Authorization")?.split(" ")[1];
    if (!authHeader) {
      throw new Error("No auth token provided");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      throw new Error("Invalid token");
    }

    // Check role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const isAdmin = roles?.some(r => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // 2. Parse request body
    const body = await req.json();
    const { action, leadId } = body;

    if (action === "transfer_lead") {
      // Get lead data
      const { data: lead, error: leadError } = await supabase
        .from("payment_cancelled")
        .select("*")
        .eq("id", leadId)
        .single();
      
      if (leadError || !lead) throw new Error("Lead not found");

      const metadata = lead.metadata || {};
      const email = lead.user_email;
      const password = metadata.password;

      if (!password) {
        throw new Error("Lead metadata is missing password. Cannot transfer.");
      }

      // Create Auth User
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: metadata.fullName }
      });

      if (createError) throw createError;

      // Assign student role
      await supabase.from("user_roles").insert({
        user_id: newUser.user.id,
        role: "student"
      });

      // Generate Registration ID
      const { data: lastStudent } = await supabase
        .from("students")
        .select("registration_id")
        .not("registration_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextSeq = 10001;
      if (lastStudent?.registration_id) {
        const parts = lastStudent.registration_id.split('/');
        if (parts.length === 4) {
          const lastNum = parseInt(parts[3], 10);
          if (!isNaN(lastNum)) nextSeq = lastNum + 1;
        }
      }
      const regId = `EZY/${new Date().getFullYear()}/INT/${nextSeq}`;

      // Create Student Record
      const { error: studentError } = await supabase.from("students").insert({
        id: newUser.user.id,
        email: email,
        full_name: metadata.fullName,
        gender: metadata.gender,
        parent_name: metadata.parentName,
        contact_number: lead.user_phone,
        university_name: metadata.university,
        college_name: metadata.college,
        course: metadata.course,
        internship_domain: metadata.course,
        degree: metadata.degree,
        department: metadata.department,
        class_semester: metadata.semester,
        academic_session: metadata.session,
        roll_number: metadata.rollNo,
        emergency_name: metadata.emName,
        emergency_contact: metadata.emPhone,
        emergency_relation: metadata.emRel,
        status: 'Active',
        registration_id: regId,
        metadata: { subject: metadata.subject }
      });

      if (studentError) throw studentError;

      // Also update profiles
      await supabase.from("profiles").upsert({
        id: newUser.user.id,
        full_name: metadata.fullName,
        email: email,
        contact_number: lead.user_phone,
        gender: metadata.gender,
        parent_name: metadata.parentName
      });

      // Delete Lead
      await supabase.from("payment_cancelled").delete().eq("id", leadId);

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "create_sub_user") {
      const { email, password, roleTag, permissions } = body;

      if (!email || !password || !roleTag) {
        throw new Error("Missing required fields: email, password, roleTag");
      }

      // 1. Create Auth User
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: roleTag }
      });

      if (createError) throw createError;

      const userId = newUser.user.id;

      // 2. Assign admin role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "admin"
      });

      if (roleError) throw roleError;

      // 3. Create Profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: roleTag,
        email: email,
      });

      if (profileError) throw profileError;

      // 4. Set Permissions
      const { error: permError } = await supabase.from("admin_permissions").insert({
        user_id: userId,
        ...permissions
      });

      if (permError) throw permError;

      return new Response(JSON.stringify({ success: true, userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "test_mail") {
      const { to, subject, message } = body;
      
      const SMTP_USER = Deno.env.get("SMTP_USER") ?? "noreply@ezyintern.in";
      const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
      const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com";
      const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "465");

      const client = new SmtpClient();
      await client.connectTLS({
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        username: SMTP_USER,
        password: SMTP_PASS,
      });

      await client.send({
        from: `EzyIntern Admin Test <${SMTP_USER}>`,
        to: to,
        subject: `[ADMIN TEST] ${subject}`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; border: 2px solid #4F46E5; border-radius: 16px;">
            <h2 style="color: #4F46E5; margin-top: 0;">Admin task: mail diagnostic</h2>
            <p>This test email was routed through the <strong>admin-tasks</strong> edge function.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #4F46E5;">
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap; color: #1e293b;">${message}</p>
            </div>
            <p style="font-size: 11px; color: #94a3b8;">Sent by: ${user.email} | Time: ${new Date().toLocaleString()}</p>
          </div>
        `,
      });

      await client.close();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
