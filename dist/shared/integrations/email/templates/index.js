export function buildCapaReminderHtml(capaId, dueDate, action) {
    return `
    <p>This is a reminder that CAPA <strong>${capaId}</strong> is due on <strong>${dueDate}</strong>.</p>
    <p><strong>Action:</strong> ${action}</p>
    <p>Please ensure this corrective action is completed on time.</p>
  `;
}
export function buildIncidentAlertHtml(incident) {
    return `
    <p>A <strong>${incident.severity.toLowerCase()}</strong> incident was reported in the EHS system.</p>
    <ul>
      <li><strong>Report ID:</strong> ${incident.id}</li>
      <li><strong>Date:</strong> ${incident.date}</li>
      <li><strong>Location:</strong> ${incident.location}</li>
      <li><strong>Description:</strong> ${incident.description}</li>
    </ul>
    <p>Please review this incident and follow the required response workflow.</p>
  `;
}
export function buildAssignmentHtml(incident, assignee) {
    return `
    <p>Report <strong>${incident.id}</strong> has been assigned to <strong>${assignee}</strong>.</p>
    <ul>
      <li><strong>Severity:</strong> ${incident.severity}</li>
      <li><strong>Location:</strong> ${incident.location}</li>
      <li><strong>Description:</strong> ${incident.description}</li>
    </ul>
  `;
}
