import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      <div className="max-w-[700px] mx-auto px-5 py-10">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-[#9BA3AE] hover:text-[#E8E6E1] transition-colors mb-8"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          Back to Home
        </Link>

        <h1
          className="text-3xl font-bold text-[#E8E6E1] mb-3"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm text-[#9BA3AE] mb-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Effective Date: February 9, 2026 &middot; Last Updated: February 9, 2026
        </p>

        <div className="space-y-10">
          {/* 1. Information We Collect */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              1. Information We Collect
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>When you use Survive the Dance (&quot;the Platform&quot;), operated by Farrar Analytics LLC (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;), we collect the following types of information:</p>
              <p><span className="text-[#E8E6E1]">Account Information:</span> Your email address and display name, provided when you create an account.</p>
              <p><span className="text-[#E8E6E1]">Pool Activity:</span> Pool names, entry names, picks you submit, and your survival status within pools.</p>
              <p><span className="text-[#E8E6E1]">Usage Data:</span> Pages visited and timestamps of your interactions with the Platform.</p>
              <p><span className="text-[#E8E6E1]">Device Information:</span> Browser type and operating system, collected automatically.</p>
              <p><span className="text-[#E8E6E1]">Log Data:</span> IP addresses and access times, collected automatically by our hosting infrastructure.</p>
              <p>We do <span className="text-[#E8E6E1]">not</span> collect payment information, financial data, Social Security numbers, government-issued identification, or biometric data.</p>
            </div>
          </section>

          {/* 2. How We Use Information */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              2. How We Use Information
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>We use the information we collect to create and maintain your account, operate the game (processing picks, eliminations, and standings), display your name to other pool members, send transactional emails related to your account, and improve the Platform&apos;s performance and security.</p>
              <p>We do <span className="text-[#E8E6E1]">not</span> use your information for advertising or to build marketing profiles. We do <span className="text-[#E8E6E1]">not</span> sell, rent, or trade your personal information to any third party.</p>
            </div>
          </section>

          {/* 3. Information Shared With Others */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              3. Information Shared With Others
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p><span className="text-[#E8E6E1]">Within the Platform:</span> Other pool members can see your display name, entry names, picks (after the round deadline has passed), survival status, and pick history. They cannot see your email address, account settings, or which other pools you belong to.</p>
              <p><span className="text-[#E8E6E1]">Service Providers:</span> We use the following third-party services to operate the Platform: Supabase (database and authentication), Vercel (hosting and deployment), and Resend (email delivery). We also retrieve game data from ESPN. We do not send any user data to ESPN.</p>
              <p><span className="text-[#E8E6E1]">Legal Requirements:</span> We may disclose your information if required to do so by law, court order, or governmental regulation.</p>
            </div>
          </section>

          {/* 4. Data Storage and Security */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              4. Data Storage and Security
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>Your data is stored in Supabase cloud infrastructure with encryption at rest and in transit. We implement row-level security policies to ensure users can only access data they are authorized to view. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.</p>
            </div>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              5. Data Retention
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>We retain your personal information for as long as your account remains active. Upon account deletion, your personal information will be removed within 30 days. Anonymized aggregate data (such as total player counts or game statistics) may be retained indefinitely.</p>
            </div>
          </section>

          {/* 6. Your Rights */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              6. Your Rights
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>You have the right to access, correct, delete, and export your personal data, as well as the right to object to processing. To exercise any of these rights, contact us at <a href="mailto:info@survivethedance.com" className="text-[#FF5722] hover:underline">info@survivethedance.com</a>. We will respond to your request within 30 days.</p>
            </div>
          </section>

          {/* 7. Children's Privacy */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              7. Children&apos;s Privacy
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>The Platform is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete that information promptly.</p>
            </div>
          </section>

          {/* 8. Cookies and Local Storage */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              8. Cookies and Local Storage
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>The Platform uses browser local storage solely to maintain your login session and remember your active pool selection. We do not use tracking cookies, third-party analytics cookies, or advertising cookies of any kind.</p>
            </div>
          </section>

          {/* 9. Do Not Track */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              9. Do Not Track
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>We do not track users across third-party websites. We do not engage in cross-site tracking. The Platform honors Do Not Track signals.</p>
            </div>
          </section>

          {/* 10. California Privacy Rights (CCPA) */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              10. California Privacy Rights (CCPA)
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>If you are a California resident, you have the right to know what personal information we collect about you, the right to request deletion of your personal information, the right to opt out of the sale of your personal information (we do not sell personal information), and the right to non-discrimination for exercising your privacy rights.</p>
            </div>
          </section>

          {/* 11. Changes to Policy */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              11. Changes to This Policy
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>We may update this Privacy Policy from time to time. Material changes will be communicated via notice on the Platform or by email. Your continued use of the Platform after such changes constitutes your acceptance of the updated policy.</p>
            </div>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              12. Contact
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>Farrar Analytics LLC</p>
              <p><a href="mailto:info@survivethedance.com" className="text-[#FF5722] hover:underline">info@survivethedance.com</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[rgba(255,255,255,0.05)]">
          <p className="text-center text-xs text-[#9BA3AE] opacity-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            &copy; 2026 Farrar Analytics LLC. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
