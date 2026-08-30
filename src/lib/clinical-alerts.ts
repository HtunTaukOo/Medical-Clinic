export function isAppointmentUrgent(appt: {
  status: string;
  spo2Percent: number | null;
  heartRateBpm: number | null;
  temperatureC: { toString(): string } | null;
  patient: { allergyRecords: unknown[]; diagnoses: unknown[] };
}) {
  const vitalsMessage =
    appt.status === "CHECKED_IN"
      ? getVitalsAlertMessage(
          appt.spo2Percent,
          appt.heartRateBpm,
          appt.temperatureC != null ? Number(appt.temperatureC) : null
        )
      : null;
  const hasSevereCondition =
    (appt.patient.allergyRecords.length > 0 || appt.patient.diagnoses.length > 0) &&
    appt.status !== "COMPLETED";
  return !!vitalsMessage || hasSevereCondition;
}

export function getVitalsAlertMessage(
  spo2Percent: number | null,
  heartRateBpm: number | null,
  temperatureC: number | null
) {
  if (spo2Percent != null && spo2Percent < 95) {
    return `Breathing difficulty, SpO2 ${spo2Percent}%, requires immediate attention`;
  }
  if (heartRateBpm != null && (heartRateBpm > 120 || heartRateBpm < 50)) {
    return `Abnormal heart rate (${heartRateBpm} bpm), requires immediate attention`;
  }
  if (temperatureC != null && temperatureC >= 39) {
    return `High fever (${temperatureC}°C), requires immediate attention`;
  }
  return null;
}
