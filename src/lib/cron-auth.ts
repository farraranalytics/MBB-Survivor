// Verify cron job requests are authorized
// Vercel Cron sends Authorization header automatically
// Manual triggers can pass the CRON_SECRET as a query param or header

export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  
  if (!secret) {
    console.warn('CRON_SECRET not set — allowing request in development');
    return process.env.NODE_ENV === 'development';
  }
  
  // Vercel sends: Authorization: Bearer <CRON_SECRET>
  return authHeader === `Bearer ${secret}`;
}
