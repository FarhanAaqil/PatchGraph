import React from 'react';

export interface PackageRow {
  ecosystem: string;
  normalized_name: string;
  version: string;
  purl: string;
}

export const PackagesPage: React.FC<{ items?: PackageRow[] }> = ({ items = [] }) => (
  <section aria-labelledby="packages-heading">
    <h1 id="packages-heading">Normalized Package Inventory</h1>
    <table aria-label="Normalized Packages">
      <thead>
        <tr>
          <th>Ecosystem</th>
          <th>Canonical Name</th>
          <th>Version</th>
          <th>Package URL (purl)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((pkg) => (
          <tr key={pkg.purl}>
            <td>{pkg.ecosystem}</td>
            <td>
              <code>{pkg.normalized_name}</code>
            </td>
            <td>
              <code>{pkg.version}</code>
            </td>
            <td>
              <code>{pkg.purl}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
export default PackagesPage;
