import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-[#9BA3AE] mb-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Effective Date: February 9, 2026 &middot; Last Updated: February 9, 2026
        </p>

        <div className="space-y-10">
          {/* 1. About the Service */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              1. About the Service
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>Survive the Dance (&quot;the Platform&quot;) is a free, entertainment-only survivor pool game for the NCAA Men&apos;s Basketball Tournament, operated by Farrar Analytics LLC (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;).</p>
              <p>This Platform involves no real money wagering. We do not accept, hold, process, or facilitate any financial transactions, entry fees, prize pools, or monetary exchanges of any kind. Any off-platform financial arrangements between users are entirely outside our scope, not facilitated or endorsed by us, and are the sole responsibility of the parties involved.</p>
            </div>
          </section>

          {/* 2. Eligibility */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              2. Eligibility
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>You must be at least 13 years of age to create an account on the Platform. If you are under the age of 18, you must have the consent of a parent or legal guardian to use the Platform.</p>
            </div>
          </section>

          {/* 3. User Accounts */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              3. User Accounts
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>Each person may create only one account. You are responsible for maintaining the security of your account credentials. Creating multiple accounts for the purpose of gaining an unfair advantage in pools is prohibited and may result in account termination.</p>
            </div>
          </section>

          {/* 4. Pool Participation */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              4. Pool Participation
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>Users may create and join pools using unique join codes. Pool creators set the rules for their pools, including maximum players and entries per player. Pool creators do not represent Farrar Analytics LLC in any capacity.</p>
              <p>Failure to submit a pick before the round deadline results in automatic elimination from the pool. It is each player&apos;s responsibility to submit their picks on time.</p>
            </div>
          </section>

          {/* 5. Prohibited Conduct */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              5. Prohibited Conduct
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>You agree not to use the Platform for any illegal purpose or in violation of any applicable laws or regulations. You may not attempt to gain unauthorized access to the Platform, other user accounts, or any systems or networks connected to the Platform.</p>
              <p>The use of bots, scripts, or automated tools to interact with the Platform is prohibited. You may not harass, abuse, or threaten other users, impersonate any person or entity, or reverse engineer any aspect of the Platform.</p>
              <p>You may not use the Platform to facilitate real money gambling in jurisdictions where such activity is prohibited by law.</p>
            </div>
          </section>

          {/* 6. Third-Party Data */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              6. Third-Party Data
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>The Platform relies on ESPN and other third-party sources for game data, scores, and schedules. We do not guarantee the accuracy or timeliness of this data. ESPN is not affiliated with, endorsing, or sponsoring the Platform in any way.</p>
              <p>Win probability percentages and other statistical estimates displayed on the Platform are for entertainment purposes only and should not be relied upon for any other purpose.</p>
            </div>
          </section>

          {/* 7. No Warranties */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              7. No Warranties
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We make no guarantee of uptime, accuracy, completeness, or real-time updates. We may modify, suspend, or discontinue the Platform at any time without notice.</p>
            </div>
          </section>

          {/* 8. Limitation of Liability */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              8. Limitation of Liability
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>To the maximum extent permitted by law, Farrar Analytics LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Platform. This includes, without limitation, damages arising from incorrect game results, platform downtime, data loss, or any off-platform financial losses.</p>
              <p>Our total aggregate liability for any claims arising out of or related to the Platform shall not exceed fifty dollars ($50 USD).</p>
            </div>
          </section>

          {/* 9. Intellectual Property */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              9. Intellectual Property
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>All content, design, code, and branding on the Platform is the property of Farrar Analytics LLC. You may not reproduce, distribute, or create derivative works from any Platform content without our express written permission.</p>
              <p>NCAA, March Madness, and ESPN are trademarks of their respective owners and are used on this Platform for identification purposes only. The Platform is not affiliated with, endorsed by, or sponsored by the NCAA or ESPN.</p>
            </div>
          </section>

          {/* 10. Account Termination */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              10. Account Termination
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our sole discretion. Users may request account deletion by contacting us at <a href="mailto:info@survivethedance.com" className="text-[#FF5722] hover:underline">info@survivethedance.com</a>.</p>
            </div>
          </section>

          {/* 11. Changes to Terms */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              11. Changes to Terms
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>We may update these Terms of Service at any time. Material changes will be communicated via notice on the Platform or by email. Your continued use of the Platform after such changes constitutes your acceptance of the updated Terms.</p>
            </div>
          </section>

          {/* 12. Governing Law */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              12. Governing Law
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>These Terms shall be governed by and construed in accordance with the laws of the State of Idaho, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in Ada County, Idaho.</p>
            </div>
          </section>

          {/* 13. Contact */}
          <section>
            <h2 className="text-xl font-bold text-[#E8E6E1] mb-4" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>
              13. Contact
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
