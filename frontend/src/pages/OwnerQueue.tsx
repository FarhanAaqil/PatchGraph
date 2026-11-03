import React from 'react';

export const OwnerQueuePage: React.FC<{ queues?: Record<string, Array<{ finding_id: string; service: string; final_score: number }>> }> = ({
  queues = { 'payments-team@patchgraph.local': [{ finding_id: 'finding_seed_01', service: 'checkout', final_score: 10.57 }] },
}) => (
  <section aria-labelledby="owner-queue-heading">
    <h1 id="owner-queue-heading">Service & Team Ownership Routing</h1>
    {Object.entries(queues).map(([owner, items]) => (
      <div key={owner}>
        <h2>Owner: <code>{owner}</code> ({items.length} findings)</h2>
      </div>
    ))}
  </section>
);
export default OwnerQueuePage;
