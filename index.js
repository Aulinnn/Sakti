// index.js
import express from 'express';
import supabase from './connection.js';
import { success, error } from './response.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

// ---------------------------
// STATUS WORKFLOW
// ---------------------------
const STATUS = {
  WAITING_TECHNICIAN: 'waiting_technician',
  UNDER_REVIEW: 'under_review',
  APPROVED_WAITING_SCHEDULE: 'approved_waiting_schedule',
  SCHEDULED: 'scheduled',
  IMPLEMENTING: 'implementing',
  COMPLETED: 'completed',
  CMDB_UPDATED: 'cmdb_updated'
};

// ---------------------------
// HELPER – RISK SCORE
// ---------------------------
function calculateRiskScore(impact, likelihood, exposure) {
  const i = Number(impact) || 0;
  const l = Number(likelihood) || 0;
  const e = Number(exposure) || 0;

  const score = i * l * e;
  let level = 'low';

  if (score >= 40) level = 'high';
  else if (score >= 20) level = 'medium';

  return { score, level };
}

// ---------------------------
// MIDDLEWARE AUTH (JWT CUSTOM)
// ---------------------------
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Token tidak ditemukan', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return error(res, 'Token tidak valid', 401);
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    // payload dibuat di endpoint /api/login
    req.user = payload; // { id, name, email, role, status }
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return error(res, 'Autentikasi gagal', 401, err.message);
  }
};

// ---------------------------
// HEALTH CHECK
// ---------------------------
app.get('/', (req, res) => {
  return success(res, 'Backend Change Request berjalan (Service Desk → Teknisi)');
});

// =========================================================
// ASSET MANAGEMENT
// =========================================================

// 1. LIST ASSETS (dengan filter optional)
// GET /api/assets
app.get('/api/assets', authenticate, async (req, res) => {
  try {
    const { search, category, location_id, status } = req.query;

    let query = supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (search) {
      // cari di name atau bmd_code atau serial_number
      query = query.ilike('name', `%${search}%`)
                   .or(`bmd_code.ilike.%${search}%,serial_number.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (location_id) {
      query = query.eq('location_id', Number(location_id));
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error: dbError } = await query;
    if (dbError) throw dbError;

    return success(res, 'List assets', data);
  } catch (err) {
    console.error('List assets error:', err);
    return error(res, 'Gagal mengambil list assets', 500, err.message);
  }
});

// 2. DETAIL ASSET
// GET /api/assets/:id
app.get('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error: dbError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError) throw dbError;

    return success(res, 'Detail asset', data);
  } catch (err) {
    console.error('Detail asset error:', err);
    return error(res, 'Gagal mengambil detail asset', 500, err.message);
  }
});

// 3. CREATE ASSET
// POST /api/assets
app.post('/api/assets', authenticate, async (req, res) => {
  try {
    const {
      bmd_code,
      serial_number,
      name,
      category,
      sub_category_id,
      location_id,
      responsible_person_id,
      vendor_id,
      agency_id,
      acquisition_date,
      acquisition_value,
      maintenance_period,
      file_url,
      condition,
      status
    } = req.body;

    // simple validation
    if (!name) {
      return error(res, 'Nama asset wajib diisi', 400, 'NAME_REQUIRED');
    }

    const { data, error: dbError } = await supabase
      .from('assets')
      .insert([
        {
          bmd_code,
          serial_number,
          name,
          category,
          sub_category_id,
          location_id,
          responsible_person_id,
          vendor_id,
          agency_id,
          acquisition_date,
          acquisition_value,
          maintenance_period,
          file_url,
          condition,
          status
        }
      ])
      .select()
      .single();

    if (dbError) throw dbError;

    return success(res, 'Asset berhasil dibuat', data, 201);
  } catch (err) {
    console.error('Create asset error:', err);
    return error(res, 'Gagal membuat asset', 500, err.message);
  }
});

// 4. UPDATE ASSET
// PUT /api/assets/:id
app.put('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      bmd_code,
      serial_number,
      name,
      category,
      sub_category_id,
      location_id,
      responsible_person_id,
      vendor_id,
      agency_id,
      acquisition_date,
      acquisition_value,
      maintenance_period,
      file_url,
      condition,
      status
    } = req.body;

    const { data, error: dbError } = await supabase
      .from('assets')
      .update({
        bmd_code,
        serial_number,
        name,
        category,
        sub_category_id,
        location_id,
        responsible_person_id,
        vendor_id,
        agency_id,
        acquisition_date,
        acquisition_value,
        maintenance_period,
        file_url,
        condition,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;

    return success(res, 'Asset berhasil diupdate', data);
  } catch (err) {
    console.error('Update asset error:', err);
    return error(res, 'Gagal mengupdate asset', 500, err.message);
  }
});

// 5. DELETE ASSET (opsi hard delete, kalau mau soft tinggal ubah status)
// DELETE /api/assets/:id
app.delete('/api/assets/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { error: dbError } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    return success(res, 'Asset berhasil dihapus');
  } catch (err) {
    console.error('Delete asset error:', err);
    return error(res, 'Gagal menghapus asset', 500, err.message);
  }
});

// ---------------------------
// LOGIN (CUSTOM AUTH: public.users)
// ---------------------------
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // validasi input dasar
    if (!email || !password) {
      return error(res, 'Email dan password wajib diisi', 400, 'EMAIL_PASSWORD_REQUIRED');
    }

    // 1. Ambil user dari tabel public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      console.error('Supabase error:', userError);
      return error(res, 'Terjadi kesalahan saat mengambil data user', 500, userError.message);
    }

    if (!user) {
      return error(res, 'Email tidak ditemukan', 401, 'USER_NOT_FOUND');
    }

    // 2. Cek password (users.password harus hash bcrypt)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return error(res, 'Password salah', 401, 'INVALID_PASSWORD');
    }

    // 3. Generate JWT (access token)
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'dev-secret', // ganti di .env untuk production
      { expiresIn: '1d' }
    );

    // 4. Response sukses
    return success(res, 'Login berhasil', {
      access_token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Email atau password salah', 401, err.message);
  }
});

// ---------------------------
// LOGOUT (STATELESS JWT)
// ---------------------------
app.post('/api/logout', authenticate, async (req, res) => {
  try {
    return success(res, 'Logout berhasil. Silakan hapus token di sisi client.');
  } catch (err) {
    console.error('Logout error:', err);
    return error(res, 'Gagal logout', 500, err.message);
  }
});

// =========================================================
// 1. SERVICE DESK kirim Change Request → Teknisi menerima
// =========================================================
app.post('/api/change-requests', authenticate, async (req, res) => {
  try {
    const {
      ticket_id,
      requester_name,
      requester_unit,
      type,
      reason,
      objective,
      ci_id,
      implementation_plan,
      proposed_schedule,
      rollback_plan,
      technician_id
    } = req.body;

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .insert([
        {
          ticket_id,
          requester_name,
          requester_unit,
          type,
          reason,
          objective,
          ci_id,
          implementation_plan,
          proposed_schedule,
          rollback_plan,
          technician_id,
          status: STATUS.WAITING_TECHNICIAN,
          requester_id: req.user?.id // opsional, sesuaikan schema
        }
      ])
      .select()
      .single();

    if (dbError) throw dbError;

    return success(res, 'CR dari Service Desk dibuat', data, 201);
  } catch (err) {
    console.error('Create CR error:', err);
    return error(res, 'Gagal membuat CR', 500, err.message);
  }
});

// =========================================================
// 2. Teknisi isi INSPEKSI + risiko
// =========================================================
app.put('/api/change-requests/:id/inspection', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      reason,
      objective,
      ci_id,
      implementation_plan,
      proposed_schedule,
      rollback_plan,
      cost_estimate,
      time_estimate_hours,
      impact_score,
      likelihood_score,
      exposure_score,
      field_photo_url
    } = req.body;

    const { score, level } = calculateRiskScore(
      impact_score,
      likelihood_score,
      exposure_score
    );

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .update({
        type,
        reason,
        objective,
        ci_id,
        implementation_plan,
        proposed_schedule,
        rollback_plan,
        cost_estimate,
        time_estimate_hours,
        impact_score,
        likelihood_score,
        exposure_score,
        risk_score: score,
        risk_level: level,
        field_photo_url,
        status: STATUS.UNDER_REVIEW
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;
    return success(res, 'Inspeksi tersimpan', data);
  } catch (err) {
    console.error('Inspection error:', err);
    return error(res, 'Gagal simpan inspeksi', 500, err.message);
  }
});

// =========================================================
// 3. Teknisi menentukan jalur approval
// =========================================================
app.post('/api/change-requests/:id/approval-route', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_route } = req.body;

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .update({
        approval_route,
        status: STATUS.APPROVED_WAITING_SCHEDULE
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;
    return success(res, 'Approval route ditetapkan', data);
  } catch (err) {
    console.error('Approval route error:', err);
    return error(res, 'Gagal set approval route', 500, err.message);
  }
});

// =========================================================
// 4. Jadwal implementasi
// =========================================================
app.put('/api/change-requests/:id/schedule', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { implementation_date } = req.body;

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .update({
        implementation_date,
        status: STATUS.SCHEDULED
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;
    return success(res, 'Jadwal tersimpan', data);
  } catch (err) {
    console.error('Schedule error:', err);
    return error(res, 'Gagal update jadwal', 500, err.message);
  }
});

// =========================================================
// 5. Start Implementasi
// =========================================================
app.post('/api/change-requests/:id/start', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .update({ status: STATUS.IMPLEMENTING })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;
    return success(res, 'Implementasi dimulai', data);
  } catch (err) {
    console.error('Start implement error:', err);
    return error(res, 'Gagal mulai implementasi', 500, err.message);
  }
});

// =========================================================
// 6. Complete + Residual Risk
// =========================================================
app.put('/api/change-requests/:id/complete', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      residual_impact_score,
      residual_likelihood_score,
      residual_exposure_score,
      implementation_result
    } = req.body;

    const { score, level } = calculateRiskScore(
      residual_impact_score,
      residual_likelihood_score,
      residual_exposure_score
    );

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .update({
        residual_impact_score,
        residual_likelihood_score,
        residual_exposure_score,
        residual_risk_score: score,
        residual_risk_level: level,
        implementation_result,
        status: STATUS.COMPLETED
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;
    return success(res, 'CR Completed', data);
  } catch (err) {
    console.error('Complete error:', err);
    return error(res, 'Gagal complete', 500, err.message);
  }
});

// =========================================================
// 7. CMDB Updated
// =========================================================
app.post('/api/change-requests/:id/cmdb-updated', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .update({ status: STATUS.CMDB_UPDATED })
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;
    return success(res, 'CMDB updated', data);
  } catch (err) {
    console.error('CMDB update error:', err);
    return error(res, 'Gagal update CMDB', 500, err.message);
  }
});

// =========================================================
// 8. LIST & DETAIL
// =========================================================
app.get('/api/change-requests', authenticate, async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('change_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error: dbError } = await query;
    if (dbError) throw dbError;

    return success(res, 'List CR', data);
  } catch (err) {
    console.error('List CR error:', err);
    return error(res, 'Gagal ambil list', 500, err.message);
  }
});

app.get('/api/change-requests/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error: dbError } = await supabase
      .from('change_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError) throw dbError;
    return success(res, 'Detail CR', data);
  } catch (err) {
    console.error('Detail CR error:', err);
    return error(res, 'Gagal ambil detail', 500, err.message);
  }
});

// ---------------------------
// RUN
// ---------------------------
app.listen(port, () => {
  console.log(`🚀 Backend berjalan di port ${port}`);
});
