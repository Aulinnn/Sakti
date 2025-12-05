export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "SAKTI API - FINAL PRODUCTION VERSION",
    version: "1.0.0",
    description:
      "API Documentation untuk Website SAKTI (Change • Patch • Config Management)",
  },

  servers: [
    {
      url: "http://localhost:8080",
      description: "Local Development",
    },
    {
      url: "https://sakti-backend-674826252080.asia-southeast2.run.app",
      description: "Production Server",
    },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },

    schemas: {
      // ================================================================
      // AUTH SCHEMAS
      // ================================================================
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "admin" },
          password: { type: "string", example: "123456" },
        },
      },

      UserProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          role: { type: "string", example: "KASI" },
          instansi: { type: "string", example: "Diskominfo" },
        },
      },

      // ================================================================
      // CHANGE REQUEST SCHEMAS
      // ================================================================
      ChangeRequest: {
        type: "object",
        properties: {
          cr_id: { type: "string" },
          requestor: { type: "string" },
          instansi: { type: "string" },
          jenis_perubahan: { type: "string" },
          alasan: { type: "string" },
          tujuan: { type: "string" },
          ci_id: { type: "string" },
          aset_terdampak_id: { type: "string" },
          rencana_implementasi: { type: "string" },
          usulan_jadwal: { type: "string" },
          rencana_rollback: { type: "string" },
          skor_dampak: { type: "integer" },
          skor_kemungkinan: { type: "integer" },
          skor_exposure: { type: "integer" },
          risk_score: { type: "integer" },
          risk_level: { type: "string" },
          approval_path: { type: "array", items: { type: "string" } },
          inspected_by: { type: "string" },
          inspected_at: { type: "string" },
          approval_status: { type: "string" },
          status: { type: "string" },
          implement_date: { type: "string" },
          implemented_start_at: { type: "string" },
          implemented_at: { type: "string" },
          residual_impact: { type: "integer" },
          residual_likelihood: { type: "integer" },
          residual_exposure: { type: "integer" },
          residual_score: { type: "integer" },
          residual_level: { type: "string" },
          implementation_note: { type: "string" },
        },
      },

      InspectionRequest: {
        type: "object",
        required: [
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
        ],
        properties: {
          jenis_perubahan: { type: "string" },
          alasan: { type: "string" },
          tujuan: { type: "string" },
          ci_id: { type: "string" },
          aset_terdampak_id: { type: "string" },
          rencana_implementasi: { type: "string" },
          usulan_jadwal: { type: "string" },
          rencana_rollback: { type: "string" },
          skor_dampak: { type: "integer" },
          skor_kemungkinan: { type: "integer" },
          skor_exposure: { type: "integer" },
        },
      },

      // ================================================================
      // APPROVAL SCHEMAS
      // ================================================================
      ApprovalNoteOptional: {
        type: "object",
        properties: {
          note: {
            type: "string",
            example: "Baik, disetujui. Lanjut implementasi.",
          },
        },
      },

      ApprovalNoteRequired: {
        type: "object",
        required: ["note"],
        properties: {
          note: {
            type: "string",
            example: "Mohon lengkapi CI yang terdampak.",
          },
        },
      },

      // ================================================================
      // PATCH JOB SCHEMAS
      // ================================================================
      PatchJob: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          version: { type: "string" },
          created_at: { type: "string" },
        },
      },

      // ================================================================
      // CMDB SCHEMAS
      // ================================================================
      Asset: {
        type: "object",
        properties: {
          id: { type: "string" },
          nama_aset: { type: "string" },
          kategori: { type: "string" },
          sub_kategori: { type: "string" },
          kondisi: { type: "string" },
          status: { type: "string" },
          lokasi: { type: "string" },
          penanggung_jawab: { type: "string" },
          serial_number: { type: "string" },
        },
      },
    },
  },

  // ======================================================================
  // PATHS — FULL ENDPOINTS
  // ======================================================================
  paths: {
    // ================================================================
    // AUTH
    // ================================================================
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login User",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: { 200: { description: "Login berhasil" } },
      },
    },

    "/auth/profile": {
      get: {
        tags: ["Auth"],
        summary: "Get User Profile",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Profil user" } },
      },
      put: {
        tags: ["Auth"],
        summary: "Update Profile",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Profil diupdate" } },
      },
    },

    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout User",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Logout berhasil" } },
      },
    },

    // ================================================================
    // DASHBOARD
    // ================================================================
    "/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "Dashboard Summary",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Summary data" } },
      },
    },

    "/dashboard/weekly-trend": {
      get: {
        tags: ["Dashboard"],
        summary: "Trend Mingguan CR",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Trend berhasil diambil" } },
      },
    },

    // ================================================================
    // CHANGE REQUEST
    // ================================================================
    "/change-requests": {
      get: {
        tags: ["Change Requests"],
        summary: "List CR",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Daftar CR" } },
      },
    },

    "/change-requests/{cr_id}": {
      get: {
        tags: ["Change Requests"],
        summary: "Detail CR",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cr_id",
            in: "path",
            required: true,
          },
        ],
        responses: { 200: { description: "Detail CR" } },
      },
    },

    "/change-requests/{cr_id}/inspection": {
      put: {
        tags: ["Change Requests"],
        summary: "Input Hasil Inspeksi",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InspectionRequest" },
            },
          },
        },
        responses: { 200: { description: "Inspeksi berhasil disimpan" } },
      },
    },

    "/change-requests/{cr_id}/inspection/photo": {
      post: {
        tags: ["Change Requests"],
        summary: "Upload Foto Inspeksi",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Foto berhasil diupload" } },
      },
    },

    // ================================================================
    // APPROVAL
    // ================================================================
    "/change-requests/{cr_id}/approve": {
      post: {
        tags: ["Approval"],
        summary: "Approve CR",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "cr_id", in: "path", required: true },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApprovalNoteOptional" },
            },
          },
        },
        responses: { 200: { description: "CR disetujui" } },
      },
    },

    "/change-requests/{cr_id}/reject": {
      post: {
        tags: ["Approval"],
        summary: "Reject CR",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "cr_id", in: "path", required: true },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApprovalNoteRequired" },
            },
          },
        },
        responses: { 200: { description: "CR ditolak" } },
      },
    },

    "/change-requests/{cr_id}/need-info": {
      post: {
        tags: ["Approval"],
        summary: "Need Info CR",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "cr_id", in: "path", required: true },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApprovalNoteRequired" },
            },
          },
        },
        responses: { 200: { description: "Need info dikirim" } },
      },
    },

    "/change-requests/{cr_id}/schedule": {
      post: {
        tags: ["Change Requests"],
        summary: "Set Jadwal Implementasi",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Jadwal disimpan" } },
      },
    },

    "/change-requests/{cr_id}/implement": {
      post: {
        tags: ["Change Requests"],
        summary: "Mulai Implementasi",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Implementasi dimulai" } },
      },
    },

    "/change-requests/{cr_id}/finish": {
      post: {
        tags: ["Change Requests"],
        summary: "Selesaikan Implementasi",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Implementasi selesai" } },
      },
    },

    // ================================================================
    // PATCH MANAGEMENT
    // ================================================================
    "/patch-jobs": {
      get: {
        tags: ["Patch"],
        summary: "List Patch Jobs",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Daftar patch job" } },
      },
      post: {
        tags: ["Patch"],
        summary: "Create Patch Job",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Patch job dibuat" } },
      },
    },

    "/patch-jobs/{id}": {
      get: {
        tags: ["Patch"],
        summary: "Detail Patch Job",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true },
        ],
        responses: { 200: { description: "Detail patch job" } },
      },
    },

    "/patch-jobs/{id}/schedule": {
      post: {
        tags: ["Patch"],
        summary: "Schedule Patch Job",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Schedule berhasil" } },
      },
    },

    "/patch-jobs/{id}/results": {
      post: {
        tags: ["Patch"],
        summary: "Submit Patch Results",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Hasil patch disimpan" } },
      },
    },

    "/patch-history": {
      get: {
        tags: ["Patch"],
        summary: "Patch History",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Riwayat patch" } },
      },
    },

    // ================================================================
    // CMDB
    // ================================================================
    "/cmdb/assets": {
      get: {
        tags: ["CMDB"],
        summary: "List Aset",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Daftar aset" } },
      },
    },

    "/cmdb/assets/category": {
      get: {
        tags: ["CMDB"],
        summary: "List Asset by Category",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Daftar aset per kategori" } },
      },
    },

    "/cmdb/assets/{id}": {
      get: {
        tags: ["CMDB"],
        summary: "Detail Asset",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true },
        ],
        responses: { 200: { description: "Detail aset" } },
      },
    },

    "/cmdb/assets/{id}/spec": {
      put: {
        tags: ["CMDB"],
        summary: "Update Spec + Insert History",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Spesifikasi diperbarui" } },
      },
    },

    "/cmdb/history": {
      get: {
        tags: ["CMDB"],
        summary: "Riwayat CMDB",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Riwayat perubahan CMDB" } },
      },
    },

    // ================================================================
    // NOTIFICATIONS
    // ================================================================
    "/notifications": {
      get: {
        tags: ["Notification"],
        summary: "List Notifikasi",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "List notifikasi" } },
      },
    },

    "/notifications/{id}/read": {
      put: {
        tags: ["Notification"],
        summary: "Tandai Notifikasi Dibaca",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true },
        ],
        responses: { 200: { description: "Notifikasi dibaca" } },
      },
    },
  },
};
