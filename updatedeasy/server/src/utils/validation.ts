import { z } from 'zod';

export const studentRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  gender: z.enum(['Male', 'Female', 'Other', 'Male/Female']),
  parentName: z.string().trim().min(2).max(100),
  contact: z.string().regex(/^[0-9]\d{9,14}$/, 'Enter a valid mobile number'), // matches phone validation rules
  email: z.string().trim().email().max(255),
  universityId: z.string().trim().min(1),
  collegeId: z.string().trim().min(1),
  degree: z.string().trim().min(1),
  departmentName: z.string().trim().optional().or(z.literal('')),
  classSem: z.string().trim().min(1),
  session: z.string().trim().min(1),
  subject: z.string().trim().optional().or(z.literal('')),
  rollNo: z.string().trim().min(1),
  course: z.string().trim().min(1),
  internshipMode: z.enum(['Online', 'Offline', 'Hybrid']),
  emName: z.string().trim().max(100).optional().or(z.literal('')),
  emPhone: z.string().regex(/^[0-9]\d{9,14}$/, 'Enter a valid emergency contact number').optional().or(z.literal('')),
  emRel: z.string().trim().optional().or(z.literal('')),
  password: z.string().min(5),
  consentFormUrl: z.string().url().optional().or(z.literal('')),
  referralCode: z.string().trim().optional().or(z.literal('')),
});

export const createOrderSchema = z.object({
  studentData: studentRegistrationSchema,
  amount: z.number().positive(),
});

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_order_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email(),
});

export const forgotPasswordResetSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(6),
  newPassword: z.string().min(6),
});

export const adminRegisterSchema = z.object({
  admin_id: z.string().uuid(),
  student_data: z.object({
    full_name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    gender: z.string().min(1),
    parent_name: z.string().trim().min(2).max(100),
    contact_number: z.string().min(10),
    university_name: z.string().trim().min(1),
    college_name: z.string().trim().min(1),
    degree: z.string().trim().min(1),
    department: z.string().trim().optional(),
    class_semester: z.string().trim().min(1),
    academic_session: z.string().trim().min(1),
    roll_number: z.string().trim().min(1),
    course: z.string().trim().optional(),
    internship_domain: z.string().trim().optional(),
    subject: z.string().trim().optional(),
    password: z.string().min(5).optional(),
    emergency_name: z.string().trim().optional(),
    emergency_contact: z.string().trim().optional(),
    emergency_relation: z.string().trim().optional(),
  }),
  payment_amount: z.string().optional().or(z.number().optional()),
  transaction_id: z.string().optional(),
});

export const adminTasksSchema = z.object({
  action: z.enum(['create_sub_user', 'force_logout']),
  email: z.string().trim().email().optional(),
  password: z.string().min(5).optional(),
  roleTag: z.string().optional(),
  role: z.enum(['staff', 'admin']).optional(),
  permissions: z.record(z.any()).optional(),
  target_user_id: z.string().uuid().optional(),
});

export const sendMailSchema = z.object({
  name: z.string().optional(),
  email: z.string().trim().email().optional(),
  message: z.string().optional(),
  otp: z.string().optional(),
  action: z.string().optional(),
  to: z.string().trim().email().optional(),
  subject: z.string().optional(),
  data: z.record(z.any()).optional(),
});

export const sendBulkMailSchema = z.object({
  subject: z.string().optional(),
  message: z.string().min(1),
  recipients: z.array(z.string().trim().email()),
});
