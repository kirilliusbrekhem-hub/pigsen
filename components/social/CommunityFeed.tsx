"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import type { PostView } from "@/lib/social/service";

const MAX = 1000;
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Composer({ parentId, onDone, placeholder }: { parentId?: string; onDone: (p: PostView) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ post: PostView }>("/api/community", { method: "POST", body: { text, parentId } });
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
      <textarea className="input textarea" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <div className="cm-composer-row">
        <span className="muted">{text.length}/{MAX}</span>
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
          <Icon name="send" size="sm" /> {parentId ? "Ответить" : "Опубликовать"}
        </button>
      </div>
    </form>
  );
}

export function PostBody({ p, onDelete }: { p: PostView; onDelete?: () => void }) {
  return (
    <div className="cm-post-main">
      <Avatar name={p.author.name} src={p.author.avatar} className="cm-av" />
      <div className="cm-post-content">
        <div className="cm-meta">
          <b>{p.author.name}</b>
          {p.author.pro && <span className="pro-badge">Pro</span>}
          {p.author.title && <span className="cm-title">{p.author.title}</span>}
          <time className="muted" dateTime={p.createdAt}>{when(p.createdAt)}</time>
          {onDelete && p.canDelete && (
            <button className="cm-del" onClick={onDelete} aria-label="Удалить" title="Удалить">
              <Icon name="trash" size="sm" />
            </button>
          )}
        </div>
        <p className="cm-text">{p.text}</p>
      </div>
    </div>
  );
}

function Post({ post, onRemove }: { post: PostView; onRemove: () => void }) {
  const [replies, setReplies] = useState(post.replies);
  const [replying, setReplying] = useState(false);
  const toast = useToast();
  async function del(id: string) {
    if (!confirm("Удалить сообщение?")) return;
    try {
      await api(`/api/community/${id}`, { method: "DELETE" });
      if (id === post.id) onRemove();
      else setReplies((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    }
  }
  return (
    <article className="card card-pad cm-post" data-testid="community-post">
      <PostBody p={post} onDelete={() => del(post.id)} />
      {replies.length > 0 && (
        <div className="cm-replies">
          {replies.map((r) => (
            <PostBody key={r.id} p={r} onDelete={() => del(r.id)} />
          ))}
        </div>
      )}
      {replying ? (
        <Composer parentId={post.id} placeholder="Ваш ответ" onDone={(p) => { setReplies((r) => [...r, p]); setReplying(false); }} />
      ) : (
        <button className="btn btn-secondary btn-sm cm-reply-btn" onClick={() => setReplying(true)}>
          <Icon name="message" size="sm" /> Ответить
        </button>
      )}
    </article>
  );
}

export function CommunityFeed({ initial, next: initialNext }: { initial: PostView[]; next: string | null }) {
  const [posts, setPosts] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  async function more() {
    if (!next) return;
    setLoading(true);
    try {
      const r = await api<{ posts: PostView[]; next: string | null }>(`/api/community?before=${encodeURIComponent(next)}`);
      setPosts((p) => [...p, ...r.posts]);
      setNext(r.next);
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="stack cm-feed">
      <div className="card card-pad">
        <Composer placeholder="Поделитесь успехом, вопросом или идеей" onDone={(p) => setPosts((list) => [p, ...list])} />
      </div>
      {posts.length === 0 && <p className="muted cm-empty">Пока тихо. Напишите первый пост!</p>}
      {posts.map((p) => (
        <Post key={p.id} post={p} onRemove={() => setPosts((list) => list.filter((x) => x.id !== p.id))} />
      ))}
      {next && (
        <button className="btn btn-secondary" onClick={more} disabled={loading}>
          {loading ? "Загрузка…" : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
