import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/services/apiClient";
import { Eye, Save, Send } from "lucide-react";

const CATEGORIES = [
  "Compliance", "HRMS", "Immigration", "Legal", "Operations", "Safety", "Technology",
];

export default function BlogEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "",
    heroImage: "",
    author: "",
    published: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    apiClient.get(`/Api/Blog/Admin/All`).then((res) => {
      const all: any[] = Array.isArray(res.data) ? res.data : [];
      const post = all.find((p) => String(p.Id) === id);
      if (post) {
        setForm({
          title: post.Title ?? "",
          excerpt: post.Excerpt ?? "",
          content: post.Content ?? "",
          category: post.Category ?? "",
          heroImage: post.Hero_Image ?? "",
          author: post.Author ?? "",
          published: post.Published ?? false,
        });
        setSavedSlug(post.Slug ?? null);
      } else {
        toast.error("Post not found");
        navigate("/blog");
      }
      setLoading(false);
    }).catch(() => { toast.error("Failed to load post"); setLoading(false); });
  }, [id, isEdit, navigate]);

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, published: publish };
      if (isEdit) {
        const res = await apiClient.put(`/Api/Blog/${id}`, payload);
        setSavedSlug(res.data?.Slug ?? savedSlug);
        toast.success(publish ? "Post published" : "Draft saved");
      } else {
        const res = await apiClient.post("/Api/Blog/Create", payload);
        setSavedSlug(res.data?.Slug ?? null);
        toast.success(publish ? "Post published" : "Draft saved");
        navigate(`/blog/editor/${res.data?.Id}`, { replace: true });
      }
      setForm((p) => ({ ...p, published: publish }));
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground p-6">Loading…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold">{isEdit ? "Edit Post" : "New Blog Post"}</h1>
          <div className="flex gap-2">
            {savedSlug && (
              <Button variant="outline" size="sm" onClick={() => window.open(`/blog/${savedSlug}`, "_blank")}>
                <Eye className="w-4 h-4 mr-1" /> Preview
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => handleSave(false)}>
              <Save className="w-4 h-4 mr-1" /> Save Draft
            </Button>
            <Button size="sm" disabled={saving} onClick={() => handleSave(true)}>
              <Send className="w-4 h-4 mr-1" /> Publish
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Post title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full text-sm bg-background border border-input rounded-md px-3 py-2"
              >
                <option value="">— Select —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Author</Label>
              <Input
                value={form.author}
                onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                placeholder="MWMS Editorial"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Hero Image URL</Label>
            <Input
              value={form.heroImage}
              onChange={(e) => setForm((p) => ({ ...p, heroImage: e.target.value }))}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Excerpt <span className="text-muted-foreground text-xs">({form.excerpt.length}/160)</span></Label>
            <Textarea
              value={form.excerpt}
              onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value.slice(0, 160) }))}
              placeholder="Short description shown in the blog list"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Write your article here…"
              rows={18}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pb-4">
          <Button variant="ghost" onClick={() => navigate("/blog")}>← Back to Blog</Button>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={saving} onClick={() => handleSave(false)}>
              <Save className="w-4 h-4 mr-1" /> Save Draft
            </Button>
            <Button disabled={saving} onClick={() => handleSave(true)}>
              <Send className="w-4 h-4 mr-1" /> Publish
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
