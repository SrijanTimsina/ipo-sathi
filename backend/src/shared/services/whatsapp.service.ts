import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../../config/index.js";

export const whatsappService = {
  /**
   * Sends a WhatsApp text message using the Evolution API.
   * 
   * @param recipientNumber The phone number in international format (e.g., "9779812345678")
   * @param message The text message to send
   * @returns The response data from Evolution API
   */
  async sendMessage(recipientNumber: string, message: string) {
    const { apiUrl, apiKey, instanceName } = config.whatsapp;

    if (!apiUrl || !apiKey || !instanceName) {
      console.warn("WhatsApp configuration is missing in environment variables. Message not sent.");
      return null;
    }

    // Ensure URL doesn't end with a slash to properly format it
    const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
    const endpoint = `${baseUrl}/message/sendText/${instanceName}`;

    try {
      const response = await axios.post(
        endpoint,
        {
          number: recipientNumber,
          text: message,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
        }
      );

      // Log the message
      try {
        const logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logLine = `[${new Date().toISOString()}] SENT TO ${recipientNumber}\nMessage:\n${message}\nResponse Status: ${response.status}\n\n`;
        fs.appendFileSync(path.join(logDir, "whatsapp.log"), logLine);
      } catch (e) {
        console.error("Failed to write to whatsapp.log", e);
      }

      return response.data;
    } catch (error) {
      console.error(`Failed to send WhatsApp message to ${recipientNumber}:`, error);
      
      // Log the failure
      try {
        const logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        const logLine = `[${new Date().toISOString()}] ERROR SENDING TO ${recipientNumber}\nMessage:\n${message}\nError: ${errorMsg}\n\n`;
        fs.appendFileSync(path.join(logDir, "whatsapp.log"), logLine);
      } catch (e) {}

      throw error;
    }
  },

  /**
   * Checks the connection status of the Evolution API instance.
   * 
   * @returns The connection state object (e.g., { instance: { state: "open" } }) or null
   */
  async checkConnectionStatus() {
    const { apiUrl, apiKey, instanceName } = config.whatsapp;

    if (!apiUrl || !apiKey || !instanceName) {
      console.warn("WhatsApp configuration is missing in environment variables.");
      return null;
    }

    const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
    const endpoint = `${baseUrl}/instance/connectionState/${instanceName}`;

    try {
      const response = await axios.get(endpoint, {
        headers: {
          apikey: apiKey,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to check WhatsApp connection status:", error);
      throw error;
    }
  },
};
