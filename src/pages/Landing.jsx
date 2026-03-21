/**
 * Landing.jsx
 * Public-facing landing page. Fully animated with framer-motion.
 * Displayed before wallet connection. Each section fades/slides in on scroll.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  Lightning,
  Lock,
  Shield,
  Users,
  CurrencyDollar,
  Eye,
  Globe,
  CheckCircle,
  XLogo,
  DiscordLogo,
  GithubLogo,
  DeviceMobile,
} from "@phosphor-icons/react";
import { ConnectButton, darkTheme, useActiveAccount } from "thirdweb/react";
import { client, supportedWallets } from "../lib/client.js";
import { arcTestnet } from "../lib/chains.js";
import { useApp } from "../context/AppContext.jsx";
import logoImg from "../assets/logo.png";
import arcLogoImg from "../assets/arc_logo.jpg";
import usdcLogoImg from "../assets/usdc_logo.svg";

// ─── Animation helpers ────────────────────────────────────────────────────────

function AnimatedSection({ children, className = "", fromDirection = "bottom" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const variants = {
    hidden: {
      opacity: 0,
      y: fromDirection === "bottom" ? 40 : fromDirection === "top" ? -40 : 0,
      x: fromDirection === "left" ? -50 : fromDirection === "right" ? 50 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, description, delay = 0, fromDirection = "bottom" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className="bg-salden-surface border border-salden-border rounded-2xl p-6 hover:border-salden-blue/40 transition-all duration-300 group"
    >
      <div className="w-11 h-11 rounded-xl bg-salden-blue/10 border border-salden-blue/20 flex items-center justify-center mb-4 group-hover:bg-salden-blue/20 transition-colors">
        <Icon size={22} weight="fill" className="text-salden-blue" />
      </div>
      <h3 className="text-salden-text-primary font-semibold text-base mb-2">{title}</h3>
      <p className="text-salden-text-secondary text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Mobile Warning Banner ────────────────────────────────────────────────────

function MobileWarning() {
  const [visible, setVisible] = useState(false);
  const { state, dispatch } = useApp();

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && !state.isMobileWarningDismissed) {
      setVisible(true);
    }
  }, [state.isMobileWarningDismissed]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-950/95 border-b border-amber-700/50 px-4 py-3 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-amber-200">
        <DeviceMobile size={16} className="flex-shrink-0" />
        <span>For the best experience, Salden is recommended on desktop.</span>
      </div>
      <button
        onClick={() => {
          setVisible(false);
          dispatch({ type: "DISMISS_MOBILE_WARNING" });
        }}
        className="text-amber-400 hover:text-amber-200 text-xs whitespace-nowrap font-medium"
      >
        Got it
      </button>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({ account, onContinueSetup }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-salden-bg via-[#0a0f24] to-salden-bg">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-salden-blue/5 blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-salden-violet/5 blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-3 mb-8"
        >
          <img src={logoImg} alt="Salden" className="h-64 w-auto object-contain shadow-lg" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-salden-text-primary leading-tight mb-6"
        >
          Decentralized Payroll
          <br />
          <span className="bg-gradient-to-r from-salden-blue to-salden-violet bg-clip-text text-transparent">
            Built for the Future
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-salden-text-secondary text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10"
        >
          Salden enables organizations to pay their teams directly through smart contracts — instantly, verifiably, and without the complexity of legacy payroll systems.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {!account ? (
            <ConnectButton
              client={client}
              wallets={supportedWallets}
              chain={arcTestnet}
              connectButton={{ label: "Connect Wallet" }}
              connectModal={{ size: "compact", title: "Sign in to use Salden" }}
              theme={darkTheme({
                colors: {
                  skeletonBg: "hsl(245, 91%, 9%)",
                  tertiaryBg: "hsl(244, 84%, 10%)",
                  modalBg: "hsl(248, 78%, 11%)",
                  accentText: "hsl(246, 89%, 11%)",
                  borderColor: "hsl(249, 92%, 11%)",
                  separatorLine: "hsl(250, 88%, 12%)",
                  connectedButtonBgHover: "hsl(240, 86%, 9%)",
                  connectedButtonBg: "hsl(242, 87%, 9%)",
                },
              })}
              supportedTokens={{
                5042002: [
                  {
                    address: "0x3600000000000000000000000000000000000000",
                    name: "USD Coin",
                    symbol: "USDC",
                    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
                    decimals: 18,
                  },
                ],
              }}
            />
          ) : (
            <button
              onClick={onContinueSetup}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-salden-blue to-salden-violet text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-blue-900/30"
            >
              Continue with Payroll Setup
              <ArrowRight size={16} />
            </button>
          )}

          <a
            href="#features"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-salden-border text-salden-text-secondary hover:border-salden-blue/50 hover:text-salden-text-primary transition-all text-sm font-medium"
          >
            Learn more
          </a>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-14 text-center"
        >
          {[
            { label: "Max per batch", value: "1,000" },
            { label: "Security rating", value: "93+" },
            { label: "Settlement time", value: "Instant" },
            { label: "Intermediaries", value: "Zero" },
          ].map(({ label, value }) => (
            <div key={label} className="px-4">
              <div className="text-2xl font-bold text-salden-text-primary">{value}</div>
              <div className="text-xs text-salden-text-muted mt-0.5">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-salden-text-muted">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-5 h-8 rounded-full border border-salden-border flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 bg-salden-text-muted rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Landing({ onConnected }) {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const { state } = useApp();

  // If wallet connects and user already has a clone, redirect to dashboard
  useEffect(() => {
    if (account && state.hasPayrollClone) {
      navigate("/dashboard");
    }
  }, [account, state.hasPayrollClone, navigate]);

  const handleContinueSetup = () => {
    onConnected?.();
  };

  return (
    <div className="bg-salden-bg text-salden-text-primary font-sans overflow-x-hidden">
      <MobileWarning />

      {/* Sticky top nav */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-salden-bg/80 backdrop-blur-md border-b border-salden-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Salden" className="h-20 w-auto object-contain" />
          </div>
          <ConnectButton
            client={client}
            wallets={supportedWallets}
            chain={arcTestnet}
            connectButton={{ label: "Connect Wallet" }}
            connectModal={{ size: "compact", title: "Sign in to use Salden" }}
            theme={darkTheme({
              colors: {
                skeletonBg: "hsl(245, 91%, 9%)",
                tertiaryBg: "hsl(244, 84%, 10%)",
                modalBg: "hsl(248, 78%, 11%)",
                accentText: "hsl(246, 89%, 11%)",
                borderColor: "hsl(249, 92%, 11%)",
                separatorLine: "hsl(250, 88%, 12%)",
                connectedButtonBgHover: "hsl(240, 86%, 9%)",
                connectedButtonBg: "hsl(242, 87%, 9%)",
              },
            })}
              supportedTokens={{
                5042002: [
                  {
                    address: "0x3600000000000000000000000000000000000000",
                    name: "USD Coin",
                    symbol: "USDC",
                    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
                    decimals: 18,
                  },
                ],
              }}
          />
        </div>
      </header>

      {/* Hero */}
      <div className="pt-16">
        <HeroSection account={account} onContinueSetup={handleContinueSetup} />
      </div>

      {/* If wallet connected but no clone — show continue button below hero */}
      {account && !state.hasPayrollClone && (
        <div className="py-6 flex justify-center bg-salden-bg border-t border-salden-border">
          <button
            onClick={handleContinueSetup}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-salden-blue to-salden-violet text-white font-semibold text-sm hover:opacity-90 transition-all shadow-xl shadow-blue-900/30 animate-pulse-slow"
          >
            Continue with Payroll Setup
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Section: Direct Payments ── */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <AnimatedSection fromDirection="left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-salden-blue/10 border border-salden-blue/20 text-salden-blue text-xs font-medium mb-5">
              <Lightning size={12} weight="fill" />
              Direct Payments
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-salden-text-primary mb-4 leading-tight">
              Wallet to Wallet. No Middlemen.
            </h2>
            <p className="text-salden-text-secondary leading-relaxed mb-6">
              When payroll is executed, funds transfer directly from the employer to each employee's wallet through a dedicated smart contract. There are no intermediaries, no custody of funds by third parties, and no delays. Every payment is settled on-chain — transparent and cryptographically verifiable by anyone.
            </p>
            <div className="flex flex-wrap gap-3">
              {["No custodians", "Instant settlement", "On-chain records"].map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 text-xs text-salden-success bg-emerald-950/40 border border-emerald-800/30 px-3 py-1.5 rounded-full">
                  <CheckCircle size={11} weight="fill" />
                  {tag}
                </span>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection fromDirection="right">
            <div className="bg-salden-surface border border-salden-border rounded-2xl p-6 space-y-3">
              {[
                { from: "Employer", to: "Employee 1", amount: "2,500 USDC", delay: "0ms" },
                { from: "Employer", to: "Employee 2", amount: "3,100 USDC", delay: "200ms" },
                { from: "Employer", to: "Employee 3", amount: "1,800 USDC", delay: "400ms" },
              ].map(({ from, to, amount, delay }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3 bg-salden-hover rounded-xl px-4 py-3"
                >
                  <div className="w-2 h-2 rounded-full bg-salden-success flex-shrink-0 animate-pulse" />
                  <span className="text-xs text-salden-text-muted flex-shrink-0">{from}</span>
                  <ArrowRight size={12} className="text-salden-text-muted" />
                  <span className="text-xs text-salden-text-secondary flex-1">{to}</span>
                  <span className="text-xs font-semibold text-salden-text-primary">{amount}</span>
                </motion.div>
              ))}
              <div className="text-center text-xs text-salden-text-muted pt-2">
                Settled in a single on-chain transaction
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Section: Features grid ── */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-salden-text-primary mb-3">
              Everything You Need for Modern Payroll
            </h2>
            <p className="text-salden-text-secondary max-w-xl mx-auto">
              Salden combines blockchain security with practical payroll tooling to deliver an enterprise-grade experience.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={CurrencyDollar}
            title="Stable Payments with USDC"
            description="All payroll is denominated in USD Coin — a fully regulated stablecoin backed 1:1 with the US dollar. No volatility. No surprises. Every pay cycle is predictable and reliable."
            delay={0}
          />
          <FeatureCard
            icon={Lock}
            title="Private Payroll Contracts"
            description="Your payroll runs on a dedicated smart contract deployed exclusively for your organization. Complete ownership and isolation — no shared global contract, no shared risk."
            delay={0.08}
          />
          <FeatureCard
            icon={Users}
            title="Built for Scale"
            description="Distribute payments to up to 1,000 employees per batch transaction. Large payroll operations that would take hours with traditional systems complete in seconds on-chain."
            delay={0.16}
          />
          <FeatureCard
            icon={Eye}
            title="Privacy by Design"
            description="The payroll contract requires only an employee wallet address and a payment amount. No names, no profiles, no sensitive HR data stored on-chain."
            delay={0.0}
          />
          <FeatureCard
            icon={Shield}
            title="AML & CTF Compliance"
            description="Integrated Scorechain compliance screening automatically verifies employee wallets against global sanctions lists — running silently in the background."
            delay={0.08}
          />
          <FeatureCard
            icon={Globe}
            title="Cross-Device Access"
            description="Your payroll data is encrypted end-to-end, stored on IPFS, and indexed by your wallet. Connect from any device and your dashboard loads instantly."
            delay={0.16}
          />
        </div>
      </section>

      {/* ── Section: IPFS / Cross-device ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <AnimatedSection fromDirection="right" className="lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-900/30 border border-violet-700/30 text-violet-300 text-xs font-medium mb-5">
              <Globe size={12} weight="fill" />
              Cross-Device Sync
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-salden-text-primary mb-4 leading-tight">
              Switch Devices. Your Payroll Follows.
            </h2>
            <p className="text-salden-text-secondary leading-relaxed mb-4">
              Salden uses your wallet as both your identity and your encryption key. All payroll data is encrypted in your browser using AES-256-GCM before it ever leaves your device, then stored on IPFS via Pinata.
            </p>
            <p className="text-salden-text-secondary leading-relaxed">
              A personal smart contract on Arc Network stores a pointer to your encrypted data. Connect your wallet from any device, sign once, and your entire payroll dashboard loads instantly — no re-setup, no servers, no accounts.
            </p>
          </AnimatedSection>

          <AnimatedSection fromDirection="left" className="lg:order-1">
            <div className="bg-salden-surface border border-salden-border rounded-2xl p-6">
              {[
                { step: "1", label: "Connect wallet", detail: "Wallet = your identity" },
                { step: "2", label: "Sign once", detail: "Derives AES-256 encryption key" },
                { step: "3", label: "Data loads", detail: "Fetched from IPFS, decrypted locally" },
                { step: "4", label: "Edit & sync", detail: "Encrypted + uploaded + registry updated" },
              ].map(({ step, label, detail }, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.45 }}
                  viewport={{ once: true }}
                  className={`flex items-center gap-4 py-4 ${i < 3 ? "border-b border-salden-border" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full bg-salden-blue/15 border border-salden-blue/30 flex items-center justify-center text-salden-blue text-xs font-bold flex-shrink-0">
                    {step}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-salden-text-primary">{label}</div>
                    <div className="text-xs text-salden-text-muted">{detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Section: Security ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <AnimatedSection>
          <div className="bg-gradient-to-br from-salden-surface to-salden-hover border border-salden-border rounded-3xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-salden-blue/10 border border-salden-blue/20 flex items-center justify-center mx-auto mb-6">
              <Shield size={32} weight="fill" className="text-salden-blue" />
            </div>
            <h2 className="text-3xl font-bold text-salden-text-primary mb-4">
              Security You Can Trust
            </h2>
            <p className="text-salden-text-secondary max-w-2xl mx-auto leading-relaxed mb-6">
              Salden's smart contracts are built following modern blockchain security practices and industry standards. Independent analysis of the system architecture produced a security rating exceeding 93 — reflecting a strong security posture suitable for production use.
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-salden-blue/10 border border-salden-blue/20">
              <CheckCircle size={20} weight="fill" className="text-salden-blue" />
              <span className="text-salden-text-primary font-semibold">93+ Security Rating</span>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ── Section: Transparency & Open Source ── */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <AnimatedSection>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-salden-surface border border-salden-border rounded-2xl p-6">
              <Eye size={24} weight="fill" className="text-salden-violet mb-4" />
              <h3 className="text-xl font-bold text-salden-text-primary mb-2">Transparency</h3>
              <p className="text-salden-text-secondary text-sm leading-relaxed">
                All code — from the smart contracts to the React front end — is open source. Anyone is free to conduct an independent audit or review of the codebase at any time.
              </p>
            </div>
            <div className="bg-salden-surface border border-salden-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <img src={arcLogoImg} alt="Arc Network" className="w-8 h-8 rounded-lg object-cover" />
                <span className="text-salden-text-muted text-sm font-medium">Powered by Arc Network</span>
              </div>
              <h3 className="text-xl font-bold text-salden-text-primary mb-2">Why Arc Network?</h3>
              <p className="text-salden-text-secondary text-sm leading-relaxed">
                Arc Network — the Economic Operating System of the internet — uses USDC as its native gas token, delivering predictable and extremely low transaction fees, high throughput, and privacy suited to enterprise payroll operations.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <img src={usdcLogoImg} alt="USDC" className="w-5 h-5" />
                <span className="text-xs text-salden-text-muted">USDC as native currency</span>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-6">
        <AnimatedSection>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-salden-text-primary mb-4">
              Ready to modernize your payroll?
            </h2>
            <p className="text-salden-text-secondary mb-8">
              Connect your wallet to get started. No account required. No email needed. Just your wallet.
            </p>
<ConnectButton
              client={client}
              wallets={supportedWallets}
              chain={arcTestnet}
              connectButton={{ label: "Get Started — Connect Wallet" }}
              connectModal={{ size: "compact", title: "Sign in to use Salden" }}
              theme={darkTheme({
                colors: {
                  skeletonBg: "hsl(245, 91%, 9%)",
                  tertiaryBg: "hsl(244, 84%, 10%)",
                  modalBg: "hsl(248, 78%, 11%)",
                  accentText: "hsl(246, 89%, 11%)",
                  borderColor: "hsl(249, 92%, 11%)",
                  separatorLine: "hsl(250, 88%, 12%)",
                  connectedButtonBgHover: "hsl(240, 86%, 9%)",
                  connectedButtonBg: "hsl(242, 87%, 9%)",
                },
              })}
              supportedTokens={{
                5042002: [
                  {
                    address: "0x3600000000000000000000000000000000000000",
                    name: "USD Coin",
                    symbol: "USDC",
                    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
                    decimals: 18,
                  },
                ],
              }}
            />
          </div>
        </AnimatedSection>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-salden-border bg-salden-surface/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Salden" className="h-12 w-auto object-contain" />
            </div>

            <div className="flex items-center gap-2 text-sm text-salden-text-muted">
              <span className="font-medium mr-1">Contacts:</span>
              <a
                href={import.meta.env.VITE_TWITTER_COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-salden-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-salden-hover"
                aria-label="Salden on X"
              >
                <XLogo size={15} weight="fill" />
                <span className="hidden sm:inline text-xs">X</span>
              </a>
              <a
                href="#"
                className="flex items-center gap-1.5 hover:text-salden-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-salden-hover"
                aria-label="Discord"
              >
                <DiscordLogo size={15} weight="fill" />
                <span className="hidden sm:inline text-xs">Discord</span>
              </a>
              <a
                href="https://github.com/Elijah463/Salden-Dapp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-salden-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-salden-hover"
                aria-label="GitHub"
              >
                <GithubLogo size={15} weight="fill" />
                <span className="hidden sm:inline text-xs">GitHub</span>
              </a>
              <span className="mx-1 text-salden-border">|</span>
              <a
                href={import.meta.env.VITE_TWITTER_DEV_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:text-salden-blue transition-colors"
              >
                Contact Developer
              </a>
            </div>

            <p className="text-xs text-salden-text-muted">
              Copyright © Salden Limited 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
