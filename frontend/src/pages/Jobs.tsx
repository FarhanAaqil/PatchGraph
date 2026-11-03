import React from 'react';

export const JobsPage: React.FC = () => (
  <section aria-labelledby="jobs-heading">
    <h1 id="jobs-heading">Scheduled Evidence Refresh Jobs</h1>
    <p>Idempotent background jobs with exponential backoff and pinned-snapshot fallback.</p>
  </section>
);
export default JobsPage;
