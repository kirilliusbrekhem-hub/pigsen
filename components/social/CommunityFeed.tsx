"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { KIND_IDS, POST_KINDS, POST_TOPICS, TOPIC_IDS, type PostKind, type PostTopic } from "@/lib/social/meta";
import type { PostView } from "@/lib/social/service";

const MAX = 1000;
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Composer({ parentId, onDone, placeholder, initialText = "", autoFocus }: { parentId?: string; onDone: (p: PostView) => void; placeholder: string; initialText?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(initialText);
  const [kind, setKind] = useState<PostKind>("win");
  const [topic, setTopic] = useState<PostTopic>("business");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ post: PostView }>("/api/community", { method: "POST", body: parentId ? { text, parentId } : { text, kind, topic } });
      setText("");
      onDone(r.post);
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="cm-composer" onSubmit={submit}>
      {!parentId && (
        <div className="cm-chips" role="group" aria-label="Тип поста">
          {KIND_IDS.map((k) => (
            <button type="button" key={k} className={`cm-chip ${kind === k ? "is-on" : ""}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
              {POST_KINDS[k]}
            </button>
          ))}
        </div>
      )}
      <textarea className="input textarea" maxLength={MAX} value={text} autoFocus={autoFocus} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <div className="cm-composer-row">
        {!parentId && (
          <select className="input cm-select" value={topic} onChange={(e) => setTopic(e.target.value as PostTopic)} aria-label="Тема">
            {TOPIC_IDS.map((t) => (
              <option key={t} value={t}>{POST_TOPICS[t]}</option>
            ))}
          </select>
        )}
        <span className="muted">{text.length}/{MAX}</span>
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
          <Icon name="send" size="sm" /> {parentId ? "Ответить" : "Опубликовать"}
        </button>
      </div>
    </form>
  );
}

function Author({ p, interactive }: { p: PostView; interactive: boolean }) {
  const [open, setOpen] = useState(false);
  if (!interactive) return <b>{p.author.name}</b>;
  return (
    <span className="cm-author">
      <button type="button" className="cm-author-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{p.author.name}</button>
      {open && (
        <span className="cm-author-menu">
          <Link href={`/messages/${p.author.id}`} className="btn btn-secondary btn-sm"><Icon name="message" size="sm" /> Написать</Link>
        </span>
      )}
    </span>
  );
}

export function PostBody({ p, onDelete, onLike, onReply, me }: { p: PostView; onDelete?: () => void; onLike?: () => void; onReply?: () => void; me?: string }) {
  return (
    <div className="cm-post-main">
      <Avatar name={p.author.name} src={p.author.avatar} className="cm-av" />
      <div className="cm-post-content">
        <div className="cm-meta">
          <Author p={p} interactive={!!onLike && p.author.id !== me} />
          {p.author.pro && <span className="pro-badge">Pro</span>}
          {p.author.title && <span className="cm-title">{p.author.title}</span>}
          <time className="muted" dateTime={p.createdAt}>{when(p.createdAt)}</time>
          {onDelete && p.canDelete && (
            <button className="cm-del" onClick={onDelete} aria-label="Удалить" title="Удалить">
              <Icon name="trash" size="sm" />
            </button>
          )}
        </div>
        {p.topic && (
          <div className="cm-tags">
            <span className={`cm-kind cm-kind-${p.kind}`}>{POST_KINDS[p.kind]}</span>
            <span className="cm-topic">{POST_TOPICS[p.topic]}</span>
          </div>
        )}
        <p className="cm-text">{p.text}</p>
        {onLike && (
          <div className="cm-actions">
            <button type="button" className={`cm-like ${p.liked ? "is-on" : ""}`} onClick={onLike} aria-pressed={p.liked} aria-label="Нравится">
              <Icon name="heart" size="sm" /> {p.likes}
            </button>
            {onReply && (
              <button type="button" className="cm-act" onClick={onReply}>Ответить</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Post({ post, me, onRemove }: { post: PostView; me: string; onRemove: () => void }) {
  const [p, setP] = useState(post);
  const [open, setOpen] = useState(post.replies.length > 0 && post.replies.length <= 3);
  const [reply, setReply] = useState<{ prefix: string; n: number } | null>(null);
  const toast = useToast();
  const n = useRef(0);
  async function del(id: string) {
    if (!confirm("Удалить сообщение?")) return;
    try {
      await api(`/api/community/${id}`, { method: "DELETE" });
      if (id === p.id) onRemove();
      else setP((x) => ({ ...x, replyCount: x.replyCount - 1, replies: x.replies.filter((r) => r.id !== id) }));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    }
  }
  async function like(id: string) {
    try {
      const r = await api<{ liked: boolean; count: number }>(`/api/community/${id}/like`, { method: "POST" });
      const upd = (x: PostView) => (x.id === id ? { ...x, liked: r.liked, likes: r.count } : x);
      setP((x) => ({ ...upd(x), replies: x.replies.map(upd) }));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    }
  }
  const startReply = (prefix: string) => {
    n.current += 1;
    setOpen(true);
    setReply({ prefix, n: n.current });
  };
  return (
    <article className="card card-pad cm-post" data-testid="community-post">
      <PostBody p={p} me={me} onDelete={() => del(p.id)} onLike={() => like(p.id)} onReply={() => startReply("")} />
      {p.replyCount > 0 && (
        <button type="button" className="cm-act cm-count" onClick={() => setOpen((o) => !o)}>
          <Icon name="message" size="sm" /> {p.replyCount} {open ? "· скрыть" : "· показать ответы"}
        </button>
      )}
      {open && p.replies.length > 0 && (
        <div className="cm-replies">
          {p.replies.map((r) => (
            <PostBody key={r.id} p={r} me={me} onDelete={() => del(r.id)} onLike={() => like(r.id)} onReply={() => startReply(`@${r.author.name} `)} />
          ))}
        </div>
      )}
      {reply && (
        <Composer
          key={reply.n}
          autoFocus
          parentId={p.id}
          initialText={reply.prefix}
          placeholder="Ваш ответ"
          onDone={(r) => {
            setP((x) => ({ ...x, replyCount: x.replyCount + 1, replies: [...x.replies, r] }));
            setReply(null);
          }}
        />
      )}
    </article>
  );
}

type Filters = { kind: PostKind | ""; topic: PostTopic | ""; sort: "new" | "top" };

export function CommunityFeed({ initial, next: initialNext, me }: { initial: PostView[]; next: string | null; me: string }) {
  const [posts, setPosts] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState<Filters>({ kind: "", topic: "", sort: "new" });
  const toast = useToast();
  const qs = (x: Filters, before?: string) => new URLSearchParams({ ...(x.kind ? { kind: x.kind } : {}), ...(x.topic ? { topic: x.topic } : {}), sort: x.sort, ...(before ? { before } : {}) }).toString();
  async function load(x: Filters, before?: string) {
    setLoading(true);
    try {
      const r = await api<{ posts: PostView[]; next: string | null }>(`/api/community?${qs(x, before)}`);
      setPosts((p) => (before ? [...p, ...r.posts] : r.posts));
      setNext(r.next);
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setLoading(false);
    }
  }
  function change(patch: Partial<Filters>) {
    const x = { ...f, ...patch };
    setF(x);
    void load(x);
  }
  return (
    <div className="stack cm-feed">
      <div className="card card-pad">
        <Composer placeholder="Поделитесь успехом, вопросом или идеей" onDone={(p) => setPosts((list) => [p, ...list])} />
      </div>
      <div className="cm-filters">
        <div className="cm-chips" role="group" aria-label="Сортировка">
          <button className={`cm-chip ${f.sort === "new" ? "is-on" : ""}`} onClick={() => change({ sort: "new" })}>Новые</button>
          <button className={`cm-chip ${f.sort === "top" ? "is-on" : ""}`} onClick={() => change({ sort: "top" })}>Популярные за неделю</button>
        </div>
        <div className="cm-chips" role="group" aria-label="Тип">
          <button className={`cm-chip ${!f.kind ? "is-on" : ""}`} onClick={() => change({ kind: "" })}>Все</button>
          {KIND_IDS.map((k) => (
            <button key={k} className={`cm-chip ${f.kind === k ? "is-on" : ""}`} onClick={() => change({ kind: k })}>{POST_KINDS[k]}</button>
          ))}
        </div>
        <div className="cm-chips" role="group" aria-label="Тема">
          <button className={`cm-chip ${!f.topic ? "is-on" : ""}`} onClick={() => change({ topic: "" })}>Все темы</button>
          {TOPIC_IDS.map((t) => (
            <button key={t} className={`cm-chip ${f.topic === t ? "is-on" : ""}`} onClick={() => change({ topic: t })}>{POST_TOPICS[t]}</button>
          ))}
        </div>
      </div>
      <p className="muted cm-hint">Пост набрал 5 лайков — автор получает +10 PigCoin$.</p>
      {posts.length === 0 && !loading && <p className="muted cm-empty">Пока тихо. Напишите первый пост!</p>}
      {posts.map((p) => (
        <Post key={p.id} post={p} me={me} onRemove={() => setPosts((list) => list.filter((x) => x.id !== p.id))} />
      ))}
      {next && (
        <button className="btn btn-secondary" onClick={() => load(f, next)} disabled={loading}>
          {loading ? "Загрузка…" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
