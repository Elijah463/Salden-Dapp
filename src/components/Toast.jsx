/**
 * Toast.jsx
 * Accessible toast notification system using Phosphor Icons.
 */

import { useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Warning,
  Info,
  X,
} from "@phosphor-icons/react";
import { useApp } from "../context/AppContext.jsx";

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: Warning,
  info: Info,
};

const STYLES = {
  success:
    "bg-emerald-950/90 border border-emerald-700/60 text-emerald-200",
  error:
    "bg-red-950/90 border border-red-700/60 text-red-200",
  warning:
    "bg-amber-950/90 border border-amber-700/60 text-amber-200",
  info:
    "bg-blue-950/90 border border-blue-700/60 text-blue-200",
};

const ICON_COLORS = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-blue-400",
};

function ToastItem({ toast }) {
  const { removeToast } = useApp();
  const Icon = ICONS[toast.type] || Info;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 px-4 py-3 rounded-xl backdrop-blur-sm shadow-2xl text-sm max-w-sm w-full animate-slide-up ${STYLES[toast.type] || STYLES.info}`}
    >
      <Icon
        size={18}
        weight="fill"
        className={`flex-shrink-0 mt-0.5 ${ICON_COLORS[toast.type]}`}
      />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { state } = useApp();

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-label="Notifications"
    >
      {state.toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
