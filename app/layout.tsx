// Build: 2026-06-14 — sakura redesign
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import FooterNewsletter from "@/components/FooterNewsletter";
import SocialLinks from "@/components/SocialLinks";
import OutboundTracker from "@/components/OutboundTracker";
import HamburgerMenu from "@/components/HamburgerMenu";
import NavSearch from "@/components/NavSearch";
import FanChatbox from "@/components/FanChatbox";
import { LangProvider, T } from "@/components/LangProvider";
import { getSession } from "@/lib/auth";
import { hasAegyoAccountSession } from "@/lib/chat-policy";
import Script from "next/script";
import Image from "next/image";
import { Cormorant_Garamond, DM_Sans, Space_Mono } from "next/font/google";

// Self-hosted, preloaded fonts — replaces the render-blocking CSS @import chain
// to fonts.googleapis.com. Exposed as CSS variables consumed by globals.css.
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], display: "swap", variable: "--font-serif" });
const sans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aegyoarena.com"),
  title: "Aegyo Arena — K-pop Lyrics & Fan Wiki",
  description: "K-pop lyrics, translations, and fan annotations",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const isLoggedIn  = !!session;
  const displayName = session?.user.displayName ?? session?.user.email.split("@")[0];
  const userId      = session?.user.id;

  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      {/* sans.className on <body> makes DM Sans (the dominant body font) an
          actually-applied font so next/font preloads it, not just self-hosts it. */}
      <body className={sans.className}>
        {/* One EN/ES language state for the whole site (persisted; ES-default for es-* browsers). */}
        <LangProvider>
        {/* Site-wide outbound-click analytics (social_click / outbound_click). */}
        <OutboundTracker />
        <nav className="genius-nav" style={{ position: "sticky", top: 0, zIndex: 100 }}>
          {/* Primary row: logo + search + hamburger */}
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", gap: 20, height: 64 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", flexShrink: 0, textDecoration: "none" }}>
              <Image src="/images/aegyo-logo.png" alt="Aegyo Arena" width={130} height={34} priority style={{ height: 34, width: "auto", display: "block" }} />
            </Link>

            <NavSearch />

            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
              <HamburgerMenu
                isLoggedIn={isLoggedIn}
                displayName={displayName}
                userId={userId}
              />
            </div>
          </div>
        </nav>
        {children}
        <footer style={{ background: "var(--bg-card)", color: "var(--ink-dim)", marginTop: 80, borderTop: "1px solid var(--border)" }}>
          {/* Newsletter strip */}
          <div style={{ borderBottom: "1px solid var(--border)", padding: "56px 24px 48px" }}>
            <FooterNewsletter />
          </div>

          {/* Footer links */}
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 36px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48 }} className="footer-top-grid">
            <div>
              <Link href="/" style={{ display: "inline-block", marginBottom: 16 }}>
                <Image src="/images/aegyo-logo-footer.png" alt="Aegyo Arena" width={113} height={34} style={{ height: 34, width: "auto", display: "block" }} />
              </Link>
              <div style={{ fontSize: "1rem", fontWeight: 300, lineHeight: 1.7, color: "var(--ink-faint)", maxWidth: 240, marginBottom: 22 }}>
                <T
                  en="K-pop mini games, slang dictionary, and fan wiki. Fan-made and fandom-powered."
                  es="Minijuegos de K-pop, diccionario de jerga y wiki de fans. Hecho por fans, impulsado por el fandom."
                />
              </div>
              <SocialLinks />
            </div>
            {/* [label, href, labelEs] — label stays the canonical EN key, labelEs is display-only. */}
            <div>
              <div className="footer-col-title"><T en="Discover" es="Descubre" /></div>
              {[["Artists", "/artists", "Artistas"], ["Collaborations", "/collabs", "Colaboraciones"], ["Signals", "/news", "Señales"], ["Slang", "/korean-slang", "Jerga"], ["Cities", "/cities", "Ciudades"], ["Events", "/events", "Eventos"], ["Search", "/search", "Buscar"]].map(([label, href, labelEs]) => (
                <Link key={href} href={href} style={{ display: "block", fontSize: "1rem", fontWeight: 300, color: "var(--ink-dim)", textDecoration: "none", marginBottom: 10 }}>
                  <T en={label} es={labelEs} />
                </Link>
              ))}
            </div>
            <div>
              {/* "Culture Vulture" is a brand name — stays EN. */}
              <div className="footer-col-title">Culture Vulture</div>
              {/* Arcade is a separate subdomain app, so a plain <a>, not next/link. */}
              <a href="https://arcade.aegyoarena.com" style={{ display: "block", fontSize: "1rem", fontWeight: 700, color: "var(--sakura)", textDecoration: "none", marginBottom: 10 }}>
                🕹 Arcade
              </a>
              {[["Dance", "/culture/dance", "Baile"], ["Fashion", "/culture/fashion", "Moda"], ["Beauty", "/culture/beauty", "Belleza"], ["Mukbang", "/culture/mukbang", "Mukbang"]].map(([label, href, labelEs]) => (
                <Link key={href} href={href} style={{ display: "block", fontSize: "1rem", fontWeight: 300, color: "var(--ink-dim)", textDecoration: "none", marginBottom: 10 }}>
                  <T en={label} es={labelEs} />
                </Link>
              ))}
            </div>
            <div>
              <div className="footer-col-title"><T en="Community" es="Comunidad" /></div>
              {[["Quiz", "/quiz", "Quiz"], ["Daebak Rewards", "/daebak-rewards", "Daebak Rewards"], ["Merch", "/merch", "Merch"], ["Leaderboard", "/leaderboard", "Ranking"], ["Contribute", "/contribute", "Contribuir"], ["Giveaways", "/giveaways", "Sorteos"]].map(([label, href, labelEs]) => (
                <Link key={label} href={href} style={{ display: "block", fontSize: "1rem", fontWeight: 300, color: "var(--ink-dim)", textDecoration: "none", marginBottom: 10 }}>
                  <T en={label} es={labelEs} />
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid var(--border)", maxWidth: 1240, margin: "0 auto", padding: "28px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: "0.78rem", color: "var(--ink-faint)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>
            <span>
              <T
                en={`© ${new Date().getFullYear()} Aegyo Arena · Fan-made K-pop resource · Not affiliated with any artist, label, or agency`}
                es={`© ${new Date().getFullYear()} Aegyo Arena · Recurso de K-pop hecho por fans · Sin afiliación con ningún artista, sello o agencia`}
              />
              {" · "}
              <Link href="/privacy-policy" style={{ color: "inherit", textDecoration: "underline" }}>
                <T en="Privacy Policy" es="Política de Privacidad" />
              </Link>
            </span>
            <span><T en="Made with ♡ by the fandom" es="Hecho con ♡ por el fandom" /></span>
          </div>
        </footer>
        {process.env.AEGYO_CHAT_ENABLED === "true" && <FanChatbox canPost={hasAegyoAccountSession(session)} signedIn={isLoggedIn} />}

        {/* Google Analytics (gtag.js) — site traffic + paid-ads/referral source tracking */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-700MXJM1FW" strategy="afterInteractive" />
        <Script id="ga4-gtag" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-700MXJM1FW');`}
        </Script>

        {/* Taboola Pixel — paid-ads conversion tracking (account 2066412) */}
        <Script id="taboola-tfa" strategy="lazyOnload">
          {`window._tfa = window._tfa || [];
window._tfa.push({notify: 'event', name: 'page_view', id: 2066412});
!function (t, f, a, x) {
  if (!document.getElementById(x)) {
    t.async = 1;t.src = a;t.id=x;f.parentNode.insertBefore(t, f);
  }
}(document.createElement('script'),
document.getElementsByTagName('script')[0],
'//cdn.taboola.com/libtrc/unip/2066412/tfa.js',
'tb_tfa_script');`}
        </Script>

        {/* Reddit Pixel — paid-ads conversion tracking (a2_j9m653pqhzu7) */}
        <Script id="reddit-pixel" strategy="lazyOnload">
          {`!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=a2_j9m653pqhzu7",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','a2_j9m653pqhzu7');rdt('track', 'PageVisit');`}
        </Script>

        {/* TikTok Pixel — paid-ads conversion tracking (D9AFTIJC77U1026600GG) */}
        <Script id="tiktok-pixel" strategy="lazyOnload">
          {`!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('D9AFTIJC77U1026600GG');
  ttq.page();
}(window, document, 'ttq');`}
        </Script>
        </LangProvider>
      </body>
    </html>
  );
}
