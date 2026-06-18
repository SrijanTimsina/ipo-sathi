import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import { whatsappService } from "./shared/services/whatsapp.service.js";

// ─── Module Routes ────────────────────────────────────────────────────────────
import authRoute from "./modules/auth/auth.route.js";
import usersRoute from "./modules/users/users.route.js";
import usersAdminRoute from "./modules/users/users.admin.route.js";
import accountsRoute from "./modules/accounts/accounts.route.js";
import accountsAdminRoute from "./modules/accounts/accounts.admin.route.js";
import ipoRoute from "./modules/ipo/ipo.route.js";
import ipoAdminRoute from "./modules/ipo/ipo.admin.route.js";
import portfolioRoute from "./modules/portfolio/portfolio.route.js";

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(
  cors({
    origin: config.server.corsOrigin,
    credentials: true, // allow cookies (refresh token)
  }),
);
app.use(express.json());
app.use(cookieParser());

// ─── Performance Logging Middleware ───────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[Backend Route] ${req.method} ${req.originalUrl} took ${duration}ms`);
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const API = "/api/v1";

app.use(`${API}/auth`, authRoute);
app.use(`${API}/users`, usersRoute);
app.use(`${API}/accounts`, accountsRoute);
app.use(`${API}/ipo`, ipoRoute);
app.use(`${API}/portfolio`, portfolioRoute);

// Admin routes
app.use(`${API}/admin/users`, usersAdminRoute);
app.use(`${API}/admin/users/:userId/accounts`, accountsAdminRoute);
app.use(`${API}/admin/ipo`, ipoAdminRoute);

// Render Health Check (Always 200 so Render doesn't restart the app)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", environment: config.server.nodeEnv });
});

// Uptime Robot Check (Returns 503 if dependencies like WhatsApp are failing)
app.get("/uptime", async (_req, res) => {
  let whatsappStatus = "unknown";
  let isHealthy = true;

  try {
    const waResponse = await whatsappService.checkConnectionStatus();
    whatsappStatus = waResponse?.instance?.state || "not_configured";

    // If it's configured but not connected, mark as unhealthy
    if (whatsappStatus !== "not_configured" && whatsappStatus !== "open") {
      isHealthy = false;
    }
  } catch (error) {
    whatsappStatus = "error";
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? "ok" : "degraded",
    environment: config.server.nodeEnv,
    whatsapp: whatsappStatus,
  });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

export default app;
