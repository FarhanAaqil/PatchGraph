import React from 'react';

export const RecoveryActions: React.FC<{ lastBackupSha256?: string }> = ({ lastBackupSha256 = 'verified' }) => (
  <div aria-label="Database Backup and Restore Controls" data-testid="recovery-actions">
    <h4>Database Recovery & Snapshot Verification</h4>
    <p>Last Verified Backup SHA-256: <code>{lastBackupSha256}</code></p>
  </div>
);
export default RecoveryActions;
