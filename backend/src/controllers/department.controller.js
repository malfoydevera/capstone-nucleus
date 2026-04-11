const supabase = require('../config/supabase');

// ─── GET /api/departments ────────────────────────────────────────────────────
// Public (no auth).  Returns active departments with nested programs array.
exports.getAllDepartments = async (req, res) => {
  try {
    const { data: departments, error } = await supabase
      .from('departments')
      .select(`
        id, name, code, description, is_active, created_at,
        programs (
          id, name, code, is_active, created_at
        )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    // Filter out inactive programs in the nested array
    const result = (departments || []).map(dept => ({
      ...dept,
      programs: (dept.programs || [])
        .filter(p => p.is_active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return res.json({ departments: result });
  } catch (err) {
    console.error('getAllDepartments error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── GET /api/departments/:id/programs ──────────────────────────────────────
exports.getProgramsByDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: programs, error } = await supabase
      .from('programs')
      .select('id, name, code, is_active, created_at')
      .eq('department_id', id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return res.json({ programs: programs || [] });
  } catch (err) {
    console.error('getProgramsByDepartment error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── POST /api/departments  (admin only) ─────────────────────────────────────
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({
        name: name.trim(),
        code: code?.trim().toUpperCase() || null,
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A department with that name or code already exists' });
      }
      throw error;
    }

    return res.status(201).json({ department: data });
  } catch (err) {
    console.error('createDepartment error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── PUT /api/departments/:id  (admin only) ──────────────────────────────────
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, is_active } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)        updates.name        = name.trim();
    if (code !== undefined)        updates.code        = code?.trim().toUpperCase() || null;
    if (description !== undefined) updates.description = description?.trim() || null;
    if (is_active !== undefined)   updates.is_active   = is_active;

    const { data, error } = await supabase
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A department with that name or code already exists' });
      }
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Department not found' });
      }
      throw error;
    }

    return res.json({ department: data });
  } catch (err) {
    console.error('updateDepartment error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── DELETE /api/departments/:id  (admin only — soft delete) ─────────────────
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check for active papers referencing this department
    const { count, error: countErr } = await supabase
      .from('research_papers')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', id);

    if (countErr) throw countErr;

    if (count > 0) {
      return res.status(409).json({
        error: `Cannot deactivate: ${count} research paper(s) still reference this department`,
      });
    }

    const { data, error } = await supabase
      .from('departments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Department not found' });
      }
      throw error;
    }

    return res.json({ message: 'Department deactivated successfully', department: data });
  } catch (err) {
    console.error('deleteDepartment error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── POST /api/departments/:id/programs  (admin only) ────────────────────────
exports.createProgram = async (req, res) => {
  try {
    const { id: department_id } = req.params;
    const { name, code } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Program name is required' });
    }

    // Verify department exists
    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .select('id')
      .eq('id', department_id)
      .eq('is_active', true)
      .single();

    if (deptErr || !dept) {
      return res.status(404).json({ error: 'Department not found or inactive' });
    }

    const { data, error } = await supabase
      .from('programs')
      .insert({
        department_id,
        name: name.trim(),
        code: code?.trim().toUpperCase() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A program with that code already exists in this department' });
      }
      throw error;
    }

    return res.status(201).json({ program: data });
  } catch (err) {
    console.error('createProgram error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── PUT /api/programs/:id  (admin only) ─────────────────────────────────────
exports.updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, is_active } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)      updates.name      = name.trim();
    if (code !== undefined)      updates.code      = code?.trim().toUpperCase() || null;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('programs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A program with that code already exists in this department' });
      }
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Program not found' });
      }
      throw error;
    }

    return res.json({ program: data });
  } catch (err) {
    console.error('updateProgram error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ─── DELETE /api/programs/:id  (admin only — soft delete) ────────────────────
exports.deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;

    // Check for users referencing this program
    const { count, error: countErr } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id);

    if (countErr) throw countErr;

    if (count > 0) {
      return res.status(409).json({
        error: `Cannot deactivate: ${count} user(s) still reference this program`,
      });
    }

    try {
      const { count: paperCount, error: paperCountErr } = await supabase
        .from('research_papers')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', id);

      if (paperCountErr) throw paperCountErr;

      if (paperCount > 0) {
        return res.status(409).json({
          error: `Cannot deactivate: ${paperCount} research paper(s) still reference this program`,
        });
      }
    } catch (paperError) {
      // Backward compatibility for databases where research_papers.program_id is not available yet.
      if (!String(paperError.message || '').includes('program_id')) {
        throw paperError;
      }
    }

    const { data, error } = await supabase
      .from('programs')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Program not found' });
      }
      throw error;
    }

    return res.json({ message: 'Program deactivated successfully', program: data });
  } catch (err) {
    console.error('deleteProgram error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
