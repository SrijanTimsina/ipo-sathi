import type { JwtPayload as AuthPayload } from "../modules/auth/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
