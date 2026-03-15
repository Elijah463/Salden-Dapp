/**
 * TermsModal.jsx
 * Scrollable Terms of Service modal with gated I Agree / I Disagree buttons.
 * Buttons only activate once the user has scrolled to the bottom of the content.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { X, CheckCircle, XCircle } from "@phosphor-icons/react";

const TERMS_CONTENT = `Salden Terms of Service

By accessing or using Salden, a decentralized payroll platform, you agree to the following terms.

1. Acceptance of Terms
By using Salden, you acknowledge and agree to comply with these Terms of Service. If you do not agree with these terms, you should not use the platform.

2. Wallet Information
Salden operates using blockchain wallet addresses. By using the platform, you acknowledge that your wallet address may be processed and stored for payroll execution and verification. Salden does not collect personal information such as names, emails, or identity documents unless explicitly provided by you through external integrations.

3. Compliance and Monitoring
To maintain security and regulatory compliance, Salden may process wallet addresses through third-party compliance and analytics services such as Scorechain for Anti-Money Laundering (AML) and Counter-Terrorism Financing (CTF) monitoring.

4. External Integrations
Salden may integrate with external productivity or workforce tools such as Clockify to assist employers in tracking attendance or work hours. Any data shared with such tools is limited to what is necessary for payroll functionality.

5. User Responsibility
Users are responsible for maintaining control and security of their wallet. Transactions executed through Salden are recorded on public blockchain networks and are generally irreversible.

6. Limitation of Liability
Salden provides payroll system tools but does not guarantee uninterrupted service or protection against blockchain network issues, or third-party service disruptions.

7. Updates to Terms
These Terms of Service may be updated periodically. Continued use of the platform after updates constitutes acceptance of the revised terms.

By continuing to use Salden, you confirm that you have read, understood, and agreed to these Terms of Service.`;

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {function} props.onAgree - Called when user clicks I Agree
 */
export default function TermsModal({ isOpen, onClose, onAgree }) {
  const scrollRef = useRef(null);
  const [hasReadAll, setHasReadAll] = useState(false);

  // Reset read state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setHasReadAll(false);
      // Small timeout ensures the scroll element is rendered before we reset
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [isOpen]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 20;
    if (atBottom) setHasReadAll(true);
  }, []);

  const handleAgree = useCallback(() => {
    if (!hasReadAll) return;
    onAgree?.();
    onClose?.();
  }, [hasReadAll, onAgree, onClose]);

  const handleDisagree = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-salden-border flex-shrink-0">
          <h2
            id="terms-title"
            className="text-salden-text-primary font-bold text-lg"
          >
            Terms of Service
          </h2>
          <button
            onClick={onClose}
            className="text-salden-text-muted hover:text-salden-text-primary transition-colors"
            aria-label="Close Terms of Service"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 text-sm text-salden-text-secondary leading-relaxed whitespace-pre-line"
          tabIndex={0}
          aria-label="Terms of Service content. Scroll to the bottom to enable acceptance."
        >
          {TERMS_CONTENT}
        </div>

        {/* Scroll cue */}
        {!hasReadAll && (
          <p className="text-center text-xs text-salden-text-muted px-6 py-2 flex-shrink-0">
            Scroll to the bottom to enable the acceptance buttons.
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 px-6 py-4 border-t border-salden-border flex-shrink-0">
          <button
            onClick={handleDisagree}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-salden-border text-salden-text-secondary hover:border-red-600/60 hover:text-red-400 transition-all text-sm font-medium"
          >
            <XCircle size={16} />
            I Disagree
          </button>

          <button
            onClick={handleAgree}
            disabled={!hasReadAll}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              hasReadAll
                ? "bg-salden-blue hover:bg-salden-blue-dark text-white cursor-pointer shadow-lg shadow-blue-900/30"
                : "bg-salden-hover text-salden-text-muted cursor-not-allowed"
            }`}
            aria-disabled={!hasReadAll}
          >
            <CheckCircle size={16} weight={hasReadAll ? "fill" : "regular"} />
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}
