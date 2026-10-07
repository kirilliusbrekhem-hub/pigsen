import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { ProPromo } from "@/components/pro/ProPromo";
import { PremiumLock } from "@/components/pro/PremiumLock";
import { CommunityFeed, PostBody } from "@/components/social/CommunityFeed";
import { listPosts } from "@/lib/social/service";
import { CommunityTabs } from "@/components/social/CommunityTabs";

export const metadata: Metadata = { title: "Комьюнити" };

export default async function CommunityPage() {
  const user = await requireUser();
  const pro = isPro(user.profile);
  const { posts, next } = await listPosts(user, pro ? {} : { take: 3 });
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Комьюнити Pro</span>
          <h1>Лента успехов</h1>
          <p>Делитесь результатами, задавайте вопросы и помогайте другим. Будьте вежливы: без спама, рекламы и финансовых «сигналов». <a href="/rules">Правила комьюнити</a>.</p>
        </div>
      </section>
      <CommunityTabs active="feed" />
      {pro ? (
        <CommunityFeed initial={posts} next={next} me={user.id} />
      ) : (
        <div className="stack">
          <ProPromo place="community" />
          <div className="cm-teaser" aria-hidden="true">
            {posts.length ? (
              posts.map((p) => (
                <div key={p.id} className="card card-pad cm-post">
                  <PostBody p={{ ...p, canDelete: false }} />
                </div>
              ))
            ) : (
              <div className="card card-pad cm-post">Здесь обсуждают инвестиции, запуск бизнеса и первые продажи.</div>
            )}
          </div>
          <PremiumLock what="раздел" />
        </div>
      )}
    </>
  );
}
