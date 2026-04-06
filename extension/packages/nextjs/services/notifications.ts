import crypto from "crypto";

export interface SendNotificationParams {
  fid: number;
  title: string;
  body: string;
  targetUrl?: string;
  eventType?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  noSubscription?: boolean;
}

/**
 * Send a notification directly to ViniApp backend (server-side only).
 * Uses CDP_PROXY_KEY auth — only callable from API routes, never from client code.
 * Fire-and-forget: call with .catch(console.error) so notifications never block primary actions.
 *
 * Usage:
 *   import { sendNotificationDirect } from "~~/services/notifications";
 *   sendNotificationDirect({ fid: 12345, title: "Your Move!", body: "Opponent played e4", eventType: "game_move" }).catch(console.error);
 */
export async function sendNotificationDirect(params: SendNotificationParams): Promise<NotificationResult> {
  const cdpKey = process.env.CDP_PROXY_KEY;
  const backendUrl = process.env.VINIAPP_BACKEND;

  if (!cdpKey || !backendUrl) {
    return { success: false, error: "Notifications not configured" };
  }

  if (!params.fid || !params.title || !params.body) {
    return { success: false, error: "fid, title, and body are required" };
  }

  if (params.title.length > 32) {
    return { success: false, error: "title must be 32 characters or less" };
  }

  if (params.body.length > 128) {
    return { success: false, error: "body must be 128 characters or less" };
  }

  const notificationId = `${params.eventType || "notify"}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const targetUrl = params.targetUrl || process.env.NEXT_PUBLIC_URL || "";

  try {
    const response = await fetch(`${backendUrl}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Viniapp-Cdp-Key": cdpKey,
      },
      body: JSON.stringify({
        notification_id: notificationId,
        title: params.title,
        body: params.body,
        target_url: targetUrl,
        fid: params.fid,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 404) {
      return { success: true, noSubscription: true, notificationId };
    }

    if (!response.ok) {
      return { success: false, error: data.error || "Notification failed", notificationId };
    }

    return { success: true, notificationId: data.notification_id || notificationId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
