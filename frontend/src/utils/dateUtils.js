/**
 * International 24-Hour & 12-Hour Dual Time and Timezone Conversion Utilities.
 * Ensures all dates and scheduled intervals strictly respect the user's selected
 * timezone in both 24-Hour International Standard and 12-Hour AM/PM representation.
 */

export function format24hTime(isoString, userTimezone = 'UTC') {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', {
      timeZone: userTimezone || 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (err) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', {
      timeZone: 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export function format12hTime(isoString, userTimezone = 'UTC') {
  if (!isoString) return '--:-- --';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      timeZone: userTimezone || 'UTC',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (err) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

export function formatDualTime(isoString, userTimezone = 'UTC') {
  if (!isoString) return '--:--';
  const time24 = format24hTime(isoString, userTimezone);
  const time12 = format12hTime(isoString, userTimezone);
  return `${time24} (${time12})`;
}

export function format24hDate(isoString, userTimezone = 'UTC') {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      timeZone: userTimezone || 'UTC',
      day: 'numeric',
      month: 'short',
    });
  } catch (err) {
    return new Date(isoString).toLocaleDateString();
  }
}

export function format24hInterval(startIso, endIso, userTimezone = 'UTC') {
  const start24 = format24hTime(startIso, userTimezone);
  const end24 = format24hTime(endIso, userTimezone);
  const start12 = format12hTime(startIso, userTimezone);
  const end12 = format12hTime(endIso, userTimezone);
  const dateStr = format24hDate(startIso, userTimezone);
  const tzShort = userTimezone === 'UTC' ? 'UTC' : userTimezone.split('/').pop().replace('_', ' ');

  // Calculate duration in hours / minutes
  let durationStr = '';
  if (startIso && endIso) {
    const diffMins = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
    if (diffMins > 0) {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      durationStr = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    }
  }

  return {
    date: dateStr,
    timeRange24: `${start24} - ${end24}`,
    timeRange12: `${start12} - ${end12}`,
    duration: durationStr,
    full: `${dateStr} • [${start24} - ${end24} 24h] [${tzShort}]`,
    tzShort,
  };
}

export function convert24to12(time24Str) {
  if (!time24Str || typeof time24Str !== 'string' || !time24Str.includes(':')) {
    return { hour12: 8, minute: '00', ampm: 'AM', formatted: '8:00 AM' };
  }
  const [hStr, mStr] = time24Str.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = mStr.padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    hour12,
    minute: m,
    ampm,
    formatted: `${hour12}:${m} ${ampm}`,
  };
}

export function convert12to24(hour12, minute, ampm) {
  let h = parseInt(hour12, 10);
  if (isNaN(h)) h = 12;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const m = String(minute).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${m}`;
}

/**
 * Accurately parses a local 'YYYY-MM-DDTHH:mm' string interpreted inside `timeZone`
 * and converts it into a precise UTC ISO string for database storage.
 */
export function localDateTimeToUtcIso(dateTimeLocalStr, timeZone = 'UTC') {
  if (!dateTimeLocalStr) return '';
  const [datePart, timePart] = dateTimeLocalStr.split('T');
  if (!datePart || !timePart) return new Date(dateTimeLocalStr).toISOString();

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  // Construct UTC trial date with target components
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  // Determine the actual components `utcGuess` produces in `timeZone`
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const p = {};
  parts.forEach(part => { p[part.type] = part.value; });
  let formattedHour = parseInt(p.hour, 10);
  if (formattedHour === 24) formattedHour = 0;

  const asLocal = new Date(Date.UTC(
    parseInt(p.year, 10),
    parseInt(p.month, 10) - 1,
    parseInt(p.day, 10),
    formattedHour,
    parseInt(p.minute, 10),
    parseInt(p.second, 10)
  ));

  // The difference between trial UTC and interpreted local representation gives exact offset
  const diffMs = utcGuess.getTime() - asLocal.getTime();
  const exactUtc = new Date(utcGuess.getTime() + diffMs);

  return exactUtc.toISOString();
}

/**
 * Returns current date-time formatted as 'YYYY-MM-DDTHH:mm' in the target `timeZone`.
 */
export function getCurrentDateTimeInTimezone(timeZone = 'UTC', addMinutes = 0) {
  const d = new Date(Date.now() + addMinutes * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const p = {};
  parts.forEach(part => { p[part.type] = part.value; });
  let hour = p.hour;
  if (hour === '24') hour = '00';
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

/**
 * Adds minutes to a 'YYYY-MM-DDTHH:mm' local string, properly rolling over
 * calendar date across midnight.
 */
export function addMinutesToDateTimeLocal(dateTimeLocalStr, addMinutes = 0) {
  if (!dateTimeLocalStr) return '';
  const [datePart, timePart] = dateTimeLocalStr.split('T');
  if (!datePart || !timePart) return dateTimeLocalStr;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  const d = new Date(Date.UTC(year, month - 1, day, hours, minutes + addMinutes, 0));
  const pad = n => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const dt = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${y}-${m}-${dt}T${h}:${min}`;
}

/**
 * Sets a specific target hour/minute for a deadline, automatically advancing the date
 * to tomorrow if the target time is earlier than the start time.
 */
export function setTargetTimeToDateTimeLocal(dateTimeLocalStr, targetHour, targetMinute = 0) {
  if (!dateTimeLocalStr) return '';
  const [datePart, timePart] = dateTimeLocalStr.split('T');
  if (!datePart || !timePart) return dateTimeLocalStr;
  const [year, month, day] = datePart.split('-').map(Number);
  const [startH, startM] = timePart.split(':').map(Number);

  let d = new Date(Date.UTC(year, month - 1, day, targetHour, targetMinute, 0));
  if (targetHour < startH || (targetHour === startH && targetMinute <= startM)) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const pad = n => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const dt = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${y}-${m}-${dt}T${h}:${min}`;
}
