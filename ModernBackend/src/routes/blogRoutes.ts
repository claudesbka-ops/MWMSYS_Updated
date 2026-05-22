import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { ensureBlogTable } from "../db/schemaMigrations";

export const blogRouter = Router();

async function slugify(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 180);
  const ts = Date.now();
  return `${base}-${ts}`;
}

// GET /Api/Blog — list published posts (public)
blogRouter.get("/Api/Blog", async (req, res, next) => {
  try {
    await ensureBlogTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "Id","Slug","Title","Excerpt","Category","Hero_Image","Author","Published_At","Reading_Minutes"
       FROM "Tbl_Blog_Post"
       WHERE "Published"=TRUE
       ORDER BY "Published_At" DESC
       LIMIT 50`
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});

// GET /Api/Blog/:slug — single post (public)
blogRouter.get("/Api/Blog/:slug", async (req, res, next) => {
  try {
    await ensureBlogTable();
    const slug = (req.params.slug ?? "").toString().trim();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Blog_Post" WHERE "Slug"=$1 AND "Published"=TRUE LIMIT 1`,
      slug
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// POST /Api/Blog/Create — Admin only
blogRouter.post("/Api/Blog/Create", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    if (Number(user?.roleId) !== 1) return res.status(403).json({ error: "Admin only" });

    await ensureBlogTable();

    const { title, excerpt, content, category, heroImage, author, published } = req.body ?? {};
    if (!title?.toString().trim()) return res.status(400).json({ error: "title is required" });

    const slug = await slugify(title.toString());
    const now = new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Tbl_Blog_Post"
         ("Slug","Title","Excerpt","Content","Category","Hero_Image","Author","Published","Published_At","Created_At","Updated_At")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      slug,
      title.toString().trim(),
      (excerpt ?? "").toString().trim(),
      (content ?? "").toString(),
      (category ?? "").toString().trim(),
      (heroImage ?? "").toString().trim(),
      (author ?? "").toString().trim(),
      published !== false,
      now,
      now,
      now
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Blog_Post" WHERE "Slug"=$1 LIMIT 1`, slug
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// PUT /Api/Blog/:id — Admin only
blogRouter.put("/Api/Blog/:id", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    if (Number(user?.roleId) !== 1) return res.status(403).json({ error: "Admin only" });

    await ensureBlogTable();

    const id = Number(req.params.id ?? 0);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const { title, excerpt, content, category, heroImage, author, published } = req.body ?? {};

    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Blog_Post"
       SET "Title"=COALESCE($1,"Title"),
           "Excerpt"=COALESCE($2,"Excerpt"),
           "Content"=COALESCE($3,"Content"),
           "Category"=COALESCE($4,"Category"),
           "Hero_Image"=COALESCE($5,"Hero_Image"),
           "Author"=COALESCE($6,"Author"),
           "Published"=COALESCE($7,"Published"),
           "Updated_At"=$8
       WHERE "Id"=$9`,
      title ? title.toString().trim() : null,
      excerpt != null ? excerpt.toString().trim() : null,
      content != null ? content.toString() : null,
      category != null ? category.toString().trim() : null,
      heroImage != null ? heroImage.toString().trim() : null,
      author != null ? author.toString().trim() : null,
      published != null ? Boolean(published) : null,
      new Date(),
      id
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Tbl_Blog_Post" WHERE "Id"=$1 LIMIT 1`, id
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (e) {
    return next(e);
  }
});

// DELETE /Api/Blog/:id — Admin only (soft delete: Published=false)
blogRouter.delete("/Api/Blog/:id", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    if (Number(user?.roleId) !== 1) return res.status(403).json({ error: "Admin only" });

    await ensureBlogTable();

    const id = Number(req.params.id ?? 0);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await prisma.$executeRawUnsafe(
      `UPDATE "Tbl_Blog_Post" SET "Published"=FALSE,"Updated_At"=$1 WHERE "Id"=$2`,
      new Date(), id
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// GET /Api/Blog/Admin/All — Admin only, includes unpublished
blogRouter.get("/Api/Blog/Admin/All", requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as any;
    if (Number(user?.roleId) !== 1) return res.status(403).json({ error: "Admin only" });

    await ensureBlogTable();

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "Id","Slug","Title","Excerpt","Category","Hero_Image","Author","Published","Published_At","Updated_At"
       FROM "Tbl_Blog_Post"
       ORDER BY "Updated_At" DESC
       LIMIT 100`
    );
    return res.json(rows);
  } catch (e) {
    return next(e);
  }
});
