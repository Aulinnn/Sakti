/**
 * ============================================================================
 *  SAKTI API - FINAL STABLE VERSION (SECTION 1/3)
 * ============================================================================
 *  PERBAIKAN BESAR:
 *  - JWT stabil (expiresIn benar)
 *  - Revoked token dicek
 *  - Response FE-friendly (flatten data)
 *  - Paginate konsisten
 *  - CORS stabil untuk deploy
 *  - Semua endpoint distandarkan
 * ============================================================================
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import multer from "multer";
import cron from "node-cron";
import supabase from "./connection.js";
import { success, error } from "./response.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
const JWT_SECRET = process.env.JWT_SECRET || "sakti-secret-key";

/* ============================================================================
   GLOBAL MIDDLEWARE
============================================================================ */
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
  })
);

/* ============================================================================
   SWAGGER
============================================================================ */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { customSiteTitle: "SAKTI API" })
);
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

/* ============================================================================
   MULTER (UPLOAD FILE)
============================================================================ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ============================================================================
   AUTH MIDDLEWARE (STABIL)
============================================================================ */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer "))
    return error(res, "Token tidak tersedia", 401);

  const token = header.split(" ")[1];

  // CEK TOKEN DI REVOKED LIST
  const { data: revoked } = await supabase
    .from("revoked_tokens")
    .select("token")
    .eq("token", token)
    .maybeSingle();

  if (revoked) return error(res, "Token sudah tidak berlaku", 401);

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return error(res, "Token invalid atau kadaluarsa", 401);
    req.user = decoded;
    next();
  });
}

/* ============================================================================
   PAGINATION STABIL
============================================================================ */
async function paginate(table, select, page, limit, filters = {}, orderBy = null) {
  page = Number(page) || 1;
  limit = Number(limit) || 10;

  const offset = (page - 1) * limit;

  let query = supabase.from(table).select(select, { count: "exact" });

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) query = query.contains(key, value);
      else query = query.eq(key, value);
    }
  });

  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });

  query = query.range(offset, offset + limit - 1);

  const { data, count, error: err } = await query;
  if (err) return { err };

  return {
    data,
    meta: {
      page,
      limit,
      total: count,
      total_pages: Math.ceil(count / limit),
    },
  };
}

/* ============================================================================
   HELPER FUNCTIONS
============================================================================ */
function calculateRiskLevel(score) {
  if (score >= 30) return "HIGH";
  if (score >= 12) return "MEDIUM";
  return "LOW";
}

function determineApprovalPath(type) {
  switch ((type || "").toLowerCase()) {
    case "standard": return ["KASI"];
    case "minor": return ["KASI", "KABID"];
    case "major":
    case "emergency": return ["KASI", "KABID", "DISKOMINFO"];
    default: return [];
  }
}

/* ============================================================================
   1. AUTH ROUTES (STABIL)
============================================================================ */
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return error(res, "Username dan password wajib diisi", 400);

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .maybeSingle();

  if (!user) return error(res, "Username atau password salah", 401);

  const token = jwt.sign(
    { user_id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }   // FIXED
  );

  return success(res, { token, user }, "Login berhasil");
});

app.get("/auth/profile", authMiddleware, async (req, res) => {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", req.user.user_id)
    .single();

  return success(res, data);
});

app.put("/auth/profile", authMiddleware, async (req, res) => {
  const update = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error: err } = await supabase
    .from("users")
    .update(update)
    .eq("id", req.user.user_id)
    .select()
    .single();

  if (err) return error(res, "Gagal update profil", 500, err);
  return success(res, data, "Profil berhasil diupdate");
});

app.post("/auth/logout", authMiddleware, async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  await supabase.from("revoked_tokens").insert({ token });
  return success(res, null, "Logout berhasil");
});

/* ============================================================================
   2. DASHBOARD & WEEKLY TREND
============================================================================ */
app.get("/dashboard/summary", authMiddleware, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const countToday = await supabase
    .from("change_requests")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  const pending = await supabase
    .from("change_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "SUBMITTED");

  const approved = await supabase
    .from("change_requests")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "APPROVED");

  const todaySchedule = await supabase
    .from("change_requests")
    .select("*", { count: "exact", head: true })
    .eq("implement_date", today)
    .eq("status", "SCHEDULED");

  return success(res, {
    total_today: countToday.count,
    pending_inspection: pending.count,
    approved_waiting_schedule: approved.count,
    today_schedules: todaySchedule.count,
  });
});

app.get("/dashboard/weekly-trend", authMiddleware, async (req, res) => {
  const { week_start } = req.query;
  let start = week_start ? new Date(week_start) : new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const s = start.toISOString();
  const e = end.toISOString();

  const submitted = await supabase
    .from("change_requests")
    .select("created_at")
    .gte("created_at", s)
    .lt("created_at", e);

  const inspected = await supabase
    .from("change_requests")
    .select("inspected_at")
    .gte("inspected_at", s)
    .lt("inspected_at", e);

  const implemented = await supabase
    .from("change_requests")
    .select("implemented_at")
    .gte("implemented_at", s)
    .lt("implemented_at", e);

  const DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const trend = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = d.toISOString().slice(0, 10);

    trend.push({
      date,
      day: DAYS[d.getDay()],
      submitted: 0,
      inspected: 0,
      implemented: 0,
    });
  }

  const map = trend.reduce((acc, x, i) => ((acc[x.date] = i), acc), {});

  (submitted.data || []).forEach(r => {
    const d = r.created_at?.slice(0, 10);
    if (map[d] !== undefined) trend[map[d]].submitted++;
  });

  (inspected.data || []).forEach(r => {
    const d = r.inspected_at?.slice(0, 10);
    if (map[d] !== undefined) trend[map[d]].inspected++;
  });

  (implemented.data || []).forEach(r => {
    const d = r.implemented_at?.slice(0, 10);
    if (map[d] !== undefined) trend[map[d]].implemented++;
  });

  return success(res, trend);
});
/**
 * ============================================================================
 *  SAKTI API - FINAL STABLE VERSION (SECTION 2/3)
 *  CHANGE MANAGEMENT • APPROVAL • IMPLEMENTATION
 * ============================================================================
 */

/* ============================================================================
   3. CHANGE MANAGEMENT
============================================================================ */

/* ---------------------------------------------------------------------------
   3.1 LIST CR — FIX: uses contains() for approval_path
--------------------------------------------------------------------------- */
app.get("/change-requests", authMiddleware, async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;
  const role = req.query.role || null;
  const status = req.query.status || null;

  const filters = {};

  if (status) filters.status = status;
  if (role) filters.approval_path = [role];

  const result = await paginate(
    "change_requests",
    "*",
    page,
    limit,
    filters,
    { column: "created_at", ascending: false }
  );

  if (result.err)
    return error(res, "Gagal memuat change requests", 500, result.err);

  return success(res, result);
});

/* ---------------------------------------------------------------------------
   3.1.1 DETAIL CR
--------------------------------------------------------------------------- */
app.get("/change-requests/:cr_id", authMiddleware, async (req, res) => {
  const { cr_id } = req.params;

  const { data } = await supabase
    .from("change_requests")
    .select("*")
    .eq("cr_id", cr_id)
    .maybeSingle();

  if (!data) return error(res, "CR tidak ditemukan", 404);

  return success(res, data);
});

/* ---------------------------------------------------------------------------
   3.1.2 APPROVAL HISTORY (ordered ascending)
--------------------------------------------------------------------------- */
app.get("/change-requests/:cr_id/approval-history", authMiddleware, async (req, res) => {
  const { cr_id } = req.params;

  const { data: cr } = await supabase
    .from("change_requests")
    .select("id")
    .eq("cr_id", cr_id)
    .maybeSingle();

  if (!cr) return error(res, "CR tidak ditemukan", 404);

  const { data } = await supabase
    .from("change_approvals")
    .select("*")
    .eq("change_request_id", cr.id)
    .order("created_at", { ascending: true });

  return success(res, data);
});

/* ============================================================================
   3.2 INSPECTION (TEKNISI)
============================================================================ */
app.put("/change-requests/:cr_id/inspection", authMiddleware, async (req, res) => {
  const { cr_id } = req.params;
  const b = req.body;

  const required = [
    "jenis_perubahan",
    "alasan",
    "tujuan",
    "ci_id",
    "aset_terdampak_id",
    "rencana_implementasi",
    "usulan_jadwal",
    "rencana_rollback",
    "skor_dampak",
    "skor_kemungkinan",
    "skor_exposure",
  ];

  for (const f of required)
    if (!b[f]) return error(res, `${f} wajib diisi`, 400);

  const risk_score = b.skor_dampak * b.skor_kemungkinan * b.skor_exposure;
  const risk_level = calculateRiskLevel(risk_score);

  const approval_path = determineApprovalPath(b.jenis_perubahan);

  const { data, error: err } = await supabase
    .from("change_requests")
    .update({
      ...b,
      risk_score,
      risk_level,
      approval_path,
      inspected_by: req.user.user_id,
      inspected_at: new Date().toISOString(),
      status: "NEED_APPROVAL",
      approval_status: "NEED_APPROVAL",
      updated_at: new Date().toISOString(),
    })
    .eq("cr_id", cr_id)
    .select()
    .maybeSingle();

  if (err) return error(res, "Gagal menyimpan inspeksi", 500, err);

  return success(res, data, "Inspeksi berhasil disimpan");
});

/* ============================================================================
   3.3 INSPECTION PHOTO UPLOAD
============================================================================ */
app.post(
  "/change-requests/:cr_id/inspection/photo",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    const { cr_id } = req.params;

    if (!req.file)
      return success(res, null, "Tidak ada foto diupload (opsional)");

    try {
      const bucket = process.env.SUPABASE_BUCKET || "inspection-photos";
      const ext = req.file.originalname.split(".").pop();
      const path = `cr-${cr_id}/${Date.now()}-${req.user.user_id}.${ext}`;

      const uploadResult = await supabase.storage
        .from(bucket)
        .upload(path, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadResult.error)
        return error(res, "Upload foto gagal", 500, uploadResult.error);

      const publicUrl = supabase.storage.from(bucket).getPublicUrl(path);

      await supabase.from("change_request_photos").insert({
        change_request_id: cr_id,
        file_path: path,
        url: publicUrl.data.publicUrl,
        uploaded_by: req.user.user_id,
      });

      return success(res, { url: publicUrl.data.publicUrl }, "Foto berhasil diupload");
    } catch (err) {
      return error(res, "Terjadi kesalahan upload foto", 500, err.message);
    }
  }
);

/* ============================================================================
   3.4 APPROVAL: APPROVE, REJECT, NEED-INFO
============================================================================ */

app.post("/change-requests/:cr_id/approve", authMiddleware, (req, res) =>
  handleApproval(req, res, "APPROVE")
);

app.post("/change-requests/:cr_id/reject", authMiddleware, (req, res) =>
  handleApproval(req, res, "REJECT")
);

app.post("/change-requests/:cr_id/need-info", authMiddleware, (req, res) =>
  handleApproval(req, res, "NEED_INFO")
);

/* ---------------------------------------------------------------------------
   APPROVAL HANDLER UTAMA (STABIL)
--------------------------------------------------------------------------- */
async function handleApproval(req, res, decision) {
  const { cr_id } = req.params;
  const role = (req.user.role || "").toUpperCase();
  const note = req.body.note || "";
  if ((decision === "REJECT" || decision === "NEED_INFO") && !note.trim()) {
  return error(res, "Catatan wajib diisi untuk Reject dan Need Info", 400);
  }


  const { data: cr } = await supabase
    .from("change_requests")
    .select("*")
    .eq("cr_id", cr_id)
    .maybeSingle();

  if (!cr) return error(res, "CR tidak ditemukan", 404);
  if (!cr.inspected_at) return error(res, "CR belum diinspeksi", 400);
  // TYPE & REQUESTOR WAJIB ADA
  if (!cr.jenis_perubahan)
    return error(res, "Kolom 'Type' tidak boleh kosong", 400);

  if (!cr.requestor)
    return error(res, "Kolom 'Requestor' tidak boleh kosong", 400);


  const approvalPath = cr.approval_path || [];

  // CEK ROLE DALAM APPROVAL PATH
  if (!approvalPath.includes(role))
    return error(res, `Role ${role} tidak memiliki akses approval`, 403);

  // CEK SUDAH APPROVE SEBELUMNYA
  const { data: existing } = await supabase
    .from("change_approvals")
    .select("id")
    .eq("change_request_id", cr.id)
    .eq("role", role)
    .maybeSingle();

  if (existing)
    return error(res, "Anda sudah memberikan keputusan sebelumnya", 400);

  // SIMPAN APPROVAL
  await supabase.from("change_approvals").insert({
    change_request_id: cr.id,
    role,
    decision,
    note,
    approver_id: req.user.user_id,
    created_at: new Date().toISOString(),
  });

  /* ──────────────────────────────────────────────
      NEED INFO → langsung ubah status
  ────────────────────────────────────────────── */
  if (decision === "NEED_INFO") {
    await supabase
      .from("change_requests")
      .update({
        status: "NEED_INFO",
        approval_status: "NEED_INFO",
      })
      .eq("cr_id", cr_id);

    return success(res, null, "Permintaan informasi tambahan terkirim");
  }

  /* ──────────────────────────────────────────────
      REJECT → langsung tolak CR
  ────────────────────────────────────────────── */
  if (decision === "REJECT") {
    await supabase
      .from("change_requests")
      .update({
        status: "REJECTED",
        approval_status: "REJECTED",
      })
      .eq("cr_id", cr_id);

    return success(res, null, "Change Request ditolak");
  }

  /* ──────────────────────────────────────────────
       APPROVE: CEK APAKAH SEMUA ROLE SUDAH APPROVE
  ────────────────────────────────────────────── */
  const { data: approvals } = await supabase
    .from("change_approvals")
    .select("role, decision")
    .eq("change_request_id", cr.id);

  const approvedRoles = approvals
    .filter((x) => x.decision === "APPROVE")
    .map((x) => x.role);

  const fullyApproved = approvalPath.every((r) =>
    approvedRoles.includes(r)
  );

  await supabase
    .from("change_requests")
    .update({
      approval_status: fullyApproved ? "APPROVED" : "NEED_APPROVAL",
      status: fullyApproved ? "APPROVED" : "NEED_APPROVAL",
    })
    .eq("cr_id", cr_id);

  return success(
    res,
    null,
    fullyApproved
      ? "CR telah disetujui seluruh pihak"
      : "Menunggu approval berikutnya"
  );
}

/* ============================================================================
   3.5 SCHEDULE IMPLEMENTASI
============================================================================ */
app.post("/change-requests/:cr_id/schedule", authMiddleware, async (req, res) => {
  const { cr_id } = req.params;
  const { tanggal_implementasi } = req.body;

  if (!tanggal_implementasi)
    return error(res, "tanggal_implementasi wajib diisi", 400);

  const { data: cr } = await supabase
    .from("change_requests")
    .select("*")
    .eq("cr_id", cr_id)
    .maybeSingle();

  if (!cr) return error(res, "CR tidak ditemukan", 404);
  if (cr.approval_status !== "APPROVED")
    return error(res, "CR belum selesai di-approve", 400);

  const update = await supabase
    .from("change_requests")
    .update({
      implement_date: tanggal_implementasi,
      status: "SCHEDULED",
      updated_at: new Date().toISOString(),
    })
    .eq("cr_id", cr_id)
    .select()
    .maybeSingle();

  return success(res, update, "Jadwal implementasi berhasil disimpan");
});

/* ============================================================================
   3.6 IMPLEMENT START & FINISH
============================================================================ */

app.post("/change-requests/:cr_id/implement", authMiddleware, async (req, res) => {
  const { cr_id } = req.params;

  await supabase
    .from("change_requests")
    .update({
      status: "IMPLEMENTING",
      implemented_start_at: new Date().toISOString(),
    })
    .eq("cr_id", cr_id);

  return success(res, null, "Proses implementasi dimulai");
});

app.post("/change-requests/:cr_id/finish", authMiddleware, async (req, res) => {
  const {
    dampak_setelah_mitigasi,
    kemungkinan_setelah_mitigasi,
    exposure_setelah_mitigasi,
    keterangan,
    status,
  } = req.body;

  if (
    !dampak_setelah_mitigasi ||
    !kemungkinan_setelah_mitigasi ||
    !exposure_setelah_mitigasi ||
    !keterangan ||
    !status
  )
    return error(res, "Semua field wajib diisi", 400);

  const residual_score =
    dampak_setelah_mitigasi *
    kemungkinan_setelah_mitigasi *
    exposure_setelah_mitigasi;

  const residual_level = calculateRiskLevel(residual_score);

  await supabase
    .from("change_requests")
    .update({
      residual_impact: dampak_setelah_mitigasi,
      residual_likelihood: kemungkinan_setelah_mitigasi,
      residual_exposure: exposure_setelah_mitigasi,
      residual_score,
      residual_level,
      implementation_note: keterangan,
      implemented_at: new Date().toISOString(),
      status: status === "COMPLETED" ? "COMPLETED" : "FAILED",
    })
    .eq("cr_id", req.params.cr_id);

  return success(res, null, "Implementasi selesai");
});

/* ============================================================================
   3.7 EMERGENCY LIST
============================================================================ */
app.get("/change-requests/emergency", authMiddleware, async (req, res) => {
  const { page, limit } = req.query;

  const result = await paginate(
    "change_requests",
    "*",
    page,
    limit,
    { change_type: "emergency" },
    { column: "created_at", ascending: false }
  );

  if (result.err)
    return error(res, "Gagal memuat Emergency CR", 500, result.err);

  return success(res, result);
});
/**
 * ============================================================================
 *  SAKTI API - FINAL STABLE VERSION (SECTION 3/3)
 *  PATCH MANAGEMENT • CMDB • NOTIFICATIONS • CRON • SERVER
 * ============================================================================
 */

/* ============================================================================
   4. PATCH MANAGEMENT
============================================================================ */

/* ---------------------------------------------------------------------------
   4.1 LIST PATCH JOBS
--------------------------------------------------------------------------- */
app.get("/patch-jobs", authMiddleware, async (req, res) => {
  const { page, limit } = req.query;

  const result = await paginate(
    "patch_jobs",
    "*",
    page,
    limit,
    {},
    { column: "created_at", ascending: false }
  );

  if (result.err)
    return error(res, "Gagal memuat patch jobs", 500, result.err);

  return success(res, result);
});

/* ---------------------------------------------------------------------------
   4.2 PATCH JOB DETAIL
--------------------------------------------------------------------------- */
app.get("/patch-jobs/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data } = await supabase
    .from("patch_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return error(res, "Patch job tidak ditemukan", 404);

  return success(res, data);
});

/* ---------------------------------------------------------------------------
   4.3 CREATE PATCH JOB
--------------------------------------------------------------------------- */
app.post("/patch-jobs", authMiddleware, async (req, res) => {
  const payload = {
    ...req.body,
    user_id: req.user.user_id,
    created_at: new Date().toISOString(),
  };

  const { data, error: err } = await supabase
    .from("patch_jobs")
    .insert(payload)
    .select()
    .maybeSingle();

  if (err) return error(res, "Gagal membuat patch job", 500, err);

  return success(res, data, "Patch job berhasil dibuat", 201);
});

/* ---------------------------------------------------------------------------
   4.4 SCHEDULE PATCH JOB
--------------------------------------------------------------------------- */
app.post("/patch-jobs/:id/schedule", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { schedule_at } = req.body;

  if (!schedule_at)
    return error(res, "schedule_at wajib diisi", 400);

  const { data, error: err } = await supabase
    .from("patch_schedules")
    .insert({
      patch_job_id: id,
      schedule_at,
      created_by: req.user.user_id,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (err) return error(res, "Gagal menjadwalkan patch", 500, err);

  return success(res, data, "Schedule patch berhasil ditambahkan");
});

/* ---------------------------------------------------------------------------
   4.5 PATCH RESULTS
--------------------------------------------------------------------------- */
app.post("/patch-jobs/:id/results", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const payload = {
    patch_job_id: id,
    ...req.body,
    created_by: req.user.user_id,
    created_at: new Date().toISOString(),
  };

  const { data, error: err } = await supabase
    .from("patch_results")
    .insert(payload)
    .select()
    .maybeSingle();

  if (err)
    return error(res, "Gagal menyimpan hasil patch", 500, err);

  return success(res, data, "Hasil patch berhasil disimpan");
});

/* ---------------------------------------------------------------------------
   4.6 PATCH HISTORY
--------------------------------------------------------------------------- */
app.get("/patch-history", authMiddleware, async (req, res) => {
  const { page, limit } = req.query;

  const result = await paginate(
    "patch_history",
    "*",
    page,
    limit,
    {},
    { column: "created_at", ascending: false }
  );

  if (result.err)
    return error(res, "Gagal memuat patch history", 500, result.err);

  return success(res, result);
});

/* ============================================================================
   5. CMDB (Configuration Management Database)
============================================================================ */

/* ---------------------------------------------------------------------------
   5.1 LIST ASSETS
--------------------------------------------------------------------------- */
app.get("/cmdb/assets", authMiddleware, async (req, res) => {
  const { page, limit } = req.query;

  const result = await paginate(
    "simara_assets",
    "*",
    page,
    limit,
    {},
    { column: "nama_aset", ascending: true }
  );

  if (result.err)
    return error(res, "Gagal memuat daftar aset", 500, result.err);

  return success(res, result);
});


/* ---------------------------------------------------------------------------
   5.1.1 ASSET DETAIL + SPECIFICATION
--------------------------------------------------------------------------- */
app.get("/cmdb/assets/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const { data: asset } = await supabase
    .from("simara_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!asset) return error(res, "Aset tidak ditemukan", 404);

  const { data: spec } = await supabase
    .from("asset_specifications")
    .select("*")
    .eq("asset_id", id)
    .maybeSingle();

  return success(res, { asset, spec });
});

/* ============================================================================
   5.1.2 LIST ASSET BY CATEGORY
============================================================================ */
app.get("/cmdb/assets/category", authMiddleware, async (req, res) => {
  const { kategori, sub_kategori } = req.query;

  let query = supabase.from("simara_assets").select(
    `
      id,
      nama_aset,
      category,
      sub_category,
      kondisi,
      status,
      lokasi,
      penanggung_jawab,
      nomor_seri
    `
  );

  if (kategori) query = query.eq("category", kategori);
  if (sub_kategori) query = query.eq("sub_category", sub_kategori);

  const { data, error: err } = await query;

  if (err) return error(res, "Gagal memuat kategori aset", 500, err);

  const mapped = data.map((x) => ({
    id: x.id,
    nama_aset: x.nama_aset,
    kategori: x.category,
    sub_kategori: x.sub_category,
    kondisi: x.kondisi,
    status: x.status,
    lokasi: x.lokasi,
    penanggung_jawab: x.penanggung_jawab,
    serial_number: x.nomor_seri,
  }));

  return success(res, mapped);
});


/* ---------------------------------------------------------------------------
   5.2 UPDATE SPECIFICATION + INSERT CMDB HISTORY
--------------------------------------------------------------------------- */
app.put("/cmdb/assets/:id/spec", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data: existing } = await supabase
    .from("asset_specifications")
    .select("*")
    .eq("asset_id", id)
    .maybeSingle();

  let saved;

  if (existing) {
    const { data } = await supabase
      .from("asset_specifications")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("asset_id", id)
      .select()
      .maybeSingle();
    saved = data;
  } else {
    const { data } = await supabase
      .from("asset_specifications")
      .insert({
        asset_id: id,
        ...updates,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();
    saved = data;
  }

  // Simpan history perubahan CMDB
  await supabase.from("cmdb_history").insert({
    asset_id: id,
    action: "UPDATE_SPEC",
    details: updates,
    acted_by: req.user.user_id,
    created_at: new Date().toISOString(),
  });

  return success(res, saved, "Spesifikasi aset berhasil diperbarui");
});

/* ---------------------------------------------------------------------------
   5.3 CMDB HISTORY
--------------------------------------------------------------------------- */
app.get("/cmdb/history", authMiddleware, async (req, res) => {
  const { page, limit } = req.query;

  const result = await paginate(
    "cmdb_history",
    "*",
    page,
    limit,
    {},
    { column: "created_at", ascending: false }
  );

  if (result.err)
    return error(res, "Gagal memuat riwayat CMDB", 500, result.err);

  return success(res, result);
});

/* ============================================================================
   6. NOTIFICATIONS
============================================================================ */

/* ---------------------------------------------------------------------------
   6.1 GET NOTIFICATIONS
--------------------------------------------------------------------------- */
app.get("/notifications", authMiddleware, async (req, res) => {
  const { channel, page, limit } = req.query;

  const filters = {};
  if (channel) filters.channel = channel;

  const result = await paginate(
    "notification",
    "*",
    page,
    limit,
    filters,
    { column: "created_at", ascending: false }
  );

  if (result.err)
    return error(res, "Gagal memuat notifikasi", 500, result.err);

  return success(res, result);
});

/* ---------------------------------------------------------------------------
   6.2 MARK AS READ
--------------------------------------------------------------------------- */
app.put("/notifications/:id/read", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const update = await supabase
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (update.error)
    return error(res, "Gagal menandai notifikasi sebagai dibaca", 500, update.error);

  return success(res, null, "Notifikasi ditandai sebagai dibaca");
});

/* ---------------------------------------------------------------------------
   6.3 AUTO DELETE NOTIFICATION > 30 DAYS
--------------------------------------------------------------------------- */
cron.schedule("0 * * * *", async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("notification")
    .delete()
    .lt("created_at", cutoff);
});

/* ============================================================================
   7. AUTO REMINDER APPROVAL (> 8 JAM)
============================================================================ */
cron.schedule("*/10 * * * *", async () => {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

  const { data: pending } = await supabase
    .from("change_requests")
    .select("*")
    .eq("approval_status", "IN_PROGRESS");

  if (!pending) return;

  for (const cr of pending) {
    const lastAction = cr.inspected_at || cr.updated_at;
    if (!lastAction) continue;

    if (new Date(lastAction) < eightHoursAgo) {
      const nextRole = (cr.approval_path || [])[0];
      if (!nextRole) continue;

      await supabase.from("notification").insert({
        title: "Approval Reminder",
        body: `Segera lakukan approval untuk CR ${cr.cr_id}`,
        channel: nextRole,
        created_at: new Date().toISOString(),
      });
    }
  }
});

/* ============================================================================
   8. ROOT ENDPOINT
============================================================================ */
app.get("/", (req, res) => {
  res.json({
    app: "SAKTI API",
    version: "stable",
    status: "running",
    docs: "/api-docs",
  });
});

/* ============================================================================
   9. START SERVER
============================================================================ */
app.listen(port, () => {
  console.log(`🚀 SAKTI API (STABLE VERSION) running on port ${port}`);
});
