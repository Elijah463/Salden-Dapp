/**
 * Sidebar.jsx
 * Collapsible navigation sidebar. Only visible when wallet is connected.
 * Uses Phosphor Icons exclusively per commandment 36.
 */

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  GridFour,
  ClockCounterClockwise,
  ShieldCheck,
  GearSix,
  List,
  X,
  ArrowLeft,
} from "@phosphor-icons/react";
import logoImg from "../assets/logo.jpg";

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "HR Dashboard",
    icon: GridFour,
  },
  {
    to: "/attendance",
    label: "Attendance Sheet",
    icon: ClockCounterClockwise,
  },
  {
    to: "/compliance",
    label: "Compliance",
    icon: ShieldCheck,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: GearSix,
  },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  return (
    <>
      {/* Hamburger trigger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-5 left-5 z-50 flex items-center justify-center w-10 h-10 rounded-xl bg-salden-surface border border-salden-border text-salden-text-secondary hover:text-salden-text-primary hover:border-salden-blue/60 transition-all duration-200 shadow-lg"
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-salden-surface border-r border-salden-border flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-salden-border">
          <div className="flex items-center gap-3">
            <img
              src={logoImg}
              alt="Salden Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="text-salden-text-primary font-bold text-lg tracking-tight">
              Salden
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="text-salden-text-muted hover:text-salden-text-primary transition-colors"
            aria-label="Close menu"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;

            return (
              <NavLink
                key={to}
                to={to}
                onClick={toggleSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-salden-blue/15 text-salden-blue border border-salden-blue/30"
                    : "text-salden-text-secondary hover:text-salden-text-primary hover:bg-salden-hover"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  size={18}
                  weight={isActive ? "fill" : "regular"}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? "text-salden-blue" : "text-salden-text-muted group-hover:text-salden-text-secondary"
                  }`}
                />
                <span>{label}</span>
                {to === "/attendance" && (
                  <span className="ml-auto text-[10px] font-semibold bg-salden-warning/20 text-salden-warning px-2 py-0.5 rounded-full">
                    Soon
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t border-salden-border">
          <p className="text-[11px] text-salden-text-muted">
            Powered by Arc Network
          </p>
          <p className="text-[10px] text-salden-text-muted/60 mt-0.5">
            © Salden Limited 2026
          </p>
        </div>
      </aside>
    </>
  );
}
