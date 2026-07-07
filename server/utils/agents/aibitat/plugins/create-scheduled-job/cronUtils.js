/**
 * Convert a cron expression whose hour/minute were specified in a user's local
 * timezone into an equivalent UTC cron expression for storage.
 *
 * The scheduler runs in UTC (later.js is configured with `later.date.UTC()`),
 * so all stored cron expressions must use UTC hours. When the agent creates a
 * job it writes a cron in the user's local time (e.g. "0 9 * * 1-5" for 9am
 * weekdays); this module shifts the hour/minute fields to UTC before the job
 * is saved, using the user's IANA timezone from the per-request locale cache.
 *
 * Only patterns where both the minute AND hour fields are specific integers are
 * converted. Patterns like `* * * * *`, `*\/5 * * * *`, or `0 *\/2 * * *`
 * are already timezone-agnostic and returned unchanged.
 *
 * Known limitation (matches frontend builder behaviour):
 *   DST – the offset is computed for "now", so a schedule may drift by one
 *   hour across a DST boundary. This is acceptable and consistent with the
 *   manual Scheduled Jobs UI.
 */

/**
 * UTC offset in minutes for a given IANA timezone at a specific instant.
 * Throws RangeError if `timeZone` is not a valid IANA identifier.
 * @param {string} timeZone
 * @param {Date} [at]
 * @returns {number} Minutes to add to UTC to get wall-clock time in the zone.
 */
function tzOffsetMinutes(timeZone, at = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(at).map((part) => [part.type, part.value])
  );
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    p.hour === "24" ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return Math.round((asUTC - at.getTime()) / 60000);
}

/**
 * Convert a local hour + minute to UTC hour + minute for a given IANA timezone.
 * @param {number} localHour
 * @param {number} localMinute
 * @param {string} timeZone
 * @returns {{ hour: number, minute: number }}
 */
function localToUtcHM(localHour, localMinute, timeZone) {
  const offset = tzOffsetMinutes(timeZone);
  let total = localHour * 60 + localMinute - offset;
  total = ((total % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/**
 * Convert the hour/minute fields of a 5-field cron expression from a user's
 * local timezone to UTC. Returns the original string unchanged if the pattern
 * has no specific hour (e.g. every-minute or every-N-hours schedules).
 *
 * @param {string} cron  - 5-field cron expression in local time.
 * @param {string} timeZone - IANA timezone (e.g. "America/New_York").
 * @returns {string} 5-field cron expression in UTC.
 */
function convertCronLocalToUtc(cron, timeZone) {
  if (!cron || typeof cron !== "string") return cron;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dom, month, dow] = parts;

  // Only shift when both fields are plain integers (specific time, not a wildcard/step).
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return cron;

  const utc = localToUtcHM(Number(hour), Number(minute), timeZone);
  return `${utc.minute} ${utc.hour} ${dom} ${month} ${dow}`;
}

module.exports = { convertCronLocalToUtc };
