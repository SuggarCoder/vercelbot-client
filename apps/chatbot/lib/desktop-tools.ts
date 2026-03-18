export type DesktopToolCall = {
  callId: string;
  chatId: string;
  toolName: string;
  args?: Record<string, unknown>;
  requiresApproval?: boolean;
  approvalMessage?: string;
};

export type DesktopToolResult = {
  callId: string;
  chatId: string;
  toolName: string;
  status: "success" | "error" | "denied" | "unsupported";
  output?: unknown;
  error?: string;
};

type TauriCore = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

declare global {
  interface Window {
    __TAURI__?: {
      core?: TauriCore;
    };
  }
}

function getTauriCore() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__TAURI__?.core ?? null;
}

export function canUseDesktopTools() {
  return Boolean(getTauriCore());
}

export async function executeDesktopToolCall(
  call: DesktopToolCall,
): Promise<DesktopToolResult> {
  const tauriCore = getTauriCore();

  if (!tauriCore) {
    return {
      callId: call.callId,
      chatId: call.chatId,
      toolName: call.toolName,
      status: "unsupported",
      error: "Desktop tools are only available inside the Tauri app.",
    };
  }

  return tauriCore.invoke<DesktopToolResult>("run_desktop_tool", { call });
}
