import { useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { blogPosts, findBlogPost, type BlogBlock } from "@/data/blogPosts";
import { ArrowLeft, Calendar, Clock, User as UserIcon } from "lucide-react";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
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
          {block.items.map((item, i) => (
            <li key={i} className="leading-7">
              {item}
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="my-6 rounded-xl border-l-4 border-primary/60 bg-primary/5 px-5 py-4">
          <p className="text-foreground italic leading-7">&ldquo;{block.text}&rdquo;</p>
          {block.cite ? (
            <footer className="mt-2 text-xs text-muted-foreground">— {block.cite}</footer>
          ) : null}
        </blockquote>
      );
    default:
      return null;
  }
}

function BlogIndex() {
  const sorted = useMemo(
    () => [...blogPosts].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)),
    []
  );

  useEffect(() => {
    document.title = "Blog — MWMS";
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">MWMS Blog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compliance briefings and operational guidance for migrant worker programmes in Malaysia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sorted.map((post) => (
          <Link
            key={post.slug}
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
                  <Calendar className="w-3 h-3" />
                  {formatDate(post.publishedAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {post.readingMinutes} min read
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {post.author}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
}

function BlogArticle({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const post = findBlogPost(slug);

  useEffect(() => {
    if (post) {
      document.title = `${post.title} — MWMS Blog`;
    }
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
            <ArrowLeft className="w-4 h-4" />
            Back to blog
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <article className="max-w-3xl mx-auto">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to blog
        </Link>

        <div className="rounded-2xl overflow-hidden border border-border/60 bg-card mb-8">
          <div className="relative aspect-[16/8] w-full">
            <img
              src={post.heroImage}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
          {post.title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{post.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b border-border/50 pb-5">
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5" />
            {post.author}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(post.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {post.readingMinutes} min read
          </span>
        </div>

        <div className="mt-6">
          {post.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
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
