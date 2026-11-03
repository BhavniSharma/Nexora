export default function AuditRecords({ records }) {
  if (!records) return null;
  if (records.length === 0) {
    return <p>No audit records for this incident.</p>;
  }

  return records.map((record) => (
    <div key={record.id} className="audit-record">
      <p><strong>Action:</strong> {record.action}</p>
      <p><strong>Result:</strong> {record.result}</p>
      <p><strong>Mode:</strong> {record.mode}</p>
      <p>
        <strong>Executed:</strong> {record.executed ? "Yes" : "No"}
      </p>
      <p><strong>Time:</strong> {record.created_at}</p>
      {record.message && <p>{record.message}</p>}
    </div>
  ));
}
