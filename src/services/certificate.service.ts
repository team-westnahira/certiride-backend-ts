import {
  ServiceRecordBlockChainModel,
  VehicleInteractionBlockChainModel,
} from '../models/interaction.model';
import { VehicleBlockChainModel } from '../models/vehicle.model';

export const calculateCompositeRating = (vehicle: VehicleBlockChainModel) => {
  if (vehicle.interaction.length == 0) {
    const scoreBreakdown = {
      serviceRecordScore: 100,
      accidentScore: 100,
      troubleshootRepairScore: 100,
      maintenanceChecklistScore: 100,
      diagnosticReportScore: 100,
    };
    return {
      compositeRating: 100,
      scoreBreakdown,
    };
  }

  let compositeRating =
    handleCaluclateServiceReocordScore(vehicle) +
    handleCaluclateAccidentRepairScore(vehicle) +
    handleCalculateTroubleshootRepairScore(vehicle) +
    calculateMaintenanceChecklistScore(vehicle) +
    calculateDiagnosticReportScore(vehicle);

  const scoreBreakdown = {
    serviceRecordScore: handleCaluclateServiceReocordScore(vehicle),
    accidentScore: handleCaluclateAccidentRepairScore(vehicle),
    troubleshootRepairScore: handleCalculateTroubleshootRepairScore(vehicle),
    maintenanceChecklistScore: calculateMaintenanceChecklistScore(vehicle),
    diagnosticReportScore: calculateDiagnosticReportScore(vehicle),
  };

  return {
    compositeRating,
    scoreBreakdown,
  };
};

export const handleCaluclateServiceReocordScore = (vehicle: VehicleBlockChainModel) => {
  let allServiceRecords: ServiceRecordBlockChainModel[] = [];

  const SERVICE_KM_INTERVAL = 5000;
  const SERVICE_YEARLY = 2;
  const LATE_PENALTY = 2;
  const MISS_PENALTY = 5;
  const WEIGHT = 0.25;

  //TODO:
  // calc time difference between the last service record and the current date
  // milage difference between initial mileage and the last service record mileage

  vehicle.interaction.forEach((interaction) => {
    if (interaction.service_record && interaction.service_record.record_id != '') {
      allServiceRecords.push(interaction.service_record);
    }
  });

  const mileage = allServiceRecords[allServiceRecords.length - 1].mileage;
  const age = new Date().getFullYear() - vehicle.year;

  const expectedByMileage = mileage / SERVICE_KM_INTERVAL;
  const expectedByAge = age * SERVICE_YEARLY;
  const expectedServices = Math.max(expectedByMileage, expectedByAge);

  const onTimeServices = allServiceRecords.filter((r) => r.is_on_time).length;
  const totalCompletedServices = allServiceRecords.length;
  const lateServices = totalCompletedServices - onTimeServices;
  const missedServices = Math.max(expectedServices - totalCompletedServices, 0);

  const baseScore = (onTimeServices / expectedServices) * 100;
  const penalty = lateServices * LATE_PENALTY + missedServices * MISS_PENALTY;

  let finalSRS = Math.max(Math.min(baseScore - penalty, 100), 0);
  finalSRS = finalSRS * WEIGHT;

  return Number(finalSRS.toFixed(2));
};

export const handleCaluclateAccidentRepairScore = (vehicle: VehicleBlockChainModel) => {
  let accidentRepairScore = 100;
  const WEIGHT = 0.25;
  const PER_ACCIDENT_PENALTY = 5;
  const PER_SEVERITY_PENALTY = 10;
  const PER_MISSING_DOC_PENALTY = 2;

  //TODO:
  // gather accident types and calculate the score based on the severity and missing documents

  const accidentRepairs = vehicle.interaction.filter(
    (i) => i.accident_repair_record?.record_id !== ''
  );

  if (accidentRepairs.length === 0) return 100 * WEIGHT;

  let severeCount = 0;
  let missingDocs = 0;

  accidentRepairs.forEach((repair) => {
    const record = repair.accident_repair_record;
    if (!record) return;

    if (record.severity_rating > 5) {
      severeCount++;
    }

    if (!record.attachments || record.attachments.length === 0) {
      missingDocs++;
    }
  });

  const penalty =
    PER_ACCIDENT_PENALTY * accidentRepairs.length +
    PER_SEVERITY_PENALTY * severeCount +
    PER_MISSING_DOC_PENALTY * missingDocs;
  const score = Math.max(0, 100 - penalty);
  accidentRepairScore = score * WEIGHT;

  return accidentRepairScore;
};

export const handleCalculateTroubleshootRepairScore = (vehicle: VehicleBlockChainModel) => {
  const REPEATED_PANALTY = 2;
  const UNRESOLVED_PANALTY = 10;
  const MISSING_DOC_PENALTY = 1;
  const WEIGHT = 0.15;

  const troubleshootRepairs = vehicle.interaction.filter(
    (i) => i.troubleshoot_repair_record?.record_id !== ''
  );

  if (troubleshootRepairs.length === 0) return 100 * WEIGHT;

  const issueFrequency: Record<string, number> = {};
  let repeatedIssues = 0;
  let unresolvedIssues = 0;
  let missingDocs = 0;

  troubleshootRepairs.forEach((entry) => {
    const record = entry.troubleshoot_repair_record;
    const issue = record?.diagnostic_details?.toLowerCase().trim();

    if (issue) {
      issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
    }

    if (!record?.is_resolved) {
      unresolvedIssues++;
    }

    if (!record?.attachments || record.attachments.length === 0) {
      missingDocs++;
    }
  });

  repeatedIssues = Object.values(issueFrequency).filter((freq) => freq > 1).length;

  const penalty =
    REPEATED_PANALTY * repeatedIssues +
    UNRESOLVED_PANALTY * unresolvedIssues +
    MISSING_DOC_PENALTY * missingDocs;
  let score = Math.max(0, 100 - penalty);
  score = score * WEIGHT;
  return Number(score.toFixed(2));
};

export const calculateMaintenanceChecklistScore = (vehicle: VehicleBlockChainModel) => {
  const WEIGHT = 0.15;
  const maintenanceRecords = vehicle.interaction.filter(
    (i) => i.maintenance_checklist?.checklist_id !== ''
  );

  if (!maintenanceRecords.length) return 100 * WEIGHT;

  let passed = 0;
  let problem = 0;
  let total = 0;

  for (const record of maintenanceRecords) {
    if (!record.maintenance_checklist?.items) continue;
    for (const item of record.maintenance_checklist?.items) {
      total++;
      if (['checked', 'clean', 'adjusted', 'replace'].includes(item.condition)) {
        passed++;
      } else if (item.condition === 'problem') {
        problem++;
      }
    }
  }

  const PANANLTY_PER_PROBLEM = 2;
  let rawScore = (passed / total) * 100;
  rawScore -= problem * PANANLTY_PER_PROBLEM;

  const finalMCS = Math.max(Math.min(rawScore, 100), 0) * WEIGHT;
  return Number(finalMCS.toFixed(2));
};

export const calculateDiagnosticReportScore = (vehicle: VehicleBlockChainModel): number => {
  const diagnosticRepairs = vehicle.interaction.filter(
    (i) => i.troubleshoot_repair_record?.record_id !== ''
  );

  let totalChecks = 0;
  let score = 0;
  const systemIssueMap: Record<string, number> = {};
  const WEIGHT = 0.15;

  const getConditionScore = (condition: string): number => {
    switch (condition.toLowerCase()) {
      case 'normal':
        return 1;
      case 'issue':
        return -1;
      default:
        return 0;
    }
  };

  diagnosticRepairs.forEach((report) => {
    report.diagnostic_report?.system_checks.forEach((check) => {
      totalChecks++;
      score += getConditionScore(check.condition);

      const key = check.system_name.toLowerCase();
      if (check.condition.toLowerCase() !== 'normal') {
        systemIssueMap[key] = (systemIssueMap[key] || 0) + 1;
      }
    });
  });

  if (totalChecks === 0) return 100 * WEIGHT;

  let recurringPenalty = 0;
  Object.entries(systemIssueMap).forEach(([system, count]) => {
    if (count >= 2) recurringPenalty += 1;
  });

  score -= recurringPenalty;

  const maxPossibleScore = totalChecks * 1;
  const minPossibleScore = totalChecks * -2;

  const normalized = (score - minPossibleScore) / (maxPossibleScore - minPossibleScore);
  const finalScore = Math.max(Math.min(normalized * 100, 100), 0) * WEIGHT;

  return Number(finalScore.toFixed(2));
};
