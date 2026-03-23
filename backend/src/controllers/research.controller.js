const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

const getRoleMemberForPaper = async (role, paper, allowFallback = true) => {
  let query = supabase
    .from('users')
    .select('id, full_name, email, role, department, department_id')
    .eq('role', role)
    .order('created_at', { ascending: true })
    .limit(1);

  if (paper.department_id) {
    query = query.eq('department_id', paper.department_id);
  } else if (paper.department) {
    query = query.eq('department', paper.department);
  }

  let { data: members, error } = await query;
  if (error) throw error;

  if ((!members || members.length === 0) && allowFallback && (paper.department_id || paper.department)) {
    const fallbackResult = await supabase
      .from('users')
      .select('id, full_name, email, role, department, department_id')
      .eq('role', role)
      .order('created_at', { ascending: true })
      .limit(1);

    if (fallbackResult.error) throw fallbackResult.error;
    members = fallbackResult.data;
  }

  return members?.[0] || null;
};

const getUserProfile = async (userId) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, department, department_id')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return user;
};

const recordWorkflowEvent = async ({
  researchId,
  reviewerId,
  reviewerRole,
  status,
  comments,
  previousStatus = null,
  newStatus = null,
  actionType = 'review_action',
  metadata = {},
}) => {
  try {
    await supabase.from('approval_workflow').insert([{
      research_id: researchId,
      reviewer_id: reviewerId,
      reviewer_role: reviewerRole,
      status,
      comments: comments || null,
      previous_status: previousStatus,
      new_status: newStatus,
      action_type: actionType,
      metadata,
    }]);
  } catch (detailedError) {
    try {
      await supabase.from('approval_workflow').insert([{
        research_id: researchId,
        reviewer_id: reviewerId,
        reviewer_role: reviewerRole,
        status,
        comments: comments || null,
      }]);
    } catch (fallbackError) {
      console.log('Approval workflow insert skipped:', fallbackError.message || detailedError.message);
    }
  }
};

// Submit new research or update existing revision
exports.submitResearch = async (req, res) => {
  try {
    const { id, title, abstract, keywords, coAuthors, category, facultyId, department } = req.body;
    const file = req.file;
    const userId = req.user.id;

    if (!id && !file) {
      return res.status(400).json({ error: 'Research file is required' });
    }

    if (!title || !abstract || !category) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    let fileData = {};

    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${userId}/${uuidv4()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('research-papers')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('research-papers')
        .getPublicUrl(fileName);

      fileData = {
        file_url: publicUrl,
        file_name: file.originalname,
        file_size: file.size
      };
    }

    const { data: research, error: dbError } = await supabase
      .from('research_papers')
      .upsert({
        ...(id && { id }), 
        title,
        abstract,
        keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
        co_authors: coAuthors || null,
        category,
        author_id: userId,
        faculty_id: facultyId || null,
        department: department || null,
        // Status logic:
        // - New submission with faculty: pending_faculty
        // - New submission without faculty: pending
        // - Resubmission: return to the stage that requested revision
        status: id ? undefined : (facultyId ? 'pending_faculty' : 'pending'),
        ...fileData 
      })
      .select()
      .single();

    if (dbError) {
      console.error('=== DATABASE ERROR DETAILS ===');
      console.error('Error message:', dbError.message);
      console.error('Error code:', dbError.code);
      console.error('Error details:', dbError.details);
      console.error('Error hint:', dbError.hint);
      console.error('Full error:', JSON.stringify(dbError, null, 2));
      return res.status(500).json({ 
        error: 'Failed to save research data',
        details: dbError.message 
      });
    }

    // Handle co-authors - parse coAuthorIds from request
    let coAuthorIds = [];
    try {
      if (req.body.coAuthorIds) {
        // If it's a string, parse it; if it's already an array, use it
        coAuthorIds = typeof req.body.coAuthorIds === 'string' 
          ? JSON.parse(req.body.coAuthorIds) 
          : req.body.coAuthorIds;
      }
    } catch (parseError) {
      console.error('Error parsing coAuthorIds:', parseError);
      coAuthorIds = [];
    }
    
    if (coAuthorIds.length > 0) {
      try {
        // Delete existing co-authors for resubmission
        if (id) {
          await supabase
            .from('research_authors')
            .delete()
            .eq('research_id', research.id)
            .neq('is_primary', true);
        }

        // Insert primary author first (the submitter)
        const { error: primaryError } = await supabase
          .from('research_authors')
          .upsert({
            research_id: research.id,
            user_id: userId,
            author_order: 0,
            is_primary: true
          }, {
            onConflict: 'research_id,user_id'
          });

        if (primaryError) {
          console.error('Error inserting primary author:', primaryError);
        }

        // Insert co-authors
        const coAuthorsData = coAuthorIds.map((authorId, index) => ({
          research_id: research.id,
          user_id: authorId,
          author_order: index + 1,
          is_primary: false
        }));

        const { error: authorsError } = await supabase
          .from('research_authors')
          .upsert(coAuthorsData, {
            onConflict: 'research_id,user_id'
          });

        if (authorsError) {
          console.error('Error inserting co-authors:', authorsError);
        }
      } catch (authorTableError) {
        // If table doesn't exist yet, just log and continue
        console.log('Note: research_authors table may not exist yet. Run migration to enable co-author feature.');
        console.error('Author table error:', authorTableError);
      }
    } else {
      // Just insert primary author
      try {
        await supabase
          .from('research_authors')
          .upsert({
            research_id: research.id,
            user_id: userId,
            author_order: 0,
            is_primary: true
          }, {
            onConflict: 'research_id,user_id'
          });
      } catch (authorTableError) {
        // If table doesn't exist yet, just log and continue
        console.log('Note: research_authors table may not exist yet. Run migration to enable co-author feature.');
      }
    }

    // Handle revision resubmission - return paper to the appropriate reviewer
    if (id) {
      const { data: existingPaper } = await supabase
        .from('research_papers')
        .select('status, last_reviewer_role, previous_status, faculty_id')
        .eq('id', id)
        .single();

      if (existingPaper && existingPaper.status === 'revision_required') {
        // Determine where to return the paper based on who requested the revision
        let newStatus;
        const lastReviewerRole = existingPaper.last_reviewer_role;
        const previousStatus = existingPaper.previous_status;

        if (lastReviewerRole === 'faculty') {
          newStatus = 'pending_faculty';
        } else if (lastReviewerRole === 'dean') {
          newStatus = 'pending_dean';
        } else if (lastReviewerRole === 'program_chair') {
          newStatus = 'pending_program_chair';
        } else if (lastReviewerRole === 'staff') {
          newStatus = 'pending_editor';
        } else if (lastReviewerRole === 'admin') {
          newStatus = 'pending_admin';
        } else if (previousStatus) {
          // Fallback to previous status if last_reviewer_role is not set
          newStatus = previousStatus;
        } else if (existingPaper.faculty_id) {
          // Default: if faculty is assigned, go back to faculty
          newStatus = 'pending_faculty';
        } else {
          // Legacy papers without faculty
          newStatus = 'pending';
        }

        console.log(`Resubmission: Returning paper ${id} from revision_required to ${newStatus}`);

        // Update the status
        await supabase
          .from('research_papers')
          .update({ 
            status: newStatus,
            revision_notes: null,
            last_reviewer_role: null,
            previous_status: null
          })
          .eq('id', id);
      }
    }

    const { data: author } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    // Notify the assigned faculty member for new submissions
    if (!id && facultyId) {
      await supabase.from('notifications').insert([{
        user_id: facultyId,
        research_id: research.id,
        type: 'submission',
        title: 'New Research Submission',
        message: `${author?.full_name || author?.email} submitted "${title}" for your review`
      }]);
    }
    
    // Notify staff for revisions or if no faculty assigned (legacy flow)
    if (id || !facultyId) {
      const { data: staffUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'staff');

      if (staffUsers && staffUsers.length > 0) {
        const notifications = staffUsers.map(staff => ({
          user_id: staff.id,
          research_id: research.id,
          type: 'submission',
          title: id ? 'Research Revised' : 'New Research Submission',
          message: `${author?.full_name || author?.email} ${id ? 'resubmitted' : 'submitted'} "${title}" for review`
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    res.status(id ? 200 : 201).json({
      message: id ? 'Research updated successfully' : 'Research submitted successfully',
      research
    });
  } catch (error) {
    console.error('Submit research error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user's research papers
exports.getMyResearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ papers });
  } catch (error) {
    console.error('Get my research error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all research papers (staff/admin)
exports.getAllResearch = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .order('submission_date', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: papers, error } = await query;
    if (error) throw error;

    const transformedPapers = papers.map(paper => ({ ...paper, users: paper.author }));
    res.json({ papers: transformedPapers });
  } catch (error) {
    console.error('Get all research error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get single research paper
exports.getResearchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .eq('id', id)
      .single();

    if (error || !paper) {
      return res.status(404).json({ error: 'Research paper not found' });
    }

    // FIXED: Treat the RPC call as a Promise properly before chaining
    supabase.rpc('increment_view_count', { row_id: id })
      .then(({ error: rpcError }) => {
        if (rpcError) console.error('Auto-track view error:', rpcError);
        else console.log(`View count incremented for paper ${id}`);
      })
      .catch(err => console.error('Unexpected error during view tracking:', err));

    const transformedPaper = { ...paper, users: paper.author };
    res.json({ paper: transformedPaper });
  } catch (error) {
    console.error('Get research error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Track research view (Explicit tracking for paper_views table)
exports.trackView = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Use await to ensure the RPC call completes before moving forward
    const { error: updateError } = await supabase.rpc('increment_view_count', { row_id: id });
    if (updateError) throw updateError;

    // Insert into detailed tracking table
    await supabase
      .from('paper_views')
      .insert({
        paper_id: id,
        user_id: userId,
        viewed_at: new Date().toISOString()
      });

    res.json({ success: true, message: 'View tracked successfully' });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
};

// Track research download
exports.trackDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Use await for incrementing
    const { error: updateError } = await supabase.rpc('increment_download_count', { row_id: id });
    if (updateError) throw updateError;

    // Insert into detailed tracking table
    await supabase
      .from('paper_downloads')
      .insert({
        paper_id: id,
        user_id: userId,
        downloaded_at: new Date().toISOString()
      });

    res.json({ success: true, message: 'Download tracked successfully' });
  } catch (error) {
    console.error('Error tracking download:', error);
    res.status(500).json({ error: 'Failed to track download' });
  }
};

// Admin: Get all research with full details
exports.adminGetAllResearch = async (req, res) => {
  try {
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email, role), reviews:approval_workflow(*)`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const transformedPapers = papers.map(paper => ({ ...paper, users: paper.author }));
    res.json({ success: true, papers: transformedPapers });
  } catch (error) {
    console.error('Admin fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch research data' });
  }
};

// Admin: Update research
exports.adminUpdateResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updateData)
      .eq('id', id)
      .select(`*, author:users!author_id (id, full_name, email)`)
      .single();

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      paper: { ...updatedPaper, users: updatedPaper.author },
      message: 'Research updated successfully' 
    });
  } catch (error) {
    console.error('Admin update error:', error);
    res.status(500).json({ error: 'Failed to update research' });
  }
};

// Admin: Delete research
exports.adminDeleteResearch = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Deletions are handled by ON DELETE CASCADE in your SQL schema
    const { error: deleteError } = await supabase
      .from('research_papers')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Research deleted successfully' });
  } catch (error) {
    console.error('Admin delete error:', error);
    res.status(500).json({ error: 'Failed to delete research' });
  }
};

// Admin: Publish research
exports.adminPublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: publishedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update({ 
        status: 'published',
        is_published: true,
        published_date: new Date().toISOString()
      })
      .eq('id', id)
      .select(`*, author:users!author_id (id, full_name, email)`)
      .single();

    if (updateError) throw updateError;

    await supabase.from('notifications').insert([{
      user_id: publishedPaper.author_id,
      research_id: id,
      type: 'publication',
      title: 'Research Published',
      message: `Congratulations! Your research "${publishedPaper.title}" is now available.`
    }]);

    res.json({ success: true, paper: { ...publishedPaper, users: publishedPaper.author } });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Failed to publish research' });
  }
};

// Admin: Unpublish research
exports.adminUnpublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: unpublishedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update({ 
        status: 'approved',
        is_published: false,
        published_date: null
      })
      .eq('id', id)
      .select(`*, author:users!author_id (id, full_name, email)`)
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, paper: { ...unpublishedPaper, users: unpublishedPaper.author } });
  } catch (error) {
    console.error('Unpublish error:', error);
    res.status(500).json({ error: 'Failed to unpublish research' });
  }
};

// Approve research - Updated for sequential workflow
exports.approveResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role;

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('*, author:users!author_id(full_name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !paper) return res.status(404).json({ error: 'Research paper not found' });

    let newStatus;
    let notificationMessage;
    let nextReviewers = [];
    let extraUpdate = {}; // additional fields to write on update

    // Sequential approval workflow:
    // Adviser (faculty) → Program Chair → Research Editor (staff) → Admin
    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      const targetUser = await getRoleMemberForPaper('program_chair', paper, false);
      if (!targetUser) {
        return res.status(400).json({ error: 'No Program Chair account is assigned to this department. Ask an admin to create or assign one before approving.' });
      }

      newStatus = 'pending_program_chair';
      extraUpdate.dean_chair_id = targetUser.id;
      extraUpdate.last_reviewer_role = reviewerRole;
      extraUpdate.updated_at = new Date().toISOString();
      notificationMessage = 'Your research has been approved by your adviser and is now pending Program Chair review';
      nextReviewers = [targetUser.id];
    } else if (reviewerRole === 'dean' && paper.status === 'pending_dean') {
      // Dean approves: move to Research Editor
      newStatus = 'pending_editor';
      extraUpdate.last_reviewer_role = reviewerRole;
      extraUpdate.updated_at = new Date().toISOString();
      notificationMessage = 'Your research has been approved by the Dean and is now under Research Editor review';

      const { data: staffUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'staff');

      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair') {
      // Program Chair approves: move to Research Editor
      newStatus = 'pending_editor';
      extraUpdate.last_reviewer_role = reviewerRole;
      extraUpdate.updated_at = new Date().toISOString();
      notificationMessage = 'Your research has been approved by the Program Chair and is now under Research Editor review';

      const { data: staffUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'staff');

      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      // Research Editor approves: move to Admin review
      newStatus = 'pending_admin';
      extraUpdate.last_reviewer_role = reviewerRole;
      extraUpdate.updated_at = new Date().toISOString();
      notificationMessage = 'Your research has been approved by the Research Editor and is awaiting final Admin approval';

      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers) nextReviewers = adminUsers.map(a => a.id);
    } else if (reviewerRole === 'admin' && (paper.status === 'pending_admin' || paper.status === 'under_review')) {
      // Admin final approval
      newStatus = 'approved';
      extraUpdate.last_reviewer_role = reviewerRole;
      extraUpdate.updated_at = new Date().toISOString();
      notificationMessage = 'Congratulations! Your research has been approved and published';
    } else {
      return res.status(400).json({ 
        error: 'Invalid approval workflow. Please check the paper status and your role.',
        currentStatus: paper.status,
        yourRole: reviewerRole 
      });
    }

    console.log('=== BACKEND: Approval Process ===');
    console.log('Paper ID:', id);
    console.log('Current status:', paper.status);
    console.log('Reviewer role:', reviewerRole);
    console.log('New status:', newStatus);

    // Update paper status
    const { data: updateData, error: updateError } = await supabase
      .from('research_papers')
      .update({ 
        status: newStatus,
        published_date: newStatus === 'approved' ? new Date().toISOString() : null,
        ...extraUpdate
      })
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('Database update error:', updateError);
      return res.status(500).json({ error: 'Failed to update paper status', details: updateError });
    }

    console.log('Update successful. Updated paper:', updateData);

    await recordWorkflowEvent({
      researchId: id,
      reviewerId,
      reviewerRole,
      status: 'approved',
      comments,
      previousStatus: paper.status,
      newStatus,
      actionType: reviewerRole === 'faculty' ? 'forward_to_program_chair' : 'approve',
      metadata: reviewerRole === 'faculty' ? { assignedProgramChairId: extraUpdate.dean_chair_id } : {},
    });

    // Notify author (optional - skip if table doesn't exist)
    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id, 
        research_id: id, 
        type: 'approval', 
        title: 'Research Approved', 
        message: notificationMessage
      }]);
    } catch (notifError) {
      console.log('Notifications table not available, skipping...', notifError.message);
    }

    // Notify next reviewers in the workflow (optional)
    if (nextReviewers.length > 0) {
      try {
        const nextNotifications = nextReviewers.map(reviewerId => ({
          user_id: reviewerId,
          research_id: id,
          type: 'review_request',
          title: 'New Research for Review',
          message: `Research "${paper.title}" is ready for your review`
        }));
        
        await supabase.from('notifications').insert(nextNotifications);
      } catch (notifError) {
        console.log('Could not send notifications to next reviewers:', notifError.message);
      }
    }

    res.json({ 
      message: 'Research approved successfully', 
      status: newStatus,
      nextStage: newStatus === 'approved' ? 'Published' : 
                 newStatus === 'pending_editor' ? 'Editor Review' :
                 newStatus === 'pending_admin' ? 'Admin Review' : 'Unknown'
    });
  } catch (error) {
    console.error('=== APPROVE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      type: error.name
    });
  }
};

exports.deanInterveneResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reason, comments } = req.body;
    const reviewerId = req.user.id;

    if (!['approve', 'reject', 'revision'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be one of: approve, reject, revision' });
    }

    if (!reason?.trim()) {
      return res.status(400).json({ error: 'Dean intervention reason is required' });
    }

    const [paperResult, deanProfile] = await Promise.all([
      supabase
        .from('research_papers')
        .select('*, author:users!author_id(full_name, email)')
        .eq('id', id)
        .single(),
      getUserProfile(reviewerId),
    ]);

    const { data: paper, error: fetchError } = paperResult;
    if (fetchError || !paper) {
      return res.status(404).json({ error: 'Research paper not found' });
    }

    const departmentMatches = paper.department_id && deanProfile.department_id
      ? paper.department_id === deanProfile.department_id
      : paper.department && deanProfile.department
        ? paper.department === deanProfile.department
        : true;

    if (paper.status !== 'pending_program_chair' && !(paper.status === 'pending_dean' && paper.dean_chair_id === reviewerId)) {
      return res.status(400).json({ error: 'Dean intervention is only allowed on Program Chair items or papers already escalated to the Dean.' });
    }

    if (!departmentMatches && paper.status !== 'pending_dean') {
      return res.status(403).json({ error: 'This paper is outside your assigned department.' });
    }

    let newStatus;
    let notificationTitle;
    let notificationMessage;
    let workflowStatus;

    if (decision === 'approve') {
      newStatus = 'pending_editor';
      workflowStatus = 'approved';
      notificationTitle = 'Dean Override Approval';
      notificationMessage = 'Your research has been approved by the Dean and forwarded to the Research Editor.';
    } else if (decision === 'reject') {
      newStatus = 'rejected';
      workflowStatus = 'rejected';
      notificationTitle = 'Dean Rejection';
      notificationMessage = `Your research was rejected by the Dean. Reason: ${comments || reason}`;
    } else {
      newStatus = 'revision_required';
      workflowStatus = 'revision_required';
      notificationTitle = 'Dean Requested Revision';
      notificationMessage = `The Dean requested revisions. Notes: ${comments || reason}`;
    }

    const updatePayload = {
      status: newStatus,
      dean_chair_id: reviewerId,
      last_reviewer_role: 'dean',
      updated_at: new Date().toISOString(),
      ...(decision === 'reject' ? { rejection_reason: comments || reason } : {}),
      ...(decision === 'revision'
        ? { revision_notes: comments || reason, previous_status: paper.status }
        : {}),
    };

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update paper status', details: updateError.message });
    }

    await recordWorkflowEvent({
      researchId: id,
      reviewerId,
      reviewerRole: 'dean',
      status: workflowStatus,
      comments: comments || null,
      previousStatus: paper.status,
      newStatus,
      actionType: 'dean_intervention',
      metadata: {
        reason,
        originalAssigneeId: paper.dean_chair_id,
        department: paper.department || null,
      },
    });

    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id,
        research_id: id,
        type: decision === 'approve' ? 'approval' : workflowStatus,
        title: notificationTitle,
        message: notificationMessage,
      }]);
    } catch (notifError) {
      console.log('Dean intervention notification skipped:', notifError.message);
    }

    if (newStatus === 'pending_editor') {
      try {
        const { data: staffUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'staff');

        if (staffUsers?.length) {
          await supabase.from('notifications').insert(
            staffUsers.map((staffUser) => ({
              user_id: staffUser.id,
              research_id: id,
              type: 'review_request',
              title: 'Dean Forwarded Research for Review',
              message: `Research "${paper.title}" was forwarded by the Dean for Research Editor review.`,
            }))
          );
        }
      } catch (notifError) {
        console.log('Dean intervention editor notifications skipped:', notifError.message);
      }
    }

    res.json({
      message: `Dean intervention completed successfully via ${decision}`,
      status: newStatus,
      paper: updatedPaper,
    });
  } catch (error) {
    console.error('Dean intervention error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Reject research
exports.rejectResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('author_id, title, status')
      .eq('id', id)
      .single();
    
    if (fetchError || !paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    
    const { error: updateError } = await supabase
      .from('research_papers')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        last_reviewer_role: req.user.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (updateError) {
      console.error('Reject update error:', updateError);
      return res.status(500).json({ error: 'Failed to reject paper' });
    }
    
    await recordWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole: req.user.role,
      status: 'rejected',
      comments: reason,
      previousStatus: paper.status,
      newStatus: 'rejected',
      actionType: 'reject',
    });

    res.json({ message: 'Research rejected successfully' });
  } catch (error) {
    console.error('Reject research error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Request revision
exports.requestRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const reviewerRole = req.user.role;
    
    console.log('=== BACKEND: Request Revision ===');
    console.log('Paper ID:', id);
    console.log('Reviewer role:', reviewerRole);
    console.log('Revision notes:', notes);
    
    if (!notes) return res.status(400).json({ error: 'Revision notes are required' });

    // Get current paper to check its status
    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      console.error('Paper not found:', fetchError);
      return res.status(404).json({ error: 'Paper not found', details: fetchError?.message });
    }

    console.log('Current paper status:', paper.status);

    // Determine new status and notification recipient based on reviewer role
    let newStatus;
    let notificationUserId;
    let notificationTitle;
    let notificationMessage;

    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      // Adviser sends directly to student for revision
      newStatus = 'revision_required';
      notificationUserId = paper.author_id;
      notificationTitle = `Revision Required: ${paper.title}`;
      notificationMessage = `Your adviser requires revisions. Notes: ${notes}`;
      console.log('Flow: Adviser → Student (revision required)');
    }
    else if (
      (reviewerRole === 'dean' && paper.status === 'pending_dean') ||
      (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair')
    ) {
      // Dean / Program Chair sends back to student for revision
      newStatus = 'revision_required';
      notificationUserId = paper.author_id;
      const roleLabel = reviewerRole === 'dean' ? 'Dean' : 'Program Chair';
      notificationTitle = `Revision Required: ${paper.title}`;
      notificationMessage = `The ${roleLabel} requires revisions. Notes: ${notes}`;
      console.log(`Flow: ${roleLabel} → Student (revision required)`);
    }
    else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      // Research Editor sends back to Dean/Program Chair (or faculty if no dean_chair_id)
      if (paper.dean_chair_id) {
        // Determine which status to return to based on the assigned reviewer's role
        const { data: deanChairUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', paper.dean_chair_id)
          .single();
        newStatus = deanChairUser?.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
        notificationUserId = paper.dean_chair_id;
      } else {
        newStatus = 'pending_faculty';
        notificationUserId = paper.faculty_id;
      }
      notificationTitle = `Paper Returned for Review: ${paper.title}`;
      notificationMessage = `The Research Editor returned this paper with notes: ${notes}`;
      console.log('Flow: Research Editor → Dean/Program Chair (returned with notes)');
    }
    else if (reviewerRole === 'admin' && paper.status === 'pending_admin') {
      // Admin sends back to Research Editor
      newStatus = 'pending_editor';
      notificationUserId = null; // Notify all staff
      notificationTitle = `Paper Returned for Review: ${paper.title}`;
      notificationMessage = `The Admin returned this paper with notes: ${notes}`;
      console.log('Flow: Admin → Research Editor (returned with notes)');
    }
    else {
      return res.status(400).json({ 
        error: `Cannot request revision from status "${paper.status}" as role "${reviewerRole}"` 
      });
    }

    // Update paper with new status and revision notes
    const updateData = { 
      status: newStatus, 
      revision_notes: notes,
      last_reviewer_role: reviewerRole,
      previous_status: paper.status,
      updated_at: new Date().toISOString()
    };

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update paper status', details: updateError.message });
    }

    console.log('Paper updated successfully. New status:', updatedPaper.status);
    
    // Create notifications
    if (notificationUserId) {
      // Single recipient (student, faculty, dean, or program_chair)
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: notificationUserId,
          research_id: id,
          type: newStatus === 'revision_required' ? 'revision_required' : 'returned_for_review',
          title: notificationTitle,
          message: notificationMessage
        });
      if (notifError) console.error('Notification error:', notifError);
    } else if (newStatus === 'pending_editor') {
      // Admin returned to Research Editor — notify all staff
      const { data: staffUsers } = await supabase
        .from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        await supabase.from('notifications').insert(
          staffUsers.map(s => ({
            user_id: s.id,
            research_id: id,
            type: 'returned_for_review',
            title: notificationTitle,
            message: notificationMessage
          }))
        );
      }
    }
    
    await recordWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole,
      status: 'revision_required',
      comments: notes,
      previousStatus: paper.status,
      newStatus,
      actionType: 'request_revision',
    });

    res.json({ 
      message: 'Revision requested successfully', 
      newStatus: newStatus,
      paper: updatedPaper 
    });
  } catch (error) {
    console.error('=== REQUEST REVISION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Get published research (public)
exports.getPublishedResearch = async (req, res) => {
  try {
    const { category, search, year, author } = req.query;
    
    let query = supabase
      .from('research_papers')
      .select(`
        *, 
        author:users!author_id (id, full_name, email),
        research_authors!research_authors_research_id_fkey (
          user_id,
          is_primary,
          author_order,
          author:users!research_authors_user_id_fkey (id, full_name, email)
        )
      `)
      .eq('status', 'approved')
      .order('published_date', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.or(`title.ilike.%${search}%,abstract.ilike.%${search}%`);
    
    // Year filter
    if (year) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      query = query.gte('published_date', yearStart).lte('published_date', yearEnd);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    let transformedPapers = papers.map(paper => ({ 
      ...paper, 
      users: paper.author,
      co_authors: paper.research_authors || []
    }));

    // Author filter (search across all authors)
    if (author) {
      transformedPapers = transformedPapers.filter(paper => {
        const authorName = author.toLowerCase();
        // Check primary author
        if (paper.users?.full_name?.toLowerCase().includes(authorName)) {
          return true;
        }
        // Check co-authors
        if (paper.co_authors?.some(ca => 
          ca.author?.full_name?.toLowerCase().includes(authorName)
        )) {
          return true;
        }
        return false;
      });
    }

    res.json({ papers: transformedPapers });
  } catch (error) {
    console.error('Get published research error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get research categories
exports.getCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase.from('research_categories').select('*').order('name');
    if (error) throw error;
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get faculty members (for student to select during submission)
exports.getFacultyMembers = async (req, res) => {
  try {
    const { department } = req.query;
    
    let query = supabase
      .from('users')
      .select('id, full_name, email, department')
      .eq('role', 'faculty')
      .order('full_name');
    
    if (department) {
      query = query.eq('department', department);
    }

    const { data: facultyMembers, error } = await query;
    if (error) throw error;
    
    res.json({ facultyMembers });
  } catch (error) {
    console.error('Get faculty members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get Program Chair members for default adviser forwarding.
// Set ?includeDean=true when a screen needs both roles for monitoring views.
exports.getDeanChairMembers = async (req, res) => {
  try {
    const { department, includeDean } = req.query;
    const roles = includeDean === 'true' ? ['dean', 'program_chair'] : ['program_chair'];

    let query = supabase
      .from('users')
      .select('id, full_name, email, role, department')
      .in('role', roles)
      .order('role')
      .order('full_name');

    if (department) {
      query = query.eq('department', department);
    }

    const { data: members, error } = await query;
    if (error) throw error;

    // Fallback: if filtering by department returned nothing, return everyone
    if (department && (!members || members.length === 0)) {
      const { data: allMembers, error: err2 } = await supabase
        .from('users')
        .select('id, full_name, email, role, department')
        .in('role', roles)
        .order('role')
        .order('full_name');
      if (err2) throw err2;
      return res.json({ members: allMembers, fallback: true });
    }

    res.json({ members, fallback: false });
  } catch (error) {
    console.error('Get dean/chair members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get papers assigned to the logged-in Dean or Program Chair
exports.getDeanChairAssignedPapers = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status } = req.query;

    const pendingStatus = userRole === 'dean' ? 'pending_dean' : 'pending_program_chair';

    if (userRole === 'dean') {
      const deanProfile = await getUserProfile(userId);

      const assignedResult = await supabase
        .from('research_papers')
        .select(`*, author:users!author_id (id, full_name, email)`)
        .eq('dean_chair_id', userId)
        .order('created_at', { ascending: false });

      if (assignedResult.error) throw assignedResult.error;

      let oversightQuery = supabase
        .from('research_papers')
        .select(`*, author:users!author_id (id, full_name, email)`)
        .eq('status', 'pending_program_chair')
        .order('created_at', { ascending: false });

      if (deanProfile.department_id) {
        oversightQuery = oversightQuery.eq('department_id', deanProfile.department_id);
      } else if (deanProfile.department) {
        oversightQuery = oversightQuery.eq('department', deanProfile.department);
      }

      const oversightResult = await oversightQuery;
      if (oversightResult.error) throw oversightResult.error;

      let papers = [...(assignedResult.data || []), ...(oversightResult.data || [])];
      papers = papers.filter((paper, index, self) => self.findIndex((item) => item.id === paper.id) === index);

      if (status) {
        papers = papers.filter((paper) => paper.status === status);
      }

      const transformedPapers = papers.map((paper) => ({ ...paper, users: paper.author }));
      return res.json({ papers: transformedPapers, pendingStatus, monitoringEnabled: true });
    }

    let query = supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .eq('dean_chair_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    const transformedPapers = papers.map((paper) => ({ ...paper, users: paper.author }));
    res.json({ papers: transformedPapers, pendingStatus, monitoringEnabled: false });
  } catch (error) {
    console.error('Get dean/chair papers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get faculty assigned papers (for faculty dashboard)
exports.getFacultyAssignedPapers = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { status } = req.query;
    
    let query = supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .eq('faculty_id', facultyId)
      .order('submission_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    const transformedPapers = papers.map(paper => ({ ...paper, users: paper.author }));
    res.json({ papers: transformedPapers });
  } catch (error) {
    console.error('Get faculty papers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.register = async (req, res) => {
  try {
    // 1. Accept 'program' from the request body
    const { email, password, fullName, role, program } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const validRoles = ['student', 'faculty', 'staff', 'admin', 'dean', 'program_chair'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // 2. Validate Program if the user is a Student
    if (role === 'student') {
        const validPrograms = ['BSIT', 'BSCS'];
        if (!program || !validPrograms.includes(program)) {
            return res.status(400).json({ error: 'Valid program (BSIT or BSCS) is required for students' });
        }
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Save the 'program' to the database
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email,
        password: hashedPassword,
        full_name: fullName,
        role,
        program: role === 'student' ? program : null // Only students need a program
      }])
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
        program: newUser.program, // Return the program info
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};