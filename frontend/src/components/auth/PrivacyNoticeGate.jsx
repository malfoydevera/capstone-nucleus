import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ExternalLink, MapPin, Mail, Lock } from 'lucide-react';
import NucleusLogoMark from '../branding/NucleusLogoMark';
import nuDpoSeal from '../../assets/nu-dpo-seal.png.webp';

export const PRIVACY_ACCEPTANCE_KEY = 'nucleus_privacy_accepted';

const RA_10173_URL = 'https://privacy.gov.ph/data-privacy-act/';
const NU_PRIVACY_POLICY_URL = 'https://www.national-u.edu.ph/data-privacy/';

const PrivacyNoticeGate = ({ onAccept, onDecline }) => {
  const scrollRef = useRef(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 48;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setHasScrolledToBottom(atBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    checkScrollPosition();
    el.addEventListener('scroll', checkScrollPosition, { passive: true });
    window.addEventListener('resize', checkScrollPosition);

    return () => {
      el.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  const canAccept = hasScrolledToBottom && hasAgreed;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-notice-title"
      aria-describedby="privacy-notice-subtitle"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-8 py-5">
        <div className="mx-auto flex max-w-4xl items-start gap-4">
          <NucleusLogoMark size={44} rounded="rounded-xl" className="shadow-sm" />
          <div>
            <h1 id="privacy-notice-title" className="text-xl sm:text-2xl font-bold text-slate-900">
              National University Privacy Notice
            </h1>
            <p id="privacy-notice-subtitle" className="mt-1 text-sm text-slate-500">
              Please read and accept before continuing
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8"
      >
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-start">
            <img
              src={nuDpoSeal}
              alt="National Privacy Commission DPO/DPS Registered seal"
              className="mx-auto w-full max-w-[220px] h-auto object-contain drop-shadow-md"
            />
            <div className="space-y-4 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              <p>
                National University Dasmariñas values your privacy and is committed to protecting your
                personal information. By continuing with account creation on{' '}
                <strong className="text-slate-900">NUCLEUS</strong> (National University Capstone &
                Learning Electronic Unified System), you acknowledge that your data will be handled
                responsibly in accordance with applicable privacy regulations.
              </p>
              <hr className="border-slate-200" />
              <p>
                This notice applies to students, researchers, faculty, and staff who use NUCLEUS to
                submit, review, and publish academic research. We process personal data in compliance
                with the{' '}
                <a
                  href={RA_10173_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#1C4D8D] hover:text-[#163a6b] underline underline-offset-2 inline-flex items-center gap-1"
                >
                  Data Privacy Act of 2012 (RA 10173)
                  <ExternalLink size={13} className="shrink-0" aria-hidden="true" />
                </a>
                .
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">1. Personal Data We Collect</h2>
            <ol className="list-decimal space-y-3 pl-5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900">Identity and contact details:</strong> Full name,
                institutional email address, recovery email (optional), and account credentials.
              </li>
              <li>
                <strong className="text-slate-900">Academic and student records:</strong> Department,
                program, research submissions, co-author information, grades-related metadata, and
                publication details.
              </li>
              <li>
                <strong className="text-slate-900">Research content:</strong> Thesis documents, abstracts,
                annotations, review comments, and related files uploaded to the repository.
              </li>
              <li>
                <strong className="text-slate-900">System and platform data:</strong> Login timestamps,
                IP addresses, device and browser information, access logs, and audit trails for security
                and compliance.
              </li>
              <li>
                <strong className="text-slate-900">Communications:</strong> In-app notifications,
                email confirmations, and password recovery messages sent through institutional channels.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">2. Why We Process Your Personal Data</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              We process your personal data based on consent, contractual necessity, legitimate
              institutional interests, and compliance with legal obligations. Specifically, we use your
              data to:
            </p>
            <ol className="list-decimal space-y-3 pl-5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              <li>Verify your identity and institutional affiliation during registration and login.</li>
              <li>Enable research submission, peer review, approval workflows, and repository access.</li>
              <li>Maintain academic records, audit logs, and compliance with university policies.</li>
              <li>Send service-related notifications, including email confirmation and account updates.</li>
              <li>Protect the platform against unauthorized access, fraud, and security incidents.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">3. NUCLEUS and Digital Platforms</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              National University uses NUCLEUS and related digital platforms (including institutional
              portals and learning systems) to deliver academic and research services. Data may be
              collected through registration forms, portal entries, research submissions, and system logs.
            </p>
            <ol className="list-decimal space-y-3 pl-5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900">Accounts and access:</strong> Account creation,
                login and authentication, and role-based permissions for students, faculty, and staff.
              </li>
              <li>
                <strong className="text-slate-900">Transactions:</strong> Research submission and
                review workflows, co-author invitations, approval status updates, and repository access.
              </li>
              <li>
                <strong className="text-slate-900">Logs and device data:</strong> Access logs such as
                timestamps, IP addresses, and device or browser information for security and monitoring.
              </li>
              <li>
                <strong className="text-slate-900">Support and audit:</strong> Helpdesk requests,
                troubleshooting records, and audit trails for compliance and incident response.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">4. Sharing and Disclosure</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              National University does not sell your personal data. We share it only on a need-to-know
              basis, including:
            </p>
            <ol className="list-decimal space-y-3 pl-5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900">Within NU:</strong> Relevant offices and academic
                units involved in research review, enrollment verification, and institutional reporting.
              </li>
              <li>
                <strong className="text-slate-900">Third-party service providers and partners:</strong>{' '}
                Vendors that support IT infrastructure, cloud hosting, email delivery, and related
                services, subject to contractual safeguards.
              </li>
              <li>
                <strong className="text-slate-900">Government and lawful requests:</strong> Regulators,
                courts, or authorities when required by applicable law or valid legal process.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">5. Cross-Border Transfers</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              National University may use cloud service providers located outside the Philippines to
              operate NUCLEUS and related systems. When personal data is transferred abroad, we apply
              appropriate safeguards in accordance with the Data Privacy Act of 2012 and National
              University policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">6. Retention and Disposal</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              We retain personal data for as long as necessary to fulfill the purposes stated in this
              notice, or as required by law, institutional policy, or legitimate business needs. Research
              records, audit logs, and academic submissions may be kept for the duration of your
              enrollment or employment and beyond where retention is required for compliance, historical
              reference, or legal obligations. When data is no longer needed, it is securely disposed
              of or anonymized in accordance with our retention schedule.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">7. Security Measures</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              National University implements administrative, technical, and organizational safeguards to
              protect personal data, including:
            </p>
            <ol className="list-decimal space-y-3 pl-5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              <li>Role-based access controls and confidentiality obligations for authorized personnel.</li>
              <li>System security monitoring, logging, and incident response procedures.</li>
              <li>Technical safeguards such as encryption in transit and secure authentication.</li>
              <li>Training and awareness programs for personnel who handle personal data.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">8. Your Rights and How to Contact Us</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              Under the Data Privacy Act of 2012, you have the right to be informed, to access, to
              object, to erasure or blocking, to rectify, to file a complaint with the National Privacy
              Commission, and to damages. To exercise your rights or raise privacy concerns regarding
              NUCLEUS, you may contact the Data Privacy Office using the details below.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 border-l-4 border-l-[#1C4D8D]">
              <div className="flex items-center gap-2 mb-4">
                <Lock size={18} className="text-[#1C4D8D] shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">Data Privacy Office</h3>
              </div>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <MapPin size={16} className="text-[#1C4D8D] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Governor&apos;s Drive, Sampaloc 1, City of Dasmariñas, Cavite 4114
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail size={16} className="text-[#1C4D8D] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-900">Main Contact:</strong>{' '}
                    <a
                      href="mailto:dpo@national-u.edu.ph"
                      className="text-[#1C4D8D] hover:text-[#163a6b] underline underline-offset-2"
                    >
                      dpo@national-u.edu.ph
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail size={16} className="text-[#1C4D8D] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-900">Campus Contact:</strong>{' '}
                    <a
                      href="mailto:cop@nu-dasma.edu.ph"
                      className="text-[#1C4D8D] hover:text-[#163a6b] underline underline-offset-2"
                    >
                      cop@nu-dasma.edu.ph
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-3 pb-4">
            <h2 className="text-base font-bold text-slate-900">9. Full Data Privacy Policy</h2>
            <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
              For the complete National University Data Privacy Policy, including contact details for
              the Data Protection Officer, please visit{' '}
              <a
                href={NU_PRIVACY_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1C4D8D] hover:text-[#163a6b] underline underline-offset-2 inline-flex items-center gap-1"
              >
                National University Data Privacy Policy
                <ExternalLink size={13} className="shrink-0" aria-hidden="true" />
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-8 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#1C4D8D] focus:ring-[#1C4D8D] focus:ring-2"
            />
            <span className="text-sm text-slate-700 leading-snug">
              I have read and agree to the{' '}
              <a
                href={NU_PRIVACY_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#1C4D8D] hover:text-[#163a6b] underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                Data Privacy Policy
              </a>
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
            {onDecline ? (
              <button
                type="button"
                onClick={onDecline}
                className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <Link
                to="/"
                className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </Link>
            )}
            <button
              type="button"
              onClick={onAccept}
              disabled={!canAccept}
              className="min-h-[44px] min-w-[140px] rounded-full bg-[#5B9BD5] px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-[#4a8bc4] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:text-slate-500"
              title={
                !hasScrolledToBottom
                  ? 'Scroll to the bottom of the notice to continue'
                  : !hasAgreed
                    ? 'Check the agreement box to continue'
                    : undefined
              }
            >
              I Accept
            </button>
          </div>
        </div>

        {!hasScrolledToBottom && (
          <p className="mx-auto mt-3 max-w-4xl text-xs text-slate-500 flex items-center gap-1.5">
            <Shield size={12} className="text-[#1C4D8D]" aria-hidden="true" />
            Scroll through the entire notice to enable acceptance.
          </p>
        )}
      </footer>
    </div>
  );
};

export default PrivacyNoticeGate;
