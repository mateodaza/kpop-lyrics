import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getRole, listUsersWithRoles } from "@/lib/access";
import { rankOf, RANK, ROLE_LABEL } from "@/lib/roles";
import { getModerationQueue, getModerationStats, type AnnRow } from "@/lib/community-db";
import AdminPortal from "@/components/AdminPortal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Aegyo Arena",
  robots: { index: false, follow: false },
};

function ser(a: AnnRow) {
  return { id: a.id, authorName: a.authorName, authorSlug: a.authorSlug, songTitle: a.songTitle, word: a.word, note: a.note, status: a.status, reviewedBy: a.reviewedBy, reviewedAt: a.reviewedAt ? new Date(a.reviewedAt).toISOString() : null };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <section style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "40px 24px 30px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 10 }}>Admin Portal</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2rem, 5vw, 2.6rem)", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Content moderation &amp; roles</h1>
        </div>
      </section>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 80px" }}>{children}</div>
    </main>
  );
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    return <Shell><p style={{ color: "var(--ink-dim)" }}>Please <Link href="/login" style={{ color: "var(--sakura)", fontWeight: 700 }}>sign in</Link> to access the admin portal.</p></Shell>;
  }
  const role = await getRole(session.user);
  if (rankOf(role) < RANK.moderator) {
    return (
      <Shell>
        <p style={{ color: "var(--ink-dim)" }}>
          Your role is <strong style={{ color: "var(--ink)" }}>{ROLE_LABEL[role]}</strong>. The moderation portal requires Moderator access or higher.
        </p>
        <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>If you should have access, ask an Admin to grant it.</p>
      </Shell>
    );
  }

  const canManageRoles = rankOf(role) >= RANK.admin;
  const [{ pending, recent }, stats, users] = await Promise.all([
    getModerationQueue(),
    getModerationStats(),
    canManageRoles ? listUsersWithRoles() : Promise.resolve([]),
  ]);

  return (
    <Shell>
      <p style={{ color: "var(--ink-dim)", fontSize: "0.92rem", marginTop: 0, marginBottom: 22 }}>
        Signed in as <strong style={{ color: "var(--ink)" }}>{session.user.displayName ?? session.user.email}</strong> · role <strong style={{ color: "var(--sakura)" }}>{ROLE_LABEL[role]}</strong>
      </p>
      <p><Link href="/admin/chat" style={{ color: "var(--sakura)" }}>Review fan chat →</Link></p>
      <AdminPortal
        stats={stats}
        pending={pending.map(ser)}
        recent={recent.map(ser)}
        users={users}
        canManageRoles={canManageRoles}
      />
    </Shell>
  );
}
