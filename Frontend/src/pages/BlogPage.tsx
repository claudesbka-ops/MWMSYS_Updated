import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { blogPosts, findBlogPost, type BlogBlock } from "@/data/blogPosts";
import { ArrowLeft, Calendar, Clock, User as UserIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { apiClient, getAccessToken } from "@/services/apiClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function decodeRole(token: string): string {
  try {
    const p = token.split(".")[1];
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.appRole ?? "";
  } catch { return ""; }
}

function useIsAdmin() {
  const token = getAccessToken();
  return token ? decodeRole(token) === "admin" : false;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch { return iso; }
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "h2":
      return <h2 className="text-2xl font-bold text-foreground mt-10 mb-3">{block.text}</h2>;
    case "h3":
      return <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">{block.text}</h3>;
    case "p":
      return <p className="text-foreground/85 leading-7 mb-4">{block.text}</p>;
    case "ul":
      return (
        <ul className="list-disc list-outside pl-6 space-y-2 mb-5 text-foreground/85">
          {block.items.map((item, i) => <li key={i} className="leading-7">{item}</li>)}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="my-6 rounded-xl border-l-4 border-primary/60 bg-primary/5 px-5 py-4">
          <p className="text-foreground italic leading-7">&ldquo;{block.text}&rdquo;</p>
          {block.cite && <footer className="mt-2 text-xs text-muted-foreground">— {block.cite}</footer>}
        </blockquote>
      );
    default: return null;
  }
}

type ApiPost = {
  Id: number; Slug: string; Title: string; Excerpt: string;
  Category: string; Hero_Image: string; Author: string; Published_At: string;
  Published?: boolean;
};

function toBlogCard(p: ApiPost) {
  return {
    id: p.Id,
    slug: p.Slug,
    title: p.Title,
    description: p.Excerpt,
    heroImage: p.Hero_Image || "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
    author: p.Author,
    publishedAt: p.Published_At,
    readingMinutes: 5,
  };
}

function BlogIndex() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [apiPosts, setApiPosts] = useState<ApiPost[] | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Blog — MWMS";
    if (getAccessToken()) {
      apiClient.get<ApiPost[]>("/Api/Blog/Admin/All").then((r) => {
        if (Array.isArray(r.data) && r.data.length > 0) setApiPosts(r.data);
      }).catch(() => {
        apiClient.get<ApiPost[]>("/Api/Blog").then((r) => {
          if (Array.isArray(r.data)) setApiPosts(r.data);
        }).catch(() => {});
      });
    }
  }, []);

  const staticFallback = useMemo(
    () => [...blogPosts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)),
    []
  );

  const posts = apiPosts !== null
    ? apiPosts.filter((p) => p.Published !== false).sort((a, b) =>
        (a.Published_At ?? "") < (b.Published_At ?? "") ? 1 : -1
      ).map(toBlogCard)
    : staticFallback.map((p) => ({ ...p, id: undefined as any }));

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Unpublish this post?")) return;
    setDeleting(id);
    try {
      await apiClient.delete(`/Api/Blog/${id}`);
      setApiPosts((prev) => prev ? prev.map((p) => p.Id === id ? { ...p, Published: false } : p) : prev);
      toast.success("Post unpublished");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MWMS Blog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance briefings and operational guidance for migrant worker programmes in Malaysia.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate("/blog/editor")}>
            <Plus className="w-4 h-4 mr-1" /> New Post
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <div key={post.slug} className="relative group">
            <Link
              to={`/blog/${post.slug}`}
              className="group bg-card rounded-2xl border border-border/60 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src={post.heroImage}
                  alt={post.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{post.description}</p>
                <div className="mt-auto pt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{formatDate(post.publishedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />{post.readingMinutes} min read
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />{post.author}
                  </span>
                </div>
              </div>
            </Link>
            {isAdmin && post.id && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); navigate(`/blog/editor/${post.id}`); }}
                  className="p-1.5 rounded-lg bg-background/90 border border-border/60 hover:bg-muted"
                  title="Edit"
                ><Pencil className="w-3.5 h-3.5" /></button>
                <button
                  onClick={(e) => handleDelete(post.id!, e)}
                  disabled={deleting === post.id}
                  className="p-1.5 rounded-lg bg-background/90 border border-border/60 hover:bg-destructive/10 hover:text-destructive"
                  title="Unpublish"
                ><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function BlogArticle({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [apiPost, setApiPost] = useState<any | null>(null);
  const staticPost = findBlogPost(slug);

  useEffect(() => {
    apiClient.get(`/Api/Blog/${slug}`).then((r) => setApiPost(r.data)).catch(() => {});
  }, [slug]);

  const post = apiPost ?? staticPost;

  useEffect(() => {
    if (post) document.title = `${(post.Title ?? post.title)} — MWMS Blog`;
  }, [post]);

  if (!post) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-16">
          <h1 className="text-xl font-bold text-foreground">Article not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The blog post you were looking for does not exist or has been moved.
          </p>
          <button
            onClick={() => navigate("/blog")}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const title = post.Title ?? post.title;
  const description = post.Excerpt ?? post.description;
  const heroImage = post.Hero_Image ?? post.heroImage;
  const author = post.Author ?? post.author;
  const publishedAt = post.Published_At ?? post.publishedAt;
  const readingMinutes = post.Reading_Minutes ?? post.readingMinutes ?? 5;
  const body: BlogBlock[] | null = post.body ?? null;
  const contentText: string | null = post.Content ?? null;

  return (
    <DashboardLayout>
      <article className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </Link>
          {isAdmin && post.Id && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/blog/editor/${post.Id}`)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Post
            </Button>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden border border-border/60 bg-card mb-8">
          <div className="relative aspect-[16/8] w-full">
            <img src={heroImage} alt={title} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">{title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b border-border/50 pb-5">
          <span className="inline-flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" />{author}</span>
          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(publishedAt)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{readingMinutes} min read</span>
        </div>

        <div className="mt-6">
          {body
            ? body.map((block, i) => <Block key={i} block={block} />)
            : contentText
              ? <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-foreground/85 leading-7">{contentText}</div>
              : null
          }
        </div>
      </article>
    </DashboardLayout>
  );
}

export default function BlogPage() {
  const { slug } = useParams<{ slug?: string }>();
  if (slug) return <BlogArticle slug={slug} />;
  return <BlogIndex />;
}
