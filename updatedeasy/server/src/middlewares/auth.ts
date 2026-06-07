import { Middleware } from 'koa';
import { supabase } from '../lib/supabase.js';
import { audit, logger, withErrorCategory } from '../utils/logger.js';

export const authMiddleware: Middleware = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  if (!authHeader) {
    ctx.throw(401, 'Authorization token is required');
  }

  const parts = (authHeader as string).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    ctx.throw(401, 'Invalid authorization header format. Expected "Bearer <token>"');
  }

  const token = parts[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      ctx.throw(401, error?.message || 'Invalid or expired authentication session');
    }

    ctx.state.user = user;
    await next();
  } catch (err: any) {
    logger.warn(withErrorCategory('auth', { error: err, path: ctx.path }), 'Auth middleware verification failure');
    audit({
      action: 'auth.token_verified',
      outcome: 'failure',
      targetId: ctx.path,
    });
    ctx.throw(err.status || 401, err.message || 'Unauthorized');
  }
};

export const requireRoles = (roles: string[]): Middleware => {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      ctx.throw(401, 'Authentication is required');
    }

    const userId = ctx.state.user.id;
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      logger.error(withErrorCategory('database', { error, userId }), 'Role authorization check database error');
      ctx.throw(500, 'Database error during authorization check');
    }

    const hasRole = (userRoles || []).some((r: any) => roles.includes(r.role));
    if (!hasRole) {
      audit({
        action: 'auth.role_authorized',
        actorId: userId,
        outcome: 'denied',
        requiredRoles: roles,
      });
      ctx.throw(403, 'Access denied. Required privileges are missing.');
    }

    await next();
  };
};
export const requireAdmin = requireRoles(['admin', 'super_admin']);
export const requireSuperAdmin = requireRoles(['super_admin']);
