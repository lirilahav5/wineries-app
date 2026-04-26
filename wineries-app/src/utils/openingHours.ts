/**
 * Utility functions for parsing and checking opening hours
 */

// Day name mappings for Hebrew, English, and Russian
const dayMappings: Record<string, number> = {
  // English
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6,
  'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6,
  // Hebrew - full names (most common format)
  'יום ראשון': 0, 'יום שני': 1, 'יום שלישי': 2, 'יום רביעי': 3, 'יום חמישי': 4, 'יום שישי': 5, 'יום שבת': 6,
  // Hebrew - abbreviated with יום
  'יום א': 0, 'יום ב': 1, 'יום ג': 2, 'יום ד': 3, 'יום ה': 4, 'יום ו': 5, 'יום ש': 6,
  // Hebrew - just the day names
  'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6,
  // Hebrew - single letter abbreviations
  'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5, 'ש': 6,
  // Russian
  'воскресенье': 0, 'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4, 'пятница': 5, 'суббота': 6,
  'вс': 0, 'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6,
};

/**
 * Parse time string (e.g., "9:00", "18:30") to minutes since midnight
 */
function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  
  return hours * 60 + minutes;
}

/**
 * Parse a single opening hours entry (e.g., "יום א': 9:00-18:00")
 */
function parseOpeningHoursEntry(entry: string): { day: number | null; startTime: number | null; endTime: number | null } {
  // Normalize different dash characters to regular hyphen for easier parsing
  // Replace en dash (–), em dash (—), and other dash variants with regular hyphen
  const normalized = entry.trim()
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-') // Replace en dash, em dash, horizontal bar, minus sign with hyphen
    .replace(/\s*-\s*/g, '-'); // Normalize spaces around hyphens
  
  // Try to extract day and time range
  // Pattern: "Day: HH:MM-HH:MM" or "Day HH:MM-HH:MM"
  const patterns = [
    /^(.+?)[:\s]+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/i,
    /^(.+?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const dayStr = match[1].trim();
      const startTimeStr = match[2];
      const endTimeStr = match[3];
      
      // Find day number - check exact matches first, then partial matches
      let day: number | null = null;
      
      // First try exact match (case-insensitive for English, but Hebrew doesn't have case)
      const dayStrLower = dayStr.toLowerCase();
      for (const [key, value] of Object.entries(dayMappings)) {
        const keyLower = key.toLowerCase();
        // Exact match
        if (dayStr === key || dayStrLower === keyLower) {
          day = value;
          break;
        }
        // Check if day string contains the key or vice versa
        if (dayStr.includes(key) || key.includes(dayStr)) {
          day = value;
          break;
        }
      }
      
      // If still not found, try to extract Hebrew day name from "יום X" format
      if (day === null && /יום\s+/.test(dayStr)) {
        const hebrewDayName = dayStr.replace(/יום\s+/, '').trim();
        for (const [key, value] of Object.entries(dayMappings)) {
          if (hebrewDayName === key || hebrewDayName.includes(key) || key.includes(hebrewDayName)) {
            day = value;
            break;
          }
        }
      }
      
      // Last resort: check for Hebrew day abbreviations within the string
      if (day === null) {
        const hebrewDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
        const hebrewFullNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        for (let i = 0; i < hebrewDays.length; i++) {
          if (dayStr.includes(hebrewDays[i]) || dayStr.includes(hebrewFullNames[i])) {
            day = i;
            break;
          }
        }
      }
      
      let startTime = parseTime(startTimeStr);
      let endTime = parseTime(endTimeStr);
      
      // Handle reversed time ranges (e.g., "17:00-9:00" should be "9:00-17:00")
      // If endTime is less than startTime and the difference is more than 12 hours,
      // it's likely a data entry error - swap them
      if (startTime !== null && endTime !== null && endTime < startTime) {
        const diff = startTime - endTime;
        // If the difference is more than 12 hours (720 minutes), it's likely reversed
        // Overnight hours (like 22:00-02:00) would have endTime < startTime but diff < 12 hours
        if (diff > 720) {
          // Swap them - this is a data error
          [startTime, endTime] = [endTime, startTime];
        }
        // Otherwise, it's legitimate overnight hours (e.g., 22:00-02:00)
      }
      
      return { day, startTime, endTime };
    }
  }
  
  // If no pattern matches, try to extract just time range (assume it's for today)
  const timeRangeMatch = normalized.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (timeRangeMatch) {
    let startTime = parseTime(timeRangeMatch[1]);
    let endTime = parseTime(timeRangeMatch[2]);
    
    // Handle reversed time ranges
    if (startTime !== null && endTime !== null && endTime < startTime) {
      const diff = startTime - endTime;
      if (diff > 720) {
        // Swap them - this is a data error
        [startTime, endTime] = [endTime, startTime];
      }
    }
    
    return { day: null, startTime, endTime };
  }
  
  return { day: null, startTime: null, endTime: null };
}

/**
 * Check if a place is currently open based on opening hours
 * Uses the device's local time (phone's current time and timezone)
 * This function automatically uses the phone's clock/time - no server time or timezone conversion
 */
export function isCurrentlyOpen(openingHours: string | string[] | null): boolean {
  if (!openingHours) return false;
  
  // Get current time in device's local timezone (phone's clock/time)
  // new Date() automatically uses the device's local timezone - no conversion needed
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday (device's local day)
  const currentMinutes = now.getHours() * 60 + now.getMinutes(); // Device's local hours and minutes
  
  // Normalize opening hours to array
  let hoursArray: string[] = [];
  if (typeof openingHours === 'string') {
    try {
      const parsed = JSON.parse(openingHours);
      if (Array.isArray(parsed)) {
        hoursArray = parsed;
      } else if (typeof parsed === 'string') {
        hoursArray = [parsed];
      }
    } catch {
      // Not JSON, treat as plain string
      hoursArray = [openingHours];
    }
  } else if (Array.isArray(openingHours)) {
    hoursArray = openingHours;
  }
  
  if (hoursArray.length === 0) return false;
  
  // Check each entry
  let foundTodayEntry = false;
  let todayIsClosed = false;
  
  for (const entry of hoursArray) {
    if (!entry || typeof entry !== 'string') continue;
    
    // Check for explicit "closed" indicators
    const entryLower = entry.toLowerCase();
    if (entryLower.includes('סגור') || entryLower.includes('closed') || entryLower.includes('закрыто')) {
      // Check if this closed entry is for today
      const parsed = parseOpeningHoursEntry(entry);
      if (parsed.day === null || parsed.day === currentDay) {
        // This closed entry applies to today
        foundTodayEntry = true;
        todayIsClosed = true;
        // Continue checking other entries in case there are multiple entries for today
      }
      continue;
    }
    
    const parsed = parseOpeningHoursEntry(entry);
    
    // If we have a specific day, check if it matches today
    if (parsed.day !== null && parsed.day !== currentDay) {
      continue; // Not today's schedule
    }
    
    // This entry is for today (or no day specified)
    if (parsed.day === null || parsed.day === currentDay) {
      foundTodayEntry = true;
      
      // If we have time range, check if current time is within it
      if (parsed.startTime !== null && parsed.endTime !== null) {
        // Handle case where closing time is next day (e.g., 22:00-02:00)
        if (parsed.endTime < parsed.startTime) {
          // Closing time is next day (overnight hours)
          if (currentMinutes >= parsed.startTime || currentMinutes <= parsed.endTime) {
            return true; // Open (within overnight hours)
          }
        } else {
          // Normal case: same day
          if (currentMinutes >= parsed.startTime && currentMinutes <= parsed.endTime) {
            return true; // Open (within normal hours)
          }
        }
      } else if (parsed.day === currentDay && parsed.startTime === null && parsed.endTime === null) {
        // If we matched the day but no time range, assume it's open all day
        return true;
      }
    }
  }
  
  // If we found an entry for today but it's marked as closed, return false
  if (foundTodayEntry && todayIsClosed) {
    return false;
  }
  
  // If we found entries for today but none matched the time, return false
  if (foundTodayEntry && !todayIsClosed) {
    return false; // Found today's entry but current time is outside hours
  }
  
  // If no entry matches, check for "Open 24/7" or similar indicators
  const allHoursText = hoursArray.join(' ').toLowerCase();
  if (allHoursText.includes('24/7') || allHoursText.includes('24 hours') || allHoursText.includes('always open')) {
    return true;
  }
  
  return false;
}

/** Format minutes since midnight as "HH:MM" */
function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * When the place is currently open, returns today's closing time as "HH:MM" (e.g. "18:00").
 * Returns null when closed or when closing time cannot be determined (e.g. 24/7).
 */
export function getClosingTimeToday(openingHours: string | string[] | null): string | null {
  if (!openingHours) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let hoursArray: string[] = [];
  if (typeof openingHours === 'string') {
    try {
      const parsed = JSON.parse(openingHours);
      if (Array.isArray(parsed)) hoursArray = parsed;
      else if (typeof parsed === 'string') hoursArray = [parsed];
    } catch {
      hoursArray = [openingHours];
    }
  } else if (Array.isArray(openingHours)) {
    hoursArray = openingHours;
  }

  if (hoursArray.length === 0) return null;

  for (const entry of hoursArray) {
    if (!entry || typeof entry !== 'string') continue;
    const entryLower = entry.toLowerCase();
    if (entryLower.includes('סגור') || entryLower.includes('closed') || entryLower.includes('закрыто')) continue;

    const parsed = parseOpeningHoursEntry(entry);
    if (parsed.day !== null && parsed.day !== currentDay) continue;
    if (parsed.day === null || parsed.day === currentDay) {
      if (parsed.startTime !== null && parsed.endTime !== null) {
        if (parsed.endTime < parsed.startTime) {
          if (currentMinutes >= parsed.startTime || currentMinutes <= parsed.endTime) {
            return formatMinutesToTime(parsed.endTime);
          }
        } else {
          if (currentMinutes >= parsed.startTime && currentMinutes <= parsed.endTime) {
            return formatMinutesToTime(parsed.endTime);
          }
        }
      } else if (parsed.day === currentDay && parsed.startTime === null && parsed.endTime === null) {
        return null; // Open all day, no specific closing time
      }
    }
  }

  const allHoursText = hoursArray.join(' ').toLowerCase();
  if (allHoursText.includes('24/7') || allHoursText.includes('24 hours') || allHoursText.includes('always open')) {
    return null;
  }
  return null;
}
