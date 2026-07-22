import { saveDb } from "./database.js";

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  appliedAt TEXT NOT NULL
)`;

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_create_reports",
    sql: `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      reporter TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Low','Medium','High','Critical')),
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Closed')),
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Unsafe Act','Unsafe Condition')),
      resolutionDays INTEGER,
      slaHours INTEGER NOT NULL,
      dueAt TEXT NOT NULL,
      assignedTo TEXT,
      isNearMiss INTEGER NOT NULL DEFAULT 0,
      anonymous INTEGER NOT NULL DEFAULT 0,
      department TEXT NOT NULL,
      shift TEXT NOT NULL,
      complianceRequired INTEGER NOT NULL DEFAULT 0,
      complianceDueAt TEXT,
      photoUrl TEXT NOT NULL
    )`,
  },
  {
    name: "002_create_comments",
    sql: `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      author TEXT NOT NULL,
      at TEXT NOT NULL,
      text TEXT NOT NULL
    )`,
  },
  {
    name: "003_create_capa",
    sql: `CREATE TABLE IF NOT EXISTS capa (
      id TEXT PRIMARY KEY,
      incidentId TEXT NOT NULL,
      rootCause TEXT NOT NULL,
      action TEXT NOT NULL,
      owner TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Completed','Verified')),
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Critical'))
    )`,
  },
  {
    name: "004_create_settings",
    sql: `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
  {
    name: "005_create_users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('EHS-manager','gm','plant-manager','factory-manager','depot-admin')),
      createdAt TEXT NOT NULL
    )`,
  },
  {
    name: "006_migrate_legacy_user_roles",
    sql: `UPDATE users SET role = 'EHS-manager' WHERE role IN ('admin','manager');
          UPDATE users SET role = 'factory-manager' WHERE role = 'supervisor';
          UPDATE users SET role = 'depot-admin' WHERE role = 'user';`,
  },
  {
    name: "007_alter_users_role_constraint",
    sql: `CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('super-admin','EHS-manager','gm','plant-manager','factory-manager','depot-admin')),
            createdAt TEXT NOT NULL
          );
          INSERT OR IGNORE INTO users_new (id, email, passwordHash, name, role, createdAt)
          SELECT id, email, passwordHash, name, role, createdAt FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    name: "008_create_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
          CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
          CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(location);
          CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
          CREATE INDEX IF NOT EXISTS idx_comments_reportId ON comments(reportId);
          CREATE INDEX IF NOT EXISTS idx_capa_incidentId ON capa(incidentId);
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    name: "009_create_notifications",
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    )`,
  },
  {
    name: "010_create_report_audit",
    sql: `CREATE TABLE IF NOT EXISTS report_audit (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      createdAt TEXT NOT NULL
    )`,
  },
  {
    name: "011_add_report_source",
    sql: `ALTER TABLE reports ADD COLUMN source TEXT NOT NULL DEFAULT 'google-sheets'`,
  },
  {
    name: "012_create_reporter_points",
    sql: `CREATE TABLE IF NOT EXISTS reporter_points (
      month TEXT NOT NULL,
      reporter TEXT NOT NULL,
      reportCount INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (month, reporter)
    )`,
  },
  {
    name: "013_create_leaderboard_awards",
    sql: `CREATE TABLE IF NOT EXISTS leaderboard_awards (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      reporter TEXT NOT NULL,
      rank INTEGER NOT NULL,
      reportCount INTEGER NOT NULL,
      points INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(month, reporter, rank)
    )`,
  },
  {
    name: "014_create_leaderboard_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_reporter_points_month ON reporter_points(month);
          CREATE INDEX IF NOT EXISTS idx_reporter_points_reporter ON reporter_points(reporter);
          CREATE INDEX IF NOT EXISTS idx_leaderboard_awards_month ON leaderboard_awards(month);
          CREATE INDEX IF NOT EXISTS idx_leaderboard_awards_reporter ON leaderboard_awards(reporter);`,
  },
  {
    name: "015_add_assigned_to_copy",
    sql: `ALTER TABLE reports ADD COLUMN assignedToCopy TEXT`,
  },
  {
    name: "016_allow_new_roles",
    sql: `CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('super-admin','EHS-manager','she-committee-member','supervisor','gm','plant-manager','factory-manager','depot-admin')),
            createdAt TEXT NOT NULL
          );
          INSERT OR IGNORE INTO users_new (id, email, passwordHash, name, role, createdAt)
          SELECT id, email, passwordHash, name, role, createdAt FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    name: "017_alter_capa_add_fields",
    sql: `ALTER TABLE capa ADD COLUMN title TEXT NOT NULL DEFAULT '';
          ALTER TABLE capa ADD COLUMN capaType TEXT NOT NULL DEFAULT 'Corrective' CHECK(capaType IN ('Corrective','Preventive'));
          ALTER TABLE capa ADD COLUMN rootCauseMethod TEXT;
          ALTER TABLE capa ADD COLUMN rootCauseConclusion TEXT;
          ALTER TABLE capa ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';
          ALTER TABLE capa ADD COLUMN closureEvidence TEXT;
          ALTER TABLE capa ADD COLUMN createdAt TEXT NOT NULL DEFAULT '';
          ALTER TABLE capa ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '';`,
  },
  {
    name: "018_create_investigations",
    sql: `CREATE TABLE IF NOT EXISTS investigations (
          id TEXT PRIMARY KEY,
          incidentId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          investigator TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Completed','Closed')),
          priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Critical')),
          evidence TEXT NOT NULL DEFAULT '[]',
          rootCause TEXT,
          correctiveActions TEXT,
          dueDate TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )`,
  },
  {
    name: "019_create_investigations_index",
    sql: `CREATE INDEX IF NOT EXISTS idx_investigations_incidentId ON investigations(incidentId);`,
  },
  {
    name: "019b_add_investigation_form",
    sql: `ALTER TABLE investigations ADD COLUMN incidentForm TEXT;`,
  },
  {
    name: "020_create_permits",
    sql: `CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('Hot Work','Cold Work','Confined Space','Electrical','Excavation','Height Work','General')),
      status TEXT NOT NULL DEFAULT 'applicant' CHECK(status IN ('applicant','supervisor','EHS','issuer','approval','active','closed')),
      location TEXT NOT NULL,
      applicant TEXT NOT NULL,
      applicantContact TEXT,
      supervisor TEXT,
      EHSOfficer TEXT,
      issuer TEXT,
      approver TEXT,
      description TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      hazards TEXT,
      precautions TEXT,
      ppeRequired TEXT NOT NULL DEFAULT '[]',
      isolationRequired INTEGER NOT NULL DEFAULT 0,
      isolationDetails TEXT,
      fireWatchRequired INTEGER NOT NULL DEFAULT 0,
      gasTestRequired INTEGER NOT NULL DEFAULT 0,
      gasTestResult TEXT,
      attachments TEXT NOT NULL DEFAULT '[]',
      comments TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "021_create_permits_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_permits_type ON permits(type);
          CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
          CREATE INDEX IF NOT EXISTS idx_permits_location ON permits(location);
          CREATE INDEX IF NOT EXISTS idx_permits_applicant ON permits(applicant);
          CREATE INDEX IF NOT EXISTS idx_permits_startDate ON permits(startDate);
          CREATE INDEX IF NOT EXISTS idx_permits_endDate ON permits(endDate);`,
  },
  {
    name: "022_create_jsa",
    sql: `CREATE TABLE IF NOT EXISTS jsa (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in-review','active','completed','archived')),
      steps TEXT NOT NULL DEFAULT '[]',
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      reviewedBy TEXT,
      reviewedAt TEXT
    )`,
  },
  {
    name: "023_create_risk_matrices",
    sql: `CREATE TABLE IF NOT EXISTS risk_matrices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      likelihoodScale TEXT NOT NULL DEFAULT '{}',
      severityScale TEXT NOT NULL DEFAULT '{}',
      levels TEXT NOT NULL DEFAULT '[]',
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "024_create_jsa_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_jsa_location ON jsa(location);
          CREATE INDEX IF NOT EXISTS idx_jsa_department ON jsa(department);
          CREATE INDEX IF NOT EXISTS idx_jsa_status ON jsa(status);
          CREATE INDEX IF NOT EXISTS idx_risk_matrices_name ON risk_matrices(name);`,
  },
  {
    name: "025_create_incidents",
    sql: `CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'Unsafe Act',
      severity TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Open',
      location TEXT NOT NULL,
      department TEXT NOT NULL,
      shift TEXT NOT NULL,
      description TEXT NOT NULL,
      reporter TEXT NOT NULL,
      reporterEmail TEXT,
      reporterPhone TEXT,
      anonymous INTEGER NOT NULL DEFAULT 0,
      isNearMiss INTEGER NOT NULL DEFAULT 0,
      photoUrl TEXT,
      photos TEXT NOT NULL DEFAULT '[]',
      assignedTo TEXT,
      assignedToCopy TEXT,
      slaHours INTEGER NOT NULL DEFAULT 24,
      dueAt TEXT,
      resolutionDays INTEGER,
      rootCause TEXT,
      correctiveAction TEXT,
      preventiveAction TEXT,
      investigationMethod TEXT,
      witnessStatement TEXT,
      regulatoryNotificationRequired INTEGER NOT NULL DEFAULT 0,
      regulatoryNotificationDate TEXT,
      complianceRequired INTEGER NOT NULL DEFAULT 0,
      complianceDueAt TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      auditHistory TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "026_create_risk_registers",
    sql: `CREATE TABLE IF NOT EXISTS risk_registers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      department TEXT NOT NULL,
      activity TEXT NOT NULL,
      hazard TEXT NOT NULL,
      existingControls TEXT NOT NULL,
      likelihood INTEGER NOT NULL,
      severity INTEGER NOT NULL,
      riskRating INTEGER NOT NULL,
      riskLevel TEXT NOT NULL,
      additionalControls TEXT,
      residualLikelihood INTEGER,
      residualSeverity INTEGER,
      residualRiskRating INTEGER,
      residualRiskLevel TEXT,
      reviewDate TEXT,
      reviewedBy TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "027_create_bow_ties",
    sql: `CREATE TABLE IF NOT EXISTS bow_ties (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topEvent TEXT NOT NULL,
      threats TEXT,
      preventiveBarriers TEXT,
      consequences TEXT,
      recoveryBarriers TEXT,
      location TEXT NOT NULL,
      department TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "028_create_permits",
    sql: `CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      location TEXT NOT NULL,
      applicant TEXT NOT NULL,
      applicantContact TEXT,
      supervisor TEXT,
      ehsOfficer TEXT,
      issuer TEXT,
      approver TEXT,
      description TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      hazards TEXT,
      precautions TEXT,
      ppeRequired TEXT NOT NULL DEFAULT '[]',
      isolationRequired INTEGER NOT NULL DEFAULT 0,
      isolationDetails TEXT,
      fireWatchRequired INTEGER NOT NULL DEFAULT 0,
      gasTestRequired INTEGER NOT NULL DEFAULT 0,
      gasTestResult TEXT,
      gasTestBefore TEXT,
      gasTestAfter TEXT,
      fireWatchAssigned TEXT,
      attachments TEXT NOT NULL DEFAULT '[]',
      comments TEXT NOT NULL DEFAULT '[]',
      linkedJsaId TEXT,
      linkedIncidentId TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "029_create_training_tables",
    sql: `CREATE TABLE IF NOT EXISTS training_courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL,
      frequency TEXT NOT NULL,
      validityMonths INTEGER,
      competencyRequired TEXT,
      passingScore INTEGER NOT NULL DEFAULT 80,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_records (
      id TEXT PRIMARY KEY,
      courseId TEXT NOT NULL,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      department TEXT NOT NULL,
      site TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      scheduledDate TEXT NOT NULL,
      completedDate TEXT,
      trainer TEXT,
      score INTEGER,
      passed INTEGER,
      certificateUrl TEXT,
      expiryDate TEXT,
      feedback TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_matrices (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      courseId TEXT NOT NULL,
      frequency TEXT NOT NULL,
      mandatory INTEGER NOT NULL DEFAULT 1,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "030_create_environmental_tables",
    sql: `CREATE TABLE IF NOT EXISTS waste_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      generatedDate TEXT NOT NULL,
      storedLocation TEXT NOT NULL,
      disposedDate TEXT,
      disposalMethod TEXT,
      disposalContractor TEXT,
      manifestNumber TEXT,
      status TEXT NOT NULL DEFAULT 'Stored',
      photoUrl TEXT,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emissions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      parameter TEXT NOT NULL,
      location TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      "limit" REAL,
      monitoredDate TEXT NOT NULL,
      monitoredBy TEXT NOT NULL,
      equipment TEXT,
      correctiveAction TEXT,
      status TEXT NOT NULL DEFAULT 'Within Limit',
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chemicals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      casNumber TEXT,
      formula TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      storageLocation TEXT NOT NULL,
      hazardClass TEXT,
      sdsUrl TEXT,
      expiryDate TEXT,
      supplier TEXT,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spills (
      id TEXT PRIMARY KEY,
      chemical TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      severity TEXT NOT NULL,
      affectedArea TEXT,
      responseActions TEXT,
      cleanupCompleted INTEGER NOT NULL DEFAULT 0,
      cleanupDate TEXT,
      reportedToNema INTEGER NOT NULL DEFAULT 0,
      nemaReportDate TEXT,
      photoUrl TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "031_create_esg_tables",
    sql: `CREATE TABLE IF NOT EXISTS carbon_emissions (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      scope TEXT NOT NULL,
      source TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      co2Equivalent REAL NOT NULL,
      period TEXT NOT NULL,
      recordedDate TEXT NOT NULL,
      site TEXT NOT NULL,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS energy_records (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      consumption REAL NOT NULL,
      unit TEXT NOT NULL,
      cost REAL,
      period TEXT NOT NULL,
      recordedDate TEXT NOT NULL,
      site TEXT NOT NULL,
      meterReading REAL,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS water_records (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      consumption REAL NOT NULL,
      unit TEXT NOT NULL,
      cost REAL,
      period TEXT NOT NULL,
      recordedDate TEXT NOT NULL,
      site TEXT NOT NULL,
      recycled REAL,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "032_create_documents_table",
    sql: `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      code TEXT,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      content TEXT,
      fileUrl TEXT,
      fileName TEXT,
      fileSize INTEGER,
      mimeType TEXT,
      author TEXT NOT NULL,
      reviewer TEXT,
      approver TEXT,
      reviewDate TEXT,
      approvalDate TEXT,
      effectiveDate TEXT NOT NULL,
      expiryDate TEXT,
      site TEXT NOT NULL,
      department TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      parentId TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "033_create_equipment_tables",
    sql: `CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      assetTag TEXT NOT NULL,
      serialNumber TEXT,
      manufacturer TEXT,
      model TEXT,
      location TEXT NOT NULL,
      site TEXT NOT NULL,
      department TEXT NOT NULL,
      purchaseDate TEXT,
      installationDate TEXT,
      warrantyExpiry TEXT,
      lastInspectionDate TEXT,
      nextInspectionDate TEXT,
      inspectionFrequency TEXT,
      status TEXT NOT NULL DEFAULT 'Operational',
      condition TEXT,
      assignedTo TEXT,
      notes TEXT,
      photoUrl TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS equipment_inspections (
      id TEXT PRIMARY KEY,
      equipmentId TEXT NOT NULL,
      inspector TEXT NOT NULL,
      inspectionDate TEXT NOT NULL,
      inspectionType TEXT NOT NULL,
      findings TEXT,
      defects TEXT,
      actionRequired TEXT,
      passed INTEGER NOT NULL,
      nextInspectionDue TEXT NOT NULL,
      photoUrl TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "034_create_health_surveillance",
    sql: `CREATE TABLE IF NOT EXISTS health_surveillance (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      department TEXT NOT NULL,
      site TEXT NOT NULL,
      type TEXT NOT NULL,
      examinationDate TEXT NOT NULL,
      nextDueDate TEXT NOT NULL,
      frequency TEXT NOT NULL,
      results TEXT,
      findings TEXT,
      restrictions TEXT,
      fitnessForWork INTEGER NOT NULL,
      doctorName TEXT NOT NULL,
      doctorRegistration TEXT,
      clinicName TEXT,
      reportUrl TEXT,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "035_create_governance_tables",
    sql: `CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      layout TEXT,
      widgets TEXT,
      filters TEXT,
      site TEXT,
      department TEXT,
      role TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports_def (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'PDF',
      parameters TEXT,
      schedule TEXT,
      recipients TEXT,
      lastGenerated TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      resource TEXT NOT NULL,
      actions TEXT NOT NULL,
      conditions TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      actorRole TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resourceId TEXT,
      details TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "036_create_contractors_tables",
    sql: `CREATE TABLE IF NOT EXISTS contractors (
      id TEXT PRIMARY KEY,
      companyName TEXT NOT NULL,
      registrationNumber TEXT NOT NULL,
      contactPerson TEXT NOT NULL,
      contactEmail TEXT NOT NULL,
      contactPhone TEXT NOT NULL,
      physicalAddress TEXT,
      services TEXT,
      certifications TEXT,
      insuranceExpiry TEXT,
      safetyRating REAL,
      incidents INTEGER NOT NULL DEFAULT 0,
      lastAuditDate TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      inductionDate TEXT,
      inductionExpiry TEXT,
      documents TEXT NOT NULL DEFAULT '[]',
      performanceScore REAL,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contractor_incidents (
      id TEXT PRIMARY KEY,
      contractorId TEXT NOT NULL,
      incidentType TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      actionTaken TEXT,
      followUpRequired INTEGER NOT NULL DEFAULT 0,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "037_create_emergency_tables",
    sql: `CREATE TABLE IF NOT EXISTS emergency_plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      scenario TEXT NOT NULL,
      site TEXT NOT NULL,
      department TEXT NOT NULL,
      procedures TEXT NOT NULL,
      emergencyContacts TEXT NOT NULL,
      assemblyPoints TEXT,
      specialInstructions TEXT,
      lastReviewed TEXT,
      nextReview TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drills (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      site TEXT NOT NULL,
      department TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      actualDate TEXT,
      participants INTEGER,
      duration INTEGER,
      scenario TEXT,
      findings TEXT,
      observations TEXT,
      improvements TEXT,
      coordinator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      site TEXT NOT NULL,
      department TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      alternatePhone TEXT,
      isPrimary INTEGER NOT NULL DEFAULT 0,
      isERT INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "038_create_fire_tables",
    sql: `CREATE TABLE IF NOT EXISTS fire_equipment (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      building TEXT NOT NULL,
      floor TEXT,
      room TEXT,
      assetTag TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      serialNumber TEXT,
      installationDate TEXT,
      lastInspectionDate TEXT,
      nextInspectionDate TEXT,
      inspectionFrequency TEXT,
      status TEXT NOT NULL DEFAULT 'Operational',
      notes TEXT,
      photoUrl TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fire_inspections (
      id TEXT PRIMARY KEY,
      equipmentId TEXT NOT NULL,
      inspector TEXT NOT NULL,
      inspectionDate TEXT NOT NULL,
      findings TEXT,
      defects TEXT,
      actionRequired TEXT,
      passed INTEGER NOT NULL,
      nextInspectionDue TEXT NOT NULL,
      photoUrl TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
  },
  {
    name: "039_create_indexes_new",
    sql: `CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
          CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
          CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(location);
          CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(createdAt);
          CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
          CREATE INDEX IF NOT EXISTS idx_permits_type ON permits(type);
          CREATE INDEX IF NOT EXISTS idx_permits_location ON permits(location);
          CREATE INDEX IF NOT EXISTS idx_training_records_employee ON training_records(employeeId);
          CREATE INDEX IF NOT EXISTS idx_training_records_course ON training_records(courseId);
          CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status);
          CREATE INDEX IF NOT EXISTS idx_environmental_waste_type ON waste_records(type);
          CREATE INDEX IF NOT EXISTS idx_environmental_spills_severity ON spills(severity);
          CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
          CREATE INDEX IF NOT EXISTS idx_health_surveillance_employee ON health_surveillance(employeeId);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`,
  },
  {
    name: "040_create_ai_predictions",
    sql: `CREATE TABLE IF NOT EXISTS ai_predictions (
      id TEXT PRIMARY KEY,
      feature TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      output_json TEXT NOT NULL,
      model_version TEXT NOT NULL DEFAULT 'v1.0.0',
      confidence REAL NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "041_create_ai_documents",
    sql: `CREATE TABLE IF NOT EXISTS ai_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "042_create_ai_knowledge_base",
    sql: `CREATE TABLE IF NOT EXISTS ai_knowledge_base (
      id TEXT PRIMARY KEY,
      chunk_text TEXT NOT NULL,
      embedding TEXT,
      source_document_id TEXT,
      section TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "043_create_ai_feedback",
    sql: `CREATE TABLE IF NOT EXISTS ai_feedback (
      id TEXT PRIMARY KEY,
      feature TEXT NOT NULL,
      prediction_id TEXT,
      user_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      feedback_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "044_create_ai_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_ai_predictions_feature ON ai_predictions(feature);
          CREATE INDEX IF NOT EXISTS idx_ai_predictions_created_at ON ai_predictions(created_at);
          CREATE INDEX IF NOT EXISTS idx_ai_documents_category ON ai_documents(category);
          CREATE INDEX IF NOT EXISTS idx_ai_feedback_feature ON ai_feedback(feature);
          CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_source ON ai_knowledge_base(source_document_id);`,
  },
];

addMigration("045_add_user_phone", `ALTER TABLE users ADD COLUMN phone TEXT`);

addMigration(
  "046_auth_security",
  `
  CREATE TABLE IF NOT EXISTS auth_otp_challenges (
    email TEXT PRIMARY KEY, codeHash TEXT NOT NULL, userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    requestedAt TEXT NOT NULL, requestCount INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, email TEXT NOT NULL,
    createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL, revokedAt TEXT,
    ipAddress TEXT, userAgent TEXT
  );
  CREATE TABLE IF NOT EXISTS auth_login_audit (
    id TEXT PRIMARY KEY, userId TEXT, email TEXT NOT NULL, event TEXT NOT NULL,
    successful INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT,
    detail TEXT, createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_preferences (
    userId TEXT PRIMARY KEY, preferences TEXT NOT NULL DEFAULT '{}', avatarUrl TEXT,
    deactivationRequestedAt TEXT, updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(userId, revokedAt);
  CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_login_audit(userId, createdAt);
`,
);
addMigration(
  "047_user_active",
  `ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1`,
);
addMigration(
  "048_session_refresh",
  `ALTER TABLE auth_sessions ADD COLUMN refreshHash TEXT`,
);
addMigration(
  "049_email_changes",
  `CREATE TABLE IF NOT EXISTS auth_email_changes (userId TEXT PRIMARY KEY, newEmail TEXT NOT NULL, codeHash TEXT NOT NULL, expiresAt TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, requestedAt TEXT NOT NULL)`,
);
addMigration(
  "050_document_control_columns",
  `
  ALTER TABLE documents ADD COLUMN documentNo TEXT;
  ALTER TABLE documents ADD COLUMN owner TEXT;
  ALTER TABLE documents ADD COLUMN reviewCycleDays INTEGER;
  ALTER TABLE documents ADD COLUMN nextReviewDate TEXT;
  ALTER TABLE documents ADD COLUMN obsoleteReason TEXT;
  ALTER TABLE documents ADD COLUMN classification TEXT NOT NULL DEFAULT 'Internal';
`,
);
addMigration(
  "051_document_control_tables",
  `
  CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    version TEXT NOT NULL,
    changeSummary TEXT NOT NULL,
    content TEXT,
    fileUrl TEXT,
    fileName TEXT,
    fileSize INTEGER,
    checksum TEXT,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE(documentId, version)
  );
  CREATE TABLE IF NOT EXISTS document_approvals (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    version TEXT NOT NULL,
    step TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    approverId TEXT,
    approverName TEXT,
    comments TEXT,
    decidedAt TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS document_acknowledgements (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    documentVersion TEXT NOT NULL,
    userId TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    userName TEXT NOT NULL,
    acknowledgedAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    UNIQUE(documentId, documentVersion, userId)
  );
  CREATE TABLE IF NOT EXISTS document_access_links (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL,
    tokenHash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'download',
    createdBy TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    downloadCount INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(documentId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_document_approvals_document ON document_approvals(documentId, status);
  CREATE INDEX IF NOT EXISTS idx_document_ack_user ON document_acknowledgements(userId, acknowledgedAt);
  CREATE INDEX IF NOT EXISTS idx_document_access_document ON document_access_links(documentId, expiresAt);
`,
);
addMigration(
  "052_analytics_governance",
  `
  CREATE TABLE IF NOT EXISTS analytics_report_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL DEFAULT 'ehs',
    parameters TEXT NOT NULL DEFAULT '{}',
    outputFormats TEXT NOT NULL DEFAULT '["pdf","excel"]',
    approvalRequired INTEGER NOT NULL DEFAULT 1,
    ownerId TEXT,
    ownerName TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analytics_report_schedules (
    id TEXT PRIMARY KEY,
    templateId TEXT NOT NULL,
    cadence TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    recipients TEXT NOT NULL DEFAULT '[]',
    nextRunAt TEXT,
    lastRunAt TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analytics_report_runs (
    id TEXT PRIMARY KEY,
    templateId TEXT,
    scheduleId TEXT,
    status TEXT NOT NULL DEFAULT 'Generated',
    periodStart TEXT,
    periodEnd TEXT,
    dataQualityWarnings TEXT NOT NULL DEFAULT '[]',
    outputManifest TEXT NOT NULL DEFAULT '{}',
    generatedBy TEXT NOT NULL,
    generatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analytics_report_signoffs (
    id TEXT PRIMARY KEY,
    runId TEXT NOT NULL,
    status TEXT NOT NULL,
    signerId TEXT NOT NULL,
    signerName TEXT NOT NULL,
    comments TEXT,
    signedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_templates_type ON analytics_report_templates(type, active);
  CREATE INDEX IF NOT EXISTS idx_analytics_schedules_next_run ON analytics_report_schedules(active, nextRunAt);
  CREATE INDEX IF NOT EXISTS idx_analytics_runs_template ON analytics_report_runs(templateId, generatedAt);
`,
);
addMigration(
  "053_ai_governance_guardrails",
  `
  CREATE TABLE IF NOT EXISTS ai_guardrail_settings (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    requireCitations INTEGER NOT NULL DEFAULT 1,
    allowExports INTEGER NOT NULL DEFAULT 1,
    maxSourceRecords INTEGER NOT NULL DEFAULT 50,
    allowedRoles TEXT NOT NULL DEFAULT '["super-admin","EHS-manager","hse-officer","plant-manager","factory-manager"]',
    ragSources TEXT NOT NULL DEFAULT '["policies","procedures","reports","capa","audits","training"]',
    updatedBy TEXT,
    updatedAt TEXT NOT NULL
  );
  INSERT OR IGNORE INTO ai_guardrail_settings (id, updatedAt) VALUES ('default', datetime('now'));
  CREATE TABLE IF NOT EXISTS ai_prompt_audit (
    id TEXT PRIMARY KEY,
    userId TEXT,
    userEmail TEXT,
    userRole TEXT,
    feature TEXT NOT NULL,
    promptHash TEXT NOT NULL,
    promptExcerpt TEXT NOT NULL,
    responseSummary TEXT,
    modelVersion TEXT NOT NULL,
    confidence REAL,
    sources TEXT NOT NULL DEFAULT '[]',
    warnings TEXT NOT NULL DEFAULT '[]',
    denied INTEGER NOT NULL DEFAULT 0,
    denialReason TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_rag_sources (
    id TEXT PRIMARY KEY,
    sourceType TEXT NOT NULL,
    sourceId TEXT NOT NULL,
    title TEXT NOT NULL,
    version TEXT,
    permission TEXT,
    indexedAt TEXT NOT NULL,
    UNIQUE(sourceType, sourceId, version)
  );
  CREATE INDEX IF NOT EXISTS idx_ai_prompt_audit_user ON ai_prompt_audit(userId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_ai_prompt_audit_feature ON ai_prompt_audit(feature, createdAt);
  CREATE INDEX IF NOT EXISTS idx_ai_rag_sources_type ON ai_rag_sources(sourceType, indexedAt);
`,
);
addMigration(
  "054_notification_center",
  `
  CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    eventKey TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL,
    subjectTemplate TEXT NOT NULL,
    bodyTemplate TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_jobs (
    id TEXT PRIMARY KEY,
    eventKey TEXT NOT NULL,
    workflow TEXT,
    resourceType TEXT,
    resourceId TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    maxAttempts INTEGER NOT NULL DEFAULT 3,
    nextAttemptAt TEXT,
    lastError TEXT,
    createdBy TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_recipients (
    id TEXT PRIMARY KEY,
    jobId TEXT NOT NULL,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    recipientName TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    deliveredAt TEXT,
    failedAt TEXT,
    lastError TEXT,
    providerMessageId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_digest_subscriptions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    recipient TEXT NOT NULL,
    cadence TEXT NOT NULL DEFAULT 'daily',
    channels TEXT NOT NULL DEFAULT '["email","in-app"]',
    active INTEGER NOT NULL DEFAULT 1,
    nextRunAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status, nextAttemptAt);
  CREATE INDEX IF NOT EXISTS idx_notification_jobs_resource ON notification_jobs(resourceType, resourceId);
  CREATE INDEX IF NOT EXISTS idx_notification_recipients_job ON notification_recipients(jobId, status);
  CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient ON notification_recipients(recipient, createdAt);
`,
);
addMigration(
  "055_operations_monitoring",
  `
  CREATE TABLE IF NOT EXISTS operational_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scheduler_runs (
    id TEXT PRIMARY KEY,
    jobName TEXT NOT NULL,
    status TEXT NOT NULL,
    startedAt TEXT NOT NULL,
    finishedAt TEXT,
    durationMs INTEGER,
    error TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS slow_query_logs (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    durationMs INTEGER NOT NULL,
    thresholdMs INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_operational_events_type ON operational_events(type, status, createdAt);
  CREATE INDEX IF NOT EXISTS idx_scheduler_runs_job ON scheduler_runs(jobName, startedAt);
  CREATE INDEX IF NOT EXISTS idx_slow_query_logs_created ON slow_query_logs(createdAt);
`,
);
addMigration(
  "056_security_hardening",
  `
  CREATE TABLE IF NOT EXISTS security_policies (
    id TEXT PRIMARY KEY,
    policyKey TEXT NOT NULL UNIQUE,
    policyValue TEXT NOT NULL DEFAULT '{}',
    description TEXT,
    updatedBy TEXT,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    firstSeenAt TEXT NOT NULL,
    lastSeenAt TEXT NOT NULL,
    blockedUntil TEXT,
    UNIQUE(scope, identifier, action)
  );
  CREATE TABLE IF NOT EXISTS file_security_scans (
    id TEXT PRIMARY KEY,
    fileKey TEXT NOT NULL,
    fileName TEXT,
    mimeType TEXT,
    sizeBytes INTEGER,
    checksum TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    scanner TEXT NOT NULL DEFAULT 'policy',
    findings TEXT NOT NULL DEFAULT '[]',
    scannedAt TEXT,
    uploadedBy TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS data_retention_policies (
    id TEXT PRIMARY KEY,
    resourceType TEXT NOT NULL UNIQUE,
    retentionDays INTEGER NOT NULL,
    legalHold INTEGER NOT NULL DEFAULT 0,
    disposalAction TEXT NOT NULL DEFAULT 'anonymize',
    updatedBy TEXT,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS secrets_rotation_log (
    id TEXT PRIMARY KEY,
    secretName TEXT NOT NULL,
    owner TEXT NOT NULL,
    rotationFrequencyDays INTEGER NOT NULL,
    lastRotatedAt TEXT,
    nextRotationDueAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    evidence TEXT,
    updatedBy TEXT,
    updatedAt TEXT NOT NULL
  );
  ALTER TABLE auth_sessions ADD COLUMN deviceFingerprint TEXT;
  ALTER TABLE auth_sessions ADD COLUMN lastSeenAt TEXT;
  ALTER TABLE auth_sessions ADD COLUMN revokedReason TEXT;
  CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_lookup ON auth_rate_limits(scope, identifier, action);
  CREATE INDEX IF NOT EXISTS idx_file_security_scans_status ON file_security_scans(status, createdAt);
  CREATE INDEX IF NOT EXISTS idx_retention_resource ON data_retention_policies(resourceType);
  CREATE INDEX IF NOT EXISTS idx_secrets_rotation_due ON secrets_rotation_log(status, nextRotationDueAt);
`,
);

addMigration(
  "057_auditable_report_classification",
  `
  ALTER TABLE reports ADD COLUMN isRecordable INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE reports ADD COLUMN isLostTimeInjury INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE reports ADD COLUMN medicalTreatmentCase INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE reports ADD COLUMN lostWorkDays INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE reports ADD COLUMN restrictedWorkDays INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE reports ADD COLUMN classificationSource TEXT;
  ALTER TABLE reports ADD COLUMN classificationVerifiedBy TEXT;
  ALTER TABLE reports ADD COLUMN classificationVerifiedAt TEXT;
  CREATE INDEX IF NOT EXISTS idx_reports_classification
    ON reports(isRecordable, isLostTimeInjury, classificationVerifiedAt);
`,
);

addMigration(
  "058_reports_source_synced_at",
  `ALTER TABLE reports ADD COLUMN source_synced_at TEXT;
   CREATE INDEX IF NOT EXISTS idx_reports_source_synced_at ON reports(source_synced_at);`,
);

addMigration(
  "059_corrective_action_requests",
  `
  CREATE TABLE IF NOT EXISTS corrective_action_requests (
    id TEXT PRIMARY KEY,
    reportId TEXT NOT NULL,
    accessToken TEXT NOT NULL UNIQUE,
    recipientEmail TEXT NOT NULL,
    recipientName TEXT,
    assignedByEmail TEXT,
    assignedByName TEXT,
    reportType TEXT NOT NULL,
    reportCategory TEXT,
    reportDescription TEXT NOT NULL,
    reportLocation TEXT,
    reportDepartment TEXT,
    assigneeNote TEXT,
    priority TEXT NOT NULL DEFAULT 'Medium',
    dueDate TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    unsafeEventType TEXT,
    immediateActionTaken TEXT,
    completedTasks TEXT,
    rootCauseAnalysis TEXT,
    actionPlanItems TEXT NOT NULL DEFAULT '[]',
    capaId TEXT,
    submittedAt TEXT,
    expiresAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_corrective_action_requests_report
    ON corrective_action_requests(reportId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_corrective_action_requests_recipient
    ON corrective_action_requests(recipientEmail, status);
  CREATE INDEX IF NOT EXISTS idx_corrective_action_requests_token
    ON corrective_action_requests(accessToken);
`,
);

addMigration(
  "060_corrective_action_request_note",
  `ALTER TABLE corrective_action_requests ADD COLUMN assigneeNote TEXT`,
);

addMigration(
  "061_corrective_action_followup_fields",
  `
  ALTER TABLE corrective_action_requests ADD COLUMN copiedRecipientEmails TEXT DEFAULT '[]';
  ALTER TABLE corrective_action_requests ADD COLUMN actionPlanDueDate TEXT;
`,
);

export async function seedAdminUsers(db: any) {
  // Idempotent seeding: ensure these admin emails exist without ever violating UNIQUE(email).
  // This prevents startup crashes when the DB is partially seeded.
  const requiredUsers = [
    {
      email: "admin@crownpaints.co.ke",
      name: "Super Admin",
      role: "super-admin",
      password: process.env.SEED_SUPER_ADMIN_PASSWORD,
    },
    {
      email: "safety@crownpaints.co.ke",
      name: "EHS Manager",
      role: "EHS-manager",
      password: process.env.SEED_EHS_MANAGER_PASSWORD,
    },
  ] as const;

  const existingEmails = new Set<string>();
  const stmt = db.prepare("SELECT email FROM users");
  while (stmt.step()) {
    const row = stmt.getAsObject() as { email?: unknown };
    if (row?.email) existingEmails.add(String(row.email));
  }
  stmt.free();

  const toInsert = requiredUsers.filter((u) => !existingEmails.has(u.email));
  if (toInsert.length === 0) return;

  for (const user of toInsert) {
    const password = user.password;
    if (!password || password.length < 12) {
      throw new Error(
        `Seed password for ${user.email} must be provided through environment and be at least 12 characters`,
      );
    }
  }

  const { v4: uuidv4 } = await import("uuid");
  const bcrypt = await import("bcryptjs");

  for (const u of toInsert) {
    const password = u.password;
    if (!password) {
      throw new Error(`Seed password for ${u.email} is missing`);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare(
      "INSERT OR IGNORE INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run([
      uuidv4(),
      u.email,
      passwordHash,
      u.name,
      u.role,
      new Date().toISOString(),
    ]);
  }

  await saveDb(db);
  console.log(
    `Seeded missing default users: ${toInsert.map((u) => u.email).join(", ")}`,
  );
}

export async function runMigrations(db: any) {
  db.run(MIGRATIONS_TABLE);

  for (const migration of MIGRATIONS) {
    const stmt = db.prepare("SELECT id FROM migrations WHERE name = ?");
    const applied = stmt.getAsObject([migration.name]);
    stmt.free();
    if (!applied.id) {
      db.run(migration.sql);
      const insert = db.prepare(
        "INSERT INTO migrations (name, appliedAt) VALUES (?, ?)",
      );
      insert.run([migration.name, new Date().toISOString()]);
      insert.free();
      console.log(`Migration ${migration.name} applied`);
    }
  }
}

export async function ensureSchema(db: any) {
  db.run(MIGRATIONS_TABLE);

  for (const migration of MIGRATIONS) {
    const stmt = db.prepare("SELECT id FROM migrations WHERE name = ?");
    const applied = stmt.getAsObject([migration.name]);
    stmt.free();
    if (!applied.id) {
      db.run(migration.sql);
      const insert = db.prepare(
        "INSERT INTO migrations (name, appliedAt) VALUES (?, ?)",
      );
      insert.run([migration.name, new Date().toISOString()]);
      insert.free();
    }
  }
}

export function addMigration(name: string, sql: string) {
  MIGRATIONS.push({ name, sql });
}
