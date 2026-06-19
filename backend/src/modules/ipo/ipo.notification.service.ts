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
  reapplied?: boolean;
  reapplyFailed?: boolean;
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

    // If the application phase is completely finalized, stop evaluating
    if (notifState.allVerifiedSent) {
      return;
    }

    // Rule 1: Application Phase End State (All Verified)
    const allAccountsCount = accounts.length;
    const verifiedAppsCount = liveApps.filter(
      (a) =>
        a.isVerified ||
        a.status === "allotted" ||
        a.status === "not_allotted" ||
        a.status === "applied",
    ).length;
    const pendingAppsCount = liveApps.filter(
      (a) => a.status === "pending",
    ).length;

    const isAllVerified =
      verifiedAppsCount === allAccountsCount && allAccountsCount > 0;
    const isClosedAndNoPending = isOpen === false && pendingAppsCount === 0;

    const isInitialRun = !notifState.initialSent;

    if (isAllVerified) {
      if (isInitialRun) await ipoRepo.markInitialSent(userId, ipoId);
      await this.notifyStatusReportLive(
        user.mobileNumber,
        ipoName,
        liveApps,
        accounts,
        openDate,
        closeDate,
        isInitialRun,
        false,
        isOpen,
        true, // isAllVerified
      );
      await ipoRepo.markAllVerifiedSent(userId, ipoId);
      return; // Stop here, only one message sent
    } else if (isClosedAndNoPending) {
      await ipoRepo.markAllVerifiedSent(userId, ipoId);
      return;
    }

    // Rule 2: Determine if we should send a status report
    let isClosingDay = false;
    if (closeDate) {
      const today = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kathmandu" }),
      );
      const closing = new Date(
        new Date(closeDate).toLocaleString("en-US", {
          timeZone: "Asia/Kathmandu",
        }),
      );
      isClosingDay =
        today.getFullYear() === closing.getFullYear() &&
        today.getMonth() === closing.getMonth() &&
        today.getDate() === closing.getDate();
    }

    let shouldSendStatusReport = false;
    let isInitial = false;
    let isClosingWarning = false;

    if (isInitialRun) {
      shouldSendStatusReport = true;
      isInitial = true;
      await ipoRepo.markInitialSent(userId, ipoId);
    } else if (isMorningCron) {
      shouldSendStatusReport = true;
    } else if (isEveningCron && isClosingDay) {
      shouldSendStatusReport = true;
      isClosingWarning = true;
    }

    const justReapplied = liveApps.some((a) => a.reapplied || a.reapplyFailed);
    if (justReapplied) {
      shouldSendStatusReport = true;
    }

    const rejectedApps = liveApps.filter(
      (a) => a.isRejected || a.status === "error",
    );
    if (rejectedApps.length > 0) {
      shouldSendStatusReport = true;
    }

    if (shouldSendStatusReport) {
      await this.notifyStatusReportLive(
        user.mobileNumber,
        ipoName,
        liveApps,
        accounts,
        openDate,
        closeDate,
        isInitial,
        isClosingWarning,
        isOpen,
        false, // isAllVerified
      );
    }
  },

  async notifyStatusReportLive(
    mobileNumber: string,
    ipoName: string,
    liveApps: LiveApplicationStatus[],
    accounts: any[],
    openDate?: string,
    closeDate?: string,
    isInitial: boolean = true,
    isClosingWarning: boolean = false,
    isOpen?: boolean,
    isAllVerified: boolean = false,
  ) {
    const verified: string[] = [];
    const unverified: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const reapplied: string[] = [];
    const reapplyFailed: string[] = [];

    const isClosed = isOpen === false;

    for (const app of liveApps) {
      const account = accounts.find((a) => a.id === app.brokerAccountId);

      if (app.reapplied) {
        reapplied.push(`${app.accountName}: Auto Re-applied 🔄`);
      } else if (app.reapplyFailed) {
        reapplyFailed.push(
          `${app.accountName}: Re-apply Failed (${app.errorMessage}) 🚨`,
        );
      } else if (
        app.isVerified ||
        app.status === "applied" ||
        app.status === "allotted" ||
        app.status === "not_allotted"
      ) {
        verified.push(`${app.accountName}: Verified ✅`);
      } else if (app.status === "pending") {
        unverified.push(`${app.accountName}: Unverified ⏳`);
      } else if (app.isRejected || app.status === "error") {
        if (
          app.errorMessage === "Auto-apply disabled" ||
          app.errorMessage === "Did not apply via system"
        ) {
          skipped.push(`${app.accountName}: Not Applied ⏸️`);
        } else {
          let errorStr = `${app.accountName}: Rejected (${app.errorMessage}) ❌`;
          if (!isClosed && account && !account.autoReApply) {
            errorStr += `\n   └ Auto Re-apply OFF`;
          }
          failed.push(errorStr);
        }
      }
    }

    let message = isInitial
      ? `📊 *New IPO Alert*\n`
      : `📊 *IPO Status Report*\n`;
    message += `*${ipoName}*\n`;
    if (openDate || closeDate) {
      const start = openDate ? openDate.split("T")[0] : "TBD";
      const end = closeDate ? closeDate.split("T")[0] : "TBD";
      message += `📅 ${start} - ${end}\n`;
    }

    if (isClosed) {
      message += `\n🔒 *Status*: Closed\n`;
    }

    if (isClosingWarning && !isAllVerified) {
      message += `\n⏳ *CLOSING TODAY!* Please ensure you have sufficient balance in all your accounts!\n`;
    }

    if (isAllVerified) {
      message += `\n✅  *All accounts have been verified successfully!*\n`;
    }

    message += `\n📋 *Application Status*:\n`;

    if (reapplyFailed.length > 0) {
      message += `\n*Re-apply Failed* 🚨\n`;
      reapplyFailed.forEach((f) => (message += `${f}\n`));
    }
    if (reapplied.length > 0) {
      message += `\n*Re-applied* 🔄\n`;
      reapplied.forEach((r) => (message += `${r}\n`));
    }
    if (failed.length > 0) {
      message += `\n*Action Required* ❌\n`;
      failed.forEach((f) => (message += `${f}\n`));
    }
    if (skipped.length > 0) {
      message += `\n*Not Applied* ⏸️\n`;
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

    await whatsappService.sendMessage(
      this.formatNumber(mobileNumber),
      message.trim(),
    );
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
      } else if (
        app.errorMessage === "Auto-apply disabled" ||
        app.errorMessage === "Did not apply via system"
      ) {
        message += `⚠️ *${app.accountName}*: Not Applied\n`;
      } else if (app.status === "error" || app.isRejected) {
        message += `⚠️ *${app.accountName}*: Rejected ${app.errorMessage ? `(${app.errorMessage})` : ""}\n`;
      } else {
        message += `⚠️ *${app.accountName}*: ${app.status} ${app.errorMessage ? `(${app.errorMessage})` : ""}\n`;
      }
    }

    await whatsappService.sendMessage(
      this.formatNumber(user.mobileNumber),
      message.trim(),
    );
  },

  formatNumber(mobile: string): string {
    if (mobile.length === 10 && mobile.startsWith("9")) {
      return `977${mobile}`;
    }
    return mobile;
  },
};
