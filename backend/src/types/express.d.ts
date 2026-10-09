import type { OrgRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string };
      organizationId?: string;
      orgRole?: OrgRole;
      rawBody?: Buffer;
    }
  }
}
