import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../../config/index.js";
import { authRepo } from "./auth.repo.js";
import { AppError } from "../../shared/middleware/errorHandler.js";

export interface JwtPayload {
  sub: string;       // user uuid
  role: "admin" | "user";
  mobileNumber: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    mobileNumber: string;
    role: "admin" | "user";
  };
}

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export const authService = {
  /**
   * Authenticates a user with mobile number + password.
   * Returns access token, refresh token, and sanitized user object.
   */
  async login(mobileNumber: string, password: string): Promise<LoginResult> {
    const user = await authRepo.findByMobileNumber(mobileNumber);

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid mobile number or password");
    }

    if (!user.isActive) {
      throw new AppError(403, "ACCOUNT_DEACTIVATED", "Your account has been deactivated");
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid mobile number or password");
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      mobileNumber: user.mobileNumber,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        mobileNumber: user.mobileNumber,
        role: user.role,
      },
    };
  },

  /**
   * Validates a refresh token and issues a new access token.
   */
  refreshAccessToken(refreshToken: string): { accessToken: string } {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

      const payload: JwtPayload = {
        sub: decoded.sub,
        role: decoded.role,
        mobileNumber: decoded.mobileNumber,
      };

      const accessToken = signAccessToken(payload);
      return { accessToken };
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
    }
  },
};
