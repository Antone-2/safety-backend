import { getDb, allRows, saveDb } from '../src/lib/database.js';

const db = await getDb();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function now() {
  return new Date().toISOString();
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

const demoUserId = 'local-demo';

const insert = (table: string, data: Record<string, any>) => {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(',');
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);
  stmt.run(keys.map(k => data[k]));
  stmt.free();
};

try {
  const incidents = [
    { id: uuid(), type: 'lost_time', severity: 'high', status: 'investigating', location: 'Nairobi Plant - Mixing Bay', department: 'Production', shift: 'Day', description: 'Worker slipped on solvent spill near mixing station', reporter: 'John Kamau', reporterEmail: 'john.kamau@crownpaints.co.ke', anonymous: 0, isNearMiss: 0, assignedTo: demoUserId, slaHours: 24, dueAt: daysFromNow(2), resolutionDays: 0, rootCause: '', correctiveAction: '', preventiveAction: '', investigationMethod: '5-Why', witnessStatement: '', regulatoryNotificationRequired: 0, complianceRequired: 0, source: 'manual', auditHistory: '', createdAt: now(), updatedAt: now() },
    { id: uuid(), type: 'near_miss', severity: 'medium', status: 'open', location: 'Mombasa Plant - Warehouse', department: 'Warehouse', shift: 'Night', description: 'Forklift near-miss with pedestrian in aisle 3', reporter: 'Anonymous', reporterEmail: '', anonymous: 1, isNearMiss: 1, assignedTo: '', slaHours: 48, dueAt: daysFromNow(5), resolutionDays: 0, rootCause: '', correctiveAction: '', preventiveAction: '', investigationMethod: '', witnessStatement: '', regulatoryNotificationRequired: 0, complianceRequired: 0, source: 'manual', auditHistory: '', createdAt: now(), updatedAt: now() },
    { id: uuid(), type: 'first_aid', severity: 'low', status: 'closed', location: 'Kisumu Depot - Loading Bay', department: 'Logistics', shift: 'Day', description: 'Minor cut on hand while opening drum', reporter: 'Jane Wanjiku', reporterEmail: 'jane@crownpaints.co.ke', anonymous: 0, isNearMiss: 0, assignedTo: demoUserId, slaHours: 72, dueAt: daysFromNow(-2), resolutionDays: 1, rootCause: '', correctiveAction: '', preventiveAction: '', investigationMethod: '', witnessStatement: '', regulatoryNotificationRequired: 0, complianceRequired: 0, source: 'manual', auditHistory: '', createdAt: daysFromNow(-10), updatedAt: now() },
    { id: uuid(), type: 'unsafe_condition', severity: 'critical', status: 'open', location: 'Nairobi Plant - Grinding Area', department: 'Production', shift: 'Day', description: 'LEV system malfunction - high dust levels detected', reporter: 'Safety Officer', reporterEmail: '', anonymous: 0, isNearMiss: 0, assignedTo: demoUserId, slaHours: 4, dueAt: daysFromNow(1), resolutionDays: 0, rootCause: '', correctiveAction: '', preventiveAction: '', investigationMethod: '', witnessStatement: '', regulatoryNotificationRequired: 0, complianceRequired: 0, source: 'manual', auditHistory: '', createdAt: now(), updatedAt: now() },
    { id: uuid(), type: 'property_damage', severity: 'medium', status: 'capa_open', location: 'Eldoret Depot - Yard', department: 'Warehouse', shift: 'Day', description: 'Racking damage from forklift impact', reporter: 'Peter Mutua', reporterEmail: 'peter@crownpaints.co.ke', anonymous: 0, isNearMiss: 0, assignedTo: demoUserId, slaHours: 48, dueAt: daysFromNow(3), resolutionDays: 0, rootCause: '', correctiveAction: '', preventiveAction: '', investigationMethod: '', witnessStatement: '', regulatoryNotificationRequired: 0, complianceRequired: 0, source: 'manual', auditHistory: '', createdAt: now(), updatedAt: now() },
  ];

  const riskRegisters = [
    { id: uuid(), title: 'Solvent inhalation in mixing bay', location: 'Nairobi Plant - Mixing Bay', department: 'Production', activity: 'Pigment dispersion and mixing', hazard: 'Inhalation of solvent vapors (white spirit, xylene)', existingControls: 'LEV, enclosed mixers, PPE (respirators)', likelihood: 3, severity: 4, riskRating: 12, riskLevel: 'High', additionalControls: 'Respiratory monitoring, increased LEV maintenance', residualLikelihood: 2, residualSeverity: 3, residualRiskRating: 6, residualRiskLevel: 'Medium', reviewDate: daysFromNow(90), reviewedBy: '', status: 'Active', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
    { id: uuid(), title: 'Noise-induced hearing loss', location: 'Nairobi Plant - Grinding Area', department: 'Production', activity: 'Grinding/milling operations', hazard: 'Excessive noise from mills and conveyors', existingControls: 'Hearing protection zones, ear defenders', likelihood: 4, severity: 3, riskRating: 12, riskLevel: 'High', additionalControls: 'Noise monitoring, engineering controls', residualLikelihood: 3, residualSeverity: 2, residualRiskRating: 6, residualRiskLevel: 'Medium', reviewDate: daysFromNow(60), reviewedBy: '', status: 'Active', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
    { id: uuid(), title: 'Fire and explosion from flammable solvents', location: 'Nairobi Plant - Solvent Store', department: 'Production', activity: 'Solvent storage, mixing, filling', hazard: 'Flammable solvent storage and handling', existingControls: 'Explosion-proof equipment, bonding/grounding, fire suppression', likelihood: 2, severity: 5, riskRating: 10, riskLevel: 'High', additionalControls: 'Enhanced PTW hot work controls', residualLikelihood: 1, residualSeverity: 4, residualRiskRating: 4, residualRiskLevel: 'Low', reviewDate: daysFromNow(120), reviewedBy: '', status: 'Active', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const permits = [
    { id: uuid(), type: 'Hot Work', status: 'active', location: 'Nairobi Plant - Tank Farm', applicant: 'Demo EHS Manager', applicantContact: '', description: 'Welding repairs on solvent storage tank', startDate: now(), endDate: daysFromNow(2), hazards: JSON.stringify([{id: '1', description: 'Flammable vapors', existing_controls: 'Gas testing, fire watch'}]), precautions: 'Ensure area is well ventilated', ppeRequired: JSON.stringify(['Respirator', 'Fire-resistant coveralls']), isolationRequired: 1, isolationDetails: 'Isolate tank from supply lines', fireWatchRequired: 1, gasTestRequired: 1, gasTestResult: JSON.stringify({o2: 20.9, lel: 0, h2s: 0}), attachments: JSON.stringify([]), comments: JSON.stringify([]), createdAt: now(), updatedAt: now() },
    { id: uuid(), type: 'Confined Space', status: 'applicant', location: 'Mombasa Plant - Wastewater Tank', applicant: 'Demo EHS Manager', applicantContact: '', description: 'Entry for tank cleaning and inspection', startDate: daysFromNow(1), endDate: daysFromNow(3), hazards: JSON.stringify([{id: '1', description: 'Oxygen deficiency', existing_controls: 'Ventilation, gas testing'}]), precautions: 'Continuous gas monitoring', ppeRequired: JSON.stringify(['Gas detector', 'Harness', 'Tripod']), isolationRequired: 1, isolationDetails: '', fireWatchRequired: 0, gasTestRequired: 1, gasTestResult: JSON.stringify({o2: 21.0, lel: 0}), attachments: JSON.stringify([]), comments: JSON.stringify([]), createdAt: now(), updatedAt: now() },
  ];

  const jsas = [
    { id: uuid(), title: 'Tank cleaning - Solvent storage tank #3', description: 'Cleaning and inspection of solvent storage tank', location: 'Nairobi Plant - Tank Farm', department: 'Production', status: 'active', steps: JSON.stringify([{stepNumber: 1, description: 'Isolate tank', hazards: [{id: '1', description: 'Residual solvent', category: 'Chemical', ppeRequired: ['Gloves', 'Goggles']}], controls: [{id: '1', description: 'Lock out/tag out', type: 'Administrative'}], existingRisk: 'High', residualRisk: 'Low'}, {stepNumber: 2, description: 'Ventilate tank', hazards: [{id: '1', description: 'Oxygen deficiency', category: 'Atmospheric', ppeRequired: ['Gas detector']}], controls: [{id: '1', description: 'Forced air ventilation', type: 'Engineering'}], existingRisk: 'High', residualRisk: 'Medium'}]), createdBy: demoUserId, createdAt: now(), updatedAt: now(), reviewedBy: demoUserId, reviewedAt: now() },
  ];

  const audits = [
    { id: uuid(), title: 'ISO 45001 Surveillance Audit', type: 'External', status: 'Completed', site: 'NBO-IA', department: 'Production', leadAuditor: 'External Auditor', teamMembers: '', startDate: '2026-03-01', endDate: '2026-03-05', scope: 'Full OH&S management system', criteria: 'ISO 45001:2018', findings: JSON.stringify([{id: '1', description: 'Training records not up to date', type: 'Minor NC'}]), summary: 'Minor nonconformity identified in training records. Corrective action plan submitted.', reportUrl: '', reportPublished: 1, createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const trainingCourses = [
    { id: uuid(), title: 'Confined Space Entry', code: 'CSE-101', category: 'safety', description: 'Entry into confined spaces with atmospheric monitoring', duration: 8, frequency: 'Annually', validityMonths: 12, competencyRequired: '', passingScore: 80, isMandatory: 1, status: 'active', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
    { id: uuid(), title: 'Hot Work Safety', code: 'HW-101', category: 'safety', description: 'Safe work practices for hot work operations', duration: 4, frequency: 'Annually', validityMonths: 12, competencyRequired: '', passingScore: 70, isMandatory: 1, status: 'active', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const trainingRecords = [
    { id: uuid(), recordNumber: 'TRN-REC-2026-001', courseId: trainingCourses[0].id, employeeId: demoUserId, employeeName: 'Demo EHS Manager', department: 'HSE', site: 'NBO-IA', status: 'completed', scheduledDate: '2026-01-15', startDate: now(), completionDate: '2026-01-15', expiryDate: daysFromNow(365), trainer: 'Internal Trainer', trainingProvider: '', location: 'Nairobi Training Room', score: 92, passed: 1, resultNotes: '', certificateUrl: '', feedback: '', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const ppeEquipment = [
    { id: uuid(), ppeNumber: 'PPE-2026-001', type: 'respirator', description: 'Full face respirator for solvent handling', siteId: 1, departmentId: 3, assignedTo: demoUserId, assignedDate: '2026-01-01', issuedBy: demoUserId, condition: 'good', nextInspectionDate: daysFromNow(30), status: 'issued', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
    { id: uuid(), ppeNumber: 'PPE-2026-002', type: 'safety_shoes', description: 'Steel toe safety shoes', siteId: 1, departmentId: 3, assignedTo: '', assignedDate: '', issuedBy: '', condition: 'new', nextInspectionDate: '', status: 'available', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const emergencyPlans = [
    { id: uuid(), planNumber: 'EP-2026-001', title: 'Solvent Fire Emergency Plan', scenario: 'fire', siteId: 1, departmentId: 3, procedures: JSON.stringify([{step: 1, action: 'Activate fire alarm'}, {step: 2, action: 'Evacuate area'}, {step: 3, action: 'Close isolation valves'}]), emergencyContacts: JSON.stringify([{name: 'Fire Warden', phone: '+254700000001'}]), assemblyPoints: JSON.stringify([{name: 'Main Assembly Point', location: 'Car park'}]), lastReviewedDate: '2026-01-01', nextReviewDate: daysFromNow(365), lastDrillDate: '2025-12-15', status: 'published', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const drills = [
    { id: uuid(), drillNumber: 'DRL-2026-001', title: 'Annual Fire Drill', type: 'fire', siteId: 1, departmentId: 3, scheduledDate: '2026-03-15', actualDate: '2026-03-15', participants: JSON.stringify([{id: demoUserId, name: 'Demo EHS Manager'}]), durationMinutes: 30, scenario: 'Fire in solvent storage area', findings: JSON.stringify([{observation: 'Evacuation completed in 4 minutes', status: 'positive'}]), coordinatorId: demoUserId, status: 'completed', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const emergencyContacts = [
    { id: uuid(), contactNumber: 'EC-2026-001', name: 'Fire Warden - Nairobi', role: 'fire_warden', siteId: 1, departmentId: 3, phone: '+254700000001', email: 'fire.warden@crownpaints.co.ke', isPrimary: 1, isErt: 1, notes: '', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
    { id: uuid(), contactNumber: 'EC-2026-002', name: 'Company Nurse', role: 'medical_officer', siteId: 1, departmentId: 10, phone: '+254700000002', email: 'nurse@crownpaints.co.ke', isPrimary: 1, isErt: 0, notes: '', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const fireEquipment = [
    { id: uuid(), type: 'Extinguisher', location: 'Nairobi Plant - Mixing Bay', building: 'Production Block A', floor: 'Ground', assetTag: 'FE-001', manufacturer: 'Chubb', model: 'ABC-10', installationDate: '2024-01-01', lastInspectionDate: '2026-01-01', nextInspectionDate: daysFromNow(90), inspectionFrequency: 'Monthly', status: 'Serviceable', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
    { id: uuid(), type: 'Hydrant', location: 'Nairobi Plant - Main Entrance', building: 'Main Gate', floor: 'Ground', assetTag: 'FH-001', manufacturer: 'Neilson', model: 'NH-100', installationDate: '2023-06-01', lastInspectionDate: '2025-12-01', nextInspectionDate: daysFromNow(60), inspectionFrequency: 'Quarterly', status: 'Serviceable', createdBy: demoUserId, createdAt: now(), updatedAt: now() },
  ];

  const wasteRecords = [
    { id: uuid(), waste_number: 'WASTE-2026-001', waste_type: 'hazardous', category: 'Chemical Waste', description: 'Used solvent mixture from cleaning', quantity: 50, unit: 'L', generated_date: '2026-03-01', stored_location: 'Hazardous Store', generated_at_site_id: 1, generated_by_department_id: 3, generated_by: demoUserId, disposal_method: 'Incineration', disposal_contractor: 'Licensed waste contractor', manifest_number: 'MAN-2026-001', status: 'stored', created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  const chemicals = [
    { id: uuid(), chemical_number: 'CHEM-2026-001', name: 'White Spirit', cas_number: '8032-32-4', formula: 'C7-C12 aliphatic hydrocarbons', quantity_on_hand: 500, unit: 'L', storage_location: 'Solvent Store', hazard_class: 'flammable', signal_word: 'Danger', pictograms: JSON.stringify(['flame', 'exclamation']), sds_url: 'https://example.com/sds/white-spirit.pdf', flash_point: 21, supplier_name: 'Local Supplier', emergency_contact: '+254700000000', spill_procedures: 'Contain spill, absorb with inert material', first_aid_measures: 'Inhalation: move to fresh air', site_id: 1, department_id: 3, notes: 'Main solvent used in production', created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  const healthRecords = [
    { id: uuid(), surveillance_number: 'HS-2026-001', employeeId: demoUserId, employeeName: 'Demo EHS Manager', department: 'HSE', site: 'NBO-IA', type: 'audiometric', examination_date: '2026-01-15', next_due_date: daysFromNow(365), frequency_months: 12, results: 'Normal hearing thresholds', findings: JSON.stringify({leftEar: 'Normal', rightEar: 'Normal'}), restrictions: '', fitness_for_work: 'fit', doctor_name: 'Dr. Smith', clinic_name: 'Crown Medical Centre', report_url: '', notes: '', created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  const equipment = [
    { id: uuid(), name: 'Forklift - Toyota 8FG25', type: 'Forklift', category: 'Material Handling', asset_tag: 'FL-001', serial_number: 'SN12345', manufacturer: 'Toyota', model: '8FG25', location: 'Warehouse', site: 'NBO-IA', department: 'Warehouse', purchase_date: '2022-01-01', installation_date: '2022-01-15', last_inspection_date: '2026-01-15', next_inspection_date: daysFromNow(90), inspection_frequency: 'Monthly', status: 'Operational', condition: 'good', notes: '', created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  const documents = [
    { id: uuid(), document_number: 'DOC-2026-001', title: 'HSE Policy Statement', code: 'HSE-POL-001', category: 'hsse_policy', type: 'policy', version: '2.0', status: 'approved', content: 'Crown Paints is committed to providing a safe and healthy workplace...', author_id: demoUserId, reviewer_id: demoUserId, approver_id: demoUserId, effective_date: '2026-01-01', expiry_date: daysFromNow(1095), site_id: 1, department_id: 3, tags: JSON.stringify(['policy', 'hse']), parent_id: '', created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  const contractors = [
    { id: uuid(), contractor_number: 'CON-2026-001', company_name: 'SafeWork Contractors Ltd', registration_number: 'REG/12345', contact_person: 'James Mwangi', contact_email: 'james@safework.co.ke', contact_phone: '+254700000100', physical_address: 'Nairobi, Kenya', services: 'Electrical maintenance, mechanical repairs', certifications: JSON.stringify(['NCA', 'ISO 45001']), insurance_expiry: daysFromNow(180), safety_rating: '4', status: 'active', induction_date: '2026-01-01', induction_expiry: daysFromNow(365), created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  const objectives = [
    { id: uuid(), objective_number: 'OBJ-2026-001', title: 'Reduce TRIR to below 2.0', description: 'Reduce Total Recordable Injury Rate from current baseline to below 2.0 within 24 months', category: 'safety', site_id: 1, department_id: 3, owner_id: demoUserId, target_value: 2.0, current_value: 3.5, unit: 'ratio', baseline_value: 3.5, start_date: '2026-01-01', end_date: '2027-12-31', status: 'in_progress', progress_percentage: 35, created_by: demoUserId, created_at: now(), updated_at: now() },
  ];

  for (const inc of incidents) insert('incidents', inc);
  console.log('Inserted incidents');
  for (const rr of riskRegisters) insert('risk_registers', rr);
  console.log('Inserted risk_registers');
  for (const p of permits) insert('permits', p);
  console.log('Inserted permits');
  for (const j of jsas) insert('jsas', j);
  console.log('Inserted jsas');
  for (const a of audits) insert('audits', a);
  console.log('Inserted audits');
  for (const c of trainingCourses) insert('training_courses', c);
  console.log('Inserted training_courses');
  for (const r of trainingRecords) insert('training_records', r);
  console.log('Inserted training_records');
  for (const ppe of ppeEquipment) insert('ppe_equipment', ppe);
  console.log('Inserted ppe_equipment');
  for (const ep of emergencyPlans) insert('emergency_plans', ep);
  console.log('Inserted emergency_plans');
  for (const d of drills) insert('drills', d);
  console.log('Inserted drills');
  for (const ec of emergencyContacts) insert('emergency_contacts', ec);
  console.log('Inserted emergency_contacts');
  for (const fe of fireEquipment) insert('fire_equipment', fe);
  console.log('Inserted fire_equipment');
  for (const w of wasteRecords) insert('waste_records', w);
  console.log('Inserted waste_records');
  for (const c of chemicals) insert('chemicals', c);
  console.log('Inserted chemicals');
  for (const h of healthRecords) insert('health_surveillance', h);
  console.log('Inserted health_surveillance');
  for (const e of equipment) insert('equipment', e);
  console.log('Inserted equipment');
  for (const doc of documents) insert('documents', doc);
  console.log('Inserted documents');
  for (const con of contractors) insert('contractors', con);
  console.log('Inserted contractors');
  for (const o of objectives) insert('hse_objectives', o);
  console.log('Inserted hse_objectives');

  await saveDb(db);
  console.log('Seed data inserted successfully');

  const counts: Record<string, number> = {};
  const tables = allRows(db, "SELECT name FROM sqlite_master WHERE type='table'");
  for (const t of tables) {
    counts[t.name] = allRows(db, 'SELECT COUNT(*) as c FROM ' + t.name)[0].c;
  }
  console.log('Updated row counts:', JSON.stringify(counts, null, 2));
} catch (error) {
  console.error('Seed failed:', error);
  process.exit(1);
}
