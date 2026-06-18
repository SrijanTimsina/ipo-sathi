import { whatsappService } from "../../shared/services/whatsapp.service.js";
import { ipoRepo } from "./ipo.repo.js";
import { usersRepo } from "../users/users.repo.js";

export interface LiveApplicationStatus {
  brokerAccountId: string;
  accountName: string;
  isVerified: boolean;
  isRejected: boolean;
  errorMessage: string | null;
  status: "applied" | "pending" | "allotted" | "not_allotted" | "error";
  quantity?: number;
}

/**
 * Service to evaluate IPO statuses for a user and dispatch aggregated WhatsApp messages using LIVE data.
 */
export const ipoNotificationService = {
  async evaluateAndNotifyLive(
    userId: string,
    ipoId: string,
    ipoName: string,
    liveApps: LiveApplicationStatus[],
    accounts: any[],
    openDate?: string,
    closeDate?: string,
    isOpen?: boolean,
    isMorningCron?: boolean,
    isEveningCron?: boolean,
  ) {
    const user = await usersRepo.findById(userId);
    if (!user || !user.mobileNumber) return; // Cannot notify without a phone number
    if (liveApps.length === 0) return;

    const notifState = await ipoRepo.getNotificationState(userId, ipoId);

    // If the application phase is completely finalized, stop evaluating (no more Rejection/Verified spam)
    if (notifState.allVerifiedSent) {
      return;
    }

    // Determine if we should send a status report
    let isClosingDay = false;
    if (closeDate) {
      // Use Kathmandu time for comparison since cron runs in Kathmandu time
      const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kathmandu" }));
      const closing = new Date(new Date(closeDate).toLocaleString("en-US", { timeZone: "Asia/Kathmandu" }));
      isClosingDay = today.getFullYear() === closing.getFullYear() &&
                     today.getMonth() === closing.getMonth() &&
                     today.getDate() === closing.getDate();
    }

    let shouldSendStatusReport = false;
    let isInitial = false;
    let isClosingWarning = false;

    // Rule 1: Initial Notification
    if (!notifState.initialSent) {
      shouldSendStatusReport = true;
      isInitial = true;
      await ipoRepo.markInitialSent(userId, ipoId);
    } else if (isMorningCron) {
      shouldSendStatusReport = true;
    } else if (isEveningCron && isClosingDay) {
      shouldSendStatusReport = true;
      isClosingWarning = true;
    }

    if (shouldSendStatusReport) {
      await this.notifyInitialLive(
        user.mobileNumber,
        ipoName,
        liveApps,
        openDate,
        closeDate,
        isInitial,
        isClosingWarning
      );
    }

    // Rule 2: Rejections
    const rejectedApps = liveApps.filter((a) => a.isRejected || a.status === "error");
    if (rejectedApps.length > 0) {
      await this.notifyRejectionLive(
        user.mobileNumber,
        ipoName,
        rejectedApps,
        accounts,
        isOpen,
      );
    }

    // Rule 3: Application Phase End State
    const allAccountsCount = accounts.length;
    const verifiedAppsCount = liveApps.filter(
      (a) => a.isVerified || a.status === "allotted" || a.status === "not_allotted" || a.status === "applied"
    ).length;
    const pendingAppsCount = liveApps.filter((a) => a.status === "pending").length;

    const isAllVerified = verifiedAppsCount === allAccountsCount && allAccountsCount > 0;
    const isClosedAndNoPending = isOpen === false && pendingAppsCount === 0;

    if (isAllVerified) {
      // Send the success message and mark as done
      await this.notifyAllVerifiedLive(user.mobileNumber, ipoName);
      await ipoRepo.markAllVerifiedSent(userId, ipoId);
    } else if (isClosedAndNoPending) {
      // Mark as done to silence future rejection spam, since it's closed and there's nothing left to verify
      await ipoRepo.markAllVerifiedSent(userId, ipoId);
    }
  },

  async notifyInitialLive(
    mobileNumber: string,
    ipoName: string,
    liveApps: LiveApplicationStatus[],
    openDate?: string,
    closeDate?: string,
    isInitial: boolean = true,
    isClosingWarning: boolean = false,
  ) {
    const verified: string[] = [];
    const unverified: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    for (const app of liveApps) {
      if (app.isVerified || app.status === "applied" || app.status === "allotted" || app.status === "not_allotted") {
        verified.push(`${app.accountName}: Verified ✅`);
      } else if (app.status === "pending") {
        unverified.push(`${app.accountName}: Unverified ⏳`);
      } else if (app.isRejected || app.status === "error") {
        if (
          app.errorMessage === "Auto-apply disabled" ||
          app.errorMessage === "Did not apply via system"
        ) {
          skipped.push(`${app.accountName}: Skipped ⏸️`);
        } else {
          failed.push(`${app.accountName}: (${app.errorMessage}) ❌`);
        }
      }
    }

    let message = isInitial ? `📊 *New IPO Alert*\n` : `📊 *IPO Status Report*\n`;
    message += `*${ipoName}*\n`;
    if (openDate || closeDate) {
      const start = openDate ? openDate.split("T")[0] : "TBD";
      const end = closeDate ? closeDate.split("T")[0] : "TBD";
      message += `📅 ${start} - ${end}\n`;
    }

    if (isClosingWarning) {
      message += `\n⏳ *CLOSING TODAY!* Please ensure you have sufficient balance in all your accounts!\n`;
    }

    message += `\n📋 *Application Status*:\n`;

    if (failed.length > 0) {
      message += `\n*Failed* ❌\n`;
      failed.forEach((f) => (message += `${f}\n`));
    }
    if (skipped.length > 0) {
      message += `\n*Skipped* ⏸️\n`;
      skipped.forEach((s) => (message += `${s}\n`));
    }
    if (verified.length > 0) {
      message += `\n*Verified* ✅\n`;
      verified.forEach((v) => (message += `${v}\n`));
    }
    if (unverified.length > 0) {
      message += `\n*Unverified* ⏳\n`;
      unverified.forEach((u) => (message += `${u}\n`));
    }

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message.trim());
  },

  async notifyRejectionLive(
    mobileNumber: string,
    ipoName: string,
    rejectedApps: LiveApplicationStatus[],
    accounts: any[],
    isOpen?: boolean,
  ) {
    const isClosed = isOpen === false;

    let message = `🚨 *IPO Rejected${isClosed ? ' (Closed)' : ''}*\n`;
    message += `*${ipoName}*\n\n`;

    if (isClosed) {
      message += `*Status*: Closed (Cannot Re-apply)\n`;
    } else {
      message += `*Action Required*:\n`;
    }

    for (const app of rejectedApps) {
      const account = accounts.find((a) => a.id === app.brokerAccountId);
      
      message += `- *${app.accountName}*`;
      if (app.errorMessage) {
        message += ` (${app.errorMessage})`;
      }

      if (!isClosed && account && !account.autoReApply) {
        message += ` - Auto Re-apply OFF`;
      }
      message += `\n`;
    }

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message.trim());
  },

  async notifyAllVerifiedLive(
    mobileNumber: string,
    ipoName: string,
  ) {
    let message = `✅ *All Applications Verified*\n*${ipoName}*\n`;
    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message.trim());
  },

  async notifyReapplied(
    mobileNumber: string,
    ipoName: string,
    accountName: string,
    reason: string,
  ) {
    let message = `🔄 *Re-applied*\n`;
    message += `*${ipoName}*\n\n`;
    message += `${accountName}: Rejected (${reason}) - Auto Re-applied`;

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message);
  },

  async notifyReapplyFailed(
    mobileNumber: string,
    ipoName: string,
    accountName: string,
    rejectionReason: string,
    reapplyError: string,
  ) {
    let message = `🚨 *Re-apply Failed*\n`;
    message += `*${ipoName}*\n\n`;
    message += `*${accountName}*\n`;
    message += `Rejection: ${rejectionReason}\n`;
    message += `Re-apply Error: ${reapplyError}`;

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message);
  },

  async notifyResultForUserLive(
    userId: string,
    ipoName: string,
    liveApps: LiveApplicationStatus[],
  ) {
    const user = await usersRepo.findById(userId);
    if (!user || !user.mobileNumber) return;

    let message = `🎉 *IPO Result*\n`;
    message += `*${ipoName}*\n\n`;

    for (const app of liveApps) {
      if (app.status === "allotted") {
        message += `✅ *${app.accountName}*: Allotted\n`;
      } else if (app.status === "not_allotted") {
        message += `❌ *${app.accountName}*: Not Allotted\n`;
      } else {
        message += `⚠️ *${app.accountName}*: ${app.status} ${app.errorMessage ? `(${app.errorMessage})` : ""}\n`;
      }
    }

    await whatsappService.sendMessage(this.formatNumber(user.mobileNumber), message.trim());
  },

  formatNumber(mobile: string): string {
    if (mobile.length === 10 && mobile.startsWith("9")) {
      return `977${mobile}`;
    }
    return mobile;
  },
};
