import React from 'react';

/** One logical line per day / slot group — avoids a single dense paragraph in list cards */
export function splitOpeningHoursDisplayLines(hoursLine: string): string[] {
  const t = hoursLine.trim();
  if (!t) return [];
  if (t.includes(' • ')) {
    return t.split(' • ').map((s) => s.trim()).filter(Boolean);
  }
  const dayChunks = t.split(/(?=יום\s)/).map((s) => s.trim()).filter(Boolean);
  if (dayChunks.length > 1) return dayChunks;
  const dayChunksTight = t.split(/(?=יום)/).map((s) => s.trim()).filter(Boolean);
  if (dayChunksTight.length > 1) return dayChunksTight;
  return [t];
}

export function parseOffer(offersString: string | null, defaultName: string): { name: string; description: string } {
  if (!offersString) {
    return { name: defaultName, description: '' };
  }

  let offerName = defaultName;
  let offerDescription = offersString.trim();

  try {
    const parsed = JSON.parse(offersString);
    if (typeof parsed === 'object' && parsed !== null) {
      offerName = parsed.name || parsed.title || defaultName;
      offerDescription = parsed.description || parsed.details || '';
    }
  } catch {
    const fullJsonMatch = offersString.match(/\{"name"\s*:\s*"([^"]*)"\s*,\s*"description"\s*:\s*"([^"]+)"\}/);
    if (fullJsonMatch) {
      offerName = fullJsonMatch[1] || defaultName;
      offerDescription = fullJsonMatch[2];
    } else {
      const descMatch = offersString.match(/"description"\s*:\s*"([^"]+)"/);
      if (descMatch) {
        offerDescription = descMatch[1];
      } else {
        const quotedTextMatch = offersString.match(/"([^"]{10,})"/);
        if (quotedTextMatch && !quotedTextMatch[1].includes('{') && !quotedTextMatch[1].includes('}')) {
          offerDescription = quotedTextMatch[1];
        }
      }
    }
  }

  if (offerDescription) {
    offerDescription = offerDescription
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\{"name":"[^"]*","description":"([^"]+)"\}/g, '$1')
      .replace(/^["']|["']$/g, '')
      .replace(/^\s*\{.*\}\s*$/g, '')
      .trim();
  }

  if (!offerDescription || offerDescription.length < 3) {
    offerDescription = offersString
      .replace(/\{"name":"[^"]*","description":"([^"]+)"\}/g, '$1')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  return {
    name: offerName || defaultName,
    description: offerDescription || offersString,
  };
}

export function renderOfferLineWithDiscountHighlight(
  text: string,
  baseColor: string,
  accentColor: string
): React.ReactNode {
  const re = /(\d+\s*%\s*הנחה)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const ix = m.index;
    if (ix > last) {
      parts.push(
        <span key={`o-${key++}`} style={{ color: baseColor }}>
          {text.slice(last, ix)}
        </span>
      );
    }
    parts.push(
      <span key={`o-${key++}`} style={{ color: accentColor, fontWeight: 700 }}>
        {m[1]}
      </span>
    );
    last = ix + m[1].length;
  }
  if (parts.length === 0) {
    return <span style={{ color: baseColor }}>{text}</span>;
  }
  if (last < text.length) {
    parts.push(
      <span key={`o-${key++}`} style={{ color: baseColor }}>
        {text.slice(last)}
      </span>
    );
  }
  return <>{parts}</>;
}

function translateOpeningHours(hoursText: string): string {
  if (!hoursText) return '';

  const dayTranslations: Record<string, string> = {
    Monday: 'יום שני',
    Tuesday: 'יום שלישי',
    Wednesday: 'יום רביעי',
    Thursday: 'יום חמישי',
    Friday: 'יום שישי',
    Saturday: 'שבת',
    Sunday: 'יום ראשון',
    Mon: 'ב׳',
    Tue: 'ג׳',
    Wed: 'ד׳',
    Thu: 'ה׳',
    Fri: 'ו׳',
    Sat: 'ש׳',
    Sun: 'א׳',
    Понедельник: 'יום שני',
    Вторник: 'יום שלישי',
    Среда: 'יום רביעי',
    Четверг: 'יום חמישי',
    Пятница: 'יום שישי',
    Суббота: 'שבת',
    Воскресенье: 'יום ראשון',
    Пн: 'ב׳',
    Вт: 'ג׳',
    Ср: 'ד׳',
    Чт: 'ה׳',
    Пт: 'ו׳',
    Сб: 'ש׳',
    Вс: 'א׳',
  };

  const textTranslations: Record<string, string> = {
    Open: 'פתוח',
    Closed: 'סגור',
    'Open now': 'פתוח כעת',
    'Closed now': 'סגור כעת',
    '24/7': '24/7',
    AM: 'לפנה"צ',
    PM: 'אחה"צ',
    '–': '–',
    '-': '-',
    ':': ':',
    Открыто: 'פתוח',
    Закрыто: 'סגור',
    'Открыто сейчас': 'פתוח כעת',
    'Закрыто сейчас': 'סגור כעת',
  };

  const additionalTranslations: Record<string, string> = {
    to: 'עד',
    from: 'מ',
    until: 'עד',
    and: 'ו',
    or: 'או',
    hours: 'שעות',
    hour: 'שעה',
    min: 'דק',
    minutes: 'דקות',
    с: 'מ',
    до: 'עד',
    и: 'ו',
    или: 'או',
    часы: 'שעות',
    час: 'שעה',
  };

  let translated = hoursText;

  const sortedDays = Object.keys(dayTranslations).sort((a, b) => b.length - a.length);
  sortedDays.forEach((day) => {
    if (/[\u0590-\u05FF]/.test(day)) {
      const regex = new RegExp(day.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      translated = translated.replace(regex, dayTranslations[day]);
    } else {
      const escapedDay = day.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedDay}(?=\\s*[:\\s]|\\b)`, 'gi');
      translated = translated.replace(regex, dayTranslations[day]);
    }
  });

  Object.keys(textTranslations).forEach((text) => {
    if (/[\u0590-\u05FF]/.test(text)) {
      const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      translated = translated.replace(regex, textTranslations[text]);
    } else {
      const regex = new RegExp(`\\b${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      translated = translated.replace(regex, textTranslations[text]);
    }
  });

  Object.keys(additionalTranslations).forEach((word) => {
    if (/[\u0590-\u05FF]/.test(word)) {
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      translated = translated.replace(regex, additionalTranslations[word]);
    } else {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      translated = translated.replace(regex, additionalTranslations[word]);
    }
  });

  const englishDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  englishDays.forEach((day) => {
    const regex = new RegExp(`\\b${day}\\b`, 'gi');
    if (regex.test(translated)) {
      const hebrewDay = dayTranslations[day];
      if (hebrewDay) {
        translated = translated.replace(regex, hebrewDay);
      } else {
        translated = translated.replace(regex, '');
      }
    }
  });

  const russianDays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  russianDays.forEach((day) => {
    const regex = new RegExp(day, 'g');
    if (regex.test(translated)) {
      const hebrewDay = dayTranslations[day];
      if (hebrewDay) {
        translated = translated.replace(regex, hebrewDay);
      } else {
        translated = translated.replace(regex, '');
      }
    }
  });

  const englishWords = ['Open', 'Closed', 'Open now', 'Closed now', 'hours', 'hour', 'to', 'from', 'until', 'and', 'or'];
  englishWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(translated)) {
      const hebrewWord = textTranslations[word] || additionalTranslations[word];
      if (hebrewWord) {
        translated = translated.replace(regex, hebrewWord);
      } else {
        translated = translated.replace(regex, '');
      }
    }
  });

  const russianWords = ['Открыто', 'Закрыто', 'Открыто сейчас', 'Закрыто сейчас', 'часы', 'час', 'до', 'с', 'и', 'или'];
  russianWords.forEach((word) => {
    const regex = new RegExp(word, 'g');
    if (regex.test(translated)) {
      const hebrewWord = textTranslations[word] || additionalTranslations[word];
      if (hebrewWord) {
        translated = translated.replace(regex, hebrewWord);
      } else {
        translated = translated.replace(regex, '');
      }
    }
  });

  translated = translated.replace(/[a-zA-Z\u0400-\u04FF]/g, '');
  translated = translated.replace(/\s+/g, ' ').trim();

  return translated;
}

export function formatOpeningHoursDisplay(hours: string[] | string | null): string {
  if (!hours) return '';
  let hoursArray: string[] = [];

  if (typeof hours === 'string') {
    try {
      const parsed = JSON.parse(hours);
      if (Array.isArray(parsed)) {
        hoursArray = parsed;
      } else {
        hoursArray = [parsed];
      }
    } catch {
      hoursArray = [hours];
    }
  } else if (Array.isArray(hours) && hours.length > 0) {
    hoursArray = hours;
  }

  const translatedHours = hoursArray.map((hoursText) => translateOpeningHours(hoursText));
  return translatedHours.join(' • ');
}
