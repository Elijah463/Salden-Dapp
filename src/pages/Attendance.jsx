/**
 * Attendance.jsx
 * Attendance Sheet page — Clockify integration coming soon.
 * Displays a professional placeholder with roadmap context.
 */

import { ClockCounterClockwise, RocketLaunch, Plugs } from "@phosphor-icons/react";

export default function Attendance() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-salden-surface border border-salden-border flex items-center justify-center mx-auto mb-6 relative">
        <ClockCounterClockwise size={36} weight="duotone" className="text-salden-blue" />
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-salden-warning/20 border border-salden-warning/50 flex items-center justify-center">
          <RocketLaunch size={12} weight="fill" className="text-salden-warning" />
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-salden-text-primary mb-2">Attendance Sheet</h1>
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-salden-warning/10 border border-salden-warning/30 text-salden-warning text-sm font-semibold mb-6">
        COMING SOON...
      </div>

      {/* Description */}
      <p className="text-salden-text-secondary text-base max-w-md leading-relaxed mb-8">
        Salden's Attendance Sheet module integrates with Clockify to give employers a unified view of employee time tracking, directly within the payroll dashboard.
      </p>

      {/* Features preview */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-6 max-w-sm w-full text-left space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-salden-text-muted mb-2 uppercase tracking-wider">
          <Plugs size={13} />
          Planned Clockify Integration
        </div>
        {[
          "Automatic timesheet sync from Clockify",
          "Real-time attendance visibility per employee",
          "Payroll-aware time tracking reports",
          "Attendance-based salary calculation support",
        ].map((feature) => (
          <div
            key={feature}
            className="flex items-start gap-2.5 text-sm text-salden-text-secondary"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-salden-blue mt-1.5 flex-shrink-0" />
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}
