require('dotenv').config();

const supabase = require('../src/config/supabase');

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('relation') && message.includes('does not exist');
}

function isMissingColumnError(error, column) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') && message.includes(String(column).toLowerCase()) && message.includes('does not exist');
}

async function checkTable(tableName, migration) {
  const { error } = await supabase.from(tableName).select('id').limit(1);

  if (error && isMissingTableError(error)) {
    return {
      ok: false,
      type: 'table',
      tableName,
      migration,
      error: error.message,
    };
  }

  if (error) {
    return {
      ok: false,
      type: 'table',
      tableName,
      migration,
      error: error.message,
    };
  }

  return { ok: true, type: 'table', tableName, migration };
}

async function checkColumn(tableName, columnName, migration) {
  const { error } = await supabase.from(tableName).select(columnName).limit(1);

  if (error && isMissingColumnError(error, columnName)) {
    return {
      ok: false,
      type: 'column',
      tableName,
      columnName,
      migration,
      error: error.message,
    };
  }

  if (error && isMissingTableError(error)) {
    return {
      ok: false,
      type: 'column',
      tableName,
      columnName,
      migration,
      error: error.message,
    };
  }

  if (error) {
    return {
      ok: false,
      type: 'column',
      tableName,
      columnName,
      migration,
      error: error.message,
    };
  }

  return { ok: true, type: 'column', tableName, columnName, migration };
}

async function runChecks() {
  const checks = [
    () => checkTable('submission_drafts', 'add_submission_drafts.sql'),
    () => checkColumn('research_papers', 'deleted_at', 'schema_full.sql or add_soft_delete.sql'),
    () => checkColumn('users', 'is_active', 'add_user_name_fields_remove_profile_columns.sql / add_user_suspension.sql'),
    () => checkColumn('users', 'suspended_at', 'add_user_name_fields_remove_profile_columns.sql / add_user_suspension.sql'),
    () => checkColumn('research_papers', 'review_deadline_at', 'add_review_deadlines.sql'),
    () => checkColumn('research_papers', 'deadline_reminder_last_sent_at', 'add_review_deadlines.sql'),
    () => checkTable('system_policy_settings', 'add_system_policy_settings.sql'),
    () => checkTable('workflow_stages', 'add_workflow_stages.sql'),
    () => checkTable('co_author_invitations', 'add_co_author_invitations.sql'),
    () => checkTable('faculty_conflict_declarations', 'add_conflict_of_interest.sql'),
    () => checkColumn('research_papers', 'plagiarism_status', 'add_plagiarism_checks.sql'),
    () => checkColumn('research_papers', 'plagiarism_score', 'add_plagiarism_checks.sql'),
    () => checkColumn('research_papers', 'embedding', 'add_semantic_search.sql'),
    () => checkColumn('research_papers', 'embedding_source_hash', 'add_semantic_search.sql'),
  ];

  const results = [];
  for (const runCheck of checks) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runCheck());
  }

  const failed = results.filter((item) => !item.ok);

  console.log('Migration health check results:');
  if (failed.length === 0) {
    console.log('All required tables/columns are available.');
    process.exit(0);
  }

  failed.forEach((item) => {
    if (item.type === 'table') {
      console.log(`- Missing/invalid table ${item.tableName} -> apply ${item.migration}`);
    } else {
      console.log(`- Missing/invalid column ${item.tableName}.${item.columnName} -> apply ${item.migration}`);
    }
    console.log(`  Error: ${item.error}`);
  });

  process.exit(1);
}

runChecks().catch((error) => {
  console.error('Migration health check failed unexpectedly:', error.message || error);
  process.exit(1);
});
