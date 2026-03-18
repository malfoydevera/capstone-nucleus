const {
  canAccessPaper,
  extractStoragePathFromUrl,
  isPublicPaperStatus,
} = require('../../utils/fileAccess');

describe('fileAccess utils', () => {
  test('detects public paper statuses', () => {
    expect(isPublicPaperStatus('approved')).toBe(true);
    expect(isPublicPaperStatus('published')).toBe(true);
    expect(isPublicPaperStatus('pending_admin')).toBe(false);
  });

  test('extracts storage path from Supabase public URL', () => {
    const path = extractStoragePathFromUrl(
      'https://demo.supabase.co/storage/v1/object/public/research-papers/u1/file.pdf'
    );

    expect(path).toBe('u1/file.pdf');
  });

  test('returns null for invalid URLs', () => {
    expect(extractStoragePathFromUrl('not-a-url')).toBeNull();
  });

  test('allows access for assigned faculty and blocks unrelated student', () => {
    const paper = {
      status: 'pending_faculty',
      author_id: 'author-1',
      faculty_id: 'faculty-1',
      dean_chair_id: 'dean-1',
    };

    const allowed = canAccessPaper({ id: 'faculty-1', role: 'faculty' }, paper);
    const blocked = canAccessPaper({ id: 'student-2', role: 'student' }, paper);

    expect(allowed).toBe(true);
    expect(blocked).toBe(false);
  });
});
