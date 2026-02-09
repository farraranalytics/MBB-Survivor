import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
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
          className="text-3xl font-bold text-[#E8E6E1] mb-10"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          About Survive the Dance
        </h1>

        <div className="space-y-10">
          {/* What is it */}
          <section>
            <h2
              className="text-xl font-bold text-[#E8E6E1] mb-4"
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
            >
              What is Survive the Dance?
            </h2>
            <p className="text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Survive the Dance is a free survivor pool game for the NCAA Men&apos;s Basketball Tournament. Pick one team per round to win their game. If they win, you survive. If they lose, you&apos;re out. Each team can only be used once throughout the entire tournament. Last one standing wins.
            </p>
          </section>

          {/* How It Works */}
          <section>
            <h2
              className="text-xl font-bold text-[#E8E6E1] mb-4"
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
            >
              How It Works
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>1. Create or join a pool using a unique join code shared by the pool creator.</p>
              <p>2. Each round, pick one team to win their game before the deadline.</p>
              <p>3. If your team wins, you survive and move on to the next round.</p>
              <p>4. If your team loses or you forget to submit a pick before the deadline, you&apos;re eliminated from the pool.</p>
              <p>5. Each team can only be used once for the entire tournament, so choose wisely.</p>
              <p>6. The last player standing wins the pool.</p>
            </div>
          </section>

          {/* Who Built This */}
          <section>
            <h2
              className="text-xl font-bold text-[#E8E6E1] mb-4"
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
            >
              Who Built This?
            </h2>
            <p className="text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Survive the Dance was designed and built by <span className="text-[#E8E6E1]">Farrar Analytics LLC</span>, a data analytics and software consulting firm based in Boise, Idaho. We love basketball, data, and building things people enjoy.
            </p>
          </section>

          {/* Important Notes */}
          <section>
            <h2
              className="text-xl font-bold text-[#E8E6E1] mb-4"
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
            >
              Important Notes
            </h2>
            <div className="space-y-4 text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <p>Survive the Dance is completely free to play. We do not handle any real money transactions.</p>
              <p>We are not affiliated with the NCAA or ESPN. Game data is sourced from publicly available APIs.</p>
              <p>We don&apos;t sell your data or serve ads.</p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2
              className="text-xl font-bold text-[#E8E6E1] mb-4"
              style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
            >
              Contact
            </h2>
            <p className="text-[#9BA3AE] text-[15px] leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <a href="mailto:info@survivethedance.com" className="text-[#FF5722] hover:underline">info@survivethedance.com</a>
            </p>
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
